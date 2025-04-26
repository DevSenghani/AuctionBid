const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');

// Routes for player and team management
router.post('/add-player', auctionController.addPlayer);
router.post('/add-team', auctionController.addTeam);

// Route to get all players
router.get('/players', auctionController.getPlayers);

// Route to get all teams
router.get('/teams', auctionController.getTeams);

// Route to get auction results
router.get('/auction-results', auctionController.getAuctionResults);

module.exports = router;
