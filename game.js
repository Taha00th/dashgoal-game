class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Fixed Resolution
        this.width = 800;
        this.height = 480;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.isHost = false;
        this.players = {}; // { id: { x, y, color, inputs, ... } }
        this.ball = { x: this.width / 2, y: this.height / 2, vx: 0, vy: 0, radius: 10 };

        // Physics Configurations
        this.friction = 0.98;
        this.playerSpeed = 7;
        this.playerRadius = 15;

        this.scores = { red: 0, blue: 0 };
    }

    init(isHost) {
        this.isHost = isHost;
        // Keyboard Listeners
        this.keys = { w: false, a: false, s: false, d: false, space: false };
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));
    }

    handleKey(e, isDown) {
        const key = e.key.toLowerCase();
        // console.log("Key: " + key); // Debug

        // WASD Support
        if (['w', 'a', 's', 'd'].includes(key)) {
            this.keys[key] = isDown;
        }

        // Arrow Keys Support (Map to WASD)
        if (key === 'arrowup') this.keys['w'] = isDown;
        if (key === 'arrowdown') this.keys['s'] = isDown;
        if (key === 'arrowleft') this.keys['a'] = isDown;
        if (key === 'arrowright') this.keys['d'] = isDown;

        if (key === ' ' || key === 'spacebar') {
            this.keys['space'] = isDown;
        }

        // If Client, send input immediately
        if (!this.isHost) {
            sendInput(this.keys);
        }
    }

    addPlayer(id, name, teamColor) {
        // Red team starts left, Blue starts right
        const startX = teamColor === 'red' ? 100 : this.width - 100;

        this.players[id] = {
            id: id,
            name: name,
            x: startX,
            y: this.height / 2,
            color: teamColor,
            inputs: { w: false, a: false, s: false, d: false, space: false },
            canShoot: true // Cooldown
        };
    }

    setPlayerName(id, name) {
        if (this.players[id]) {
            this.players[id].name = name;
        }
    }

    // --- HOST LOGIC ---
    // --- HOST LOGIC ---
    startHostLoop() {
        if (!this.isHost) return;

        // Physics Loop (60 TPS) - Keeps game logic fast
        setInterval(() => {
            this.updatePhysics();
        }, 1000 / 60);

        // Network Loop (25 TPS) - Reduces Bandwidth / Lag
        setInterval(() => {
            this.broadcastState();
        }, 40);

        this.renderLoop();
    }

    handleInput(playerId, inputs) {
        if (this.players[playerId]) {
            this.players[playerId].inputs = inputs;
        }
    }

    updatePhysics() {
        // ... (Physics Code Same as before, omitted for brevity if no changes needed, but replace_file needs context)
        // Check content size. The user didn't ask to change physics.
        // Wait, replace_file requires replacing the chunk. I will assume updatePhysics is unchanged 
        // effectively, but I need to perform the interpolation logic in Client mode.
        // Actually, updatePhysics is called by host. Client needs interpolation in render loop.

        // Let's just focus on startHostLoop change first, 
        // then I'll overwrite renderLoop and setState separately or together if contiguous.
        // startHostLoop is at line 64. updatePhysics is line 81.
        // setState is at line 202. renderLoop is line 213.
        // They are far apart. I should stick to startHostLoop here or use multi_replace?
        // multi_replace is better.
    }

    // ... (This block is confusing for the tool. I will use multi_replace or separate calls)
    // Actually, I can just replace the whole file content for clarity or stick to specific blocks.
    // Let's use replace_file for startHostLoop first.


    handleInput(playerId, inputs) {
        if (this.players[playerId]) {
            this.players[playerId].inputs = inputs;
        }
    }

    updatePhysics() {
        // Update My Inputs (Host)
        // Host ID is always 'peer_host'
        if (this.players['peer_host']) {
            this.players['peer_host'].inputs = this.keys;
        }

        // Move Players
        for (let id in this.players) {
            let p = this.players[id];

            // Movement
            if (p.inputs.w) p.y -= this.playerSpeed;
            if (p.inputs.s) p.y += this.playerSpeed;
            if (p.inputs.a) p.x -= this.playerSpeed;
            if (p.inputs.d) p.x += this.playerSpeed;

            // Wall Collision (Player)
            p.x = Math.max(this.playerRadius, Math.min(this.width - this.playerRadius, p.x));
            p.y = Math.max(this.playerRadius, Math.min(this.height - this.playerRadius, p.y));

            // Ball Interaction
            let dx = this.ball.x - p.x;
            let dy = this.ball.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            // Shooting Mechanic
            if (p.inputs.space && p.canShoot) {
                // Kick range is slightly larger than collision range
                if (dist < this.playerRadius + this.ball.radius + 8) {
                    let angle = Math.atan2(dy, dx);
                    let shootForce = 12; // Hard kick
                    this.ball.vx += Math.cos(angle) * shootForce;
                    this.ball.vy += Math.sin(angle) * shootForce;

                    p.canShoot = false;
                    setTimeout(() => { p.canShoot = true; }, 300); // Cooldown
                }
            }

            // Normal Collision (Push ball)
            if (dist < this.playerRadius + this.ball.radius) {
                let angle = Math.atan2(dy, dx);
                let force = 2.5; // Normal dribble

                // Position Correction (prevent sticking)
                let overlap = (this.playerRadius + this.ball.radius) - dist;
                this.ball.x += Math.cos(angle) * overlap;
                this.ball.y += Math.sin(angle) * overlap;

                this.ball.vx += Math.cos(angle) * force;
                this.ball.vy += Math.sin(angle) * force;
            }
        }

        // Move Ball
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        // Friction
        this.ball.vx *= this.friction;
        this.ball.vy *= this.friction;

        // Wall Collision (Ball) & Goal Logic
        if (this.ball.y < this.ball.radius || this.ball.y > this.height - this.ball.radius) {
            this.ball.vy *= -1;
            this.ball.y = Math.max(this.ball.radius, Math.min(this.height - this.ball.radius, this.ball.y));
        }

        if (this.ball.x < this.ball.radius) {
            // Blue Goal!
            if (this.ball.y > 180 && this.ball.y < 300) {
                this.score('blue');
            } else {
                this.ball.vx *= -1;
                this.ball.x = this.ball.radius;
            }
        }

        if (this.ball.x > this.width - this.ball.radius) {
            // Red Goal!
            if (this.ball.y > 180 && this.ball.y < 300) {
                this.score('red');
            } else {
                this.ball.vx *= -1;
                this.ball.x = this.width - this.ball.radius;
            }
        }
    }

    score(team) {
        this.scores[team]++;
        // Reset Ball
        this.ball.x = this.width / 2;
        this.ball.y = this.height / 2;
        this.ball.vx = 0;
        this.ball.vy = 0;

        // Reset Players
        for (let id in this.players) {
            let p = this.players[id];
            p.x = p.color === 'red' ? 100 : this.width - 100;
            p.y = this.height / 2;
            p.canShoot = true; // Reset cooldown
        }
    }

    broadcastState() {
        const state = {
            players: this.players,
            ball: this.ball,
            scores: this.scores
        };
        sendState(state);
    }

    // --- CLIENT LOGIC ---
    startClientLoop() {
        this.renderLoop();
    }

    setState(state) {
        // Sync Scores & Ball directly (Ball hard to lerp without physics pred)
        this.scores = state.scores;
        // this.ball = state.ball; // Direct snap for ball (or lerp too?)
        // Let's LERP Ball too for smoothness
        if (!this.ball.targetX) {
            this.ball.x = state.ball.x;
            this.ball.y = state.ball.y;
        }
        this.ball.targetX = state.ball.x;
        this.ball.targetY = state.ball.y;

        // Sync Players with Interpolation
        for (let id in state.players) {
            if (!this.players[id]) {
                this.players[id] = state.players[id]; // New player
            } else {
                // Update Target Data
                let p = this.players[id];
                let newData = state.players[id];

                // If distance is huge (teleport/reset), snap directly
                if (Math.abs(p.x - newData.x) > 100) {
                    p.x = newData.x;
                    p.y = newData.y;
                }

                p.targetX = newData.x;
                p.targetY = newData.y;
                p.name = newData.name; // Sync name
                p.inputs = newData.inputs; // Sync inputs (visuals)
            }
        }

        // Update UI
        document.getElementById('score-red').innerText = this.scores.red;
        document.getElementById('score-blue').innerText = this.scores.blue;
    }

    // --- RENDER ---
    renderLoop() {
        // Client-Side Interpolation (Smoothing)
        if (!this.isHost) {
            this.interpolateEntities();
        }

        this.draw();
        requestAnimationFrame(() => this.renderLoop());
    }

    interpolateEntities() {
        const lerp = (start, end, factor) => start + (end - start) * factor;
        const factor = 0.15; // Snappier movement

        // Players
        for (let id in this.players) {
            let p = this.players[id];
            if (p.targetX !== undefined) {
                // Snap if distance is too big (teleport)
                if (Math.abs(p.x - p.targetX) > 150) {
                    p.x = p.targetX;
                    p.y = p.targetY;
                } else {
                    p.x = lerp(p.x, p.targetX, factor);
                    p.y = lerp(p.y, p.targetY, factor);
                }
            }
        }

        // Ball
        if (this.ball.targetX !== undefined) {
            this.ball.x = lerp(this.ball.x, this.ball.targetX, factor);
            this.ball.y = lerp(this.ball.y, this.ball.targetY, factor);
        }
    }

    draw() {
        // Clear background
        this.ctx.fillStyle = '#4a7c59';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Grass Pattern (Simple Lines)
        this.ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for (let i = 0; i < this.width; i += 100) {
            if ((i / 100) % 2 === 0) this.ctx.fillRect(i, 0, 50, this.height);
        }

        // Draw Pitch Lines
        this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        this.ctx.lineWidth = 3;

        // Middle Line
        this.ctx.beginPath();
        this.ctx.moveTo(this.width / 2, 0);
        this.ctx.lineTo(this.width / 2, this.height);
        this.ctx.stroke();

        // Center Circle
        this.ctx.beginPath();
        this.ctx.arc(this.width / 2, this.height / 2, 60, 0, Math.PI * 2);
        this.ctx.stroke();

        // Goals
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.fillRect(0, 180, 5, 120); // Left Goal
        this.ctx.fillRect(this.width - 5, 180, 5, 120); // Right Goal

        // Draw Players
        for (let id in this.players) {
            let p = this.players[id];

            // Halo/Shadow (Turn White if space is pressed!)
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y + 2, this.playerRadius + 4, 0, Math.PI * 2);
            if (p.inputs && p.inputs.space) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // White glow kicking
            } else {
                this.ctx.fillStyle = 'rgba(0,0,0,0.2)'; // Normal shadow
            }
            this.ctx.fill();

            // Player Body
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, this.playerRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color === 'red' ? '#e74c3c' : '#3498db';
            this.ctx.fill();

            // Player Border
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Player Name
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(p.name, p.x, p.y - 25);
        }

        // Draw Ball
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y + 2, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)'; // Shadow
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.fill();
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
}

const game = new Game();
