const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const { isTeamAuthenticated } = require('../middleware/authMiddleware');

// Show auction page - must be logged in to access
router.get('/', isTeamAuthenticated, auctionController.showAuctionPage);

// Projector view - publicly accessible
router.get('/projector', auctionController.showProjectorView);

// Get auction status - for polling auction status from the team view
router.get('/status', auctionController.getAuctionStatus);

// Get player details for auction - must be logged in to access
router.get('/player/:id', isTeamAuthenticated, auctionController.getPlayerForAuction);

// Place a bid - must be logged in to access
router.post('/bid', isTeamAuthenticated, auctionController.placeBid);

// Finalize auction for a player - must be logged in to access
router.post('/finalize/:id', isTeamAuthenticated, auctionController.finalizeAuction);

module.exports = router;
