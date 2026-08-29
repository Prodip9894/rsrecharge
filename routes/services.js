const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateTransactionId } = require('../utils/helpers');
const { sendNotification, broadcastToRole } = require('../utils/socket');

// Get operators by service type
router.get('/operators/:serviceType', async (req, res) => {
  try {
    const [operators] = await db.query(
      'SELECT id, service_type, operator_name, operator_code, logo, commission_retailer, commission_distributor, commission_md FROM service_operators WHERE service_type = ? AND is_active = 1 ORDER BY sort_order',
      [req.params.serviceType]
    );
    res.json({ success: true, data: operators });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all active services
router.get('/list', async (req, res) => {
  try {
    const [services] = await db.query('SELECT DISTINCT service_type FROM service_operators WHERE is_active = 1');
    const serviceList = services.map(s => s.service_type);
    res.json({ success: true, data: serviceList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mobile Recharge
router.post('/mobile-recharge', async (req, res) => {
  try {
    const { operator, operator_code, customer_number, amount } = req.body;
    if (!operator || !customer_number || !amount) {
      return res.status(400).json({ success: false, message: 'Operator, mobile number and amount are required' });
    }

    const transactionId = generateTransactionId('MRE');
    const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);

    if (wallet.length === 0 || parseFloat(wallet[0].balance) < parseFloat(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Get commission
    const [opData] = await db.query('SELECT * FROM service_operators WHERE operator_code = ? AND service_type = "mobile_recharge"', [operator_code]);
    let commissionRate = 0;
    if (opData.length > 0) {
      if (req.user.role === 'retailer') commissionRate = opData[0].commission_retailer;
      else if (req.user.role === 'distributor') commissionRate = opData[0].commission_distributor;
      else if (req.user.role === 'master_distributor') commissionRate = opData[0].commission_md;
    }
    const commissionAmount = (parseFloat(amount) * commissionRate / 100);

    // Deduct from wallet
    const balanceBefore = parseFloat(wallet[0].balance);
    const balanceAfter = balanceBefore - parseFloat(amount);
    await db.query('UPDATE wallets SET balance = ?, total_recharged = total_recharged + ? WHERE user_id = ?', [balanceAfter, amount, req.user.id]);
    await db.query(
      'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, reference_id) VALUES (?, "debit", ?, ?, ?, ?, "recharge", ?)',
      [req.user.id, amount, balanceBefore, balanceAfter, `Mobile Recharge - ${customer_number}`, transactionId]
    );

    // Create transaction
    await db.query(
      `INSERT INTO transactions (transaction_id, user_id, service_type, operator, operator_code, customer_number, amount, commission_rate, commission_amount, total_amount, status, ip_address)
       VALUES (?, ?, "mobile_recharge", ?, ?, ?, ?, ?, ?, ?, "processing", ?)`,
      [transactionId, req.user.id, operator, operator_code || '', customer_number, amount, commissionRate, commissionAmount, amount, req.ip]
    );

    // TODO: Call external API for actual recharge
    // For now, simulate success after 2 seconds
    setTimeout(async () => {
      await db.query('UPDATE transactions SET status = "success" WHERE transaction_id = ?', [transactionId]);
      if (commissionAmount > 0) {
        await db.query('UPDATE wallets SET total_commission_earned = total_commission_earned + ? WHERE user_id = ?', [commissionAmount, req.user.id]);
        await db.query(
          'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, reference_id) VALUES (?, "credit", ?, ?, ?, "Commission - Mobile Recharge", "commission", ?)',
          [req.user.id, commissionAmount, balanceAfter, balanceAfter + commissionAmount, transactionId]
        );
        await db.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [commissionAmount, req.user.id]);
      }
      await sendNotification(req.user.id, 'Recharge Successful', `Mobile recharge of ₹${amount} to ${customer_number} is successful.`, 'success', '/transactions');
    }, 2000);

    res.json({
      success: true,
      message: 'Recharge submitted successfully',
      data: { transaction_id: transactionId, status: 'processing' }
    });
  } catch (error) {
    console.error('Mobile recharge error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DTH Recharge
router.post('/dth-recharge', async (req, res) => {
  try {
    const { operator, operator_code, customer_number, amount } = req.body;
    if (!operator || !customer_number || !amount) {
      return res.status(400).json({ success: false, message: 'Operator, customer ID and amount are required' });
    }

    const transactionId = generateTransactionId('DTH');
    const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);

    if (wallet.length === 0 || parseFloat(wallet[0].balance) < parseFloat(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    const balanceBefore = parseFloat(wallet[0].balance);
    const balanceAfter = balanceBefore - parseFloat(amount);
    await db.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, req.user.id]);
    await db.query(
      'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, reference_id) VALUES (?, "debit", ?, ?, ?, ?, "recharge", ?)',
      [req.user.id, amount, balanceBefore, balanceAfter, `DTH Recharge - ${customer_number}`, transactionId]
    );

    await db.query(
      `INSERT INTO transactions (transaction_id, user_id, service_type, operator, operator_code, customer_number, amount, total_amount, status)
       VALUES (?, ?, "dth_recharge", ?, ?, ?, ?, ?, "processing")`,
      [transactionId, req.user.id, operator, operator_code || '', customer_number, amount, amount]
    );

    setTimeout(async () => {
      await db.query('UPDATE transactions SET status = "success" WHERE transaction_id = ?', [transactionId]);
      await sendNotification(req.user.id, 'DTH Recharge Successful', `DTH recharge of ₹${amount} to ${customer_number} is successful.`, 'success');
    }, 2000);

    res.json({ success: true, message: 'DTH recharge submitted', data: { transaction_id: transactionId, status: 'processing' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Generic Bill Payment (BBPS)
router.post('/bill-payment', async (req, res) => {
  try {
    const { service_type, operator, operator_code, customer_number, amount, customer_name } = req.body;
    if (!service_type || !operator || !customer_number || !amount) {
      return res.status(400).json({ success: false, message: 'Service, operator, consumer number and amount are required' });
    }

    const transactionId = generateTransactionId('BIL');
    const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);

    if (wallet.length === 0 || parseFloat(wallet[0].balance) < parseFloat(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    const balanceBefore = parseFloat(wallet[0].balance);
    const balanceAfter = balanceBefore - parseFloat(amount);
    await db.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, req.user.id]);
    await db.query(
      'INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type, reference_id) VALUES (?, "debit", ?, ?, ?, ?, "bill_payment", ?)',
      [req.user.id, amount, balanceBefore, balanceAfter, `${service_type} Payment - ${customer_number}`, transactionId]
    );

    await db.query(
      `INSERT INTO transactions (transaction_id, user_id, service_type, operator, operator_code, customer_number, amount, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, "processing")`,
      [transactionId, req.user.id, service_type, operator, operator_code || '', customer_number, amount, amount]
    );

    setTimeout(async () => {
      await db.query('UPDATE transactions SET status = "success" WHERE transaction_id = ?', [transactionId]);
      await sendNotification(req.user.id, 'Bill Payment Successful', `${service_type} payment of ₹${amount} is successful.`, 'success');
    }, 2000);

    res.json({ success: true, message: 'Bill payment submitted', data: { transaction_id: transactionId, status: 'processing' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
