const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuthController = require('../controllers/adminAuthController');
const auctionController = require('../controllers/auctionController');
const auctionAdminController = require('../controllers/auctionAdminController');
const { isAuctionAdmin, validatePauseAuction, validateEndAuction, validateStartAuction, validateResumeAuction } = require('../middleware/auctionAdminMiddleware');
const AuctionResult = require('../models/auctionResult');
const { uploadPlayerImage } = require('../utils/uploadUtils');

// Admin authentication routes
router.get('/login', adminAuthController.showLoginPage);
router.post('/login', adminAuthController.processLogin);
router.get('/logout', adminAuthController.logout);

// Main admin dashboard (protected)
router.get('/', adminAuthController.isAuthenticated, adminController.showAdminDashboard);

// Team management (protected)
router.post('/teams', adminAuthController.isAuthenticated, adminController.createTeam);
router.delete('/teams/:id', adminAuthController.isAuthenticated, adminController.deleteTeam);
router.post('/teams/:id/password', adminAuthController.isAuthenticated, adminController.updateTeamPassword);

// Player management (protected)
router.post('/players', adminAuthController.isAuthenticated, adminController.createPlayer);
router.put('/players/:id', adminAuthController.isAuthenticated, adminController.updatePlayer);
router.delete('/players/:id', adminAuthController.isAuthenticated, adminController.deletePlayer);

// Player image upload
router.post('/players/:id/image', 
  adminAuthController.isAuthenticated, 
  uploadPlayerImage.single('player_image'), 
  adminController.uploadPlayerImage
);

// Auction management (protected)
router.post('/players/:id/reset', adminAuthController.isAuthenticated, adminController.resetPlayerAuction);
router.post('/players/:id/assign', adminAuthController.isAuthenticated, adminController.assignPlayerToTeam);

// Auction control routes (protected)
router.get('/auction/status', adminAuthController.isAuthenticated, auctionController.getAuctionStatus);
router.post('/auction/start', 
  adminAuthController.isAuthenticated, 
  isAuctionAdmin, 
  validateStartAuction, 
  auctionAdminController.startAuction
);

// Enhanced auction admin routes with new middleware
router.post('/auction/pause', 
  adminAuthController.isAuthenticated, 
  isAuctionAdmin, 
  validatePauseAuction, 
  auctionAdminController.pauseAuction
);

// Add resume auction route with validation
router.post('/auction/resume', 
  adminAuthController.isAuthenticated, 
  isAuctionAdmin, 
  validateResumeAuction,
  auctionAdminController.resumeAuction
);

router.post('/auction/end', 
  adminAuthController.isAuthenticated, 
  isAuctionAdmin, 
  validateEndAuction, 
  auctionAdminController.endAuction
);

// Stats endpoint for auction admin
router.get('/auction/admin-stats', 
  adminAuthController.isAuthenticated, 
  isAuctionAdmin, 
  auctionAdminController.getAuctionAdminStats
);

// Auction Results Routes
router.get('/auction/results', async (req, res) => {
  try {
    const results = await AuctionResult.getAllResults();
    res.status(200).json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error fetching auction results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch auction results',
      error: error.message
    });
  }
});

router.get('/auction/results/latest', async (req, res) => {
  try {
    const results = await AuctionResult.getAllResults();
    const latestResult = results.length > 0 ? results[results.length - 1] : null;
    
    if (!latestResult) {
      return res.status(404).json({
        success: false,
        message: 'No auction results found'
      });
    }
    
    // Calculate statistics for the latest result
    const statistics = latestResult.calculateStatistics();
    
    res.status(200).json({
      success: true,
      result: latestResult,
      statistics
    });
  } catch (error) {
    console.error('Error fetching latest auction result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest auction result',
      error: error.message
    });
  }
});

// Original routes (can be migrated later)
router.post('/auction/next', adminAuthController.isAuthenticated, auctionController.skipToNextPlayer);
router.post('/auction/player', adminAuthController.isAuthenticated, auctionController.startPlayerAuction);
router.post('/auction/reset', adminAuthController.isAuthenticated, auctionController.resetAuction);

module.exports = router;
