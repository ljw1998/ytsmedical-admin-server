const shopeeService = require('../services/shopee.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

/**
 * Upload Shopee file and preview import
 */
const uploadAndPreview = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const importRecord = await shopeeService.parseShopeeFile(req.file.buffer, req.file.originalname);
    const preview = await shopeeService.previewImport(importRecord.id);

    res.status(201).json(formatSuccessResponse({
      message: 'File uploaded and parsed successfully',
      data: preview,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm a Shopee import
 */
const confirmImport = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const result = await shopeeService.confirmImport(req.params.id, userId);

    res.json(formatSuccessResponse({
      message: 'Import confirmed successfully',
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a Shopee import
 */
const cancelImport = async (req, res, next) => {
  try {
    const result = await shopeeService.cancelImport(req.params.id);

    res.json(formatSuccessResponse({
      message: 'Import cancelled successfully',
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * List Shopee imports
 */
const listImports = async (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || undefined,
      limit: parseInt(req.query.limit) || undefined,
      status: req.query.status,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };

    const result = await shopeeService.listImports(filters);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: result.data,
      pagination: result.pagination,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Shopee import by ID (with items)
 */
const getImportById = async (req, res, next) => {
  try {
    const result = await shopeeService.previewImport(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadAndPreview,
  confirmImport,
  cancelImport,
  listImports,
  getImportById,
};
