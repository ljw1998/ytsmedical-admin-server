const xlsx = require('xlsx');
const supabase = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { storageBuckets, getPublicUrl } = require('../config/storage');
const { generateFilename } = require('../middleware/upload.middleware');
const { roundMoney } = require('../utils/helpers');

/**
 * Parse Shopee export file (xlsx/csv) and create import record with items
 */
const parseShopeeFile = async (buffer, fileName) => {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet);

  if (!rows || rows.length === 0) {
    throw new BadRequestError('File is empty or has no data rows');
  }

  // Upload file to storage
  const storagePath = `shopee/${generateFilename({ originalname: fileName })}`;
  const { error: uploadError } = await supabase.storage
    .from(storageBuckets.imports.name)
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    });

  let file_url = null;
  if (!uploadError) {
    file_url = getPublicUrl(storageBuckets.imports.name, storagePath);
  }

  // Create import record
  const { data: importRecord, error: importError } = await supabase
    .from('shopee_imports')
    .insert({
      file_name: fileName,
      file_url,
      total_rows: rows.length,
      status: 'preview',
    })
    .select()
    .single();

  if (importError) {
    throw new BadRequestError(`Failed to create import record: ${importError.message}`);
  }

  // Process rows and create import items
  let new_orders = 0;
  let status_updates = 0;
  let skipped_rows = 0;
  let matched_rows = 0;
  let unmatched_rows = 0;
  let cancellations = 0;
  let total_sales_amount = 0;
  let total_shopee_fees = 0;
  let total_net_amount = 0;

  const importItems = [];

  for (const row of rows) {
    const shopee_order_id = row['Order ID'] || row['order_id'] || row['No. Pesanan'] || '';
    const shopee_order_status = row['Order Status'] || row['order_status'] || row['Status Pesanan'] || '';
    const shopee_sku = row['SKU'] || row['sku'] || row['SKU Produk'] || '';
    const shopee_sku_detail = row['SKU Detail'] || row['sku_detail'] || '';
    const product_name = row['Product Name'] || row['product_name'] || row['Nama Produk'] || '';
    const variation_name = row['Variation Name'] || row['variation_name'] || row['Nama Variasi'] || '';
    const quantity = parseInt(row['Quantity'] || row['quantity'] || row['Jumlah'] || 0);
    const original_price = parseFloat(row['Original Price'] || row['original_price'] || row['Harga Asal'] || 0);
    const deal_price = parseFloat(row['Deal Price'] || row['deal_price'] || row['Harga Setelah Diskon'] || 0);
    const product_subtotal = parseFloat(row['Product Subtotal'] || row['product_subtotal'] || row['Subtotal Produk'] || 0);
    const transaction_fee = parseFloat(row['Transaction Fee'] || row['transaction_fee'] || row['Biaya Transaksi'] || 0);
    const commission_fee = parseFloat(row['Commission Fee'] || row['commission_fee'] || row['Biaya Komisi'] || 0);
    const service_fee = parseFloat(row['Service Fee'] || row['service_fee'] || row['Biaya Layanan'] || 0);
    const grand_total = parseFloat(row['Grand Total'] || row['grand_total'] || row['Total Pembayaran'] || 0);
    const receiver_state = row['Receiver State'] || row['receiver_state'] || row['Provinsi'] || '';

    // Try to match SKU to product or bundle
    let matched_item_type = 'unmatched';
    let matched_item_id = null;

    if (shopee_sku) {
      // Try product match
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('sku', shopee_sku)
        .single();

      if (product) {
        matched_item_type = 'product';
        matched_item_id = product.id;
        matched_rows++;
      } else {
        // Try bundle match
        const { data: bundle } = await supabase
          .from('bundles')
          .select('id')
          .eq('sku', shopee_sku)
          .single();

        if (bundle) {
          matched_item_type = 'bundle';
          matched_item_id = bundle.id;
          matched_rows++;
        } else {
          unmatched_rows++;
        }
      }
    } else {
      skipped_rows++;
    }

    // Detect cancellations
    if (shopee_order_status && shopee_order_status.toLowerCase().includes('cancel')) {
      cancellations++;
    }

    const fees = roundMoney(transaction_fee + commission_fee + service_fee);
    total_sales_amount = roundMoney(total_sales_amount + product_subtotal);
    total_shopee_fees = roundMoney(total_shopee_fees + fees);
    total_net_amount = roundMoney(total_net_amount + grand_total);

    importItems.push({
      import_id: importRecord.id,
      shopee_order_id: String(shopee_order_id),
      shopee_order_status: String(shopee_order_status),
      shopee_sku: String(shopee_sku),
      shopee_sku_detail: String(shopee_sku_detail),
      product_name,
      variation_name,
      matched_item_type,
      matched_item_id,
      quantity,
      original_price,
      deal_price,
      product_subtotal,
      transaction_fee,
      commission_fee,
      service_fee,
      grand_total,
      receiver_state,
    });
  }

  new_orders = importItems.filter(item => item.shopee_order_id).length;

  // Insert import items in batches
  const batchSize = 100;
  for (let i = 0; i < importItems.length; i += batchSize) {
    const batch = importItems.slice(i, i + batchSize);
    const { error: itemsError } = await supabase
      .from('shopee_import_items')
      .insert(batch);

    if (itemsError) {
      throw new BadRequestError(`Failed to create import items: ${itemsError.message}`);
    }
  }

  // Update import record with summary
  const { data: updated, error: updateError } = await supabase
    .from('shopee_imports')
    .update({
      new_orders,
      status_updates,
      skipped_rows,
      matched_rows,
      unmatched_rows,
      cancellations,
      total_sales_amount,
      total_shopee_fees,
      total_net_amount,
    })
    .eq('id', importRecord.id)
    .select()
    .single();

  if (updateError) {
    throw new BadRequestError(`Failed to update import summary: ${updateError.message}`);
  }

  return updated;
};

