const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateTransactionId } = require('../utils/helpers');
const { sendNotification } = require('../utils/socket');

// AEPS Deposit
router.post('/deposit', async (req, res) => {
  try {
    const { aadhaar_number, customer_name, mobile, amount, bank_code, bank_name } = req.body;
    if (!aadhaar_number || !amount) {
      return res.status(400).json({ success: false, message: 'Aadhaar number and amount are required' });
    }
    if (aadhaar_number.length !== 12) {
      return res.status(400).json({ success: false, message: 'Invalid Aadhaar number' });
    }

    const transactionId = generateTransactionId('AEP');
    await db.query(
      `INSERT INTO aeps_transactions (transaction_id, user_id, aadhaar_number, customer_name, mobile, transaction_type, amount, bank_code, bank_name, status)
       VALUES (?, ?, ?, ?, ?, 'deposit', ?, ?, ?, 'processing')`,
      [transactionId, req.user.id, aadhaar_number, customer_name || '', mobile || '', amount, bank_code || '', bank_name || '']
    );

    // TODO: Call AEPS API
    setTimeout(async () => {
      await db.query('UPDATE aeps_transactions SET status = "success" WHERE transaction_id = ?', [transactionId]);
      await db.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, req.user.id]);
      await db.query(
        'INSERT INTO wallet_transactions (user_id, type, amount, description, reference_type, reference_id) VALUES (?, "credit", ?, ?, "aeps_deposit", ?)',
        [req.user.id, amount, `AEPS Deposit - Aadhaar: ${aadhaar_number.slice(-4)}`, transactionId]
      );
      await sendNotification(req.user.id, 'AEPS Deposit Successful', `₹${amount} deposited via AEPS.`, 'success');
    }, 3000);

    res.json({ success: true, message: 'AEPS deposit processing', data: { transaction_id: transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// AEPS Withdraw
router.post('/withdraw', async (req, res) => {
  try {
    const { aadhaar_number, customer_name, mobile, amount, bank_code, bank_name } = req.body;
    if (!aadhaar_number || !amount) {
      return res.status(400).json({ success: false, message: 'Aadhaar number and amount are required' });
    }

    const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);
    if (wallet.length === 0 || parseFloat(wallet[0].balance) < parseFloat(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const transactionId = generateTransactionId('AEP');
    const balanceBefore = parseFloat(wallet[0].balance);
    const balanceAfter = balanceBefore - parseFloat(amount);

    await db.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, req.user.id]);
    await db.query(
      'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, reference_id) VALUES (?, "debit", ?, ?, ?, ?, "aeps_withdraw", ?)',
      [req.user.id, amount, balanceBefore, balanceAfter, `AEPS Withdraw - Aadhaar: ${aadhaar_number.slice(-4)}`, transactionId]
    );
    await db.query(
      `INSERT INTO aeps_transactions (transaction_id, user_id, aadhaar_number, customer_name, mobile, transaction_type, amount, bank_code, bank_name, status)
       VALUES (?, ?, ?, ?, ?, 'withdraw', ?, ?, ?, 'processing')`,
      [transactionId, req.user.id, aadhaar_number, customer_name || '', mobile || '', amount, bank_code || '', bank_name || '']
    );

    setTimeout(async () => {
      await db.query('UPDATE aeps_transactions SET status = "success" WHERE transaction_id = ?', [transactionId]);
      await sendNotification(req.user.id, 'AEPS Withdraw Successful', `₹${amount} withdrawn via AEPS.`, 'success');
    }, 3000);

    res.json({ success: true, message: 'AEPS withdraw processing', data: { transaction_id: transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// AEPS Mini Statement
router.post('/mini-statement', async (req, res) => {
  try {
    const { aadhaar_number, bank_code } = req.body;
    if (!aadhaar_number) return res.status(400).json({ success: false, message: 'Aadhaar number is required' });

    const transactionId = generateTransactionId('AEP');
    await db.query(
      `INSERT INTO aeps_transactions (transaction_id, user_id, aadhaar_number, transaction_type, bank_code, status)
       VALUES (?, ?, ?, 'mini_statement', ?, 'processing')`,
      [transactionId, req.user.id, aadhaar_number, bank_code || '']
    );

    // TODO: Call AEPS API for mini statement
    setTimeout(async () => {
      await db.query('UPDATE aeps_transactions SET status = "success", api_response = ? WHERE transaction_id = ?',
        [JSON.stringify({ statement: [] }), transactionId]);
    }, 2000);

    res.json({ success: true, message: 'Mini statement request processing', data: { transaction_id: transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// AEPS Balance Enquiry
router.post('/balance-enquiry', async (req, res) => {
  try {
    const { aadhaar_number, bank_code } = req.body;
    if (!aadhaar_number) return res.status(400).json({ success: false, message: 'Aadhaar number is required' });

    const transactionId = generateTransactionId('AEP');
    await db.query(
      `INSERT INTO aeps_transactions (transaction_id, user_id, aadhaar_number, transaction_type, bank_code, status)
       VALUES (?, ?, ?, 'balance_enquiry', ?, 'processing')`,
      [transactionId, req.user.id, aadhaar_number, bank_code || '']
    );

    setTimeout(async () => {
      await db.query('UPDATE aeps_transactions SET status = "success" WHERE transaction_id = ?', [transactionId]);
    }, 2000);

    res.json({ success: true, message: 'Balance enquiry processing', data: { transaction_id: transactionId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get AEPS transactions
router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
    let where = 'user_id = ?';
    const params = [req.user.id];
    if (type) { where += ' AND transaction_type = ?'; params.push(type); }

    const [txns] = await db.query(
      `SELECT * FROM aeps_transactions WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Math.min(100, parseInt(limit)), offset]
    );
    const [count] = await db.query(`SELECT COUNT(*) as total FROM aeps_transactions WHERE ${where}`, params);

    res.json({ success: true, data: { transactions: txns, pagination: { total: count[0].total, page: parseInt(page), limit: parseInt(limit) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
