const supabase = require('../config/database');
const { NotFoundError, ConflictError } = require('../utils/errors');

class CustomersService {
  /**
   * List customers with pagination, search, and filters
   */
  async listCustomers({ page = 1, limit = 20, search, source_channel, source_campaign_id, tags } = {}) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('customers')
      .select('*, campaigns:source_campaign_id(id, name)', { count: 'exact' });

    // Search across name, phone, email, messenger_id
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,messenger_id.ilike.%${search}%`
      );
    }

    // Filter by source_channel
    if (source_channel) {
      query = query.eq('source_channel', source_channel);
    }

    // Filter by source_campaign_id
    if (source_campaign_id) {
      query = query.eq('source_campaign_id', source_campaign_id);
    }

    // Filter by tags (contains any of the provided tags)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      customers: data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Get a single customer by ID with addresses and campaign info
   */
  async getCustomerById(id) {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*, campaigns:source_campaign_id(id, name), customer_addresses(*)')
      .eq('id', id)
      .single();

    if (error || !customer) {
      throw new NotFoundError('Customer not found');
    }

    return customer;
  }

  /**
   * Create a new customer with duplicate detection on phone
   */
  async createCustomer(data) {
    // Check for duplicate phone
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', data.phone)
      .maybeSingle();

    if (existing) {
      throw new ConflictError('A customer with this phone number already exists');
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .insert(data)
      .select('*, campaigns:source_campaign_id(id, name)')
      .single();

    if (error) {
      throw error;
    }

    return customer;
  }

  /**
   * Update an existing customer
   */
  async updateCustomer(id, data) {
    // If phone is being updated, check for duplicates
    if (data.phone) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', data.phone)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        throw new ConflictError('A customer with this phone number already exists');
      }
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, campaigns:source_campaign_id(id, name)')
      .single();

    if (error) {
      throw new NotFoundError('Customer not found');
    }

    return customer;
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(id) {
    // Verify customer exists
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !customer) {
      throw new NotFoundError('Customer not found');
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return { id };
  }

  // ─── Address Methods ────────────────────────────────────────

  /**
   * List addresses for a customer
   */
  async listAddresses(customerId) {
    // Verify customer exists
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      throw new NotFoundError('Customer not found');
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Create an address for a customer. If is_default, unset other defaults first.
   */
  async createAddress(customerId, data) {
    // Verify customer exists
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      throw new NotFoundError('Customer not found');
    }

    // If this address is default, unset other defaults
    if (data.is_default) {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('customer_id', customerId)
        .eq('is_default', true);
    }

    const { data: address, error } = await supabase
      .from('customer_addresses')
      .insert({ ...data, customer_id: customerId })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return address;
  }

  /**
   * Update an address for a customer
   */
  async updateAddress(customerId, addressId, data) {
    // Verify address belongs to customer
    const { data: existing, error: fetchError } = await supabase
      .from('customer_addresses')
      .select('id')
      .eq('id', addressId)
      .eq('customer_id', customerId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('Address not found for this customer');
    }

    // If setting as default, unset other defaults
    if (data.is_default) {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('customer_id', customerId)
        .eq('is_default', true)
        .neq('id', addressId);
    }

    const { data: address, error } = await supabase
      .from('customer_addresses')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', addressId)
      .eq('customer_id', customerId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return address;
  }

  /**
   * Delete an address for a customer
   */
  async deleteAddress(customerId, addressId) {
    // Verify address belongs to customer
    const { data: existing, error: fetchError } = await supabase
      .from('customer_addresses')
      .select('id')
      .eq('id', addressId)
      .eq('customer_id', customerId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('Address not found for this customer');
    }

    const { error } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', addressId)
      .eq('customer_id', customerId);

    if (error) {
      throw error;
    }

    return { id: addressId };
  }
}

module.exports = new CustomersService();
