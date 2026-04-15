const supabase = require('../config/database');
const { NotFoundError, ConflictError } = require('../utils/errors');

class CategoriesService {
  async list({ page = 1, limit = 20, search = '' }) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('categories')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.ilike('category_name', `%${search}%`);
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
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Category not found');
    }

    return data;
  }

  async create(categoryData) {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        category_name: categoryData.category_name,
        description: categoryData.description || null,
        status: categoryData.status || 'active',
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async update(id, categoryData) {
    // Check exists
    await this.getById(id);

    const updateFields = {};
    if (categoryData.category_name !== undefined) updateFields.category_name = categoryData.category_name;
    if (categoryData.description !== undefined) updateFields.description = categoryData.description;
    if (categoryData.status !== undefined) updateFields.status = categoryData.status;
    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('categories')
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
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { id };
  }
}

module.exports = new CategoriesService();
