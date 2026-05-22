const User = require('../models/User');
const Route = require('../models/Route');
const Alert = require('../models/Alert');

// @desc    Get all employees
// @route   GET /api/users/employees
// @access  Private/Admin
const getEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('-password');
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get employee by ID
// @route   GET /api/users/employees/:id
// @access  Private/Admin
const getEmployeeById = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).select('-password');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update employee status or details
// @route   PUT /api/users/employees/:id
// @access  Private/Admin
const updateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    employee.name = req.body.name || employee.name;
    employee.role = req.body.role || employee.role;
    employee.isActive = req.body.isActive !== undefined ? req.body.isActive : employee.isActive;

    const updatedEmployee = await employee.save();
    res.json({
      success: true,
      data: {
        _id: updatedEmployee._id,
        employeeId: updatedEmployee.employeeId,
        name: updatedEmployee.name,
        role: updatedEmployee.role,
        isActive: updatedEmployee.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete employee
// @route   DELETE /api/users/employees/:id
// @access  Private/Admin
const deleteEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Employee removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get routes history of an employee
// @route   GET /api/users/employees/:id/route
// @access  Private/Admin
const getEmployeeRouteHistory = async (req, res) => {
  const { date } = req.query; // Expecting YYYY-MM-DD
  if (!date) {
    return res.status(400).json({ success: false, message: 'Please provide a date query parameter (YYYY-MM-DD)' });
  }

  try {
    const route = await Route.findOne({ user: req.params.id, date });
    if (!route) {
      return res.status(404).json({ success: false, message: 'No route history found for this date' });
    }
    res.json({ success: true, data: route });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get alerts history of an employee
// @route   GET /api/users/employees/:id/alerts
// @access  Private/Admin
const getEmployeeAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ user: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all alerts for admin notification center
// @route   GET /api/users/alerts
// @access  Private/Admin
const getAllAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({})
      .populate('user', 'name employeeId')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete all alerts
// @route   DELETE /api/users/alerts
// @access  Private/Admin
const deleteAllAlerts = async (req, res) => {
  try {
    await Alert.deleteMany({});
    res.json({ success: true, message: 'All alerts deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeRouteHistory,
  getEmployeeAlerts,
  getAllAlerts,
  deleteAllAlerts,
};
