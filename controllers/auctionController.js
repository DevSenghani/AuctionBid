// controllers/auctionController.js

const playerModel = require('../models/playerModel');
const teamModel = require('../models/teamModel');
const bidModel = require('../models/bidModel');
const db = require('../utils/database');
const auctionSocket = require('../socket/auctionSocket');
const auctionMiddleware = require('../middleware/auctionMiddleware');
const { auctionState, timerManager, resetAuctionState } = require('../auction');
const Player = require('../models/player');
const Team = require('../models/team');
const AuctionResult = require('../models/auctionResult');
const config = require('../config/auctionConfig');
const { emitAuctionStatus, emitPlayerUpdate, emitAuctionResult } = require('../socket/auctionSocket');

// Global state debugging
console.log('AuctionController initialized, global auction state:', {
  isRunning: auctionState.isRunning,
  isPaused: auctionState.isPaused,
  isWaiting: auctionState.isWaiting
});

// Default time for each player auction in seconds
const DEFAULT_PLAYER_AUCTION_TIME = 30;
const DEFAULT_WAITING_TIME = 10;

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

// Show projector view
exports.showProjectorView = async (req, res) => {
  try {
    console.log('Loading projector view...');
    
    res.render('projector', {
      title: 'Cricket Auction - Projector View'
    });
  } catch (error) {
    console.error('Error loading projector view:', error);
    res.status(500).send('Error loading projector view: ' + error.message);
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
    
    // Input validation
    if (!teamId || !bidAmount) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: teamId and bidAmount are required' 
      });
    }
    
    // Ensure bidAmount is a number
    const parsedBidAmount = parseInt(bidAmount, 10);
    if (isNaN(parsedBidAmount)) {
      return res.status(400).json({ 
        success: false,
        message: 'Bid amount must be a valid number' 
      });
    }
    
    // Check auction state
    if (!auctionState.isRunning || auctionState.isPaused) {
      return res.status(400).json({ 
        success: false,
        message: 'Auction is not active' 
      });
    }
    
    if (!auctionState.currentPlayer) {
      return res.status(400).json({ 
        success: false,
        message: 'No player currently up for auction' 
      });
    }
    
    // Ensure bid amount is higher than current highest bid
    const minBidIncrement = config.auction.minBidIncrement || 1000;
    if (parsedBidAmount <= auctionState.highestBid) {
      return res.status(400).json({ 
        success: false,
        message: 'Bid amount must be higher than current highest bid',
        currentHighestBid: auctionState.highestBid
      });
    }
    
    // Ensure bid increment is valid (at least minBidIncrement more than current highest)
    if (parsedBidAmount < auctionState.highestBid + minBidIncrement) {
      return res.status(400).json({ 
        success: false,
        message: `Bid must be at least ${minBidIncrement} more than current highest bid`,
        currentHighestBid: auctionState.highestBid,
        minimumBid: auctionState.highestBid + minBidIncrement
      });
    }
    
    // Get the team that placed the bid
    const team = await teamModel.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ 
        success: false,
        message: 'Team not found' 
      });
    }
    
    // Check if team has enough budget
    if (team.budget < parsedBidAmount) {
      return res.status(400).json({ 
        success: false,
        message: 'Not enough budget to place this bid',
        budget: team.budget,
        bidAmount: parsedBidAmount
      });
    }
    
    // Log bid information
    console.log(`Team ${team.name} bid ${parsedBidAmount} for player ${auctionState.currentPlayer.name}`);
    
    // Update highest bid in auction state
    auctionState.highestBid = parsedBidAmount;
    auctionState.highestBidder = team;
    
    // Save bid to database if applicable
    try {
      await bidModel.createBid({
        player_id: auctionState.currentPlayer.id || auctionState.currentPlayer._id,
        team_id: team.id || team._id,
        amount: parsedBidAmount
      });
    } catch (dbError) {
      console.error('Error saving bid to database:', dbError);
      // Continue even if database save fails - we already updated auction state
    }
    
    // Emit the update to all clients
    const io = require('../socket/auctionSocket').getIO();
    if (io) {
      io.to('auction').emit('new-bid', {
        player_id: auctionState.currentPlayer.id || auctionState.currentPlayer._id,
        team_id: team.id || team._id,
        team_name: team.name,
        amount: parsedBidAmount,
        timestamp: new Date()
      });
    }
    
    // Reset the bid timer if it's getting low
    const bidTimeExtension = config.auction.bidTimeExtension || 15;
    const remainingTime = timerManager.getRemainingBidTime();
    if (remainingTime < bidTimeExtension) { // If less than X seconds remaining
      console.log(`Timer extended due to new bid (${remainingTime}s remaining)`);
      
      // Extend the timer
      timerManager.stopBidTimer();
      timerManager.startBidTimer(() => {
        finalizePlayerSale(true);
      });
    }
    
    return res.status(200).json({ 
      success: true,
      message: 'Bid placed successfully',
      highestBid: auctionState.highestBid,
      highestBidder: team.name,
      timeRemaining: timerManager.getRemainingBidTime()
    });
  } catch (error) {
    console.error('Error placing bid:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to place bid',
      error: error.message 
    });
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
    console.log('Attempting to start auction...');
    
    // Check if auction is already running
    if (auctionState.isRunning) {
      console.log('Auction is already running, cannot start again');
      return res.status(400).json({ 
        success: false,
        message: 'Auction is already running',
        status: 'running'
      });
    }

    // Check if auction is paused
    if (auctionState.isPaused) {
      console.log('Auction is paused, resuming instead of starting new');
      return res.status(400).json({ 
        success: false,
        message: 'Auction is paused. Please resume the auction instead.',
        status: 'paused'
      });
    }

    // Check if auction has ended
    if (auctionState.isAuctionEnded) {
      console.log('Previous auction has ended, resetting state before starting new auction');
      resetAuctionState();
    }

    console.log('Starting new auction...');
    
    // Use the new startAuction function
    startAuction();
    
    // Log admin user who started the auction
    const adminUser = req.session?.admin?.username || 'Admin';
    console.log(`Auction started by ${adminUser} at ${auctionState.startTime}`);
    
    // Start waiting timer for next player
    try {
      timerManager.startWaitingTimer(() => {
        fetchNextPlayer();
      });
    } catch (timerError) {
      console.error('Error starting waiting timer:', timerError);
      // Reset auction state since timer failed
      resetAuctionState();
      throw new Error('Failed to start auction timer');
    }
    
    // Get socket emitter functions
    const { emitAuctionStatus, emitStateChange } = require('../socket/auctionSocket');
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting,
      status: 'waiting',
      timeRemaining: timerManager.getRemainingWaitingTime(),
      message: 'Auction has started. Selecting first player...',
      startTime: auctionState.startTime
    };
    
    // Emit the detailed status to all clients
    emitAuctionStatus(statusObj);
    
    // Emit state change event
    emitStateChange('not_running', 'running', 'Auction started by administrator', adminUser);
    
    // Emit auction notification to all clients
    const io = require('../socket/auctionSocket').getIO();
    if (io) {
      io.to('auction').emit('auction-notification', {
        type: 'success',
        title: 'Auction Started',
        message: 'The auction has been started by the administrator'
      });
    }
    
    return res.json({ 
      success: true,
      message: 'Auction started successfully', 
      status: 'running',
      timeRemaining: timerManager.getRemainingWaitingTime()
    });
  } catch (error) {
    console.error('Error starting auction:', error);
    // Reset auction state on error
    resetAuctionState();
    return res.status(500).json({ 
      success: false,
      message: 'Error starting auction',
      error: error.message
    });
  }
};

