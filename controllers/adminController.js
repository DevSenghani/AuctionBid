const teamModel = require('../models/teamModel');
const playerModel = require('../models/playerModel');
const bidModel = require('../models/bidModel');
const db = require('../utils/database');

// Show admin dashboard
exports.showAdminDashboard = async (req, res) => {
  try {
    console.log('Loading admin dashboard...');
    
    // Check if we're using the mock database
    if (db.isMockDb()) {
      console.log('Using mock database for admin dashboard');
    }
    
    let teams = [];
    let players = [];
    
    try {
      teams = await teamModel.getAllTeams();
      console.log(`Retrieved ${teams.length} teams`);
      
      // Get players for each team
      for (let team of teams) {
        team.players = await teamModel.getTeamPlayers(team.id);
      }
    } catch (teamError) {
      console.error('Error fetching teams:', teamError);
      teams = []; // Set to empty array to prevent template issues
    }
    
    try {
      players = await playerModel.getAllPlayers();
      console.log(`Retrieved ${players.length} players`);
    } catch (playerError) {
      console.error('Error fetching players:', playerError);
      players = []; // Set to empty array to prevent template issues
    }
    
    res.render('admin_dashboard', { 
      title: 'Admin Dashboard',
      teams,
      players,
      adminUsername: req.session.adminUsername || null,
      usingMockDb: db.isMockDb()
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).send('Error loading admin dashboard: ' + error.message);
  }
};

// Create a new team
exports.createTeam = async (req, res) => {
  try {
    const { name, owner, budget, password } = req.body;
    const teamData = { name, owner, budget, password };
    const team = await teamModel.createTeam(teamData);
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

// Create a new player
exports.createPlayer = async (req, res) => {
  try {
    const { name, role, base_price, team_id, sold_amount } = req.body;
    
    // Validate required fields
    if (!name || !role || !base_price) {
      return res.status(400).json({
        success: false,
        message: 'Name, role, and base price are required'
      });
    }

    // Handle image upload
    let image_url = null;
    if (req.file) {
      image_url = `/uploads/players/${req.file.filename}`;
    }

    const playerData = {
      name,
      role,
      base_price: parseInt(base_price),
      team_id: team_id || null,
      sold_amount: sold_amount ? parseInt(sold_amount) : null,
      image_url,
      status: ['available']
    };

    const player = await playerModel.createPlayer(playerData);
    
    res.status(201).json({
      success: true,
      message: 'Player added successfully',
      player
    });
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create player',
      error: error.message
    });
  }
};

// Update an existing player
exports.updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, base_price, image_url, status } = req.body;

    // Validate required fields
    if (!name || !role || !base_price) {
      return res.status(400).json({
        success: false,
        message: 'Name, role, and base price are required'
      });
    }

    // Validate status if provided
    if (status && !['available', 'sold', 'unsold'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Must be one of: available, sold, unsold'
      });
    }

    const updatedPlayer = await playerModel.updatePlayer(id, {
      name,
      role,
      base_price,
      image_url,
      status: status || 'available'
    });

    if (!updatedPlayer) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    return res.json({
      success: true,
      message: 'Player updated successfully',
      player: updatedPlayer
    });

  } catch (error) {
    console.error('Error updating player:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating player',
      error: error.message
    });
  }
};

// Upload player image
exports.uploadPlayerImage = async (req, res) => {
  const playerId = parseInt(req.params.id);
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    // Check if player exists
    const player = await playerModel.getPlayerById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Generate URL for the uploaded image
    const imagePath = `/uploads/players/${req.file.filename}`;
    
    // Update player with the new image URL
    const updatedPlayer = await playerModel.updatePlayer(playerId, {
      ...player,
      image_url: imagePath
    });
    
    res.status(200).json({
      message: 'Player image uploaded successfully',
      player: updatedPlayer,
      image_url: imagePath
    });
  } catch (error) {
    console.error('Error uploading player image:', error);
    res.status(500).json({ error: 'Failed to upload player image' });
  }
};

