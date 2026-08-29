const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    console.log('Connected to MySQL server');

    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'rsrecharge_db'} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${process.env.DB_NAME || 'rsrecharge_db'}`);

    console.log('Database created/selected');

    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        mobile VARCHAR(15) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin','master_distributor','distributor','retailer') NOT NULL DEFAULT 'retailer',
        parent_id INT DEFAULT NULL,
        company_name VARCHAR(150) DEFAULT '',
        gst_number VARCHAR(20) DEFAULT '',
        pan_number VARCHAR(20) DEFAULT '',
        address TEXT,
        city VARCHAR(100) DEFAULT '',
        state VARCHAR(100) DEFAULT '',
        pincode VARCHAR(10) DEFAULT '',
        profile_image VARCHAR(255) DEFAULT '',
        is_active TINYINT(1) DEFAULT 1,
        is_verified TINYINT(1) DEFAULT 0,
        email_verified TINYINT(1) DEFAULT 0,
        mobile_verified TINYINT(1) DEFAULT 0,
        last_login DATETIME DEFAULT NULL,
        login_attempts INT DEFAULT 0,
        locked_until DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_role (role),
        INDEX idx_parent (parent_id),
        INDEX idx_mobile (mobile),
        INDEX idx_user_id (user_id)
      )
    `);

    // Wallets table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        balance DECIMAL(12,2) DEFAULT 0.00,
        locked_balance DECIMAL(12,2) DEFAULT 0.00,
        total_recharged DECIMAL(12,2) DEFAULT 0.00,
        total_commission_earned DECIMAL(12,2) DEFAULT 0.00,
        total_withdrawn DECIMAL(12,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uk_wallet_user (user_id)
      )
    `);

    // Wallet transactions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('credit','debit') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        balance_before DECIMAL(12,2) DEFAULT 0.00,
        balance_after DECIMAL(12,2) DEFAULT 0.00,
        description VARCHAR(255) DEFAULT '',
        reference_type VARCHAR(50) DEFAULT '',
        reference_id VARCHAR(50) DEFAULT '',
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_date (user_id, created_at)
      )
    `);

    // Transactions (recharges, bill payments, etc.)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(30) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        operator VARCHAR(100) DEFAULT '',
        operator_code VARCHAR(50) DEFAULT '',
        customer_number VARCHAR(30) NOT NULL,
        customer_name VARCHAR(100) DEFAULT '',
        amount DECIMAL(12,2) NOT NULL,
        convenience_fee DECIMAL(8,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL,
        commission_rate DECIMAL(5,2) DEFAULT 0.00,
        commission_amount DECIMAL(12,2) DEFAULT 0.00,
        status ENUM('pending','success','failed','reversed','processing') DEFAULT 'pending',
        api_reference VARCHAR(100) DEFAULT '',
        api_response TEXT,
        failure_reason VARCHAR(255) DEFAULT '',
        refunded TINYINT(1) DEFAULT 0,
        refund_amount DECIMAL(12,2) DEFAULT 0.00,
        ip_address VARCHAR(45) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_service (user_id, service_type),
        INDEX idx_status (status),
        INDEX idx_date (created_at),
        INDEX idx_transaction_id (transaction_id)
      )
    `);

    // API providers
    await connection.query(`
      CREATE TABLE IF NOT EXISTS api_providers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        base_url VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) DEFAULT '',
        api_secret VARCHAR(255) DEFAULT '',
        username VARCHAR(100) DEFAULT '',
        password VARCHAR(255) DEFAULT '',
        callback_url VARCHAR(255) DEFAULT '',
        services_supported JSON DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        priority INT DEFAULT 1,
        balance DECIMAL(12,2) DEFAULT 0.00,
        last_balance_check DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Service master (operators/plans)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS service_operators (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_type VARCHAR(50) NOT NULL,
        operator_name VARCHAR(100) NOT NULL,
        operator_code VARCHAR(50) NOT NULL,
        logo VARCHAR(255) DEFAULT '',
        is_active TINYINT(1) DEFAULT 1,
        commission_retailer DECIMAL(5,2) DEFAULT 0.00,
        commission_distributor DECIMAL(5,2) DEFAULT 0.00,
        commission_md DECIMAL(5,2) DEFAULT 0.00,
        api_provider_id INT DEFAULT NULL,
        api_operator_code VARCHAR(50) DEFAULT '',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (api_provider_id) REFERENCES api_providers(id) ON DELETE SET NULL
      )
    `);

    // AEPS transactions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aeps_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(30) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        aadhaar_number VARCHAR(12) NOT NULL,
        customer_name VARCHAR(100) DEFAULT '',
        mobile VARCHAR(15) DEFAULT '',
        transaction_type ENUM('deposit','withdraw','mini_statement','balance_enquiry','cash_withdraw') NOT NULL,
        amount DECIMAL(12,2) DEFAULT 0.00,
        bank_code VARCHAR(20) DEFAULT '',
        bank_name VARCHAR(100) DEFAULT '',
        status ENUM('pending','success','failed') DEFAULT 'pending',
        api_reference VARCHAR(100) DEFAULT '',
        api_response TEXT,
        iref_number VARCHAR(100) DEFAULT '',
        rrn VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_aeps_user (user_id),
        INDEX idx_aeps_date (created_at)
      )
    `);

    // DMT transactions (money transfer)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS dmt_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(30) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        sender_name VARCHAR(100) DEFAULT '',
        sender_mobile VARCHAR(15) NOT NULL,
        sender_aadhaar VARCHAR(12) DEFAULT '',
        beneficiary_name VARCHAR(100) NOT NULL,
        beneficiary_account VARCHAR(30) NOT NULL,
        beneficiary_ifsc VARCHAR(20) NOT NULL,
        beneficiary_bank VARCHAR(100) DEFAULT '',
        amount DECIMAL(12,2) NOT NULL,
        charge DECIMAL(8,2) DEFAULT 0.00,
        gst DECIMAL(8,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL,
        transfer_mode ENUM('imps','neft','rtgs') DEFAULT 'imps',
        status ENUM('pending','success','failed','reversed') DEFAULT 'pending',
        api_reference VARCHAR(100) DEFAULT '',
        api_response TEXT,
        utr_number VARCHAR(50) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_dmt_user (user_id),
        INDEX idx_dmt_date (created_at)
      )
    `);

    // Beneficiaries (for DMT)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS dmt_beneficiaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        sender_mobile VARCHAR(15) NOT NULL,
        beneficiary_name VARCHAR(100) NOT NULL,
        beneficiary_account VARCHAR(30) NOT NULL,
        beneficiary_ifsc VARCHAR(20) NOT NULL,
        beneficiary_bank VARCHAR(100) DEFAULT '',
        is_verified TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_beneficiary_user (user_id)
      )
    `);

    // Insurance
    await connection.query(`
      CREATE TABLE IF NOT EXISTS insurance_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(30) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        insurance_type VARCHAR(50) NOT NULL,
        vehicle_number VARCHAR(20) DEFAULT '',
        vehicle_type VARCHAR(50) DEFAULT '',
        registration_date DATE DEFAULT NULL,
        policy_start DATE DEFAULT NULL,
        policy_end DATE DEFAULT NULL,
        idv DECIMAL(12,2) DEFAULT 0.00,
        premium DECIMAL(12,2) DEFAULT 0.00,
        customer_name VARCHAR(100) DEFAULT '',
        customer_mobile VARCHAR(15) DEFAULT '',
        customer_email VARCHAR(100) DEFAULT '',
        status ENUM('quote','applied','approved','rejected') DEFAULT 'quote',
        api_reference VARCHAR(100) DEFAULT '',
        api_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Bank accounts
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bank_account_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(30) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        customer_mobile VARCHAR(15) NOT NULL,
        customer_email VARCHAR(100) DEFAULT '',
        aadhaar_number VARCHAR(12) NOT NULL,
        pan_number VARCHAR(20) DEFAULT '',
        bank_name VARCHAR(100) NOT NULL,
        account_type VARCHAR(50) DEFAULT 'savings',
        address TEXT,
        city VARCHAR(100) DEFAULT '',
        state VARCHAR(100) DEFAULT '',
        pincode VARCHAR(10) DEFAULT '',
        nominee_name VARCHAR(100) DEFAULT '',
        nominee_relation VARCHAR(50) DEFAULT '',
        status ENUM('applied','processing','approved','rejected','account_opened') DEFAULT 'applied',
        api_reference VARCHAR(100) DEFAULT '',
        api_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Loan repayments
    await connection.query(`
      CREATE TABLE IF NOT EXISTS loan_repayments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(30) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        customer_name VARCHAR(100) DEFAULT '',
        customer_mobile VARCHAR(15) DEFAULT '',
        lender_name VARCHAR(100) NOT NULL,
        loan_account_number VARCHAR(30) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        charge DECIMAL(8,2) DEFAULT 0.00,
        status ENUM('pending','success','failed') DEFAULT 'pending',
        api_reference VARCHAR(100) DEFAULT '',
        api_response TEXT,
        receipt_number VARCHAR(50) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Credit card applications
    await connection.query(`
      CREATE TABLE IF NOT EXISTS credit_card_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(30) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        customer_mobile VARCHAR(15) NOT NULL,
        customer_email VARCHAR(100) DEFAULT '',
        aadhaar_number VARCHAR(12) NOT NULL,
        pan_number VARCHAR(20) NOT NULL,
        income DECIMAL(12,2) DEFAULT 0.00,
        employment_type VARCHAR(50) DEFAULT '',
        bank_name VARCHAR(100) DEFAULT '',
        card_type VARCHAR(50) DEFAULT '',
        address TEXT,
        city VARCHAR(100) DEFAULT '',
        state VARCHAR(100) DEFAULT '',
        pincode VARCHAR(10) DEFAULT '',
        status ENUM('applied','processing','approved','rejected','card_dispatched') DEFAULT 'applied',
        api_reference VARCHAR(100) DEFAULT '',
        api_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Notifications
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info','success','warning','error') DEFAULT 'info',
        is_read TINYINT(1) DEFAULT 0,
        link VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notif_user (user_id, is_read)
      )
    `);

    // System settings
    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_group VARCHAR(50) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Audit logs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) DEFAULT '',
        entity_id VARCHAR(50) DEFAULT '',
        old_value TEXT,
        new_value TEXT,
        ip_address VARCHAR(45) DEFAULT '',
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_user (user_id),
        INDEX idx_audit_date (created_at)
      )
    `);

    // Commission rules
    await connection.query(`
      CREATE TABLE IF NOT EXISTS commission_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_type VARCHAR(50) NOT NULL,
        operator_code VARCHAR(50) DEFAULT '',
        role ENUM('retailer','distributor','master_distributor') NOT NULL,
        commission_type ENUM('percentage','flat') DEFAULT 'percentage',
        commission_value DECIMAL(8,2) NOT NULL,
        min_amount DECIMAL(12,2) DEFAULT 0.00,
        max_amount DECIMAL(12,2) DEFAULT 999999.00,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // UPI QR codes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS upi_qr_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        qr_image VARCHAR(255) DEFAULT '',
        upi_id VARCHAR(100) NOT NULL,
        merchant_name VARCHAR(100) DEFAULT '',
        amount DECIMAL(12,2) DEFAULT 0.00,
        status ENUM('active','expired','used') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Insert default admin
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10);
    const adminUserId = 'ADM' + Date.now().toString().slice(-6);

    await connection.query(`
      INSERT IGNORE INTO users (user_id, name, email, mobile, password, role, is_active, is_verified)
      VALUES (?, 'Super Admin', ?, ?, ?, 'admin', 1, 1)
    `, [adminUserId, process.env.ADMIN_EMAIL || 'admin@rsrecharge.in', process.env.ADMIN_MOBILE || '9999999999', adminPassword]);

    // Get admin id
    const [adminRows] = await connection.query('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
    if (adminRows.length > 0) {
      await connection.query(`
        INSERT IGNORE INTO wallets (user_id, balance) VALUES (?, 0.00)
      `, [adminRows[0].id]);
    }

    // Insert default system settings
    const defaultSettings = [
      ['site_name', 'RSRecharge', 'general'],
      ['site_url', 'https://rsrecharge.in', 'general'],
      ['site_email', 'support@rsrecharge.in', 'general'],
      ['site_mobile', '9999999999', 'general'],
      ['currency', 'INR', 'general'],
      ['min_recharge', '10', 'recharge'],
      ['max_recharge', '10000', 'recharge'],
      ['recharge_commission', '2.5', 'commission'],
      ['aeps_commission', '1.5', 'commission'],
      ['dmt_commission', '1.0', 'commission'],
      ['registration_open', '1', 'general'],
      ['maintenance_mode', '0', 'general'],
      ['sms_enabled', '0', 'notification'],
      ['email_enabled', '0', 'notification'],
      ['auto_approve_retailer', '1', 'approval'],
      ['auto_approve_distributor', '0', 'approval'],
      ['auto_approve_md', '0', 'approval']
    ];

    for (const [key, value, group] of defaultSettings) {
      await connection.query(`
        INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_group)
        VALUES (?, ?, ?)
      `, [key, value, group]);
    }

    // Insert default operators
    const operators = [
      ['mobile_recharge', 'Jio', 'jio', 1, 2.50, 1.50, 0.75],
      ['mobile_recharge', 'Airtel', 'airtel', 2, 2.00, 1.20, 0.60],
      ['mobile_recharge', 'Vi (Vodafone Idea)', 'vi', 3, 2.20, 1.30, 0.65],
      ['mobile_recharge', 'BSNL', 'bsnl', 4, 3.00, 1.80, 0.90],
      ['mobile_recharge', 'MTNL', 'mtnl', 5, 3.00, 1.80, 0.90],
      ['dth_recharge', 'Tata Play', 'tataplay', 1, 2.00, 1.00, 0.50],
      ['dth_recharge', 'Airtel Digital TV', 'airteldth', 2, 2.00, 1.00, 0.50],
      ['dth_recharge', 'Dish TV', 'dishtv', 3, 2.00, 1.00, 0.50],
      ['dth_recharge', 'Videocon D2H', 'd2h', 4, 2.00, 1.00, 0.50],
      ['electricity', 'Delhi Electricity', 'djb', 1, 1.00, 0.50, 0.25],
      ['electricity', 'Mumbai Electricity', 'adani', 2, 1.00, 0.50, 0.25],
      ['gas', 'Delhi Gas', 'igl', 1, 1.00, 0.50, 0.25],
      ['water', 'Delhi Jal Board', 'djb_water', 1, 1.00, 0.50, 0.25],
      ['broadband', 'Jio Fiber', 'jiofiber', 1, 1.00, 0.50, 0.25],
      ['broadband', 'Airtel Broadband', 'airtelbb', 2, 1.00, 0.50, 0.25],
      ['lic_premium', 'LIC Premium', 'lic', 1, 1.00, 0.50, 0.25],
      ['fastag', 'FASTag', 'fastag', 1, 1.00, 0.50, 0.25]
    ];

    for (const [type, name, code, sort, commR, commD, commMD] of operators) {
      await connection.query(`
        INSERT IGNORE INTO service_operators (service_type, operator_name, operator_code, sort_order, commission_retailer, commission_distributor, commission_md)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [type, name, code, sort, commR, commD, commMD]);
    }

    console.log('✅ Database setup completed successfully!');
    console.log('📊 Tables created: users, wallets, wallet_transactions, transactions, api_providers, service_operators, aeps_transactions, dmt_transactions, dmt_beneficiaries, insurance_quotes, bank_account_applications, loan_repayments, credit_card_applications, notifications, system_settings, audit_logs, commission_rules, upi_qr_codes');
    console.log('👤 Default admin created - Email: ' + (process.env.ADMIN_EMAIL || 'admin@rsrecharge.in') + ' Password: ' + (process.env.ADMIN_PASSWORD || 'Admin@12345'));

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

setupDatabase();
