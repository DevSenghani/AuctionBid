const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'auction_system',
  password: process.env.DB_PASSWORD || 'Manav@2006',
  port: process.env.DB_PORT || 5432,
});

// Path to the SQL schema file
const schemaPath = path.join(__dirname, '..', 'auction_system_schema.sql');

// Read the schema file
const schema = fs.readFileSync(schemaPath, 'utf8');

// Sample data for initial setup
const sampleTeams = [
  { name: 'Mumbai Indians', owner: 'Reliance Industries', budget: 1000000 },
  { name: 'Chennai Super Kings', owner: 'India Cements', budget: 1000000 },
  { name: 'Royal Challengers Bangalore', owner: 'United Spirits', budget: 1000000 },
  { name: 'Kolkata Knight Riders', owner: 'Red Chillies Entertainment', budget: 1000000 },
  { name: 'Delhi Capitals', owner: 'GMR Group & JSW Group', budget: 1000000 },
  { name: 'Punjab Kings', owner: 'Mohit Burman', budget: 1000000 }
];

const samplePlayers = [
  { name: 'Virat Kohli', base_price: 200000, role: 'Batsman' },
  { name: 'Rohit Sharma', base_price: 200000, role: 'Batsman' },
  { name: 'MS Dhoni', base_price: 150000, role: 'Wicket-keeper' },
  { name: 'Jasprit Bumrah', base_price: 175000, role: 'Bowler' },
  { name: 'Ravindra Jadeja', base_price: 150000, role: 'All-rounder' },
  { name: 'KL Rahul', base_price: 170000, role: 'Batsman' },
  { name: 'Rishabh Pant', base_price: 160000, role: 'Wicket-keeper' },
  { name: 'Hardik Pandya', base_price: 150000, role: 'All-rounder' },
  { name: 'Mohammed Shami', base_price: 140000, role: 'Bowler' },
  { name: 'Shikhar Dhawan', base_price: 130000, role: 'Batsman' },
  { name: 'Shreyas Iyer', base_price: 140000, role: 'Batsman' },
  { name: 'Yuzvendra Chahal', base_price: 120000, role: 'Bowler' },
  { name: 'Bhuvneshwar Kumar', base_price: 125000, role: 'Bowler' },
  { name: 'Suryakumar Yadav', base_price: 125000, role: 'Batsman' },
  { name: 'Ravichandran Ashwin', base_price: 130000, role: 'Bowler' }
];

// Execute the schema and populate with sample data
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database initialization...');
    
    // Execute schema
    console.log('Creating tables...');
    await client.query(schema);
    
    // Insert sample teams
    console.log('Inserting sample teams...');
    for (const team of sampleTeams) {
      await client.query(
        'INSERT INTO teams (name, owner, budget) VALUES ($1, $2, $3)',
        [team.name, team.owner, team.budget]
      );
    }
    
    // Insert sample players
    console.log('Inserting sample players...');
    for (const player of samplePlayers) {
      await client.query(
        'INSERT INTO players (name, base_price, role) VALUES ($1, $2, $3)',
        [player.name, player.base_price, player.role]
      );
    }
    
    console.log('Database initialization completed successfully.');
  } catch (error) {
    console.error('Error during database initialization:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the initialization
initializeDatabase(); 