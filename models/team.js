const db = require('../utils/database');

/**
 * Team model
 * Represents a cricket team in the auction system
 */
class Team {
  constructor(data) {
    this._id = data.id || data._id;
    this.name = data.name;
    this.shortName = data.short_name || data.shortName;
    this.logo = data.logo;
    this.budget = data.budget || 0;
    this.maxPlayers = data.max_players || data.maxPlayers || 25;
    this.owner = data.owner;
    this.players = data.players || [];
  }

  // Find a team by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM teams WHERE id = $1';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Team(result.rows[0]);
    } catch (error) {
      console.error('Error finding team by ID:', error);
      throw error;
    }
  }

  // Get all teams
  static async find() {
    try {
      const query = 'SELECT * FROM teams';
      const result = await db.query(query);
      return result.rows.map(row => new Team(row));
    } catch (error) {
      console.error('Error finding teams:', error);
      throw error;
    }
  }

  // Update team budget
  static async updateBudget(teamId, newBudget) {
    try {
      const query = 'UPDATE teams SET budget = $1 WHERE id = $2 RETURNING *';
      const result = await db.query(query, [newBudget, teamId]);
      
      if (result.rows.length === 0) {
        throw new Error('Team not found');
      }
      
      return new Team(result.rows[0]);
    } catch (error) {
      console.error('Error updating team budget:', error);
      throw error;
    }
  }

  // Get players for a team
  static async getTeamPlayers(teamId) {
    try {
      const query = 'SELECT * FROM players WHERE team_id = $1';
      const result = await db.query(query, [teamId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting team players:', error);
      throw error;
    }
  }

  // Mock implementation for development
  static mockFindById(id) {
    console.log('Using mock findById for Team model');
    // Return a mock team
    return Promise.resolve({
      _id: id,
      name: 'Mock Team',
      shortName: 'MT',
      budget: 1000000,
      maxPlayers: 25,
      owner: 'Mock Owner'
    });
  }
}

module.exports = Team; 