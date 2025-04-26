const socketIo = require('socket.io');

module.exports = function(server) {
  const io = socketIo(server);

  io.on('connection', (socket) => {
    console.log('New client connected');
    
    socket.on('placeBid', (data) => {
      // Handle the bid logic (could save to DB or broadcast)
      io.emit('newBid', data); // Broadcast new bid to all clients
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
};
