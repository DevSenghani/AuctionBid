const { Pool } = require('pg');
require('dotenv').config();

// Create connection configuration with default values
// Using hardcoded values for testing since .env file may not be loaded correctly
const config = {
  user: 'postgres',
  host: 'localhost',
  database: 'auction_system',
  password: 'Manav@2006',
  port: 5432,
};

console.log('Database connection configuration:', {
  user: config.user,
  host: config.host,
  database: config.database,
  port: config.port
});

// Create a mock database if we can't connect to the real database
let mockDb = false;
let pool;
let reconnectTimer = null;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;

// Function to initialize or reinitialize the database connection
function initializePool() {
  try {
    // If there's an existing pool, close it properly first
    if (pool) {
      console.log('Closing existing database pool before reconnecting...');
      pool.end().catch(err => console.error('Error closing pool:', err));
    }
    
    // Create a new pool
    pool = new Pool(config);
    reconnectAttempts = 0;
    
    // Test connection
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('Database connection error:', err.message);
        console.log('Using mock database instead');
        mockDb = true;
        handleReconnect();
      } else {
        console.log('Database connected successfully at:', res.rows[0].now);
        mockDb = false;
      }
    });
    
    // Error event listener
    pool.on('error', (err) => {
      console.error('Unexpected database error:', err.message);
      
      // If it's a connection-related error, attempt to reconnect
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || 
          err.code === 'ECONNREFUSED' || 
          err.code === 'ETIMEDOUT' ||
          err.code === '57P01') { // SQL state code for admin shutdown
        
        mockDb = true;
        handleReconnect();
      } else {
        // For other errors, just log and continue with mock data if needed
        mockDb = true;
      }
    });
  } catch (error) {
    console.error('Failed to initialize database connection:', error.message);
    console.log('Using mock database instead');
    mockDb = true;
    handleReconnect();
  }
}

// Function to handle reconnection attempts
function handleReconnect() {
  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  reconnectAttempts++;
  
  if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
    // Exponential backoff for reconnection attempts (1s, 2s, 4s, 8s, 16s)
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
    
    console.log(`Attempting to reconnect to database in ${delay/1000} seconds (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    
    reconnectTimer = setTimeout(() => {
      console.log('Attempting database reconnection...');
      initializePool();
    }, delay);
  } else {
    console.error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Using mock database until server restart.`);
    // We'll continue using mockDb = true
  }
}

// Initialize the database connection on startup
initializePool();

// Create a wrapper function for database queries that falls back to mock data if DB is not available
const query = async (text, params) => {
  // If we're in mock mode, return mock data
  if (mockDb) {
    // Return mock data based on the query
    if (text.includes('teams')) {
      return {
        rows: [
          { id: 1, name: 'Mumbai Indians', owner: 'Mock Owner', budget: 1000000 },
          { id: 2, name: 'Chennai Super Kings', owner: 'Mock Owner', budget: 1000000 }
        ]
      };
    } else if (text.includes('players WHERE team_id IS NULL')) {
      return {
        rows: [
          { id: 1, name: 'MS Dhoni', base_price: 200000, role: 'Wicket-keeper', status: 'available', is_auctioned: false },
          { id: 2, name: 'Virat Kohli', base_price: 200000, role: 'Batsman', status: 'available', is_auctioned: false }
        ]
      };
    } else if (text.includes('bids')) {
      return { rows: [] };
    } else {
      return { rows: [] };
    }
  }

  // Try to execute the query, with reconnection logic if it fails
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('Query error:', error.message);
    console.error('Query:', text);
    console.error('Parameters:', params);
    
    // If it's a connection error, try to reconnect
    if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === '57P01') {
      
      mockDb = true;
      handleReconnect();
    }
    
    // Fall back to mock data on error
    mockDb = true;
    return query(text, params);
  }
};

/**
 * Save auction results to the database when an auction ends
 * @param {Object} data - Auction results data
 * @param {Date} data.endTime - Time when the auction ended
 * @param {String} data.endedBy - Username of admin who ended the auction
 * @param {Array} data.soldPlayers - Array of players sold in the auction
 * @param {Number} data.totalAmount - Total amount spent in the auction
 * @returns {Promise<Object>} - Result of the save operation
 */