// Delete a team
exports.deleteTeam = async (req, res) => {
  try {
    await teamModel.deleteTeam(req.params.id);
    res.status(200).json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

// Delete a player
exports.deletePlayer = async (req, res) => {
  const playerId = parseInt(req.params.id);
  try {
    // First delete all bids for this player to avoid foreign key constraint violation
    await bidModel.deleteBidsForPlayer(playerId);
    
    // Then delete the player
    await playerModel.deletePlayer(playerId);
    
    res.status(200).json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error(`Error deleting player with ID ${playerId}:`, error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
};

// Reset auction for a player
exports.resetPlayerAuction = async (req, res) => {
  const playerId = parseInt(req.params.id);
  try {
    // First check if the player exists
    const player = await playerModel.getPlayerById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Delete all bids for this player
    await bidModel.deleteBidsForPlayer(playerId);
    // Reset player's team assignment
    await playerModel.updatePlayerTeam(playerId, null);
    res.status(200).json({ message: 'Player auction reset successfully' });
  } catch (error) {
    console.error('Error resetting player auction:', error);
    res.status(500).json({ error: 'Failed to reset player auction' });
  }
};

// Update team password
exports.updateTeamPassword = async (req, res) => {
  const teamId = req.params.id;
  const { password } = req.body;
  
  try {
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Update the team password
    const updatedTeam = await teamModel.updateTeamPassword(teamId, password);
    
    res.status(200).json({ 
      message: 'Password updated successfully',
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name
      }
    });
  } catch (error) {
    console.error('Error updating team password:', error);
    res.status(500).json({ error: 'Failed to update team password' });
  }
};

// Assign player to team
exports.assignPlayerToTeam = async (req, res) => {
  const playerId = parseInt(req.params.id);
  const { team_id, sold_price } = req.body;
  
  try {
    if (!team_id || !sold_price) {
      return res.status(400).json({ error: 'Team ID and sold price are required' });
    }
    
    // Get the player and team to verify they exist
    const player = await playerModel.getPlayerById(playerId);
    const team = await teamModel.getTeamById(parseInt(team_id));
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Check if team has enough budget
    if (team.budget < sold_price) {
      return res.status(400).json({ error: 'Team does not have enough budget' });
    }
    
    // Update player's team
    await playerModel.updatePlayerTeam(playerId, parseInt(team_id));
    
    // Update team's budget
    const newBudget = team.budget - sold_price;
    await teamModel.updateTeamBudget(parseInt(team_id), newBudget);
    
    res.status(200).json({ 
      message: 'Player assigned to team successfully',
      player,
      team,
      sold_price
    });
  } catch (error) {
    console.error('Error assigning player to team:', error);
    res.status(500).json({ error: 'Failed to assign player to team' });
  }
};

// Get team details for a player
exports.getPlayerTeam = async (req, res) => {
  const playerId = parseInt(req.params.id);
  
  try {
    // Get the player with team information
    const player = await playerModel.getPlayerWithTeam(playerId);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // If the player has a team_id, get the team details
    let team = null;
    if (player.team_id) {
      team = await teamModel.getTeamById(player.team_id);
    }
    
    res.json({
      player,
      team
    });
  } catch (error) {
    console.error('Error getting player team:', error);
    res.status(500).json({ error: 'Failed to get player team details' });
  }
};

// Show player management page
exports.showPlayerManagement = async (req, res) => {
  try {
    console.log('Loading player management page...');
    
    // Check if we're using the mock database
    if (db.isMockDb()) {
      console.log('Using mock database for player management');
    }
    
    let teams = [];
    let players = [];
    
    try {
      teams = await teamModel.getAllTeams();
      console.log(`Retrieved ${teams.length} teams`);
    } catch (teamError) {
      console.error('Error fetching teams:', teamError);
      teams = []; // Set to empty array to prevent template issues
    }
    
    try {
      players = await playerModel.getAllPlayers();
      console.log(`Retrieved ${players.length} players`);
    } catch (playerError) {
      console.error('Error fetching players:', playerError);
      players = []; // Set to empty array to prevent template issues
    }
    
    res.render('player_management', { 
      title: 'Player Management',
      teams,
      players,
      adminUsername: req.session.adminUsername || null,
      usingMockDb: db.isMockDb()
    });
  } catch (error) {
    console.error('Error loading player management page:', error);
    res.status(500).send('Error loading player management page: ' + error.message);
  }
};
  