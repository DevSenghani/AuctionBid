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
    
    // Immediately finalize the sale to the highest bidder
    timerManager.stopBidTimer();
    await finalizePlayerSale(false);
    
    return res.status(200).json({ 
      message: 'Bid placed successfully and player sold',
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
    
    // Call with false to indicate manual finalization
    await finalizePlayerSale(false);
    
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
    
    // Start waiting timer for next player
    timerManager.startWaitingTimer(() => {
      fetchNextPlayer();
    });
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting,
      status: 'waiting', // Add explicit status field
      timeRemaining: timerManager.getRemainingWaitingTime(),
      message: 'Auction has started. Selecting first player...'
    };
    
    // Emit the detailed status to all clients
    emitAuctionStatus(statusObj);
    
    return res.json({ message: 'Auction started', status: 'running' });
  } catch (error) {
    console.error('Error starting auction:', error);
    return res.status(500).json({ message: 'Error starting auction' });
  }
};

// Pause auction
exports.pauseAuction = async (req, res) => {
  try {
    // Get the current auction state
    const { auctionState, timerManager } = require('../auction');

    if (!auctionState.isRunning) {
      return res.status(400).json({ error: 'Auction is not running' });
    }

    // Save the previous state to allow resuming
    auctionState.isPaused = true;
    auctionState.isRunning = false;

    // Pause all active timers and store the remaining times
    const timers = timerManager.pauseAllTimers();
    
    // Get the IO instance
    const io = require('../socket/auctionSocket').getIO();
    
    // Notify all clients about auction pause
    if (io) {
      io.to('auction').emit('auction-paused', {
        message: 'The auction has been paused by the administrator',
        timers
      });
      
      // Emit updated auction status
      const { emitAuctionStatus } = require('../socket/auctionSocket');
      emitAuctionStatus(auctionState);
    }

    return res.status(200).json({ message: 'Auction paused successfully', auctionState });
  } catch (error) {
    console.error('Error pausing auction:', error);
    return res.status(500).json({ error: 'Failed to pause auction' });
  }
};

// Resume auction
exports.resumeAuction = async (req, res) => {
  try {
    // Get the current auction state
    const { auctionState, timerManager } = require('../auction');

    if (!auctionState.isPaused) {
      return res.status(400).json({ error: 'Auction is not paused' });
    }

    // Restore auction state
    auctionState.isPaused = false;
    auctionState.isRunning = true;

    // Determine which timer to restart
    const isInWaitingPhase = auctionState.isWaiting;
    
    const io = require('../socket/auctionSocket').getIO();
    
    // Resume the appropriate timer
    if (isInWaitingPhase) {
      // Resume waiting timer
      timerManager.startWaitingTimer(() => {
        // This callback runs when the waiting timer completes
        auctionState.isWaiting = false;
        // Start the bidding for the current player
        startBiddingPhase(auctionState, timerManager);
      });
    } else {
      // Resume bid timer
      timerManager.startBidTimer(() => {
        // This callback runs when the bid timer completes
        handleBidTimerComplete(auctionState, timerManager);
      });
    }
    
    // Notify all clients about auction resumption
    if (io) {
      io.to('auction').emit('auction-resumed', {
        message: 'The auction has been resumed by the administrator'
      });
      
      // Emit updated auction status
      const { emitAuctionStatus } = require('../socket/auctionSocket');
    emitAuctionStatus(auctionState);
    }
    
    return res.status(200).json({ message: 'Auction resumed successfully', auctionState });
  } catch (error) {
    console.error('Error resuming auction:', error);
    return res.status(500).json({ error: 'Failed to resume auction' });
  }
};

// Helper function to start the bidding phase
function startBiddingPhase(auctionState, timerManager) {
  if (!auctionState.currentPlayerId) {
    console.error('No current player set for bidding phase');
    return;
  }
  
  const io = require('../socket/auctionSocket').getIO();
  if (io) {
    io.to('auction').emit('bidding-started', {
      playerId: auctionState.currentPlayerId,
      message: 'Bidding has started for this player'
    });
  }
  
  // Start the bid timer
  timerManager.startBidTimer(() => {
    handleBidTimerComplete(auctionState, timerManager);
  });
}

