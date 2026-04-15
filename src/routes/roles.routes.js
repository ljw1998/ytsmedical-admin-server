const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/roles.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/permission');
const validate = require('../middleware/validation');
const {
  uuidParamValidation,
  createRoleValidation,
  updateRoleValidation,
  assignPermissionsValidation,
} = require('../validators/roles.validator');

// All routes require authentication and super_admin role
router.use(authenticate);
router.use(requireRole('super_admin'));

// GET /permissions - List all permissions
router.get(
  '/permissions',
  rolesController.listPermissions
);

// GET / - List roles
router.get(
  '/',
  rolesController.listRoles
);

// GET /:id - Get role by ID with permissions
router.get(
  '/:id',
  uuidParamValidation,
  validate,
  rolesController.getRoleById
);

// POST / - Create role
router.post(
  '/',
  createRoleValidation,
  validate,
  rolesController.createRole
);

// PUT /:id - Update role
router.put(
  '/:id',
  updateRoleValidation,
  validate,
  rolesController.updateRole
);

// DELETE /:id - Delete role
router.delete(
  '/:id',
  uuidParamValidation,
  validate,
  rolesController.deleteRole
);

// PUT /:id/permissions - Assign permissions to a role
router.put(
  '/:id/permissions',
  assignPermissionsValidation,
  validate,
  rolesController.assignPermissions
);

module.exports = router;
