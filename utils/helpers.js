const { v4: uuidv4 } = require('uuid');

function generateTransactionId(prefix = 'TXN') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

function generateUserId(role) {
  const prefixes = {
    admin: 'ADM',
    master_distributor: 'MD',
    distributor: 'DS',
    retailer: 'RT'
  };
  const prefix = prefixes[role] || 'US';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
}

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (p - 1) * l;
  return { page: p, limit: l, offset };
}

function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"']/g, '').trim();
}

module.exports = { generateTransactionId, generateUserId, formatCurrency, paginate, sanitizeInput };
