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
    const player = await playerModel.createPlayer(req.body);
    res.status(201).json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Failed to create player' });
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
  const playerId = req.params.id;
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
  const playerId = req.params.id;
  try {
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
  const playerId = req.params.id;
  const { team_id, sold_price } = req.body;
  
  try {
    if (!team_id || !sold_price) {
      return res.status(400).json({ error: 'Team ID and sold price are required' });
    }
    
    // Get the player and team to verify they exist
    const player = await playerModel.getPlayerById(playerId);
    const team = await teamModel.getTeamById(team_id);
    
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
    await playerModel.updatePlayerTeam(playerId, team_id);
    
    // Update team's budget
    const newBudget = team.budget - sold_price;
    await teamModel.updateTeamBudget(team_id, newBudget);
    
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
  