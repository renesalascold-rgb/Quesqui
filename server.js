const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // Carpeta para tu index.html

// Estado del juego en memoria
let gameState = {
    status: 'lobby', // lobby, playing, finished
    participants: [],
    currentQuestion: null
};

const HOST_PASS = "host123"; // Contraseñas que deben venir de variables de entorno
const ADMIN_PASS = "admin123";

io.on('connection', (socket) => {
    // Registro de alumno
    socket.on('join_student', (fullName) => {
        if(gameState.status !== 'lobby') {
            socket.emit('error', 'El juego ya empezó.');
            return;
        }
        gameState.participants.push({ id: socket.id, name: fullName, score: 0 });
        io.emit('update_participants', gameState.participants); // Actualiza al host
    });

    // Login de Host / Admin
    socket.on('login', (data) => {
        if (data.role === 'host' && data.password === HOST_PASS) {
            socket.emit('login_success', 'host');
        } else if (data.role === 'admin' && data.password === ADMIN_PASS) {
            socket.emit('login_success', 'admin');
        } else {
            socket.emit('login_error', 'Contraseña incorrecta');
        }
    });

    // Control del juego por el Host
    socket.on('start_game', () => {
        gameState.status = 'playing';
        io.emit('game_started');
    });

    socket.on('send_question', (questionData) => {
        gameState.currentQuestion = questionData;
        io.emit('new_question', questionData);
    });

    socket.on('end_game', () => {
        gameState.status = 'finished';
        io.emit('show_results', gameState.participants);
    });

    // Desconexión
    socket.on('disconnect', () => {
        gameState.participants = gameState.participants.filter(p => p.id !== socket.id);
        io.emit('update_participants', gameState.participants);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);

});
