const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['SOS', 'Idle', 'Low-Battery', 'Geofence-Deviation', 'GPS-Disabled'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    batteryLevel: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'ignored'],
      default: 'active',
    },
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

alertSchema.index({ user: 1, createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
