/**
 * Socket.IO for live bidding functionality
 * Handles real-time bid events from teams during the auction
 */

const socketAuthMiddleware = require('../middleware/socketAuthMiddleware');
const { auctionState, timerManager } = require('../auction');

// Import modules with error handling
let bidModel, teamModel, playerModel, config;
try {
  bidModel = require('../models/bidModel');
  teamModel = require('../models/teamModel');
  playerModel = require('../models/playerModel');
  config = require('../config/config');
} catch (error) {
  console.error('Error loading modules for bidSocket:', error.message);
}

module.exports = (io) => {
  if (!io) {
    console.error('Socket.IO instance not provided to bidSocket');
    return null;
  }

  // Create a namespace for bidding
  const bidNamespace = io.of('/bid');
  
  // Apply authentication middleware
  bidNamespace.use(socketAuthMiddleware);
  
  bidNamespace.on('connection', (socket) => {
    console.log(`Bid socket connected: ${socket.id}, Team: ${socket.user?.team_name || 'Unknown'}`);
    
    // Join team-specific room
    if (socket.user?.team_id) {
      socket.join(`team_${socket.user.team_id}`);
    }
    
    // Join auction room
    socket.join('auction_room');
    
    // Debug event to check connection status
    socket.emit('connection_debug', {
      connected: true,
      team_id: socket.user?.team_id,
      team_name: socket.user?.team_name,
      authenticated: socket.user?.authenticated || false
    });
    
    // Handle client requesting to place a bid
    socket.on('place_bid', async (data) => {
      try {
        // Check if all required modules are loaded
        if (!bidModel || !teamModel || !playerModel) {
          throw new Error('Required modules not available');
        }

        const { player_id, amount } = data;
        
        // Validate user has team information 
        if (!socket.user?.team_id) {
          return socket.emit('bid_error', { 
            message: 'You must be logged in as a team to place bids' 
          });
        }
        
        console.log('Processing bid from team:', {
          teamId: socket.user.team_id,
          teamName: socket.user.team_name,
          authenticated: socket.user.authenticated
        });
        
        // Get player and validate
        const player = await playerModel.getPlayerById(player_id);
        if (!player) {
          return socket.emit('bid_error', { message: 'Player not found' });
        }
        
        // Get team and validate
        const team = await teamModel.getTeamById(socket.user.team_id);
        if (!team) {
          return socket.emit('bid_error', { message: 'Team not found' });
        }
        
        // Check team budget
        if (team.budget < amount) {
          return socket.emit('bid_error', { 
            message: 'Your team does not have enough budget for this bid' 
          });
        }
        
        // Check if auction is actually running
        if (!auctionState.isRunning || auctionState.isPaused) {
          return socket.emit('bid_error', { 
            message: 'Auction is not active' 
          });
        }
        
        // Check if this player is the current player being auctioned
        const currentPlayerId = auctionState.currentPlayer?.id || auctionState.currentPlayer?._id;
        if (currentPlayerId != player_id) { // Using loose comparison for both string and object IDs
          return socket.emit('bid_error', { 
            message: 'This player is not currently being auctioned' 
          });
        }
        
        // Get current highest bid
        const highestBid = await bidModel.getHighestBid(player_id);
        
        // Validate bid amount
        if (highestBid && amount <= highestBid.amount) {
          return socket.emit('bid_error', { 
            message: 'Bid amount must be higher than current highest bid' 
          });
        }
        
        // Also check against the global state
        if (amount <= auctionState.highestBid) {
          return socket.emit('bid_error', { 
            message: 'Bid amount must be higher than current highest bid' 
          });
        }
        
        // Create new bid
        const newBid = {
          player_id,
          team_id: socket.user.team_id,
          team_name: socket.user.team_name,
          amount,
          timestamp: new Date()
        };
        
        // Save bid to database
        await bidModel.createBid(newBid);
        
        // Update the global auction state *** IMPORTANT ***
        auctionState.highestBid = amount;
        auctionState.highestBidder = team;
        
        // Emit the bid to all clients in auction room
        bidNamespace.to('auction_room').emit('new-bid', {
          ...newBid,
          player_name: player.name
        });
        
        // Also emit to main namespace for compatibility
        io.to('auction').emit('new-bid', {
          ...newBid,
          player_name: player.name
        });
        
        // Emit success to the bidding team
        socket.emit('bid_placed', { 
          success: true, 
          message: 'Bid placed successfully. You are now the highest bidder.',
          amount: amount
        });
        
        // Reset the bid timer if it's getting low (less than 15 seconds)
        const remainingTime = timerManager.getRemainingBidTime();
        if (remainingTime < 15) {
          console.log('Extending bid timer after new bid');
          // Stop and restart the timer
          timerManager.stopBidTimer();
          // Use the finalizePlayerSale function from auction controller
          const { finalizePlayerSale } = require('../controllers/auctionController');
          timerManager.startBidTimer(() => {
            // When timer completes, finalize sale
            finalizePlayerSale(true);
          });
        }
        
      } catch (error) {
        console.error('Error processing bid:', error);
        socket.emit('bid_error', { 
          message: 'Error processing bid', 
          error: error.message 
        });
      }
    });
    
    // Handle getting bid history for a player
    socket.on('get_bid_history', async (data) => {
      try {
        const { player_id } = data;
        const bids = await bidModel.getBidsByPlayer(player_id);
        socket.emit('bid_history', { player_id, bids });
      } catch (error) {
        console.error('Error getting bid history:', error);
        socket.emit('bid_error', { 
          message: 'Error retrieving bid history', 
          error: error.message 
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Bid socket disconnected: ${socket.id}`);
    });
  });
  
  return bidNamespace;
};