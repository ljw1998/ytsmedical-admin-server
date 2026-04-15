const express = require('express');
const router = express.Router();
const bundlesController = require('../controllers/bundles.controller');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const bundlesValidator = require('../validators/bundles.validator');

router.get(
  '/',
  requirePermission('bundles.view'),
  bundlesController.list
);

router.get(
  '/:id',
  requirePermission('bundles.view'),
  bundlesValidator.uuidParam,
  validate,
  bundlesController.getById
);

router.post(
  '/',
  requirePermission('bundles.create'),
  bundlesValidator.create,
  validate,
  bundlesController.create
);

router.put(
  '/:id',
  requirePermission('bundles.update'),
  bundlesValidator.update,
  validate,
  bundlesController.update
);

router.delete(
  '/:id',
  requirePermission('bundles.delete'),
  bundlesValidator.uuidParam,
  validate,
  bundlesController.delete
);

module.exports = router;
