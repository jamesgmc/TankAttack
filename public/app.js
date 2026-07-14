let currentUser = null;
let currentMode = 'login';
let socket = null;

// UI Elements
const authScreen = document.getElementById('auth-screen');
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
            initLobby();
        } else {
            authError.textContent = data.error || 'Authentication failed';
        }
    } catch (err) {
        authError.textContent = 'Server connection error';
    }
});

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
    socket.emit('createGame', currentUser);
});

window.joinGame = (gameId) => {
    socket.emit('joinGame', { gameId, username: currentUser });
};
