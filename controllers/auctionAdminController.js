/**
 * Auction Admin Controller
 * 
 * Handles admin-specific auction operations and management
 */

const { auctionState, timerManager } = require('../auction');
const auctionSocket = require('../socket/auctionSocket');
const playerModel = require('../models/playerModel');
const teamModel = require('../models/teamModel');
const db = require('../utils/database');
const { notifyAdminAction } = require('../middleware/auctionAdminMiddleware');
const AuctionResult = require('../models/auctionResult');

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
    
    // Emit the detailed status to all clients
    auctionSocket.emitAuctionStatus(statusObj);
    
    // Notify all clients about the pause
    notifyAdminAction('pause_auction', 
      `Auction has been paused by admin ${adminUsername}${pauseReason ? ' - ' + pauseReason : ''}`,
      { currentPlayer: currentPlayerName, pauseTime: pauseTime }
    );
    
    // Return success response
    return res.status(200).json({ 
      success: true,
      message: `Auction paused successfully${pauseReason ? ' - ' + pauseReason : ''}`, 
      paused_at: pauseTime,
      status: 'paused',
      timers: timers
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
    
    // Emit the detailed status to all clients
    auctionSocket.emitAuctionStatus(statusObj);
    
    // Notify all clients about the auction end
    notifyAdminAction('end_auction', 
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
        summary: statistics
      });
    } catch (dbError) {
      console.error('Error saving auction results to database:', dbError);
      // Still return success for ending the auction, but with a warning
      return res.status(200).json({
        success: true,
        message: 'Auction ended successfully, but there was an error saving results',
        status: statusObj,
        warning: dbError.message
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