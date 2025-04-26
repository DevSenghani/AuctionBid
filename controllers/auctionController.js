// controllers/auctionController.js

const playerModel = require('../models/playerModel');
const teamModel = require('../models/teamModel');
const bidModel = require('../models/bidModel');
const db = require('../utils/database');
const auctionSocket = require('../socket/auctionSocket');
const auctionMiddleware = require('../middleware/auctionMiddleware');
const TimerManager = require('../utils/timerManager');
const Player = require('../models/player');
const Team = require('../models/team');
const AuctionResult = require('../models/auctionResult');
const config = require('../config/auctionConfig');
const { emitAuctionStatus, emitPlayerUpdate, emitAuctionResult } = require('../socket/auctionSocket');

// Global auction state
let auctionState = {
  isRunning: false,
  isPaused: false,
  isWaiting: false, // State for waiting period between players
  currentPlayerId: null,
  startTime: null,
  availablePlayers: [],
  currentPlayer: null,
  currentRound: 1,
  soldPlayers: [],
  highestBid: 0,
  highestBidder: null,
  completedPlayers: [],
  unsoldPlayers: []
};

// Default time for each player auction in seconds
const DEFAULT_PLAYER_AUCTION_TIME = 30;
const DEFAULT_WAITING_TIME = 10;

// Initialize the timer manager with auction state
const timerManager = new TimerManager(auctionState);

// Show auction page
exports.showAuctionPage = async (req, res) => {
  try {
    console.log('Loading auction page...');
    
    // Check if we're using the mock database
    if (db.isMockDb()) {
      console.log('Using mock database for auction page');
    }
    
    let players = [];
    let teams = [];
    
    try {
      players = await playerModel.getAvailablePlayers();
      console.log(`Retrieved ${players.length} available players`);
    } catch (playerError) {
      console.error('Error fetching players:', playerError);
      players = []; // Set to empty array to prevent template issues
    }
    
    try {
      teams = await teamModel.getAllTeams();
      console.log(`Retrieved ${teams.length} teams`);
    } catch (teamError) {
      console.error('Error fetching teams:', teamError);
      teams = []; // Set to empty array to prevent template issues
    }
    
    res.render('auction', {
      title: 'Cricket Auction',
      players,
      teams,
      usingMockDb: db.isMockDb()
    });
  } catch (error) {
    console.error('Error loading auction page:', error);
    res.status(500).send('Error loading auction page: ' + error.message);
  }
};

// Get player details for auction
exports.getPlayerForAuction = async (req, res) => {
  try {
    const playerId = req.params.id;
    const player = await playerModel.getPlayerById(playerId);
    const bids = await bidModel.getBidsByPlayer(playerId);
    const highestBid = await bidModel.getHighestBid(playerId);
    
    res.json({
      player,
      bids,
      highestBid,
      timeRemaining: timerManager.getRemainingBidTime(),
      usingMockDb: db.isMockDb()
    });
  } catch (error) {
    console.error('Error getting player for auction:', error);
    res.status(500).json({ error: 'Failed to load player details' });
  }
};

// Place a bid
exports.placeBid = async (req, res) => {
  try {
    const { teamId, bidAmount } = req.body;
    
    if (!auctionState.isRunning || auctionState.isPaused) {
      return res.status(400).json({ message: 'Auction is not active' });
    }
    
    if (!auctionState.currentPlayer) {
      return res.status(400).json({ message: 'No player currently up for auction' });
    }
    
    // Validate the bid amount
    if (bidAmount <= auctionState.highestBid) {
      return res.status(400).json({ message: 'Bid amount must be higher than current highest bid' });
    }
    
    // Get the team that placed the bid
    const team = await teamModel.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if team has enough budget
    if (team.budget < bidAmount) {
      return res.status(400).json({ message: 'Not enough budget to place this bid' });
    }
    
    // Update highest bid
    auctionState.highestBid = bidAmount;
    auctionState.highestBidder = team;
    
    // Extend timer for new bids
    if (timerManager.getRemainingBidTime() < config.minTimerAfterBid) {
      timerManager.stopBidTimer();
      timerManager.startBidTimer(() => {
        finalizePlayerSale();
      });
    }
    
    // Emit player update with new bid
    emitPlayerUpdate({
      player: auctionState.currentPlayer,
      highestBid: auctionState.highestBid,
      highestBidder: {
        id: team._id,
        name: team.name,
        shortName: team.shortName
      }
    });
    
    return res.status(200).json({ 
      message: 'Bid placed successfully',
      highestBid: auctionState.highestBid,
      highestBidder: team.name
    });
  } catch (error) {
    console.error('Error placing bid:', error);
    return res.status(500).json({ message: 'Failed to place bid', error: error.message });
  }
};

