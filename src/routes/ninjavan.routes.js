const express = require('express');
const router = express.Router();
const ninjavanController = require('../controllers/ninjavan.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { webhookLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validation');
const { uuidParamValidation } = require('../validators/ninjavan.validator');

// POST /webhook - PUBLIC endpoint (no auth), with webhookLimiter
// Raw body is needed for signature verification
router.post(
  '/webhook',
  webhookLimiter,
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
  ninjavanController.handleWebhook
);

// GET /waybill/:id - Download waybill PDF for an order
router.get(
  '/waybill/:id',
  authenticate,
  requirePermission('ninjavan.waybill'),
  uuidParamValidation,
  validate,
  ninjavanController.generateWaybill
);

// GET /print-waybill/:id - Print waybill for a single order (marks as printed)
router.get(
  '/print-waybill/:id',
  authenticate,
  requirePermission('ninjavan.waybill'),
  uuidParamValidation,
  validate,
  ninjavanController.printWaybill
);

// GET /printable-orders - List NinjaVan pending_pickup orders eligible for AWB printing
router.get(
  '/printable-orders',
  authenticate,
  requirePermission('ninjavan.waybill'),
  ninjavanController.listPrintableOrders
);

// POST /bulk-print-waybills - Bulk print selected order AWBs
router.post(
  '/bulk-print-waybills',
  authenticate,
  requirePermission('ninjavan.waybill'),
  ninjavanController.bulkPrintWaybills
);

// DELETE /cancel/:id - Cancel a NinjaVan order
router.delete(
  '/cancel/:id',
  authenticate,
  requirePermission('ninjavan.cancel'),
  uuidParamValidation,
  validate,
  ninjavanController.cancelOrder
);

// POST /retry/:id - Retry failed NinjaVan order creation
router.post(
  '/retry/:id',
  authenticate,
  requirePermission('orders.update'),
  uuidParamValidation,
  validate,
  ninjavanController.retrySync
);

module.exports = router;