/**
 * Preview an import (get import with items)
 */
const previewImport = async (importId) => {
  const importRecord = await getImportById(importId);

  const { data: items, error } = await supabase
    .from('shopee_import_items')
    .select('*')
    .eq('import_id', importId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new BadRequestError(`Failed to fetch import items: ${error.message}`);
  }

  return {
    ...importRecord,
    items: items || [],
  };
};

/**
 * Confirm an import - create orders from matched items
 */
const confirmImport = async (importId, userId) => {
  const importRecord = await getImportById(importId);

  if (importRecord.status !== 'preview') {
    throw new BadRequestError(`Import cannot be confirmed. Current status: ${importRecord.status}`);
  }

  // Update import status
  const { data: updated, error } = await supabase
    .from('shopee_imports')
    .update({
      status: 'confirmed',
      imported_by: userId || null,
    })
    .eq('id', importId)
    .select()
    .single();

  if (error) {
    throw new BadRequestError(`Failed to confirm import: ${error.message}`);
  }

  return updated;
};

/**
 * Cancel an import
 */
const cancelImport = async (importId) => {
  const importRecord = await getImportById(importId);

  if (importRecord.status !== 'preview') {
    throw new BadRequestError(`Import cannot be cancelled. Current status: ${importRecord.status}`);
  }

  const { data: updated, error } = await supabase
    .from('shopee_imports')
    .update({ status: 'cancelled' })
    .eq('id', importId)
    .select()
    .single();

  if (error) {
    throw new BadRequestError(`Failed to cancel import: ${error.message}`);
  }

  return updated;
};

/**
 * List imports with pagination and filters
 */
const listImports = async (filters = {}) => {
  const {
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    status,
    date_from,
    date_to,
  } = filters;

  const effectiveLimit = Math.min(limit, PAGINATION.MAX_LIMIT);
  const offset = (page - 1) * effectiveLimit;

  let query = supabase
    .from('shopee_imports')
    .select('*, importer:admin_users!imported_by(id, full_name)', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
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
    throw new BadRequestError(`Failed to fetch imports: ${error.message}`);
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
 * Get import by ID
 */
const getImportById = async (id) => {
  const { data, error } = await supabase
    .from('shopee_imports')
    .select('*, importer:admin_users!imported_by(id, full_name)')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new NotFoundError('Shopee import not found');
  }

  return data;
};

module.exports = {
  parseShopeeFile,
  previewImport,
  confirmImport,
  cancelImport,
  listImports,
  getImportById,
};
