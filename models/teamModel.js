const db = require('../utils/database');

// Get all teams
exports.getAllTeams = async () => {
  try {
    console.log('Fetching all teams...');
    const result = await db.query(
      'SELECT t.*, COUNT(p.id) as player_count, SUM(p.sold_price) as total_spent ' +
      'FROM teams t ' +
      'LEFT JOIN players p ON t.id = p.team_id ' +
      'GROUP BY t.id ' +
      'ORDER BY t.name'
    );
    
    console.log(`Retrieved ${result.rows.length} teams`);
    return result.rows.map(team => ({
      ...team,
      player_count: parseInt(team.player_count) || 0,
      total_spent: parseFloat(team.total_spent) || 0
    }));
  } catch (error) {
    console.error('Error getting teams:', error);
    console.error('Error details:', error.message);
    return [];
  }
};

// Get team by ID
exports.getTeamById = async (teamId) => {
  if (!teamId || isNaN(teamId)) {
    console.error('Invalid team ID provided:', teamId);
    return null;
  }

  try {
    const result = await db.query(
      'SELECT t.*, COUNT(p.id) as player_count, SUM(p.sold_price) as total_spent ' +
      'FROM teams t ' +
      'LEFT JOIN players p ON t.id = p.team_id ' +
      'WHERE t.id = $1 ' +
      'GROUP BY t.id',
      [teamId]
    );

    if (result.rows.length === 0) {
      console.log(`No team found with ID ${teamId}`);
      return null;
    }

    const team = result.rows[0];
    return {
      ...team,
      player_count: parseInt(team.player_count) || 0,
      total_spent: parseFloat(team.total_spent) || 0
    };
  } catch (error) {
    console.error('Error getting team by ID:', error);
    console.error('Error details:', error.message);
    return null;
  }
};

// Get team's current auction status
exports.getTeamAuctionStatus = async (teamId) => {
  if (!teamId || isNaN(teamId)) {
    return { error: 'Invalid team ID' };
  }

  try {
    const result = await db.query(
      'SELECT t.*, ' +
      'COUNT(p.id) as player_count, ' +
      'SUM(p.sold_price) as total_spent, ' +
      'MAX(p.sold_price) as highest_purchase ' +
      'FROM teams t ' +
      'LEFT JOIN players p ON t.id = p.team_id ' +
      'WHERE t.id = $1 ' +
      'GROUP BY t.id',
      [teamId]
    );

    if (result.rows.length === 0) {
      return { error: 'Team not found' };
    }

    const team = result.rows[0];
    return {
      id: team.id,
      name: team.name,
      owner: team.owner,
      budget: parseFloat(team.budget) || 0,
      player_count: parseInt(team.player_count) || 0,
      total_spent: parseFloat(team.total_spent) || 0,
      highest_purchase: parseFloat(team.highest_purchase) || 0,
      remaining_budget: parseFloat(team.budget - (team.total_spent || 0))
    };
  } catch (error) {
    console.error('Error getting team auction status:', error);
    return { error: 'Failed to get team auction status' };
  }
};

// Create a new team
exports.createTeam = async (teamData) => {
  const { name, owner, budget, password } = teamData;
  try {
    const result = await db.query(
      'INSERT INTO teams (name, owner, budget, password) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, owner, budget || 1000000, password]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating team:', error);
    throw error;
  }
};

// Update team budget after bid
exports.updateTeamBudget = async (teamId, newBudget) => {
  try {
    const result = await db.query(
      'UPDATE teams SET budget = $1 WHERE id = $2 RETURNING *',
      [newBudget, teamId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating team budget:', error);
    throw error;
  }
};

// Delete team
exports.deleteTeam = async (teamId) => {
  try {
    await db.query('DELETE FROM teams WHERE id = $1', [teamId]);
    return true;
  } catch (error) {
    console.error('Error deleting team:', error);
    throw error;
  }
};

// Update team password
exports.updateTeamPassword = async (teamId, password) => {
  try {
    const result = await db.query(
      'UPDATE teams SET password = $1 WHERE id = $2 RETURNING *',
      [password, teamId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Team not found');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error updating team password:', error);
    throw error;
  }
};

// Get team players with details
exports.getTeamPlayers = async (teamId) => {
  try {
    const result = await db.query(
      'SELECT p.*, t.name as team_name ' +
      'FROM players p ' +
      'JOIN teams t ON p.team_id = t.id ' +
      'WHERE p.team_id = $1 ' +
      'ORDER BY p.sold_price DESC',
      [teamId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting team players:', error);
    return [];
  }
};