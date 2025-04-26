const pool = require('./db');

class Bid {
  static async save(bidData) {
    const { playerId, teamId, amount } = bidData;
    const result = await pool.query(
      'INSERT INTO bids (player_id, team_id, amount) VALUES ($1, $2, $3) RETURNING *',
      [playerId, teamId, amount]
    );
    return result.rows[0];
  }

  static async find() {
    const result = await pool.query('SELECT * FROM bids');
    return result.rows;
  }
}

module.exports = Bid;
