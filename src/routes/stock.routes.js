const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const stockController = require('../controllers/stock.controller');
const {
  uuidParam,
  locationIdParam,
  productIdParam,
  adjustStockValidation,
  createTransferValidation,
} = require('../validators/stock.validator');

// All routes require authentication
router.use(authenticate);

// ─── Stock Overview Routes ──────────────────────────────────

// GET /overview - Stock overview grouped by location
router.get(
  '/overview',
  requirePermission('stock.view'),
  stockController.getStockOverview
);

// GET /low-stock - Low stock alerts
router.get(
  '/low-stock',
  requirePermission('stock.view'),
  stockController.getLowStockAlerts
);

// GET /locations/:locationId - Stock by location
router.get(
  '/locations/:locationId',
  requirePermission('stock.view'),
  locationIdParam,
  validate,
  stockController.getStockByLocation
);

// GET /products/:productId - Stock by product
router.get(
  '/products/:productId',
  requirePermission('stock.view'),
  productIdParam,
  validate,
  stockController.getStockByProduct
);

// POST /adjust - Adjust stock
router.post(
  '/adjust',
  requirePermission('stock.adjust'),
  adjustStockValidation,
  validate,
  stockController.adjustStock
);

// ─── Movement Routes ────────────────────────────────────────

// GET /movements - Movement history
router.get(
  '/movements',
  requirePermission('stock.view'),
  stockController.listMovements
);

// ─── Transfer Routes ────────────────────────────────────────

// GET /transfers - List transfers
router.get(
  '/transfers',
  requirePermission('stock.view'),
  stockController.listTransfers
);

// GET /transfers/:id - Get transfer by ID
router.get(
  '/transfers/:id',
  requirePermission('stock.view'),
  uuidParam,
  validate,
  stockController.getTransferById
);

// POST /transfers - Create transfer
router.post(
  '/transfers',
  requirePermission('stock.transfer'),
  createTransferValidation,
  validate,
  stockController.createTransfer
);

// PUT /transfers/:id/receive - Receive transfer
router.put(
  '/transfers/:id/receive',
  requirePermission('stock.transfer'),
  uuidParam,
  validate,
  stockController.receiveTransfer
);

// PUT /transfers/:id/cancel - Cancel transfer
router.put(
  '/transfers/:id/cancel',
  requirePermission('stock.transfer'),
  uuidParam,
  validate,
  stockController.cancelTransfer
);

module.exports = router;