// Pause auction
exports.pauseAuction = async (req, res) => {
  try {
    console.log('Pause auction requested...');
    
    // Check if auction is running
    if (!auctionState.isRunning) {
      return res.status(400).json({ 
        success: false,
        error: 'No auction is currently running',
        status: 'not_running'
      });
    }

    // Check if auction is already paused
    if (auctionState.isPaused) {
      return res.status(400).json({ 
        success: false,
        error: 'Auction is already paused',
        status: 'paused'
      });
    }

    console.log('Current auction state before pause:', {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting
    });

    // Use the new pauseAuction function
    pauseAuction();
    
    // Pause all active timers and store the remaining times
    const timers = timerManager.pauseAllTimers();
    
    console.log('Updated auction state after pause:', {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting
    });
    
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
      emitAuctionStatus({
        isRunning: true,
        isPaused: true,
        isWaiting: auctionState.isWaiting,
        status: 'paused',
        message: 'Auction has been paused',
        currentPlayer: auctionState.currentPlayer
      });
    }

    // Check database connection before returning response
    const dbStatus = await db.checkConnection();
    if (!dbStatus.connected) {
      console.log('Database connection lost during pause, attempting to reconnect...');
      db.reconnect();
      console.log('Using mock database for this operation');
    }

    return res.status(200).json({ 
      success: true,
      message: 'Auction paused successfully', 
      status: 'paused',
      timers,
      dbStatus: dbStatus.connected ? 'connected' : 'using mock data'
    });
  } catch (error) {
    console.error('Error pausing auction:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to pause auction',
      details: error.message
    });
  }
};

