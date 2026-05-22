const express = require('express');
const router = express.Router();
const { updateLocation, getLatestLocations } = require('../controllers/locationController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/update', protect, updateLocation);
router.get('/latest', protect, adminOnly, getLatestLocations);

module.exports = router;
