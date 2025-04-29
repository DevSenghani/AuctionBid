const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Load centralized configuration
const config = require('./config/auctionConfig');

// Load custom logger
const logger = require('./utils/logger');

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Apply security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "code.jquery.com", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "cdn.jsdelivr.net", "secure.gravatar.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      connectSrc: ["'self'", "ws:", "wss:"],
    }
  },
  xssFilter: true,
  noSniff: true,
  hsts: {
    maxAge: 15552000,
    includeSubDomains: true,
    preload: true
  }
}));

// Add compression for better performance
app.use(compression());

// Add request logging with morgan - output to both console and log file
app.use(morgan(config.server.environment === 'production' ? 'combined' : 'dev', {
  stream: {
    write: (message) => {
      logger.debug(message.trim());
    }
  }
}));

// Configure session middleware
app.use(session({
  secret: config.server.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: config.server.environment === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware to make team information available to all views
app.use((req, res, next) => {
  res.locals.team = null;
  if (req.session && req.session.isTeamLoggedIn) {
    res.locals.team = {
      id: req.session.teamId,
      name: req.session.teamName
    };
  }
  next();
});

// Body parser middleware for parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS, images) from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Database connection test
const db = require('./utils/database');

// Database health check endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    const status = await db.checkConnection();
    if (status.connected) {
      res.json({ status: 'ok', ...status });
    } else {
      res.status(503).json({ status: 'error', ...status });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Overall health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await db.checkConnection();
    res.json({
      server: 'ok',
      database: dbStatus.connected ? 'ok' : 'error',
      dbMode: dbStatus.mode
    });
  } catch (error) {
    res.status(500).json({
      server: 'ok',
      database: 'error',
      error: error.message
    });
  }
});

// Routes
app.get('/', (req, res) => {
  res.redirect('/home');  // Redirect root to the home page
});

// Projector view route
app.get('/projector', (req, res) => {
  try {
    res.render('projector', {
      title: 'Cricket Auction - Projector View'
    });
  } catch (error) {
    console.error('Error loading projector view:', error);
    res.status(500).send('Error loading projector view: ' + error.message);
  }
});

// Set up the routes
app.use('/home', require('./routes/homeRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/auction', require('./routes/auctionRoutes'));
app.use('/team', require('./routes/teamAuthRoutes'));
app.use('/teams', require('./routes/teamRoutes'));
app.use('/results', require('./routes/resultsRoutes'));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Application error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  res.status(500).send(`Something broke! Error: ${err.message}`);
});

// 404 handler for undefined routes
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Start the server with better error handling
const PORT = config.server.port;
let server;

try {
  server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
      environment: config.server.environment,
      nodeVersion: process.version
    });
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${PORT} is busy, trying port ${PORT + 1}`);
      const newPort = PORT + 1;
      server.close();
      server = app.listen(newPort, () => {
        logger.info(`Server running on port ${newPort}`);
      });
    } else {
      logger.error('Server startup error', { error: err.message, stack: err.stack });
      process.exit(1); // Exit with error code
    }
  });
} catch (error) {
  logger.error('Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
}

// Initialize Socket.IO with proper error handling
const socketIO = require('socket.io');
const io = socketIO(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST']
  }
});

// Initialize socket modules
const auctionSocket = require('./socket/auctionSocket');
const bidSocket = require('./socket/bidSocket');

// Set up error handling for Socket.IO
io.on('error', (error) => {
  console.error('Socket.IO error:', error);
});

// Initialize socket modules with the io instance
try {
  auctionSocket.init(io);
  bidSocket(io);
  console.log('Socket.IO initialized successfully');
} catch (error) {
  console.error('Failed to initialize Socket.IO modules:', error);
}

// Set up periodic database connection check (every 5 minutes)
const DB_HEALTH_CHECK_INTERVAL = config.database.healthCheckInterval;
setInterval(async () => {
  try {
    // Skip health checks if mock mode is explicitly enabled
    if (config.database.enableMock) {
      return;
    }
    
    console.log('Performing periodic database health check...');
    const status = await db.checkConnection();
    if (!status.connected && status.mode === 'mock') {
      console.log('Database is disconnected, attempting to reconnect...');
      db.reconnect();
    }
  } catch (error) {
    console.error('Error during periodic database health check:', error);
  }
}, DB_HEALTH_CHECK_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    console.log('Server shut down.');
    process.exit(0);
  });
});
