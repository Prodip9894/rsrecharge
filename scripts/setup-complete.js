const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 RSRecharge Platform - Complete Setup');
console.log('=======================================');
console.log('');

try {
  // Step 1: Install dependencies
  console.log('📦 Step 1: Installing dependencies...');
  execSync('npm install', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  console.log('✅ Dependencies installed');
  console.log('');

  // Step 2: Setup database
  console.log('🗄️  Step 2: Setting up database...');
  execSync('node scripts/setup-db.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  console.log('');

  // Step 3: Seed operators
  console.log('📡 Step 3: Seeding operators...');
  execSync('node scripts/seed-operators.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  console.log('');

  console.log('=======================================');
  console.log('✅ Setup complete!');
  console.log('');
  console.log('Start the server with: npm start');
  console.log('Default admin login:');
  console.log('  Email: admin@rsrecharge.in');
  console.log('  Password: Admin@12345');
  console.log('');
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}
