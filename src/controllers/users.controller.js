const usersService = require('../services/users.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

/**
 * List admin users
 */
const listUsers = async (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || undefined,
      limit: parseInt(req.query.limit) || undefined,
      search: req.query.search,
      is_active: req.query.is_active,
    };

    const result = await usersService.listUsers(filters);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: result.data,
      pagination: result.pagination,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await usersService.getUserById(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: user,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new admin user
 */
const createUser = async (req, res, next) => {
  try {
    const user = await usersService.createUser(req.body);

    res.status(201).json(formatSuccessResponse({
      message: SuccessMessages.CREATED,
      data: user,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Update an admin user
 */
const updateUser = async (req, res, next) => {
  try {
    const user = await usersService.updateUser(req.params.id, req.body);

    res.json(formatSuccessResponse({
      message: SuccessMessages.UPDATED,
      data: user,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete (deactivate) an admin user
 */
const deleteUser = async (req, res, next) => {
  try {
    const result = await usersService.deleteUser(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.DELETED,
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Assign roles to a user
 */
const assignRoles = async (req, res, next) => {
  try {
    const assignedBy = req.user?.id || null;
    const user = await usersService.assignRoles(req.params.id, req.body.role_ids, assignedBy);

    res.json(formatSuccessResponse({
      message: 'Roles assigned successfully',
      data: user,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  assignRoles,
};
