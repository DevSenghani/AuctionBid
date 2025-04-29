/**
 * Auction system configuration
 * Centralizes all application configuration settings
 */
require('dotenv').config();

// Helper to parse integer env vars with fallback
const parseIntEnv = (key, defaultValue) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper to parse boolean env vars with fallback
const parseBoolEnv = (key, defaultValue) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
};

// Main configuration object
const config = {
  // Server configuration
  server: {
    port: parseIntEnv('PORT', 3001),
    environment: process.env.NODE_ENV || 'development',
    sessionSecret: process.env.SESSION_SECRET || 'cricket-auction-secret',
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseIntEnv('DB_PORT', 2507),
    name: process.env.DB_NAME || 'auction_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'd2507',
    connectionTimeout: parseIntEnv('DB_CONNECTION_TIMEOUT', 5000),
    idleTimeout: parseIntEnv('DB_IDLE_TIMEOUT', 30000),
    poolMax: parseIntEnv('DB_POOL_MAX', 20),
    enableMock: parseBoolEnv('ENABLE_MOCK_DB', false),
    reconnectAttempts: parseIntEnv('DB_RECONNECT_ATTEMPTS', 5),
    healthCheckInterval: parseIntEnv('DB_HEALTH_CHECK_INTERVAL', 300000) // 5 minutes
  },
  
  // Auction settings
  auction: {
    defaultPlayerAuctionTime: parseIntEnv('AUCTION_PLAYER_TIME', 30), // seconds
    defaultWaitingTime: parseIntEnv('AUCTION_WAITING_TIME', 10), // seconds
    bidTimeExtension: parseIntEnv('AUCTION_BID_EXTENSION', 15), // seconds
    minBidIncrement: parseIntEnv('MIN_BID_INCREMENT', 1000),
    defaultPlayerBasePrice: parseIntEnv('DEFAULT_PLAYER_BASE_PRICE', 50000),
    defaultTeamBudget: parseIntEnv('DEFAULT_TEAM_BUDGET', 1000000)
  },
  
  // Security settings
  security: {
    jwtSecret: process.env.JWT_SECRET || 'auction-jwt-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptSaltRounds: parseIntEnv('BCRYPT_SALT_ROUNDS', 10)
  },
  
  // File upload settings
  uploads: {
    maxFileSize: parseIntEnv('MAX_FILE_SIZE', 5 * 1024 * 1024), // 5MB
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif').split(',')
  }
};

module.exports = config; 