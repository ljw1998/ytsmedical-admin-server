const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const {
  uuidParamValidation,
  createUserValidation,
  updateUserValidation,
  assignRolesValidation,
} = require('../validators/users.validator');

// All routes require authentication
router.use(authenticate);

// GET / - List users
router.get(
  '/',
  requirePermission('users.view'),
  usersController.listUsers
);

// GET /:id - Get user by ID
router.get(
  '/:id',
  requirePermission('users.view'),
  uuidParamValidation,
  validate,
  usersController.getUserById
);

// POST / - Create user
router.post(
  '/',
  requirePermission('users.create'),
  createUserValidation,
  validate,
  usersController.createUser
);

// PUT /:id - Update user
router.put(
  '/:id',
  requirePermission('users.update'),
  updateUserValidation,
  validate,
  usersController.updateUser
);

// DELETE /:id - Delete (deactivate) user
router.delete(
  '/:id',
  requirePermission('users.delete'),
  uuidParamValidation,
  validate,
  usersController.deleteUser
);

// PUT /:id/roles - Assign roles to a user
router.put(
  '/:id/roles',
  requirePermission('users.assign_roles'),
  assignRolesValidation,
  validate,
  usersController.assignRoles
);

module.exports = router;
