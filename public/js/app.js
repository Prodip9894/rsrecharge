/* ============================================================
   RS Recharge - Core Frontend Application
   Single Page Application with hash-based routing
   ============================================================ */

(function () {
  'use strict';

  /* ────────────────────────────────────────────
     1. API Client
     ──────────────────────────────────────────── */

  const API_BASE = '/api';
  let token = localStorage.getItem('token');
  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  } catch (_) {
    currentUser = null;
  }

  function setAuth(newToken, user) {
    token = newToken;
    currentUser = user;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(user));
  }

  function clearAuth() {
    token = null;
    currentUser = null;
    localStorage.clear();
  }

  function isLoggedIn() {
    return !!token && !!currentUser;
  }

  async function apiCall(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
      const response = await fetch(API_BASE + endpoint, {
        ...options,
        headers: { ...headers, ...options.headers },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json();

      if (response.status === 401) {
        clearAuth();
        window.location.hash = '#login';
        showToast('Session expired. Please login again.', 'error');
        return null;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Request failed');
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        showToast('Network error. Please check your connection.', 'error');
      }
      throw err;
    }
  }

  /* ────────────────────────────────────────────
     2. Utility Functions
     ──────────────────────────────────────────── */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function formatINR(amount) {
    if (amount == null || isNaN(amount)) return '\u20B90.00';
    return '\u20B9' + Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  function showLoading() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div>';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }

  function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function showToast(message, type) {
    type = type || 'info';
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    var icons = { success: '\u2713', error: '\u2715', warning: '\u26A0', info: '\u2139' };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span class="toast-icon">' + (icons[type] || '') + '</span><span class="toast-msg">' + escapeHtml(message) + '</span><button class="toast-close" onclick="this.parentElement.remove()">\u00D7</button>';
    container.appendChild(toast);
    setTimeout(function () { toast.classList.add('toast-show'); }, 10);
    setTimeout(function () {
      toast.classList.remove('toast-show');
      setTimeout(function () { if (toast.parentElement) toast.remove(); }, 300);
    }, 4000);
  }

  function showModal(title, content, opts) {
    opts = opts || {};
    var existing = document.getElementById('app-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'app-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:' + (opts.width || '500px') + '"><div class="modal-header"><h3>' + escapeHtml(title) + '</h3><button class="modal-close-btn" id="modal-close-x">\u00D7</button></div><div class="modal-body">' + content + '</div>' + (opts.footer ? '<div class="modal-footer">' + opts.footer + '</div>' : '') + '</div>';
    document.body.appendChild(modal);
    setTimeout(function () { modal.classList.add('modal-visible'); }, 10);
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.id === 'modal-close-x') closeModal();
    });
  }

  function closeModal() {
    var modal = document.getElementById('app-modal');
    if (modal) { modal.classList.remove('modal-visible'); setTimeout(function () { modal.remove(); }, 200); }
  }

  function confirmDialog(msg, onConfirm) {
    showModal('Confirm', '<p>' + escapeHtml(msg) + '</p>', { footer: '<button class="btn btn-secondary" onclick="window.__modalConfirm(false)">Cancel</button> <button class="btn btn-primary" onclick="window.__modalConfirm(true)">Confirm</button>' });
    window.__modalConfirm = function (val) { closeModal(); if (val && onConfirm) onConfirm(); delete window.__modalConfirm; };
  }

  function renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) return '';
    var html = '<div class="pagination">';
    html += '<button class="page-btn" data-page="' + (currentPage - 1) + '" ' + (currentPage <= 1 ? 'disabled' : '') + '>&laquo;</button>';
    var start = Math.max(1, currentPage - 2);
    var end = Math.min(totalPages, currentPage + 2);
    if (start > 1) { html += '<button class="page-btn" data-page="1">1</button>'; if (start > 2) html += '<span class="page-ellipsis">\u2026</span>'; }
    for (var i = start; i <= end; i++) { html += '<button class="page-btn ' + (i === currentPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>'; }
    if (end < totalPages) { if (end < totalPages - 1) html += '<span class="page-ellipsis">\u2026</span>'; html += '<button class="page-btn" data-page="' + totalPages + '">' + totalPages + '</button>'; }
    html += '<button class="page-btn" data-page="' + (currentPage + 1) + '" ' + (currentPage >= totalPages ? 'disabled' : '') + '>&raquo;</button>';
    html += '</div>';
    return html;
  }

  function filterRows(rows, query, fields) {
    if (!query) return rows;
    var q = query.toLowerCase();
    return rows.filter(function (row) { return fields.some(function (f) { return String(row[f] || '').toLowerCase().includes(q); }); });
  }

  function statusBadge(status) {
    var cls = { success: 'badge-success', completed: 'badge-success', active: 'badge-success', approved: 'badge-success', pending: 'badge-warning', processing: 'badge-warning', failed: 'badge-danger', rejected: 'badge-danger', inactive: 'badge-danger', suspended: 'badge-danger' };
    return '<span class="badge ' + (cls[status] || 'badge-info') + '">' + escapeHtml(capitalize(status)) + '</span>';
  }

  /* ────────────────────────────────────────────
     3. Auth Guard & Router
     ──────────────────────────────────────────── */

  var PUBLIC_ROUTES = ['login', 'register'];

  function authGuard(route) {
    if (PUBLIC_ROUTES.indexOf(route) !== -1) return true;
    if (!isLoggedIn()) { window.location.hash = '#login'; showToast('Please login to continue.', 'warning'); return false; }
    return true;
  }

  var routes = {};
  function registerRoute(name, handler) { routes[name] = handler; }

  function navigate() {
    var hash = window.location.hash.slice(1) || 'login';
    var parts = hash.split('/');
    var route = parts[0];
    var params = parts.slice(1);
    if (!authGuard(route)) return;
    var isPublic = PUBLIC_ROUTES.indexOf(route) !== -1;
    document.body.classList.toggle('auth-page', isPublic);
    var sidebar = document.getElementById('sidebar');
    var topbar = document.getElementById('topbar');
    var pageContent = document.getElementById('pageContent');
    if (sidebar) sidebar.style.display = isPublic ? 'none' : '';
    if (topbar) topbar.style.display = isPublic ? 'none' : '';
    if (pageContent) {
      pageContent.style.padding = isPublic ? '0' : '';
      pageContent.style.margin = isPublic ? '0' : '';
    }
    if (!isPublic) { renderSidebar(); renderTopbar(); }
    var content = document.getElementById('pageContent');
    if (!content) return;
    if (routes[route]) {
      document.body.classList.remove('sidebar-open');
      window.scrollTo(0, 0);
      routes[route](content, params);
    } else {
      content.innerHTML = '<div class="page-404"><h2>404 - Page Not Found</h2><p>The page you are looking for does not exist.</p><a href="#dashboard">Go to Dashboard</a></div>';
    }
  }

  window.addEventListener('hashchange', navigate);

  /* ────────────────────────────────────────────
     4. Sidebar & Navigation
     ──────────────────────────────────────────── */

  function getMenuItems() {
    var items = [];
    if (!currentUser) return items;
    var role = currentUser.role;

    items.push({ label: 'Dashboard', hash: '#dashboard', faIcon: 'fa-chart-line' });
    items.push({ label: 'Services', hash: '', faIcon: '', isGroup: true });
    items.push({ label: 'Mobile Recharge', hash: '#mobile-recharge', faIcon: 'fa-mobile-screen-button' });
    items.push({ label: 'DTH Recharge', hash: '#dth-recharge', faIcon: 'fa-tv' });
    items.push({ label: 'Bill Payment', hash: '#bill-payment', faIcon: 'fa-file-invoice-dollar' });
    items.push({ label: 'AEPS', hash: '#aeps', faIcon: 'fa-landmark' });
    items.push({ label: 'DMT', hash: '#dmt', faIcon: 'fa-money-bill-transfer' });
    items.push({ label: 'Insurance', hash: '#insurance', faIcon: 'fa-shield-halved' });
    items.push({ label: 'Bank Account', hash: '#bank-account', faIcon: 'fa-building-columns' });
    items.push({ label: 'Loan Repayment', hash: '#loan-repayment', faIcon: 'fa-file-lines' });
    items.push({ label: 'Credit Card', hash: '#credit-card', faIcon: 'fa-credit-card' });
    items.push({ label: 'UPI / QR', hash: '#upi-qr', faIcon: 'fa-qrcode' });
    items.push({ label: 'Finance', hash: '', faIcon: '', isGroup: true });
    items.push({ label: 'Wallet', hash: '#wallet', faIcon: 'fa-wallet' });
    items.push({ label: 'Add Money (UPI/QR)', hash: '#add-money-qr', faIcon: 'fa-qrcode' });
    items.push({ label: 'Wallet Transfer', hash: '#wallet-transfer', faIcon: 'fa-right-left' });
    items.push({ label: 'Move to Bank', hash: '#move-to-bank', faIcon: 'fa-building-columns' });
    items.push({ label: 'Transactions', hash: '#transactions', faIcon: 'fa-table-list' });

    if (role === 'admin' || role === 'superadmin') {
      items.push({ label: 'Administration', hash: '', faIcon: '', isGroup: true });
      items.push({ label: 'Users', hash: '#users', faIcon: 'fa-users' });
      items.push({ label: 'Send Notification', hash: '#send-notification', faIcon: 'fa-bullhorn' });
      items.push({ label: 'Banners', hash: '#banners', faIcon: 'fa-images' });
      items.push({ label: 'Move to Bank', hash: '#admin-move-to-bank', faIcon: 'fa-building-columns' });
      items.push({ label: 'API Providers', hash: '#api-providers', faIcon: 'fa-link' });
      items.push({ label: 'Operators', hash: '#operators', faIcon: 'fa-tower-broadcast' });
      items.push({ label: 'Commissions', hash: '#commissions', faIcon: 'fa-coins' });
      items.push({ label: 'UPI / Pay Settings', hash: '#upi-pay-settings', faIcon: 'fa-money-check' });
      items.push({ label: 'WhatsApp API', hash: '#whatsapp-settings', faIcon: 'fa-whatsapp' });
      items.push({ label: 'Payout API', hash: '#payout-settings', faIcon: 'fa-money-bill' });
      items.push({ label: 'Settings', hash: '#settings', faIcon: 'fa-gear' });
      items.push({ label: 'Audit Logs', hash: '#audit-logs', faIcon: 'fa-scroll' });
    }

    items.push({ label: 'Notifications', hash: '#notifications', faIcon: 'fa-bell' });
    return items;
  }

  function renderSidebar() {
    var menuItems = getMenuItems();
    var currentHash = window.location.hash || '#dashboard';
    var html = '';
    for (var i = 0; i < menuItems.length; i++) {
      var m = menuItems[i];
      if (m.isGroup) {
        html += '<div class="sidebar-section-title">' + escapeHtml(m.label) + '</div>';
      } else {
        var active = currentHash === m.hash ? ' active' : '';
        html += '<div class="sidebar-nav-item"><a href="' + m.hash + '" class="sidebar-nav-link' + active + '"><i class="fas ' + (m.faIcon || 'fa-circle') + '"></i><span>' + escapeHtml(m.label) + '</span></a></div>';
      }
    }
    var nav = document.getElementById('sidebarNav');
    if (nav) nav.innerHTML = html;
    var user = document.getElementById('sidebarUser');
    if (user) {
      user.innerHTML = '<span class="sidebar-user-avatar">' + escapeHtml((currentUser.name || 'U').charAt(0).toUpperCase()) + '</span><div class="sidebar-user-info"><div class="sidebar-user-name">' + escapeHtml(currentUser.name || '') + '</div><div class="sidebar-user-role">' + escapeHtml(capitalize(currentUser.role || '')) + '</div></div>';
    }
  }

  function renderTopbar() {
    var topbar = document.getElementById('topbar');
    if (!topbar) return;
    var html = '<div class="header-left"><button class="header-icon-btn" id="menu-toggle" title="Menu"><i class="fas fa-bars"></i></button>';
    html += '<div class="header-search"><i class="fas fa-search"></i><input type="text" placeholder="Search..." id="globalSearch"></div></div>';
    html += '<div class="header-right">';
    html += '<button class="header-icon-btn" id="wallet-btn" title="Wallet"><i class="fas fa-wallet"></i><span class="badge-count" id="header-wallet-badge">' + formatINR(currentUser.walletBalance || 0) + '</span></button>';
    html += '<button class="header-icon-btn" id="notif-bell" title="Notifications"><i class="fas fa-bell"></i><span class="badge-count" id="notif-count">0</span></button>';
    html += '<div class="header-divider"></div>';
    html += '<div class="header-user" id="header-user-toggle">';
    html += '<div class="header-user-avatar">' + escapeHtml((currentUser.name || 'U').charAt(0).toUpperCase()) + '</div>';
    html += '<div><div class="header-user-name">' + escapeHtml(currentUser.name || '') + '</div><div class="header-user-role">' + escapeHtml(capitalize(currentUser.role || '')) + '</div></div>';
    html += '<i class="fas fa-chevron-down"></i>';
    html += '<div class="header-dropdown" id="headerDropdown">';
    html += '<a class="header-dropdown-item" href="#profile"><i class="fas fa-user"></i> My Profile</a>';
    html += '<a class="header-dropdown-item" href="#wallet"><i class="fas fa-wallet"></i> Wallet</a>';
    html += '<a class="header-dropdown-item" href="#notifications"><i class="fas fa-bell"></i> Notifications</a>';
    html += '<a class="header-dropdown-item" href="#change-password"><i class="fas fa-key"></i> Change Password</a>';
    html += '<div class="header-dropdown-divider"></div>';
    html += '<a class="header-dropdown-item" href="#" id="logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</a>';
    html += '</div></div></div>';
    topbar.innerHTML = html;
    document.getElementById('menu-toggle').addEventListener('click', function () { document.body.classList.toggle('sidebar-open'); });
    document.getElementById('wallet-btn').addEventListener('click', function () { window.location.hash = '#wallet'; });
    document.getElementById('notif-bell').addEventListener('click', function () { window.location.hash = '#notifications'; });
    document.getElementById('logout-btn').addEventListener('click', function (e) {
      e.preventDefault();
      confirmDialog('Are you sure you want to logout?', function () { clearAuth(); window.location.hash = '#login'; showToast('Logged out successfully.', 'success'); });
    });
    document.getElementById('header-user-toggle').addEventListener('click', function (e) {
      e.stopPropagation();
      document.getElementById('headerDropdown').classList.toggle('show');
    });
    document.addEventListener('click', function () {
      var dd = document.getElementById('headerDropdown');
      if (dd) dd.classList.remove('show');
    });
  }

  function updateWalletDisplay() {
    apiCall('/auth/me').then(function (res) {
      if (res && res.data) {
        currentUser = res.data;
        localStorage.setItem('user', JSON.stringify(currentUser));
        var el = document.getElementById('header-wallet');
        if (el) el.textContent = formatINR(currentUser.walletBalance || 0);
      }
    }).catch(function () {});
  }

  /* ────────────────────────────────────────────
     5. Authentication Pages
     ──────────────────────────────────────────── */

  registerRoute('login', function (container) {
    if (isLoggedIn()) { window.location.hash = '#dashboard'; return; }
    var html = '<div class="login-wrapper"><div class="login-container"><div class="login-card">';
    html += '<div class="login-logo"><h1>\u26A1 RS Recharge</h1></div>';
    html += '<p class="login-subtitle">Sign in to your account</p>';
    html += '<form class="login-form" id="login-form">';
    html += '<div class="form-group"><label class="form-label">Email</label><div class="input-icon-wrapper"><i class="fas fa-envelope"></i><input type="text" id="login-email" class="form-control" placeholder="Email or Mobile" required></div></div>';
    html += '<div class="form-group"><label class="form-label">Password</label><div class="input-icon-wrapper"><i class="fas fa-lock"></i><input type="password" id="login-pass" class="form-control" placeholder="Password" required></div></div>';
    html += '<button type="submit" class="login-btn" id="login-submit">Sign In</button>';
    html += '<p class="login-footer">Don\'t have an account? <a href="#register">Register</a></p>';
    html += '</form></div></div></div>';
    container.innerHTML = html;

    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = document.getElementById('login-submit');
      var identifier = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-pass').value;
      if (!identifier || !password) { showToast('Please fill in all fields.', 'warning'); return; }
      btn.disabled = true; btn.textContent = 'Signing in...'; showLoading();
      try {
        var res = await apiCall('/auth/login', { method: 'POST', body: { identifier: identifier, password: password } });
        if (res) {
          var d = res.data || res;
          setAuth(d.token, d.user);
          showToast('Welcome back, ' + (d.user.name || '') + '!', 'success');
          window.location.hash = '#dashboard';
        }
      } catch (err) { showToast(err.message || 'Login failed.', 'error'); }
      finally { btn.disabled = false; btn.textContent = 'Sign In'; hideLoading(); }
    });
  });

  registerRoute('register', function (container) {
    var html = '<div class="login-wrapper"><div class="login-container"><div class="login-card">';
    html += '<div class="login-logo"><h1>\u26A1 RS Recharge</h1></div>';
    html += '<p class="login-subtitle">Create a new account</p>';
    html += '<form class="login-form" id="register-form">';
    html += '<div class="form-group"><label class="form-label">Full Name</label><div class="input-icon-wrapper"><i class="fas fa-user"></i><input type="text" id="reg-name" class="form-control" placeholder="Full name" required></div></div>';
    html += '<div class="form-group"><label class="form-label">Email</label><div class="input-icon-wrapper"><i class="fas fa-envelope"></i><input type="email" id="reg-email" class="form-control" placeholder="Email" required></div></div>';
    html += '<div class="form-group"><label class="form-label">Phone</label><div class="input-icon-wrapper"><i class="fas fa-phone"></i><input type="tel" id="reg-phone" class="form-control" placeholder="Phone number" required></div></div>';
    html += '<div class="form-group"><label class="form-label">Account Type</label><select id="reg-role" class="form-control"><option value="retailer">Retailer</option><option value="distributor">Distributor</option></select></div>';
    html += '<div class="form-group"><label class="form-label">Password</label><div class="input-icon-wrapper"><i class="fas fa-lock"></i><input type="password" id="reg-pass" class="form-control" placeholder="Password" required minlength="6"></div></div>';
    html += '<div class="form-group"><label class="form-label">Confirm Password</label><div class="input-icon-wrapper"><i class="fas fa-lock"></i><input type="password" id="reg-pass2" class="form-control" placeholder="Confirm password" required></div></div>';
    html += '<button type="submit" class="login-btn" id="reg-submit">Create Account</button>';
    html += '<p class="login-footer">Already have an account? <a href="#login">Sign In</a></p>';
    html += '</form></div></div></div>';
    container.innerHTML = html;

    document.getElementById('register-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var name = document.getElementById('reg-name').value.trim();
      var email = document.getElementById('reg-email').value.trim();
      var phone = document.getElementById('reg-phone').value.trim();
      var role = document.getElementById('reg-role').value;
      var pass = document.getElementById('reg-pass').value;
      var pass2 = document.getElementById('reg-pass2').value;
      var referral = document.getElementById('reg-referral').value.trim();
      if (!name || !email || !phone || !pass) { showToast('Please fill in all required fields.', 'warning'); return; }
      if (pass !== pass2) { showToast('Passwords do not match.', 'warning'); return; }
      if (pass.length < 6) { showToast('Password must be at least 6 characters.', 'warning'); return; }
      var btn = document.getElementById('reg-submit');
      btn.disabled = true; btn.textContent = 'Creating account...'; showLoading();
      try {
        var res = await apiCall('/auth/register', { method: 'POST', body: { name: name, email: email, phone: phone, password: pass, role: role, referralCode: referral } });
        if (res) { showToast('Account created successfully! Please login.', 'success'); window.location.hash = '#login'; }
      } catch (err) { showToast(err.message || 'Registration failed.', 'error'); }
      finally { btn.disabled = false; btn.textContent = 'Create Account'; hideLoading(); }
    });
  });

  /* ────────────────────────────────────────────
     6. Dashboard
     ──────────────────────────────────────────── */

  function statCard(label, value, icon, color) {
    return '<div class="stat-card"><div class="stat-card-icon ' + color + '"><i class="fas ' + icon + '"></i></div><div class="stat-card-info"><h4>' + escapeHtml(label) + '</h4><div class="stat-card-value">' + value + '</div></div></div>';
  }

  function quickAction(label, hash, icon) {
    return '<a href="' + hash + '" class="card" style="text-align:center;padding:20px 12px;text-decoration:none;flex:1;min-width:120px"><div style="font-size:1.5rem;margin-bottom:8px"><i class="fas ' + icon + '"></i></div><div style="font-size:0.85rem;font-weight:500">' + escapeHtml(label) + '</div></a>';
  }

  function renderTransactionsTable(txns) {
    if (!txns || txns.length === 0) return '<div class="empty-state">No transactions found.</div>';
    var html = '<div class="table-responsive"><table class="data-table"><thead><tr><th>ID</th><th>Type</th><th>Number</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>';
    for (var i = 0; i < txns.length; i++) {
      var t = txns[i];
      html += '<tr><td>' + escapeHtml((t._id || t.id || '').slice(-8)) + '</td>';
      html += '<td>' + escapeHtml(capitalize(t.type || t.serviceType || '')) + '</td>';
      html += '<td>' + escapeHtml(t.number || t.mobile || t.accountNumber || '-') + '</td>';
      html += '<td>' + formatINR(t.amount) + '</td>';
      html += '<td>' + statusBadge(t.status || 'pending') + '</td>';
      html += '<td>' + formatDateTime(t.createdAt) + '</td>';
      html += '<td><button class="btn btn-sm btn-outline print-receipt" data-id="' + (t.transactionId || t._id || t.id || '') + '" data-type="' + (t.type || t.serviceType || '') + '" data-number="' + (t.number || t.mobile || t.customerNumber || '') + '" data-amount="' + (t.amount || 0) + '" data-status="' + (t.status || '') + '" data-date="' + (t.createdAt || '') + '" data-op="' + (t.operator || '') + '">Print</button></td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  registerRoute('dashboard', async function (container) {
    container.innerHTML = '<div class="page-loader"><div class="loading-spinner"></div></div>';
    try {
      var res = await apiCall('/dashboard');
      var dash = res ? res.data || {} : {};
      if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
        renderAdminDashboard(container, dash);
      } else {
        renderRetailerDashboard(container, dash);
      }
    } catch (err) {
      container.innerHTML = '<div class="error-state"><h3>Failed to load dashboard</h3><p>' + escapeHtml(err.message) + '</p><button class="btn btn-primary" onclick="location.hash=\'#dashboard\'">Retry</button></div>';
    }
  });

  function renderAdminDashboard(container, d) {
    var html = '<div class="page-header"><div class="page-header-left"><h2>Admin Dashboard</h2></div></div>';
    html += '<div class="stat-cards-grid">';
    html += statCard('Total Users', d.totalUsers || 0, 'fa-users', 'blue');
    html += statCard('Today\'s Txns', d.todayTransactions || 0, 'fa-table-list', 'green');
    html += statCard('Today\'s Revenue', formatINR(d.todayRevenue || 0), 'fa-indian-rupee-sign', 'orange');
    html += statCard('Today\'s Commission', formatINR(d.todayCommission || 0), 'fa-coins', 'teal');
    html += statCard('Total Wallet Balance', formatINR(d.totalWalletBalance || 0), 'fa-wallet', 'purple');
    html += statCard('Pending Approvals', d.pendingApprovals || 0, 'fa-clock', 'red');
    html += '</div>';
    html += '<div class="card" style="margin-bottom:20px"><div class="card-header"><h3>Quick Actions</h3></div><div class="card-body" style="display:flex;flex-wrap:wrap;gap:12px">';
    html += quickAction('Users', '#users', 'fa-users');
    html += quickAction('Notifications', '#send-notification', 'fa-bullhorn');
    html += quickAction('Banners', '#banners', 'fa-images');
    html += quickAction('Operators', '#operators', 'fa-tower-broadcast');
    html += quickAction('Commissions', '#commissions', 'fa-coins');
    html += quickAction('Settings', '#settings', 'fa-gear');
    html += '</div></div>';
    html += '<div class="card"><div class="card-header"><h3>Recent Transactions</h3><a href="#transactions" class="btn btn-sm btn-outline" style="margin-left:auto">View All</a></div><div class="card-body">';
    html += renderTransactionsTable(d.recentTransactions || []);
    html += '</div></div>';
    container.innerHTML = html;
  }

  async function loadTodayCommission() {
    try {
      var res = await apiCall('/admin/today-commission');
      if (res && res.data) {
        var c = res.data;
        var area = document.getElementById('today-commission-area');
        if (area) {
          area.innerHTML = '<div class="stats-grid"><div class="stat-card stat-blue"><div class="stat-content"><div class="stat-value">' + formatINR(c.retailer) + '</div><div class="stat-label">Retailer Commission</div></div></div><div class="stat-card stat-green"><div class="stat-content"><div class="stat-value">' + formatINR(c.distributor) + '</div><div class="stat-label">Distributor Commission</div></div></div><div class="stat-card stat-orange"><div class="stat-content"><div class="stat-value">' + formatINR(c.master_distributor) + '</div><div class="stat-label">MD Commission</div></div></div><div class="stat-card stat-purple"><div class="stat-content"><div class="stat-value">' + formatINR(c.total) + '</div><div class="stat-label">Total Commission</div></div></div></div>';
        }
      }
    } catch (_) {}
  }

  function renderRetailerDashboard(container, d) {
    var html = '<div class="page-header"><div class="page-header-left"><h2>Welcome, ' + escapeHtml(currentUser.name || '') + '</h2></div></div>';
    html += '<div class="stat-cards-grid">';
    html += statCard('Wallet Balance', formatINR(currentUser.walletBalance || 0), 'fa-wallet', 'blue');
    html += statCard('Today\'s Recharges', d.todayRecharges || 0, 'fa-mobile-screen-button', 'green');
    html += statCard('Today\'s Success', d.todaySuccess || 0, 'fa-circle-check', 'teal');
    html += statCard('Pending', d.todayPending || 0, 'fa-clock', 'orange');
    html += '</div>';
    html += '<div class="card" style="margin-bottom:20px"><div class="card-header"><h3>Quick Actions</h3></div><div class="card-body" style="display:flex;flex-wrap:wrap;gap:12px">';
    html += quickAction('Mobile Recharge', '#mobile-recharge', 'fa-mobile-screen-button');
    html += quickAction('DTH Recharge', '#dth-recharge', 'fa-tv');
    html += quickAction('Bill Payment', '#bill-payment', 'fa-file-invoice-dollar');
    html += quickAction('AEPS', '#aeps', 'fa-landmark');
    html += quickAction('DMT', '#dmt', 'fa-money-bill-transfer');
    html += quickAction('Wallet Transfer', '#wallet-transfer', 'fa-right-left');
    html += '</div></div>';
    html += '<div class="card"><div class="card-header"><h3>Recent Transactions</h3><a href="#transactions" class="btn btn-sm btn-outline" style="margin-left:auto">View All</a></div><div class="card-body">';
    html += renderTransactionsTable(d.recentTransactions || []);
    html += '</div></div>';
    container.innerHTML = html;
  }

  /* ────────────────────────────────────────────
     7. Mobile Recharge
     ──────────────────────────────────────────── */

  var OPERATORS = [
    { id: 'jio', name: 'Jio' }, { id: 'airtel', name: 'Airtel' },
    { id: 'vi', name: 'Vi (Vodafone Idea)' }, { id: 'bsnl', name: 'BSNL' },
    { id: 'mtnl', name: 'MTNL' },
  ];

  var DTH_OPERATORS = [
    { id: 'tata_sky', name: 'Tata Play' }, { id: 'airtel_dth', name: 'Airtel Digital TV' },
    { id: 'dish_tv', name: 'Dish TV' }, { id: 'd2h', name: 'd2h' },
    { id: 'sun_direct', name: 'Sun Direct' },
  ];

  var BILL_TYPES = [
    { id: 'electricity', name: 'Electricity', icon: '\uD83D\uDCA1' },
    { id: 'gas', name: 'Gas', icon: '\uD83D\uDD25' },
    { id: 'water', name: 'Water', icon: '\uD83D\uDCA7' },
    { id: 'broadband', name: 'Broadband', icon: '\uD83C\uDF10' },
    { id: 'landline', name: 'Landline', icon: '\uD83D\uDCDE' },
    { id: 'insurance', name: 'Insurance Premium', icon: '\uD83D\uDEE1\uFE0F' },
    { id: 'cable_tv', name: 'Cable TV', icon: '\uD83D\uDCFA' },
    { id: 'rent', name: 'Rent', icon: '\uD83C\uDFE0' },
  ];

  function renderOperatorOptions(ops) {
    var html = '<option value="">Select Operator</option>';
    for (var i = 0; i < ops.length; i++) { html += '<option value="' + ops[i].id + '">' + escapeHtml(ops[i].name) + '</option>'; }
    return html;
  }

  registerRoute('mobile-recharge', function (container) {
    var html = '<div class="page-header"><h2>Mobile Recharge</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="recharge-form">';
    html += '<div class="form-row"><div class="form-group"><label for="rc-mobile">Mobile Number</label><input type="tel" id="rc-mobile" class="form-control" placeholder="10-digit mobile number" maxlength="10" required><small id="rc-auto-detect" class="text-muted" style="display:none;">Detected: <strong id="rc-detected-op"></strong></small></div>';
    html += '<div class="form-group"><label for="rc-operator">Operator</label><select id="rc-operator" class="form-control" required>' + renderOperatorOptions(OPERATORS) + '</select></div></div>';
    html += '<div class="form-row"><div class="form-group"><label for="rc-circle">Circle</label><select id="rc-circle" class="form-control"><option value="">Auto Detect</option>';
    var circles = ['Delhi','Mumbai','Karnataka','Tamil Nadu','Maharashtra','Uttar Pradesh','Gujarat','Rajasthan','West Bengal','Andhra Pradesh','Kerala','Madhya Pradesh','Punjab','Haryana','Bihar','Odisha','Assam','Jharkhand'];
    for (var c = 0; c < circles.length; c++) { html += '<option value="' + circles[c].toLowerCase().replace(/ /g,'_') + '">' + circles[c] + '</option>'; }
    html += '</select></div>';
    html += '<div class="form-group"><label for="rc-amount">Amount (\u20B9)</label><input type="number" id="rc-amount" class="form-control" placeholder="Enter amount" min="1" required></div></div>';
    html += '<div class="form-group"><label for="rc-plan">Select Plan</label><select id="rc-plan" class="form-control"><option value="">Choose a plan or enter amount above</option></select></div>';
    html += '<div class="form-row"><div class="form-group"><label>Offer Type</label><select id="rc-offer-type" class="form-control"><option value="regular">Regular Plans</option><option value="r_offer">R-Offer / Special</option><option value="cashback">Cashback Offers</option></select></div>';
    html += '<div class="form-group"><label for="rc-customer">Customer Name (optional)</label><input type="text" id="rc-customer" class="form-control" placeholder="Customer name"></div></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg" id="rc-submit">Recharge Now</button></div>';
    html += '</form></div></div>';
    html += '<div class="card mt-3" id="plans-panel" style="display:none"><div class="card-header"><h3 id="plans-panel-title">Available Plans</h3></div><div class="card-body" id="plans-list"></div></div>';
    container.innerHTML = html;

    loadPlans();
    document.getElementById('rc-operator').addEventListener('change', loadPlans);
    document.getElementById('rc-offer-type').addEventListener('change', loadPlans);

    // Auto operator detection from mobile number
    var mobileInput = document.getElementById('rc-mobile');
    var autoDetectEl = document.getElementById('rc-auto-detect');
    var detectedOpEl = document.getElementById('rc-detected-op');
    
    var operatorPrefixes = {
      '70': 'Jio', '62': 'Jio', '63': 'Jio', '80': 'Jio', '81': 'Jio', '82': 'Jio', '83': 'Jio', '84': 'Jio', '85': 'Jio', '86': 'Jio', '87': 'Jio', '88': 'Jio', '89': 'Jio', '90': 'Jio', '91': 'Jio', '92': 'Jio', '93': 'Jio', '94': 'Jio', '95': 'Jio', '96': 'Jio', '97': 'Jio', '98': 'Jio', '99': 'Jio',
      '73': 'Airtel', '74': 'Airtel', '75': 'Airtel', '76': 'Airtel', '77': 'Airtel', '78': 'Airtel', '79': 'Airtel',
      '65': 'Vi', '66': 'Vi', '67': 'Vi', '68': 'Vi', '69': 'Vi',
      '91': 'Airtel', '92': 'Airtel', '93': 'Airtel', '94': 'Airtel', '95': 'Airtel', '96': 'Airtel',
      '80': 'Vi', '81': 'Vi', '82': 'Vi', '83': 'Vi',
      '70': 'BSNL', '71': 'BSNL', '72': 'BSNL', '73': 'BSNL', '74': 'BSNL'
    };

    mobileInput.addEventListener('input', debounce(function() {
      var val = mobileInput.value.trim();
      if (val.length >= 2) {
        var prefix = val.substring(0, 2);
        var detected = operatorPrefixes[prefix];
        if (detected) {
          var sel = document.getElementById('rc-operator');
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].text.toLowerCase().includes(detected.toLowerCase())) {
              sel.selectedIndex = i;
              break;
            }
          }
          detectedOpEl.textContent = detected;
          autoDetectEl.style.display = 'block';
          loadPlans();
        }
      }
      if (val.length < 2) { autoDetectEl.style.display = 'none'; }
    }, 300));

    document.getElementById('recharge-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var mobile = document.getElementById('rc-mobile').value.trim();
      var operator = document.getElementById('rc-operator').value;
      var amount = document.getElementById('rc-amount').value;
      if (!mobile || mobile.length !== 10) { showToast('Please enter a valid 10-digit mobile number.', 'warning'); return; }
      if (!operator) { showToast('Please select an operator.', 'warning'); return; }
      if (!amount || parseFloat(amount) <= 0) { showToast('Please enter a valid amount.', 'warning'); return; }
      confirmDialog('Recharge ' + formatINR(amount) + ' to ' + mobile + '?', async function () {
        showLoading();
        try {
          var res = await apiCall('/recharge/mobile', { method: 'POST', body: { mobile: mobile, operator: operator, amount: parseFloat(amount), circle: document.getElementById('rc-circle').value, customerName: document.getElementById('rc-customer').value.trim() } });
          if (res) { showToast('Recharge successful! Ref: ' + (res.data.referenceId || ''), 'success'); document.getElementById('recharge-form').reset(); updateWalletDisplay(); }
        } catch (err) { showToast(err.message || 'Recharge failed.', 'error'); }
        finally { hideLoading(); }
      });
    });

    async function loadPlans() {
      var operator = document.getElementById('rc-operator').value;
      if (!operator) return;
      try {
        var res = await apiCall('/plans?operator=' + operator);
        if (res && res.data && res.data.length > 0) {
          var sel = document.getElementById('rc-plan');
          sel.innerHTML = '<option value="">Choose a plan or enter amount above</option>';
          for (var i = 0; i < res.data.length; i++) { var p = res.data[i]; sel.innerHTML += '<option value="' + p.amount + '">' + formatINR(p.amount) + ' - ' + escapeHtml(p.description || p.validity || '') + '</option>'; }
          sel.addEventListener('change', function () { if (this.value) document.getElementById('rc-amount').value = this.value; });
          var panel = document.getElementById('plans-panel');
          panel.style.display = 'block';
          var tableHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Amount</th><th>Validity</th><th>Description</th><th>Action</th></tr></thead><tbody>';
          for (var j = 0; j < res.data.length; j++) {
            var plan = res.data[j];
            tableHtml += '<tr><td>' + formatINR(plan.amount) + '</td><td>' + escapeHtml(plan.validity || '-') + '</td><td>' + escapeHtml(plan.description || '-') + '</td><td><button class="btn btn-sm btn-outline plan-select" data-amount="' + plan.amount + '">Select</button></td></tr>';
          }
          tableHtml += '</tbody></table></div>';
          document.getElementById('plans-list').innerHTML = tableHtml;
          document.getElementById('plans-list').addEventListener('click', function (e) {
            if (e.target.classList.contains('plan-select')) { document.getElementById('rc-amount').value = e.target.dataset.amount; showToast('Plan selected: ' + formatINR(e.target.dataset.amount), 'info'); }
          });
        }
      } catch (_) {}
    }
  });

  /* ────────────────────────────────────────────
     8. DTH Recharge
     ──────────────────────────────────────────── */

  registerRoute('dth-recharge', function (container) {
    var html = '<div class="page-header"><h2>DTH Recharge</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="dth-form">';
    html += '<div class="form-row"><div class="form-group"><label>DTH Operator</label><select id="dth-operator" class="form-control" required>' + renderOperatorOptions(DTH_OPERATORS) + '</select></div>';
    html += '<div class="form-group"><label>Subscriber ID / CA Number</label><input type="text" id="dth-ca" class="form-control" placeholder="Subscriber ID" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="dth-amount" class="form-control" placeholder="Amount" min="1" required></div>';
    html += '<div class="form-group"><label>Customer Name (optional)</label><input type="text" id="dth-customer" class="form-control" placeholder="Customer name"></div></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Recharge DTH</button></div></form></div></div>';
    container.innerHTML = html;

    document.getElementById('dth-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var operator = document.getElementById('dth-operator').value;
      var ca = document.getElementById('dth-ca').value.trim();
      var amount = document.getElementById('dth-amount').value;
      if (!operator || !ca || !amount) { showToast('Please fill in all required fields.', 'warning'); return; }
      confirmDialog('Recharge DTH ' + ca + ' with ' + formatINR(amount) + '?', async function () {
        showLoading();
        try {
          var res = await apiCall('/recharge/dth', { method: 'POST', body: { operator: operator, subscriberId: ca, amount: parseFloat(amount), customerName: document.getElementById('dth-customer').value.trim() } });
          if (res) { showToast('DTH Recharge successful! Ref: ' + (res.data.referenceId || ''), 'success'); document.getElementById('dth-form').reset(); updateWalletDisplay(); }
        } catch (err) { showToast(err.message || 'DTH Recharge failed.', 'error'); }
        finally { hideLoading(); }
      });
    });
  });

  /* ────────────────────────────────────────────
     9. Bill Payment
     ──────────────────────────────────────────── */

  registerRoute('bill-payment', function (container) {
    var html = '<div class="page-header"><h2>Bill Payment</h2></div>';
    html += '<div class="bill-type-grid">';
    for (var i = 0; i < BILL_TYPES.length; i++) {
      var bt = BILL_TYPES[i];
      html += '<div class="bill-type-card" data-type="' + bt.id + '"><span class="bt-icon">' + bt.icon + '</span><span class="bt-name">' + escapeHtml(bt.name) + '</span></div>';
    }
    html += '</div>';
    html += '<div class="card mt-3" id="bill-form-card" style="display:none"><div class="card-header"><h3 id="bill-form-title">Pay Bill</h3></div><div class="card-body">';
    html += '<form id="bill-form"><input type="hidden" id="bill-type">';
    html += '<div class="form-row"><div class="form-group"><label>Provider / Board</label><input type="text" id="bill-provider" class="form-control" placeholder="Provider name" required></div>';
    html += '<div class="form-group"><label>Account / Consumer Number</label><input type="text" id="bill-account" class="form-control" placeholder="Account number" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="bill-amount" class="form-control" placeholder="Amount" min="1" required></div>';
    html += '<div class="form-group"><label>Customer Name (optional)</label><input type="text" id="bill-customer" class="form-control" placeholder="Customer name"></div></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Pay Bill</button></div></form></div></div>';
    container.innerHTML = html;

    var billCards = container.querySelectorAll('.bill-type-card');
    billCards.forEach(function (card) {
      card.addEventListener('click', function () {
        billCards.forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        var type = card.dataset.type;
        var typeName = BILL_TYPES.find(function (b) { return b.id === type; });
        document.getElementById('bill-type').value = type;
        document.getElementById('bill-form-title').textContent = 'Pay ' + (typeName ? typeName.name : 'Bill');
        document.getElementById('bill-form-card').style.display = 'block';
      });
    });

    document.getElementById('bill-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var type = document.getElementById('bill-type').value;
      var provider = document.getElementById('bill-provider').value.trim();
      var account = document.getElementById('bill-account').value.trim();
      var amount = document.getElementById('bill-amount').value;
      if (!type || !provider || !account || !amount) { showToast('Please fill in all required fields.', 'warning'); return; }
      confirmDialog('Pay ' + formatINR(amount) + ' bill to ' + provider + '?', async function () {
        showLoading();
        try {
          var res = await apiCall('/bill-payment', { method: 'POST', body: { billType: type, provider: provider, accountNumber: account, amount: parseFloat(amount), customerName: document.getElementById('bill-customer').value.trim() } });
          if (res) { showToast('Bill payment successful! Ref: ' + (res.data.referenceId || ''), 'success'); document.getElementById('bill-form').reset(); document.getElementById('bill-form-card').style.display = 'none'; updateWalletDisplay(); }
        } catch (err) { showToast(err.message || 'Bill payment failed.', 'error'); }
        finally { hideLoading(); }
      });
    });
  });

  /* ────────────────────────────────────────────
     10. Tabs Helper
     ──────────────────────────────────────────── */

  function initTabs(container) {
    var tabs = container.querySelectorAll('.tab-btn');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        container.querySelectorAll('.tab-content').forEach(function (tc) { tc.classList.remove('active'); });
        var target = container.querySelector('#' + tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }

  /* ────────────────────────────────────────────
     11. AEPS
     ──────────────────────────────────────────── */

  function aepsForm(type) {
    var title = { deposit: 'Cash Deposit', withdraw: 'Cash Withdrawal', ministatement: 'Mini Statement', balance: 'Balance Inquiry' }[type];
    var html = '<div class="card mt-3"><div class="card-body"><form class="aeps-form" data-type="' + type + '">';
    html += '<div class="form-row"><div class="form-group"><label>Aadhaar Number</label><input type="text" class="form-control aeps-aadhaar" placeholder="12-digit Aadhaar" maxlength="12" required></div>';
    html += '<div class="form-group"><label>Bank IFSC / Bank Name</label><input type="text" class="form-control aeps-bank" placeholder="IFSC code or bank name" required></div></div>';
    if (type === 'deposit' || type === 'withdraw') { html += '<div class="form-group"><label>Amount (\u20B9)</label><input type="number" class="form-control aeps-amount" placeholder="Amount" min="1" required></div>'; }
    html += '<div class="form-group"><label>Mobile Number</label><input type="tel" class="form-control aeps-mobile" placeholder="10-digit mobile" maxlength="10" required></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">' + escapeHtml(title) + '</button></div></form>';
    html += '<div class="aeps-result" style="display:none;margin-top:16px;"></div></div></div>';
    return html;
  }

  function bindAepsForms(container) {
    var forms = container.querySelectorAll('.aeps-form');
    forms.forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var type = form.dataset.type;
        var aadhaar = form.querySelector('.aeps-aadhaar').value.trim();
        var bank = form.querySelector('.aeps-bank').value.trim();
        var amountEl = form.querySelector('.aeps-amount');
        var mobile = form.querySelector('.aeps-mobile').value.trim();
        if (!aadhaar || aadhaar.length !== 12) { showToast('Please enter a valid 12-digit Aadhaar number.', 'warning'); return; }
        if (!bank) { showToast('Please enter bank details.', 'warning'); return; }
        if (amountEl && (!amountEl.value || parseFloat(amountEl.value) <= 0)) { showToast('Please enter a valid amount.', 'warning'); return; }
        showLoading();
        try {
          var body = { type: type, aadhaarNumber: aadhaar, bank: bank, mobile: mobile };
          if (amountEl) body.amount = parseFloat(amountEl.value);
          var res = await apiCall('/aeps/transaction', { method: 'POST', body: body });
          if (res) {
            var resultDiv = form.parentElement.querySelector('.aeps-result');
            if (type === 'balance') { resultDiv.innerHTML = '<div class="alert alert-success">Balance: ' + formatINR(res.data.balance) + '</div>'; }
            else if (type === 'ministatement') { resultDiv.innerHTML = '<div class="alert alert-success">Mini Statement:</div>' + renderTransactionsTable(res.data.statement || []); }
            else { resultDiv.innerHTML = '<div class="alert alert-success">Transaction successful! Ref: ' + (res.data.referenceId || '') + '</div>'; updateWalletDisplay(); }
            resultDiv.style.display = 'block';
            form.reset();
          }
        } catch (err) { showToast(err.message || 'AEPS transaction failed.', 'error'); }
        finally { hideLoading(); }
      });
    });
  }

  registerRoute('aeps', function (container) {
    var html = '<div class="page-header"><h2>AEPS - Aadhaar Enabled Payment System</h2></div>';
    html += '<div class="tabs">';
    html += '<button class="tab-btn active" data-tab="aeps-deposit">\uD83D\uDCB3 Cash Deposit</button>';
    html += '<button class="tab-btn" data-tab="aeps-withdraw">\uD83D\uDCB5 Cash Withdraw</button>';
    html += '<button class="tab-btn" data-tab="aeps-ministatement">\uD83D\uDCCB Mini Statement</button>';
    html += '<button class="tab-btn" data-tab="aeps-balance">\uD83C\uDFE7 Balance Inquiry</button>';
    html += '</div>';
    html += '<div class="tab-content active" id="aeps-deposit">' + aepsForm('deposit') + '</div>';
    html += '<div class="tab-content" id="aeps-withdraw">' + aepsForm('withdraw') + '</div>';
    html += '<div class="tab-content" id="aeps-ministatement">' + aepsForm('ministatement') + '</div>';
    html += '<div class="tab-content" id="aeps-balance">' + aepsForm('balance') + '</div>';
    container.innerHTML = html;
    initTabs(container);
    bindAepsForms(container);
  });

  /* ────────────────────────────────────────────
     12. DMT - Domestic Money Transfer
     ──────────────────────────────────────────── */

  registerRoute('dmt', function (container) {
    var html = '<div class="page-header"><h2>Domestic Money Transfer (DMT)</h2></div>';
    html += '<div class="tabs">';
    html += '<button class="tab-btn active" data-tab="dmt-send">\uD83D\uDCB8 Send Money</button>';
    html += '<button class="tab-btn" data-tab="dmt-beneficiaries">\uD83D\uDC65 Beneficiaries</button>';
    html += '</div>';

    html += '<div class="tab-content active" id="dmt-send"><div class="card mt-3"><div class="card-body">';
    html += '<form id="dmt-form">';
    html += '<div class="form-row"><div class="form-group"><label>Sender Mobile</label><input type="tel" id="dmt-sender-mobile" class="form-control" placeholder="Sender mobile" maxlength="10" required></div>';
    html += '<div class="form-group"><label>Sender Name</label><input type="text" id="dmt-sender-name" class="form-control" placeholder="Sender name" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Beneficiary</label><select id="dmt-beneficiary" class="form-control"><option value="">Select beneficiary</option></select></div>';
    html += '<div class="form-group"><label>Or Enter New Account</label><input type="text" id="dmt-new-acct" class="form-control" placeholder="Account number"></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>IFSC Code</label><input type="text" id="dmt-ifsc" class="form-control" placeholder="IFSC code"></div>';
    html += '<div class="form-group"><label>Beneficiary Name</label><input type="text" id="dmt-bene-name" class="form-control" placeholder="Beneficiary name"></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="dmt-amount" class="form-control" placeholder="Amount" min="1" required></div>';
    html += '<div class="form-group"><label>Transfer Mode</label><select id="dmt-mode" class="form-control"><option value="imps">IMPS</option><option value="neft">NEFT</option><option value="rtgs">RTGS</option></select></div></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Send Money</button></div></form></div></div></div>';

    html += '<div class="tab-content" id="dmt-beneficiaries"><div class="card mt-3"><div class="card-body">';
    html += '<div class="card-header"><h3>My Beneficiaries</h3><button class="btn btn-sm btn-primary" id="add-bene-btn">+ Add Beneficiary</button></div>';
    html += '<div id="bene-list"><div class="table-responsive"><table class="data-table">';
    html += '<thead><tr><th>Name</th><th>Account</th><th>IFSC</th><th>Bank</th><th>Status</th><th>Action</th></tr></thead>';
    html += '<tbody id="bene-tbody"></tbody></table></div></div></div></div></div>';
    container.innerHTML = html;
    initTabs(container);
    loadBeneficiaries();

    document.getElementById('dmt-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var senderMobile = document.getElementById('dmt-sender-mobile').value.trim();
      var senderName = document.getElementById('dmt-sender-name').value.trim();
      var beneficiaryId = document.getElementById('dmt-beneficiary').value;
      var amount = document.getElementById('dmt-amount').value;
      var mode = document.getElementById('dmt-mode').value;
      var accountNumber = beneficiaryId ? '' : document.getElementById('dmt-new-acct').value.trim();
      var ifsc = beneficiaryId ? '' : document.getElementById('dmt-ifsc').value.trim();
      var beneName = beneficiaryId ? '' : document.getElementById('dmt-bene-name').value.trim();
      if (!senderMobile || !senderName) { showToast('Please enter sender details.', 'warning'); return; }
      if (!beneficiaryId && !accountNumber) { showToast('Please select or enter beneficiary account.', 'warning'); return; }
      if (!amount || parseFloat(amount) <= 0) { showToast('Please enter a valid amount.', 'warning'); return; }
      confirmDialog('Send ' + formatINR(amount) + ' to beneficiary?', async function () {
        showLoading();
        try {
          var body = { senderMobile: senderMobile, senderName: senderName, amount: parseFloat(amount), mode: mode };
          if (beneficiaryId) { body.beneficiaryId = beneficiaryId; } else { body.accountNumber = accountNumber; body.ifsc = ifsc; body.beneficiaryName = beneName; }
          var res = await apiCall('/dmt/send', { method: 'POST', body: body });
          if (res) { showToast('Money sent successfully! Ref: ' + (res.data.referenceId || ''), 'success'); document.getElementById('dmt-form').reset(); updateWalletDisplay(); }
        } catch (err) { showToast(err.message || 'Transfer failed.', 'error'); }
        finally { hideLoading(); }
      });
    });

    document.getElementById('add-bene-btn').addEventListener('click', function () {
      showModal('Add Beneficiary', '<form id="add-bene-form"><div class="form-group"><label>Account Number</label><input type="text" class="form-control" id="new-bene-acct" required></div><div class="form-group"><label>IFSC Code</label><input type="text" class="form-control" id="new-bene-ifsc" required></div><div class="form-group"><label>Beneficiary Name</label><input type="text" class="form-control" id="new-bene-name" required></div><div class="form-group"><label>Bank Name</label><input type="text" class="form-control" id="new-bene-bank"></div><button type="submit" class="btn btn-primary">Add Beneficiary</button></form>', { width: '450px' });
      setTimeout(function () {
        var f = document.getElementById('add-bene-form');
        if (f) { f.addEventListener('submit', async function (ev) {
          ev.preventDefault(); showLoading();
          try { await apiCall('/dmt/beneficiaries', { method: 'POST', body: { accountNumber: document.getElementById('new-bene-acct').value.trim(), ifsc: document.getElementById('new-bene-ifsc').value.trim(), name: document.getElementById('new-bene-name').value.trim(), bankName: document.getElementById('new-bene-bank').value.trim() } }); showToast('Beneficiary added.', 'success'); closeModal(); loadBeneficiaries(); }
          catch (err) { showToast(err.message || 'Failed to add beneficiary.', 'error'); }
          finally { hideLoading(); }
        }); }
      }, 100);
    });

    async function loadBeneficiaries() {
      try {
        var res = await apiCall('/dmt/beneficiaries');
        var list = (res && res.data) || [];
        var tbody = document.getElementById('bene-tbody');
        if (!tbody) return;
        if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center">No beneficiaries added yet.</td></tr>'; return; }
        var html = '';
        for (var i = 0; i < list.length; i++) {
          var b = list[i];
          html += '<tr><td>' + escapeHtml(b.name) + '</td><td>' + escapeHtml(b.accountNumber) + '</td><td>' + escapeHtml(b.ifsc) + '</td><td>' + escapeHtml(b.bankName || '-') + '</td><td>' + statusBadge(b.status || 'active') + '</td><td><button class="btn btn-sm btn-danger delete-bene" data-id="' + b._id + '">Delete</button></td></tr>';
        }
        tbody.innerHTML = html;
        tbody.querySelectorAll('.delete-bene').forEach(function (btn) {
          btn.addEventListener('click', function () {
            confirmDialog('Delete this beneficiary?', async function () {
              showLoading(); try { await apiCall('/dmt/beneficiaries/' + btn.dataset.id, { method: 'DELETE' }); showToast('Beneficiary deleted.', 'success'); loadBeneficiaries(); }
              catch (err) { showToast(err.message || 'Failed to delete.', 'error'); } finally { hideLoading(); }
            });
          });
        });
        var sel = document.getElementById('dmt-beneficiary');
        if (sel) { sel.innerHTML = '<option value="">Select beneficiary</option>'; for (var j = 0; j < list.length; j++) { if (list[j].status === 'active') { sel.innerHTML += '<option value="' + list[j]._id + '">' + escapeHtml(list[j].name) + ' - ' + escapeHtml(list[j].accountNumber) + '</option>'; } } }
      } catch (_) {}
    }
  });

  /* ────────────────────────────────────────────
     13. Insurance
     ──────────────────────────────────────────── */

  registerRoute('insurance', function (container) {
    var html = '<div class="page-header"><h2>Insurance</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="insurance-form">';
    html += '<div class="form-row"><div class="form-group"><label>Insurance Type</label><select id="ins-type" class="form-control" required><option value="">Select type</option>';
    html += '<option value="health">Health Insurance</option><option value="motor">Motor Insurance</option><option value="life">Life Insurance</option>';
    html += '<option value="travel">Travel Insurance</option><option value="home">Home Insurance</option></select></div>';
    html += '<div class="form-group"><label>Full Name</label><input type="text" id="ins-name" class="form-control" placeholder="Full name" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Date of Birth</label><input type="date" id="ins-dob" class="form-control" required></div>';
    html += '<div class="form-group"><label>Mobile Number</label><input type="tel" id="ins-mobile" class="form-control" placeholder="Mobile" maxlength="10" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Email</label><input type="email" id="ins-email" class="form-control" placeholder="Email" required></div>';
    html += '<div class="form-group"><label>PAN Number</label><input type="text" id="ins-pan" class="form-control" placeholder="PAN" maxlength="10"></div></div>';
    html += '<div class="form-group"><label>Sum Insured (\u20B9)</label><input type="number" id="ins-amount" class="form-control" placeholder="Sum insured" min="1000" required></div>';
    html += '<div class="form-group"><label>Additional Details</label><textarea id="ins-details" class="form-control" rows="3" placeholder="Any additional information"></textarea></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Get Quote</button></div></form></div></div>';
    container.innerHTML = html;

    document.getElementById('insurance-form').addEventListener('submit', async function (e) {
      e.preventDefault(); showLoading();
      try {
        var res = await apiCall('/insurance/quote', { method: 'POST', body: { type: document.getElementById('ins-type').value, name: document.getElementById('ins-name').value.trim(), dob: document.getElementById('ins-dob').value, mobile: document.getElementById('ins-mobile').value.trim(), email: document.getElementById('ins-email').value.trim(), pan: document.getElementById('ins-pan').value.trim(), sumInsured: parseFloat(document.getElementById('ins-amount').value), details: document.getElementById('ins-details').value.trim() } });
        if (res) {
          var q = res.data;
          showModal('Insurance Quote', '<div class="quote-result"><p><strong>Plan:</strong> ' + escapeHtml(q.planName || '-') + '</p><p><strong>Premium:</strong> ' + formatINR(q.premium) + ' / year</p><p><strong>Coverage:</strong> ' + formatINR(q.sumInsured) + '</p><p><strong>Quote ID:</strong> ' + escapeHtml(q.quoteId || '-') + '</p><div class="form-actions"><button class="btn btn-primary" onclick="window.__buyInsurance && window.__buyInsurance()">Buy Now</button></div></div>', { width: '500px' });
          window.__buyInsurance = async function () { closeModal(); showLoading(); try { var br = await apiCall('/insurance/buy', { method: 'POST', body: { quoteId: q.quoteId } }); if (br) { showToast('Insurance purchased successfully!', 'success'); updateWalletDisplay(); } } catch (err) { showToast(err.message || 'Purchase failed.', 'error'); } finally { hideLoading(); } };
        }
      } catch (err) { showToast(err.message || 'Failed to get quote.', 'error'); }
      finally { hideLoading(); }
    });
  });

  /* ────────────────────────────────────────────
     14. Bank Account Opening
     ──────────────────────────────────────────── */

  registerRoute('bank-account', function (container) {
    var html = '<div class="page-header"><h2>Bank Account Opening</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="bank-form">';
    html += '<div class="form-row"><div class="form-group"><label>Full Name</label><input type="text" id="bank-name" class="form-control" placeholder="As per Aadhaar" required></div>';
    html += '<div class="form-group"><label>Date of Birth</label><input type="date" id="bank-dob" class="form-control" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Mobile Number</label><input type="tel" id="bank-mobile" class="form-control" placeholder="Mobile" maxlength="10" required></div>';
    html += '<div class="form-group"><label>Email</label><input type="email" id="bank-email" class="form-control" placeholder="Email"></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Aadhaar Number</label><input type="text" id="bank-aadhaar" class="form-control" placeholder="12-digit Aadhaar" maxlength="12" required></div>';
    html += '<div class="form-group"><label>PAN Number</label><input type="text" id="bank-pan" class="form-control" placeholder="PAN" maxlength="10" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Preferred Bank</label><select id="bank-preferred" class="form-control" required><option value="">Select bank</option>';
    html += '<option value="sbi">State Bank of India</option><option value="hdfc">HDFC Bank</option><option value="icici">ICICI Bank</option>';
    html += '<option value="axis">Axis Bank</option><option value="kotak">Kotak Mahindra Bank</option><option value="pnb">Punjab National Bank</option>';
    html += '<option value="bob">Bank of Baroda</option><option value="canara">Canara Bank</option></select></div>';
    html += '<div class="form-group"><label>Account Type</label><select id="bank-acctype" class="form-control" required>';
    html += '<option value="savings">Savings Account</option><option value="current">Current Account</option></select></div></div>';
    html += '<div class="form-group"><label>Address</label><textarea id="bank-address" class="form-control" rows="2" placeholder="Address" required></textarea></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Submit Application</button></div></form></div></div>';
    container.innerHTML = html;

    document.getElementById('bank-form').addEventListener('submit', async function (e) {
      e.preventDefault(); showLoading();
      try {
        var res = await apiCall('/bank-account/apply', { method: 'POST', body: { name: document.getElementById('bank-name').value.trim(), dob: document.getElementById('bank-dob').value, mobile: document.getElementById('bank-mobile').value.trim(), email: document.getElementById('bank-email').value.trim(), aadhaar: document.getElementById('bank-aadhaar').value.trim(), pan: document.getElementById('bank-pan').value.trim(), preferredBank: document.getElementById('bank-preferred').value, accountType: document.getElementById('bank-acctype').value, address: document.getElementById('bank-address').value.trim() } });
        if (res) { showToast('Application submitted successfully! Reference: ' + (res.data.referenceId || ''), 'success'); document.getElementById('bank-form').reset(); }
      } catch (err) { showToast(err.message || 'Application failed.', 'error'); }
      finally { hideLoading(); }
    });
  });

  /* ────────────────────────────────────────────
     15. Loan Repayment
     ──────────────────────────────────────────── */

  registerRoute('loan-repayment', function (container) {
    var html = '<div class="page-header"><h2>Loan Repayment</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="loan-form">';
    html += '<div class="form-row"><div class="form-group"><label>Lender / Bank</label><input type="text" id="loan-lender" class="form-control" placeholder="Bank or lender name" required></div>';
    html += '<div class="form-group"><label>Loan Account Number</label><input type="text" id="loan-acct" class="form-control" placeholder="Loan account number" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Loan Type</label><select id="loan-type" class="form-control" required><option value="">Select type</option>';
    html += '<option value="home">Home Loan</option><option value="personal">Personal Loan</option><option value="auto">Auto Loan</option>';
    html += '<option value="education">Education Loan</option><option value="gold">Gold Loan</option><option value="business">Business Loan</option><option value="other">Other</option>';
    html += '</select></div>';
    html += '<div class="form-group"><label>EMI Amount (\u20B9)</label><input type="number" id="loan-amount" class="form-control" placeholder="EMI amount" min="1" required></div></div>';
    html += '<div class="form-group"><label>Borrower Name</label><input type="text" id="loan-name" class="form-control" placeholder="Borrower name" required></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Pay EMI</button></div></form></div></div>';
    container.innerHTML = html;

    document.getElementById('loan-form').addEventListener('submit', async function (e) {
      e.preventDefault(); var amount = document.getElementById('loan-amount').value;
      confirmDialog('Pay EMI of ' + formatINR(amount) + '?', async function () {
        showLoading();
        try {
          var res = await apiCall('/loan/repay', { method: 'POST', body: { lender: document.getElementById('loan-lender').value.trim(), accountNumber: document.getElementById('loan-acct').value.trim(), loanType: document.getElementById('loan-type').value, amount: parseFloat(amount), borrowerName: document.getElementById('loan-name').value.trim() } });
          if (res) { showToast('Loan repayment successful! Ref: ' + (res.data.referenceId || ''), 'success'); document.getElementById('loan-form').reset(); updateWalletDisplay(); }
        } catch (err) { showToast(err.message || 'Repayment failed.', 'error'); }
        finally { hideLoading(); }
      });
    });
  });

  /* ────────────────────────────────────────────
     16. Credit Card
     ──────────────────────────────────────────── */

  registerRoute('credit-card', function (container) {
    var html = '<div class="page-header"><h2>Credit Card Application</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="cc-form">';
    html += '<div class="form-row"><div class="form-group"><label>Full Name</label><input type="text" id="cc-name" class="form-control" placeholder="Full name" required></div>';
    html += '<div class="form-group"><label>Date of Birth</label><input type="date" id="cc-dob" class="form-control" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Mobile Number</label><input type="tel" id="cc-mobile" class="form-control" placeholder="Mobile" maxlength="10" required></div>';
    html += '<div class="form-group"><label>Email</label><input type="email" id="cc-email" class="form-control" placeholder="Email" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>PAN Number</label><input type="text" id="cc-pan" class="form-control" placeholder="PAN" maxlength="10" required></div>';
    html += '<div class="form-group"><label>Annual Income (\u20B9)</label><input type="number" id="cc-income" class="form-control" placeholder="Annual income" min="0" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Preferred Bank</label><select id="cc-bank" class="form-control" required><option value="">Select bank</option>';
    html += '<option value="hdfc">HDFC Bank</option><option value="icici">ICICI Bank</option><option value="sbi">SBI Card</option>';
    html += '<option value="axis">Axis Bank</option><option value="kotak">Kotak Bank</option></select></div>';
    html += '<div class="form-group"><label>Card Type</label><select id="cc-type" class="form-control" required><option value="">Select type</option>';
    html += '<option value="classic">Classic</option><option value="gold">Gold</option><option value="platinum">Platinum</option><option value="signature">Signature</option></select></div></div>';
    html += '<div class="form-group"><label>Address</label><textarea id="cc-address" class="form-control" rows="2" placeholder="Address" required></textarea></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Apply Now</button></div></form></div></div>';
    container.innerHTML = html;

    document.getElementById('cc-form').addEventListener('submit', async function (e) {
      e.preventDefault(); showLoading();
      try {
        var res = await apiCall('/credit-card/apply', { method: 'POST', body: { name: document.getElementById('cc-name').value.trim(), dob: document.getElementById('cc-dob').value, mobile: document.getElementById('cc-mobile').value.trim(), email: document.getElementById('cc-email').value.trim(), pan: document.getElementById('cc-pan').value.trim(), annualIncome: parseFloat(document.getElementById('cc-income').value), preferredBank: document.getElementById('cc-bank').value, cardType: document.getElementById('cc-type').value, address: document.getElementById('cc-address').value.trim() } });
        if (res) { showToast('Application submitted! Reference: ' + (res.data.referenceId || ''), 'success'); document.getElementById('cc-form').reset(); }
      } catch (err) { showToast(err.message || 'Application failed.', 'error'); }
      finally { hideLoading(); }
    });
  });

  /* ────────────────────────────────────────────
     17. UPI / QR
     ──────────────────────────────────────────── */

  registerRoute('upi-qr', function (container) {
    var html = '<div class="page-header"><h2>UPI / QR Code</h2></div>';
    html += '<div class="card"><div class="card-body"><div class="upi-section"><div class="upi-info">';
    html += '<p><strong>Your UPI ID:</strong> <span id="upi-id-display">' + escapeHtml(currentUser.upiId || currentUser.email || '-') + '</span></p>';
    html += '<p><strong>QR Code:</strong></p>';
    html += '<div id="qr-code-area" class="qr-area"><div class="qr-placeholder">Loading QR...</div></div>';
    html += '</div><div class="upi-actions"><h3>Generate QR Code</h3><form id="qr-form">';
    html += '<div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="qr-amount" class="form-control" placeholder="Amount (leave empty for any amount)" min="1"></div>';
    html += '<div class="form-group"><label>Description</label><input type="text" id="qr-desc" class="form-control" placeholder="Payment description"></div>';
    html += '<button type="submit" class="btn btn-primary btn-block">Generate QR</button></form>';
    html += '<div class="mt-2"><button class="btn btn-outline btn-block" id="download-qr">Download QR</button></div>';
    html += '</div></div></div></div></div>';
    container.innerHTML = html;

    loadQrCode();
    document.getElementById('qr-form').addEventListener('submit', function (e) { e.preventDefault(); loadQrCode(); });
    document.getElementById('download-qr').addEventListener('click', function () {
      var qr = document.querySelector('#qr-code-area img, #qr-code-area canvas');
      if (qr) { var link = document.createElement('a'); link.download = 'rsrecharge-qr.png'; link.href = qr.src || qr.toDataURL('image/png'); link.click(); }
    });

    async function loadQrCode() {
      var area = document.getElementById('qr-code-area');
      try {
        var amount = document.getElementById('qr-amount').value;
        var desc = document.getElementById('qr-desc').value.trim();
        var url = '/upi/qr' + (amount ? '?amount=' + amount + '&description=' + encodeURIComponent(desc) : '');
        var res = await apiCall(url);
        if (res && res.data) { area.innerHTML = '<img src="' + escapeHtml(res.data.qrImage || '') + '" alt="QR Code" class="qr-image">'; }
        else { area.innerHTML = '<div class="qr-placeholder">QR code will be displayed here</div>'; }
      } catch (_) { area.innerHTML = '<div class="qr-placeholder">QR service unavailable</div>'; }
    }
  });

  /* ────────────────────────────────────────────
     18. Transactions
     ──────────────────────────────────────────── */

  registerRoute('transactions', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>Transactions</h2></div>';
    var html = '<div class="card"><div class="card-header"><div class="filter-bar">';
    html += '<input type="text" id="txn-search" class="form-control form-control-sm" placeholder="Search transactions...">';
    html += '<select id="txn-type-filter" class="form-control form-control-sm"><option value="">All Types</option>';
    html += '<option value="recharge">Recharge</option><option value="dth">DTH</option><option value="bill">Bill Payment</option>';
    html += '<option value="aeps">AEPS</option><option value="dmt">DMT</option><option value="wallet">Wallet</option></select>';
    html += '<select id="txn-status-filter" class="form-control form-control-sm"><option value="">All Status</option>';
    html += '<option value="success">Success</option><option value="pending">Pending</option><option value="failed">Failed</option></select>';
    html += '<button class="btn btn-sm btn-outline" id="txn-export-btn">Export CSV</button>';
    html += '</div></div><div class="card-body"><div id="txn-table-wrapper"></div><div id="txn-pagination"></div></div></div>';
    container.innerHTML = html;

    var allTxns = [], currentPage = 1, perPage = 20;
    try { var res = await apiCall('/transactions'); allTxns = (res && res.data) || []; }
    catch (err) { document.getElementById('txn-table-wrapper').innerHTML = '<div class="empty-state">Failed to load transactions.</div>'; return; }

    function renderTxnPage(page) {
      currentPage = page || 1;
      var search = document.getElementById('txn-search').value.trim();
      var typeF = document.getElementById('txn-type-filter').value;
      var statusF = document.getElementById('txn-status-filter').value;
      var filtered = allTxns;
      if (search) filtered = filterRows(filtered, search, ['mobile', 'number', 'referenceId', '_id', 'accountNumber']);
      if (typeF) filtered = filtered.filter(function (t) { return (t.type || t.serviceType || '') === typeF; });
      if (statusF) filtered = filtered.filter(function (t) { return t.status === statusF; });
      var totalPages = Math.ceil(filtered.length / perPage);
      var start = (currentPage - 1) * perPage;
      var pageData = filtered.slice(start, start + perPage);
      document.getElementById('txn-table-wrapper').innerHTML = renderTransactionsTable(pageData);
      document.getElementById('txn-pagination').innerHTML = renderPagination(currentPage, totalPages);
      document.querySelector('#txn-pagination').onclick = function (e) { var btn = e.target.closest('.page-btn'); if (btn && !btn.disabled) renderTxnPage(parseInt(btn.dataset.page, 10)); };
    }

    renderTxnPage(1);
    document.getElementById('txn-search').addEventListener('input', debounce(function () { renderTxnPage(1); }, 300));
    document.getElementById('txn-type-filter').addEventListener('change', function () { renderTxnPage(1); });
    document.getElementById('txn-status-filter').addEventListener('change', function () { renderTxnPage(1); });

    document.getElementById('txn-export-btn').addEventListener('click', function () {
      if (allTxns.length === 0) { showToast('No transactions to export.', 'warning'); return; }
      var csv = 'ID,Type,Number,Amount,Status,Date\n';
      for (var i = 0; i < allTxns.length; i++) { var t = allTxns[i]; csv += '"' + (t._id || '') + '","' + (t.type || t.serviceType || '') + '","' + (t.mobile || t.number || '') + '",' + (t.amount || 0) + ',"' + (t.status || '') + '","' + (t.createdAt || '') + '"\n'; }
      var blob = new Blob([csv], { type: 'text/csv' }); var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'transactions-' + new Date().toISOString().slice(0, 10) + '.csv'; link.click();
    });
  });

  /* ────────────────────────────────────────────
     19. Wallet
     ──────────────────────────────────────────── */

  registerRoute('wallet', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>My Wallet</h2></div>';
    var html = '<div class="stats-grid">';
    html += statCard('Available Balance', formatINR(currentUser.walletBalance || 0), '\uD83D\uDCB0', 'blue');
    html += statCard('Total Earned', formatINR(currentUser.totalEarned || 0), '\uD83D\uDCC8', 'green');
    html += statCard('Total Spent', formatINR(currentUser.totalSpent || 0), '\uD83D\uDCC9', 'orange');
    html += statCard('Commission Earned', formatINR(currentUser.commissionEarned || 0), '\uD83C\uDF81', 'purple');
    html += '</div>';
    html += '<div class="card mb-3"><div class="card-header"><h3>Add Money to Wallet</h3></div><div class="card-body">';
    html += '<form id="add-money-form" class="form-inline"><div class="form-group"><input type="number" id="add-money-amount" class="form-control" placeholder="Amount" min="1" required></div>';
    html += '<div class="form-group"><select id="add-money-method" class="form-control"><option value="upi">UPI</option><option value="netbanking">Net Banking</option><option value="card">Credit/Debit Card</option></select></div>';
    html += '<button type="submit" class="btn btn-primary">Add Money</button></form></div></div>';
    html += '<div class="card"><div class="card-header"><h3>Wallet History</h3></div><div class="card-body"><div class="table-responsive"><table class="data-table">';
    html += '<thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>';
    html += '<tbody id="wallet-tbody"></tbody></table></div></div></div>';
    container.innerHTML = html;

    try {
      var res = await apiCall('/wallet/history');
      var history = (res && res.data) || [];
      var tbody = document.getElementById('wallet-tbody');
      if (history.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center">No wallet history.</td></tr>'; }
      else {
        var rows = '';
        for (var i = 0; i < history.length; i++) {
          var h = history[i]; var isCredit = h.type === 'credit';
          rows += '<tr><td>' + formatDateTime(h.createdAt) + '</td><td>' + escapeHtml(h.description || h.remark || '-') + '</td>';
          rows += '<td class="text-danger">' + (isCredit ? '-' : formatINR(h.amount)) + '</td>';
          rows += '<td class="text-success">' + (isCredit ? formatINR(h.amount) : '-') + '</td>';
          rows += '<td>' + formatINR(h.balance) + '</td></tr>';
        }
        tbody.innerHTML = rows;
      }
    } catch (_) { document.getElementById('wallet-tbody').innerHTML = '<tr><td colspan="5" class="text-center">Failed to load history.</td></tr>'; }

    document.getElementById('add-money-form').addEventListener('submit', async function (e) {
      e.preventDefault(); var amount = document.getElementById('add-money-amount').value; var method = document.getElementById('add-money-method').value;
      if (!amount || parseFloat(amount) <= 0) { showToast('Please enter a valid amount.', 'warning'); return; }
      showLoading();
      try { var res = await apiCall('/wallet/add-money', { method: 'POST', body: { amount: parseFloat(amount), method: method } }); if (res) { showToast('Money added successfully!', 'success'); updateWalletDisplay(); document.getElementById('add-money-amount').value = ''; } }
      catch (err) { showToast(err.message || 'Failed to add money.', 'error'); }
      finally { hideLoading(); }
    });
  });

  /* ────────────────────────────────────────────
     20. Wallet Transfer
     ──────────────────────────────────────────── */

  registerRoute('wallet-transfer', function (container) {
    var html = '<div class="page-header"><h2>Wallet Transfer</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="wt-form">';
    html += '<div class="form-group"><label>Recipient Email or Phone</label><input type="text" id="wt-recipient" class="form-control" placeholder="Email or phone number" required></div>';
    html += '<div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="wt-amount" class="form-control" placeholder="Amount" min="1" required></div>';
    html += '<div class="form-group"><label>Remarks (optional)</label><input type="text" id="wt-remarks" class="form-control" placeholder="Remarks"></div>';
    html += '<p class="text-muted">Current Balance: <strong>' + formatINR(currentUser.walletBalance || 0) + '</strong></p>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Transfer</button></div></form></div></div>';
    container.innerHTML = html;

    document.getElementById('wt-form').addEventListener('submit', async function (e) {
      e.preventDefault(); var recipient = document.getElementById('wt-recipient').value.trim(); var amount = document.getElementById('wt-amount').value; var remarks = document.getElementById('wt-remarks').value.trim();
      if (!recipient || !amount) { showToast('Please fill in all fields.', 'warning'); return; }
      confirmDialog('Transfer ' + formatINR(amount) + ' to ' + recipient + '?', async function () {
        showLoading();
        try { var res = await apiCall('/wallet/transfer', { method: 'POST', body: { recipient: recipient, amount: parseFloat(amount), remarks: remarks } }); if (res) { showToast('Transfer successful!', 'success'); document.getElementById('wt-form').reset(); updateWalletDisplay(); } }
        catch (err) { showToast(err.message || 'Transfer failed.', 'error'); }
        finally { hideLoading(); }
      });
    });
  });

  /* ────────────────────────────────────────────
     21. Notifications
     ──────────────────────────────────────────── */

  function getNotifIcon(type) {
    var icons = { transaction: '\uD83D\uDCCB', wallet: '\uD83D\uDC5D', alert: '\u26A0\uFE0F', info: '\u2139\uFE0F', success: '\u2705', error: '\u274C', system: '\u2699\uFE0F' };
    return icons[type] || '\uD83D\uDD14';
  }

  registerRoute('notifications', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>Notifications</h2></div>';
    var html = '<div class="card"><div class="card-header"><h3>All Notifications</h3><button class="btn btn-sm btn-outline" id="mark-all-read">Mark All Read</button></div>';
    html += '<div class="card-body"><div id="notif-list"></div></div></div>';
    container.innerHTML = html;

    try {
      var res = await apiCall('/notifications');
      var notifs = (res && res.data) || [];
      var listEl = document.getElementById('notif-list');
      if (notifs.length === 0) { listEl.innerHTML = '<div class="empty-state">No notifications.</div>'; }
      else {
        var nHtml = '<ul class="notif-list">';
        for (var i = 0; i < notifs.length; i++) { var n = notifs[i]; var readCls = n.read ? '' : ' unread'; nHtml += '<li class="notif-item' + readCls + '" data-id="' + n._id + '"><div class="notif-icon">' + getNotifIcon(n.type) + '</div><div class="notif-content"><div class="notif-title">' + escapeHtml(n.title || 'Notification') + '</div><div class="notif-body">' + escapeHtml(n.message || '') + '</div><div class="notif-time">' + formatDateTime(n.createdAt) + '</div></div></li>'; }
        nHtml += '</ul>';
        listEl.innerHTML = nHtml;
      }
    } catch (err) { document.getElementById('notif-list').innerHTML = '<div class="empty-state">Failed to load notifications.</div>'; }

    document.getElementById('mark-all-read').addEventListener('click', async function () {
      try { await apiCall('/notifications/read-all', { method: 'PUT' }); document.querySelectorAll('.notif-item.unread').forEach(function (el) { el.classList.remove('unread'); }); document.getElementById('notif-count').textContent = '0'; showToast('All notifications marked as read.', 'success'); } catch (_) {}
    });
  });

  /* ────────────────────────────────────────────
     22. Admin - Users Management
     ──────────────────────────────────────────── */

  registerRoute('users', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>User Management</h2><a href="#user-create" class="btn btn-primary">+ Create User</a></div>';
    var html = '<div class="card"><div class="card-header"><div class="filter-bar">';
    html += '<input type="text" id="user-search" class="form-control form-control-sm" placeholder="Search users...">';
    html += '<select id="user-role-filter" class="form-control form-control-sm"><option value="">All Roles</option><option value="admin">Admin</option><option value="distributor">Distributor</option><option value="retailer">Retailer</option></select>';
    html += '<select id="user-status-filter" class="form-control form-control-sm"><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select>';
    html += '</div></div><div class="card-body"><div id="user-table-wrapper"></div><div id="user-pagination"></div></div></div>';
    container.innerHTML = html;

    var allUsers = [], currentPage = 1, perPage = 20;
    try { var res = await apiCall('/admin/users'); allUsers = (res && res.data) || []; }
    catch (err) { document.getElementById('user-table-wrapper').innerHTML = '<div class="empty-state">Failed to load users.</div>'; return; }

    function renderUserPage(page) {
      currentPage = page || 1;
      var search = document.getElementById('user-search').value.trim();
      var roleF = document.getElementById('user-role-filter').value;
      var statusF = document.getElementById('user-status-filter').value;
      var filtered = allUsers;
      if (search) filtered = filterRows(filtered, search, ['name', 'email', 'phone']);
      if (roleF) filtered = filtered.filter(function (u) { return u.role === roleF; });
      if (statusF) filtered = filtered.filter(function (u) { return u.status === statusF; });
      var totalPages = Math.ceil(filtered.length / perPage);
      var start = (currentPage - 1) * perPage;
      var pageData = filtered.slice(start, start + perPage);
      var tHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Wallet</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
      for (var i = 0; i < pageData.length; i++) {
        var u = pageData[i];
        tHtml += '<tr><td>' + escapeHtml(u.name) + '</td><td>' + escapeHtml(u.email) + '</td><td>' + escapeHtml(u.phone) + '</td><td>' + capitalize(u.role) + '</td><td>' + formatINR(u.walletBalance) + '</td><td>' + statusBadge(u.status || 'active') + '</td>';
        tHtml += '<td class="actions-cell">';
        tHtml += '<a href="#user-edit/' + u._id + '" class="btn btn-sm btn-outline">Edit</a> ';
        tHtml += '<button class="btn btn-sm btn-outline user-toggle" data-id="' + u._id + '" data-status="' + u.status + '">' + (u.status === 'active' ? 'Suspend' : 'Activate') + '</button> ';
        tHtml += '<button class="btn btn-sm btn-outline user-wallet-adj" data-id="' + u._id + '" data-name="' + escapeHtml(u.name) + '">Wallet</button> ';
        if (u.role !== 'admin') {
          tHtml += '<button class="btn btn-sm btn-warning user-upgrade" data-id="' + u._id + '" data-role="' + u.role + '" data-name="' + escapeHtml(u.name) + '">Upgrade</button> ';
          tHtml += '<button class="btn btn-sm btn-danger user-delete" data-id="' + u._id + '" data-name="' + escapeHtml(u.name) + '">Delete</button>';
        }
        tHtml += '</td></tr>';
      }
      tHtml += '</tbody></table></div>';
      if (pageData.length === 0) tHtml = '<div class="empty-state">No users found.</div>';
      document.getElementById('user-table-wrapper').innerHTML = tHtml;
      document.getElementById('user-pagination').innerHTML = renderPagination(currentPage, totalPages);
      bindUserActions();
    }

    function bindUserActions() {
      document.querySelectorAll('.user-toggle').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var newStatus = btn.dataset.status === 'active' ? 'inactive' : 'active';
          showLoading();
          try { await apiCall('/admin/users/' + btn.dataset.id + '/status', { method: 'PUT', body: { status: newStatus } }); var user = allUsers.find(function (u) { return u._id === btn.dataset.id; }); if (user) user.status = newStatus; renderUserPage(currentPage); showToast('User status updated.', 'success'); }
          catch (err) { showToast(err.message || 'Failed to update status.', 'error'); }
          finally { hideLoading(); }
        });
      });
      document.querySelectorAll('.user-wallet-adj').forEach(function (btn) {
        btn.addEventListener('click', function () {
          showModal('Adjust Wallet - ' + btn.dataset.name, '<form id="adj-form"><div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="adj-amount" class="form-control" placeholder="Use negative for debit" required></div><div class="form-group"><label>Reason</label><input type="text" id="adj-reason" class="form-control" placeholder="Reason" required></div><button type="submit" class="btn btn-primary">Apply Adjustment</button></form>', { width: '400px' });
          setTimeout(function () {
            var f = document.getElementById('adj-form');
            if (f) { f.addEventListener('submit', async function (ev) {
              ev.preventDefault(); showLoading();
              try { await apiCall('/admin/users/' + btn.dataset.id + '/wallet-adjust', { method: 'POST', body: { amount: parseFloat(document.getElementById('adj-amount').value), reason: document.getElementById('adj-reason').value.trim() } }); showToast('Wallet adjusted.', 'success'); closeModal(); var u = allUsers.find(function (usr) { return usr._id === btn.dataset.id; }); if (u) u.walletBalance = (u.walletBalance || 0) + parseFloat(document.getElementById('adj-amount').value); renderUserPage(currentPage); }
              catch (err) { showToast(err.message || 'Failed to adjust wallet.', 'error'); }
              finally { hideLoading(); }
            }); }
          }, 100);
        });
      });

      // Upgrade user handlers
      document.querySelectorAll('.user-upgrade').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var currentRole = btn.dataset.role;
          var roleOptions = { retailer: 'distributor', distributor: 'master_distributor' };
          var newRole = roleOptions[currentRole];
          if (!newRole) { showToast('Cannot upgrade this role further.', 'warning'); return; }
          confirmDialog('Upgrade ' + btn.dataset.name + ' from ' + currentRole + ' to ' + newRole + '?', async function () {
            showLoading();
            try {
              await apiCall('/admin/users/' + btn.dataset.id + '/upgrade', { method: 'PUT', body: { new_role: newRole } });
              var user = allUsers.find(function (u) { return u._id === btn.dataset.id; });
              if (user) user.role = newRole;
              renderUserPage(currentPage);
              showToast('User upgraded to ' + newRole, 'success');
            } catch (err) { showToast(err.message || 'Failed to upgrade.', 'error'); }
            finally { hideLoading(); }
          });
        });
      });

      // Delete user handlers
      document.querySelectorAll('.user-delete').forEach(function (btn) {
        btn.addEventListener('click', function () {
          confirmDialog('Permanently delete ' + btn.dataset.name + '? This cannot be undone.', async function () {
            showLoading();
            try {
              await apiCall('/admin/users/' + btn.dataset.id + '/permanent', { method: 'DELETE' });
              allUsers = allUsers.filter(function (u) { return u._id !== btn.dataset.id; });
              renderUserPage(currentPage);
              showToast('User deleted.', 'success');
            } catch (err) { showToast(err.message || 'Failed to delete.', 'error'); }
            finally { hideLoading(); }
          });
        });
      });
    }

    renderUserPage(1);
    document.getElementById('user-search').addEventListener('input', debounce(function () { renderUserPage(1); }, 300));
    document.getElementById('user-role-filter').addEventListener('change', function () { renderUserPage(1); });
    document.getElementById('user-status-filter').addEventListener('change', function () { renderUserPage(1); });
    document.querySelector('#user-pagination').onclick = function (e) { var btn = e.target.closest('.page-btn'); if (btn && !btn.disabled) renderUserPage(parseInt(btn.dataset.page, 10)); };
  });

  /* ── User Create ── */
  registerRoute('user-create', function (container) {
    var html = '<div class="page-header"><h2>Create User</h2><a href="#users" class="btn btn-outline">Back to Users</a></div>';
    html += '<div class="card"><div class="card-body"><form id="create-user-form">';
    html += '<div class="form-row"><div class="form-group"><label>Full Name</label><input type="text" id="cu-name" class="form-control" required></div>';
    html += '<div class="form-group"><label>Email</label><input type="email" id="cu-email" class="form-control" required></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Phone</label><input type="tel" id="cu-phone" class="form-control" maxlength="10" required></div>';
    html += '<div class="form-group"><label>Role</label><select id="cu-role" class="form-control" required><option value="retailer">Retailer</option><option value="distributor">Distributor</option><option value="admin">Admin</option></select></div></div>';
    html += '<div class="form-row"><div class="form-group"><label>Password</label><input type="password" id="cu-pass" class="form-control" minlength="6" required></div>';
    html += '<div class="form-group"><label>Initial Balance (\u20B9)</label><input type="number" id="cu-balance" class="form-control" value="0" min="0"></div></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Create User</button></div></form></div></div>';
    container.innerHTML = html;

    document.getElementById('create-user-form').addEventListener('submit', async function (e) {
      e.preventDefault(); showLoading();
      try { await apiCall('/admin/users', { method: 'POST', body: { name: document.getElementById('cu-name').value.trim(), email: document.getElementById('cu-email').value.trim(), phone: document.getElementById('cu-phone').value.trim(), role: document.getElementById('cu-role').value, password: document.getElementById('cu-pass').value, walletBalance: parseFloat(document.getElementById('cu-balance').value) || 0 } }); showToast('User created successfully.', 'success'); window.location.hash = '#users'; }
      catch (err) { showToast(err.message || 'Failed to create user.', 'error'); }
      finally { hideLoading(); }
    });
  });

  /* ── User Edit ── */
  registerRoute('user-edit', async function (container, params) {
    var userId = params[0];
    container.innerHTML = '<div class="page-loader"><div class="loading-spinner"></div></div>';
    try {
      var res = await apiCall('/admin/users/' + userId);
      var user = (res && res.data) || {};
      var html = '<div class="page-header"><h2>Edit User</h2><a href="#users" class="btn btn-outline">Back to Users</a></div>';
      html += '<div class="card"><div class="card-body"><form id="edit-user-form">';
      html += '<div class="form-row"><div class="form-group"><label>Full Name</label><input type="text" id="eu-name" class="form-control" value="' + escapeHtml(user.name || '') + '" required></div>';
      html += '<div class="form-group"><label>Email</label><input type="email" id="eu-email" class="form-control" value="' + escapeHtml(user.email || '') + '" required></div></div>';
      html += '<div class="form-row"><div class="form-group"><label>Phone</label><input type="tel" id="eu-phone" class="form-control" value="' + escapeHtml(user.phone || '') + '" maxlength="10" required></div>';
      html += '<div class="form-group"><label>Role</label><select id="eu-role" class="form-control"><option value="retailer"' + (user.role === 'retailer' ? ' selected' : '') + '>Retailer</option><option value="distributor"' + (user.role === 'distributor' ? ' selected' : '') + '>Distributor</option><option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>Admin</option></select></div></div>';
      html += '<div class="form-row"><div class="form-group"><label>Status</label><select id="eu-status" class="form-control"><option value="active"' + (user.status === 'active' ? ' selected' : '') + '>Active</option><option value="inactive"' + (user.status === 'inactive' ? ' selected' : '') + '>Inactive</option><option value="suspended"' + (user.status === 'suspended' ? ' selected' : '') + '>Suspended</option></select></div>';
      html += '<div class="form-group"><label>Wallet Balance (\u20B9)</label><input type="number" id="eu-balance" class="form-control" value="' + (user.walletBalance || 0) + '"></div></div>';
      html += '<div class="form-group"><label>New Password (leave blank to keep current)</label><input type="password" id="eu-pass" class="form-control" minlength="6"></div>';
      html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Update User</button></div></form></div></div>';
      container.innerHTML = html;

      document.getElementById('edit-user-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var body = { name: document.getElementById('eu-name').value.trim(), email: document.getElementById('eu-email').value.trim(), phone: document.getElementById('eu-phone').value.trim(), role: document.getElementById('eu-role').value, status: document.getElementById('eu-status').value, walletBalance: parseFloat(document.getElementById('eu-balance').value) || 0 };
        var pass = document.getElementById('eu-pass').value; if (pass) body.password = pass;
        showLoading();
        try { await apiCall('/admin/users/' + userId, { method: 'PUT', body: body }); showToast('User updated successfully.', 'success'); window.location.hash = '#users'; }
        catch (err) { showToast(err.message || 'Failed to update user.', 'error'); }
        finally { hideLoading(); }
      });
    } catch (err) { container.innerHTML = '<div class="error-state"><h3>Failed to load user</h3><p>' + escapeHtml(err.message) + '</p><a href="#users" class="btn btn-primary">Back</a></div>'; }
  });

  /* ────────────────────────────────────────────
     23. Admin - API Providers
     ──────────────────────────────────────────── */

  registerRoute('api-providers', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>API Providers</h2><button class="btn btn-primary" id="add-provider-btn">+ Add Provider</button></div>';
    var html = '<div class="card"><div class="card-body"><div id="providers-table-wrapper"></div></div></div>';
    container.innerHTML = html;
    loadProviders();
    document.getElementById('add-provider-btn').addEventListener('click', function () { showProviderModal(null); });

    async function loadProviders() {
      try {
        var res = await apiCall('/admin/api-providers');
        var providers = (res && res.data) || [];
        var wrapper = document.getElementById('providers-table-wrapper');
        if (providers.length === 0) { wrapper.innerHTML = '<div class="empty-state">No API providers configured.</div>'; return; }
        var tHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Name</th><th>URL</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        for (var i = 0; i < providers.length; i++) {
          var p = providers[i]; tHtml += '<tr><td>' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.baseUrl || p.url || '-') + '</td><td>' + capitalize(p.type || 'recharge') + '</td><td>' + statusBadge(p.status || 'active') + '</td>';
          tHtml += '<td><button class="btn btn-sm btn-outline edit-provider" data-id="' + p._id + '">Edit</button> <button class="btn btn-sm btn-danger del-provider" data-id="' + p._id + '">Delete</button></td></tr>';
        }
        tHtml += '</tbody></table></div>';
        wrapper.innerHTML = tHtml;
        wrapper.querySelectorAll('.edit-provider').forEach(function (btn) { btn.addEventListener('click', function () { var prov = providers.find(function (pr) { return pr._id === btn.dataset.id; }); if (prov) showProviderModal(prov); }); });
        wrapper.querySelectorAll('.del-provider').forEach(function (btn) { btn.addEventListener('click', function () { confirmDialog('Delete this provider?', async function () { showLoading(); try { await apiCall('/admin/api-providers/' + btn.dataset.id, { method: 'DELETE' }); showToast('Provider deleted.', 'success'); loadProviders(); } catch (err) { showToast(err.message, 'error'); } finally { hideLoading(); } }); }); });
      } catch (err) { document.getElementById('providers-table-wrapper').innerHTML = '<div class="empty-state">Failed to load providers.</div>'; }
    }

    function showProviderModal(provider) {
      var isEdit = !!provider;
      var html = '<form id="provider-form"><div class="form-group"><label>Name</label><input type="text" id="prov-name" class="form-control" value="' + escapeHtml(provider ? provider.name : '') + '" required></div>';
      html += '<div class="form-group"><label>Base URL</label><input type="text" id="prov-url" class="form-control" value="' + escapeHtml(provider ? (provider.baseUrl || provider.url || '') : '') + '" required></div>';
      html += '<div class="form-group"><label>API Key</label><input type="text" id="prov-key" class="form-control" value="' + escapeHtml(provider ? provider.apiKey : '') + '"></div>';
      html += '<div class="form-group"><label>Type</label><select id="prov-type" class="form-control"><option value="recharge"' + (provider && provider.type === 'recharge' ? ' selected' : '') + '>Recharge</option><option value="dmt"' + (provider && provider.type === 'dmt' ? ' selected' : '') + '>DMT</option><option value="aeps"' + (provider && provider.type === 'aeps' ? ' selected' : '') + '>AEPS</option><option value="bill"' + (provider && provider.type === 'bill' ? ' selected' : '') + '>Bill Payment</option><option value="other"' + (provider && provider.type === 'other' ? ' selected' : '') + '>Other</option></select></div>';
      html += '<div class="form-group"><label>Status</label><select id="prov-status" class="form-control"><option value="active"' + (!provider || provider.status === 'active' ? ' selected' : '') + '>Active</option><option value="inactive"' + (provider && provider.status === 'inactive' ? ' selected' : '') + '>Inactive</option></select></div>';
      html += '<div class="form-group"><label>Priority</label><input type="number" id="prov-priority" class="form-control" value="' + (provider ? provider.priority || 1 : 1) + '" min="1" max="10"></div>';
      html += '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Update' : 'Create') + '</button></form>';
      showModal(isEdit ? 'Edit Provider' : 'Add Provider', html, { width: '500px' });
      setTimeout(function () {
        document.getElementById('provider-form').addEventListener('submit', async function (ev) {
          ev.preventDefault(); var body = { name: document.getElementById('prov-name').value.trim(), baseUrl: document.getElementById('prov-url').value.trim(), apiKey: document.getElementById('prov-key').value.trim(), type: document.getElementById('prov-type').value, status: document.getElementById('prov-status').value, priority: parseInt(document.getElementById('prov-priority').value) || 1 };
          showLoading();
          try { if (isEdit) { await apiCall('/admin/api-providers/' + provider._id, { method: 'PUT', body: body }); } else { await apiCall('/admin/api-providers', { method: 'POST', body: body }); } showToast('Provider ' + (isEdit ? 'updated' : 'created') + '.', 'success'); closeModal(); loadProviders(); }
          catch (err) { showToast(err.message || 'Failed.', 'error'); }
          finally { hideLoading(); }
        });
      }, 100);
    }
  });

  /* ────────────────────────────────────────────
     24. Admin - Operators
     ──────────────────────────────────────────── */

  registerRoute('operators', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>Operators</h2><button class="btn btn-primary" id="add-op-btn">+ Add Operator</button></div>';
    var html = '<div class="card"><div class="card-body"><div id="ops-table-wrapper"></div></div></div>';
    container.innerHTML = html;
    loadOperators();
    document.getElementById('add-op-btn').addEventListener('click', function () { showOperatorModal(null); });

    async function loadOperators() {
      try {
        var res = await apiCall('/admin/operators');
        var ops = (res && res.data) || [];
        var wrapper = document.getElementById('ops-table-wrapper');
        if (ops.length === 0) { wrapper.innerHTML = '<div class="empty-state">No operators configured.</div>'; return; }
        var tHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Name</th><th>Code</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        for (var i = 0; i < ops.length; i++) { var o = ops[i]; tHtml += '<tr><td>' + escapeHtml(o.name) + '</td><td>' + escapeHtml(o.code) + '</td><td>' + capitalize(o.type || '') + '</td><td>' + statusBadge(o.status || 'active') + '</td><td><button class="btn btn-sm btn-outline edit-op" data-id="' + o._id + '">Edit</button> <button class="btn btn-sm btn-danger del-op" data-id="' + o._id + '">Delete</button></td></tr>'; }
        tHtml += '</tbody></table></div>';
        wrapper.innerHTML = tHtml;
        wrapper.querySelectorAll('.edit-op').forEach(function (btn) { btn.addEventListener('click', function () { var op = ops.find(function (o) { return o._id === btn.dataset.id; }); if (op) showOperatorModal(op); }); });
        wrapper.querySelectorAll('.del-op').forEach(function (btn) { btn.addEventListener('click', function () { confirmDialog('Delete operator?', async function () { showLoading(); try { await apiCall('/admin/operators/' + btn.dataset.id, { method: 'DELETE' }); showToast('Operator deleted.', 'success'); loadOperators(); } catch (err) { showToast(err.message, 'error'); } finally { hideLoading(); } }); }); });
      } catch (err) { document.getElementById('ops-table-wrapper').innerHTML = '<div class="empty-state">Failed to load operators.</div>'; }
    }

    function showOperatorModal(op) {
      var isEdit = !!op;
      var html = '<form id="op-form"><div class="form-group"><label>Name</label><input type="text" id="op-name" class="form-control" value="' + escapeHtml(op ? op.name : '') + '" required></div>';
      html += '<div class="form-group"><label>Code</label><input type="text" id="op-code" class="form-control" value="' + escapeHtml(op ? op.code : '') + '" required></div>';
      html += '<div class="form-group"><label>Type</label><select id="op-type" class="form-control"><option value="mobile"' + (op && op.type === 'mobile' ? ' selected' : '') + '>Mobile</option><option value="dth"' + (op && op.type === 'dth' ? ' selected' : '') + '>DTH</option><option value="electricity"' + (op && op.type === 'electricity' ? ' selected' : '') + '>Electricity</option><option value="gas"' + (op && op.type === 'gas' ? ' selected' : '') + '>Gas</option><option value="water"' + (op && op.type === 'water' ? ' selected' : '') + '>Water</option><option value="broadband"' + (op && op.type === 'broadband' ? ' selected' : '') + '>Broadband</option></select></div>';
      html += '<div class="form-group"><label>Status</label><select id="op-status" class="form-control"><option value="active"' + (!op || op.status === 'active' ? ' selected' : '') + '>Active</option><option value="inactive"' + (op && op.status === 'inactive' ? ' selected' : '') + '>Inactive</option></select></div>';
      html += '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Update' : 'Create') + '</button></form>';
      showModal(isEdit ? 'Edit Operator' : 'Add Operator', html, { width: '400px' });
      setTimeout(function () {
        document.getElementById('op-form').addEventListener('submit', async function (ev) {
          ev.preventDefault(); var body = { name: document.getElementById('op-name').value.trim(), code: document.getElementById('op-code').value.trim(), type: document.getElementById('op-type').value, status: document.getElementById('op-status').value };
          showLoading();
          try { if (isEdit) { await apiCall('/admin/operators/' + op._id, { method: 'PUT', body: body }); } else { await apiCall('/admin/operators', { method: 'POST', body: body }); } showToast('Operator ' + (isEdit ? 'updated' : 'created') + '.', 'success'); closeModal(); loadOperators(); }
          catch (err) { showToast(err.message, 'error'); }
          finally { hideLoading(); }
        });
      }, 100);
    }
  });

  /* ────────────────────────────────────────────
     25. Admin - Commissions
     ──────────────────────────────────────────── */

  registerRoute('commissions', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>Commission Rules</h2><button class="btn btn-primary" id="add-comm-btn">+ Add Rule</button></div>';
    var html = '<div class="card"><div class="card-body"><div id="comm-table-wrapper"></div></div></div>';
    container.innerHTML = html;
    loadCommissions();
    document.getElementById('add-comm-btn').addEventListener('click', function () { showCommModal(null); });

    async function loadCommissions() {
      try {
        var res = await apiCall('/admin/commissions');
        var rules = (res && res.data) || [];
        var wrapper = document.getElementById('comm-table-wrapper');
        if (rules.length === 0) { wrapper.innerHTML = '<div class="empty-state">No commission rules configured.</div>'; return; }
        var tHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Service</th><th>Operator</th><th>Role</th><th>Type</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        for (var i = 0; i < rules.length; i++) { var c = rules[i]; tHtml += '<tr><td>' + escapeHtml(c.serviceType || '-') + '</td><td>' + escapeHtml(c.operator || 'All') + '</td><td>' + capitalize(c.role || 'all') + '</td><td>' + capitalize(c.commissionType || 'percentage') + '</td><td>' + (c.commissionType === 'percentage' ? c.value + '%' : formatINR(c.value)) + '</td><td>' + statusBadge(c.status || 'active') + '</td><td><button class="btn btn-sm btn-outline edit-comm" data-id="' + c._id + '">Edit</button> <button class="btn btn-sm btn-danger del-comm" data-id="' + c._id + '">Delete</button></td></tr>'; }
        tHtml += '</tbody></table></div>';
        wrapper.innerHTML = tHtml;
        wrapper.querySelectorAll('.edit-comm').forEach(function (btn) { btn.addEventListener('click', function () { var rule = rules.find(function (r) { return r._id === btn.dataset.id; }); if (rule) showCommModal(rule); }); });
        wrapper.querySelectorAll('.del-comm').forEach(function (btn) { btn.addEventListener('click', function () { confirmDialog('Delete this rule?', async function () { showLoading(); try { await apiCall('/admin/commissions/' + btn.dataset.id, { method: 'DELETE' }); showToast('Rule deleted.', 'success'); loadCommissions(); } catch (err) { showToast(err.message, 'error'); } finally { hideLoading(); } }); }); });
      } catch (err) { document.getElementById('comm-table-wrapper').innerHTML = '<div class="empty-state">Failed to load commission rules.</div>'; }
    }

    function showCommModal(rule) {
      var isEdit = !!rule;
      var html = '<form id="comm-form"><div class="form-group"><label>Service Type</label><select id="cm-service" class="form-control"><option value="recharge"' + (rule && rule.serviceType === 'recharge' ? ' selected' : '') + '>Recharge</option><option value="dth"' + (rule && rule.serviceType === 'dth' ? ' selected' : '') + '>DTH</option><option value="bill"' + (rule && rule.serviceType === 'bill' ? ' selected' : '') + '>Bill Payment</option><option value="aeps"' + (rule && rule.serviceType === 'aeps' ? ' selected' : '') + '>AEPS</option><option value="dmt"' + (rule && rule.serviceType === 'dmt' ? ' selected' : '') + '>DMT</option></select></div>';
      html += '<div class="form-group"><label>Operator (leave empty for all)</label><input type="text" id="cm-operator" class="form-control" value="' + escapeHtml(rule ? rule.operator || '' : '') + '"></div>';
      html += '<div class="form-group"><label>Role</label><select id="cm-role" class="form-control"><option value="all"' + (rule && rule.role === 'all' ? ' selected' : '') + '>All</option><option value="retailer"' + (rule && rule.role === 'retailer' ? ' selected' : '') + '>Retailer</option><option value="distributor"' + (rule && rule.role === 'distributor' ? ' selected' : '') + '>Distributor</option></select></div>';
      html += '<div class="form-group"><label>Commission Type</label><select id="cm-type" class="form-control"><option value="percentage"' + (rule && rule.commissionType === 'percentage' ? ' selected' : '') + '>Percentage (%)</option><option value="flat"' + (rule && rule.commissionType === 'flat' ? ' selected' : '') + '>Flat (\u20B9)</option></select></div>';
      html += '<div class="form-group"><label>Value</label><input type="number" id="cm-value" class="form-control" value="' + (rule ? rule.value : '') + '" step="0.01" min="0" required></div>';
      html += '<div class="form-group"><label>Status</label><select id="cm-status" class="form-control"><option value="active"' + (!rule || rule.status === 'active' ? ' selected' : '') + '>Active</option><option value="inactive"' + (rule && rule.status === 'inactive' ? ' selected' : '') + '>Inactive</option></select></div>';
      html += '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Update' : 'Create') + '</button></form>';
      showModal(isEdit ? 'Edit Commission Rule' : 'Add Commission Rule', html, { width: '500px' });
      setTimeout(function () {
        document.getElementById('comm-form').addEventListener('submit', async function (ev) {
          ev.preventDefault(); var body = { serviceType: document.getElementById('cm-service').value, operator: document.getElementById('cm-operator').value.trim(), role: document.getElementById('cm-role').value, commissionType: document.getElementById('cm-type').value, value: parseFloat(document.getElementById('cm-value').value), status: document.getElementById('cm-status').value };
          showLoading();
          try { if (isEdit) { await apiCall('/admin/commissions/' + rule._id, { method: 'PUT', body: body }); } else { await apiCall('/admin/commissions', { method: 'POST', body: body }); } showToast('Rule ' + (isEdit ? 'updated' : 'created') + '.', 'success'); closeModal(); loadCommissions(); }
          catch (err) { showToast(err.message, 'error'); }
          finally { hideLoading(); }
        });
      }, 100);
    }
  });

  /* ────────────────────────────────────────────
     26. Admin - Settings
     ──────────────────────────────────────────── */

  registerRoute('settings', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>System Settings</h2></div><div class="card"><div class="card-body"><div id="settings-form-area"></div></div></div>';
    try {
      var res = await apiCall('/admin/settings');
      var settings = (res && res.data) || {};
      var area = document.getElementById('settings-form-area');
      var html = '<form id="settings-form"><h3>General</h3>';
      html += '<div class="form-row"><div class="form-group"><label>Site Name</label><input type="text" id="set-sitename" class="form-control" value="' + escapeHtml(settings.siteName || 'RS Recharge') + '"></div>';
      html += '<div class="form-group"><label>Support Email</label><input type="email" id="set-support-email" class="form-control" value="' + escapeHtml(settings.supportEmail || '') + '"></div></div>';
      html += '<div class="form-row"><div class="form-group"><label>Support Phone</label><input type="tel" id="set-support-phone" class="form-control" value="' + escapeHtml(settings.supportPhone || '') + '"></div>';
      html += '<div class="form-group"><label>Currency</label><input type="text" class="form-control" value="INR (\u20B9)" disabled></div></div>';
      html += '<h3 class="mt-3">Wallet Settings</h3>';
      html += '<div class="form-row"><div class="form-group"><label>Min Recharge Amount (\u20B9)</label><input type="number" id="set-min-recharge" class="form-control" value="' + (settings.minRecharge || 10) + '"></div>';
      html += '<div class="form-group"><label>Max Recharge Amount (\u20B9)</label><input type="number" id="set-max-recharge" class="form-control" value="' + (settings.maxRecharge || 10000) + '"></div></div>';
      html += '<div class="form-row"><div class="form-group"><label>Min Wallet Transfer (\u20B9)</label><input type="number" id="set-min-transfer" class="form-control" value="' + (settings.minWalletTransfer || 100) + '"></div>';
      html += '<div class="form-group"><label>Default Commission (%)</label><input type="number" id="set-default-comm" class="form-control" value="' + (settings.defaultCommission || 2) + '" step="0.1"></div></div>';
      html += '<h3 class="mt-3">Notifications</h3>';
      html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="set-email-notif"' + (settings.emailNotifications !== false ? ' checked' : '') + '> Enable Email Notifications</label></div>';
      html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="set-sms-notif"' + (settings.smsNotifications !== false ? ' checked' : '') + '> Enable SMS Notifications</label></div>';
      html += '<div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">Save Settings</button></div></form>';
      area.innerHTML = html;

      document.getElementById('settings-form').addEventListener('submit', async function (e) {
        e.preventDefault(); showLoading();
        try {
          await apiCall('/admin/settings', { method: 'PUT', body: { siteName: document.getElementById('set-sitename').value.trim(), supportEmail: document.getElementById('set-support-email').value.trim(), supportPhone: document.getElementById('set-support-phone').value.trim(), minRecharge: parseFloat(document.getElementById('set-min-recharge').value), maxRecharge: parseFloat(document.getElementById('set-max-recharge').value), minWalletTransfer: parseFloat(document.getElementById('set-min-transfer').value), defaultCommission: parseFloat(document.getElementById('set-default-comm').value), emailNotifications: document.getElementById('set-email-notif').checked, smsNotifications: document.getElementById('set-sms-notif').checked } });
          showToast('Settings saved.', 'success');
        } catch (err) { showToast(err.message || 'Failed to save settings.', 'error'); }
        finally { hideLoading(); }
      });
    } catch (err) { document.getElementById('settings-form-area').innerHTML = '<div class="empty-state">Failed to load settings.</div>'; }
  });

  /* ────────────────────────────────────────────
     27. Admin - Audit Logs
     ──────────────────────────────────────────── */

  registerRoute('audit-logs', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>Audit Logs</h2></div>';
    var html = '<div class="card"><div class="card-header"><div class="filter-bar">';
    html += '<input type="text" id="audit-search" class="form-control form-control-sm" placeholder="Search logs...">';
    html += '<select id="audit-action-filter" class="form-control form-control-sm"><option value="">All Actions</option><option value="login">Login</option><option value="recharge">Recharge</option><option value="wallet">Wallet</option><option value="admin">Admin Action</option><option value="system">System</option></select>';
    html += '</div></div><div class="card-body"><div id="audit-table-wrapper"></div><div id="audit-pagination"></div></div></div>';
    container.innerHTML = html;

    var allLogs = [], currentPage = 1, perPage = 25;
    try { var res = await apiCall('/admin/audit-logs'); allLogs = (res && res.data) || []; }
    catch (err) { document.getElementById('audit-table-wrapper').innerHTML = '<div class="empty-state">Failed to load audit logs.</div>'; return; }

    function renderAuditPage(page) {
      currentPage = page || 1;
      var search = document.getElementById('audit-search').value.trim();
      var actionF = document.getElementById('audit-action-filter').value;
      var filtered = allLogs;
      if (search) filtered = filterRows(filtered, search, ['user', 'action', 'description', 'ip']);
      if (actionF) filtered = filtered.filter(function (l) { return (l.action || '') === actionF; });
      var totalPages = Math.ceil(filtered.length / perPage);
      var start = (currentPage - 1) * perPage;
      var pageData = filtered.slice(start, start + perPage);
      var tHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Date</th><th>User</th><th>Action</th><th>Description</th><th>IP</th></tr></thead><tbody>';
      for (var i = 0; i < pageData.length; i++) {
        var l = pageData[i]; tHtml += '<tr><td>' + formatDateTime(l.createdAt) + '</td><td>' + escapeHtml(l.user || '-') + '</td><td>' + statusBadge(l.action || 'info') + '</td><td>' + escapeHtml(l.description || l.details || '-') + '</td><td>' + escapeHtml(l.ip || '-') + '</td></tr>';
      }
      tHtml += '</tbody></table></div>';
      if (pageData.length === 0) tHtml = '<div class="empty-state">No audit logs found.</div>';
      document.getElementById('audit-table-wrapper').innerHTML = tHtml;
      document.getElementById('audit-pagination').innerHTML = renderPagination(currentPage, totalPages);
      document.querySelector('#audit-pagination').onclick = function (e) { var btn = e.target.closest('.page-btn'); if (btn && !btn.disabled) renderAuditPage(parseInt(btn.dataset.page, 10)); };
    }
    renderAuditPage(1);
    document.getElementById('audit-search').addEventListener('input', debounce(function () { renderAuditPage(1); }, 300));
    document.getElementById('audit-action-filter').addEventListener('change', function () { renderAuditPage(1); });
  });

  /* ────────────────────────────────────────────
     28. Real-time Notifications (Socket.io)
     ──────────────────────────────────────────── */

  function initSocket() {
    if (typeof io === 'undefined' || !isLoggedIn()) return;
    try {
      var socket = io({ auth: { token: token } });

      socket.on('connect', function () {
        console.log('[Socket] Connected');
      });

      socket.on('notification', function (data) {
        showToast(data.message || 'New notification', data.type || 'info');
        updateNotifBadge();
      });

      socket.on('wallet-update', function (data) {
        if (data.balance !== undefined) {
          currentUser.walletBalance = data.balance;
          localStorage.setItem('user', JSON.stringify(currentUser));
          var el = document.getElementById('header-wallet');
          if (el) el.textContent = formatINR(data.balance);
        }
      });

      socket.on('transaction-update', function (data) {
        showToast('Transaction ' + (data.status || 'updated') + ': ' + (data.referenceId || ''), data.status === 'success' ? 'success' : 'info');
      });

      socket.on('disconnect', function () {
        console.log('[Socket] Disconnected');
      });

      window._socket = socket;
    } catch (err) {
      console.warn('[Socket] Connection failed:', err);
    }
  }

  async function updateNotifBadge() {
    try {
      var res = await apiCall('/notifications/unread-count');
      var count = (res && res.data && res.data.count) || 0;
      var badge = document.getElementById('notif-count');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
      }
    } catch (_) {}
  }

  /* ────────────────────────────────────────────
     NEW: User Delete & Upgrade Actions
     ──────────────────────────────────────────── */

  // Add delete and upgrade buttons to user management
  // This modifies the existing users page action buttons

  /* ────────────────────────────────────────────
     NEW: Add Money via QR Code
     ──────────────────────────────────────────── */

  registerRoute('add-money-qr', function (container) {
    var html = '<div class="page-header"><h2>Add Money via UPI / QR Code</h2></div>';
    html += '<div class="card mb-3"><div class="card-header"><h3>UPI Payment</h3></div><div class="card-body">';
    html += '<p>Scan the QR code or use UPI ID below to add money to your wallet.</p>';
    html += '<div class="upi-details" id="upi-details-area">Loading UPI details...</div>';
    html += '</div></div>';
    html += '<div class="card mb-3"><div class="card-header"><h3>Manual Payment (After UPI Transfer)</h3></div><div class="card-body">';
    html += '<form id="manual-pay-form">';
    html += '<div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="mp-amount" class="form-control" placeholder="Amount you transferred" min="1" required></div>';
    html += '<div class="form-group"><label>UTR Number / Transaction Reference</label><input type="text" id="mp-utr" class="form-control" placeholder="Enter UTR or reference number" required></div>';
    html += '<div class="form-group"><label>Screenshot (optional)</label><input type="file" id="mp-screenshot" class="form-control" accept="image/*"></div>';
    html += '<button type="submit" class="btn btn-primary btn-lg">Submit for Approval</button></form>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-header"><h3>Pending Approvals</h3></div><div class="card-body"><div id="pending-pay-list">Loading...</div></div></div>';
    container.innerHTML = html;

    loadUpiDetails();
    loadPendingPayments();

    document.getElementById('manual-pay-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var amount = document.getElementById('mp-amount').value;
      var utr = document.getElementById('mp-utr').value.trim();
      if (!amount || !utr) { showToast('Please fill amount and UTR number.', 'warning'); return; }
      showLoading();
      try {
        await apiCall('/wallet/manual-payment', { method: 'POST', body: { amount: parseFloat(amount), utr_number: utr } });
        showToast('Payment submitted for approval!', 'success');
        document.getElementById('manual-pay-form').reset();
        loadPendingPayments();
      } catch (err) { showToast(err.message || 'Failed to submit.', 'error'); }
      finally { hideLoading(); }
    });

    async function loadUpiDetails() {
      try {
        var res = await apiCall('/admin/upi-settings');
        var area = document.getElementById('upi-details-area');
        if (res && res.data && res.data.upi_id) {
          area.innerHTML = '<div class="upi-info-box"><p><strong>UPI ID:</strong> ' + escapeHtml(res.data.upi_id) + '</p><p><strong>Merchant:</strong> ' + escapeHtml(res.data.merchant_name || 'RSRecharge') + '</p><p>Open any UPI app and send money to the above UPI ID. Then submit the details below.</p></div>';
        } else {
          area.innerHTML = '<p>UPI payment not configured. Please contact admin.</p>';
        }
      } catch (_) { document.getElementById('upi-details-area').innerHTML = '<p>Unable to load UPI details.</p>'; }
    }

    async function loadPendingPayments() {
      try {
        var res = await apiCall('/wallet/manual-payments');
        var list = (res && res.data) || [];
        var el = document.getElementById('pending-pay-list');
        if (list.length === 0) { el.innerHTML = '<p>No pending payments.</p>'; return; }
        var h = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Amount</th><th>UTR</th><th>Status</th><th>Date</th></tr></thead><tbody>';
        for (var i = 0; i < list.length; i++) {
          h += '<tr><td>' + formatINR(list[i].amount) + '</td><td>' + escapeHtml(list[i].utr_number || '-') + '</td><td>' + statusBadge(list[i].status) + '</td><td>' + formatDateTime(list[i].created_at) + '</td></tr>';
        }
        h += '</tbody></table></div>';
        el.innerHTML = h;
      } catch (_) { document.getElementById('pending-pay-list').innerHTML = '<p>Failed to load payments.</p>'; }
    }
  });

  /* ────────────────────────────────────────────
     NEW: Move to Bank
     ──────────────────────────────────────────── */

  registerRoute('move-to-bank', function (container) {
    var html = '<div class="page-header"><h2>Move to Bank</h2></div>';
    html += '<div class="card mb-3"><div class="card-header"><h3>Withdraw to Bank Account</h3></div><div class="card-body">';
    html += '<form id="mtb-form">';
    html += '<div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="mtb-amount" class="form-control" placeholder="Amount to withdraw" min="100" required></div>';
    html += '<div class="form-group"><label>Bank Name</label><input type="text" id="mtb-bank" class="form-control" placeholder="Bank name" required></div>';
    html += '<div class="form-group"><label>Account Number</label><input type="text" id="mtb-account" class="form-control" placeholder="Account number" required></div>';
    html += '<div class="form-group"><label>IFSC Code</label><input type="text" id="mtb-ifsc" class="form-control" placeholder="IFSC code" required></div>';
    html += '<div class="form-group"><label>Account Holder Name</label><input type="text" id="mtb-name" class="form-control" placeholder="Account holder name" required></div>';
    html += '<p class="text-muted">Current Balance: <strong id="mtb-balance">' + formatINR(currentUser.walletBalance || 0) + '</strong></p>';
    html += '<button type="submit" class="btn btn-primary btn-lg">Submit Request</button></form>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-header"><h3>My Requests</h3></div><div class="card-body"><div id="mtb-list">Loading...</div></div></div>';
    container.innerHTML = html;

    loadMyMtbRequests();

    document.getElementById('mtb-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var amount = parseFloat(document.getElementById('mtb-amount').value);
      var bank = document.getElementById('mtb-bank').value.trim();
      var account = document.getElementById('mtb-account').value.trim();
      var ifsc = document.getElementById('mtb-ifsc').value.trim();
      var name = document.getElementById('mtb-name').value.trim();
      if (!amount || !bank || !account || !ifsc || !name) { showToast('Please fill all fields.', 'warning'); return; }
      confirmDialog('Submit move-to-bank request for ' + formatINR(amount) + '?', async function() {
        showLoading();
        try {
          await apiCall('/wallet/move-to-bank', { method: 'POST', body: { amount: amount, bank_name: bank, account_number: account, ifsc_code: ifsc, account_holder_name: name } });
          showToast('Request submitted successfully!', 'success');
          document.getElementById('mtb-form').reset();
          loadMyMtbRequests();
        } catch (err) { showToast(err.message || 'Failed.', 'error'); }
        finally { hideLoading(); }
      });
    });

    async function loadMyMtbRequests() {
      try {
        var res = await apiCall('/wallet/move-to-bank');
        var list = (res && res.data) || [];
        var el = document.getElementById('mtb-list');
        if (list.length === 0) { el.innerHTML = '<p>No requests yet.</p>'; return; }
        var h = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Amount</th><th>Bank</th><th>Account</th><th>Status</th><th>Date</th></tr></thead><tbody>';
        for (var i = 0; i < list.length; i++) {
          h += '<tr><td>' + formatINR(list[i].amount) + '</td><td>' + escapeHtml(list[i].bank_name) + '</td><td>' + escapeHtml(list[i].account_number) + '</td><td>' + statusBadge(list[i].status) + '</td><td>' + formatDateTime(list[i].created_at) + '</td></tr>';
        }
        h += '</tbody></table></div>';
        el.innerHTML = h;
      } catch (_) { document.getElementById('mtb-list').innerHTML = '<p>Failed to load requests.</p>'; }
    }
  });

  /* ────────────────────────────────────────────
     NEW: Admin - Wallet Transfer
     ──────────────────────────────────────────── */

  registerRoute('admin-wallet-transfer', function (container) {
    var html = '<div class="page-header"><h2>Admin Wallet Transfer</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="awt-form">';
    html += '<div class="form-group"><label>Recipient User ID</label><input type="text" id="awt-recipient" class="form-control" placeholder="Enter user ID (e.g. RT123456)" required></div>';
    html += '<div class="form-group"><label>Amount (\u20B9)</label><input type="number" id="awt-amount" class="form-control" placeholder="Amount" min="1" required></div>';
    html += '<div class="form-group"><label>Description</label><input type="text" id="awt-desc" class="form-control" placeholder="Transfer reason"></div>';
    html += '<button type="submit" class="btn btn-primary btn-lg">Transfer to Downline</button></form></div></div>';
    container.innerHTML = html;

    document.getElementById('awt-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var recipient = document.getElementById('awt-recipient').value.trim();
      var amount = document.getElementById('awt-amount').value;
      var desc = document.getElementById('awt-desc').value.trim();
      if (!recipient || !amount) { showToast('Please fill recipient and amount.', 'warning'); return; }
      confirmDialog('Transfer ' + formatINR(amount) + ' to ' + recipient + '?', async function() {
        showLoading();
        try {
          await apiCall('/admin/wallet-transfer', { method: 'POST', body: { to_user_id: recipient, amount: parseFloat(amount), description: desc } });
          showToast('Transfer successful!', 'success');
          document.getElementById('awt-form').reset();
        } catch (err) { showToast(err.message || 'Failed.', 'error'); }
        finally { hideLoading(); }
      });
    });
  });

  /* ────────────────────────────────────────────
     NEW: Admin - Send Notification to Downline
     ──────────────────────────────────────────── */

  registerRoute('send-notification', function (container) {
    var html = '<div class="page-header"><h2>Send Notification to Downline</h2></div>';
    html += '<div class="card"><div class="card-body"><form id="send-notif-form">';
    html += '<div class="form-group"><label>Send To</label><select id="sn-target" class="form-control" required><option value="">Select target</option>';
    html += '<option value="all">All Users</option><option value="retailer">All Retailers</option><option value="distributor">All Distributors</option><option value="master_distributor">All Master Distributors</option></select></div>';
    html += '<div class="form-group"><label>Title</label><input type="text" id="sn-title" class="form-control" placeholder="Notification title" required></div>';
    html += '<div class="form-group"><label>Message</label><textarea id="sn-message" class="form-control" rows="4" placeholder="Notification message" required></textarea></div>';
    html += '<div class="form-group"><label>Type</label><select id="sn-type" class="form-control"><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="error">Error</option></select></div>';
    html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="sn-whatsapp"> Also send via WhatsApp</label></div>';
    html += '<button type="submit" class="btn btn-primary btn-lg">Send Notification</button></form></div></div>';
    container.innerHTML = html;

    document.getElementById('send-notif-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var target = document.getElementById('sn-target').value;
      var title = document.getElementById('sn-title').value.trim();
      var message = document.getElementById('sn-message').value.trim();
      var type = document.getElementById('sn-type').value;
      if (!target || !title || !message) { showToast('Please fill all fields.', 'warning'); return; }
      confirmDialog('Send notification to ' + target + '?', async function() {
        showLoading();
        try {
          await apiCall('/admin/send-notification', { method: 'POST', body: { role: target === 'all' ? '' : target, title: title, message: message, type: type } });
          showToast('Notification sent!', 'success');
          document.getElementById('send-notif-form').reset();
        } catch (err) { showToast(err.message || 'Failed.', 'error'); }
        finally { hideLoading(); }
      });
    });
  });

  /* ────────────────────────────────────────────
     NEW: Admin - Banners Management
     ──────────────────────────────────────────── */

  registerRoute('banners', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>Banner Management</h2><button class="btn btn-primary" id="add-banner-btn">+ Add Banner</button></div>';
    var html = '<div class="card"><div class="card-body"><div id="banners-list"></div></div></div>';
    container.innerHTML = html;
    loadBanners();
    document.getElementById('add-banner-btn').addEventListener('click', function() { showBannerModal(null); });

    async function loadBanners() {
      try {
        var res = await apiCall('/admin/banners');
        var banners = (res && res.data) || [];
        var el = document.getElementById('banners-list');
        if (banners.length === 0) { el.innerHTML = '<div class="empty-state">No banners yet.</div>'; return; }
        var h = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Title</th><th>Target</th><th>Status</th><th>Order</th><th>Actions</th></tr></thead><tbody>';
        for (var i = 0; i < banners.length; i++) {
          var b = banners[i];
          h += '<tr><td>' + escapeHtml(b.title) + '</td><td>' + capitalize(b.target_role || 'all') + '</td><td>' + (b.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>') + '</td><td>' + (b.sort_order || 0) + '</td>';
          h += '<td><button class="btn btn-sm btn-outline edit-banner" data-id="' + b.id + '">Edit</button> <button class="btn btn-sm btn-danger del-banner" data-id="' + b.id + '">Delete</button></td></tr>';
        }
        h += '</tbody></table></div>';
        el.innerHTML = h;
        el.querySelectorAll('.edit-banner').forEach(function(btn) {
          btn.addEventListener('click', function() { var b = banners.find(function(x) { return x.id == btn.dataset.id; }); if (b) showBannerModal(b); });
        });
        el.querySelectorAll('.del-banner').forEach(function(btn) {
          btn.addEventListener('click', function() { confirmDialog('Delete this banner?', async function() { showLoading(); try { await apiCall('/admin/banners/' + btn.dataset.id, { method: 'DELETE' }); showToast('Banner deleted.', 'success'); loadBanners(); } catch(err) { showToast(err.message, 'error'); } finally { hideLoading(); } }); });
        });
      } catch(err) { document.getElementById('banners-list').innerHTML = '<div class="empty-state">Failed to load banners.</div>'; }
    }

    function showBannerModal(banner) {
      var isEdit = !!banner;
      var html = '<form id="banner-form"><div class="form-group"><label>Title</label><input type="text" id="bn-title" class="form-control" value="' + escapeHtml(banner ? banner.title : '') + '" required></div>';
      html += '<div class="form-group"><label>Description</label><textarea id="bn-desc" class="form-control" rows="2">' + escapeHtml(banner ? banner.description : '') + '</textarea></div>';
      html += '<div class="form-group"><label>Image URL</label><input type="text" id="bn-image" class="form-control" value="' + escapeHtml(banner ? banner.image_url : '') + '" placeholder="https://..."></div>';
      html += '<div class="form-group"><label>Link URL</label><input type="text" id="bn-link" class="form-control" value="' + escapeHtml(banner ? banner.link_url : '') + '" placeholder="https://..."></div>';
      html += '<div class="form-row"><div class="form-group"><label>Target Role</label><select id="bn-target" class="form-control"><option value="all"' + (!banner || banner.target_role === 'all' ? ' selected' : '') + '>All</option><option value="retailer"' + (banner && banner.target_role === 'retailer' ? ' selected' : '') + '>Retailer</option><option value="distributor"' + (banner && banner.target_role === 'distributor' ? ' selected' : '') + '>Distributor</option></select></div>';
      html += '<div class="form-group"><label>Sort Order</label><input type="number" id="bn-order" class="form-control" value="' + (banner ? banner.sort_order || 0 : 0) + '"></div></div>';
      html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="bn-active"' + (!banner || banner.is_active ? ' checked' : '') + '> Active</label></div>';
      html += '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Update' : 'Create') + '</button></form>';
      showModal(isEdit ? 'Edit Banner' : 'Add Banner', html, { width: '500px' });
      setTimeout(function() {
        document.getElementById('banner-form').addEventListener('submit', async function(ev) {
          ev.preventDefault();
          var body = { title: document.getElementById('bn-title').value.trim(), description: document.getElementById('bn-desc').value.trim(), image_url: document.getElementById('bn-image').value.trim(), link_url: document.getElementById('bn-link').value.trim(), target_role: document.getElementById('bn-target').value, sort_order: parseInt(document.getElementById('bn-order').value) || 0, is_active: document.getElementById('bn-active').checked };
          showLoading();
          try { if (isEdit) { await apiCall('/admin/banners/' + banner.id, { method: 'PUT', body: body }); } else { await apiCall('/admin/banners', { method: 'POST', body: body }); } showToast('Banner saved.', 'success'); closeModal(); loadBanners(); }
          catch (err) { showToast(err.message, 'error'); }
          finally { hideLoading(); }
        });
      }, 100);
    }
  });

  /* ────────────────────────────────────────────
     NEW: Admin - Move to Bank Requests
     ──────────────────────────────────────────── */

  registerRoute('admin-move-to-bank', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>Move to Bank Requests</h2></div>';
    var html = '<div class="card"><div class="card-header"><div class="filter-bar">';
    html += '<select id="mtb-status-filter" class="form-control form-control-sm"><option value="">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>';
    html += '</div></div><div class="card-body"><div id="mtb-admin-list"></div></div></div>';
    container.innerHTML = html;
    loadMtbRequests();

    document.getElementById('mtb-status-filter').addEventListener('change', function() { loadMtbRequests(this.value); });

    async function loadMtbRequests(status) {
      try {
        var url = '/admin/move-to-bank' + (status ? '?status=' + status : '');
        var res = await apiCall(url);
        var list = (res && res.data) || [];
        var el = document.getElementById('mtb-admin-list');
        if (list.length === 0) { el.innerHTML = '<div class="empty-state">No requests found.</div>'; return; }
        var h = '<div class="table-responsive"><table class="data-table"><thead><tr><th>User</th><th>Amount</th><th>Bank</th><th>Account</th><th>IFSC</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          h += '<tr><td>' + escapeHtml(r.user_name) + '<br><small>' + escapeHtml(r.user_code) + '</small></td>';
          h += '<td><strong>' + formatINR(r.amount) + '</strong></td>';
          h += '<td>' + escapeHtml(r.bank_name) + '</td><td>' + escapeHtml(r.account_number) + '</td><td>' + escapeHtml(r.ifsc_code) + '</td>';
          h += '<td>' + statusBadge(r.status) + '</td><td>' + formatDateTime(r.created_at) + '</td>';
          h += '<td>';
          if (r.status === 'pending') {
            h += '<button class="btn btn-sm btn-success approve-mtb" data-id="' + r.id + '">Approve</button> ';
            h += '<button class="btn btn-sm btn-danger reject-mtb" data-id="' + r.id + '">Reject</button>';
          } else {
            h += '<span class="text-muted">Processed</span>';
          }
          h += '</td></tr>';
        }
        h += '</tbody></table></div>';
        el.innerHTML = h;

        el.querySelectorAll('.approve-mtb').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            showLoading();
            try { await apiCall('/admin/move-to-bank/' + btn.dataset.id, { method: 'PUT', body: { status: 'approved', remarks: 'Approved by admin' } }); showToast('Request approved.', 'success'); loadMtbRequests(document.getElementById('mtb-status-filter').value); }
            catch (err) { showToast(err.message, 'error'); }
            finally { hideLoading(); }
          });
        });
        el.querySelectorAll('.reject-mtb').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            var reason = prompt('Rejection reason:');
            if (reason === null) return;
            showLoading();
            try { await apiCall('/admin/move-to-bank/' + btn.dataset.id, { method: 'PUT', body: { status: 'rejected', remarks: reason } }); showToast('Request rejected.', 'success'); loadMtbRequests(document.getElementById('mtb-status-filter').value); }
            catch (err) { showToast(err.message, 'error'); }
            finally { hideLoading(); }
          });
        });
      } catch(err) { document.getElementById('mtb-admin-list').innerHTML = '<div class="empty-state">Failed to load requests.</div>'; }
    }
  });

  /* ────────────────────────────────────────────
     NEW: Admin - UPI & Payment Settings
     ──────────────────────────────────────────── */

  registerRoute('upi-pay-settings', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>UPI & Payment Settings</h2></div>';
    var html = '<div class="card"><div class="card-body"><form id="upi-settings-form">';
    html += '<h3>UPI Configuration</h3>';
    html += '<div class="form-row"><div class="form-group"><label>UPI ID</label><input type="text" id="us-upi-id" class="form-control" placeholder="yourname@upi"></div>';
    html += '<div class="form-group"><label>Merchant Name</label><input type="text" id="us-merchant" class="form-control" placeholder="RSRecharge"></div></div>';
    html += '<div class="form-group"><label>QR Code Image URL (optional)</label><input type="text" id="us-qr" class="form-control" placeholder="https://..."></div>';
    html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="us-enabled" checked> Enable UPI Payments</label></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary">Save UPI Settings</button></div></form></div></div>';
    container.innerHTML = html;

    try {
      var res = await apiCall('/admin/upi-settings');
      if (res && res.data) {
        var d = res.data;
        if (d.upi_id) document.getElementById('us-upi-id').value = d.upi_id;
        if (d.merchant_name) document.getElementById('us-merchant').value = d.merchant_name;
        if (d.qr_image) document.getElementById('us-qr').value = d.qr_image;
        document.getElementById('us-enabled').checked = d.upi_enabled === '1';
      }
    } catch (_) {}

    document.getElementById('upi-settings-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      showLoading();
      try {
        await apiCall('/admin/upi-settings', { method: 'PUT', body: { upi_id: document.getElementById('us-upi-id').value.trim(), merchant_name: document.getElementById('us-merchant').value.trim(), qr_image: document.getElementById('us-qr').value.trim(), upi_enabled: document.getElementById('us-enabled').checked } });
        showToast('UPI settings saved.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
      finally { hideLoading(); }
    });
  });

  /* ────────────────────────────────────────────
     NEW: Admin - WhatsApp API Settings
     ──────────────────────────────────────────── */

  registerRoute('whatsapp-settings', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>WhatsApp API Settings</h2></div>';
    var html = '<div class="card"><div class="card-body"><form id="wa-form">';
    html += '<div class="form-group"><label>WhatsApp API URL</label><input type="text" id="wa-url" class="form-control" placeholder="https://api.whatsapp.com/send"></div>';
    html += '<div class="form-group"><label>API Key / Token</label><input type="password" id="wa-key" class="form-control" placeholder="API key or token"></div>';
    html += '<div class="form-group"><label>Sender Number</label><input type="tel" id="wa-sender" class="form-control" placeholder="919999999999"></div>';
    html += '<div class="form-group"><label>Template ID</label><input type="text" id="wa-template" class="form-control" placeholder="Template ID"></div>';
    html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="wa-enabled"> Enable WhatsApp Notifications</label></div>';
    html += '<div class="form-actions"><button type="submit" class="btn btn-primary">Save WhatsApp Settings</button></div></form></div></div>';
    container.innerHTML = html;

    try {
      var res = await apiCall('/admin/whatsapp-settings');
      if (res && res.data) {
        var d = res.data;
        if (d.wa_api_url) document.getElementById('wa-url').value = d.wa_api_url;
        if (d.wa_api_key) document.getElementById('wa-key').value = d.wa_api_key;
        if (d.wa_sender) document.getElementById('wa-sender').value = d.wa_sender;
        if (d.wa_template_id) document.getElementById('wa-template').value = d.wa_template_id;
        document.getElementById('wa-enabled').checked = d.wa_enabled === '1';
      }
    } catch (_) {}

    document.getElementById('wa-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      showLoading();
      try {
        await apiCall('/admin/whatsapp-settings', { method: 'PUT', body: { wa_api_url: document.getElementById('wa-url').value.trim(), wa_api_key: document.getElementById('wa-key').value.trim(), wa_sender: document.getElementById('wa-sender').value.trim(), wa_template_id: document.getElementById('wa-template').value.trim(), wa_enabled: document.getElementById('wa-enabled').checked } });
        showToast('WhatsApp settings saved.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
      finally { hideLoading(); }
    });
  });

  /* ────────────────────────────────────────────
     NEW: Admin - Payout API Settings
     ──────────────────────────────────────────── */

  registerRoute('payout-settings', async function (container) {
    container.innerHTML = '<div class="page-header"><h2>Pay-in / Payout API Settings</h2></div>';
    var html = '<div class="card mb-3"><div class="card-header"><h3>Payout API (Bank Transfer)</h3></div><div class="card-body"><form id="payout-form">';
    html += '<div class="form-group"><label>Payout API URL</label><input type="text" id="po-url" class="form-control" placeholder="https://api.payout-provider.com"></div>';
    html += '<div class="form-group"><label>API Key</label><input type="password" id="po-key" class="form-control" placeholder="API key"></div>';
    html += '<div class="form-group"><label>Merchant ID</label><input type="text" id="po-merchant" class="form-control" placeholder="Merchant ID"></div>';
    html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="po-enabled"> Enable Payout API</label></div>';
    html += '<button type="submit" class="btn btn-primary">Save Payout Settings</button></form></div></div>';
    html += '<div class="card"><div class="card-header"><h3>Pay-in API (Receive Payments)</h3></div><div class="card-body"><form id="payin-form">';
    html += '<div class="form-group"><label>Pay-in API URL</label><input type="text" id="pi-url" class="form-control" placeholder="https://api.payin-provider.com"></div>';
    html += '<div class="form-group"><label>API Key</label><input type="password" id="pi-key" class="form-control" placeholder="API key"></div>';
    html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="pi-enabled"> Enable Pay-in API</label></div>';
    html += '<button type="submit" class="btn btn-primary">Save Pay-in Settings</button></form></div></div>';
    container.innerHTML = html;

    try {
      var res = await apiCall('/admin/payout-settings');
      if (res && res.data) {
        var d = res.data;
        if (d.payout_api_url) document.getElementById('po-url').value = d.payout_api_url;
        if (d.payout_api_key) document.getElementById('po-key').value = d.payout_api_key;
        if (d.payout_merchant_id) document.getElementById('po-merchant').value = d.payout_merchant_id;
        document.getElementById('po-enabled').checked = d.payout_enabled === '1';
        if (d.payin_api_url) document.getElementById('pi-url').value = d.payin_api_url;
        if (d.payin_api_key) document.getElementById('pi-key').value = d.payin_api_key;
        document.getElementById('pi-enabled').checked = d.payin_enabled === '1';
      }
    } catch (_) {}

    document.getElementById('payout-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      showLoading();
      try {
        await apiCall('/admin/payout-settings', { method: 'PUT', body: { payout_api_url: document.getElementById('po-url').value.trim(), payout_api_key: document.getElementById('po-key').value.trim(), payout_merchant_id: document.getElementById('po-merchant').value.trim(), payout_enabled: document.getElementById('po-enabled').checked } });
        showToast('Payout settings saved.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
      finally { hideLoading(); }
    });

    document.getElementById('payin-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      showLoading();
      try {
        await apiCall('/admin/payout-settings', { method: 'PUT', body: { payin_api_url: document.getElementById('pi-url').value.trim(), payin_api_key: document.getElementById('pi-key').value.trim(), payin_enabled: document.getElementById('pi-enabled').checked } });
        showToast('Pay-in settings saved.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
      finally { hideLoading(); }
    });
  });

  /* ────────────────────────────────────────────
     29. Initialization
     ──────────────────────────────────────────── */

  window.printReceipt = function(data) {
    var receiptWindow = window.open('', '_blank', 'width=400,height=600');
    receiptWindow.document.write('<html><head><title>Transaction Receipt - RSRecharge</title><style>body{font-family:monospace;padding:20px;font-size:12px;} .header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:10px;} .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #ccc;} .footer{text-align:center;margin-top:20px;border-top:2px solid #333;padding-top:10px;font-size:10px;} .success{color:green;font-weight:bold;} .failed{color:red;font-weight:bold;} .pending{color:orange;font-weight:bold;}</style></head><body>');
    receiptWindow.document.write('<div class="header"><h2>RSRecharge</h2><p>Transaction Receipt</p><p>rsrecharge.in</p></div>');
    receiptWindow.document.write('<div class="row"><span>Transaction ID:</span><span>' + data.id + '</span></div>');
    receiptWindow.document.write('<div class="row"><span>Service:</span><span>' + data.type + '</span></div>');
    receiptWindow.document.write('<div class="row"><span>Operator:</span><span>' + data.operator + '</span></div>');
    receiptWindow.document.write('<div class="row"><span>Number:</span><span>' + data.number + '</span></div>');
    receiptWindow.document.write('<div class="row"><span>Amount:</span><span>₹' + data.amount + '</span></div>');
    receiptWindow.document.write('<div class="row"><span>Status:</span><span class="' + data.status + '">' + data.status.toUpperCase() + '</span></div>');
    receiptWindow.document.write('<div class="row"><span>Date:</span><span>' + data.date + '</span></div>');
    receiptWindow.document.write('<div class="footer"><p>Thank you for using RSRecharge</p><p>Support: support@rsrecharge.in</p></div>');
    receiptWindow.document.write('</body></html>');
    receiptWindow.document.close();
    receiptWindow.print();
  };

  function init() {
    if (isLoggedIn()) {
      initSocket();
      updateNotifBadge();
      setInterval(updateNotifBadge, 60000);
    }

    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('print-receipt')) {
        var btn = e.target;
        window.printReceipt({
          id: btn.dataset.id,
          type: btn.dataset.type,
          operator: btn.dataset.op,
          number: btn.dataset.number,
          amount: btn.dataset.amount,
          status: btn.dataset.status,
          date: btn.dataset.date ? formatDateTime(btn.dataset.date) : ''
        });
      }
    });

    if (!window.location.hash) {
      window.location.hash = isLoggedIn() ? '#dashboard' : '#login';
    }
    navigate();
  }

  /* Expose for global use */
  window.showToast = showToast;
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;
  window.formatINR = formatINR;
  window.formatDate = formatDate;
  window.formatDateTime = formatDateTime;

  document.addEventListener('DOMContentLoaded', init);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  }

})();
