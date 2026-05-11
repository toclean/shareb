const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Setup uploads directory
const UPLOADS_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/flac', 'audio/aac',
    'application/pdf'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Helper: extract a <meta> tag value from raw HTML
function extractMeta(html, property) {
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i');
  return (html.match(a) || html.match(b))?.[1]?.trim() || null;
}

// Helper: block private/loopback IPs to prevent SSRF
function isPrivateHost(hostname) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
}

router.use(authMiddleware);

// GET /api/items/link-preview?url=  – fetch thumbnail + price from a URL
router.get('/link-preview', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).json({ error: 'Only HTTP/HTTPS' });
  if (isPrivateHost(parsed.hostname)) return res.status(400).json({ error: 'Private URLs not allowed' });

  const result = { title: null, thumbnail: null, price: null };

  // Fetch the page – follows redirects so a.co short links resolve to the real URL
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (resp.ok) {
      const html = await resp.text();
      const finalUrl = resp.url;

      const ogImage = extractMeta(html, 'og:image');
      const ogTitle = extractMeta(html, 'og:title') || html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1];

      if (ogImage && ogImage.startsWith('http')) result.thumbnail = ogImage;
      if (ogTitle) result.title = ogTitle.replace(/\s+/g, ' ');

      // Amazon-specific image extraction (og:image often missing for scrapers)
      if (!result.thumbnail) {
        const imgPatterns = [
          /"hiRes"\s*:\s*"(https:\/\/[^"]+)"/,
          /"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/[^"]+)"/,
          /landingImageUrl[^"]*"(https:\/\/[^"]+)"/,
          /data-old-hires="(https:\/\/[^"]+)"/,
          /"mainImageUrl"\s*:\s*"(https:\/\/[^"]+)"/,
          /"colorImages"[^{]*\{[^}]*"hiRes"\s*:\s*"(https:\/\/[^"]+)"/,
          /id="landingImage"[^>]+src="(https:\/\/[^"]+)"/,
          /"imageGalleryData"[^[]*\[[^\]]*"mainUrl"\s*:\s*"(https:\/\/[^"]+)"/,
        ];
        for (const pat of imgPatterns) {
          const m = html.match(pat);
          if (m?.[1]) { result.thumbnail = m[1]; break; }
        }
      }

      // Amazon-specific title extraction (og:title often missing)
      if (!result.title) {
        const titlePatterns = [
          /<span[^>]+id="productTitle"[^>]*>\s*([^<]{3,300})\s*<\/span>/i,
          /"title"\s*:\s*"([^"]{5,300})"/,
        ];
        for (const pat of titlePatterns) {
          const m = html.match(pat);
          if (m?.[1]) { result.title = m[1].trim(); break; }
        }
      }

      // Amazon price extraction (best-effort)
      const pricePatterns = [
        /"priceAmount"\s*:\s*([\d.]+)/,
        /"displayPrice"\s*:\s*"([^"]+)"/,
        /"buyingPrice"\s*:\s*([\d.]+)/,
        /class="[^"]*a-price-whole[^"]*"[^>]*>\s*([\d,]+)\s*</,
        /id="priceblock_ourprice"[^>]*>\s*\$?([\d,.]+)/,
        /"price"\s*:\s*"(\$[^"]{1,20})"/,
      ];
      for (const pat of pricePatterns) {
        const m = html.match(pat);
        if (m?.[1]) {
          const raw = m[1].trim().replace(/,/g, '');
          const num = parseFloat(raw.replace(/[^\d.]/g, ''));
          if (!isNaN(num) && num > 0 && num < 100000) {
            result.price = raw.startsWith('$') ? raw : `$${num.toFixed(2)}`;
            break;
          }
        }
      }
    }
  } catch (_) { /* scraping failed – return what we have */ }

  res.json(result);
});

