const supabase = require('../config/database');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');

/**
 * List all roles
 */
const listRoles = async () => {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new BadRequestError(`Failed to fetch roles: ${error.message}`);
  }

  return data;
};

/**
 * Get role by ID with its permissions
 */
const getRoleById = async (id) => {
  const { data: role, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !role) {
    throw new NotFoundError('Role not found');
  }

  // Fetch role permissions
  const { data: rolePermissions } = await supabase
    .from('role_permissions')
    .select('permission:permissions!permission_id(id, permission_name, module, description)')
    .eq('role_id', id);

  role.permissions = rolePermissions ? rolePermissions.map(rp => rp.permission) : [];

  return role;
};

/**
 * Create a new role
 */
const createRole = async (data) => {
  const { role_name, description } = data;

  // Check uniqueness
  const { data: existing } = await supabase
    .from('roles')
    .select('id')
    .eq('role_name', role_name)
    .single();

  if (existing) {
    throw new ConflictError(`Role "${role_name}" already exists`);
  }

  const { data: role, error } = await supabase
    .from('roles')
    .insert({
      role_name,
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    throw new BadRequestError(`Failed to create role: ${error.message}`);
  }

  return role;
};

/**
 * Update a role
 */
const updateRole = async (id, data) => {
  const { data: existing, error: fetchError } = await supabase
    .from('roles')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('Role not found');
  }

  const updateData = {};
  if (data.role_name !== undefined) {
    // Check uniqueness
    const { data: dup } = await supabase
      .from('roles')
      .select('id')
      .eq('role_name', data.role_name)
      .neq('id', id)
      .single();

    if (dup) {
      throw new ConflictError(`Role "${data.role_name}" already exists`);
    }
    updateData.role_name = data.role_name;
  }
  if (data.description !== undefined) updateData.description = data.description;

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestError('No valid fields to update');
  }

  const { data: updated, error } = await supabase
    .from('roles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new BadRequestError(`Failed to update role: ${error.message}`);
  }

  return updated;
};

/**
 * Delete a role
 */
const deleteRole = async (id) => {
  const { data: existing, error: fetchError } = await supabase
    .from('roles')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('Role not found');
  }

  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', id);

  if (error) {
    throw new BadRequestError(`Failed to delete role: ${error.message}`);
  }

  return { message: 'Role deleted successfully' };
};

/**
 * Assign permissions to a role (replace existing)
 */
const assignPermissions = async (id, permissionIds) => {
  const { data: existing, error: fetchError } = await supabase
    .from('roles')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('Role not found');
  }

  // Delete existing permission assignments
  const { error: deleteError } = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', id);

  if (deleteError) {
    throw new BadRequestError(`Failed to clear existing permissions: ${deleteError.message}`);
  }

  // Assign new permissions
  if (permissionIds && permissionIds.length > 0) {
    const assignments = permissionIds.map(permission_id => ({
      role_id: id,
      permission_id,
    }));

    const { error: insertError } = await supabase
      .from('role_permissions')
      .insert(assignments);

    if (insertError) {
      throw new BadRequestError(`Failed to assign permissions: ${insertError.message}`);
    }
  }

  return await getRoleById(id);
};

/**
 * List all permissions
 */
const listPermissions = async () => {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('module', { ascending: true })
    .order('permission_name', { ascending: true });

  if (error) {
    throw new BadRequestError(`Failed to fetch permissions: ${error.message}`);
  }

  return data;
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
