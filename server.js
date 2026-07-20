const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};
let gameState = 'waiting'; // 'waiting', 'countdown', 'playing', 'ended'
let currentRound = 0;
const TOTAL_ROUNDS = 5;
let questions = [];
let questionTimer = null;
const QUESTION_TIME_LIMIT = 10; // seconds
let currentGameMode = 'math'; // 'math' or 'movies'
let optionCountSetting = 4; // 2 or 4 options per question

const MOVIE_QUESTIONS = [
    { prompt: "Tlapková _____", correct: "patrola" },
    { prompt: "Kouzelná _____", correct: "školka" },
    { prompt: "Ledové _____", correct: "království" },
    { prompt: "Jerry a _____", correct: "Tom" },
    { prompt: "Bylo nás _____", correct: "pět" },
    { prompt: "Medvídek _____", correct: "Peddington" },
    { prompt: "Maxipes _____", correct: "Fík" },
    { prompt: "Jája a _____", correct: "Pája" },
    { prompt: "Francimor a _____", correct: "Edudant" },
    { prompt: "Bob a  _____", correct: "Bobek" },
    { prompt: "Princezna _____ (Sofie)", correct: "Sofie" },
    { prompt: "Na _____", correct: "Vlásku" },
    { prompt: "Harry _____", correct: "Potter" },
    { prompt: "Rychlé _____", correct: "Šípy" },
    { prompt: "Princezna _____ první", correct: "Koloběžka" }
];

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('set-name', (name) => {
        players[socket.id] = {
            id: socket.id,
            name: name || 'Anonym',
            ready: false,
            score: 0,
            hasAnswered: false,
            roundPointsEarned: 0
        };
        socket.emit('update-settings', { mode: currentGameMode, optionCount: optionCountSetting });
        io.emit('update-players', Object.values(players));
    });

    socket.on('toggle-ready', () => {
        if (players[socket.id] && gameState === 'waiting') {
            players[socket.id].ready = !players[socket.id].ready;
            io.emit('update-players', Object.values(players));
            checkAllReady();
        }
    });

    socket.on('toggle-gamemode', () => {
        if (gameState === 'waiting') {
            currentGameMode = currentGameMode === 'math' ? 'movies' : 'math';
            io.emit('update-settings', { mode: currentGameMode, optionCount: optionCountSetting });
        }
    });

    socket.on('toggle-option-count', () => {
        if (gameState === 'waiting') {
            optionCountSetting = optionCountSetting === 4 ? 2 : 4;
            io.emit('update-settings', { mode: currentGameMode, optionCount: optionCountSetting });
        }
    });

    socket.on('submit-answer', ({ answer, timeTaken }) => {
        if (gameState !== 'playing') return;
        const player = players[socket.id];
        if (player.hasAnswered) return;

        player.hasAnswered = true;
        const currentQ = questions[currentRound];

        if (answer === currentQ.correct) {
            let points = Math.round(101 * (1 - (timeTaken / QUESTION_TIME_LIMIT)));
            if (points < 0) points = 0;
            if (points > 101) points = 101;
            
            player.score += points;
            player.roundPointsEarned = points;
        } else {
            player.roundPointsEarned = 0;
        }

        checkAllAnswered();
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('update-players', Object.values(players));
        if (Object.keys(players).length === 0) {
            resetGame();
            if (questionTimer) clearInterval(questionTimer);
        }
    });
});

function checkAllReady() {
    const playerList = Object.values(players);
    if (playerList.length > 0 && playerList.every(p => p.ready)) {
        gameState = 'countdown';
        let count = 3;
        io.emit('start-countdown', count);
        
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                io.emit('start-countdown', count);
            } else {
                clearInterval(countdownInterval);
                startGame();
            }
        }, 1000);
    }
}

