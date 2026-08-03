let io;
module.exports = {
  init: (httpServer) => {
    const { Server } = require('socket.io');
    io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => callback(null, true),
        credentials: true
      }
    });
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
    return io;
  },
  getIO: () => {
    if (!io) throw new Error('Socket.IO not initialized');
    return io;
  }
};