// Helper function to handle when the bid timer completes
function handleBidTimerComplete(auctionState, timerManager) {
  // If there's a highest bidder, sell the player
  if (auctionState.highestBidder) {
    const Player = require('../models/player');
    const Team = require('../models/team');
    const Bid = require('../models/bid');
    
    // Update the player as sold
    Player.updateOne(
      { _id: auctionState.currentPlayerId },
      { 
        status: 'SOLD', 
        soldTo: auctionState.highestBidder,
        soldAmount: auctionState.highestBid 
      }
    )
    .then(() => {
      // Update team's remaining budget
      return Team.updateOne(
        { _id: auctionState.highestBidder },
        { $inc: { remainingBudget: -auctionState.highestBid } }
      );
    })
    .then(() => {
      // Create a final bid record
      return Bid.create({
        playerId: auctionState.currentPlayerId,
        teamId: auctionState.highestBidder,
        amount: auctionState.highestBid,
        timestamp: new Date(),
        isFinal: true
      });
    })
    .then(() => {
      // Reset auction state for next player
      auctionState.highestBid = 0;
      auctionState.highestBidder = null;
      
      // Emit player sold notification
      const io = require('../socket/auctionSocket').getIO();
      if (io) {
        io.to('auction').emit('player-sold', {
          playerId: auctionState.currentPlayerId,
          teamId: auctionState.highestBidder,
          amount: auctionState.highestBid
        });
      }
      
      // Move to waiting state before next player
      auctionState.isWaiting = true;
      timerManager.startWaitingTimer(() => {
        auctionState.isWaiting = false;
        // Get next player
        getNextPlayer(auctionState, timerManager);
      });
    })
    .catch(error => {
      console.error('Error finalizing player sale:', error);
    });
  } else {
    // No one bid, mark player as unsold
    const Player = require('../models/player');
    
    Player.updateOne(
      { _id: auctionState.currentPlayerId },
      { status: 'UNSOLD' }
    )
    .then(() => {
      // Emit player unsold notification
      const io = require('../socket/auctionSocket').getIO();
      if (io) {
        io.to('auction').emit('player-unsold', {
          playerId: auctionState.currentPlayerId,
          message: 'Player remains unsold with no bids'
        });
      }
      
      // Move to waiting state before next player
      auctionState.isWaiting = true;
      timerManager.startWaitingTimer(() => {
        auctionState.isWaiting = false;
        // Get next player
        getNextPlayer(auctionState, timerManager);
      });
    })
    .catch(error => {
      console.error('Error marking player as unsold:', error);
    });
  }
}

// Helper function to get the next player for auction
function getNextPlayer(auctionState, timerManager) {
  const Player = require('../models/player');
  
  // Find the next available player
  Player.findOne({ status: 'AVAILABLE' })
    .sort({ _id: 1 })
    .then(player => {
      if (player) {
        auctionState.currentPlayerId = player._id;
        
        // Emit next player notification
        const io = require('../socket/auctionSocket').getIO();
        if (io) {
          io.to('auction').emit('next-player', {
            player: player,
            message: 'Next player up for auction'
          });
        }
        
        // Start bidding for this player
        startBiddingPhase(auctionState, timerManager);
      } else {
        // No more players available, end the auction
        endAuction({ body: {} }, { status: () => ({ json: () => {} }) });
      }
    })
    .catch(error => {
      console.error('Error getting next player:', error);
    });
}

