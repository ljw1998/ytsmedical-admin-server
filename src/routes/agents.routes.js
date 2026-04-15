const express = require('express');
const router = express.Router();
const agentsController = require('../controllers/agents.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const {
  uuidParamValidation,
  recordSaleValidation,
  allocateStockValidation,
} = require('../validators/agents.validator');

// All routes require authentication
router.use(authenticate);

// GET /sales - List agent sales
router.get(
  '/sales',
  requirePermission('agents.view'),
  agentsController.listSales
);

// POST /sales - Record an agent sale
router.post(
  '/sales',
  requirePermission('agents.record_sale'),
  recordSaleValidation,
  validate,
  agentsController.recordSale
);

// GET /allocations/:agentId - List stock allocations for an agent
router.get(
  '/allocations/:agentId',
  requirePermission('agents.view'),
  uuidParamValidation,
  validate,
  agentsController.listAllocations
);

// POST /allocations - Allocate stock to an agent
router.post(
  '/allocations',
  requirePermission('agents.allocate_stock'),
  allocateStockValidation,
  validate,
  agentsController.allocateStock
);

// GET /balance/:agentId - Get agent stock balance
router.get(
  '/balance/:agentId',
  requirePermission('agents.view'),
  uuidParamValidation,
  validate,
  agentsController.getStockBalance
);

module.exports = router;
