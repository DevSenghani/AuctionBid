const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuthController = require('../controllers/adminAuthController');
const auctionController = require('../controllers/auctionController');
const auctionAdminController = require('../controllers/auctionAdminController');
const { isAuctionAdmin, validatePauseAuction, validateEndAuction } = require('../middleware/auctionAdminMiddleware');

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
router.delete('/players/:id', adminAuthController.isAuthenticated, adminController.deletePlayer);

// Auction management (protected)
router.post('/players/:id/reset', adminAuthController.isAuthenticated, adminController.resetPlayerAuction);
router.post('/players/:id/assign', adminAuthController.isAuthenticated, adminController.assignPlayerToTeam);

// Auction control routes (protected)
router.get('/auction/status', adminAuthController.isAuthenticated, auctionController.getAuctionStatus);
router.post('/auction/start', adminAuthController.isAuthenticated, auctionController.startAuction);

// Enhanced auction admin routes with new middleware
router.post('/auction/pause', 
  adminAuthController.isAuthenticated, 
  isAuctionAdmin, 
  validatePauseAuction, 
  auctionAdminController.pauseAuction
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

// Original routes (can be migrated later)
router.post('/auction/next', adminAuthController.isAuthenticated, auctionController.skipToNextPlayer);
router.post('/auction/player', adminAuthController.isAuthenticated, auctionController.startPlayerAuction);
router.post('/auction/reset', adminAuthController.isAuthenticated, auctionController.resetAuction);

module.exports = router;
