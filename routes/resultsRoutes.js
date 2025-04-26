const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');

// Show results page
router.get('/', resultsController.showResultsPage);

// Get auction statistics
router.get('/stats', resultsController.getAuctionStats);

module.exports = router; 