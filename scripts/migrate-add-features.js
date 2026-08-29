const mysql = require('mysql2/promise');
require('dotenv').config();

function getSSLConfig() {
  if (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) {
    return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  }
  return undefined;
}

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'rsrecharge_db',
      port: parseInt(process.env.DB_PORT) || 3306,
      ssl: getSSLConfig()
    });

    console.log('Connected to database');

    // Banners table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        image_url VARCHAR(500) DEFAULT '',
        link_url VARCHAR(500) DEFAULT '',
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        target_role VARCHAR(50) DEFAULT 'all',
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ banners table created');

    // Move to bank requests
    await connection.query(`
      CREATE TABLE IF NOT EXISTS move_to_bank_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        bank_name VARCHAR(100) DEFAULT '',
        account_number VARCHAR(30) DEFAULT '',
        ifsc_code VARCHAR(20) DEFAULT '',
        account_holder_name VARCHAR(100) DEFAULT '',
        utr_number VARCHAR(50) DEFAULT '',
        status ENUM('pending','approved','rejected','processed') DEFAULT 'pending',
        remarks TEXT,
        processed_by INT DEFAULT NULL,
        processed_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_mtb_user (user_id),
        INDEX idx_mtb_status (status)
      )
    `);
    console.log('✅ move_to_bank_requests table created');

    // Operator offers / R-offers
    await connection.query(`
      CREATE TABLE IF NOT EXISTS operator_offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        operator_code VARCHAR(50) NOT NULL,
        service_type VARCHAR(50) NOT NULL DEFAULT 'mobile_recharge',
        offer_name VARCHAR(200) NOT NULL,
        offer_code VARCHAR(50) DEFAULT '',
        amount DECIMAL(12,2) NOT NULL,
        validity VARCHAR(50) DEFAULT '',
        description TEXT,
        talktime VARCHAR(50) DEFAULT '',
        data VARCHAR(50) DEFAULT '',
        sms VARCHAR(50) DEFAULT '',
        offer_type ENUM('regular','r_offer','special','cashback') DEFAULT 'regular',
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_offers_operator (operator_code, service_type)
      )
    `);
    console.log('✅ operator_offers table created');

    // Manual QR payments
    await connection.query(`
      CREATE TABLE IF NOT EXISTS manual_qr_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        utr_number VARCHAR(50) DEFAULT '',
        payment_screenshot VARCHAR(255) DEFAULT '',
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        remarks TEXT,
        approved_by INT DEFAULT NULL,
        approved_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ manual_qr_payments table created');

    // Add system settings for new features
    const newSettings = [
      ['upi_id', 'rsrecharge@upi', 'upi'],
      ['merchant_name', 'RSRecharge', 'upi'],
      ['upi_enabled', '1', 'upi'],
      ['wa_api_url', '', 'whatsapp'],
      ['wa_api_key', '', 'whatsapp'],
      ['wa_sender', '919999999999', 'whatsapp'],
      ['wa_enabled', '0', 'whatsapp'],
      ['wa_template_id', '', 'whatsapp'],
      ['payout_api_url', '', 'payout'],
      ['payout_api_key', '', 'payout'],
      ['payout_merchant_id', '', 'payout'],
      ['payout_enabled', '0', 'payout'],
      ['payin_api_url', '', 'payout'],
      ['payin_api_key', '', 'payout'],
      ['payin_enabled', '0', 'payout'],
      ['auto_operator_detection', '1', 'recharge'],
      ['r_offer_enabled', '1', 'recharge'],
      ['move_to_bank_enabled', '1', 'wallet'],
      ['move_to_bank_min', '100', 'wallet'],
      ['move_to_bank_charge', '0', 'wallet']
    ];

    for (const [key, value, group] of newSettings) {
      await connection.query(
        `INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_group) VALUES (?, ?, ?)`,
        [key, value, group]
      );
    }
    console.log('✅ New system settings added');

    // Seed some sample offers for Jio
    const sampleOffers = [
      ['jio', 'mobile_recharge', 'Jio ₹199 Plan', 'JIO199', 199, '28 Days', 'Unlimited calls + 2GB/day', 'Unlimited', '2GB/Day', '100'],
      ['jio', 'mobile_recharge', 'Jio ₹299 Plan', 'JIO299', 299, '28 Days', 'Unlimited calls + 2.5GB/day', 'Unlimited', '2.5GB/Day', '100'],
      ['jio', 'mobile_recharge', 'Jio ₹599 Plan', 'JIO599', 599, '56 Days', 'Unlimited calls + 2GB/day', 'Unlimited', '2GB/Day', '100'],
      ['jio', 'mobile_recharge', 'Jio ₹999 Plan', 'JIO999', 999, '84 Days', 'Unlimited calls + 2GB/day', 'Unlimited', '2GB/Day', '100'],
      ['jio', 'mobile_recharge', 'Jio ₹2399 Plan', 'JIO2399', 2399, '365 Days', 'Unlimited calls + 2GB/day', 'Unlimited', '2GB/Day', '100'],
      ['airtel', 'mobile_recharge', 'Airtel ₹179 Plan', 'AIR179', 179, '28 Days', 'Unlimited calls + 2GB/day', 'Unlimited', '2GB/Day', '100'],
      ['airtel', 'mobile_recharge', 'Airtel ₹299 Plan', 'AIR299', 299, '28 Days', 'Unlimited calls + 2.5GB/day', 'Unlimited', '2.5GB/Day', '100'],
      ['airtel', 'mobile_recharge', 'Airtel ₹479 Plan', 'AIR479', 479, '56 Days', 'Unlimited calls + 1.5GB/day', 'Unlimited', '1.5GB/Day', '100'],
      ['vi', 'mobile_recharge', 'Vi ₹179 Plan', 'VI179', 179, '28 Days', 'Unlimited calls + 2GB/day', 'Unlimited', '2GB/Day', '100'],
      ['vi', 'mobile_recharge', 'Vi ₹449 Plan', 'VI449', 449, '56 Days', 'Unlimited calls + 4GB/day', 'Unlimited', '4GB/Day', '100'],
      ['bsnl', 'mobile_recharge', 'BSNL ₹187 Plan', 'BSN187', 187, '28 Days', 'Unlimited calls + 2GB/day', 'Unlimited', '2GB/Day', '100'],
      ['bsnl', 'mobile_recharge', 'BSNL ₹319 Plan', 'BSN319', 319, '56 Days', 'Unlimited calls + 2GB/day', 'Unlimited', '2GB/Day', '100'],
    ];

    for (const [opCode, svcType, name, code, amount, validity, desc, talktime, data, sms] of sampleOffers) {
      await connection.query(
        `INSERT IGNORE INTO operator_offers (operator_code, service_type, offer_name, offer_code, amount, validity, description, talktime, data, sms, offer_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'regular')`,
        [opCode, svcType, name, code, amount, validity, desc, talktime, data, sms]
      );
    }
    console.log('✅ Sample operator offers seeded');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();