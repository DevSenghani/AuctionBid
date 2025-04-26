const db = require('../utils/database');

// Get all teams
exports.getAllTeams = async () => {
  try {
    console.log('Fetching all teams...');
    const result = await db.query('SELECT * FROM teams ORDER BY name');
    console.log(`Retrieved ${result.rows.length} teams`);
    return result.rows;
  } catch (error) {
    console.error('Error getting teams:', error);
    console.error('Error details:', error.message);
    // Return empty array instead of throwing an error to prevent page crash
    return [];
  }
};

// Get team by ID
exports.getTeamById = async (teamId) => {
  try {
    const result = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting team by ID:', error);
    console.error('Error details:', error.message);
    return null;
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