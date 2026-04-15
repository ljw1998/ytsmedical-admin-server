const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');

// All routes require authentication
router.use(authenticate);

// GET /daily - Daily summary
router.get(
  '/daily',
  requirePermission('dashboard.view'),
  dashboardController.getDailySummary
);

// GET /orders - Order statistics
router.get(
  '/orders',
  requirePermission('dashboard.view'),
  dashboardController.getOrderStats
);

// GET /campaigns - Campaign performance
router.get(
  '/campaigns',
  requirePermission('dashboard.view'),
  dashboardController.getCampaignPerformance
);

// GET /cod - COD analytics
router.get(
  '/cod',
  requirePermission('dashboard.cod'),
  dashboardController.getCodAnalytics
);

// GET /stock - Stock summary
router.get(
  '/stock',
  requirePermission('dashboard.stock'),
  dashboardController.getStockSummary
);

// GET /business - Business overview
router.get(
  '/business',
  requirePermission('dashboard.business'),
  dashboardController.getBusinessOverview
);

module.exports = router;
