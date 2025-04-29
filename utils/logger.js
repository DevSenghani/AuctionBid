/**
 * Logging utility for the auction system
 * Provides consistent logging across the application
 */
const fs = require('fs');
const path = require('path');
const config = require('../config/auctionConfig');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Get the current log level from config
const currentLogLevel = (() => {
  const configLevel = (config.server.logLevel || 'info').toUpperCase();
  return LOG_LEVELS[configLevel] !== undefined ? LOG_LEVELS[configLevel] : LOG_LEVELS.INFO;
})();

// Current date for log files
const getLogDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Format a log entry
const formatLogEntry = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaString = Object.keys(meta).length > 0 
    ? '\n' + JSON.stringify(meta, null, 2) 
    : '';
  
  return `[${timestamp}] [${level}] ${message}${metaString}\n`;
};

// Write to log file
const writeToLogFile = (content, logType = 'app') => {
  const logDate = getLogDate();
  const logFile = path.join(logsDir, `${logType}-${logDate}.log`);
  
  fs.appendFile(logFile, content, (err) => {
    if (err) {
      console.error(`Failed to write to log file: ${err.message}`);
      console.error(content); // Still output to console
    }
  });
};

// Logger functions for different levels
const logger = {
  error: (message, meta = {}) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const logEntry = formatLogEntry('ERROR', message, meta);
      console.error(logEntry);
      writeToLogFile(logEntry, 'error');
    }
  },
  
  warn: (message, meta = {}) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      const logEntry = formatLogEntry('WARN', message, meta);
      console.warn(logEntry);
      writeToLogFile(logEntry);
    }
  },
  
  info: (message, meta = {}) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      const logEntry = formatLogEntry('INFO', message, meta);
      console.log(logEntry);
      writeToLogFile(logEntry);
    }
  },
  
  debug: (message, meta = {}) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      const logEntry = formatLogEntry('DEBUG', message, meta);
      console.log(logEntry);
      writeToLogFile(logEntry);
    }
  },
  
  // Special logger for audit trails (always logged)
  audit: (action, user, details = {}) => {
    const logEntry = formatLogEntry('AUDIT', action, {
      user,
      ...details,
      timestamp: new Date().toISOString()
    });
    console.log(logEntry);
    writeToLogFile(logEntry, 'audit');
  }
};

module.exports = logger; 