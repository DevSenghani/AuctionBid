const db = require('../utils/database');

// Create a new bid
exports.createBid = async (bidData) => {
  try {
    // Handle different property names
    const player_id = bidData.player_id || bidData.player;
    const team_id = bidData.team_id || bidData.team;
    const amount = bidData.amount;
    
    if (!player_id || !team_id || !amount) {
      throw new Error('Missing required fields: player_id, team_id, and amount are required');
    }
    
    const result = await db.query(
      'INSERT INTO bids (player_id, team_id, amount) VALUES ($1, $2, $3) RETURNING *',
      [player_id, team_id, amount]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating bid:', error);
    throw error;
  }
};

// Get all bids for a player
exports.getBidsByPlayer = async (playerId) => {
  try {
    const result = await db.query(`
      SELECT b.*, t.name as team_name 
      FROM bids b 
      JOIN teams t ON b.team_id = t.id 
      WHERE b.player_id = $1 
      ORDER BY b.amount DESC
    `, [playerId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting bids by player:', error);
    throw error;
  }
};

// Get highest bid for a player
exports.getHighestBid = async (playerId) => {
  try {
    const result = await db.query(`
      SELECT b.*, t.name as team_name 
      FROM bids b 
      JOIN teams t ON b.team_id = t.id 
      WHERE b.player_id = $1 
      ORDER BY b.amount DESC 
      LIMIT 1
    `, [playerId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting highest bid:', error);
    throw error;
  }
};

// Get all bids by a team
exports.getBidsByTeam = async (teamId) => {
  try {
    const result = await db.query(`
      SELECT b.*, 
             p.id as player_id, 
             p.name as player_name, 
             p.role as player_role,
             p.base_price as player_base_price,
             p.team_id as player_team_id,
             p.status as player_status
      FROM bids b 
      JOIN players p ON b.player_id = p.id 
      WHERE b.team_id = $1 
      ORDER BY b.bid_time DESC
    `, [teamId]);
    
    // Transform the result to have a nested player object for compatibility
    return result.rows.map(row => ({
      id: row.id,
      player_id: row.player_id,
      team_id: row.team_id,
      amount: row.amount,
      timestamp: row.bid_time,
      player: {
        id: row.player_id,
        name: row.player_name,
        role: row.player_role,
        base_price: row.player_base_price,
        team_id: row.player_team_id,
        status: row.player_status
      }
    }));
  } catch (error) {
    console.error('Error getting bids by team:', error);
    throw error;
  }
};

// Delete all bids for a player (used when resetting an auction)
exports.deleteBidsForPlayer = async (playerId) => {
  try {
    await db.query('DELETE FROM bids WHERE player_id = $1', [playerId]);
    return true;
  } catch (error) {
    console.error('Error deleting bids for player:', error);
    throw error;
  }
};

// Delete all bids (used for complete reset)
exports.deleteAllBids = async () => {
  try {
    await db.query('DELETE FROM bids');
    return true;
  } catch (error) {
    console.error('Error deleting all bids:', error);
    throw error;
  }
}; 