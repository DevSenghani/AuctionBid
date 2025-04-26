const express = require('express');
const router = express.Router();
const teamAuthController = require('../controllers/teamAuthController');
const teamDashboardController = require('../controllers/teamDashboardController');

// Team login page
router.get('/login', teamAuthController.showLoginPage);

// Process team login
router.post('/login', teamAuthController.processLogin);

// Team logout
router.get('/logout', teamAuthController.logout);

// Team dashboard (protected route)
router.get('/dashboard', teamAuthController.isAuthenticated, teamDashboardController.showDashboard);

// API to get active auction information
router.get('/active-auction', teamAuthController.isAuthenticated, teamDashboardController.getActiveAuction);

module.exports = router; 