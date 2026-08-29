const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { generateUserId } = require('../utils/helpers');

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/Mobile and password required' });
    }

    const [users] = await db.query(
      'SELECT * FROM users WHERE (email = ? OR mobile = ? OR user_id = ?) AND is_active = 1',
      [identifier, identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ success: false, message: 'Account locked. Try again later.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const attempts = user.login_attempts + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;
      await db.query('UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lockUntil, user.id]);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await db.query('UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [user.id]);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          company_name: user.company_name,
          profile_image: user.profile_image,
          parent_id: user.parent_id
        },
        wallet: {
          balance: wallet.length > 0 ? wallet[0].balance : 0
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token' });
    }
    const jwt = require('jsonwebtoken');
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await db.query('SELECT id, user_id, name, email, mobile, role, company_name, profile_image, parent_id, is_active FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) return res.status(401).json({ success: false, message: 'User not found' });
    const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [decoded.userId]);
    res.json({
      success: true,
      data: {
        ...users[0],
        walletBalance: wallet.length > 0 ? wallet[0].balance : 0
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// Register new user (retailer can self-register, others need admin approval)
router.post('/register', async (req, res) => {
  try {
    const { name, email, mobile, password, company_name, role, referred_by } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({ success: false, message: 'Name, mobile and password are required' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE mobile = ?', [mobile]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Mobile number already registered' });
    }

    if (email) {
      const [emailExists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (emailExists.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'retailer';
    const userId = generateUserId(userRole);
    const isVerified = userRole === 'retailer' ? 1 : 0;

    let parentId = null;
    if (referred_by) {
      const [referrer] = await db.query('SELECT id FROM users WHERE user_id = ?', [referred_by]);
      if (referrer.length > 0) parentId = referrer[0].id;
    }

    const [result] = await db.query(
      `INSERT INTO users (user_id, name, email, mobile, password, role, parent_id, company_name, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, email || null, mobile, hashedPassword, userRole, parentId, company_name || '', isVerified]
    );

    await db.query('INSERT INTO wallets (user_id, balance) VALUES (?, 0.00)', [result.insertId]);

    res.status(201).json({
      success: true,
      message: userRole === 'retailer' ? 'Registration successful. You can login now.' : 'Registration submitted. Waiting for admin approval.',
      data: { user_id: userId }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get profile
router.get('/profile', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, user_id, name, email, mobile, role, company_name, gst_number, pan_number, address, city, state, pincode, profile_image, parent_id, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    const [wallet] = await db.query('SELECT * FROM wallets WHERE user_id = ?', [req.user.id]);

    res.json({
      success: true,
      data: {
        user: users[0],
        wallet: wallet[0] || { balance: 0, total_recharged: 0, total_commission_earned: 0, total_withdrawn: 0 }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Change password
router.post('/change-password', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);

    const isMatch = await bcrypt.compare(current_password, users[0].password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update profile
router.put('/profile', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const { name, email, company_name, gst_number, pan_number, address, city, state, pincode } = req.body;
    await db.query(
      `UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), company_name = COALESCE(?, company_name),
       gst_number = COALESCE(?, gst_number), pan_number = COALESCE(?, pan_number), address = COALESCE(?, address),
       city = COALESCE(?, city), state = COALESCE(?, state), pincode = COALESCE(?, pincode) WHERE id = ?`,
      [name, email, company_name, gst_number, pan_number, address, city, state, pincode, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { mobile } = req.body;
    const [users] = await db.query('SELECT id FROM users WHERE mobile = ?', [mobile]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // In production, send OTP via SMS
    res.json({ success: true, message: 'Password reset OTP sent to your mobile', reset_token: 'temp_reset_' + users[0].id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;
    if (!reset_token || !new_password) {
      return res.status(400).json({ success: false, message: 'Token and new password required' });
    }
    const userId = reset_token.replace('temp_reset_', '');
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
