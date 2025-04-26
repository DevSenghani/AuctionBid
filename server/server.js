const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const auctionRoutes = require('./routes/auctionRoutes');
const adminRoutes = require('./admin/routes/adminRoutes');  // Import admin routes
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use('/api', auctionRoutes);
app.use('/admin/api', adminRoutes);  // Use the admin routes under a different API path
socketHandler(server);

// Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Set up views for EJS rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
