const supabase = require('../config/database');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class StockService {
  // ─── Stock Queries ──────────────────────────────────────────

  async getStockByLocation(locationId) {
    const { data, error } = await supabase
      .from('stock')
      .select('*, product:products(*), location:storage_locations(id, location_name, location_type)')
      .eq('location_id', locationId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data;
  }

  async getStockByProduct(productId) {
    const { data, error } = await supabase
      .from('stock')
      .select('*, location:storage_locations(id, location_name, location_type)')
      .eq('product_id', productId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data;
  }

  async getStockOverview() {
    const { data, error } = await supabase
      .from('stock')
      .select('*, product:products(id, product_name, sku), location:storage_locations(id, location_name, location_type)')
      .order('location_id', { ascending: true });

    if (error) throw error;

    // Group by location
    const grouped = {};
    for (const item of data) {
      const locId = item.location_id;
      if (!grouped[locId]) {
        grouped[locId] = {
          location: item.location,
          items: [],
        };
      }
      grouped[locId].items.push({
        id: item.id,
        product_id: item.product_id,
        product: item.product,
        sku: item.sku,
        quantity: item.quantity,
        low_stock_threshold: item.low_stock_threshold,
        updated_at: item.updated_at,
      });
    }

    return Object.values(grouped);
  }

  async getLowStockAlerts() {
    const { data, error } = await supabase
      .from('stock')
      .select('*, product:products(id, product_name, sku), location:storage_locations(id, location_name, location_type)')
      .filter('quantity', 'lte', 'low_stock_threshold')
      .order('quantity', { ascending: true });

    if (error) throw error;

    // If RLS filter doesn't work, filter client-side
    const filtered = data.filter(item => item.quantity <= item.low_stock_threshold);

    return filtered;
  }

  // ─── Stock Adjustment ──────────────────────────────────────

  async adjustStock(locationId, productId, movementType, quantity, notes, userId) {
    // Upsert stock record
    const { data: existingStock } = await supabase
      .from('stock')
      .select('id, quantity')
      .eq('location_id', locationId)
      .eq('product_id', productId)
      .single();

    let newQuantity;
    if (existingStock) {
      // Determine if adding or subtracting
      const isOutgoing = ['stock_out', 'transfer_out', 'bundle_sale', 'shopee_sale', 'agent_sale'].includes(movementType);
      newQuantity = isOutgoing
        ? existingStock.quantity - Math.abs(quantity)
        : existingStock.quantity + Math.abs(quantity);

      const { error: updateError } = await supabase
        .from('stock')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', existingStock.id);

      if (updateError) throw updateError;
    } else {
      // Create new stock record - get product SKU
      const { data: product } = await supabase
        .from('products')
        .select('sku')
        .eq('id', productId)
        .single();

      newQuantity = quantity;

      const { error: insertError } = await supabase
        .from('stock')
        .insert({
          location_id: locationId,
          product_id: productId,
          sku: product ? product.sku : null,
          quantity: newQuantity,
        });

      if (insertError) throw insertError;
    }

    // Create movement record
    const { data: movement, error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        location_id: locationId,
        product_id: productId,
        movement_type: movementType,
        quantity: quantity,
        reference_type: 'manual',
        notes: notes || null,
        created_by: userId || null,
      })
      .select()
      .single();

    if (movementError) throw movementError;

    return movement;
  }

  // ─── Transfers ─────────────────────────────────────────────

  async createTransfer(data, userId) {
    const { from_location_id, to_location_id, items, notes } = data;

    if (from_location_id === to_location_id) {
      throw new BadRequestError('Source and destination locations must be different');
    }

    // Create transfer record
    const { data: transfer, error: transferError } = await supabase
      .from('stock_transfers')
      .insert({
        from_location_id,
        to_location_id,
        status: 'pending',
        transfer_date: new Date().toISOString().slice(0, 10),
        notes: notes || null,
        created_by: userId || null,
      })
      .select()
      .single();

    if (transferError) throw transferError;

    // Create transfer items
    const transferItems = [];
    for (const item of items) {
      // Get product SKU
      const { data: product } = await supabase
        .from('products')
        .select('sku')
        .eq('id', item.product_id)
        .single();

      transferItems.push({
        transfer_id: transfer.id,
        product_id: item.product_id,
        sku: product ? product.sku : null,
        quantity: item.quantity,
      });
    }

    const { error: itemsError } = await supabase
      .from('stock_transfer_items')
      .insert(transferItems);

    if (itemsError) throw itemsError;

    // Create stock_movements (transfer_out from source) and update stock at source
    for (const item of items) {
      await this.adjustStock(
        from_location_id,
        item.product_id,
        'transfer_out',
        item.quantity,
        `Transfer #${transfer.id}`,
        userId
      );
    }

    return await this.getTransferById(transfer.id);
  }

  async receiveTransfer(transferId, userId) {
    const transfer = await this.getTransferById(transferId);

    if (transfer.status !== 'pending' && transfer.status !== 'in_transit') {
      throw new BadRequestError('Transfer can only be received when pending or in transit');
    }

    // Update transfer status
    const { error: updateError } = await supabase
      .from('stock_transfers')
      .update({
        status: 'received',
        received_date: new Date().toISOString().slice(0, 10),
      })
      .eq('id', transferId);

    if (updateError) throw updateError;

    // Create stock_movements (transfer_in at destination) and update stock at destination
    for (const item of transfer.items) {
      await this.adjustStock(
        transfer.to_location_id,
        item.product_id,
        'transfer_in',
        item.quantity,
        `Transfer #${transferId} received`,
        userId
      );
    }

    return await this.getTransferById(transferId);
  }

  async cancelTransfer(transferId, userId) {
    const transfer = await this.getTransferById(transferId);

    if (transfer.status !== 'pending' && transfer.status !== 'in_transit') {
      throw new BadRequestError('Only pending or in-transit transfers can be cancelled');
    }

    // Update transfer status
    const { error: updateError } = await supabase
      .from('stock_transfers')
      .update({ status: 'cancelled' })
      .eq('id', transferId);

    if (updateError) throw updateError;

    // Reverse stock at source (add back the transferred quantities)
    for (const item of transfer.items) {
      await this.adjustStock(
        transfer.from_location_id,
        item.product_id,
        'stock_in',
        item.quantity,
        `Transfer #${transferId} cancelled - stock reversed`,
        userId
      );
    }

    return await this.getTransferById(transferId);
  }

  async listTransfers({ page = 1, limit = 20, status = '', from_location_id = '', to_location_id = '' }) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('stock_transfers')
      .select('*, from_location:storage_locations!from_location_id(id, location_name), to_location:storage_locations!to_location_id(id, location_name), creator:admin_users!created_by(id, full_name)', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (from_location_id) {
      query = query.eq('from_location_id', from_location_id);
    }

    if (to_location_id) {
      query = query.eq('to_location_id', to_location_id);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getTransferById(id) {
    const { data, error } = await supabase
      .from('stock_transfers')
      .select('*, from_location:storage_locations!from_location_id(id, location_name, location_type), to_location:storage_locations!to_location_id(id, location_name, location_type), creator:admin_users!created_by(id, full_name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Transfer not found');
    }

    // Get transfer items with product info
    const { data: items, error: itemsError } = await supabase
      .from('stock_transfer_items')
      .select('*, product:products(id, product_name, sku)')
      .eq('transfer_id', id);

    if (itemsError) throw itemsError;

    data.items = items || [];

    return data;
  }

  // ─── Movements ─────────────────────────────────────────────

  async listMovements({ page = 1, limit = 20, location_id = '', product_id = '', movement_type = '', date_from = '', date_to = '' }) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('stock_movements')
      .select('*, product:products(id, product_name, sku), location:storage_locations(id, location_name), creator:admin_users!created_by(id, full_name)', { count: 'exact' });

    if (location_id) {
      query = query.eq('location_id', location_id);
    }

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    if (movement_type) {
      query = query.eq('movement_type', movement_type);
    }

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }
}

module.exports = new StockService();
