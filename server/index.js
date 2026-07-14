const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database');
const { Game, games } = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API for Auth
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    db.registerUser(username, password, (err, id) => {
        if (err) return res.status(400).json({ error: 'Username taken or error' });
        res.json({ success: true, id });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.loginUser(username, password, (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        res.json({ success: true, username: user.username });
    });
});

app.get('/api/lobbies', (req, res) => {
    const lobbies = Object.keys(games).map(id => ({
        id,
        players: Object.keys(games[id].players).length
    }));
    res.json(lobbies);
});

// Socket.io for Realtime
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createGame', ({username, color}) => {
        const gameId = Math.random().toString(36).substring(7);
        games[gameId] = new Game(gameId);
        games[gameId].addPlayer(socket.id, username, color);
        socket.join(gameId);
        socket.emit('gameJoined', { gameId, map: games[gameId].map });
    });

    socket.on('joinGame', ({ gameId, username, color }) => {
        if (games[gameId] && Object.keys(games[gameId].players).length < 2) {
            games[gameId].addPlayer(socket.id, username, color);
            socket.join(gameId);
            socket.emit('gameJoined', { gameId, map: games[gameId].map });
            io.to(gameId).emit('playerJoined');
        } else {
            socket.emit('error', 'Game full or not found');
        }
    });

    socket.on('input', (data) => {
        // Find which game this socket is in
        for (let gameId in games) {
            if (games[gameId].players[socket.id]) {
                games[gameId].handleInput(socket.id, data);
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        for (let gameId in games) {
            if (games[gameId].players[socket.id]) {
                games[gameId].removePlayer(socket.id);
                if (Object.keys(games[gameId].players).length === 0) {
                    delete games[gameId];
                }
            }
        }
    });
});

// Game loop
setInterval(() => {
    for (let id in games) {
        games[id].update();
        io.to(id).emit('gameState', games[id].getState());
    }
}, 1000 / 60); // 60 FPS

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
