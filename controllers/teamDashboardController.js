const teamModel = require('../models/teamModel');
const playerModel = require('../models/playerModel');
const bidModel = require('../models/bidModel');
const db = require('../utils/database');

// Show team dashboard
exports.showDashboard = async (req, res) => {
  try {
    console.log('Loading team dashboard...');
    
    // Get team information
    const teamId = req.session.teamId;
    const team = await teamModel.getTeamById(teamId);
    
    if (!team) {
      console.error(`Team with ID ${teamId} not found`);
      req.session.message = {
        type: 'danger',
        text: 'Team not found. Please login again.'
      };
      return res.redirect('/team/login');
    }
    
    // Get team players
    let team_players = [];
    try {
      team_players = await playerModel.getPlayersByTeam(teamId);
      console.log(`Retrieved ${team_players.length} players for team ID ${teamId}`);
    } catch (playerError) {
      console.error('Error fetching team players:', playerError);
      team_players = []; // Set to empty array to prevent template issues
    }
    
    // Get bid history for this team
    let bid_history = [];
    try {
      const bids = await bidModel.getBidsByTeam(teamId);
      console.log(`Retrieved ${bids.length} bids for team ID ${teamId}`);
      
      // Enhance the bid data with additional information
      for (const bid of bids) {
        try {
          const highestBid = await bidModel.getHighestBid(bid.player_id);
          
          bid_history.push({
            ...bid,
            is_winning: highestBid && highestBid.id === bid.id,
            is_active: !bid.player.team_id || bid.player.status === 'available' // auction still active if player has no team or status is available
          });
        } catch (innerError) {
          console.error(`Error processing bid for player ${bid.player_id}:`, innerError);
        }
      }
    } catch (bidError) {
      console.error('Error fetching team bid history:', bidError);
      bid_history = []; // Set to empty array to prevent template issues
    }
    
    res.render('team_dashboard', {
      team,
      team_players,
      bid_history,
      usingMockDb: db.isMockDb()
    });
  } catch (error) {
    console.error('Error loading team dashboard:', error);
    res.status(500).send('Error loading team dashboard: ' + error.message);
  }
};

// Get information about active auctions
exports.getActiveAuction = async (req, res) => {
  try {
    const teamId = req.session.teamId;
    
    // Get team information for current budget
    const team = await teamModel.getTeamById(teamId);
    
    // Check if there's an active auction
    let active_auction = null;
    const availablePlayers = await playerModel.getAvailablePlayers();
    
    if (availablePlayers && availablePlayers.length > 0) {
      const currentPlayer = availablePlayers[0]; // Get the first available player
      const highestBid = await bidModel.getHighestBid(currentPlayer.id);
      
      active_auction = {
        player_id: currentPlayer.id,
        player_name: currentPlayer.name,
        player_role: currentPlayer.role,
        base_price: currentPlayer.base_price,
        highest_bid: highestBid ? highestBid.amount : null,
        highest_bidder: highestBid ? highestBid.team_name : null
      };
    }
    
    res.json({
      active_auction,
      team_budget: team ? team.budget : 0
    });
  } catch (error) {
    console.error('Error getting active auction information:', error);
    res.status(500).json({ error: 'Failed to get auction information' });
  }
}; 