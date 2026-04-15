const express = require('express');
const router = express.Router();
const shopeeController = require('../controllers/shopee.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const { uploadDocument, handleUploadError } = require('../middleware/upload.middleware');
const {
  uuidParamValidation,
  confirmImportValidation,
} = require('../validators/shopee.validator');

// All routes require authentication
router.use(authenticate);

// POST /upload - Upload Shopee file and preview
router.post(
  '/upload',
  requirePermission('shopee.import'),
  uploadDocument(),
  handleUploadError,
  shopeeController.uploadAndPreview
);

// POST /:id/confirm - Confirm import
router.post(
  '/:id/confirm',
  requirePermission('shopee.import'),
  confirmImportValidation,
  validate,
  shopeeController.confirmImport
);

// POST /:id/cancel - Cancel import
router.post(
  '/:id/cancel',
  requirePermission('shopee.import'),
  uuidParamValidation,
  validate,
  shopeeController.cancelImport
);

// GET / - List imports
router.get(
  '/',
  requirePermission('shopee.view'),
  shopeeController.listImports
);

// GET /:id - Get import by ID
router.get(
  '/:id',
  requirePermission('shopee.view'),
  uuidParamValidation,
  validate,
  shopeeController.getImportById
);

module.exports = router;
