let gameMap = null;
let currentGameId = null;
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const hpDisplay = document.getElementById('player-hp');
const scoreDisplay = document.getElementById('player-score');
const playersHud = document.getElementById('players-hud');

// Input state
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
    Space: false
};

let mouseX = 0;
let mouseY = 0;

let previousHp = {};

// Procedural Sound Engine
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const SoundEngine = {
    initialized: false,
    engineOsc: null,
    engineFilter: null,
    engineGain: null,
    
    init: function() {
        if(this.initialized) return;
        if(audioCtx.state === 'suspended') audioCtx.resume();
        this.initialized = true;
        
        // Better Engine Sound (Low freq sawtooth with low pass filter)
        this.engineOsc = audioCtx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(30, audioCtx.currentTime); // Low grumble
        
        this.engineFilter = audioCtx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(100, audioCtx.currentTime); // Muffle it
        
        this.engineGain = audioCtx.createGain();
        this.engineGain.gain.setValueAtTime(0.05, audioCtx.currentTime); // Idle volume
        
        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(audioCtx.destination);
        this.engineOsc.start();
    },
    
    updateMovement: function(isMoving) {
        if (!this.initialized) return;
        const now = audioCtx.currentTime;
        if (isMoving) {
            this.engineOsc.frequency.setTargetAtTime(45, now, 0.2);
            this.engineFilter.frequency.setTargetAtTime(200, now, 0.2);
            this.engineGain.gain.setTargetAtTime(0.1, now, 0.2);
        } else {
            this.engineOsc.frequency.setTargetAtTime(30, now, 0.2);
            this.engineFilter.frequency.setTargetAtTime(100, now, 0.2);
            this.engineGain.gain.setTargetAtTime(0.05, now, 0.2);
        }
    },
    
    playFire: function() {
        if (!this.initialized) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    
    playHit: function() {
        if (!this.initialized) return;
        // White noise burst for hit/explosion
        const bufferSize = audioCtx.sampleRate * 0.2; // 0.2 seconds
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    }
};
function initGame(map, gameId) {
    gameMap = map;
    currentGameId = gameId;
    showScreen(gameScreen);
    
    // Set up input listeners
    window.addEventListener('keydown', (e) => {
        SoundEngine.init();
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
    
    canvas.addEventListener('mousedown', () => { SoundEngine.init(); keys.Space = true; });
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

    const isMoving = keys.w || keys.ArrowUp || keys.s || keys.ArrowDown || keys.a || keys.ArrowLeft || keys.d || keys.ArrowRight;
    SoundEngine.updateMovement(isMoving);

    socket.emit('input', {
        up: keys.w || keys.ArrowUp,
        down: keys.s || keys.ArrowDown,
        left: keys.a || keys.ArrowLeft,
        right: keys.d || keys.ArrowRight,
        fire: keys.Space,
        targetAngle: targetAngle
    });
    
    if (keys.Space) {
        SoundEngine.playFire();
    }
    
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
        
        if (previousHp[id] !== undefined && p.hp < previousHp[id]) {
            SoundEngine.playHit();
        }
        previousHp[id] = p.hp;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Tracks (Background Base)
        ctx.fillStyle = '#111';
        ctx.shadowBlur = 0;
        ctx.fillRect(-25, -22, 50, 10); // Top track
        ctx.fillRect(-25, 12, 50, 10);  // Bottom track

        // Tint tracks with a darker shade of the tank's color
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = p.color;
        ctx.fillRect(-25, -22, 50, 10); // Top track
        ctx.fillRect(-25, 12, 50, 10);  // Bottom track
        ctx.globalAlpha = 1.0;

        // Track treads (2 lines on each track)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Top track lines
        ctx.moveTo(-25, -19); ctx.lineTo(25, -19);
        ctx.moveTo(-25, -15); ctx.lineTo(25, -15);
        // Bottom track lines
        ctx.moveTo(-25, 15); ctx.lineTo(25, 15);
        ctx.moveTo(-25, 19); ctx.lineTo(25, 19);
        ctx.stroke();

        // Tank Body (Longer)
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(-20, -16, 40, 32);
        
        // Tank Barrel
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.fillRect(0, -3, 30, 6);

        ctx.restore();
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

    // Draw Names and Hit bars in the DOM
    let hudHtml = '';
    for (let id in state.players) {
        const p = state.players[id];
        hudHtml += `
            <div style="text-align: center;">
                <div style="color: ${p.color}; font-size: 14px; margin-bottom: 5px; text-shadow: 0 0 5px ${p.color};">${p.username}</div>
                <div style="width: 100px; height: 8px; background: #ff0000; border-radius: 4px; box-shadow: 0 0 5px #ff0000 inset;">
                    <div style="width: ${p.hp}%; height: 100%; background: #00ffcc; border-radius: 4px; transition: width 0.1s; box-shadow: 0 0 8px #00ffcc;"></div>
                </div>
            </div>
        `;
    }
    playersHud.innerHTML = hudHtml;
}
