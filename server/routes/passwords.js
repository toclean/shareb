const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'shareb-vault-key-32-chars-padded!!';
const KEY = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

function decrypt(encrypted, ivHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// GET /api/passwords
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT passwords.*, users.display_name, users.avatar_color
    FROM passwords
    JOIN users ON passwords.added_by = users.id
    ORDER BY passwords.created_at DESC
  `).all();

  const decrypted = rows.map(row => ({
    ...row,
    password_plain: decrypt(row.password_enc, row.iv),
    password_enc: undefined,
    iv: undefined
  }));

  res.json({ passwords: decrypted });
});

// POST /api/passwords
router.post('/', (req, res) => {
  const { title, username_val, password, website, notes } = req.body;
  if (!title || !password) return res.status(400).json({ error: 'Title and password required' });

  const { encrypted, iv } = encrypt(password);

  const result = db.prepare(`
    INSERT INTO passwords (added_by, title, username_val, password_enc, iv, website, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, username_val || null, encrypted, iv, website || null, notes || null);

  const row = db.prepare(`
    SELECT passwords.*, users.display_name, users.avatar_color
    FROM passwords JOIN users ON passwords.added_by = users.id
    WHERE passwords.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({
    password: {
      ...row,
      password_plain: decrypt(row.password_enc, row.iv),
      password_enc: undefined,
      iv: undefined
    }
  });
});

// PUT /api/passwords/:id
router.put('/:id', (req, res) => {
  const { title, username_val, password, website, notes } = req.body;
  const existing = db.prepare('SELECT * FROM passwords WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.added_by !== req.user.id) return res.status(403).json({ error: 'Not yours to edit' });

  let enc = existing.password_enc;
  let iv = existing.iv;
  if (password) {
    const result = encrypt(password);
    enc = result.encrypted;
    iv = result.iv;
  }

  db.prepare(`
    UPDATE passwords SET title=?, username_val=?, password_enc=?, iv=?, website=?, notes=? WHERE id=?
  `).run(title || existing.title, username_val ?? existing.username_val, enc, iv, website ?? existing.website, notes ?? existing.notes, existing.id);

  const row = db.prepare(`
    SELECT passwords.*, users.display_name, users.avatar_color
    FROM passwords JOIN users ON passwords.added_by = users.id
    WHERE passwords.id = ?
  `).get(existing.id);

  res.json({
    password: {
      ...row,
      password_plain: decrypt(row.password_enc, row.iv),
      password_enc: undefined,
      iv: undefined
    }
  });
});

// DELETE /api/passwords/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM passwords WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.added_by !== req.user.id) return res.status(403).json({ error: 'Not yours to delete' });

  db.prepare('DELETE FROM passwords WHERE id = ?').run(existing.id);
  res.json({ success: true });
});

module.exports = router;
