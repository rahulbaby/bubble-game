// <!-- LATEST VERSION FROM DATE 18-JAN-25 16:36 -->
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let players = [];
let takenUsernames = new Set(); // Set to store lowercase usernames for case-insensitive matching

app.use(express.static('public')); // Serve static files from the 'public' folder

// Sort players by their score in descending order
function sortPlayers() {
  return players.sort((a, b) => b.score - a.score);
}

io.on('connection', (socket) => {
  console.log('A player connected.');

  let playerUsername = ''; // Store username for this specific connection

  // Check if the username is available
  socket.on('check-username', (data, callback) => {
    const usernameLower = data.username.toLowerCase();

    if (takenUsernames.has(usernameLower)) {
      callback({ isAvailable: false });
    } else {
      callback({ isAvailable: true });
    }
  });

  // Player joins the game
  socket.on('join', (data) => {
    const username = data.username.trim().toLowerCase();

    if (!username || takenUsernames.has(username)) {
      return; // If the username is empty or already taken, reject
    }

    takenUsernames.add(username); // Mark the username as taken
    players.push({ username, score: 0 });

    playerUsername = username; // Store the player's username

    // Send sorted leaderboard to all clients
    io.emit('update-leaderboard', sortPlayers());
    console.log(`Player ${data.username} joined the game.`);

    // Emit a player-joined event to all clients
    // io.emit('player-joined', { username: data.username });
  });

  // Update player score
  socket.on('update-score', (data) => {
    // Find and update the correct player's score
    const playerIndex = players.findIndex((p) => p.username === data.username);
    if (playerIndex !== -1) {
      players[playerIndex].score = data.score;

      // Log the scores for debugging
      console.log('Updated player scores:', players);

      // Emit updated leaderboard to all clients
      io.emit('update-leaderboard', sortPlayers());
    } else {
      console.error(`Player not found: ${data.username}`);
    }
  });

  // Handle player disconnection (game exit on reload or manually disconnect)
  socket.on('disconnect', () => {
    if (playerUsername) {
      const playerIndex = players.findIndex(p => p.username === playerUsername);
      if (playerIndex !== -1) {
        takenUsernames.delete(playerUsername); // Remove username from taken list
        players.splice(playerIndex, 1); // Remove player from players array

        // Send updated leaderboard after sorting by score
        io.emit('update-leaderboard', sortPlayers());
        console.log(`Player ${playerUsername} disconnected.`);

        // Notify all other players about the disconnection
        io.emit('player-disconnected', { username: playerUsername });
      }
    }
  });
});

// Set the server to listen on port 3000
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});