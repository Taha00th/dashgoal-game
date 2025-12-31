// Socket.IO Setup
const SERVER_URL = 'https://dashgoal-server-production.up.railway.app';

const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
});

let isHost = false;
let roomCode = null;
let gameStarted = false;

console.log("Connecting to server: " + SERVER_URL);

// Disable Create button initially
const btnCreate = document.getElementById('btn-create');
if (btnCreate) {
    btnCreate.disabled = true;
    btnCreate.innerText = "Sunucuya Bağlanılıyor...";
}

// Connection Events
socket.on('connect', () => {
    console.log('Connected to server!');

    if (btnCreate) {
        btnCreate.disabled = false;
        btnCreate.innerText = "Oda Oluştur";
        btnCreate.style.opacity = "1";
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    alert('Sunucuya bağlanılamadı! Lütfen sunucu URL\'sini kontrol edin.');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Game Events
socket.on('player-joined', ({ playerId, playerName }) => {
    console.log('Player joined:', playerName);

    if (!gameStarted) {
        startGameHost();
    }

    // Update player name
    game.setPlayerName('peer_blue', playerName);
});

socket.on('receive-input', ({ playerId, input }) => {
    if (isHost && gameStarted) {
        game.handleInput('peer_blue', input);
    }
});

socket.on('receive-state', (state) => {
    if (!isHost) {
        if (!gameStarted) {
            startGameClient();
        }
        game.setState(state);
    }
});

socket.on('host-disconnected', () => {
    alert('Host oyundan ayrıldı!');
    location.reload();
});

socket.on('player-left', (playerId) => {
    console.log('Player left:', playerId);
    alert('Oyuncu ayrıldı!');
    location.reload();
});

// Game Start Functions
function startGameHost() {
    if (gameStarted) return;
    console.log("Starting Host Game...");
    gameStarted = true;

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');

    game.init(true);

    let myName = document.getElementById('username-input').value || "Host";
    game.addPlayer('peer_host', myName, 'red');
    game.addPlayer('peer_blue', "Misafir", 'blue');

    game.startHostLoop();
}

function startGameClient() {
    if (gameStarted) return;
    console.log("Starting Client Game...");
    gameStarted = true;

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');

    game.init(false);
    game.startClientLoop();
}

// UI Handlers

// Play Button
document.getElementById('btn-play-game').addEventListener('click', () => {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('menu-container').classList.remove('hidden');
});

// Create Room
document.getElementById('btn-create').addEventListener('click', () => {
    if (!socket.connected) {
        return alert("Sunucuya bağlı değilsiniz!");
    }

    isHost = true;

    socket.emit('create-room', (response) => {
        if (response.success) {
            roomCode = response.roomCode;

            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('lobby-screen').classList.remove('hidden');
            document.getElementById('display-room-id').innerText = roomCode;
            document.getElementById('status-message').innerText = "Oyuncu bekleniyor...";

            console.log('Room created:', roomCode);
        } else {
            alert('Oda oluşturulamadı!');
        }
    });
});

// Join Room
document.getElementById('btn-join').addEventListener('click', () => {
    roomCode = document.getElementById('room-id-input').value;
    if (!roomCode || roomCode.length < 5) {
        return alert("Lütfen geçerli bir kod girin");
    }

    if (!socket.connected) {
        return alert("Sunucuya bağlı değilsiniz!");
    }

    isHost = false;
    const myName = document.getElementById('username-input').value || "Oyuncu";

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    document.querySelector('#lobby-screen h3').innerText = "BAĞLANILIYOR...";
    document.getElementById('status-message').innerText = "Odaya katılınıyor...";
    document.querySelector('.code-box').classList.add('hidden');
    document.getElementById('btn-close-lobby').classList.add('hidden');

    socket.emit('join-room', roomCode, myName, (response) => {
        if (response.success) {
            console.log('Joined room:', roomCode);
            document.getElementById('status-message').innerText = "Oyun başlıyor...";
        } else {
            alert('Odaya katılınamadı: ' + response.error);
            location.reload();
        }
    });
});

// Close Lobby
document.getElementById('btn-close-lobby').addEventListener('click', () => {
    isHost = false;
    gameStarted = false;

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
});

// Network Functions
function sendInput(inputData) {
    if (socket.connected && !isHost) {
        socket.emit('send-input', inputData);
    }
}

function sendState(stateData) {
    if (socket.connected && isHost) {
        socket.emit('send-state', stateData);
    }
}