// Resume auction
exports.resumeAuction = async (req, res) => {
  try {
    console.log('Resume auction requested...');
    
    console.log('Current auction state before resume:', {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting
    });

    if (!auctionState.isPaused) {
      return res.status(400).json({ error: 'Auction is not paused' });
    }

    // Use the new resumeAuction function
    resumeAuction();

    // Determine which timer to restart
    const isInWaitingPhase = auctionState.isWaiting;
    
    console.log('Updated auction state after resume:', {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting
    });
    
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
      emitAuctionStatus({
        isRunning: auctionState.isRunning,
        isPaused: auctionState.isPaused,
        isWaiting: auctionState.isWaiting,
        status: 'running',
        message: 'Auction has been resumed'
      });
    }
    
    return res.status(200).json({ 
      message: 'Auction resumed successfully', 
      status: 'running'
    });
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
  console.log('Bid timer completed');
  // Instead of handling the auction completion here, use the finalizePlayerSale function
  // which has better handling of the player marking as UNSOLD
  finalizePlayerSale(true);
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
    console.log('End auction requested...');
    
    // Check if auction is running or paused
    if (!auctionState.isRunning && !auctionState.isPaused) {
      return res.status(400).json({ 
        success: false,
        error: 'No auction is currently running or paused',
        status: 'not_running'
      });
    }

    console.log('Current auction state before ending:', {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting
    });

    // Stop all timers
    timerManager.stopAllTimers();
    
    // Use the new endAuction function
    endAuction();

    // Check database connection before proceeding with database operations
    const dbStatus = await db.checkConnection();
    if (!dbStatus.connected) {
      console.log('Database connection lost during end auction, attempting to reconnect...');
      db.reconnect();
      console.log('Using mock database for this operation');
    }

    // Create summary of sold players
    const soldPlayersList = auctionState.soldPlayers ? Object.values(auctionState.soldPlayers) : [];
    const unsoldPlayersList = auctionState.unsoldPlayers ? Object.values(auctionState.unsoldPlayers) : [];

    // Calculate total amount
    const totalAmount = soldPlayersList.reduce((total, player) => {
      return total + (player.soldAmount || 0);
    }, 0);

    // Get unique teams that participated
    const teamsParticipated = [...new Set(soldPlayersList.map(player => player.teamId))];

    // Create auction result record
    const auctionResult = new AuctionResult({
      endTime: new Date(),
      endedBy: req.user ? req.user.username : 'system',
      soldPlayers: soldPlayersList,
      unsoldPlayers: unsoldPlayersList,
      totalAmount: totalAmount,
      totalPlayers: soldPlayersList.length + unsoldPlayersList.length,
      teamsParticipated: teamsParticipated,
      reason: req.body.reason || 'Auction completed by admin'
    });

    try {
      // Save the auction result
      await auctionResult.save();
    } catch (saveError) {
      console.error('Error saving auction result, but continuing with auction end:', saveError);
      // We still continue with ending the auction, just log the error
    }

    // Notify all clients that auction has ended
    const io = require('../socket/auctionSocket').getIO();
    if (io) {
      io.emit('auction_ended', {
        message: 'Auction has ended',
        endTime: new Date(),
        endedBy: req.user ? req.user.username : 'system',
        totalPlayers: soldPlayersList.length,
        totalAmount: totalAmount
      });
      
      // Emit updated auction status
      const { emitAuctionStatus } = require('../socket/auctionSocket');
      emitAuctionStatus({
        isRunning: false,
        isPaused: false,
        isWaiting: false,
        status: 'ended',
        message: 'Auction has ended',
        summary: {
          soldPlayers: soldPlayersList.length,
          totalAmount: totalAmount,
          teamsParticipated: teamsParticipated.length
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Auction ended successfully',
      summary: {
        soldPlayers: soldPlayersList.length,
        totalAmount: totalAmount,
        teamsParticipated: teamsParticipated.length
      },
      dbStatus: dbStatus.connected ? 'connected' : 'using mock data'
    });
  } catch (error) {
    console.error('Error ending auction:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to end auction',
      details: error.message
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
    // Get player_id from body or params
    const player_id = req.body.player_id || req.params.id;
    
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
    
    // Get Player model - ensure we import the model correctly
    const playerModel = require('../models/playerModel');
    
    // Use playerModel to get available players
    const players = await playerModel.getAvailablePlayers();
    
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
    auctionState.highestBid = nextPlayer.base_price || nextPlayer.basePrice;
    auctionState.highestBidder = null;
    auctionState.isWaiting = false;
    
    // Get the socket emit function
    const { emitPlayerUpdate } = require('../socket/auctionSocket');
    
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
        basePrice: nextPlayer.base_price || nextPlayer.basePrice
      },
      timeRemaining: timerManager.getRemainingBidTime(),
      message: `Next player: ${nextPlayer.name}`
    };
    
    // Emit the detailed status to all clients
    const { emitAuctionStatus } = require('../socket/auctionSocket');
    emitAuctionStatus(statusObj);
    
    console.log(`Next player for auction: ${nextPlayer.name}, Base price: ${nextPlayer.base_price || nextPlayer.basePrice}`);
  } catch (error) {
    console.error('Error fetching next player:', error);
  }
};

