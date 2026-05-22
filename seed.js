const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding...');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users.');

    // Seed Admin
    await User.create({
      employeeId: 'ADMIN01',
      name: 'Team Excellent Director',
      password: 'Password123',
      role: 'admin',
      status: 'online',
    });
    console.log('Admin seeded: ID: ADMIN01, Password: Password123');

    // Seed Employees
    await User.create({
      employeeId: 'EMP01',
      name: 'Shashank Kumar',
      password: 'Password123',
      role: 'employee',
      status: 'offline',
      batteryLevel: 94,
    });
    await User.create({
      employeeId: 'EMP02',
      name: 'Ananya Singh',
      password: 'Password123',
      role: 'employee',
      status: 'offline',
      batteryLevel: 18, // trigger low battery alert
    });
    console.log('Employees seeded: EMP01 and EMP02, Password: Password123');

    console.log('Database seeding successfully finished!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
};

seedDatabase();
