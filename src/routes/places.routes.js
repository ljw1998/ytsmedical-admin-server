const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const googlePlacesService = require('../services/googlePlaces.service');
const { formatSuccessResponse } = require('../utils/helpers');

router.use(authenticate);

// GET /api/admin/places/autocomplete?input=xxx
router.get('/autocomplete', async (req, res, next) => {
  try {
    const data = await googlePlacesService.autocomplete(req.query.input);
    res.json(formatSuccessResponse({ data }));
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/places/details?place_id=xxx
router.get('/details', async (req, res, next) => {
  try {
    const data = await googlePlacesService.getPlaceDetails(req.query.place_id);
    res.json(formatSuccessResponse({ data }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
