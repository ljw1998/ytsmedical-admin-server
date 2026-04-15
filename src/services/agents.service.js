const supabase = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { NotFoundError, BadRequestError } = require('../utils/errors');

/**
 * List agent sales with pagination and filters
 */
const listAgentSales = async (filters = {}) => {
  const {
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    agent_id,
    date_from,
    date_to,
  } = filters;

  const effectiveLimit = Math.min(limit, PAGINATION.MAX_LIMIT);
  const offset = (page - 1) * effectiveLimit;

  let query = supabase
    .from('agent_sales')
    .select(`
      *,
      agent:admin_users!agent_id(id, full_name, email),
      order:orders!order_id(id, order_number, total_amount)
    `, { count: 'exact' });

  if (agent_id) {
    query = query.eq('agent_id', agent_id);
  }
  if (date_from) {
    query = query.gte('sale_date', date_from);
  }
  if (date_to) {
    query = query.lte('sale_date', date_to);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + effectiveLimit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new BadRequestError(`Failed to fetch agent sales: ${error.message}`);
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

/**
 * Record an agent sale
 */
const recordSale = async (data, userId) => {
  const { agent_id, sale_date, items, notes } = data;

  // Verify agent exists
  const { data: agent, error: agentError } = await supabase
    .from('admin_users')
    .select('id, full_name')
    .eq('id', agent_id)
    .single();

  if (agentError || !agent) {
    throw new NotFoundError('Agent not found');
  }

  // Create agent sale record
  const { data: sale, error: saleError } = await supabase
    .from('agent_sales')
    .insert({
      agent_id,
      sale_date,
      notes: notes || null,
    })
    .select()
    .single();

  if (saleError) {
    throw new BadRequestError(`Failed to record sale: ${saleError.message}`);
  }

  // Process each item - update stock allocations
  for (const item of items) {
    // Find allocation for this agent and product
    const { data: allocation } = await supabase
      .from('agent_stock_allocations')
      .select('id, remaining_quantity, sold_quantity')
      .eq('agent_id', agent_id)
      .eq('product_id', item.product_id)
      .gt('remaining_quantity', 0)
      .order('allocated_at', { ascending: true })
      .limit(1)
      .single();

    if (allocation) {
      const newSold = allocation.sold_quantity + item.quantity;
      const newRemaining = allocation.remaining_quantity - item.quantity;

      const { error: updateError } = await supabase
        .from('agent_stock_allocations')
        .update({
          sold_quantity: newSold,
          remaining_quantity: Math.max(0, newRemaining),
          updated_at: new Date().toISOString(),
        })
        .eq('id', allocation.id);

      if (updateError) {
        console.error('Failed to update allocation:', updateError.message);
      }
    }
  }

  return sale;
};

/**
 * List stock allocations for an agent
 */
const listAllocations = async (agentId) => {
  const { data, error } = await supabase
    .from('agent_stock_allocations')
    .select(`
      *,
      agent:admin_users!agent_id(id, full_name),
      location:storage_locations!location_id(id, location_name),
      product:products!product_id(id, product_name, sku),
      allocator:admin_users!allocated_by(id, full_name)
    `)
    .eq('agent_id', agentId)
    .order('allocated_at', { ascending: false });

  if (error) {
    throw new BadRequestError(`Failed to fetch allocations: ${error.message}`);
  }

  return data;
};

/**
 * Allocate stock to an agent
 */
const allocateStock = async (data, userId) => {
  const { agent_id, location_id, product_id, quantity } = data;

  // Verify agent exists
  const { data: agent, error: agentError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', agent_id)
    .single();

  if (agentError || !agent) {
    throw new NotFoundError('Agent not found');
  }

  // Verify location exists
  const { data: location, error: locError } = await supabase
    .from('storage_locations')
    .select('id')
    .eq('id', location_id)
    .single();

  if (locError || !location) {
    throw new NotFoundError('Storage location not found');
  }

  // Verify product exists
  const { data: product, error: prodError } = await supabase
    .from('products')
    .select('id')
    .eq('id', product_id)
    .single();

  if (prodError || !product) {
    throw new NotFoundError('Product not found');
  }

  // Create allocation record
  const { data: allocation, error: allocError } = await supabase
    .from('agent_stock_allocations')
    .insert({
      agent_id,
      location_id,
      product_id,
      allocated_quantity: quantity,
      sold_quantity: 0,
      remaining_quantity: quantity,
      allocated_by: userId || null,
    })
    .select()
    .single();

  if (allocError) {
    throw new BadRequestError(`Failed to allocate stock: ${allocError.message}`);
  }

  return allocation;
};

/**
 * Get agent stock balance (remaining allocations grouped by product)
 */
const getAgentStockBalance = async (agentId) => {
  const { data, error } = await supabase
    .from('agent_stock_allocations')
    .select(`
      *,
      product:products!product_id(id, product_name, sku),
      location:storage_locations!location_id(id, location_name)
    `)
    .eq('agent_id', agentId)
    .gt('remaining_quantity', 0)
    .order('allocated_at', { ascending: false });

  if (error) {
    throw new BadRequestError(`Failed to fetch agent stock balance: ${error.message}`);
  }

  // Aggregate by product
  const balanceByProduct = {};
  for (const alloc of data) {
    const pid = alloc.product_id;
    if (!balanceByProduct[pid]) {
      balanceByProduct[pid] = {
        product_id: pid,
        product: alloc.product,
        total_allocated: 0,
        total_sold: 0,
        total_remaining: 0,
        allocations: [],
      };
    }
    balanceByProduct[pid].total_allocated += alloc.allocated_quantity;
    balanceByProduct[pid].total_sold += alloc.sold_quantity;
    balanceByProduct[pid].total_remaining += alloc.remaining_quantity;
    balanceByProduct[pid].allocations.push(alloc);
  }

  return Object.values(balanceByProduct);
};

module.exports = {
  listAgentSales,
  recordSale,
  listAllocations,
  allocateStock,
  getAgentStockBalance,
};
