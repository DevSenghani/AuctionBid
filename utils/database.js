const { Pool } = require('pg');
require('dotenv').config();
const config = require('../config/auctionConfig');

// Safe type conversion helpers
const safeNumber = (val, fallback = 0) => {
  const num = parseInt(val, 10);
  return isNaN(num) ? fallback : num;
};

// Create connection configuration from centralized config
const dbConfig = {
  user: config.database.user || 'postgres',
  host: config.database.host || 'localhost',
  database: config.database.name || 'auction_system',
  password: config.database.password || '',
  port: safeNumber(config.database.port, 5432),
  connectionTimeoutMillis: safeNumber(config.database.connectionTimeout, 5000),
  idleTimeoutMillis: safeNumber(config.database.idleTimeout, 10000),
  max: safeNumber(config.database.poolMax, 10)
};

// Log database configuration without sensitive information
console.log('Database connection configuration:', {
  user: dbConfig.user,
  host: dbConfig.host,
  database: dbConfig.database,
  port: dbConfig.port,
  connectionTimeout: dbConfig.connectionTimeoutMillis,
  idleTimeout: dbConfig.idleTimeoutMillis,
  poolMax: dbConfig.max
});

let mockDb = false;
let pool = null;
let reconnectTimer = null;
const MAX_RECONNECT_ATTEMPTS = safeNumber(config.database.reconnectAttempts, 5);
let reconnectAttempts = 0;

async function initializePool() {
  try {
    if (config.database.enableMock) {
      console.log('Mock database mode is enabled. Skipping DB connection.');
      mockDb = true;
      return;
    }

    if (!config.database.password) {
      console.warn('Database password is missing. Forcing mock mode.');
      mockDb = true;
      return;
    }

    if (pool) {
      console.log('Closing existing database pool...');
      await pool.end().catch(err => console.error('Error closing pool:', err));
    }

    pool = new Pool(dbConfig);
    reconnectAttempts = 0;

    const testResult = await pool.query('SELECT NOW()');
    console.log('Database connected successfully at:', testResult.rows[0].now);
    mockDb = false;

    pool.on('error', (err, client) => {
      console.error('Unexpected DB client error:', err.message);

      const reconnectErrorCodes = [
        'PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ETIMEDOUT', '57P01', '08006', 'EPIPE', 'ENOTFOUND', '28P01'
      ];

      if (reconnectErrorCodes.includes(err.code)) {
        mockDb = true;
        handleReconnect();
      }

      if (client) {
        client.release(true);
      }
    });

    pool.on('connect', () => console.log('Client connected to DB'));
    pool.on('remove', () => console.log('Client removed from pool'));

  } catch (error) {
    console.error('DB init failed:', error.message);
    console.error('Stack:', error.stack);

    if (error.message.includes('password')) {
      console.warn('Password error. Switching to mock DB.');
      mockDb = true;
      return;
    }

    if (MAX_RECONNECT_ATTEMPTS > 0) {
      console.log('Switching to mock DB and attempting reconnect.');
      mockDb = true;
      handleReconnect();
    } else {
      console.error('DB connection failed and mock mode is disabled. Exiting.');
      process.exit(1);
    }
  }
}

function handleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (!dbConfig.password) {
    console.warn('Missing password. Skipping reconnect.');
    mockDb = true;
    return;
  }

  reconnectAttempts++;

  if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
    console.log(`Reconnecting in ${delay / 1000}s (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    reconnectTimer = setTimeout(() => {
      initializePool().catch(err => {
        console.error('Reconnect error:', err);
        if (err.message.includes('password')) {
          console.warn('Reconnect failed due to password issue.');
          reconnectAttempts = MAX_RECONNECT_ATTEMPTS + 1;
          mockDb = true;
        } else if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          handleReconnect();
        }
      });
    }, delay);
  } else {
    console.error('Max reconnect attempts reached. Continuing in mock mode.');
    mockDb = true;
  }
}

// Initial DB setup
if (config.database.enableMock || !config.database.password) {
  console.log('Starting in mock mode.');
  mockDb = true;
} else {
  initializePool().catch(err => {
    console.error('Initial DB connection error:', err);
    mockDb = true;
    if (MAX_RECONNECT_ATTEMPTS > 0) handleReconnect();
    else process.exit(1);
  });
}

const query = async (text, params) => {
  if (mockDb) return handleMockQuery(text, params);

  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('Query error:', error.message);
    if (['PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ETIMEDOUT', '57P01', '08006', 'EPIPE', 'ENOTFOUND'].includes(error.code)) {
      mockDb = true;
      handleReconnect();
    }
    return handleMockQuery(text, params);
  }
};

function handleMockQuery(text, params) {
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

const isMockDb = () => mockDb;

const saveAuctionResults = async (data) => {
  try {
    if (mockDb) {
      console.log('Saving auction results in mock mode:', data);
      return {
        id: 'mock-auction-result-id',
        end_time: data.endTime,
        ended_by: data.endedBy,
        total_amount: data.totalAmount,
        players_sold: data.soldPlayers.length
      };
    }

    const summaryQuery = `
      INSERT INTO auction_summary (end_time, ended_by, total_amount, players_sold)
      VALUES ($1, $2, $3, $4) RETURNING id
    `;
    const summaryValues = [data.endTime, data.endedBy, data.totalAmount, data.soldPlayers.length];
    const summaryResult = await query(summaryQuery, summaryValues);
    const auctionSummaryId = summaryResult.rows[0].id;

    if (data.soldPlayers?.length) {
      await Promise.all(data.soldPlayers.map(player => {
        const resultQuery = `
          INSERT INTO auction_results (auction_summary_id, player_id, team_id, amount, status)
          VALUES ($1, $2, $3, $4, $5)
        `;
        const resultValues = [auctionSummaryId, player.id, player.teamId, player.amount, 'sold'];
        return query(resultQuery, resultValues);
      }));
    }

    return { id: auctionSummaryId };
  } catch (error) {
    console.error('Error saving auction results:', error);
    throw error;
  }
};

const getAuctionResults = async () => {
  try {
    if (mockDb) {
      return Promise.resolve([{
        id: 'mock-summary-id',
        end_time: new Date(),
        ended_by: 'Mock Admin',
        total_amount: 5000000,
        players_sold: 10,
        results: [{
          player_id: 1,
          player_name: 'MS Dhoni',
          team_id: 1,
          team_name: 'Mumbai Indians',
          amount: 1000000,
          status: 'sold'
        }]
      }]);
    }

    const summariesQuery = 'SELECT * FROM auction_summary ORDER BY end_time DESC';
    const summaries = (await query(summariesQuery)).rows;

    return Promise.all(summaries.map(async summary => {
      const resultsQuery = `
        SELECT ar.*, p.name as player_name, p.role as player_role,
               t.name as team_name, t.owner as team_owner
        FROM auction_results ar
        LEFT JOIN players p ON ar.player_id = p.id
        LEFT JOIN teams t ON ar.team_id = t.id
        WHERE ar.auction_summary_id = $1
      `;
      const results = (await query(resultsQuery, [summary.id])).rows;
      return { ...summary, results };
    }));

  } catch (error) {
    console.error('Error retrieving auction results:', error);
    throw error;
  }
};

const checkConnection = async () => {
  try {
    if (mockDb) return { connected: false, mode: 'mock' };
    const result = await pool.query('SELECT NOW()');
    return { connected: true, timestamp: result.rows[0].now, mode: 'real' };
  } catch (err) {
    return { connected: false, error: err.message, mode: 'mock' };
  }
};

module.exports = {
  query,
  pool: mockDb ? null : pool,
  isMockDb,
  saveAuctionResults,
  getAuctionResults,
  checkConnection,
  reconnect: () => {
    reconnectAttempts = 0;
    handleReconnect();
  }
};
