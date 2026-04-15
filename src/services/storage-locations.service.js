const supabase = require('../config/database');
const { NotFoundError } = require('../utils/errors');

class StorageLocationsService {
  async list({ page = 1, limit = 20, search = '', status = '', location_type = '' }) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('storage_locations')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.ilike('location_name', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (location_type) {
      query = query.eq('location_type', location_type);
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
      .from('storage_locations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Storage location not found');
    }

    return data;
  }

  async create(locationData) {
    const { data, error } = await supabase
      .from('storage_locations')
      .insert({
        location_name: locationData.location_name,
        location_type: locationData.location_type,
        address_line_1: locationData.address_line_1 || null,
        address_line_2: locationData.address_line_2 || null,
        area: locationData.area || null,
        city: locationData.city || null,
        state: locationData.state || null,
        postcode: locationData.postcode || null,
        contact_person: locationData.contact_person || null,
        contact_phone: locationData.contact_phone || null,
        contact_email: locationData.contact_email || null,
        status: locationData.status || 'active',
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async update(id, locationData) {
    // Check exists
    await this.getById(id);

    const updateFields = {};
    if (locationData.location_name !== undefined) updateFields.location_name = locationData.location_name;
    if (locationData.location_type !== undefined) updateFields.location_type = locationData.location_type;
    if (locationData.address_line_1 !== undefined) updateFields.address_line_1 = locationData.address_line_1;
    if (locationData.address_line_2 !== undefined) updateFields.address_line_2 = locationData.address_line_2;
    if (locationData.area !== undefined) updateFields.area = locationData.area;
    if (locationData.city !== undefined) updateFields.city = locationData.city;
    if (locationData.state !== undefined) updateFields.state = locationData.state;
    if (locationData.postcode !== undefined) updateFields.postcode = locationData.postcode;
    if (locationData.contact_person !== undefined) updateFields.contact_person = locationData.contact_person;
    if (locationData.contact_phone !== undefined) updateFields.contact_phone = locationData.contact_phone;
    if (locationData.contact_email !== undefined) updateFields.contact_email = locationData.contact_email;
    if (locationData.status !== undefined) updateFields.status = locationData.status;
    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('storage_locations')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async delete(id) {
    // Check exists
    await this.getById(id);

    const { error } = await supabase
      .from('storage_locations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { id };
  }
}

module.exports = new StorageLocationsService();
