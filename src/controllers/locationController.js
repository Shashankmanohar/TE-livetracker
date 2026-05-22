const Location = require('../models/Location');
const User = require('../models/User');
const Route = require('../models/Route');
const Alert = require('../models/Alert');

// Helper function to calculate distance using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
};

// @desc    Record/Update employee location
// @route   POST /api/location/update
// @access  Private/Employee
const updateLocation = async (req, res) => {
  const { latitude, longitude, batteryLevel, speed, heading, accuracy, isMoving } = req.body;
  const userId = req.user._id;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
  }

  try {
    // 1. Save to Location collection (for granular history)
    const newLocation = await Location.create({
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

    // 2. Update User's status and lastKnownLocation
    const user = await User.findById(userId);
    if (user) {
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

      if (batteryLevel !== undefined) {
        user.batteryLevel = batteryLevel;
      }
      await user.save();

      // Emit real-time location and battery broadcast to all connected Admin sockets
      const io = req.app.get('io');
      if (io) {
        io.to('admin').emit('location-broadcast', {
          userId,
          coordinates: [longitude, latitude],
          batteryLevel: batteryLevel !== undefined ? batteryLevel : user.batteryLevel,
          speed: speed || 0,
          status: newStatus,
          idleStartedAt: user.idleStartedAt,
          updatedAt: new Date(),
        });
      }
    }

    // 3. Update Route / Path history for the day
    const today = new Date().toISOString().split('T')[0];
    let route = await Route.findOne({ user: userId, date: today });

    let distanceIncrement = 0;
    if (!route) {
      route = new Route({
        user: userId,
        date: today,
        path: [
          {
            coordinates: [longitude, latitude],
            batteryLevel,
            speed,
            timestamp: new Date(),
          },
        ],
      });
    } else {
      // Calculate distance between last point and new point
      const lastPoint = route.path[route.path.length - 1];
      if (lastPoint) {
        const lastLon = lastPoint.coordinates[0];
        const lastLat = lastPoint.coordinates[1];
        distanceIncrement = calculateDistance(lastLat, lastLon, latitude, longitude);
      }

      route.path.push({
        coordinates: [longitude, latitude],
        batteryLevel,
        speed,
        timestamp: new Date(),
      });
      route.totalDistance += distanceIncrement;
    }
    await route.save();

    // 4. Unusual Stay Detection
    // Check if the user has been stagnant (moving < 20 meters in the last 20 minutes)
    // Find the route history for the last 20 mins to analyze
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
    const recentPoints = route.path.filter(p => p.timestamp >= twentyMinsAgo);

    if (recentPoints.length >= 3) {
      let isStagnant = true;
      const anchorPoint = recentPoints[0];

      for (let i = 1; i < recentPoints.length; i++) {
        const dist = calculateDistance(
          anchorPoint.coordinates[1],
          anchorPoint.coordinates[0],
          recentPoints[i].coordinates[1],
          recentPoints[i].coordinates[0]
        );
        // If they moved further than 100m, they are not stagnant
        if (dist > 100) {
          isStagnant = false;
          break;
        }
      }

      if (isStagnant) {
        // Check if an active alert for this exists
        const existingAlert = await Alert.findOne({
          user: userId,
          type: 'Idle',
          status: 'active',
          createdAt: { $gte: twentyMinsAgo }
        });

        if (!existingAlert) {
          await Alert.create({
            user: userId,
            type: 'Idle',
            title: 'Suspicious Inactivity',
            message: `${user.name} has remained within 100 meters for more than 20 minutes.`,
            location: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            batteryLevel: batteryLevel || 100,
          });
        }
      }
    }

    // 5. Low Battery Alert Trigger
    if (batteryLevel !== undefined && batteryLevel <= 20) {
      const existingBatteryAlert = await Alert.findOne({
        user: userId,
        type: 'Low-Battery',
        status: 'active',
      });

      if (!existingBatteryAlert) {
        await Alert.create({
          user: userId,
          type: 'Low-Battery',
          title: 'Low Battery Alert',
          message: `${user.name}'s device is low on battery (${batteryLevel}%).`,
          location: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          batteryLevel,
        });
      }
    }

    res.json({
      success: true,
      message: 'Location and path updated successfully',
      data: {
        distanceCoveredToday: route.totalDistance,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get latest locations of all employees
// @route   GET /api/location/latest
// @access  Private/Admin
const getLatestLocations = async (req, res) => {
  try {
    const activeEmployees = await User.find({
      role: 'employee',
      status: { $in: ['online', 'idle'] },
    }).select('name employeeId lastKnownLocation status batteryLevel idleStartedAt updatedAt');

    res.json({ success: true, data: activeEmployees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  updateLocation,
  getLatestLocations,
};
