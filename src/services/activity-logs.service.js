const supabase = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { BadRequestError } = require('../utils/errors');

/**
 * Log an activity
 */
const logActivity = async (userId, action, entityType, entityId, details, ipAddress) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: userId || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId ? String(entityId) : null,
      details: details || null,
      ip_address: ipAddress || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to log activity:', error.message);
    return null;
  }

  return data;
};

/**
 * List activity logs with pagination and filters
 */
const listLogs = async (filters = {}) => {
  const {
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    user_id,
    action,
    entity_type,
    date_from,
    date_to,
  } = filters;

  const effectiveLimit = Math.min(limit, PAGINATION.MAX_LIMIT);
  const offset = (page - 1) * effectiveLimit;

  let query = supabase
    .from('activity_logs')
    .select('*, user:admin_users!user_id(id, full_name, email)', { count: 'exact' });

  if (user_id) {
    query = query.eq('user_id', user_id);
  }
  if (action) {
    query = query.eq('action', action);
  }
  if (entity_type) {
    query = query.eq('entity_type', entity_type);
  }
  if (date_from) {
    query = query.gte('created_at', date_from);
  }
  if (date_to) {
    query = query.lte('created_at', date_to);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + effectiveLimit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new BadRequestError(`Failed to fetch activity logs: ${error.message}`);
  }

  return {
    data,
    pagination: {
      page,
      limit: effectiveLimit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / effectiveLimit),
    },
  };
};

module.exports = {
  logActivity,
  listLogs,
};
