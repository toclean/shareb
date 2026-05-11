const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, display_name } = req.body;

  if (!username || !password || !display_name) {
    return res.status(400).json({ error: 'Username, password, and display name are required' });
  }

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 3-30 characters' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Only allow 2 users
  const count = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (count.cnt >= 2) {
    return res.status(403).json({ error: 'This app only supports two users. Please ask the owner to reset.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const colors = ['#F5C518', '#FFA500', '#FF6B6B', '#A8D8EA', '#AA96DA'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];

  const password_hash = await bcrypt.hash(password, 12);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, display_name, avatar_color) VALUES (?, ?, ?, ?)'
  ).run(username, password_hash, display_name, avatar_color);

  const token = jwt.sign(
    { id: result.lastInsertRowid, username, display_name, avatar_color },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.status(201).json({ token, user: { id: result.lastInsertRowid, username, display_name, avatar_color } });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, display_name: user.display_name, avatar_color: user.avatar_color },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name, avatar_color: user.avatar_color } });
});

// GET /api/auth/partner  - get the other user's info
router.get('/partner', require('../middleware/auth').authMiddleware, (req, res) => {
  const partner = db.prepare('SELECT id, username, display_name, avatar_color FROM users WHERE id != ?').get(req.user.id);
  if (!partner) {
    return res.json({ partner: null });
  }
  res.json({ partner });
});

module.exports = router;