// End auction
exports.endAuction = async (req, res) => {
  try {
    console.log('Ending auction...');
    
    // Stop any running timers
    timerManager.stopAllTimers();
    
    // Update auction state
    auctionState.isRunning = false;
    auctionState.isPaused = false;
    auctionState.isWaiting = false;
    auctionState.currentPlayer = null;
    
    // Get the IO instance for notifications
    const io = require('../socket/auctionSocket').getIO();
    
    // Send notification to all clients
    if (io) {
      io.to('auction').emit('auction-notification', {
        type: 'info',
        title: 'Auction Ended',
        message: 'The auction has been concluded by the administrator.'
      });
      
      // Emit updated status
      io.to('auction').emit('auction-status', {
        isRunning: false,
        isPaused: false,
        isWaiting: false,
        status: 'ended',
        message: 'Auction has concluded'
      });
      
      // Also emit legacy status field for backward compatibility
      io.to('auction').emit('auction-status-update', 'ended');
      
      // Emit auction results
      const results = await db.getAuctionResults();
      io.to('auction').emit('auction-results', results);
    }
    
    // Update database
    await db.endAuction();
    
    return res.json({ 
      message: 'Auction has been ended successfully',
      status: 'ended'
    });
  } catch (error) {
    console.error('Error ending auction:', error);
    return res.status(500).json({ 
      message: 'Error ending auction', 
      error: error.message 
    });
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
        // Make sure we're using the correct ID property (could be id, _id, or both)
        const playerId = auctionState.currentPlayer.id || auctionState.currentPlayer._id;
        await playerModel.updatePlayerStatus(playerId, 'unsold');
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
    
    // Get player using playerModel
    const player = await playerModel.getPlayerById(player_id);
    
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        status: 'error'
      });
    }

    // Ensure consistent property names
    // Convert base_price to basePrice if it doesn't exist
    if (player.base_price !== undefined && player.basePrice === undefined) {
      player.basePrice = player.base_price;
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
    auctionState.highestBid = player.basePrice || player.base_price; // Use whichever exists
    auctionState.highestBidder = null;
    
    // Emit player information to all clients
    emitPlayerUpdate({
      player: player,
      highestBid: auctionState.highestBid,
      highestBidder: null
    });
    
    timerManager.startBidTimer(() => {
      finalizePlayerSale();
    });
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting,
      status: 'running', // Add explicit status field
      currentPlayer: {
        id: player.id || player._id,
        name: player.name,
        role: player.role,
        basePrice: player.basePrice || player.base_price
      },
      timeRemaining: timerManager.getRemainingBidTime(),
      message: `Auction started for player ${player.name}`
    };
    
    // Emit the detailed status to all clients
    emitAuctionStatus(statusObj);
    
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
    
    // Use correct syntax for the find method with sorting
    const players = await Player.find(
      { isAuctioned: false },
      { basePrice: -1 }  // This sorts by basePrice in descending order
    );
    
    if (!players || players.length === 0) {
      console.log('No more players to auction');
      auctionState.isRunning = false;
      
      // Create a detailed status object for socket clients
      const statusObj = {
        isRunning: false,
        isPaused: false,
        isWaiting: false,
        status: 'ended',
        message: 'Auction ended. No more players available.'
      };
      
      // Emit the detailed status to all clients
      emitAuctionStatus(statusObj);
      return;
    }
    
    const nextPlayer = players[0];
    
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
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting,
      status: 'running',
      currentPlayer: {
        id: nextPlayer.id || nextPlayer._id,
        name: nextPlayer.name,
        role: nextPlayer.role,
        basePrice: nextPlayer.basePrice
      },
      timeRemaining: timerManager.getRemainingBidTime(),
      message: `Next player: ${nextPlayer.name}`
    };
    
    // Emit the detailed status to all clients
    emitAuctionStatus(statusObj);
    
    console.log(`Next player for auction: ${nextPlayer.name}, Base price: ${nextPlayer.basePrice}`);
  } catch (error) {
    console.error('Error fetching next player:', error);
  }
};

