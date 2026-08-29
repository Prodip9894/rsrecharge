# RSRecharge - Multi Recharge & Bill Payment Platform

Complete multi-recharge business platform for rsrecharge.in

## Features
- Multi-level user management (Admin, Master Distributor, Distributor, Retailer)
- Mobile Recharge, DTH Recharge
- BBPS Bill Payments (Electricity, Gas, Water, Broadband, Landline)
- AEPS (Deposit, Withdraw, Mini Statement, Balance Enquiry)
- DMT (Domestic Money Transfer)
- Motor Insurance
- Bank Account Opening
- Loan Repayment
- Credit Card Application
- UPI QR Payments
- Real-time Notifications (Socket.io)
- Commission Management
- Wallet System with Transfer
- Role Management Console
- Audit Logs
- API Integration Framework

## Setup
```bash
node scripts/setup-complete.js
```

## Start
```bash
npm start
```

## Default Admin
- Email: admin@rsrecharge.in
- Password: Admin@12345

## Environment Variables
Copy `.env.example` to `.env` and configure:
- Database credentials
- JWT secret
- Domain settings
