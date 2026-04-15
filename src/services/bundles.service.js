const supabase = require('../config/database');
const { NotFoundError, ConflictError } = require('../utils/errors');

class BundlesService {
  async list({ page = 1, limit = 20, search = '' }) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('bundles')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`bundle_name.ilike.%${search}%,bundle_sku.ilike.%${search}%`);
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

  async getById(id) {
    const { data, error } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Bundle not found');
    }

    // Fetch bundle items with product info
    const { data: items, error: itemsError } = await supabase
      .from('bundle_items')
      .select('*, products(id, product_name, sku, unit_price)')
      .eq('bundle_id', id);

    if (itemsError) throw itemsError;

    data.items = items || [];

    return data;
  }

  async checkSkuUniqueness(bundle_sku, excludeId = null) {
    let query = supabase
      .from('bundles')
      .select('id')
      .eq('bundle_sku', bundle_sku);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      throw new ConflictError(`Bundle with SKU "${bundle_sku}" already exists`);
    }
  }

  async create(bundleData) {
    await this.checkSkuUniqueness(bundleData.bundle_sku);

    const { items, ...bundleFields } = bundleData;

    const insertData = {
      bundle_name: bundleFields.bundle_name,
      bundle_sku: bundleFields.bundle_sku,
      bundle_price: bundleFields.bundle_price,
      bundle_cost: bundleFields.bundle_cost || null,
      status: bundleFields.status || 'active',
    };

    // Insert bundle
    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .insert(insertData)
      .select()
      .single();

    if (bundleError) throw bundleError;

    // Insert bundle items
    if (items && items.length > 0) {
      const bundleItems = items.map((item) => ({
        bundle_id: bundle.id,
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('bundle_items')
        .insert(bundleItems);

      if (itemsError) throw itemsError;
    }

    // Return full bundle with items
    return this.getById(bundle.id);
  }

  async update(id, bundleData) {
    // Check exists
    await this.getById(id);

    const { items, ...bundleFields } = bundleData;

    // Check SKU uniqueness if changed
    if (bundleFields.bundle_sku !== undefined) {
      await this.checkSkuUniqueness(bundleFields.bundle_sku, id);
    }

    const updateFields = {};
    if (bundleFields.bundle_name !== undefined) updateFields.bundle_name = bundleFields.bundle_name;
    if (bundleFields.bundle_sku !== undefined) updateFields.bundle_sku = bundleFields.bundle_sku;
    if (bundleFields.bundle_price !== undefined) updateFields.bundle_price = bundleFields.bundle_price;
    if (bundleFields.bundle_cost !== undefined) updateFields.bundle_cost = bundleFields.bundle_cost;
    if (bundleFields.status !== undefined) updateFields.status = bundleFields.status;
    updateFields.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('bundles')
      .update(updateFields)
      .eq('id', id);

    if (updateError) throw updateError;

    // Update items if provided
    if (items !== undefined) {
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('bundle_items')
        .delete()
        .eq('bundle_id', id);

      if (deleteError) throw deleteError;

      // Insert new items
      if (items.length > 0) {
        const bundleItems = items.map((item) => ({
          bundle_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('bundle_items')
          .insert(bundleItems);

        if (itemsError) throw itemsError;
      }
    }

    // Return full bundle with items
    return this.getById(id);
  }

  async delete(id) {
    // Check exists
    await this.getById(id);

    // bundle_items cascade on delete, so just delete the bundle
    const { error } = await supabase
      .from('bundles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { id };
  }
}

module.exports = new BundlesService();
