const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get wallet balance
router.get('/balance', async (req, res) => {
  try {
    const [wallet] = await db.query('SELECT * FROM wallets WHERE user_id = ?', [req.user.id]);
    if (wallet.length === 0) {
      return res.json({ success: true, data: { balance: 0, locked_balance: 0, total_recharged: 0, total_commission_earned: 0, total_withdrawn: 0 } });
    }
    res.json({ success: true, data: wallet[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get wallet transactions
router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
    let where = 'user_id = ?';
    const params = [req.user.id];

    if (type) { where += ' AND type = ?'; params.push(type); }

    const [txns] = await db.query(
      `SELECT * FROM wallet_transactions WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Math.min(100, parseInt(limit)), offset]
    );
    const [count] = await db.query(`SELECT COUNT(*) as total FROM wallet_transactions WHERE ${where}`, params);

    res.json({
      success: true,
      data: { transactions: txns, pagination: { total: count[0].total, page: parseInt(page), limit: parseInt(limit) } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add money request (manual bank transfer)
router.post('/add-money', async (req, res) => {
  try {
    const { amount, payment_method, reference_number, bank_name } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const txnId = 'ADD' + Date.now().toString(36).toUpperCase();
    await db.query(
      'INSERT INTO wallet_transactions (user_id, type, amount, description, reference_type, reference_id) VALUES (?, "credit", ?, ?, "add_money", ?)',
      [req.user.id, amount, `Add Money via ${payment_method || 'Bank Transfer'} - Ref: ${reference_number || 'N/A'}`, txnId]
    );

    // In production: auto-approve if configured, or send notification to admin for approval
    res.json({ success: true, message: 'Add money request submitted. It will be credited after admin approval.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Transfer money to downline
router.post('/transfer', async (req, res) => {
  try {
    const { to_user_id, amount, description } = req.body;
    if (!to_user_id || !amount) {
      return res.status(400).json({ success: false, message: 'Recipient and amount are required' });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      const [senderWallet] = await conn.query('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [req.user.id]);
      const [recipient] = await conn.query('SELECT id, name FROM users WHERE user_id = ?', [to_user_id]);

      if (recipient.length === 0) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Recipient not found' }); }
      if (parseFloat(senderWallet[0].balance) < parseFloat(amount)) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Insufficient balance' }); }

      const senderBefore = parseFloat(senderWallet[0].balance);
      const senderAfter = senderBefore - parseFloat(amount);

      await conn.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [senderAfter, req.user.id]);
      await conn.query(
        'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, created_by) VALUES (?, "debit", ?, ?, ?, ?, "transfer", ?)',
        [req.user.id, amount, senderBefore, senderAfter, description || `Transfer to ${to_user_id}`, req.user.id]
      );

      const [recvWallet] = await conn.query('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [recipient[0].id]);
      if (recvWallet.length > 0) {
        const recvBefore = parseFloat(recvWallet[0].balance);
        const recvAfter = recvBefore + parseFloat(amount);
        await conn.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [recvAfter, recipient[0].id]);
        await conn.query(
          'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, created_by) VALUES (?, "credit", ?, ?, ?, ?, "transfer", ?)',
          [recipient[0].id, amount, recvBefore, recvAfter, `Transfer from ${req.user.user_id}`, req.user.id]
        );
      } else {
        await conn.query('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [recipient[0].id, amount]);
        await conn.query(
          'INSERT INTO wallet_transactions (user_id, type, amount, description, reference_type, created_by) VALUES (?, "credit", ?, ?, "transfer", ?)',
          [recipient[0].id, amount, `Transfer from ${req.user.user_id}`, req.user.id]
        );
      }

      await conn.commit();
      res.json({ success: true, message: `₹${amount} transferred to ${to_user_id} successfully`, data: { balance: senderAfter } });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Manual QR payment submission
router.post('/manual-payment', async (req, res) => {
  try {
    const { amount, utr_number } = req.body;
    if (!amount || !utr_number) {
      return res.status(400).json({ success: false, message: 'Amount and UTR number are required' });
    }
    await db.query(
      'INSERT INTO manual_qr_payments (user_id, amount, utr_number, status) VALUES (?, ?, ?, "pending")',
      [req.user.id, amount, utr_number]
    );
    const { sendNotification } = require('../utils/socket');
    const [admins] = await db.query('SELECT id FROM users WHERE role = "admin"');
    for (const admin of admins) {
      await sendNotification(admin.id, 'New QR Payment', `₹${amount} payment received from user. UTR: ${utr_number}`, 'info');
    }
    res.json({ success: true, message: 'Payment submitted for approval' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get manual payments
router.get('/manual-payments', async (req, res) => {
  try {
    const [payments] = await db.query(
      'SELECT * FROM manual_qr_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Move to bank request
router.post('/move-to-bank', async (req, res) => {
  try {
    const { amount, bank_name, account_number, ifsc_code, account_holder_name } = req.body;
    if (!amount || !bank_name || !account_number || !ifsc_code || !account_holder_name) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);
    if (wallet.length === 0 || parseFloat(wallet[0].balance) < parseFloat(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    await db.query(
      'INSERT INTO move_to_bank_requests (user_id, amount, bank_name, account_number, ifsc_code, account_holder_name) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, amount, bank_name, account_number, ifsc_code, account_holder_name]
    );

    // Deduct from wallet
    const balanceBefore = parseFloat(wallet[0].balance);
    const balanceAfter = balanceBefore - parseFloat(amount);
    await db.query('UPDATE wallets SET balance = ?, total_withdrawn = total_withdrawn + ? WHERE user_id = ?', [balanceAfter, amount, req.user.id]);
    await db.query(
      'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type) VALUES (?, "debit", ?, ?, ?, "Move to Bank Request", "move_to_bank")',
      [req.user.id, amount, balanceBefore, balanceAfter]
    );

    const { sendNotification } = require('../utils/socket');
    const [admins] = await db.query('SELECT id FROM users WHERE role = "admin"');
    for (const admin of admins) {
      await sendNotification(admin.id, 'Move to Bank Request', `${req.user.name} (ID: ${req.user.user_id}) requested ₹${amount} move to bank.`, 'info');
    }

    res.json({ success: true, message: 'Move to bank request submitted', data: { balance: balanceAfter } });
  } catch (error) {
    console.error('Move to bank error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's move-to-bank requests
router.get('/move-to-bank', async (req, res) => {
  try {
    const [requests] = await db.query(
      'SELECT * FROM move_to_bank_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
