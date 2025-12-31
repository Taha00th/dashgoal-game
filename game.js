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
        this.friction = 0.98; // Ball friction
        this.playerFriction = 0.88; // More drag/inertia
        this.playerAccel = 0.45; // Reduced for control
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
            vx: 0,
            vy: 0,
            canShoot: true // Cooldown
        };
    }

    setPlayerName(id, name) {
        if (this.players[id]) {
            this.players[id].name = name;
        }
    }

    // --- HOST LOGIC ---
    startHostLoop() {
        if (!this.isHost) return;

        // Physics Loop (60 TPS) - Keeps game logic fast
        setInterval(() => {
            this.updatePhysics();
        }, 1000 / 60);

        // Network Loop (50 TPS) - High frequency for ultimate smoothness
        setInterval(() => {
            this.broadcastState();
        }, 20);

        this.renderLoop();
    }

    handleInput(playerId, inputs) {
        if (this.players[playerId]) {
            this.players[playerId].inputs = inputs;
        }
    }

    updatePhysics() {
        // Update My Inputs (Host)
        if (this.players['peer_host']) {
            this.players['peer_host'].inputs = this.keys;
        }

        // Move Players
        for (let id in this.players) {
            let p = this.players[id];

            // Movement (Acceleration)
            if (p.inputs.w) p.vy -= this.playerAccel;
            if (p.inputs.s) p.vy += this.playerAccel;
            if (p.inputs.a) p.vx -= this.playerAccel;
            if (p.inputs.d) p.vx += this.playerAccel;

            // Friction & Move
            p.vx *= this.playerFriction;
            p.vy *= this.playerFriction;
            p.x += p.vx;
            p.y += p.vy;

            // Wall Collision (Player)
            p.x = Math.max(this.playerRadius, Math.min(this.width - this.playerRadius, p.x));
            p.y = Math.max(this.playerRadius, Math.min(this.height - this.playerRadius, p.y));

            // Ball Interaction
            let dx = this.ball.x - p.x;
            let dy = this.ball.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            // Shooting Mechanic
            if (p.inputs.space && p.canShoot) {
                if (dist < this.playerRadius + this.ball.radius + 8) {
                    let angle = Math.atan2(dy, dx);
                    let shootForce = 12;
                    this.ball.vx += Math.cos(angle) * shootForce;
                    this.ball.vy += Math.sin(angle) * shootForce;

                    p.canShoot = false;
                    setTimeout(() => { p.canShoot = true; }, 300);
                }
            }

            // Normal Collision (Push ball)
            if (dist < this.playerRadius + this.ball.radius) {
                let angle = Math.atan2(dy, dx);
                let force = 3.5;

                // Position Correction
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

        if (this.ball.x < this.ball.radius + 2) {
            // Blue Goal! (Left Side)
            if (this.ball.y > 170 && this.ball.y < 310) {
                this.score('blue');
            } else {
                this.ball.vx *= -1;
                this.ball.x = this.ball.radius + 2;
            }
        }

        if (this.ball.x > this.width - this.ball.radius - 2) {
            // Red Goal! (Right Side)
            if (this.ball.y > 170 && this.ball.y < 310) {
                this.score('red');
            } else {
                this.ball.vx *= -1;
                this.ball.x = this.width - this.ball.radius - 2;
            }
        }
    }

    score(team) {
        this.scores[team]++;

        // Visual Animation
        const overlay = document.getElementById('goal-overlay');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('hidden'), 2000);

        this.ball.x = this.width / 2;
        this.ball.y = this.height / 2;
        this.ball.vx = 0;
        this.ball.vy = 0;

        for (let id in this.players) {
            let p = this.players[id];
            p.x = p.color === 'red' ? 100 : this.width - 100;
            p.y = this.height / 2;
            p.vx = 0;
            p.vy = 0;
            p.canShoot = true;
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
        // Update UI & Animation
        if (state.scores.red !== this.scores.red || state.scores.blue !== this.scores.blue) {
            this.scores = { ...state.scores };
            const overlay = document.getElementById('goal-overlay');
            if (overlay) {
                overlay.classList.remove('hidden');
                setTimeout(() => overlay.classList.add('hidden'), 2000);
            }
        }

        if (!this.ball.targetX) {
            this.ball.x = state.ball.x;
            this.ball.y = state.ball.y;
        }
        this.ball.targetX = state.ball.x;
        this.ball.targetY = state.ball.y;

        for (let id in state.players) {
            if (!this.players[id]) {
                this.players[id] = state.players[id];
            } else {
                let p = this.players[id];
                let newData = state.players[id];
                if (Math.abs(p.x - newData.x) > 100) {
                    p.x = newData.x;
                    p.y = newData.y;
                }
                p.targetX = newData.x;
                p.targetY = newData.y;
                p.name = newData.name;
                p.inputs = newData.inputs;
            }
        }

        document.getElementById('score-red').innerText = this.scores.red;
        document.getElementById('score-blue').innerText = this.scores.blue;
    }

    renderLoop() {
        if (!this.isHost) {
            this.interpolateEntities();
        }
        this.draw();
        requestAnimationFrame(() => this.renderLoop());
    }

    interpolateEntities() {
        const lerp = (start, end, factor) => start + (end - start) * factor;
        const factor = 0.12;

        for (let id in this.players) {
            let p = this.players[id];
            if (p.targetX !== undefined) {
                if (Math.abs(p.x - p.targetX) > 150) {
                    p.x = p.targetX;
                    p.y = p.targetY;
                } else {
                    p.x = lerp(p.x, p.targetX, factor);
                    p.y = lerp(p.y, p.targetY, factor);
                }
            }
        }

        if (this.ball.targetX !== undefined) {
            this.ball.x = lerp(this.ball.x, this.ball.targetX, factor);
            this.ball.y = lerp(this.ball.y, this.ball.targetY, factor);
        }
    }

    draw() {
        // 1. Draw Beautiful Grass
        let grassGradient = this.ctx.createRadialGradient(
            this.width / 2, this.height / 2, 50,
            this.width / 2, this.height / 2, this.width
        );
        grassGradient.addColorStop(0, '#4e8d3e');
        grassGradient.addColorStop(1, '#345e2a');
        this.ctx.fillStyle = grassGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // 2. Pro Grass Stripes
        this.ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (let i = 0; i < this.width; i += 80) {
            if ((i / 80) % 2 === 0) {
                this.ctx.fillRect(i, 0, 40, this.height);
            }
        }

        // 3. Pitch Outlines
        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(10, 10, this.width - 20, this.height - 20);

        this.ctx.beginPath();
        this.ctx.moveTo(this.width / 2, 10);
        this.ctx.lineTo(this.width / 2, this.height - 10);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(this.width / 2, this.height / 2, 70, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(this.width / 2, this.height / 2, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
        this.ctx.fill();

        this.ctx.strokeRect(10, 110, 100, 260); // Penalty Areas
        this.ctx.strokeRect(this.width - 110, 110, 100, 260);

        // 4. Goals
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = '#fff';
        this.ctx.strokeRect(-5, 170, 20, 140); // Left
        this.ctx.strokeRect(this.width - 15, 170, 20, 140); // Right

        // 5. Draw Players
        for (let id in this.players) {
            let p = this.players[id];
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y + 4, this.playerRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fill();

            if (p.inputs && p.inputs.space) {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, this.playerRadius + 6, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
                this.ctx.fill();
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, this.playerRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color === 'red' ? '#ff4d4d' : '#4d94ff';
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 13px Nunito, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(p.name, p.name === 'Mistake' ? 0 : p.x, p.y - 28);
        }

        // 6. Draw Ball
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#fff';
        this.ctx.fill();
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#333';
        this.ctx.fill();
    }
}

const game = new Game();