// Finalize auction for a player
exports.finalizeAuction = async (req, res) => {
  try {
    if (!auctionState.isRunning && !req.body.forceFinalize) {
      return res.status(400).json({ message: 'Auction is not running' });
    }
    
    if (!auctionState.currentPlayer) {
      return res.status(400).json({ message: 'No player is currently being auctioned' });
    }
    
    timerManager.stopBidTimer();
    
    await finalizePlayerSale();
    
    return res.json({
      message: auctionState.highestBidder ? 'Player sold' : 'Player unsold',
      player: {
        _id: auctionState.currentPlayer._id,
        name: auctionState.currentPlayer.name
      },
      team: auctionState.highestBidder ? {
        _id: auctionState.highestBidder._id,
        name: auctionState.highestBidder.name
      } : null,
      amount: auctionState.highestBid
    });
  } catch (error) {
    console.error('Error finalizing auction:', error);
    return res.status(500).json({ message: 'Error finalizing auction' });
  }
};

// Get auction status
exports.getAuctionStatus = async (req, res) => {
  try {
    const response = {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting,
      timeRemaining: auctionState.isWaiting ? 
                     timerManager.getRemainingWaitingTime() : 
                     timerManager.getRemainingBidTime(),
      currentRound: auctionState.currentRound
    };
    
    if (auctionState.currentPlayer) {
      response.currentPlayer = {
        _id: auctionState.currentPlayer._id,
        name: auctionState.currentPlayer.name,
        image: auctionState.currentPlayer.image,
        basePrice: auctionState.currentPlayer.basePrice,
        battingStyle: auctionState.currentPlayer.battingStyle,
        bowlingStyle: auctionState.currentPlayer.bowlingStyle,
        specialization: auctionState.currentPlayer.specialization,
        nationality: auctionState.currentPlayer.nationality,
        stats: auctionState.currentPlayer.stats
      };
    }
    
    if (auctionState.highestBidder) {
      response.currentBid = {
        amount: auctionState.highestBid,
        teamId: auctionState.highestBidder._id,
        teamName: auctionState.highestBidder.name
      };
    }
    
    response.soldPlayers = auctionState.soldPlayers;
    
    return res.json(response);
  } catch (error) {
    console.error('Error getting auction status:', error);
    return res.status(500).json({ message: 'Error getting auction status' });
  }
};

// Start auction
exports.startAuction = async (req, res) => {
  try {
    if (auctionState.isRunning) {
      return res.status(400).json({ message: 'Auction is already running' });
    }
    
    auctionState.isRunning = true;
    auctionState.isPaused = false;
    auctionState.isWaiting = true;
    
    timerManager.startWaitingTimer(() => {
      fetchNextPlayer();
    });
    
    emitAuctionStatus(auctionState);
    
    return res.json({ message: 'Auction started', status: 'running' });
  } catch (error) {
    console.error('Error starting auction:', error);
    return res.status(500).json({ message: 'Error starting auction' });
  }
};

// Pause auction
exports.pauseAuction = async (req, res) => {
  try {
    if (!auctionState.isRunning) {
      return res.status(400).json({ message: 'Auction is not running' });
    }
    
    auctionState.isPaused = !auctionState.isPaused;
    
    if (auctionState.isPaused) {
      timerManager.stopBidTimer();
    } else {
      timerManager.startBidTimer(() => {
        finalizePlayerSale();
      });
    }
    
    emitAuctionStatus(auctionState);
    
    return res.json({ 
      message: auctionState.isPaused ? 'Auction paused' : 'Auction resumed', 
      status: auctionState.isPaused ? 'paused' : 'running' 
    });
  } catch (error) {
    console.error('Error toggling auction pause:', error);
    return res.status(500).json({ message: 'Error toggling auction pause' });
  }
};

// End auction
exports.endAuction = async (req, res) => {
  try {
    if (!auctionState.isRunning) {
      return res.status(400).json({ message: 'Auction is not running' });
    }
    
    auctionState.isRunning = false;
    auctionState.isPaused = false;
    auctionState.isWaiting = false;
    auctionState.currentPlayer = null;
    auctionState.highestBid = 0;
    auctionState.highestBidder = null;
    
    timerManager.stopAllTimers();
    
    emitAuctionStatus(auctionState);
    
    return res.json({ message: 'Auction ended', status: 'ended' });
  } catch (error) {
    console.error('Error ending auction:', error);
    return res.status(500).json({ message: 'Error ending auction' });
  }
};

