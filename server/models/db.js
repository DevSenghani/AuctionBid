const { Pool } = require('pg');

// Configure your database connection here
const pool = new Pool({
  user: 'yourUser',
  host: 'localhost',
  database: 'cricket_auction',
  password: 'yourPassword',
  port: 5432,
});

module.exports = pool;
