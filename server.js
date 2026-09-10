const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let gameState = {
    status: 'lobby', 
    participants: [],
    currentQuestion: null
};

const HOST_PASS = "host123"; 
const ADMIN_PASS = "admin123";

io.on('connection', (socket) => {
    socket.on('join_student', (fullName) => {
        if(gameState.status !== 'lobby') {
            socket.emit('error', 'El juego ya empezó.');
            return;
        }
        // Agregamos 'hasAnswered' para evitar respuestas múltiples
        gameState.participants.push({ id: socket.id, name: fullName, score: 0, hasAnswered: false });
        io.emit('update_participants', gameState.participants);
    });

    socket.on('login', (data) => {
        if (data.role === 'host' && data.password === HOST_PASS) {
            socket.emit('login_success', 'host');
        } else if (data.role === 'admin' && data.password === ADMIN_PASS) {
            socket.emit('login_success', 'admin');
            socket.emit('update_participants', gameState.participants);
        } else {
            socket.emit('login_error', 'Contraseña incorrecta');
        }
    });

    socket.on('start_game', () => {
        gameState.status = 'playing';
        io.emit('game_started');
    });

    socket.on('send_question', (questionData) => {
        // Reseteamos el estado de respuesta de todos los alumnos
        gameState.participants.forEach(p => p.hasAnswered = false);
        
        // Guardamos la pregunta actual en el servidor con la marca de tiempo
        gameState.currentQuestion = {
            ...questionData,
            serverStartTime: Date.now()
        };
        
        // Enviamos la pregunta a las pantallas (sin incluir el índice correcto para evitar trampas)
        io.emit('new_question', {
            question: questionData.question,
            options: questionData.options,
            timeLimit: questionData.timeLimit
        });
    });

    socket.on('submit_answer', (answerIndex) => {
        if (!gameState.currentQuestion) return;
        
        let participant = gameState.participants.find(p => p.id === socket.id);
        
        // Validamos que el alumno exista y no haya contestado ya esta pregunta
        if (!participant || participant.hasAnswered) return;
        participant.hasAnswered = true;
        
        // Verificamos si la respuesta es correcta
        if (answerIndex === gameState.currentQuestion.correctIndex) {
            const timeElapsed = Date.now() - gameState.currentQuestion.serverStartTime;
            const timeLimitMs = gameState.currentQuestion.timeLimit * 1000;
            const timeLeft = timeLimitMs - timeElapsed;
            
            if (timeLeft > 0) {
                // Cálculo de puntos: Máximo 1000, disminuye con el tiempo
                const points = Math.round((timeLeft / timeLimitMs) * 1000);
                participant.score += points;
            }
        }
        
        io.emit('update_participants', gameState.participants);
    });

    socket.on('end_game', () => {
        gameState.status = 'finished';
        io.emit('show_results', gameState.participants);
    });

    socket.on('disconnect', () => {
        gameState.participants = gameState.participants.filter(p => p.id !== socket.id);
        io.emit('update_participants', gameState.participants);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
