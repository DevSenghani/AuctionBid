const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Read database configuration from .env file
const config = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'auction_system',
  password: process.env.DB_PASSWORD || 'd2507',
  port: process.env.DB_PORT || 2507,
};

// Create a new database connection
const pool = new Pool(config);

async function runMigration() {
  console.log('Starting database migration...');
  
  try {
    // Run the player columns migration
    const playerColumnsMigration = fs.readFileSync(path.join(__dirname, 'add_player_columns.sql'), 'utf8');
    await pool.query(playerColumnsMigration);
    console.log('Successfully added player columns for auction functionality.');
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

runMigration(); 