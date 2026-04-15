const supabase = require('../config/database');
const { NotFoundError, ConflictError } = require('../utils/errors');

class ProductsService {
  async list({ page = 1, limit = 20, search = '', category_id = null, status = null }) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*, categories(id, category_name)', { count: 'exact' });

    if (search) {
      query = query.or(`product_name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (status) {
      query = query.eq('status', status);
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
      .from('products')
      .select('*, categories(id, category_name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Product not found');
    }

    return data;
  }

  async checkSkuUniqueness(sku, excludeId = null) {
    let query = supabase
      .from('products')
      .select('id')
      .eq('sku', sku);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      throw new ConflictError(`Product with SKU "${sku}" already exists`);
    }
  }

  async create(productData) {
    await this.checkSkuUniqueness(productData.sku);

    const insertData = {
      product_name: productData.product_name,
      sku: productData.sku,
      description: productData.description || null,
      category_id: productData.category_id || null,
      unit_price: productData.unit_price,
      cost_price: productData.cost_price || null,
      weight: productData.weight || null,
      status: productData.status || 'active',
      image_url: productData.image_url || null,
    };

    const { data, error } = await supabase
      .from('products')
      .insert(insertData)
      .select('*, categories(id, category_name)')
      .single();

    if (error) throw error;

    return data;
  }

  async update(id, productData) {
    // Check exists
    await this.getById(id);

    // Check SKU uniqueness if changed
    if (productData.sku !== undefined) {
      await this.checkSkuUniqueness(productData.sku, id);
    }

    const updateFields = {};
    if (productData.product_name !== undefined) updateFields.product_name = productData.product_name;
    if (productData.sku !== undefined) updateFields.sku = productData.sku;
    if (productData.description !== undefined) updateFields.description = productData.description;
    if (productData.category_id !== undefined) updateFields.category_id = productData.category_id;
    if (productData.unit_price !== undefined) updateFields.unit_price = productData.unit_price;
    if (productData.cost_price !== undefined) updateFields.cost_price = productData.cost_price;
    if (productData.weight !== undefined) updateFields.weight = productData.weight;
    if (productData.status !== undefined) updateFields.status = productData.status;
    if (productData.image_url !== undefined) updateFields.image_url = productData.image_url;
    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .update(updateFields)
      .eq('id', id)
      .select('*, categories(id, category_name)')
      .single();

    if (error) throw error;

    return data;
  }

  async delete(id) {
    // Check exists
    await this.getById(id);

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { id };
  }

  async uploadImage(file) {
    const { generateFilename } = require('../middleware/upload.middleware');
    const filename = generateFilename(file);
    const filePath = `images/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async deleteImage(imageUrl) {
    if (!imageUrl) return;

    try {
      // Extract path from URL
      const urlParts = imageUrl.split('/storage/v1/object/public/products/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('products').remove([filePath]);
      }
    } catch (error) {
      console.error('Failed to delete image:', error.message);
    }
  }
}

module.exports = new ProductsService();
