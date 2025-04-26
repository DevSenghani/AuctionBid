const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

// Show teams page
router.get('/', teamController.showTeamsPage);

// Get specific team details
router.get('/:id([0-9]+)', teamController.getTeamDetails);

// Update team information
router.put('/:id([0-9]+)', teamController.updateTeam);

module.exports = router; 