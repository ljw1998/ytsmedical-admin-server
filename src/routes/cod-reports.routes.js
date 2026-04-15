const express = require('express');
const router = express.Router();
const codReportsController = require('../controllers/cod-reports.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const { uploadDocument, handleUploadError } = require('../middleware/upload.middleware');
const {
  uuidParamValidation,
} = require('../validators/cod-reports.validator');

// All routes require authentication
router.use(authenticate);

// POST /upload - Upload COD report file and preview
router.post(
  '/upload',
  requirePermission('cod_reports.import'),
  uploadDocument(),
  handleUploadError,
  codReportsController.uploadAndPreview
);

// POST /:id/confirm - Confirm import
router.post(
  '/:id/confirm',
  requirePermission('cod_reports.import'),
  uuidParamValidation,
  validate,
  codReportsController.confirmImport
);

// GET / - List imports
router.get(
  '/',
  requirePermission('cod_reports.view'),
  codReportsController.listImports
);

// GET /:id - Get import by ID
router.get(
  '/:id',
  requirePermission('cod_reports.view'),
  uuidParamValidation,
  validate,
  codReportsController.getImportById
);

module.exports = router;
