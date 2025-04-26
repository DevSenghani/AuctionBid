const db = require('../utils/database');

// Create a new bid
exports.createBid = async (bidData) => {
  const { player_id, team_id, amount } = bidData;
  try {
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
      SELECT b.*, p.name as player_name, p.role 
      FROM bids b 
      JOIN players p ON b.player_id = p.id 
      WHERE b.team_id = $1 
      ORDER BY b.bid_time DESC
    `, [teamId]);
    return result.rows;
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