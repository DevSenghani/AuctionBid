const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
require('dotenv').config();

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'cricket-auction-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
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

// Routes
app.get('/', (req, res) => {
  res.redirect('/home');  // Redirect root to the home page
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
  console.error('Application error:', err.stack);
  res.status(500).send(`Something broke! Error: ${err.message}`);
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Start the server - try port 3001 if 3000 is in use
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy, trying port ${PORT + 1}`);
    const newPort = PORT + 1;
    server.close();
    app.listen(newPort, () => {
      console.log(`Server running on port ${newPort}`);
    });
  } else {
    console.error('Server startup error:', err);
  }
});

// Initialize Socket.IO
const auctionSocket = require('./socket/auctionSocket');
auctionSocket.init(server);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    console.log('Server shut down.');
    process.exit(0);
  });
});
