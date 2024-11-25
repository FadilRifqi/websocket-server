const { Server } = require('socket.io');

const io = new Server(3001, {
  cors: { origin: '*' },
});

const rooms = {}; // Store room details

io.on('connection', (socket) => {
  // Listen for a game search
  socket.on('search-game', () => {
    let roomId;

    // Find an existing room with one player
    for (const [key, value] of Object.entries(rooms)) {
      if (value.players.length === 1) {
        roomId = key;
        break;
      }
    }

    // Create a new room if none found
    if (!roomId) {
      roomId = Math.random().toString(36).substring(2, 9); // Generate random ID
      rooms[roomId] = { players: [] };
    }

    // Add the player to the room
    rooms[roomId].players.push(socket.id);
    socket.join(roomId);

    // Notify the client about the room
    socket.emit('game-found', roomId);

    // Start the game if there are two players in the room
    if (rooms[roomId].players.length === 2) {
      const firstPlayerSymbol = Math.random() < 0.5 ? 'X' : 'O';
      const secondPlayerSymbol = firstPlayerSymbol === 'X' ? 'O' : 'X';
      io.to(roomId).emit('start-game', {
        roomId,
        firstPlayerSymbol: firstPlayerSymbol,
        secondPlayerSymbol: secondPlayerSymbol,
        firstPlayer: rooms[roomId].players[0],
      });
    }
  });

  // Handle player moves
  socket.on('make-move', ({ roomId, index, symbol }) => {
    socket.to(roomId).emit('move-made', { index, symbol });
  });

  socket.on('game-ended', (roomId) => {
    // Notify all players in the room that the game has ended
    io.to(roomId).emit('game-ended', roomId);

    // Clean up the room
    if (rooms[roomId]) {
      rooms[roomId].players.forEach((playerId) => {
        io.sockets.sockets.get(playerId).leave(roomId);
      });
      delete rooms[roomId];
    }
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players.includes(socket.id)) {
        // Remove the player from the room
        room.players = room.players.filter((id) => id !== socket.id);

        // Delete the room if empty
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});
