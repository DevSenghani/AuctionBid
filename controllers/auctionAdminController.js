/**
 * Auction Admin Controller
 * 
 * Handles admin-specific auction operations and management
 */

const { auctionState, timerManager, startAuction: startAuctionState, resumeAuction: resumeAuctionState } = require('../auction');
const auctionSocket = require('../socket/auctionSocket');
const playerModel = require('../models/playerModel');
const teamModel = require('../models/teamModel');
const db = require('../utils/database');
const { notifyAdminAction } = require('../middleware/auctionAdminMiddleware');
const AuctionResult = require('../models/auctionResult');

// Utility function to directly notify all clients about admin actions
function notifyAllClients(actionType, message, details = {}) {
  try {
    // Get IO instance
    const io = require('../socket/auctionSocket').getIO();
    
    if (io) {
      // Emit to all clients
      io.emit('admin-action', {
        action: actionType,
        message: message,
        timestamp: new Date().toISOString(),
        ...details
      });
      
      console.log(`[ADMIN ACTION] ${new Date().toISOString()} - ${actionType}: ${message}`);
    }
  } catch (error) {
    console.error('Error notifying clients:', error);
  }
}

// Start auction
exports.startAuction = async (req, res) => {
  try {
    console.log('Admin attempting to start auction...');
    
    // Check if auction is already running
    if (auctionState.isRunning) {
      return res.status(400).json({ 
        success: false,
        message: 'Auction is already running',
        status: 'running'
      });
    }
    
    // Check if auction is paused
    if (auctionState.isPaused) {
      console.log('Auction is paused, redirecting to resume function');
      // Call the resume function directly since auction is paused
      return this.resumeAuction(req, res);
    }
    
    // Get admin username from the session or request
    const adminUsername = req.adminUser?.username || req.session?.adminUsername || 'Admin';
    console.log(`Admin ${adminUsername} is starting the auction`);
    
    // Start the auction using the state management function
    startAuctionState();
    
    // Start waiting timer for next player
    timerManager.startWaitingTimer(() => {
      fetchNextPlayer();
    });
    
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
    auctionSocket.emitAuctionStatus(statusObj);
    
    // Notify all clients about the auction start
    notifyAllClients('start_auction', 
      `Auction has been started by admin ${adminUsername}`,
      { startTime: auctionState.startTime }
    );
    
    return res.status(200).json({ 
      success: true,
      message: 'Auction started successfully', 
      status: 'running',
      timeRemaining: timerManager.getRemainingWaitingTime()
    });
  } catch (error) {
    console.error('Error starting auction:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error starting auction',
      error: error.message
    });
  }
};

// Helper function to get the next player for auction
async function fetchNextPlayer() {
  try {
    if (!auctionState.isRunning || auctionState.isPaused) {
      return;
    }
    
    // Get available players
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
      auctionSocket.emitAuctionStatus(statusObj);
      return;
    }
    
    const nextPlayer = players[0];
    
    auctionState.currentPlayer = nextPlayer;
    auctionState.highestBid = nextPlayer.base_price || nextPlayer.basePrice;
    auctionState.highestBidder = null;
    auctionState.isWaiting = false;
    
    // Emit player update to all clients
    auctionSocket.emitPlayerUpdate({
      player: nextPlayer,
      highestBid: auctionState.highestBid,
      highestBidder: null
    });
    
    // Start bid timer
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
    auctionSocket.emitAuctionStatus(statusObj);
    
    console.log(`Next player for auction: ${nextPlayer.name}, Base price: ${nextPlayer.base_price || nextPlayer.basePrice}`);
  } catch (error) {
    console.error('Error fetching next player:', error);
  }
}

