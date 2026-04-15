const rolesService = require('../services/roles.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

/**
 * List all roles
 */
const listRoles = async (req, res, next) => {
  try {
    const roles = await rolesService.listRoles();

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: roles,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get role by ID with permissions
 */
const getRoleById = async (req, res, next) => {
  try {
    const role = await rolesService.getRoleById(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: role,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new role
 */
const createRole = async (req, res, next) => {
  try {
    const role = await rolesService.createRole(req.body);

    res.status(201).json(formatSuccessResponse({
      message: SuccessMessages.CREATED,
      data: role,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Update a role
 */
const updateRole = async (req, res, next) => {
  try {
    const role = await rolesService.updateRole(req.params.id, req.body);

    res.json(formatSuccessResponse({
      message: SuccessMessages.UPDATED,
      data: role,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a role
 */
const deleteRole = async (req, res, next) => {
  try {
    const result = await rolesService.deleteRole(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.DELETED,
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Assign permissions to a role
 */
const assignPermissions = async (req, res, next) => {
  try {
    const role = await rolesService.assignPermissions(req.params.id, req.body.permission_ids);

    res.json(formatSuccessResponse({
      message: 'Permissions assigned successfully',
      data: role,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * List all permissions
 */
const listPermissions = async (req, res, next) => {
  try {
    const permissions = await rolesService.listPermissions();

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: permissions,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignPermissions,
  listPermissions,
};
