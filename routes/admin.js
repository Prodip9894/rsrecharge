const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireRole, requireMinRole } = require('../middleware/auth');
const { generateUserId } = require('../utils/helpers');
const { sendNotification } = require('../utils/socket');

// Dashboard stats
router.get('/dashboard', requireRole('admin'), async (req, res) => {
  try {
    const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');
    const [activeUsers] = await db.query('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const [totalRetailers] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "retailer"');
    const [totalDistributors] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "distributor"');
    const [totalMDs] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "master_distributor"');
    const [todayTransactions] = await db.query('SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM transactions WHERE DATE(created_at) = CURDATE()');
    const [todayRevenue] = await db.query('SELECT COALESCE(SUM(commission_amount),0) as total FROM transactions WHERE DATE(created_at) = CURDATE() AND status = "success"');
    const [pendingApprovals] = await db.query('SELECT COUNT(*) as count FROM users WHERE is_verified = 0 AND role != "admin"');
    const [totalWalletBalance] = await db.query('SELECT COALESCE(SUM(balance),0) as total FROM wallets');
    const [recentTransactions] = await db.query('SELECT t.*, u.name as user_name, u.user_id as user_code FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 10');

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers[0].count,
        activeUsers: activeUsers[0].count,
        totalRetailers: totalRetailers[0].count,
        totalDistributors: totalDistributors[0].count,
        totalMDs: totalMDs[0].count,
        todayTransactions: todayTransactions[0].count,
        todayTransactionAmount: todayTransactions[0].total,
        todayRevenue: todayRevenue[0].total,
        pendingApprovals: pendingApprovals[0].count,
        totalWalletBalance: totalWalletBalance[0].total,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all users with pagination and filters
router.get('/users', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, status, parent_id } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
    let where = '1=1';
    const params = [];

    if (role) { where += ' AND role = ?'; params.push(role); }
    if (status === 'active') { where += ' AND is_active = 1'; }
    if (status === 'inactive') { where += ' AND is_active = 0'; }
    if (status === 'pending') { where += ' AND is_verified = 0'; }
    if (parent_id) { where += ' AND parent_id = ?'; params.push(parent_id); }
    if (search) {
      where += ' AND (name LIKE ? OR mobile LIKE ? OR email LIKE ? OR user_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const [users] = await db.query(
      `SELECT u.*, w.balance FROM users u LEFT JOIN wallets w ON u.id = w.user_id WHERE ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Math.min(100, parseInt(limit)), offset]
    );
    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM users WHERE ${where}`, params);

    res.json({
      success: true,
      data: {
        users: users.map(u => ({ ...u, password: undefined })),
        pagination: {
          total: countResult[0].total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create user (admin can create any role)
router.post('/users', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, mobile, password, role, parent_id, company_name, gst_number, pan_number, address, city, state, pincode } = req.body;

    if (!name || !mobile || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, mobile, password and role are required' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE mobile = ?', [mobile]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Mobile number already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateUserId(role);

    const [result] = await db.query(
      `INSERT INTO users (user_id, name, email, mobile, password, role, parent_id, company_name, gst_number, pan_number, address, city, state, pincode, is_verified, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [userId, name, email || null, mobile, hashedPassword, role, parent_id || null, company_name || '', gst_number || '', pan_number || '', address || '', city || '', state || '', pincode || '']
    );

    await db.query('INSERT INTO wallets (user_id, balance) VALUES (?, 0.00)', [result.insertId]);

    res.status(201).json({ success: true, message: 'User created successfully', data: { id: result.insertId, user_id: userId } });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user
router.put('/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, mobile, role, is_active, is_verified, company_name, gst_number, pan_number, address, city, state, pincode, parent_id } = req.body;
    await db.query(
      `UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), mobile = COALESCE(?, mobile),
       role = COALESCE(?, role), is_active = COALESCE(?, is_active), is_verified = COALESCE(?, is_verified),
       company_name = COALESCE(?, company_name), gst_number = COALESCE(?, gst_number), pan_number = COALESCE(?, pan_number),
       address = COALESCE(?, address), city = COALESCE(?, city), state = COALESCE(?, state), pincode = COALESCE(?, pincode),
       parent_id = COALESCE(?, parent_id) WHERE id = ?`,
      [name, email, mobile, role, is_active, is_verified, company_name, gst_number, pan_number, address, city, state, pincode, parent_id, req.params.id]
    );
    res.json({ success: true, message: 'User updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Toggle user status
router.put('/users/:id/toggle-status', requireRole('admin'), async (req, res) => {
  try {
    await db.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User status toggled' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve user
router.put('/users/:id/approve', requireRole('admin'), async (req, res) => {
  try {
    const [user] = await db.query('SELECT id, name, role FROM users WHERE id = ?', [req.params.id]);
    if (user.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

    await db.query('UPDATE users SET is_verified = 1 WHERE id = ?', [req.params.id]);
    await sendNotification(user[0].id, 'Account Approved', 'Your account has been approved. You can now login.', 'success');

    res.json({ success: true, message: 'User approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', requireRole('admin'), async (req, res) => {
  try {
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all transactions with filters
router.get('/transactions', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, service_type, user_id, from_date, to_date } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
    let where = '1=1';
    const params = [];

    if (status) { where += ' AND t.status = ?'; params.push(status); }
    if (service_type) { where += ' AND t.service_type = ?'; params.push(service_type); }
    if (user_id) { where += ' AND t.user_id = ?'; params.push(user_id); }
    if (from_date) { where += ' AND t.created_at >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND t.created_at <= ?'; params.push(to_date + ' 23:59:59'); }

    const [txns] = await db.query(
      `SELECT t.*, u.name as user_name, u.user_id as user_code, u.role as user_role
       FROM transactions t JOIN users u ON t.user_id = u.id WHERE ${where}
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Math.min(100, parseInt(limit)), offset]
    );
    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM transactions t WHERE ${where}`, params);

    res.json({
      success: true,
      data: {
        transactions: txns,
        pagination: { total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(countResult[0].total / limit) }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get system settings
router.get('/settings', requireRole('admin'), async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM system_settings ORDER BY setting_group, setting_key');
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update system settings
router.put('/settings', requireRole('admin'), async (req, res) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await db.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get commission rules
router.get('/commissions', requireRole('admin'), async (req, res) => {
  try {
    const [rules] = await db.query('SELECT * FROM commission_rules ORDER BY service_type, role');
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Save commission rule
router.post('/commissions', requireRole('admin'), async (req, res) => {
  try {
    const { service_type, operator_code, role, commission_type, commission_value, min_amount, max_amount } = req.body;
    await db.query(
      `INSERT INTO commission_rules (service_type, operator_code, role, commission_type, commission_value, min_amount, max_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE commission_value = VALUES(commission_value)`,
      [service_type, operator_code || '', role, commission_type || 'percentage', commission_value, min_amount || 0, max_amount || 999999]
    );
    res.json({ success: true, message: 'Commission rule saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get API providers
router.get('/api-providers', requireRole('admin'), async (req, res) => {
  try {
    const [providers] = await db.query('SELECT id, name, code, base_url, is_active, priority, balance, last_balance_check, services_supported, created_at FROM api_providers ORDER BY priority');
    res.json({ success: true, data: providers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Save API provider
router.post('/api-providers', requireRole('admin'), async (req, res) => {
  try {
    const { name, code, base_url, api_key, api_secret, username, password, callback_url, services_supported, is_active, priority } = req.body;
    await db.query(
      `INSERT INTO api_providers (name, code, base_url, api_key, api_secret, username, password, callback_url, services_supported, is_active, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), base_url=VALUES(base_url), api_key=VALUES(api_key), api_secret=VALUES(api_secret),
       username=VALUES(username), password=VALUES(password), callback_url=VALUES(callback_url), services_supported=VALUES(services_supported),
       is_active=VALUES(is_active), priority=VALUES(priority)`,
      [name, code, base_url, api_key || '', api_secret || '', username || '', password || '', callback_url || '', JSON.stringify(services_supported || []), is_active !== false ? 1 : 0, priority || 1]
    );
    res.json({ success: true, message: 'API provider saved' });
  } catch (error) {
    console.error('Save API provider error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get operators
router.get('/operators', requireRole('admin'), async (req, res) => {
  try {
    const [operators] = await db.query('SELECT * FROM service_operators ORDER BY service_type, sort_order');
    res.json({ success: true, data: operators });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Save operator
router.post('/operators', requireRole('admin'), async (req, res) => {
  try {
    const { service_type, operator_name, operator_code, commission_retailer, commission_distributor, commission_md, api_provider_id, api_operator_code, is_active, sort_order } = req.body;
    await db.query(
      `INSERT INTO service_operators (service_type, operator_name, operator_code, commission_retailer, commission_distributor, commission_md, api_provider_id, api_operator_code, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [service_type, operator_name, operator_code, commission_retailer || 0, commission_distributor || 0, commission_md || 0, api_provider_id || null, api_operator_code || '', is_active !== false ? 1 : 0, sort_order || 0]
    );
    res.json({ success: true, message: 'Operator saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin adjust wallet
router.post('/wallet-adjust', requireRole('admin'), async (req, res) => {
  try {
    const { user_id, amount, type, description } = req.body;
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      const [wallet] = await conn.query('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [user_id]);
      if (wallet.length === 0) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Wallet not found' }); }

      const balanceBefore = parseFloat(wallet[0].balance);
      let balanceAfter;
      if (type === 'credit') {
        balanceAfter = balanceBefore + parseFloat(amount);
      } else {
        balanceAfter = balanceBefore - parseFloat(amount);
        if (balanceAfter < 0) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Insufficient balance' }); }
      }

      await conn.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, user_id]);
      await conn.query(
        'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [user_id, type, amount, balanceBefore, balanceAfter, description || 'Admin adjustment', 'admin_adjust', req.user.id]
      );

      await conn.commit();
      res.json({ success: true, message: 'Wallet adjusted', data: { balance: balanceAfter } });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Wallet adjust error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Audit logs
router.get('/audit-logs', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
    const [logs] = await db.query(
      `SELECT a.*, u.name as user_name, u.user_id as user_code FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [Math.min(100, parseInt(limit)), offset]
    );
    const [count] = await db.query('SELECT COUNT(*) as total FROM audit_logs');
    res.json({ success: true, data: { logs, total: count[0].total } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete user permanently
router.delete('/users/:id/permanent', requireRole('admin'), async (req, res) => {
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if (user.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    if (user[0].role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin user' });
    
    await db.query('UPDATE users SET is_active = 0, email = CONCAT(email, "_deleted_", UNIX_TIMESTAMP()), mobile = CONCAT(mobile, "_deleted_", UNIX_TIMESTAMP()) WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User deleted permanently' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Upgrade user role
router.put('/users/:id/upgrade', requireRole('admin'), async (req, res) => {
  try {
    const { new_role } = req.body;
    const roleHierarchy = { retailer: 1, distributor: 2, master_distributor: 3, admin: 4 };
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if (user.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    
    if (roleHierarchy[new_role] <= roleHierarchy[user[0].role]) {
      return res.status(400).json({ success: false, message: 'Can only upgrade to higher role' });
    }
    
    await db.query('UPDATE users SET role = ? WHERE id = ?', [new_role, req.params.id]);
    const { sendNotification } = require('../utils/socket');
    await sendNotification(parseInt(req.params.id), 'Role Upgraded', `Your account has been upgraded to ${new_role.replace('_', ' ')}`, 'success');
    res.json({ success: true, message: `User upgraded to ${new_role}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get UPI settings
router.get('/upi-settings', requireRole('admin'), async (req, res) => {
  try {
    const [settings] = await db.query("SELECT * FROM system_settings WHERE setting_group = 'upi'");
    const upiData = {};
    settings.forEach(s => { upiData[s.setting_key] = s.setting_value; });
    res.json({ success: true, data: upiData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Save UPI settings
router.put('/upi-settings', requireRole('admin'), async (req, res) => {
  try {
    const { upi_id, merchant_name, qr_image, upi_enabled } = req.body;
    const settings = [
      ['upi_id', upi_id || ''],
      ['merchant_name', merchant_name || 'RSRecharge'],
      ['qr_image', qr_image || ''],
      ['upi_enabled', upi_enabled ? '1' : '0']
    ];
    for (const [key, value] of settings) {
      await db.query(
        `INSERT INTO system_settings (setting_key, setting_value, setting_group) VALUES (?, ?, 'upi')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, value]
      );
    }
    res.json({ success: true, message: 'UPI settings saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Wallet to wallet transfer (admin)
router.post('/wallet-transfer', requireRole('admin'), async (req, res) => {
  try {
    const { to_user_id, amount, description } = req.body;
    if (!to_user_id || !amount) return res.status(400).json({ success: false, message: 'Recipient and amount required' });
    
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const [senderWallet] = await conn.query('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [req.user.id]);
      const [recipient] = await conn.query('SELECT id, name FROM users WHERE id = ?', [to_user_id]);
      if (recipient.length === 0) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Recipient not found' }); }
      if (parseFloat(senderWallet[0].balance) < parseFloat(amount)) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Insufficient balance' }); }
      
      const senderBefore = parseFloat(senderWallet[0].balance);
      const senderAfter = senderBefore - parseFloat(amount);
      await conn.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [senderAfter, req.user.id]);
      await conn.query(
        'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, created_by) VALUES (?, "debit", ?, ?, ?, ?, "admin_transfer", ?)',
        [req.user.id, amount, senderBefore, senderAfter, description || `Transfer to ${recipient[0].name}`, req.user.id]
      );
      
      const [recvWallet] = await conn.query('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [to_user_id]);
      const recvBefore = recvWallet.length > 0 ? parseFloat(recvWallet[0].balance) : 0;
      const recvAfter = recvBefore + parseFloat(amount);
      if (recvWallet.length > 0) {
        await conn.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [recvAfter, to_user_id]);
      } else {
        await conn.query('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [to_user_id, amount]);
      }
      await conn.query(
        'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, created_by) VALUES (?, "credit", ?, ?, ?, ?, "admin_transfer", ?)',
        [to_user_id, amount, recvBefore, recvAfter, description || `Transfer from Admin`, req.user.id]
      );
      
      await conn.commit();
      const { sendNotification } = require('../utils/socket');
      await sendNotification(to_user_id, 'Wallet Credited', `₹${amount} has been credited to your wallet.`, 'success');
      res.json({ success: true, message: `₹${amount} transferred successfully`, data: { balance: senderAfter } });
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  } catch (error) {
    console.error('Admin wallet transfer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get today's commission summary
router.get('/today-commission', requireRole('admin'), async (req, res) => {
  try {
    const [retailerComm] = await db.query(
      `SELECT COALESCE(SUM(commission_amount),0) as total FROM transactions t JOIN users u ON t.user_id = u.id 
       WHERE DATE(t.created_at) = CURDATE() AND t.status = 'success' AND u.role = 'retailer'`
    );
    const [distributorComm] = await db.query(
      `SELECT COALESCE(SUM(commission_amount),0) as total FROM transactions t JOIN users u ON t.user_id = u.id 
       WHERE DATE(t.created_at) = CURDATE() AND t.status = 'success' AND u.role = 'distributor'`
    );
    const [mdComm] = await db.query(
      `SELECT COALESCE(SUM(commission_amount),0) as total FROM transactions t JOIN users u ON t.user_id = u.id 
       WHERE DATE(t.created_at) = CURDATE() AND t.status = 'success' AND u.role = 'master_distributor'`
    );
    const [totalComm] = await db.query(
      `SELECT COALESCE(SUM(commission_amount),0) as total FROM transactions 
       WHERE DATE(created_at) = CURDATE() AND status = 'success'`
    );
    res.json({
      success: true,
      data: {
        retailer: parseFloat(retailerComm[0].total),
        distributor: parseFloat(distributorComm[0].total),
        master_distributor: parseFloat(mdComm[0].total),
        total: parseFloat(totalComm[0].total)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Banners management
router.get('/banners', async (req, res) => {
  try {
    const [banners] = await db.query('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC');
    res.json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/banners', requireRole('admin'), async (req, res) => {
  try {
    const { title, description, image_url, link_url, is_active, sort_order, target_role } = req.body;
    await db.query(
      'INSERT INTO banners (title, description, image_url, link_url, is_active, sort_order, target_role, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description || '', image_url || '', link_url || '', is_active !== false ? 1 : 0, sort_order || 0, target_role || 'all', req.user.id]
    );
    res.json({ success: true, message: 'Banner created' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/banners/:id', requireRole('admin'), async (req, res) => {
  try {
    const { title, description, image_url, link_url, is_active, sort_order, target_role } = req.body;
    await db.query(
      'UPDATE banners SET title=?, description=?, image_url=?, link_url=?, is_active=?, sort_order=?, target_role=? WHERE id=?',
      [title, description, image_url, link_url, is_active ? 1 : 0, sort_order || 0, target_role || 'all', req.params.id]
    );
    res.json({ success: true, message: 'Banner updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/banners/:id', requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send notification to downline
router.post('/send-notification', requireRole('admin'), async (req, res) => {
  try {
    const { user_ids, role, title, message, type } = req.body;
    const { sendNotification } = require('../utils/socket');
    
    let where = '1=1';
    const params = [];
    if (user_ids && user_ids.length > 0) {
      where = `id IN (${user_ids.map(() => '?').join(',')})`;
      params.push(...user_ids);
    } else if (role) {
      where = 'role = ?';
      params.push(role);
    }
    
    const [users] = await db.query(`SELECT id FROM users WHERE ${where} AND is_active = 1`, params);
    let sentCount = 0;
    for (const user of users) {
      await sendNotification(user.id, title, message, type || 'info');
      sentCount++;
    }
    
    res.json({ success: true, message: `Notification sent to ${sentCount} users` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// WhatsApp API settings
router.get('/whatsapp-settings', requireRole('admin'), async (req, res) => {
  try {
    const [settings] = await db.query("SELECT * FROM system_settings WHERE setting_group = 'whatsapp'");
    const waData = {};
    settings.forEach(s => { waData[s.setting_key] = s.setting_value; });
    res.json({ success: true, data: waData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/whatsapp-settings', requireRole('admin'), async (req, res) => {
  try {
    const { wa_api_url, wa_api_key, wa_sender, wa_enabled, wa_template_id } = req.body;
    const settings = [
      ['wa_api_url', wa_api_url || ''],
      ['wa_api_key', wa_api_key || ''],
      ['wa_sender', wa_sender || ''],
      ['wa_enabled', wa_enabled ? '1' : '0'],
      ['wa_template_id', wa_template_id || '']
    ];
    for (const [key, value] of settings) {
      await db.query(
        `INSERT INTO system_settings (setting_key, setting_value, setting_group) VALUES (?, ?, 'whatsapp')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [key, value]
      );
    }
    res.json({ success: true, message: 'WhatsApp settings saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Pay-in/Payout API settings
router.get('/payout-settings', requireRole('admin'), async (req, res) => {
  try {
    const [settings] = await db.query("SELECT * FROM system_settings WHERE setting_group = 'payout'");
    const pData = {};
    settings.forEach(s => { pData[s.setting_key] = s.setting_value; });
    res.json({ success: true, data: pData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/payout-settings', requireRole('admin'), async (req, res) => {
  try {
    const { payout_api_url, payout_api_key, payout_merchant_id, payout_enabled, payin_api_url, payin_api_key, payin_enabled } = req.body;
    const settings = [
      ['payout_api_url', payout_api_url || ''],
      ['payout_api_key', payout_api_key || ''],
      ['payout_merchant_id', payout_merchant_id || ''],
      ['payout_enabled', payout_enabled ? '1' : '0'],
      ['payin_api_url', payin_api_url || ''],
      ['payin_api_key', payin_api_key || ''],
      ['payin_enabled', payin_enabled ? '1' : '0']
    ];
    for (const [key, value] of settings) {
      await db.query(
        `INSERT INTO system_settings (setting_key, setting_value, setting_group) VALUES (?, ?, 'payout')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [key, value]
      );
    }
    res.json({ success: true, message: 'Pay-in/Payout settings saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Move to bank requests
router.get('/move-to-bank', requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND mtb.status = ?'; params.push(status); }
    const [requests] = await db.query(
      `SELECT mtb.*, u.name as user_name, u.user_id as user_code, u.mobile as user_mobile
       FROM move_to_bank_requests mtb JOIN users u ON mtb.user_id = u.id
       WHERE ${where} ORDER BY mtb.created_at DESC`, params
    );
    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/move-to-bank/:id', requireRole('admin'), async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const [request] = await db.query('SELECT * FROM move_to_bank_requests WHERE id = ?', [req.params.id]);
    if (request.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });
    
    await db.query('UPDATE move_to_bank_requests SET status = ?, remarks = ?, processed_by = ?, processed_at = NOW() WHERE id = ?',
      [status, remarks || '', req.user.id, req.params.id]);
    
    const { sendNotification } = require('../utils/socket');
    const msg = status === 'approved' ? `Your move-to-bank request of ₹${request[0].amount} has been approved.` : `Your move-to-bank request has been rejected. ${remarks || ''}`;
    await sendNotification(request[0].user_id, `Move to Bank ${capitalize(status)}`, msg, status === 'approved' ? 'success' : 'error');
    
    res.json({ success: true, message: `Request ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

module.exports = router;
