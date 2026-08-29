const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const serviceRoutes = require('./routes/services');
const walletRoutes = require('./routes/wallet');
const transactionRoutes = require('./routes/transactions');
const aepsRoutes = require('./routes/aeps');
const dmtRoutes = require('./routes/dmt');
const notificationRoutes = require('./routes/notifications');
const { authenticateToken } = require('./middleware/auth');
const { initSocket } = require('./utils/socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// Store io instance globally
app.set('io', io);

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// No-cache for development
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/services', authenticateToken, serviceRoutes);
app.use('/api/wallet', authenticateToken, walletRoutes);
app.use('/api/transactions', authenticateToken, transactionRoutes);
app.use('/api/aeps', authenticateToken, aepsRoutes);
app.use('/api/dmt', authenticateToken, dmtRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Unified dashboard endpoint
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      const [users] = await db.query('SELECT COUNT(*) as count FROM users');
      const [todayTxns] = await db.query("SELECT COUNT(*) as count FROM transactions WHERE DATE(created_at) = CURDATE()");
      const [todayRevenue] = await db.query("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE DATE(created_at) = CURDATE() AND status='completed'");
      const [wallets] = await db.query('SELECT COALESCE(SUM(balance),0) as total FROM wallets');
      const [pending] = await db.query("SELECT COUNT(*) as count FROM users WHERE is_verified=0 AND is_active=1");
      const [recentTxns] = await db.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10');
      res.json({
        success: true,
        data: {
          totalUsers: users[0].count,
          todayTransactions: todayTxns[0].count,
          todayRevenue: todayRevenue[0].total,
          todayCommission: 0,
          totalWalletBalance: wallets[0].total,
          pendingApprovals: pending[0].count,
          recentTransactions: recentTxns
        }
      });
    } else {
      const [todayTxns] = await db.query("SELECT COUNT(*) as count FROM transactions WHERE user_id=? AND DATE(created_at)=CURDATE()", [req.user.userId]);
      const [success] = await db.query("SELECT COUNT(*) as count FROM transactions WHERE user_id=? AND status='completed' AND DATE(created_at)=CURDATE()", [req.user.userId]);
      const [pending] = await db.query("SELECT COUNT(*) as count FROM transactions WHERE user_id=? AND status='pending' AND DATE(created_at)=CURDATE()", [req.user.userId]);
      const [wallet] = await db.query('SELECT balance FROM wallets WHERE user_id=?', [req.user.userId]);
      const [recentTxns] = await db.query('SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 10', [req.user.userId]);
      res.json({
        success: true,
        data: {
          todayRecharges: todayTxns[0].count,
          todaySuccess: success[0].count,
          todayPending: pending[0].count,
          walletBalance: wallet.length > 0 ? wallet[0].balance : 0,
          recentTransactions: recentTxns
        }
      });
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Initialize Socket
initSocket(io);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 RSRecharge Platform running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});

module.exports = { app, server, io };
