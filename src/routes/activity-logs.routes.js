const express = require('express');
const router = express.Router();
const activityLogsController = require('../controllers/activity-logs.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');

// All routes require authentication
router.use(authenticate);

// GET / - List activity logs
router.get(
  '/',
  requirePermission('activity_logs.view'),
  activityLogsController.listLogs
);

module.exports = router;
