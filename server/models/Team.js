const pool = require('./db');

class Team {
  static async save(teamData) {
    const { name, owner, logoUrl } = teamData;
    const result = await pool.query(
      'INSERT INTO teams (name, owner, logo_url) VALUES ($1, $2, $3) RETURNING *',
      [name, owner, logoUrl]
    );
    return result.rows[0];
  }

  static async find() {
    const result = await pool.query('SELECT * FROM teams');
    return result.rows;
  }
}

module.exports = Team;
