let gameMap = null;
let currentGameId = null;
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const hpDisplay = document.getElementById('player-hp');
const scoreDisplay = document.getElementById('player-score');

// Input state
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
    Space: false
};

let mouseX = 0;
let mouseY = 0;

function initGame(map, gameId) {
    gameMap = map;
    currentGameId = gameId;
    showScreen(gameScreen);
    
    // Set up input listeners
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') keys.Space = true;
        if (keys.hasOwnProperty(e.key) && e.key !== 'Space') keys[e.key] = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') keys.Space = false;
        if (keys.hasOwnProperty(e.key) && e.key !== 'Space') keys[e.key] = false;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });
    
    canvas.addEventListener('mousedown', () => { keys.Space = true; });
    canvas.addEventListener('mouseup', () => { keys.Space = false; });

    // Start input loop
    setInterval(sendInput, 1000 / 60);

    // Listen for game state
    socket.on('gameState', render);
}

function sendInput() {
    if (!socket || !currentGameId) return;

    // Calculate angle based on player pos (we need local state prediction for angle, 
    // but for simplicity we just send mouse coords and let server calc, OR calc angle here if we know our tank)
    // Actually, sending targetAngle is better
    
    // We don't have our tank pos directly until gameState arrives, but we can keep track of it locally during render.
    let targetAngle = 0;
    if (window.myTank) {
        targetAngle = Math.atan2(mouseY - window.myTank.y, mouseX - window.myTank.x);
    }

    socket.emit('input', {
        up: keys.w || keys.ArrowUp,
        down: keys.s || keys.ArrowDown,
        left: keys.a || keys.ArrowLeft,
        right: keys.d || keys.ArrowRight,
        fire: keys.Space,
        targetAngle: targetAngle
    });
    
    // Reset fire so we don't spam if they hold (handled server side via rate limit or just let it shoot if < 2)
    keys.Space = false;
}

function render(state) {
    if (!state) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Map grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Draw Obstacles
    ctx.fillStyle = '#2a2a35';
    ctx.strokeStyle = '#445';
    ctx.lineWidth = 2;
    for (let obs of state.map.obstacles) {
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }

    // Find our tank to update HUD and angle calc
    window.myTank = state.players[socket.id];
    if (window.myTank) {
        hpDisplay.textContent = `HP: ${window.myTank.hp}`;
        hpDisplay.style.color = window.myTank.hp > 50 ? 'var(--primary)' : 'var(--secondary)';
        scoreDisplay.textContent = `Score: ${window.myTank.score}`;
    }

    // Draw Players
    for (let id in state.players) {
        const p = state.players[id];
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Tank Body
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(-15, -15, 30, 30);
        
        // Tank Barrel
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.fillRect(0, -3, 25, 6);

        ctx.restore();

        // Draw Health Bar
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(p.x - 15, p.y - 25, 30, 4);
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(p.x - 15, p.y - 25, (p.hp / 100) * 30, 4);
        
        // Name tag
        ctx.fillStyle = '#fff';
        ctx.font = '10px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(p.username, p.x, p.y - 32);
    }

    // Draw Bullets
    for (let b of state.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.closePath();
    }
}