const finalizePlayerSale = async (isTimeout = true) => {
  try {
    if (!auctionState.currentPlayer) return;
    
    // Make sure we're using the correct ID property (could be id, _id, or both)
    const playerId = auctionState.currentPlayer.id || auctionState.currentPlayer._id;
    const playerName = auctionState.currentPlayer.name;
    
    // Log the finalization reason
    console.log(`Finalizing auction for ${playerName} - ${isTimeout ? 'TIMER EXPIRED' : 'MANUAL FINALIZATION'}`);
    
    // Get the IO instance
    const io = require('../socket/auctionSocket').getIO();
    
    if (auctionState.highestBidder) {
      // Player sold
      await playerModel.updatePlayerStatus(playerId, 'sold');
      await playerModel.updatePlayerTeam(playerId, auctionState.highestBidder.id || auctionState.highestBidder._id);
      
      // Update team budget
      const newBudget = auctionState.highestBidder.budget - auctionState.highestBid;
      await teamModel.updateTeamBudget(auctionState.highestBidder.id || auctionState.highestBidder._id, newBudget);
      
      // Record bid
      await bidModel.createBid({
        player: playerId,
        team: auctionState.highestBidder.id || auctionState.highestBidder._id,
        amount: auctionState.highestBid,
        timestamp: new Date(),
        auto_finalized: isTimeout
      });
      
      // Add to sold players
      auctionState.soldPlayers.push({
        playerId: playerId,
        playerName: auctionState.currentPlayer.name,
        soldToTeam: auctionState.highestBidder.id || auctionState.highestBidder._id,
        teamName: auctionState.highestBidder.name,
        amount: auctionState.highestBid,
        auto_finalized: isTimeout
      });
      
      // Prepare result message
      const resultMessage = isTimeout 
        ? `Time expired - Player automatically sold to highest bidder (${auctionState.highestBidder.name})`
        : `Player sold to ${auctionState.highestBidder.name} as highest bidder`;
      
      // Emit result
      emitAuctionResult({
        player: auctionState.currentPlayer,
        team: auctionState.highestBidder,
        amount: auctionState.highestBid,
        result: 'sold',
        auto_finalized: isTimeout,
        message: resultMessage
      });
      
      // Send message to all clients
      if (io) {
        io.to('auction').emit('auction-notification', {
          type: 'success',
          title: 'Player Sold',
          message: resultMessage
        });
      }
      
    } else {
      // Player unsold
      await playerModel.updatePlayerStatus(playerId, 'unsold');
      
      // Prepare result message
      const resultMessage = isTimeout 
        ? 'Time expired - No bids received, player marked as UNSOLD'
        : 'Player marked as UNSOLD';
      
      // Emit result
      emitAuctionResult({
        player: auctionState.currentPlayer,
        result: 'unsold',
        auto_finalized: isTimeout,
        message: resultMessage
      });
      
      // Send message to all clients
      if (io) {
        io.to('auction').emit('auction-notification', {
          type: 'warning',
          title: 'Player Unsold',
          message: resultMessage
      });
      }
    }
    
    // Reset current auction state
    timerManager.resetTimers();
    
    // Start waiting timer for next player
    auctionState.isWaiting = true;
    timerManager.startWaitingTimer(() => {
      fetchNextPlayer();
    });
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: true,
      status: 'waiting',
      previousPlayer: {
        name: playerName,
        sold: auctionState.highestBidder ? true : false,
        soldTo: auctionState.highestBidder ? auctionState.highestBidder.name : null,
        amount: auctionState.highestBidder ? auctionState.highestBid : null,
        auto_finalized: isTimeout
      },
      timeRemaining: timerManager.getRemainingWaitingTime(),
      message: 'Waiting for next player...'
    };
    
    // Emit the detailed status to all clients
    emitAuctionStatus(statusObj);
  } catch (error) {
    console.error('Error finalizing player sale:', error);
  }
};

// Reset auction data
exports.resetAuction = async (req, res) => {
  try {
    // Reset auction state
    auctionState.isRunning = false;
    auctionState.isPaused = false;
    auctionState.isWaiting = false;
    auctionState.currentPlayer = null;
    auctionState.highestBid = 0;
    auctionState.highestBidder = null;
    auctionState.soldPlayers = [];
    auctionState.unsoldPlayers = [];
    auctionState.currentRound = 1;
    
    // Stop all timers
    timerManager.stopAllTimers();
    timerManager.resetTimers();
    
    // Get IO instance for notifications
    const io = require('../socket/auctionSocket').getIO();
    
    // Optional: Reset specific player status if requested
    if (req.body.resetPlayerStatus) {
      try {
        await playerModel.resetAllPlayerStatus();
        console.log('Reset all player statuses to available');
      } catch (playerError) {
        console.error('Error resetting player statuses:', playerError);
      }
    }
    
    // Optional: Reset all bids if requested
    if (req.body.resetBids) {
      try {
        await bidModel.deleteAllBids();
        console.log('Deleted all bid history');
      } catch (bidError) {
        console.error('Error deleting bid history:', bidError);
      }
    }
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: false,
      isPaused: false,
      isWaiting: false,
      status: 'not_running',
      message: 'Auction has been reset and is ready to start'
    };
    
    // Emit the detailed status to all clients
    emitAuctionStatus(statusObj);
    
    // Send notification about auction reset
    if (io) {
      io.to('auction').emit('auction-notification', {
        type: 'info',
        title: 'Auction Reset',
        message: 'The auction has been reset by the administrator.'
      });
    }
    
    return res.json({ 
      message: 'Auction reset successfully', 
      status: 'not_running'
    });
  } catch (error) {
    console.error('Error resetting auction:', error);
    return res.status(500).json({ 
      message: 'Error resetting auction', 
      error: error.message 
    });
  }
};
