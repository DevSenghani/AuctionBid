const db = require('../utils/database');

/**
 * Player model
 * Represents a cricket player in the auction system
 */
class Player {
  constructor(data) {
    this._id = data.id || data._id;
    this.name = data.name;
    this.role = data.role;
    this.basePrice = data.base_price || data.basePrice;
    this.nationality = data.nationality;
    this.battingStyle = data.batting_style || data.battingStyle;
    this.bowlingStyle = data.bowling_style || data.bowlingStyle;
    this.specialization = data.specialization;
    this.stats = data.stats || {};
    this.image = data.image;
    this.team_id = data.team_id;
    this.status = data.status || 'available'; // available, sold, unsold
    this.isAuctioned = data.is_auctioned || data.isAuctioned || false;
  }

  // Find a player by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM players WHERE id = $1';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Player(result.rows[0]);
    } catch (error) {
      console.error('Error finding player by ID:', error);
      throw error;
    }
  }

  // Find players that haven't been auctioned yet
  static async findOne(conditions) {
    try {
      let query = 'SELECT * FROM players WHERE 1=1';
      const params = [];
      
      if (conditions.isAuctioned !== undefined) {
        query += ` AND is_auctioned = $${params.length + 1}`;
        params.push(conditions.isAuctioned);
      }
      
      if (conditions.status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(conditions.status);
      }
      
      if (conditions.team_id) {
        query += ` AND team_id = $${params.length + 1}`;
        params.push(conditions.team_id);
      }
      
      query += ' LIMIT 1';
      
      const result = await db.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Player(result.rows[0]);
    } catch (error) {
      console.error('Error finding player with conditions:', error);
      throw error;
    }
  }

  // Get all players
  static async find(conditions = {}, sortBy = {}) {
    try {
      let query = 'SELECT * FROM players WHERE 1=1';
      const params = [];
      
      if (conditions.isAuctioned !== undefined) {
        query += ` AND is_auctioned = $${params.length + 1}`;
        params.push(conditions.isAuctioned);
      }
      
      if (conditions.status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(conditions.status);
      }
      
      if (conditions.team_id) {
        query += ` AND team_id = $${params.length + 1}`;
        params.push(conditions.team_id);
      }
      
      // Add sorting
      if (Object.keys(sortBy).length > 0) {
        query += ' ORDER BY';
        
        Object.entries(sortBy).forEach(([field, direction], index) => {
          const dir = direction === -1 ? 'DESC' : 'ASC';
          
          if (field === 'basePrice') {
            field = 'base_price';
          }
          
          query += ` ${field} ${dir}`;
          
          if (index < Object.keys(sortBy).length - 1) {
            query += ',';
          }
        });
      }
      
      const result = await db.query(query, params);
      return result.rows.map(row => new Player(row));
    } catch (error) {
      console.error('Error finding players:', error);
      throw error;
    }
  }

  // Mock implementation for development
  static mockFindOne(conditions) {
    console.log('Using mock findOne for Player model');
    // Return a mock player
    return Promise.resolve(conditions.isAuctioned === false ? {
      _id: 'mock-player-id',
      name: 'Mock Player',
      role: 'All-rounder',
      basePrice: 200000,
      nationality: 'India',
      isAuctioned: false
    } : null);
  }
}

module.exports = Player; 