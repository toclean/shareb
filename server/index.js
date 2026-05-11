const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : []),
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many attempts, try again later' } });

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Serve uploaded files
const UPLOADS_DIR = path.join(process.env.DATA_DIR || __dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/shopping', require('./routes/shopping'));
app.use('/api/passwords', require('./routes/passwords'));

// Image proxy – fetches external thumbnails server-side (bypasses Amazon hotlink blocking)
// No auth required: proxied images are already publicly accessible; rate-limited to prevent abuse
const imgProxyLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.get('/api/imgproxy', imgProxyLimiter, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).end(); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).end();
  // Only allow known image CDN hostnames
  const allowed = [
    // Amazon
    'm.media-amazon.com', 'images-amazon.com', 'images-na.ssl-images-amazon.com', 'og.media-amazon.com',
    // Walmart
    'i5.walmartimages.com', 'i.walmartimages.com',
    // Target
    'target.scene7.com', 'assets.target.com',
    // Best Buy
    'pisces.bbystatic.com',
  ];
  const ogAllowed = parsed.hostname.endsWith('.media-amazon.com') || parsed.hostname.endsWith('.ssl-images-amazon.com')
    || parsed.hostname.endsWith('.walmartimages.com') || parsed.hostname.endsWith('.scene7.com');
  if (!allowed.includes(parsed.hostname) && !ogAllowed) {
    // For non-Amazon URLs (og:image), allow any https image
    if (parsed.protocol !== 'https:') return res.status(400).end();
  }
  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.amazon.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return res.status(upstream.status).end();
    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return res.status(400).end();
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buf = await upstream.arrayBuffer();
    // Reject suspiciously tiny responses (tracking pixels, placeholder GIFs)
    if (buf.byteLength < 500) return res.status(404).end();
    res.send(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'shareb 🐝' }));

// Serve React build in production
const CLIENT_BUILD = process.env.CLIENT_BUILD_DIR || path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_BUILD)) {
  app.use(express.static(CLIENT_BUILD));
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_BUILD, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🐝 Shareb server running on http://localhost:${PORT}`);
});
