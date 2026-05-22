const Attendance = require('../models/Attendance');
const User = require('../models/User');

// @desc    Check-in / Start Shift
// @route   POST /api/attendance/check-in
// @access  Private/Employee
const checkIn = async (req, res) => {
  const userId = req.user._id;
  const today = new Date().toISOString().split('T')[0];
  const { latitude, longitude, batteryLevel } = req.body;

  try {
    let attendance = await Attendance.findOne({ user: userId, date: today });

    const logEntry = {
      type: 'IN',
      timestamp: new Date(),
      location: latitude && longitude ? { type: 'Point', coordinates: [longitude, latitude] } : undefined,
      batteryLevel,
    };

    if (attendance) {
      if (!attendance.checkOut) {
        return res.status(400).json({ success: false, message: 'Already checked in today' });
      }
      
      // Shift Resume: If they have checked out but click check-in again, let them resume!
      attendance.checkOut = undefined;
      attendance.logs.push(logEntry);
      await attendance.save();

      // Mark user status as online and save battery level
      await User.findByIdAndUpdate(
        userId,
        { status: 'online', batteryLevel: batteryLevel !== undefined ? batteryLevel : 100 }
      );

      // Broadcast status and location change to all Admin sockets instantly
      const io = req.app.get('io');
      if (io) {
        io.to('admin').emit('employee-status-changed', { userId, status: 'online' });
        if (latitude && longitude) {
          io.to('admin').emit('location-broadcast', {
            userId,
            coordinates: [longitude, latitude],
            batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
            speed: 0,
            status: 'online',
            updatedAt: new Date(),
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Shift resumed successfully.',
        data: attendance,
      });
    }

    attendance = await Attendance.create({
      user: userId,
      date: today,
      checkIn: new Date(),
      logs: [logEntry],
    });

    // Mark user status as online and save battery level
    await User.findByIdAndUpdate(
      userId,
      { status: 'online', batteryLevel: batteryLevel !== undefined ? batteryLevel : 100 }
    );

    // Broadcast status and location change to all Admin sockets instantly
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('employee-status-changed', { userId, status: 'online' });
      if (latitude && longitude) {
        io.to('admin').emit('location-broadcast', {
          userId,
          coordinates: [longitude, latitude],
          batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
          speed: 0,
          status: 'online',
          updatedAt: new Date(),
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Successfully checked in. Duty tracking started.',
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check-out / Stop Shift
// @route   POST /api/attendance/check-out
// @access  Private/Employee
const checkOut = async (req, res) => {
  const userId = req.user._id;
  const today = new Date().toISOString().split('T')[0];
  const { latitude, longitude, batteryLevel } = req.body;

  try {
    const attendance = await Attendance.findOne({ user: userId, date: today });

    if (!attendance) {
      return res.status(400).json({ success: false, message: 'You have not checked in today' });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ success: false, message: 'Already checked out today' });
    }

    const logEntry = {
      type: 'OUT',
      timestamp: new Date(),
      location: latitude && longitude ? { type: 'Point', coordinates: [longitude, latitude] } : undefined,
      batteryLevel,
    };

    attendance.checkOut = new Date();
    attendance.logs.push(logEntry);

    // Calculate work duration in minutes
    const diffMs = attendance.checkOut - attendance.checkIn;
    attendance.workDuration = Math.round(diffMs / 60000); // converting to minutes

    await attendance.save();

    // Mark user status as offline and save battery level
    await User.findByIdAndUpdate(
      userId,
      { status: 'offline', batteryLevel: batteryLevel !== undefined ? batteryLevel : 100 }
    );

    // Broadcast status and location change to all Admin sockets instantly
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('employee-status-changed', { userId, status: 'offline' });
      if (latitude && longitude) {
        io.to('admin').emit('location-broadcast', {
          userId,
          coordinates: [longitude, latitude],
          batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
          speed: 0,
          status: 'offline',
          updatedAt: new Date(),
        });
      }
    }

    res.json({
      success: true,
      message: 'Successfully checked out. Duty tracking stopped.',
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user's attendance history
// @route   GET /api/attendance/my-history
// @access  Private/Employee
const getMyHistory = async (req, res) => {
  try {
    const attendance = await Attendance.find({ user: req.user._id }).sort({ date: -1 });
    res.json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all employees attendance reports (for Admin)
// @route   GET /api/attendance/reports
// @access  Private/Admin
const getAttendanceReports = async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD (optional filter)
  const filter = {};
  if (date) {
    filter.date = date;
  }

  try {
    const reports = await Attendance.find(filter)
      .populate('user', 'name employeeId')
      .sort({ date: -1 });
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getMyHistory,
  getAttendanceReports,
};
