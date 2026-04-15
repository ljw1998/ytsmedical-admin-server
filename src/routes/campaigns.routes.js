const express = require('express');
const router = express.Router();

const campaignsController = require('../controllers/campaigns.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const { create, update, uuidParam } = require('../validators/campaigns.validator');

// All routes require authentication
router.use(authenticate);

// GET / - List campaigns
router.get(
  '/',
  requirePermission('campaigns.view'),
  campaignsController.list
);

// GET /:id - Get campaign by ID (includes spend summary)
router.get(
  '/:id',
  requirePermission('campaigns.view'),
  uuidParam,
  validate,
  campaignsController.getById
);

// POST / - Create campaign
router.post(
  '/',
  requirePermission('campaigns.create'),
  create,
  validate,
  campaignsController.create
);

// PUT /:id - Update campaign
router.put(
  '/:id',
  requirePermission('campaigns.update'),
  update,
  validate,
  campaignsController.update
);

// DELETE /:id - Delete campaign
router.delete(
  '/:id',
  requirePermission('campaigns.delete'),
  uuidParam,
  validate,
  campaignsController.delete
);

module.exports = router;
