const fs = require('fs');
const path = require('path');

// Load map
const defaultMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'maps', 'default.json')));

const games = {};

class Game {
    constructor(id) {
        this.id = id;
        this.players = {}; // max 2
        this.bullets = [];
        this.map = defaultMap;
        this.active = false;
        this.lastUpdate = Date.now();
    }

    addPlayer(socketId, username, color) {
        if (Object.keys(this.players).length >= 2) return false;
        
        const isPlayer1 = Object.keys(this.players).length === 0;
        
        this.players[socketId] = {
            username,
            x: isPlayer1 ? 50 : this.map.width - 50,
            y: this.map.height / 2,
            angle: isPlayer1 ? 0 : Math.PI,
            hp: 100,
            score: 0,
            color: color || (isPlayer1 ? '#00ffcc' : '#ff3366'),
            bulletCount: 0
        };

        if (Object.keys(this.players).length === 2) {
            this.active = true;
        }
        return true;
    }

    removePlayer(socketId) {
        delete this.players[socketId];
        this.active = false;
    }

    handleInput(socketId, input) {
        const player = this.players[socketId];
        if (!player || !this.active) return;

        const speed = 4;
        let dx = 0;
        let dy = 0;

        if (input.up) dy -= speed;
        if (input.down) dy += speed;
        if (input.left) dx -= speed;
        if (input.right) dx += speed;

        // Player angle - 360 degree visual, but 8 direction movement based on dx/dy input
        if (input.targetAngle !== undefined) {
            player.angle = input.targetAngle;
        }
        
        let newX = player.x + dx;
        let newY = player.y + dy;

        // Check map boundaries
        newX = Math.max(15, Math.min(newX, this.map.width - 15));
        newY = Math.max(15, Math.min(newY, this.map.height - 15));

        // Basic obstacle collision
        let collision = false;
        for (let obs of this.map.obstacles) {
            if (newX > obs.x - 15 && newX < obs.x + obs.w + 15 &&
                newY > obs.y - 15 && newY < obs.y + obs.h + 15) {
                collision = true;
                break;
            }
        }

        if (!collision) {
            player.x = newX;
            player.y = newY;
        }

            // Firing logic
        if (input.fire && player.bulletCount < 2) {
            // Shoot exactly towards the target angle
            const bvx = Math.cos(player.angle) * 10;
            const bvy = Math.sin(player.angle) * 10;

            this.bullets.push({
                owner: socketId,
                x: player.x,
                y: player.y,
                vx: bvx,
                vy: bvy,
                life: 60 // frames
            });
            player.bulletCount++;
        }
    }

    update() {
        if (!this.active) return;
        
        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let b = this.bullets[i];
            b.x += b.vx;
            b.y += b.vy;
            b.life--;

            let hit = false;
            
            // Check wall collision
            if (b.x < 0 || b.x > this.map.width || b.y < 0 || b.y > this.map.height) {
                hit = true;
            }

            // Check obstacles
            if (!hit) {
                for (let obs of this.map.obstacles) {
                    if (b.x > obs.x && b.x < obs.x + obs.w &&
                        b.y > obs.y && b.y < obs.y + obs.h) {
                        hit = true;
                        break;
                    }
                }
            }

            // Check player collision
            if (!hit) {
                for (let pid in this.players) {
                    if (pid !== b.owner) {
                        let p = this.players[pid];
                        let dist = Math.hypot(p.x - b.x, p.y - b.y);
                        if (dist < 20) {
                            hit = true;
                            p.hp -= 20;
                            if (p.hp <= 0) {
                                if (this.players[b.owner]) {
                                    this.players[b.owner].score++;
                                }
                                
                                // Reset both tanks to starting positions
                                let isP1 = true;
                                for (let resetId in this.players) {
                                    const rp = this.players[resetId];
                                    rp.hp = 100;
                                    rp.x = isP1 ? 50 : this.map.width - 50;
                                    rp.y = this.map.height / 2;
                                    rp.angle = isP1 ? 0 : Math.PI;
                                    isP1 = false;
                                }
                            }
                        }
                    }
                }
            }

            if (hit || b.life <= 0) {
                if (this.players[b.owner]) {
                    this.players[b.owner].bulletCount = Math.max(0, this.players[b.owner].bulletCount - 1);
                }
                this.bullets.splice(i, 1);
            }
        }
    }

    getState() {
        return {
            players: this.players,
            bullets: this.bullets,
            map: this.map,
            active: this.active
        };
    }
}

module.exports = { Game, games };
