const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
        required: true,
      },
    },
    batteryLevel: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    speed: {
      type: Number,
      default: 0,
    },
    heading: {
      type: Number,
      default: 0,
    },
    accuracy: {
      type: Number,
      default: 0,
    },
    isMoving: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

locationSchema.index({ location: '2dsphere' });
locationSchema.index({ user: 1, timestamp: -1 });

const Location = mongoose.model('Location', locationSchema);

module.exports = Location;
