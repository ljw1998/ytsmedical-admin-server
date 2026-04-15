const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const storageLocationsController = require('../controllers/storage-locations.controller');
const {
  create,
  update,
  uuidParam,
} = require('../validators/storage-locations.validator');

// All routes require authentication
router.use(authenticate);

// ─── Storage Location Routes ────────────────────────────────

// GET / - List storage locations
router.get(
  '/',
  requirePermission('settings.view'),
  storageLocationsController.list
);

// GET /:id - Get storage location by ID
router.get(
  '/:id',
  requirePermission('settings.view'),
  uuidParam,
  validate,
  storageLocationsController.getById
);

// POST / - Create storage location
router.post(
  '/',
  requirePermission('settings.update'),
  create,
  validate,
  storageLocationsController.create
);

// PUT /:id - Update storage location
router.put(
  '/:id',
  requirePermission('settings.update'),
  update,
  validate,
  storageLocationsController.update
);

// DELETE /:id - Delete storage location
router.delete(
  '/:id',
  requirePermission('settings.update'),
  uuidParam,
  validate,
  storageLocationsController.delete
);

module.exports = router;
