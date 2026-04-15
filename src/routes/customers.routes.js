const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const customersController = require('../controllers/customers.controller');
const {
  createCustomerValidation,
  updateCustomerValidation,
  uuidParamValidation,
  createAddressValidation,
  updateAddressValidation,
} = require('../validators/customers.validator');

// All routes require authentication
router.use(authenticate);

// ─── Customer Routes ─────────────────────────────────────────

// GET / - List customers
router.get(
  '/',
  requirePermission('customers.view'),
  customersController.listCustomers
);

// GET /:id - Get customer by ID
router.get(
  '/:id',
  requirePermission('customers.view'),
  uuidParamValidation,
  validate,
  customersController.getCustomerById
);

// POST / - Create customer
router.post(
  '/',
  requirePermission('customers.create'),
  createCustomerValidation,
  validate,
  customersController.createCustomer
);

// PUT /:id - Update customer
router.put(
  '/:id',
  requirePermission('customers.update'),
  updateCustomerValidation,
  validate,
  customersController.updateCustomer
);

// DELETE /:id - Delete customer
router.delete(
  '/:id',
  requirePermission('customers.delete'),
  uuidParamValidation,
  validate,
  customersController.deleteCustomer
);

// ─── Address Routes ──────────────────────────────────────────

// GET /:id/addresses - List addresses for a customer
router.get(
  '/:id/addresses',
  requirePermission('customers.view'),
  uuidParamValidation,
  validate,
  customersController.listAddresses
);

// POST /:id/addresses - Create address for a customer
router.post(
  '/:id/addresses',
  requirePermission('customers.update'),
  createAddressValidation,
  validate,
  customersController.createAddress
);

// PUT /:id/addresses/:addressId - Update address
router.put(
  '/:id/addresses/:addressId',
  requirePermission('customers.update'),
  updateAddressValidation,
  validate,
  customersController.updateAddress
);

// DELETE /:id/addresses/:addressId - Delete address
router.delete(
  '/:id/addresses/:addressId',
  requirePermission('customers.update'),
  uuidParamValidation,
  validate,
  customersController.deleteAddress
);

module.exports = router;
