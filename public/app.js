let currentUser = null;
let currentMode = 'login';
let socket = null;
let playerColor = '#00ffcc'; // Default color

const authScreen = document.getElementById('auth-screen');
const customizationScreen = document.getElementById('customization-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authForm = document.getElementById('auth-form');
const authSubmit = document.getElementById('auth-submit');
const authError = document.getElementById('auth-error');

const playerNameDisplay = document.getElementById('player-name');
const lobbiesList = document.getElementById('lobbies-list');
const btnCreateGame = document.getElementById('btn-create-game');

// Screen Management
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Auth Logic
tabLogin.addEventListener('click', () => {
    currentMode = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    authSubmit.textContent = 'Login';
    authError.textContent = '';
});

tabRegister.addEventListener('click', () => {
    currentMode = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    authSubmit.textContent = 'Register';
    authError.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const res = await fetch(`/api/${currentMode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser = currentMode === 'login' ? data.username : username;
            initCustomization();
        } else {
            authError.textContent = data.error || 'Authentication failed';
        }
    } catch (err) {
        authError.textContent = 'Server connection error';
    }
});

// Customization Logic
const availableColors = ['#00ffcc', '#ff3366', '#aaff00', '#00bfff', '#ffaa00'];

function initCustomization() {
    showScreen(customizationScreen);
    const palette = document.getElementById('color-palette');
    
    // Only populate if empty
    if (palette.children.length === 0) {
        availableColors.forEach(color => {
            const btn = document.createElement('div');
            btn.className = 'color-btn';
            btn.style.backgroundColor = color;
            btn.style.color = color; // For the glow effect
            if (color === playerColor) btn.classList.add('selected');
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                playerColor = color;
            });
            palette.appendChild(btn);
        });
        
        document.getElementById('btn-to-lobby').addEventListener('click', () => {
            initLobby();
        });
    }
}

// Lobby Logic
function initLobby() {
    showScreen(lobbyScreen);
    playerNameDisplay.textContent = `Welcome, ${currentUser}`;
    
    // Connect socket
    socket = io();
    
    socket.on('error', (msg) => {
        alert(msg);
    });

    socket.on('gameJoined', (data) => {
        initGame(data.map, data.gameId);
    });

    socket.on('playerJoined', () => {
        // Battle starts
    });

    fetchLobbies();
    setInterval(fetchLobbies, 3000);
}

async function fetchLobbies() {
    if (!lobbyScreen.classList.contains('active')) return;
    try {
        const res = await fetch('/api/lobbies');
        const lobbies = await res.json();
        
        lobbiesList.innerHTML = '';
        if (lobbies.length === 0) {
            lobbiesList.innerHTML = '<p style="color: #888">No active battles. Create one!</p>';
        } else {
            lobbies.forEach(lobby => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>Game #${lobby.id} (${lobby.players}/2)</span>
                    ${lobby.players < 2 ? `<button class="join-btn" onclick="joinGame('${lobby.id}')">Join</button>` : '<span>Full</span>'}
                `;
                lobbiesList.appendChild(li);
            });
        }
    } catch (e) {
        console.error('Error fetching lobbies', e);
    }
}

btnCreateGame.addEventListener('click', () => {
    socket.emit('createGame', { username: currentUser, color: playerColor });
});

window.joinGame = (gameId) => {
    socket.emit('joinGame', { gameId, username: currentUser, color: playerColor });
};
