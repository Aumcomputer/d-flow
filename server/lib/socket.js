let io;
const { createAdapter } = require('@socket.io/redis-adapter');
const { getRedisClient } = require('./redis');

// Local tracking for fast cleanup when a specific socket disconnects from this instance
const localSocketToCase = new Map();

module.exports = {
  init: async (httpServer) => {
    const { Server } = require('socket.io');
    
    const pubClient = getRedisClient();
    const subClient = pubClient.duplicate();
    
    subClient.on('error', (err) => console.error('Redis SubClient Error', err));
    
    await subClient.connect();

    io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => callback(null, true),
        credentials: true
      },
      adapter: createAdapter(pubClient, subClient)
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('case:join', async ({ an, userName }) => {
        if (!an || !userName) return;
        
        try {
          // Remove existing lock for this socket if any
          const existingAn = localSocketToCase.get(socket.id);
          if (existingAn) {
            await pubClient.hDel('workflow:locks', existingAn);
            localSocketToCase.delete(socket.id);
            io.emit('case:unlocked', { an: existingAn });
          }

          await pubClient.hSet('workflow:locks', an, userName);
          localSocketToCase.set(socket.id, an);
          io.emit('case:locked', { an, userName });
        } catch (err) {
          console.error('Redis HSET Error:', err);
        }
      });

      socket.on('case:leave', async ({ an }) => {
        if (!an) return;
        try {
          const existingAn = localSocketToCase.get(socket.id);
          if (existingAn === an) {
            await pubClient.hDel('workflow:locks', an);
            localSocketToCase.delete(socket.id);
            io.emit('case:unlocked', { an });
          }
        } catch (err) {
          console.error('Redis HDEL Error:', err);
        }
      });

      socket.on('get:locks', async (callback) => {
        if (typeof callback !== 'function') return;
        try {
          const locks = await pubClient.hGetAll('workflow:locks');
          callback(locks || {});
        } catch (err) {
          console.error('Redis HGETALL Error:', err);
          callback({});
        }
      });

      socket.on('disconnect', async () => {
        console.log('Client disconnected:', socket.id);
        try {
          const an = localSocketToCase.get(socket.id);
          if (an) {
            await pubClient.hDel('workflow:locks', an);
            localSocketToCase.delete(socket.id);
            io.emit('case:unlocked', { an });
          }
        } catch (err) {
          console.error('Redis disconnect cleanup error:', err);
        }
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) throw new Error('Socket.IO not initialized');
    return io;
  }
};
