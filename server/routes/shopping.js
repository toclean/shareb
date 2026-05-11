const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/shopping
router.get('/', (req, res) => {
  const items = db.prepare(`
    SELECT shopping_items.*, users.display_name, users.avatar_color
    FROM shopping_items
    JOIN users ON shopping_items.added_by = users.id
    ORDER BY shopping_items.checked ASC, shopping_items.created_at DESC
  `).all();
  res.json({ items });
});

// POST /api/shopping
router.post('/', (req, res) => {
  const { name, quantity, category } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const result = db.prepare(`
    INSERT INTO shopping_items (added_by, name, quantity, category)
    VALUES (?, ?, ?, ?)
  `).run(req.user.id, name.trim(), quantity || '1', category || 'General');

  const item = db.prepare(`
    SELECT shopping_items.*, users.display_name, users.avatar_color
    FROM shopping_items JOIN users ON shopping_items.added_by = users.id
    WHERE shopping_items.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ item });
});

// PUT /api/shopping/:id/check
router.put('/:id/check', (req, res) => {
  const item = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE shopping_items SET checked = ? WHERE id = ?').run(item.checked ? 0 : 1, item.id);
  res.json({ checked: !item.checked });
});

// DELETE /api/shopping/:id
router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM shopping_items WHERE id = ?').run(item.id);
  res.json({ success: true });
});

// DELETE /api/shopping/checked/all  - clear all checked items
router.delete('/checked/all', (req, res) => {
  db.prepare('DELETE FROM shopping_items WHERE checked = 1').run();
  res.json({ success: true });
});

module.exports = router;
