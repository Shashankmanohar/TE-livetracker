const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeRouteHistory,
  getEmployeeAlerts,
  getAllAlerts,
  deleteAllAlerts,
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(adminOnly);

router.route('/employees').get(getEmployees);
router.route('/alerts')
  .get(getAllAlerts)
  .delete(deleteAllAlerts);
router.route('/employees/:id')
  .get(getEmployeeById)
  .put(updateEmployee)
  .delete(deleteEmployee);

router.get('/employees/:id/route', getEmployeeRouteHistory);
router.get('/employees/:id/alerts', getEmployeeAlerts);

module.exports = router;
