const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categories.controller');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const categoriesValidator = require('../validators/categories.validator');

router.get(
  '/',
  requirePermission('categories.view'),
  categoriesController.list
);

router.get(
  '/:id',
  requirePermission('categories.view'),
  categoriesValidator.uuidParam,
  validate,
  categoriesController.getById
);

router.post(
  '/',
  requirePermission('categories.create'),
  categoriesValidator.create,
  validate,
  categoriesController.create
);

router.put(
  '/:id',
  requirePermission('categories.update'),
  categoriesValidator.update,
  validate,
  categoriesController.update
);

router.delete(
  '/:id',
  requirePermission('categories.delete'),
  categoriesValidator.uuidParam,
  validate,
  categoriesController.delete
);

module.exports = router;
