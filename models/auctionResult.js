const db = require('../utils/database');

/**
 * AuctionResult model
 * Represents the result of a player auction
 */
class AuctionResult {
  constructor(data) {
    this._id = data.id || data._id;
    this.player_id = data.player_id;
    this.team_id = data.team_id;
    this.amount = data.amount;
    this.status = data.status; // 'sold', 'unsold'
    this.timestamp = data.timestamp || new Date();
  }

  // Create a new auction result
  static async create(data) {
    try {
      const query = `
        INSERT INTO auction_results (player_id, team_id, amount, status, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [
        data.player_id,
        data.team_id,
        data.amount,
        data.status,
        data.timestamp || new Date()
      ];
      
      const result = await db.query(query, values);
      return new AuctionResult(result.rows[0]);
    } catch (error) {
      console.error('Error creating auction result:', error);
      throw error;
    }
  }

  // Get all auction results
  static async getAll() {
    try {
      const query = `
        SELECT ar.*, p.name as player_name, t.name as team_name
        FROM auction_results ar
        LEFT JOIN players p ON ar.player_id = p.id
        LEFT JOIN teams t ON ar.team_id = t.id
        ORDER BY ar.timestamp DESC
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting auction results:', error);
      throw error;
    }
  }

  // Get auction results for a specific player
  static async getByPlayer(playerId) {
    try {
      const query = `
        SELECT ar.*, t.name as team_name
        FROM auction_results ar
        LEFT JOIN teams t ON ar.team_id = t.id
        WHERE ar.player_id = $1
      `;
      
      const result = await db.query(query, [playerId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting auction result for player:', error);
      throw error;
    }
  }

  // Get auction results for a specific team
  static async getByTeam(teamId) {
    try {
      const query = `
        SELECT ar.*, p.name as player_name, p.role as player_role, p.base_price
        FROM auction_results ar
        LEFT JOIN players p ON ar.player_id = p.id
        WHERE ar.team_id = $1
        ORDER BY ar.amount DESC
      `;
      
      const result = await db.query(query, [teamId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting auction results for team:', error);
      throw error;
    }
  }

  // Mock implementation for development
  static mockCreate(data) {
    console.log('Using mock create for AuctionResult model');
    // Return a mock auction result
    return Promise.resolve({
      _id: 'mock-result-id',
      player_id: data.player_id,
      team_id: data.team_id,
      amount: data.amount,
      status: data.status,
      timestamp: new Date()
    });
  }
}

module.exports = AuctionResult; 