const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateTransactionId } = require('../utils/helpers');
const { sendNotification } = require('../utils/socket');

// Send Money
router.post('/send-money', async (req, res) => {
  try {
    const { sender_name, sender_mobile, sender_aadhaar, beneficiary_id, beneficiary_name, beneficiary_account, beneficiary_ifsc, beneficiary_bank, amount, transfer_mode } = req.body;

    if (!sender_mobile || !amount) {
      return res.status(400).json({ success: false, message: 'Sender mobile and amount are required' });
    }

    const transactionId = generateTransactionId('DMT');
    const charge = 0; // Calculate based on rules
    const totalAmount = parseFloat(amount) + charge;

    const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);
    if (wallet.length === 0 || parseFloat(wallet[0].balance) < totalAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const balanceBefore = parseFloat(wallet[0].balance);
    const balanceAfter = balanceBefore - totalAmount;
    await db.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, req.user.id]);
    await db.query(
      'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, reference_id) VALUES (?, "debit", ?, ?, ?, ?, "dmt", ?)',
      [req.user.id, totalAmount, balanceBefore, balanceAfter, `DMT Transfer to ${beneficiary_name}`, transactionId]
    );

    await db.query(
      `INSERT INTO dmt_transactions (transaction_id, user_id, sender_name, sender_mobile, sender_aadhaar, beneficiary_name, beneficiary_account, beneficiary_ifsc, beneficiary_bank, amount, charge, total_amount, transfer_mode, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing')`,
      [transactionId, req.user.id, sender_name || '', sender_mobile, sender_aadhaar || '', beneficiary_name, beneficiary_account, beneficiary_ifsc, beneficiary_bank || '', amount, charge, totalAmount, transfer_mode || 'imps']
    );

    // TODO: Call DMT API
    setTimeout(async () => {
      await db.query('UPDATE dmt_transactions SET status = "success", utr_number = ? WHERE transaction_id = ?', ['UTR' + Date.now(), transactionId]);
      await sendNotification(req.user.id, 'DMT Successful', `₹${amount} transferred to ${beneficiary_name} successfully.`, 'success');
    }, 3000);

    res.json({ success: true, message: 'Money transfer processing', data: { transaction_id: transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add Beneficiary
router.post('/beneficiary', async (req, res) => {
  try {
    const { sender_mobile, beneficiary_name, beneficiary_account, beneficiary_ifsc, beneficiary_bank } = req.body;
    if (!sender_mobile || !beneficiary_name || !beneficiary_account || !beneficiary_ifsc) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const [result] = await db.query(
      'INSERT INTO dmt_beneficiaries (user_id, sender_mobile, beneficiary_name, beneficiary_account, beneficiary_ifsc, beneficiary_bank) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, sender_mobile, beneficiary_name, beneficiary_account, beneficiary_ifsc, beneficiary_bank || '']
    );

    res.json({ success: true, message: 'Beneficiary added', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Beneficiaries
router.get('/beneficiaries', async (req, res) => {
  try {
    const { sender_mobile } = req.query;
    let where = 'user_id = ?';
    const params = [req.user.id];
    if (sender_mobile) { where += ' AND sender_mobile = ?'; params.push(sender_mobile); }

    const [beneficiaries] = await db.query(`SELECT * FROM dmt_beneficiaries WHERE ${where} ORDER BY created_at DESC`, params);
    res.json({ success: true, data: beneficiaries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete Beneficiary
router.delete('/beneficiary/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM dmt_beneficiaries WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Beneficiary deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get DMT transactions
router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);

    const [txns] = await db.query(
      'SELECT * FROM dmt_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, Math.min(100, parseInt(limit)), offset]
    );
    const [count] = await db.query('SELECT COUNT(*) as total FROM dmt_transactions WHERE user_id = ?', [req.user.id]);

    res.json({ success: true, data: { transactions: txns, pagination: { total: count[0].total, page: parseInt(page), limit: parseInt(limit) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
