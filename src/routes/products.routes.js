const express = require('express');
const router = express.Router();
const productsController = require('../controllers/products.controller');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const productsValidator = require('../validators/products.validator');
const { uploadSingleImage } = require('../middleware/upload.middleware');

router.get(
  '/',
  requirePermission('products.view'),
  productsController.list
);

router.get(
  '/:id',
  requirePermission('products.view'),
  productsValidator.uuidParam,
  validate,
  productsController.getById
);

router.post(
  '/',
  requirePermission('products.create'),
  uploadSingleImage('image'),
  productsValidator.create,
  validate,
  productsController.create
);

router.put(
  '/:id',
  requirePermission('products.update'),
  uploadSingleImage('image'),
  productsValidator.update,
  validate,
  productsController.update
);

router.delete(
  '/:id',
  requirePermission('products.delete'),
  productsValidator.uuidParam,
  validate,
  productsController.delete
);

module.exports = router;
