const express = require('express');
const router = express.Router();

// Re-export storage-locations routes under /settings/storage-locations
const storageLocationsRoutes = require('./storage-locations.routes');
router.use('/storage-locations', storageLocationsRoutes);

// Re-export meta-ads account routes under /settings/meta-ads
const metaAdsRoutes = require('./meta-ads.routes');
router.use('/meta-ads', metaAdsRoutes);

module.exports = router;
