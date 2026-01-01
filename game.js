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

        // Sound Effects (Global placeholders)
        this.sounds = {
            kick: new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_73147d3d5d.mp3'),
            goal: new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_97486e9b2b.mp3'),
            crowd: new Audio('https://cdn.pixabay.com/audio/2022/02/22/audio_d0c6ff1bab.mp3')
        };
        this.sounds.crowd.loop = true;
        this.sounds.crowd.volume = 0.2;
        this.audioStarted = false;
    }

    init(isHost) {
        this.isHost = isHost;
        // Keyboard Listeners
        this.keys = { w: false, a: false, s: false, d: false, space: false };
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));

        // Touch Listeners
        this.initTouchControls();

        // Show mobile controls layer (visibility still controlled by CSS media query)
        document.getElementById('mobile-controls').classList.remove('hidden');
    }

    initTouchControls() {
        const joystickBase = document.getElementById('joystick-base');
        const joystickKnob = document.getElementById('joystick-knob');
        const kickBtn = document.getElementById('btn-kick-mobile');

        if (!joystickBase || !kickBtn) return;

        // Kick Button
        kickBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleKey({ key: ' ' }, true);
        });
        kickBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleKey({ key: ' ' }, false);
        });

        // Joystick Logic
        let joystickActive = false;
        let baseRect = null;

        const handleJoystick = (e) => {
            if (!joystickActive) return;
            e.preventDefault();

            const touch = e.touches[0];
            const centerX = baseRect.left + baseRect.width / 2;
            const centerY = baseRect.top + baseRect.height / 2;

            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxRadius = baseRect.width / 2;

            if (dist > maxRadius) {
                dx = (dx / dist) * maxRadius;
                dy = (dy / dist) * maxRadius;
            }

            // Update Knob Position
            joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

            // Map to WASD
            const threshold = 15;
            this.keys.w = dy < -threshold;
            this.keys.s = dy > threshold;
            this.keys.a = dx < -threshold;
            this.keys.d = dx > threshold;

            if (!this.isHost) sendInput(this.keys);
        };

        joystickBase.addEventListener('touchstart', (e) => {
            joystickActive = true;
            baseRect = joystickBase.getBoundingClientRect();
            handleJoystick(e);
        });

        window.addEventListener('touchmove', handleJoystick, { passive: false });

        window.addEventListener('touchend', () => {
            if (!joystickActive) return;
            joystickActive = false;
            joystickKnob.style.transform = `translate(-50%, -50%)`;
            this.keys.w = this.keys.a = this.keys.s = this.keys.d = false;
            if (!this.isHost) sendInput(this.keys);
        });
    }

    handleKey(e, isDown) {
        const key = e.key.toLowerCase();

        // WASD Support
        if (['w', 'a', 's', 'd'].includes(key)) this.keys[key] = isDown;

        // Arrow Keys Support
        if (key === 'arrowup') this.keys['w'] = isDown;
        if (key === 'arrowdown') this.keys['s'] = isDown;
        if (key === 'arrowleft') this.keys['a'] = isDown;
        if (key === 'arrowright') this.keys['d'] = isDown;

        if (key === ' ' || key === 'spacebar') this.keys['space'] = isDown;

        // Start Audio on first interaction
        if (isDown && !this.audioStarted) {
            this.sounds.crowd.play().catch(() => { });
            this.audioStarted = true;
        }

        if (!this.isHost) {
            sendInput(this.keys);
        }
    }

    addPlayer(id, name, teamColor) {
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
            canShoot: true
        };
    }

    setPlayerName(id, name) {
        if (this.players[id]) this.players[id].name = name;
    }

    // --- HOST LOGIC ---
    startHostLoop() {
        if (!this.isHost) return;
        setInterval(() => this.updatePhysics(), 1000 / 60);
        setInterval(() => this.broadcastState(), 20); // 50 Hz
        this.renderLoop();
    }

    handleInput(playerId, inputs) {
        if (this.players[playerId]) this.players[playerId].inputs = inputs;
    }

    updatePhysics() {
        if (this.players['peer_host']) {
            this.players['peer_host'].inputs = this.keys;
        }

        // Move Players
        for (let id in this.players) {
            let p = this.players[id];

            if (p.inputs.w) p.vy -= this.playerAccel;
            if (p.inputs.s) p.vy += this.playerAccel;
            if (p.inputs.a) p.vx -= this.playerAccel;
            if (p.inputs.d) p.vx += this.playerAccel;

            p.vx *= this.playerFriction;
            p.vy *= this.playerFriction;
            p.x += p.vx;
            p.y += p.vy;

            // Simple Screen Boundaries
            p.x = Math.max(this.playerRadius, Math.min(this.width - this.playerRadius, p.x));
            p.y = Math.max(this.playerRadius, Math.min(this.height - this.playerRadius, p.y));

            // Ball Interaction
            let dx = this.ball.x - p.x;
            let dy = this.ball.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (p.inputs.space && p.canShoot) {
                if (dist < this.playerRadius + this.ball.radius + 10) {
                    let angle = Math.atan2(dy, dx);
                    let force = 12;
                    this.ball.vx += Math.cos(angle) * force;
                    this.ball.vy += Math.sin(angle) * force;

                    this.sounds.kick.currentTime = 0;
                    this.sounds.kick.play().catch(() => { });

                    p.canShoot = false;
                    setTimeout(() => { p.canShoot = true; }, 300);
                }
            }

            // Normal Collision
            if (dist < this.playerRadius + this.ball.radius) {
                let angle = Math.atan2(dy, dx);
                let force = 3.5;
                let overlap = (this.playerRadius + this.ball.radius) - dist;
                this.ball.x += Math.cos(angle) * overlap;
                this.ball.y += Math.sin(angle) * overlap;
                this.ball.vx += Math.cos(angle) * force;
                this.ball.vy += Math.sin(angle) * force;

                if (Math.random() > 0.8) {
                    this.sounds.kick.currentTime = 0;
                    this.sounds.kick.volume = 0.4;
                    this.sounds.kick.play().catch(() => { });
                }
            }
        }

        // Move Ball
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;
        this.ball.vx *= this.friction;
        this.ball.vy *= this.friction;

        // Ball Boundaries & Goals
        if (this.ball.y < this.ball.radius || this.ball.y > this.height - this.ball.radius) {
            this.ball.vy *= -1;
            this.ball.y = Math.max(this.ball.radius, Math.min(this.height - this.ball.radius, this.ball.y));
        }

        if (this.ball.x < this.ball.radius + 2) {
            if (this.ball.y > 170 && this.ball.y < 310) {
                this.score('blue');
            } else {
                this.ball.vx *= -1;
                this.ball.x = this.ball.radius + 2;
            }
        } else if (this.ball.x > this.width - this.ball.radius - 2) {
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

        // Broadcast immediately if host
        this.broadcastState();

        // Local Animation
        this.triggerGoalAnimation();

        this.resetPositions();
    }

    triggerGoalAnimation() {
        this.sounds.goal.currentTime = 0;
        this.sounds.goal.play().catch(() => { });

        const overlay = document.getElementById('goal-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('hidden'), 2000);
        }
    }

    resetPositions() {
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
        sendState({
            players: this.players,
            ball: this.ball,
            scores: this.scores
        });
    }

    // --- CLIENT LOGIC ---
    startClientLoop() {
        this.renderLoop();
    }

    setState(state) {
        // Goal Sync
        if (state.scores.red !== this.scores.red || state.scores.blue !== this.scores.blue) {
            this.scores = { ...state.scores };
            this.triggerGoalAnimation();
        }

        // Ball Sync
        if (!this.ball.targetX) {
            this.ball.x = state.ball.x;
            this.ball.y = state.ball.y;
        }
        this.ball.targetX = state.ball.x;
        this.ball.targetY = state.ball.y;

        // Player Sync
        for (let id in state.players) {
            if (!this.players[id]) {
                this.players[id] = state.players[id];
            } else {
                let p = this.players[id];
                let s = state.players[id];
                if (Math.abs(p.x - s.x) > 100) {
                    p.x = s.x; p.y = s.y;
                }
                p.targetX = s.x;
                p.targetY = s.y;
                p.name = s.name;
                p.inputs = s.inputs;
            }
        }

        document.getElementById('score-red').innerText = this.scores.red;
        document.getElementById('score-blue').innerText = this.scores.blue;
    }

    renderLoop() {
        if (!this.isHost) this.interpolateEntities();
        this.draw();
        requestAnimationFrame(() => this.renderLoop());
    }

    interpolateEntities() {
        const factor = 0.12;
        const lerp = (a, b, f) => a + (b - a) * f;

        for (let id in this.players) {
            let p = this.players[id];
            if (p.targetX !== undefined) {
                p.x = lerp(p.x, p.targetX, factor);
                p.y = lerp(p.y, p.targetY, factor);
            }
        }
        if (this.ball.targetX !== undefined) {
            this.ball.x = lerp(this.ball.x, this.ball.targetX, factor);
            this.ball.y = lerp(this.ball.y, this.ball.targetY, factor);
        }
    }

    draw() {
        // 1. Pitch Background
        let grad = this.ctx.createRadialGradient(400, 240, 50, 400, 240, 600);
        grad.addColorStop(0, '#4e8d3e');
        grad.addColorStop(1, '#345e2a');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, 800, 480);

        // 2. Stripes
        this.ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (let i = 0; i < 800; i += 80) if ((i / 80) % 2 === 0) this.ctx.fillRect(i, 0, 40, 480);

        // 3. Lines
        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(10, 10, 780, 460);
        this.ctx.beginPath();
        this.ctx.moveTo(400, 10); this.ctx.lineTo(400, 470);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(400, 240, 70, 0, Math.PI * 2);
        this.ctx.stroke();

        // 4. Goals
        this.ctx.lineWidth = 6;
        this.ctx.strokeRect(-5, 170, 20, 140);
        this.ctx.strokeRect(785, 170, 20, 140);

        // 5. Entities
        for (let id in this.players) {
            let p = this.players[id];
            // Shadow
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y + 4, 15, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)'; this.ctx.fill();
            // Kick Glow
            if (p.inputs.space) {
                this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(255,255,255,0.4)'; this.ctx.fill();
            }
            // Body
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color === 'red' ? '#ff4d4d' : '#4d94ff';
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 3; this.ctx.stroke();
            // Name
            this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 13px Nunito';
            this.ctx.textAlign = 'center'; this.ctx.fillText(p.name, p.x, p.y - 28);
        }

        // Ball
        this.ctx.beginPath(); this.ctx.arc(this.ball.x, this.ball.y, 10, 0, Math.PI * 2);
        this.ctx.fillStyle = '#fff'; this.ctx.fill();
        this.ctx.strokeStyle = '#333'; this.ctx.lineWidth = 2; this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.arc(this.ball.x, this.ball.y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#333'; this.ctx.fill();
    }
}

const game = new Game();
