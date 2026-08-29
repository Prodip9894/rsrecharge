const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireRole } = require('../middleware/auth');

// Get downline users
router.get('/downline', async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.user_id, u.name, u.email, u.mobile, u.role, u.is_active, u.created_at, w.balance
       FROM users u LEFT JOIN wallets w ON u.id = w.user_id
       WHERE u.parent_id = ? ORDER BY u.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user tree/hierarchy
router.get('/tree', async (req, res) => {
  try {
    const buildTree = async (userId, depth = 0) => {
      if (depth > 5) return [];
      const [children] = await db.query(
        `SELECT u.id, u.user_id, u.name, u.role, u.is_active, w.balance,
         (SELECT COUNT(*) FROM users WHERE parent_id = u.id) as child_count
         FROM users u LEFT JOIN wallets w ON u.id = w.user_id
         WHERE u.parent_id = ? AND u.is_active = 1`,
        [userId]
      );

      for (let child of children) {
        child.children = await buildTree(child.id, depth + 1);
      }
      return children;
    };

    const tree = await buildTree(req.user.id);
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get downline summary
router.get('/downline-summary', async (req, res) => {
  try {
    const [directDownline] = await db.query(
      'SELECT role, COUNT(*) as count FROM users WHERE parent_id = ? GROUP BY role',
      [req.user.id]
    );
    const [totalDownline] = await db.query(
      `SELECT COUNT(*) as total FROM users WHERE parent_id = ? OR parent_id IN (
        SELECT id FROM users WHERE parent_id = ? OR parent_id IN (
          SELECT id FROM users WHERE parent_id = ?
        )
      )`,
      [req.user.id, req.user.id, req.user.id]
    );
    const [downlineTransactions] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as amount FROM transactions t
       JOIN users u ON t.user_id = u.id WHERE u.parent_id = ? AND DATE(t.created_at) = CURDATE()`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        directDownline,
        totalDownline: totalDownline[0].total,
        todayDownlineTransactions: downlineTransactions[0].count,
        todayDownlineAmount: downlineTransactions[0].amount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Dashboard for distributors/MD/retailers
router.get('/dashboard', async (req, res) => {
  try {
    const [wallet] = await db.query('SELECT * FROM wallets WHERE user_id = ?', [req.user.id]);
    const [todayTxns] = await db.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as amount FROM transactions WHERE user_id = ? AND DATE(created_at) = CURDATE()',
      [req.user.id]
    );
    const [totalTxns] = await db.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as amount FROM transactions WHERE user_id = ?',
      [req.user.id]
    );
    const [recentTxns] = await db.query(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [req.user.id]
    );
    const [unreadNotifs] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    const [downlineCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE parent_id = ?', [req.user.id]);

    res.json({
      success: true,
      data: {
        wallet: wallet[0] || { balance: 0 },
        todayTransactions: todayTxns[0],
        totalTransactions: totalTxns[0],
        recentTransactions: recentTxns,
        unreadNotifications: unreadNotifs[0].count,
        downlineCount: downlineCount[0].count
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get pending approvals (admin/MD)
router.get('/pending-approvals', requireRole('admin', 'master_distributor'), async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, user_id, name, mobile, email, role, parent_id, company_name, created_at
       FROM users WHERE is_verified = 0 AND is_active = 1 ORDER BY created_at DESC`
    );
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
