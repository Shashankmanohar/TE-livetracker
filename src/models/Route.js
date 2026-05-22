const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    path: [
      {
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        batteryLevel: {
          type: Number,
        },
        speed: {
          type: Number,
        },
      },
    ],
    totalDistance: {
      type: Number, // in meters
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

routeSchema.index({ user: 1, date: 1 }, { unique: true });

const Route = mongoose.model('Route', routeSchema);

module.exports = Route;
