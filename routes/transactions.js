const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get user's transactions
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, service_type, status, from_date, to_date } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
    let where = 'user_id = ?';
    const params = [req.user.id];

    if (service_type) { where += ' AND service_type = ?'; params.push(service_type); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (from_date) { where += ' AND created_at >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND created_at <= ?'; params.push(to_date + ' 23:59:59'); }

    const [txns] = await db.query(
      `SELECT * FROM transactions WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Math.min(100, parseInt(limit)), offset]
    );
    const [count] = await db.query(`SELECT COUNT(*) as total FROM transactions WHERE ${where}`, params);
    const [summary] = await db.query(
      `SELECT COUNT(*) as total_count, COALESCE(SUM(amount),0) as total_amount, COALESCE(SUM(commission_amount),0) as total_commission FROM transactions WHERE ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        transactions: txns,
        summary: summary[0],
        pagination: { total: count[0].total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count[0].total / limit) }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get transaction detail
router.get('/:transactionId', async (req, res) => {
  try {
    const [txns] = await db.query('SELECT * FROM transactions WHERE transaction_id = ? AND user_id = ?', [req.params.transactionId, req.user.id]);
    if (txns.length === 0) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, data: txns[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Check transaction status
router.get('/:transactionId/status', async (req, res) => {
  try {
    const [txns] = await db.query('SELECT transaction_id, status, api_reference FROM transactions WHERE transaction_id = ?', [req.params.transactionId]);
    if (txns.length === 0) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, data: txns[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Downline transactions (for distributors/MD)
router.get('/downline/all', async (req, res) => {
  try {
    const { page = 1, limit = 20, user_id } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
    
    let where = 'u.parent_id = ?';
    const params = [req.user.id];
    
    if (user_id) { where += ' AND t.user_id = ?'; params.push(user_id); }

    const [txns] = await db.query(
      `SELECT t.*, u.name as user_name, u.user_id as user_code, u.role as user_role
       FROM transactions t JOIN users u ON t.user_id = u.id
       WHERE ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Math.min(100, parseInt(limit)), offset]
    );
    const [count] = await db.query(
      `SELECT COUNT(*) as total FROM transactions t JOIN users u ON t.user_id = u.id WHERE ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        transactions: txns,
        pagination: { total: count[0].total, page: parseInt(page), limit: parseInt(limit) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
