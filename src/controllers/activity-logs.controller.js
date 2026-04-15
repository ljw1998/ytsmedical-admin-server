const activityLogsService = require('../services/activity-logs.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

/**
 * List activity logs
 */
const listLogs = async (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || undefined,
      limit: parseInt(req.query.limit) || undefined,
      user_id: req.query.user_id,
      action: req.query.action,
      entity_type: req.query.entity_type,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };

    const result = await activityLogsService.listLogs(filters);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: result.data,
      pagination: result.pagination,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listLogs,
};