const finalizePlayerSale = async (isTimeout = true) => {
  try {
    if (!auctionState.currentPlayer) {
      console.log('No current player found in auction state, cannot finalize sale');
      return;
    }
    
    // Make sure we're using the correct ID property (could be id, _id, or both)
    const playerId = auctionState.currentPlayer.id || auctionState.currentPlayer._id;
    const playerName = auctionState.currentPlayer.name;
    
    // First validate player exists in the database
    const player = await playerModel.getPlayerById(playerId);
    if (!player) {
      console.error(`Error finalizing player sale: Player with ID ${playerId} not found in database`);
      
      // Still emit an auction status update to keep UI in sync
      emitAuctionStatus({
        isRunning: auctionState.isRunning,
        isPaused: false,
        isWaiting: true,
        status: 'waiting',
        error: `Player with ID ${playerId} not found in database`,
        message: 'Error occurred. Moving to next player...'
      });
      
      // Start waiting timer for next player
      auctionState.isWaiting = true;
      timerManager.startWaitingTimer(() => {
        fetchNextPlayer();
      });
      
      return;
    }
    
    // Log the finalization reason
    console.log(`Player ${playerName} sold for ${auctionState.highestBid} by team ${auctionState.highestBidder?.name || 'unknown'}`);
    
    // Update player status
    await playerModel.updatePlayerStatus(playerId, 'sold');
    
    // Add player to sold players list
    auctionState.soldPlayers = {
      ...auctionState.soldPlayers,
      [playerId]: {
        playerId,
        playerName,
        teamId: auctionState.highestBidder?._id || null,
        teamName: auctionState.highestBidder?.name || 'unknown',
        soldAmount: auctionState.highestBid,
        soldTime: new Date()
      }
    };
    
    // Remove player from unsold players list
    auctionState.unsoldPlayers = {
      ...auctionState.unsoldPlayers,
      [playerId]: {
        playerId,
        playerName,
        unsoldTime: new Date()
      }
    };
    
    // Reset auction state
    resetAuctionState();
    
    // Emit updated auction status
    emitAuctionStatus({
      isRunning: false,
      isPaused: false,
      isWaiting: false,
      status: 'ended',
      message: 'Player sold',
      summary: {
        soldPlayers: Object.keys(auctionState.soldPlayers).length,
        totalAmount: auctionState.highestBid,
        teamsParticipated: [auctionState.highestBidder?._id]
      }
    });
    
    // Notify all clients about auction end
    const io = require('../socket/auctionSocket').getIO();
    if (io) {
      io.emit('auction_ended', {
        message: 'Player sold',
        endTime: new Date(),
        endedBy: req.user ? req.user.username : 'system',
        totalPlayers: Object.keys(auctionState.soldPlayers).length,
        totalAmount: auctionState.highestBid
      });
    }
  } catch (error) {
    console.error('Error finalizing player sale:', error);
    // Reset auction state on error
    resetAuctionState();
  }
};

// Reset auction data
exports.resetAuction = async (req, res) => {
  try {
    // Reset auction state
    resetAuctionState();
    
    // Stop all timers
    timerManager.stopAllTimers();
    
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