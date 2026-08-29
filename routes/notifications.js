const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get notifications
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);

    const [notifs] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, Math.min(100, parseInt(limit)), offset]
    );
    const [count] = await db.query('SELECT COUNT(*) as total, SUM(is_read = 0) as unread FROM notifications WHERE user_id = ?', [req.user.id]);

    res.json({
      success: true,
      data: { notifications: notifs, total: count[0].total, unread: count[0].unread || 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark as read
router.put('/:id/read', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark all as read
router.put('/read-all', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
