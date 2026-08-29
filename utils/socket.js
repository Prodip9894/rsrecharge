const jwt = require('jsonwebtoken');
const db = require('../config/database');

let ioInstance = null;

function initSocket(io) {
  ioInstance = io;
  
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // Join user-specific room
    socket.join(`user_${socket.userId}`);
    
    socket.on('join-role', (role) => {
      socket.join(`role_${role}`);
    });
    
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
}

function getIO() {
  return ioInstance;
}

async function sendNotification(userId, title, message, type = 'info', link = '') {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, link]
    );
    
    if (ioInstance) {
      ioInstance.to(`user_${userId}`).emit('notification', {
        title, message, type, link,
        created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Notification error:', error.message);
  }
}

async function broadcastToRole(role, event, data) {
  if (ioInstance) {
    ioInstance.to(`role_${role}`).emit(event, data);
  }
}

async function broadcastToAll(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

module.exports = { initSocket, getIO, sendNotification, broadcastToRole, broadcastToAll };