// Skip to next player
exports.skipToNextPlayer = async (req, res) => {
  try {
    if (!auctionState.isRunning) {
      return res.status(400).json({
        error: 'No auction is currently running',
        status: 'not_running'
      });
    }
    
    if (auctionState.currentPlayer) {
      try {
        await playerModel.updatePlayerStatus(auctionState.currentPlayer._id, 'unsold');
      } catch (error) {
        console.error('Error marking player as unsold:', error);
      }
    }
    
    timerManager.stopBidTimer();
    timerManager.startWaitingTimer(() => {
      fetchNextPlayer();
    });
    
    emitAuctionStatus(auctionState);
    
    res.json({
      message: 'Skipped to next player',
      status: 'waiting'
    });
  } catch (error) {
    console.error('Error skipping to next player:', error);
    res.status(500).json({ error: 'Failed to skip to next player' });
  }
};

exports.startPlayerAuction = async (req, res) => {
  try {
    const { player_id } = req.body;
    
    if (!player_id) {
      return res.status(400).json({
        error: 'Player ID is required',
        status: 'error'
      });
    }
    
    const player = await playerModel.getPlayerById(player_id);
    
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        status: 'error'
      });
    }
    
    if (auctionState.isRunning && !auctionState.isPaused && !auctionState.isWaiting && auctionState.currentPlayer) {
      return res.status(400).json({
        error: 'Auction is already running for a different player',
        status: 'error'
      });
    }
    
    if (auctionState.isWaiting) {
      timerManager.stopWaitingTimer();
    }
    
    auctionState.isRunning = true;
    auctionState.isPaused = false;
    auctionState.isWaiting = false;
    auctionState.currentPlayer = player;
    auctionState.highestBid = player.basePrice;
    auctionState.highestBidder = null;
    
    emitPlayerUpdate({
      player: player,
      highestBid: auctionState.highestBid,
      highestBidder: null
    });
    
    timerManager.startBidTimer(() => {
      finalizePlayerSale();
    });
    
    emitAuctionStatus(auctionState);
    
    res.json({
      message: `Auction started for player ${player.name}`,
      status: 'running',
      player: player
    });
  } catch (error) {
    console.error('Error starting player auction:', error);
    res.status(500).json({ error: 'Failed to start player auction' });
  }
};

const fetchNextPlayer = async () => {
  try {
    if (!auctionState.isRunning || auctionState.isPaused) {
      return;
    }
    
    const nextPlayer = await Player.findOne({
      isAuctioned: false
    }).sort({ basePrice: -1 });
    
    if (!nextPlayer) {
      console.log('No more players to auction');
      auctionState.isRunning = false;
      emitAuctionStatus(auctionState);
      return;
    }
    
    auctionState.currentPlayer = nextPlayer;
    auctionState.highestBid = nextPlayer.basePrice;
    auctionState.highestBidder = null;
    auctionState.isWaiting = false;
    
    emitPlayerUpdate({
      player: nextPlayer,
      highestBid: auctionState.highestBid,
      highestBidder: null
    });
    
    timerManager.startBidTimer(() => {
      finalizePlayerSale();
    });
    
    emitAuctionStatus(auctionState);
    
    console.log(`Next player for auction: ${nextPlayer.name}, Base price: ${nextPlayer.basePrice}`);
  } catch (error) {
    console.error('Error fetching next player:', error);
  }
};

const finalizePlayerSale = async () => {
  try {
    if (!auctionState.currentPlayer) return;
    
    if (auctionState.highestBidder) {
      // Player sold
      await playerModel.updatePlayerStatus(auctionState.currentPlayer._id, 'sold');
      await playerModel.updatePlayerTeam(auctionState.currentPlayer._id, auctionState.highestBidder._id);
      
      // Update team budget
      const newBudget = auctionState.highestBidder.budget - auctionState.highestBid;
      await teamModel.updateTeamBudget(auctionState.highestBidder._id, newBudget);
      
      // Record bid
      await bidModel.createBid({
        player: auctionState.currentPlayer._id,
        team: auctionState.highestBidder._id,
        amount: auctionState.highestBid,
        timestamp: new Date()
      });
      
      // Add to sold players
      auctionState.soldPlayers.push({
        playerId: auctionState.currentPlayer._id,
        playerName: auctionState.currentPlayer.name,
        soldToTeam: auctionState.highestBidder._id,
        teamName: auctionState.highestBidder.name,
        amount: auctionState.highestBid
      });
      
      emitAuctionResult({
        player: auctionState.currentPlayer,
        team: auctionState.highestBidder,
        amount: auctionState.highestBid,
        result: 'sold'
      });
    } else {
      // Player unsold
      await playerModel.updatePlayerStatus(auctionState.currentPlayer._id, 'unsold');
      
      emitAuctionResult({
        player: auctionState.currentPlayer,
        result: 'unsold'
      });
    }
    
    // Reset current auction state
    timerManager.resetTimers();
    
    // Start waiting timer for next player
    auctionState.isWaiting = true;
    timerManager.startWaitingTimer(() => {
      fetchNextPlayer();
    });
    
    emitAuctionStatus(auctionState);
  } catch (error) {
    console.error('Error finalizing player sale:', error);
  }
};
