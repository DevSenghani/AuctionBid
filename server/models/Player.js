const pool = require('./db');

class Player {
  static async save(playerData) {
    const { name, role, basePrice } = playerData;
    const result = await pool.query(
      'INSERT INTO players (name, role, base_price) VALUES ($1, $2, $3) RETURNING *',
      [name, role, basePrice]
    );
    return result.rows[0];
  }

  static async find() {
    const result = await pool.query('SELECT * FROM players');
    return result.rows;
  }
}

module.exports = Player;
