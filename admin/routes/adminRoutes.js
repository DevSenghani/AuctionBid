const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Admin routes for adding players and teams
router.post('/add-player', adminController.addPlayer);
router.post('/add-team', adminController.addTeam);

module.exports = router;