// Helper function to finalize player sale
async function finalizePlayerSale(isTimeout = true) {
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
      try {
        const updatedPlayer = await playerModel.updatePlayerStatus(playerId, 'sold');
        if (!updatedPlayer) {
          console.error(`Error updating status for player ID ${playerId} to sold`);
        }
        
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
        auctionSocket.emitAuctionResult({
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
        
      } catch (statusError) {
        console.error(`Error updating player status: ${statusError.message}`);
      }
    } else {
      // Player unsold
      try {
        const updatedPlayer = await playerModel.updatePlayerStatus(playerId, 'unsold');
        if (!updatedPlayer) {
          console.error(`Error updating status for player ID ${playerId} to unsold`);
        }
      } catch (statusError) {
        console.error(`Error marking player as unsold: ${statusError.message}`);
      }
      
      // Prepare result message
      const resultMessage = isTimeout 
        ? 'Time expired - No bids received, player marked as UNSOLD'
        : 'Player marked as UNSOLD';
      
      // Emit result
      auctionSocket.emitAuctionResult({
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
    auctionSocket.emitAuctionStatus(statusObj);
  } catch (error) {
    console.error('Error finalizing player sale:', error);
  }
}

// Export the helper functions
exports.fetchNextPlayer = fetchNextPlayer;
exports.finalizePlayerSale = finalizePlayerSale;

// Enhanced pause auction function with improved error handling and notifications
exports.pauseAuction = async (req, res) => {
  try {
    // Get admin username from the session or request
    const adminUsername = req.adminUser?.username || req.session?.adminUsername || 'Admin';
    console.log(`Admin ${adminUsername} is pausing the auction`);
    
    // Save the current state for resuming later
    const pauseReason = req.body.reason || 'Administrative action';
    const currentPlayerName = auctionState.currentPlayer?.name || 'No player';
    
    // Update auction state
    auctionState.isPaused = true;
    
    // Stop all timers and get remaining times
    const timers = timerManager.pauseAllTimers();
    
    // Record time of pause
    const pauseTime = new Date();
    auctionState.pauseTime = pauseTime;
    auctionState.pauseReason = pauseReason;
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: true, // We show running but paused instead of not running
      isPaused: true,
      isWaiting: auctionState.isWaiting,
      status: 'paused',
      pauseReason: pauseReason,
      pauseTime: pauseTime,
      timeRemaining: auctionState.isWaiting ? 
                     timerManager.getRemainingWaitingTime() : 
                     timerManager.getRemainingBidTime(),
      adminUser: adminUsername,
      message: `Auction has been paused by admin${pauseReason ? ': ' + pauseReason : ''}`
    };
    
    // Include current player info if available
    if (auctionState.currentPlayer) {
      statusObj.currentPlayer = {
        id: auctionState.currentPlayer.id || auctionState.currentPlayer._id,
        name: auctionState.currentPlayer.name,
        role: auctionState.currentPlayer.role,
        basePrice: auctionState.currentPlayer.basePrice || auctionState.currentPlayer.base_price
      };
    }
    
    // Check database connection before emitting status
    const db = require('../utils/database');
    const dbStatus = await db.checkConnection();
    if (!dbStatus.connected) {
      console.log('Database connection lost during admin pause, attempting to reconnect...');
      db.reconnect();
      console.log('Using mock database for this operation');
    }
    
    // Emit the detailed status to all clients
    auctionSocket.emitAuctionStatus(statusObj);
    
    // Notify all clients about the pause
    notifyAllClients('pause_auction', 
      `Auction has been paused by admin ${adminUsername}${pauseReason ? ' - ' + pauseReason : ''}`,
      { currentPlayer: currentPlayerName, pauseTime: pauseTime }
    );
    
    // Return success response
    return res.status(200).json({ 
      success: true,
      message: `Auction paused successfully${pauseReason ? ' - ' + pauseReason : ''}`, 
      paused_at: pauseTime,
      status: 'paused',
      timers: timers,
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

// Enhanced end auction function with improved error handling, notifications, and cleanup
exports.endAuction = async (req, res) => {
  try {
    // Get admin username from the session or request
    const adminUsername = req.adminUser?.username || req.session?.adminUsername || 'Admin';
    console.log(`Admin ${adminUsername} is ending the auction`);
    
    // Record auction end time and reason
    const endTime = new Date();
    const endReason = req.body.reason || 'Administrative action';
    
    // Get auction summary for the response before stopping
    const soldPlayersCount = auctionState.soldPlayers.length;
    const playerSummary = await getSoldPlayersSummary();
    
    // Stop all timers
    timerManager.stopAllTimers();
    
    // Update auction state
    auctionState.isRunning = false;
    auctionState.isPaused = false;
    auctionState.isWaiting = false;
    auctionState.endTime = endTime;
    auctionState.endReason = endReason;
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: false,
      isPaused: false,
      isWaiting: false,
      status: 'ended',
      endTime: endTime,
      endReason: endReason,
      adminUser: adminUsername,
      message: `Auction has been ended by admin${endReason ? ': ' + endReason : ''}`,
      summary: {
        soldPlayers: soldPlayersCount,
        totalAmount: playerSummary.totalAmount,
        teamsParticipated: playerSummary.teamsParticipated
      }
    };
    
    // Check database connection before proceeding
    const db = require('../utils/database');
    const dbStatus = await db.checkConnection();
    if (!dbStatus.connected) {
      console.log('Database connection lost during admin end auction, attempting to reconnect...');
      db.reconnect();
      console.log('Using mock database for this operation');
      
      // Even if reconnection fails, we continue with ending the auction
      // and will use file-based storage as a fallback
    }
    
    // Emit the detailed status to all clients
    auctionSocket.emitAuctionStatus(statusObj);
    
    // Notify all clients about the auction end
    notifyAllClients('end_auction', 
      `Auction has been ended by admin ${adminUsername}${endReason ? ' - ' + endReason : ''}`,
      { 
        endTime: endTime,
        soldPlayers: soldPlayersCount,
        totalAmount: playerSummary.totalAmount
      }
    );
    
    // Write auction results to database if needed
    try {
      // Create and save a new auction result using the model
      const auctionResult = new AuctionResult({
        endTime: endTime,
        endedBy: adminUsername,
        soldPlayers: auctionState.soldPlayers,
        totalAmount: playerSummary.totalAmount
      });
      
      await auctionResult.save();
      
      // Calculate statistics for response
      const statistics = auctionResult.calculateStatistics();
      
      return res.status(200).json({ 
        success: true,
        message: 'Auction ended successfully', 
        ended_at: endTime,
        status: 'ended',
        summary: statistics,
        dbStatus: dbStatus.connected ? 'connected' : 'using mock data'
      });
    } catch (dbError) {
      console.error('Error saving auction results to database:', dbError);
      // Still return success for ending the auction, but with a warning
      return res.status(200).json({
        success: true,
        message: 'Auction ended successfully, but there was an error saving results',
        status: 'ended',
        warning: dbError.message,
        dbStatus: 'error'
      });
    }
  } catch (error) {
    console.error('Error ending auction:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to end auction', 
      details: error.message 
    });
  }
};

// Helper function to get a summary of sold players
async function getSoldPlayersSummary() {
  try {
    // Get sold players from state
    const soldPlayerIds = auctionState.soldPlayers.map(p => p.playerId);
    
    // Default response if no players sold
    if (soldPlayerIds.length === 0) {
      return {
        totalAmount: 0,
        teamsParticipated: 0,
        playersByTeam: {}
      };
    }
    
    // Calculate total amount
    const totalAmount = auctionState.soldPlayers.reduce((sum, player) => sum + player.amount, 0);
    
    // Count unique teams
    const uniqueTeams = new Set(auctionState.soldPlayers.map(p => p.soldToTeam));
    
    // Group players by team
    const playersByTeam = {};
    auctionState.soldPlayers.forEach(player => {
      const teamId = player.soldToTeam;
      if (!playersByTeam[teamId]) {
        playersByTeam[teamId] = [];
      }
      playersByTeam[teamId].push({
        playerId: player.playerId,
        playerName: player.playerName,
        amount: player.amount
      });
    });
    
    return {
      totalAmount,
      teamsParticipated: uniqueTeams.size,
      playersByTeam
    };
  } catch (error) {
    console.error('Error getting sold players summary:', error);
    return {
      totalAmount: 0,
      teamsParticipated: 0,
      playersByTeam: {}
    };
  }
}

// Get auction admin stats
exports.getAuctionAdminStats = async (req, res) => {
  try {
    // Get auction state stats
    const stats = {
      currentStatus: auctionState.isPaused ? 'paused' : 
                    (auctionState.isRunning ? 'running' : 'not_running'),
      soldPlayers: auctionState.soldPlayers.length,
      availablePlayers: await playerModel.getAvailablePlayers().then(players => players.length).catch(() => 0),
      totalTeams: await teamModel.getAllTeams().then(teams => teams.length).catch(() => 0),
      timeRemaining: auctionState.isWaiting ? 
                    timerManager.getRemainingWaitingTime() : 
                    timerManager.getRemainingBidTime(),
      isWaiting: auctionState.isWaiting,
      currentRound: auctionState.currentRound
    };
    
    // Add current player info if available
    if (auctionState.currentPlayer) {
      stats.currentPlayer = {
        id: auctionState.currentPlayer.id || auctionState.currentPlayer._id,
        name: auctionState.currentPlayer.name,
        role: auctionState.currentPlayer.role,
        basePrice: auctionState.currentPlayer.basePrice || auctionState.currentPlayer.base_price
      };
      
      // Add highest bid info if available
      if (auctionState.highestBidder) {
        stats.currentBid = {
          amount: auctionState.highestBid,
          team: {
            id: auctionState.highestBidder.id || auctionState.highestBidder._id,
            name: auctionState.highestBidder.name
          }
        };
      }
    }
    
    // Return the stats
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting auction admin stats:', error);
    return res.status(500).json({ 
      error: 'Failed to get auction admin stats', 
      details: error.message 
    });
  }
};

// Resume auction
exports.resumeAuction = async (req, res) => {
  try {
    console.log('Validating resume request, current auction state:', { 
      isRunning: auctionState.isRunning, 
      isPaused: auctionState.isPaused 
    });
    
    // Check if auction is paused
    if (!auctionState.isPaused) {
      return res.status(400).json({ 
        success: false,
        message: 'Auction is not paused. Cannot resume.',
        status: 'not_paused'
      });
    }
    
    // Get admin username from the session or request
    const adminUsername = req.adminUser?.username || req.session?.adminUsername || 'admin';
    console.log(`Admin ${adminUsername} is resuming the auction`);
    
    // Resume the auction using the state management function
    resumeAuctionState();
    
    // Determine which timer to restart based on stored pause state
    const pauseState = timerManager.getPauseState();
    console.log('Resuming from pause state:', pauseState);
    
    if (pauseState.waitingTimeRemaining > 0) {
      // We were in waiting phase when paused
      console.log('Resuming waiting timer with', pauseState.waitingTimeRemaining, 'seconds remaining');
      timerManager.resumeWaitingTimer(() => {
        // Fetch next player when waiting timer completes
        fetchNextPlayer();
      });
    } else if (pauseState.bidTimeRemaining > 0) {
      // We were in bidding phase when paused
      console.log('Resuming bid timer with', pauseState.bidTimeRemaining, 'seconds remaining');
      timerManager.resumeBidTimer(() => {
        // Finalize player sale when bid timer completes
        finalizePlayerSale(true);
      });
    } else {
      // No timer was active, start waiting timer for next player
      console.log('No active timer found, starting waiting timer');
      timerManager.startWaitingTimer(() => {
        fetchNextPlayer();
      });
    }
    
    // Create a detailed status object for socket clients
    const statusObj = {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting,
      status: 'running',
      timeRemaining: auctionState.isWaiting ? 
                     timerManager.getRemainingWaitingTime() : 
                     timerManager.getRemainingBidTime(),
      message: 'Auction has been resumed'
    };
    
    // Emit the detailed status to all clients
    auctionSocket.emitAuctionStatus(statusObj);
    
    // Notify all clients about the auction resume
    notifyAllClients('resume_auction', 
      `Auction resumed by admin ${adminUsername}`,
      { resumeTime: new Date() }
    );
    
    return res.status(200).json({ 
      success: true,
      message: 'Auction resumed successfully', 
      status: 'running',
      timeRemaining: auctionState.isWaiting ? 
                     timerManager.getRemainingWaitingTime() : 
                     timerManager.getRemainingBidTime()
    });
  } catch (error) {
    console.error('Error resuming auction:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error resuming auction',
      error: error.message
    });
  }
}; 