const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getMyHistory, getAttendanceReports } = require('../controllers/attendanceController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/check-in', protect, checkIn);
router.post('/check-out', protect, checkOut);
router.get('/my-history', protect, getMyHistory);
router.get('/reports', protect, adminOnly, getAttendanceReports);

module.exports = router;
