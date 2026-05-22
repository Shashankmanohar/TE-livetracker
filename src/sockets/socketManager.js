const User = require('../models/User');
const Location = require('../models/Location');
const Route = require('../models/Route');
const Alert = require('../models/Alert');

const socketManager = (io) => {
  // Store connected socket mappings
  const connectedUsers = new Map(); // socket.id -> userId

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Join room based on role
    socket.on('join-session', async ({ userId, role }) => {
      socket.join(role); // joins 'admin' or 'employee' room
      connectedUsers.set(socket.id, userId);
      console.log(`User ${userId} joined as ${role}`);

      // Mark employee online if they connected
      if (role === 'employee') {
        await User.findByIdAndUpdate(userId, { status: 'online' });
        io.to('admin').emit('employee-status-changed', { userId, status: 'online' });
      }
    });

    // Real-time location updates
    socket.on('update-location', async (data) => {
      const { userId, latitude, longitude, batteryLevel, speed, heading, accuracy, isMoving } = data;
      if (!userId) return;

      console.log(`Socket location/battery update from employee ${userId}: lat=${latitude}, lon=${longitude}, bat=${batteryLevel}%`);

      // Broadcast immediately to all connected Admins
      // Save to database and get precise status transitions
      try {
        const user = await User.findById(userId);
        let computedIdleStartedAt = null;
        if (user) {
          if (latitude !== undefined && longitude !== undefined) {
            user.lastKnownLocation = {
              type: 'Point',
              coordinates: [longitude, latitude],
            };
            const newStatus = isMoving ? 'online' : 'idle';
            if (newStatus === 'idle' && user.status !== 'idle') {
              user.idleStartedAt = new Date();
            } else if (newStatus !== 'idle') {
              user.idleStartedAt = null;
            }
            user.status = newStatus;
            computedIdleStartedAt = user.idleStartedAt;
          }
          if (batteryLevel !== undefined) {
            user.batteryLevel = batteryLevel;
          }
          await user.save();
        }

        // Broadcast immediately to all connected Admins
        io.to('admin').emit('location-broadcast', {
          userId,
          coordinates: (longitude !== undefined && latitude !== undefined) ? [longitude, latitude] : undefined,
          batteryLevel,
          speed,
          status: isMoving ? 'online' : 'idle',
          idleStartedAt: computedIdleStartedAt,
          updatedAt: new Date(),
        });

        // Only log coordinate history if lat/lon are defined
        if (latitude !== undefined && longitude !== undefined) {
          await Location.create({
            user: userId,
            location: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            batteryLevel: batteryLevel || 100,
            speed: speed || 0,
            heading: heading || 0,
            accuracy: accuracy || 0,
            isMoving: isMoving || false,
          });

          // Add to Daily Path
          const today = new Date().toISOString().split('T')[0];
          let route = await Route.findOne({ user: userId, date: today });
          if (!route) {
            route = new Route({
              user: userId,
              date: today,
              path: [{ coordinates: [longitude, latitude], timestamp: new Date(), speed, batteryLevel }],
            });
          } else {
            route.path.push({ coordinates: [longitude, latitude], timestamp: new Date(), speed, batteryLevel });
          }
          await route.save();
        }
      } catch (err) {
        console.error('Socket location save/broadcast error:', err.message);
      }
    });

    // SOS Alerts
    socket.on('sos-alert', async (data) => {
      const { userId, latitude, longitude, batteryLevel } = data;
      console.log(`SOS Alert triggered by ${userId}`);

      try {
        const user = await User.findById(userId);
        const userName = user ? user.name : 'Unknown Employee';

        const alert = await Alert.create({
          user: userId,
          type: 'SOS',
          title: 'SOS Emergency Alert',
          message: `${userName} has triggered an SOS alert!`,
          location: latitude && longitude ? { type: 'Point', coordinates: [longitude, latitude] } : undefined,
          batteryLevel,
        });

        // Broadcast to all Admins
        io.to('admin').emit('sos-broadcast', {
          alertId: alert._id,
          userId,
          name: userName,
          coordinates: [longitude, latitude],
          batteryLevel,
          message: alert.message,
          createdAt: alert.createdAt,
        });
      } catch (err) {
        console.error('Socket SOS save error:', err.message);
      }
    });

    // GPS Disabled/Tamper Alert
    socket.on('gps-disabled-alert', async (data) => {
      const { userId, latitude, longitude, batteryLevel } = data;
      console.log(`GPS Disabled Alert triggered by ${userId}`);

      try {
        const user = await User.findById(userId);
        const userName = user ? user.name : 'Unknown Employee';

        const alert = await Alert.create({
          user: userId,
          type: 'GPS-Disabled',
          title: 'GPS Services Disabled',
          message: `WARNING: ${userName} has turned off their device GPS/Location Services!`,
          location: latitude && longitude ? { type: 'Point', coordinates: [longitude, latitude] } : undefined,
          batteryLevel,
        });

        // Broadcast to all Admins so it instantly pops up on their dashboard
        io.to('admin').emit('sos-broadcast', {
          alertId: alert._id,
          userId,
          name: userName,
          coordinates: latitude && longitude ? [longitude, latitude] : undefined,
          batteryLevel,
          message: alert.message,
          createdAt: alert.createdAt,
        });
      } catch (err) {
        console.error('Socket GPS Alert save error:', err.message);
      }
    });

    // Disconnect event
    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);
      const userId = connectedUsers.get(socket.id);

      if (userId) {
        connectedUsers.delete(socket.id);

        try {
          // Check if employee has other open sockets, otherwise set status offline
          // (Simulating basic device-based session management)
          await User.findByIdAndUpdate(userId, { status: 'offline' });
          io.to('admin').emit('employee-status-changed', { userId, status: 'offline' });
        } catch (err) {
          console.error(err.message);
        }
      }
    });
  });
};

module.exports = socketManager;
