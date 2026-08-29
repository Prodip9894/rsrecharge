module.exports = {
  ROLES: {
    ADMIN: 'admin',
    MASTER_DISTRIBUTOR: 'master_distributor',
    DISTRIBUTOR: 'distributor',
    RETAILER: 'retailer'
  },
  ROLE_HIERARCHY: {
    admin: 4,
    master_distributor: 3,
    distributor: 2,
    retailer: 1
  },
  SERVICES: {
    MOBILE_RECHARGE: 'mobile_recharge',
    DTH_RECHARGE: 'dth_recharge',
    ELECTRICITY: 'electricity',
    GAS: 'gas',
    WATER: 'water',
    BROADBAND: 'broadband',
    LANDLINE: 'landline',
    LIC_PREMIUM: 'lic_premium',
    FASTAG: 'fastag',
    AEPS: 'aeps',
    DMT: 'dmt',
    MOTOR_INSURANCE: 'motor_insurance',
    BANK_ACCOUNT: 'bank_account',
    LOAN_REPAYMENT: 'loan_repayment',
    CREDIT_CARD: 'credit_card',
    UPI_QR: 'upi_qr'
  },
  TRANSACTION_STATUS: {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
    REVERSED: 'reversed'
  },
  WALLET_TYPES: {
    MAIN: 'main',
    CASHBACK: 'cashback',
    COMMISSION: 'commission'
  }
};