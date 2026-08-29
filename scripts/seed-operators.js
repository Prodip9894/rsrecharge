const db = require('../config/database');

async function seedOperators() {
  try {
    const operators = [
      // Mobile Recharge
      { type: 'mobile_recharge', name: 'Jio', code: 'jio', commR: 2.5, commD: 1.5, commMD: 0.75, sort: 1 },
      { type: 'mobile_recharge', name: 'Airtel', code: 'airtel', commR: 2.0, commD: 1.2, commMD: 0.6, sort: 2 },
      { type: 'mobile_recharge', name: 'Vi (Vodafone Idea)', code: 'vi', commR: 2.2, commD: 1.3, commMD: 0.65, sort: 3 },
      { type: 'mobile_recharge', name: 'BSNL', code: 'bsnl', commR: 3.0, commD: 1.8, commMD: 0.9, sort: 4 },
      { type: 'mobile_recharge', name: 'MTNL', code: 'mtnl', commR: 3.0, commD: 1.8, commMD: 0.9, sort: 5 },
      
      // DTH Recharge
      { type: 'dth_recharge', name: 'Tata Play', code: 'tataplay', commR: 2.0, commD: 1.0, commMD: 0.5, sort: 1 },
      { type: 'dth_recharge', name: 'Airtel Digital TV', code: 'airteldth', commR: 2.0, commD: 1.0, commMD: 0.5, sort: 2 },
      { type: 'dth_recharge', name: 'Dish TV', code: 'dishtv', commR: 2.0, commD: 1.0, commMD: 0.5, sort: 3 },
      { type: 'dth_recharge', name: 'Videocon D2H', code: 'd2h', commR: 2.0, commD: 1.0, commMD: 0.5, sort: 4 },
      
      // Electricity
      { type: 'electricity', name: 'Delhi Vidyut Board', code: 'djb', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 1 },
      { type: 'electricity', name: 'Mumbai Adani Electricity', code: 'adani', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 2 },
      { type: 'electricity', name: 'Tata Power', code: 'tatapower', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 3 },
      { type: 'electricity', name: 'BEST Mumbai', code: 'best', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 4 },
      { type: 'electricity', name: 'BESCOM Bangalore', code: 'bescom', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 5 },
      { type: 'electricity', name: 'MSEB Maharashtra', code: 'msedcl', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 6 },
      { type: 'electricity', name: 'UPPCL Uttar Pradesh', code: 'uppcl', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 7 },
      { type: 'electricity', name: 'KSEB Kerala', code: 'kseb', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 8 },
      { type: 'electricity', name: 'MPEB Madhya Pradesh', code: 'mpeb', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 9 },
      
      // Gas
      { type: 'gas', name: 'Indraprasth Gas (IGL)', code: 'igl', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 1 },
      { type: 'gas', name: 'Maharashtra Gas (MGL)', code: 'mgl', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 2 },
      { type: 'gas', name: 'Gujarat Gas (GGL)', code: 'ggl', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 3 },
      
      // Water
      { type: 'water', name: 'Delhi Jal Board', code: 'djb_water', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 1 },
      { type: 'water', name: 'BWSSB Bangalore', code: 'bwssb', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 2 },
      
      // Broadband
      { type: 'broadband', name: 'Jio Fiber', code: 'jiofiber', commR: 1.5, commD: 0.8, commMD: 0.4, sort: 1 },
      { type: 'broadband', name: 'Airtel Broadband', code: 'airtelbb', commR: 1.5, commD: 0.8, commMD: 0.4, sort: 2 },
      { type: 'broadband', name: 'BSNL Broadband', code: 'bsnlbb', commR: 1.5, commD: 0.8, commMD: 0.4, sort: 3 },
      { type: 'broadband', name: 'ACT Fibernet', code: 'act', commR: 1.5, commD: 0.8, commMD: 0.4, sort: 4 },
      { type: 'broadband', name: 'Tata Play Fiber', code: 'tataplayfiber', commR: 1.5, commD: 0.8, commMD: 0.4, sort: 5 },
      
      // Landline
      { type: 'landline', name: 'BSNL Landline', code: 'bsnlll', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 1 },
      { type: 'landline', name: 'Airtel Landline', code: 'airtelll', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 2 },
      
      // LIC Premium
      { type: 'lic_premium', name: 'LIC Premium', code: 'lic', commR: 1.0, commD: 0.5, commMD: 0.25, sort: 1 },
      
      // FASTag
      { type: 'fastag', name: 'NHAI FASTag', code: 'nhai', commR: 1.5, commD: 0.8, commMD: 0.4, sort: 1 },
      { type: 'fastag', name: 'Paytm FASTag', code: 'paytmfastag', commR: 1.5, commD: 0.8, commMD: 0.4, sort: 2 },
      { type: 'fastag', name: 'ICICI FASTag', code: 'icicifastag', commR: 1.5, commD: 0.8, commMD: 0.4, sort: 3 },
      
      // Insurance
      { type: 'motor_insurance', name: 'Two Wheeler Insurance', code: 'twowheeler', commR: 5.0, commD: 3.0, commMD: 1.5, sort: 1 },
      { type: 'motor_insurance', name: 'Four Wheeler Insurance', code: 'fourwheeler', commR: 5.0, commD: 3.0, commMD: 1.5, sort: 2 },
      
      // Bank Account
      { type: 'bank_account', name: 'Savings Account', code: 'savings', commR: 10.0, commD: 5.0, commMD: 2.5, sort: 1 },
      
      // Loan Repayment
      { type: 'loan_repayment', name: 'Home Loan EMI', code: 'homeloan', commR: 0.5, commD: 0.25, commMD: 0.1, sort: 1 },
      { type: 'loan_repayment', name: 'Personal Loan EMI', code: 'personalloan', commR: 0.5, commD: 0.25, commMD: 0.1, sort: 2 },
      { type: 'loan_repayment', name: 'Car Loan EMI', code: 'carloan', commR: 0.5, commD: 0.25, commMD: 0.1, sort: 3 },
      { type: 'loan_repayment', name: 'Education Loan EMI', code: 'eduloan', commR: 0.5, commD: 0.25, commMD: 0.1, sort: 4 },
      
      // Credit Card
      { type: 'credit_card', name: 'Apply Credit Card', code: 'creditcard', commR: 50.0, commD: 25.0, commMD: 10.0, sort: 1 }
    ];

    for (const op of operators) {
      await db.query(
        `INSERT IGNORE INTO service_operators (service_type, operator_name, operator_code, commission_retailer, commission_distributor, commission_md, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [op.type, op.name, op.code, op.commR, op.commD, op.commMD, op.sort]
      );
    }
    
    console.log(`✅ Seeded ${operators.length} operators`);
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seedOperators();
