const bcrypt = require('bcrypt');
const supabase = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');

/**
 * List admin users with pagination and filters
 */
const listUsers = async (filters = {}) => {
  const {
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    search,
    is_active,
  } = filters;

  const effectiveLimit = Math.min(limit, PAGINATION.MAX_LIMIT);
  const offset = (page - 1) * effectiveLimit;

  let query = supabase
    .from('admin_users')
    .select('id, email, full_name, phone, avatar_url, is_active, last_login_at, created_at, updated_at', { count: 'exact' });

  if (is_active !== undefined && is_active !== '') {
    query = query.eq('is_active', is_active === 'true' || is_active === true);
  }
  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + effectiveLimit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new BadRequestError(`Failed to fetch users: ${error.message}`);
  }

  // Fetch roles for each user
  const userIds = data.map(u => u.id);
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('user_id, role:roles!role_id(id, role_name)')
    .in('user_id', userIds);

  // Map roles to users
  const rolesMap = {};
  if (userRoles) {
    for (const ur of userRoles) {
      if (!rolesMap[ur.user_id]) rolesMap[ur.user_id] = [];
      rolesMap[ur.user_id].push(ur.role);
    }
  }

  const usersWithRoles = data.map(user => ({
    ...user,
    roles: rolesMap[user.id] || [],
  }));

  return {
    data: usersWithRoles,
    pagination: {
      page,
      limit: effectiveLimit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / effectiveLimit),
    },
  };
};

/**
 * Get admin user by ID
 */
const getUserById = async (id) => {
  const { data: user, error } = await supabase
    .from('admin_users')
    .select('id, email, full_name, phone, avatar_url, is_active, last_login_at, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !user) {
    throw new NotFoundError('User not found');
  }

  // Fetch roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role:roles!role_id(id, role_name, description), assigned_by, assigned_at')
    .eq('user_id', id);

  user.roles = userRoles ? userRoles.map(ur => ({ ...ur.role, assigned_by: ur.assigned_by, assigned_at: ur.assigned_at })) : [];

  // Fetch permissions via view
  const { data: permData } = await supabase
    .from('v_admin_user_permissions')
    .select('permissions')
    .eq('admin_user_id', id)
    .single();

  user.permissions = permData?.permissions || [];

  return user;
};

/**
 * Create a new admin user
 */
const createUser = async (data) => {
  const { email, full_name, password, phone, role_ids } = data;

  // Check if email already exists
  const { data: existing } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    throw new ConflictError('Email already exists');
  }

  // Hash password
  const password_hash = await bcrypt.hash(password, 10);

  // Create user
  const { data: user, error } = await supabase
    .from('admin_users')
    .insert({
      email: email.toLowerCase(),
      full_name,
      password_hash,
      phone: phone || null,
      is_active: true,
    })
    .select('id, email, full_name, phone, avatar_url, is_active, created_at, updated_at')
    .single();

  if (error) {
    throw new BadRequestError(`Failed to create user: ${error.message}`);
  }

  // Assign roles if provided
  if (role_ids && role_ids.length > 0) {
    const roleAssignments = role_ids.map(role_id => ({
      user_id: user.id,
      role_id,
    }));

    const { error: roleError } = await supabase
      .from('user_roles')
      .insert(roleAssignments);

    if (roleError) {
      console.error('Failed to assign roles:', roleError.message);
    }
  }

  return await getUserById(user.id);
};

/**
 * Update an admin user
 */
const updateUser = async (id, data) => {
  const { data: existing, error: fetchError } = await supabase
    .from('admin_users')
    .select('id, email')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('User not found');
  }

  const updateData = {};

  if (data.email !== undefined) {
    // Check uniqueness
    const { data: dup } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', data.email.toLowerCase())
      .neq('id', id)
      .single();

    if (dup) {
      throw new ConflictError('Email already exists');
    }
    updateData.email = data.email.toLowerCase();
  }

  if (data.full_name !== undefined) updateData.full_name = data.full_name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  if (data.password) {
    updateData.password_hash = await bcrypt.hash(data.password, 10);
  }

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestError('No valid fields to update');
  }

  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('admin_users')
    .update(updateData)
    .eq('id', id);

  if (error) {
    throw new BadRequestError(`Failed to update user: ${error.message}`);
  }

  return await getUserById(id);
};

/**
 * Delete (soft) an admin user by setting is_active=false
 */
const deleteUser = async (id) => {
  const { data: existing, error: fetchError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('User not found');
  }

  const { error } = await supabase
    .from('admin_users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new BadRequestError(`Failed to delete user: ${error.message}`);
  }

  return { message: 'User deactivated successfully' };
};

/**
 * Assign roles to a user (replace existing roles)
 */
const assignRoles = async (id, roleIds, assignedBy) => {
  const { data: existing, error: fetchError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('User not found');
  }

  // Delete existing role assignments
  const { error: deleteError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', id);

  if (deleteError) {
    throw new BadRequestError(`Failed to clear existing roles: ${deleteError.message}`);
  }

  // Assign new roles
  if (roleIds && roleIds.length > 0) {
    const roleAssignments = roleIds.map(role_id => ({
      user_id: id,
      role_id,
      assigned_by: assignedBy || null,
    }));

    const { error: insertError } = await supabase
      .from('user_roles')
      .insert(roleAssignments);

    if (insertError) {
      throw new BadRequestError(`Failed to assign roles: ${insertError.message}`);
    }
  }

  return await getUserById(id);
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  assignRoles,
};
