const codReportsService = require('../services/cod-reports.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

/**
 * Upload COD report file and preview
 */
const uploadAndPreview = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const importRecord = await codReportsService.parseCodReport(req.file.buffer, req.file.originalname);

    res.status(201).json(formatSuccessResponse({
      message: 'COD report uploaded and parsed successfully',
      data: importRecord,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm a COD report import
 */
const confirmImport = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const result = await codReportsService.confirmImport(req.params.id, userId);

    res.json(formatSuccessResponse({
      message: 'COD report import confirmed successfully',
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * List COD report imports
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

    const result = await codReportsService.listImports(filters);

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
 * Get COD report import by ID
 */
const getImportById = async (req, res, next) => {
  try {
    const result = await codReportsService.getImportById(req.params.id);

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
  listImports,
  getImportById,
};