// GET /api/items  - get all items (from both users)
router.get('/', (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT items.*, users.display_name, users.avatar_color,
      (SELECT emoji FROM reactions WHERE item_id = items.id AND user_id = ?) as my_reaction
    FROM items
    JOIN users ON items.user_id = users.id
  `;
  const params = [req.user.id];

  if (type) {
    query += ' WHERE items.type = ?';
    params.push(type);
  }

  query += ' ORDER BY items.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const items = db.prepare(query).all(...params);

  // Parse tags JSON
  const parsed = items.map(item => ({
    ...item,
    tags: JSON.parse(item.tags || '[]'),
    is_mine: item.user_id === req.user.id
  }));

  res.json({ items: parsed });
});

// POST /api/items  - create a link/note/amazon item
router.post('/', (req, res) => {
  const { type, title, content, tags, notes, thumbnail, price } = req.body;

  const validTypes = ['link', 'amazon', 'note'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type for this endpoint. Use /upload for files.' });
  }

  if (!content && !title) {
    return res.status(400).json({ error: 'title or content required' });
  }

  const result = db.prepare(`
    INSERT INTO items (user_id, type, title, content, thumbnail, price, tags, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, type, title || null, content || null, thumbnail || null, price || null, JSON.stringify(tags || []), notes || null);

  const item = db.prepare(`
    SELECT items.*, users.display_name, users.avatar_color
    FROM items JOIN users ON items.user_id = users.id
    WHERE items.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ item: { ...item, tags: JSON.parse(item.tags), is_mine: true } });
});

// POST /api/items/upload  - upload a file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { title, tags, notes } = req.body;
  const mime = req.file.mimetype;

  let type = 'file';
  if (mime.startsWith('image/')) type = 'image';
  else if (mime.startsWith('video/')) type = 'video';
  else if (mime.startsWith('audio/')) type = 'music';

  const result = db.prepare(`
    INSERT INTO items (user_id, type, title, file_path, file_name, mime_type, tags, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, type,
    title || req.file.originalname,
    req.file.filename,
    req.file.originalname,
    mime,
    JSON.stringify(tags ? JSON.parse(tags) : []),
    notes || null
  );

  const item = db.prepare(`
    SELECT items.*, users.display_name, users.avatar_color
    FROM items JOIN users ON items.user_id = users.id
    WHERE items.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ item: { ...item, tags: JSON.parse(item.tags), is_mine: true } });
});

// PUT /api/items/:id/favorite
router.put('/:id/favorite', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE items SET is_favorite = ? WHERE id = ?').run(item.is_favorite ? 0 : 1, item.id);
  res.json({ is_favorite: !item.is_favorite });
});

// PUT /api/items/:id/meta  - patch thumbnail/price/title on any item
router.put('/:id/meta', async (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const { thumbnail, price, title } = req.body;
  db.prepare(`UPDATE items SET
    thumbnail = COALESCE(?, thumbnail),
    price     = COALESCE(?, price),
    title     = COALESCE(?, title)
    WHERE id = ?`).run(thumbnail || null, price || null, title || null, item.id);

  const updated = db.prepare(`
    SELECT items.*, users.display_name, users.avatar_color
    FROM items JOIN users ON items.user_id = users.id WHERE items.id = ?
  `).get(item.id);
  res.json({ item: { ...updated, tags: JSON.parse(updated.tags || '[]'), is_mine: updated.user_id === req.user.id } });
});

// POST /api/items/:id/react
router.post('/:id/react', (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    INSERT INTO reactions (item_id, user_id, emoji)
    VALUES (?, ?, ?)
    ON CONFLICT(item_id, user_id) DO UPDATE SET emoji = excluded.emoji
  `).run(item.id, req.user.id, emoji);

  res.json({ success: true });
});

// DELETE /api/items/:id
router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Not your item' });

  // Delete file if exists
  if (item.file_path) {
    const filePath = path.join(UPLOADS_DIR, item.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  res.json({ success: true });
});

module.exports = router;