const saveAuctionResults = async (data) => {
  try {
    if (mockDb) {
      console.log('Using mock database for saving auction results');
      console.log('Saving auction results:', data);
      return Promise.resolve({ 
        id: 'mock-auction-result-id',
        end_time: data.endTime,
        ended_by: data.endedBy,
        total_amount: data.totalAmount,
        players_sold: data.soldPlayers.length
      });
    }

    // First, create a record in the auction_summary table
    const summaryQuery = `
      INSERT INTO auction_summary (
        end_time, 
        ended_by, 
        total_amount, 
        players_sold
      ) VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const summaryValues = [
      data.endTime,
      data.endedBy,
      data.totalAmount,
      data.soldPlayers.length
    ];
    
    const summaryResult = await query(summaryQuery, summaryValues);
    const auctionSummaryId = summaryResult.rows[0].id;
    
    // Then save individual player results
    if (data.soldPlayers && data.soldPlayers.length > 0) {
      // Process each sold player in a transaction
      await Promise.all(data.soldPlayers.map(async (player) => {
        // Save individual player result
        const resultQuery = `
          INSERT INTO auction_results (
            auction_summary_id,
            player_id,
            team_id,
            amount,
            status
          ) VALUES ($1, $2, $3, $4, $5)
        `;
        
        const resultValues = [
          auctionSummaryId,
          player.id,
          player.teamId,
          player.amount,
          'sold'
        ];
        
        return query(resultQuery, resultValues);
      }));
    }
    
    console.log(`Auction results saved successfully with ID: ${auctionSummaryId}`);
    return { id: auctionSummaryId };
  } catch (error) {
    console.error('Error saving auction results:', error);
    throw error;
  }
};

/**
 * Get all auction results
 * @returns {Promise<Array>} - Array of auction results
 */
const getAuctionResults = async () => {
  try {
    if (mockDb) {
      console.log('Using mock database for getting auction results');
      return Promise.resolve([
        {
          id: 'mock-summary-id',
          end_time: new Date(),
          ended_by: 'Mock Admin',
          total_amount: 5000000,
          players_sold: 10,
          results: [
            {
              player_id: 1,
              player_name: 'MS Dhoni',
              team_id: 1,
              team_name: 'Mumbai Indians',
              amount: 1000000,
              status: 'sold'
            }
          ]
        }
      ]);
    }

    // Get all auction summaries
    const summariesQuery = `
      SELECT * FROM auction_summary
      ORDER BY end_time DESC
    `;
    
    const summariesResult = await query(summariesQuery);
    const summaries = summariesResult.rows;
    
    // For each summary, get the detailed results
    const detailedResults = await Promise.all(summaries.map(async (summary) => {
      const resultsQuery = `
        SELECT ar.*, p.name as player_name, p.role as player_role, 
               t.name as team_name, t.owner as team_owner
        FROM auction_results ar
        LEFT JOIN players p ON ar.player_id = p.id
        LEFT JOIN teams t ON ar.team_id = t.id
        WHERE ar.auction_summary_id = $1
      `;
      
      const resultsResult = await query(resultsQuery, [summary.id]);
      
      return {
        ...summary,
        results: resultsResult.rows
      };
    }));
    
    return detailedResults;
  } catch (error) {
    console.error('Error getting auction results:', error);
    throw error;
  }
};

// Function to check database connection status
const checkConnection = async () => {
  try {
    if (mockDb) {
      return { connected: false, mode: 'mock' };
    }
    
    const result = await pool.query('SELECT NOW()');
    return { 
      connected: true, 
      timestamp: result.rows[0].now,
      mode: 'real'
    };
  } catch (error) {
    console.error('Connection check failed:', error.message);
    return { connected: false, error: error.message, mode: 'mock' };
  }
};

module.exports = {
  query,
  pool: mockDb ? null : pool,
  isMockDb: () => mockDb,
  saveAuctionResults,
  getAuctionResults,
  checkConnection,
  reconnect: () => {
    reconnectAttempts = 0; // Reset the counter
    handleReconnect(); // Try reconnecting
  }
}; 