function generateQuestions() {
    questions = [];
    
    if (currentGameMode === 'math') {
        for (let i = 0; i < TOTAL_ROUNDS; i++) {
            let num1 = Math.floor(Math.random() * 99) + 1;
            let num2 = Math.floor(Math.random() * 99) + 1;
            let op = Math.random() < 0.5 ? '+' : '-';

            if (op === '-' && num1 < num2) {
                let temp = num1;
                num1 = num2;
                num2 = temp;
            }

            let correct = op === '+' ? num1 + num2 : num1 - num2;
            
            let options = new Set([correct]);
            while (options.size < optionCountSetting) {
                let offset = Math.floor(Math.random() * 41) - 20;
                let wrong = correct + offset;
                if (wrong >= 0 && wrong !== correct) {
                    options.add(wrong);
                }
            }

            questions.push({
                prompt: `${num1} ${op} ${num2}`,
                correct: correct,
                options: Array.from(options).sort(() => Math.random() - 0.5)
            });
        }
    } else {
        let shuffledPool = [...MOVIE_QUESTIONS].sort(() => Math.random() - 0.5);
        let selectedPool = shuffledPool.slice(0, TOTAL_ROUNDS);

        selectedPool.forEach(item => {
            let correct = item.correct;
            let otherAnswers = MOVIE_QUESTIONS.map(q => q.correct).filter(ans => ans !== correct);
            otherAnswers.sort(() => Math.random() - 0.5);

            let options = new Set([correct]);
            for (let ans of otherAnswers) {
                if (options.size < optionCountSetting) {
                    options.add(ans);
                }
            }

            questions.push({
                prompt: item.prompt,
                correct: correct,
                options: Array.from(options).sort(() => Math.random() - 0.5)
            });
        });
    }
}

function startGame() {
    gameState = 'playing';
    currentRound = 0;
    generateQuestions();
    Object.values(players).forEach(p => {
        p.score = 0;
        p.hasAnswered = false;
        p.roundPointsEarned = 0;
    });
    sendQuestion();
}

function sendQuestion() {
    if (currentRound < TOTAL_ROUNDS) {
        Object.values(players).forEach(p => {
            p.hasAnswered = false;
            p.roundPointsEarned = 0;
        });

        io.emit('new-question', {
            round: currentRound + 1,
            total: TOTAL_ROUNDS,
            question: questions[currentRound].prompt,
            options: questions[currentRound].options,
            timeLimit: QUESTION_TIME_LIMIT
        });

        let timeLeft = QUESTION_TIME_LIMIT;
        if (questionTimer) clearInterval(questionTimer);

        questionTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(questionTimer);
                Object.values(players).forEach(p => {
                    if (!p.hasAnswered) {
                        p.hasAnswered = true;
                        p.roundPointsEarned = 0;
                    }
                });
                nextRound();
            }
        }, 1000);
    } else {
        endGame();
    }
}

function checkAllAnswered() {
    if (Object.values(players).every(p => p.hasAnswered)) {
        if (questionTimer) clearInterval(questionTimer);
        nextRound();
    }
}

function nextRound() {
    currentRound++;
    sendQuestion();
}

function endGame() {
    gameState = 'ended';
    if (questionTimer) clearInterval(questionTimer);
    
    let playerList = Object.values(players).map(p => ({
        id: p.id,
        name: p.name,
        finalScore: p.score
    }));
    playerList.sort((a, b) => a.name.localeCompare(b.name));

    let initialRevealList = playerList.map(p => ({ ...p, score: 0 }));

    io.emit('game-over', {
        initialList: initialRevealList,
        targetList: playerList
    });

    let totalRevealDuration = (playerList.length * 1800) + 800 + 3000;

    setTimeout(() => {
        resetGame();
        io.emit('return-to-lobby', Object.values(players));
    }, totalRevealDuration);
}

function resetGame() {
    gameState = 'waiting';
    currentRound = 0;
    Object.values(players).forEach(p => {
        p.ready = false;
        p.score = 0;
        p.roundPointsEarned = 0;
        p.hasAnswered = false;
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});