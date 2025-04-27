const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const auctionRoutes = require('./routes/auctionRoutes');
// const adminRoutes = require('./routes/adminRoutes');  // Import admin routes when available
const socketHandler = require('./socket');

// Environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined')); // Logging
app.use(compression()); // Compress responses
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', auctionRoutes);
// app.use('/admin/api', adminRoutes);  // Use admin routes when available

// Initialize socket handlers
socketHandler(io);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Set up views for EJS rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Route handlers
app.get('/', (req, res) => {
  res.render('home');
});

// API health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: NODE_ENV });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).json({ error: '404 - Resource Not Found' });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
