const xlsx = require('xlsx');
const supabase = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { storageBuckets, getPublicUrl } = require('../config/storage');
const { generateFilename } = require('../middleware/upload.middleware');
const { roundMoney } = require('../utils/helpers');

/**
 * Parse COD report file (xlsx/csv) and create import record
 */
const parseCodReport = async (buffer, fileName) => {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet);

  if (!rows || rows.length === 0) {
    throw new BadRequestError('File is empty or has no data rows');
  }

  // Upload file to storage
  const storagePath = `cod-reports/${generateFilename({ originalname: fileName })}`;
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

  // Determine date range from data
  let report_start_date = null;
  let report_end_date = null;
  let total_cod_amount = 0;
  let total_cod_fees = 0;
  let matched_orders = 0;
  let unmatched_rows = 0;

  for (const row of rows) {
    const trackingNumber = row['Tracking Number'] || row['tracking_number'] || row['AWB'] || '';
    const codAmount = parseFloat(row['COD Amount'] || row['cod_amount'] || row['Amount'] || 0);
    const codFee = parseFloat(row['COD Fee'] || row['cod_fee'] || row['Fee'] || 0);
    const date = row['Date'] || row['date'] || row['Collection Date'] || null;

    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        const dateStr = parsedDate.toISOString().slice(0, 10);
        if (!report_start_date || dateStr < report_start_date) {
          report_start_date = dateStr;
        }
        if (!report_end_date || dateStr > report_end_date) {
          report_end_date = dateStr;
        }
      }
    }

    total_cod_amount = roundMoney(total_cod_amount + codAmount);
    total_cod_fees = roundMoney(total_cod_fees + codFee);

    // Try to match by tracking number
    if (trackingNumber) {
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('tracking_number', String(trackingNumber))
        .single();

      if (order) {
        matched_orders++;
      } else {
        unmatched_rows++;
      }
    } else {
      unmatched_rows++;
    }
  }

  // Create import record
  const { data: importRecord, error: importError } = await supabase
    .from('cod_report_imports')
    .insert({
      file_name: fileName,
      file_url,
      report_start_date,
      report_end_date,
      total_rows: rows.length,
      matched_orders,
      unmatched_rows,
      amount_discrepancies: 0,
      total_cod_amount,
      total_cod_fees,
      status: 'preview',
    })
    .select()
    .single();

  if (importError) {
    throw new BadRequestError(`Failed to create COD report import: ${importError.message}`);
  }

  return importRecord;
};

/**
 * Preview a COD report import
 */
const previewImport = async (importId) => {
  return await getImportById(importId);
};

/**
 * Confirm a COD report import
 */
const confirmImport = async (importId, userId) => {
  const importRecord = await getImportById(importId);

  if (importRecord.status !== 'preview') {
    throw new BadRequestError(`Import cannot be confirmed. Current status: ${importRecord.status}`);
  }

  const { data: updated, error } = await supabase
    .from('cod_report_imports')
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
 * List COD report imports with pagination and filters
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
    .from('cod_report_imports')
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
    throw new BadRequestError(`Failed to fetch COD report imports: ${error.message}`);
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
 * Get COD report import by ID
 */
const getImportById = async (id) => {
  const { data, error } = await supabase
    .from('cod_report_imports')
    .select('*, importer:admin_users!imported_by(id, full_name)')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new NotFoundError('COD report import not found');
  }

  return data;
};

module.exports = {
  parseCodReport,
  previewImport,
  confirmImport,
  listImports,
  getImportById,
};
