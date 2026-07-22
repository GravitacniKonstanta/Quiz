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
let currentGameMode = 'math'; // 'math', 'easy-math', 'movies', or 'capitals'
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
    { prompt: "Princezna _____", correct: "Sofie" },
    { prompt: "Na _____", correct: "Vlásku" },
    { prompt: "Princezna _____ první", correct: "Koloběžka" },
    { prompt: "Harry _____", correct: "Potter" },
    { prompt: "Rychlá _____", correct: "Rota" },
    { prompt: "Želvy _____", correct: "Ninja" },
    { prompt: "Rychlé _____", correct: "Šípy" },
    { prompt: "Kosí _____", correct: "Bratři" },
    { prompt: "Pat a _____", correct: "Mat" },
    { prompt: "Káťa a _____", correct: "Škubánek" },
    { prompt: "Mach a _____", correct: "Šebestová" },
    { prompt: "Křemílek a _____", correct: "Vochomůrka" },
    { prompt: "Létající _____", correct: "Čestmír" },
    { prompt: "Princezna se _____", correct: "zlatou hvězdou" },
    { prompt: "Štaflík a _____", correct: "Špagetka" },
    { prompt: "Kocour _____", correct: "v botách" },
    { prompt: "Ať žijí _____", correct: "duchové" },
    { prompt: "Mašinka _____", correct: "Tomáš" },
    { prompt: "Gumítci _____", correct: "méďové" },
    { prompt: "101 _____", correct: "Dalmatínů" },
    { prompt: "Gábin kouzelný _____", correct: "domek" },
    { prompt: "Zootropolis _____", correct: "město zvířat" },
    { prompt: "Červená _____", correct: "Karkuklka" },
    { prompt: "Růžová _____", correct: "Kalkulka" },
    { prompt: "Perníková _____", correct: "chaloupka" },
    { prompt: "Dlouhý, široký a _____", correct: "bystrozraký" },
    { prompt: "Pyšná _____", correct: "princezna" },
    { prompt: "Děd _____", correct: "vševěd" },
    { prompt: "Kačeří _____", correct: "příběhy" },
    { prompt: "Mořská víla _____", correct: "Ariel" },
    { prompt: "Včelí _____", correct: "Medvídci" }
];

const CAPITAL_QUESTIONS = [
    // Evropa
    { prompt: "Albánie", correct: "Tirana" },
    { prompt: "Andorra", correct: "Andorra la Vella" },
    { prompt: "Belgie", correct: "Brusel" },
    { prompt: "Bělorusko", correct: "Minsk" },
    { prompt: "Bosna a Hercegovina", correct: "Sarajevo" },
    { prompt: "Bulharsko", correct: "Sofie" },
    { prompt: "Černá Hora", correct: "Podgorica" },
    { prompt: "Česko", correct: "Praha" },
    { prompt: "Dánsko", correct: "Kodaň" },
    { prompt: "Estonsko", correct: "Tallinn" },
    { prompt: "Finsko", correct: "Helsinky" },
    { prompt: "Francie", correct: "Paříž" },
    { prompt: "Chorvatsko", correct: "Záhřeb" },
    { prompt: "Irsko", correct: "Dublin" },
    { prompt: "Island", correct: "Reykjavík" },
    { prompt: "Itálie", correct: "Řím" },
    { prompt: "Kosovo", correct: "Priština" },
    { prompt: "Lichtenštejnsko", correct: "Vaduz" },
    { prompt: "Litva", correct: "Vilnius" },
    { prompt: "Lotyšsko", correct: "Riga" },
    { prompt: "Lucembursko", correct: "Lucemburk" },
    { prompt: "Maďarsko", correct: "Budapešť" },
    { prompt: "Severní Makedonie", correct: "Skopje" },
    { prompt: "Malta", correct: "Valletta" },
    { prompt: "Moldavsko", correct: "Kišiněv" },
    { prompt: "Monako", correct: "Monako" },
    { prompt: "Německo", correct: "Berlín" },
    { prompt: "Nizozemsko", correct: "Amsterdam" },
    { prompt: "Norsko", correct: "Oslo" },
    { prompt: "Polsko", correct: "Varšava" },
    { prompt: "Portugalsko", correct: "Lisabon" },
    { prompt: "Rakousko", correct: "Vídeň" },
    { prompt: "Rumunsko", correct: "Bukurešť" },
    { prompt: "Rusko", correct: "Moskva" },
    { prompt: "Řecko", correct: "Atény" },
    { prompt: "San Marino", correct: "San Marino" },
    { prompt: "Slovensko", correct: "Bratislava" },
    { prompt: "Slovinsko", correct: "Lublaň" },
    { prompt: "Spojené království", correct: "Londýn" },
    { prompt: "Srbsko", correct: "Bělehrad" },
    { prompt: "Španělsko", correct: "Madrid" },
    { prompt: "Švédsko", correct: "Stockholm" },
    { prompt: "Švýcarsko", correct: "Bern" },
    { prompt: "Ukrajina", correct: "Kyjev" },
    { prompt: "Vatikán", correct: "Vatikán" },

    // Asie
    { prompt: "Afghánistán", correct: "Kábul" },
    { prompt: "Arménie", correct: "Jerevan" },
    { prompt: "Ázerbájdžán", correct: "Baku" },
    { prompt: "Bahrajn", correct: "Manáma" },
    { prompt: "Bangladéš", correct: "Dháka" },
    { prompt: "Bhútán", correct: "Thimphu" },
    { prompt: "Brunej", correct: "Bandar Seri Begawan" },
    { prompt: "Čína", correct: "Peking" },
    { prompt: "Filipíny", correct: "Manila" },
    { prompt: "Gruzie", correct: "Tbilisi" },
    { prompt: "Indie", correct: "Nové Dillí" },
    { prompt: "Indonésie", correct: "Nusantara" },
    { prompt: "Irák", correct: "Bagdád" },
    { prompt: "Írán", correct: "Teherán" },
    { prompt: "Izrael", correct: "Jeruzalém" },
    { prompt: "Japonsko", correct: "Tokio" },
    { prompt: "Jemen", correct: "San'á" },
    { prompt: "Jordánsko", correct: "Ammán" },
    { prompt: "Kambodža", correct: "Phnompenh" },
    { prompt: "Katar", correct: "Dauhá" },
    { prompt: "Kazachstán", correct: "Astana" },
    { prompt: "Kuvajt", correct: "Kuvajt" },
    { prompt: "Kyrgyzstán", correct: "Biškek" },
    { prompt: "Laos", correct: "Vientiane" },
    { prompt: "Libanon", correct: "Bejrút" },
    { prompt: "Malajsie", correct: "Kuala Lumpur" },
    { prompt: "Maledivy", correct: "Male" },
    { prompt: "Mongolsko", correct: "Ulánbátar" },
    { prompt: "Myanmar", correct: "Napyidaw" },
    { prompt: "Nepál", correct: "Káthmándú" },
    { prompt: "Omán", correct: "Maskat" },
    { prompt: "Pákistán", correct: "Islámábád" },
    { prompt: "Saúdská Arábie", correct: "Rijád" },
    { prompt: "Singapur", correct: "Singapur" },
    { prompt: "Severní Korea", correct: "Pchjongjang" },
    { prompt: "Jižní Korea", correct: "Soul" },
    { prompt: "Spojené arabské emiráty", correct: "Abú Zabí" },
    { prompt: "Srí Lanka", correct: "Kolombo" },
    { prompt: "Sýrie", correct: "Damšek" },
    { prompt: "Tádžikistán", correct: "Dušanbe" },
    { prompt: "Thajsko", correct: "Bangkok" },
    { prompt: "Turecko", correct: "Ankara" },
    { prompt: "Turkmenistán", correct: "Ašchabad" },
    { prompt: "Uzbekistán", correct: "Taškent" },
    { prompt: "Vietnam", correct: "Hanoj" },
    { prompt: "Východní Timor", correct: "Dili" },

    // Afrika
    { prompt: "Alžírsko", correct: "Alžír" },
    { prompt: "Angola", correct: "Luanda" },
    { prompt: "Benin", correct: "Porto-Novo" },
    { prompt: "Botswana", correct: "Gaborone" },
    { prompt: "Burkina Faso", correct: "Ouagadougou" },
    { prompt: "Burundi", correct: "Gitega" },
    { prompt: "Čad", correct: "N'Djamena" },
    { prompt: "Džibutsko", correct: "Džibuti" },
    { prompt: "Egypt", correct: "Káhira" },
    { prompt: "Eritrea", correct: "Asmara" },
    { prompt: "Eswatini", correct: "Mbabane" },
    { prompt: "Etiopie", correct: "Addis Abeba" },
    { prompt: "Gabon", correct: "Libreville" },
    { prompt: "Gambie", correct: "Banjul" },
    { prompt: "Ghana", correct: "Accra" },
    { prompt: "Guinea", correct: "Konakry" },
    { prompt: "Guinea-Bissau", correct: "Bissau" },
    { prompt: "Jihoafrická republika", correct: "Pretorie" },
    { prompt: "Jižní Súdán", correct: "Džuba" },
    { prompt: "Kamerun", correct: "Yaoundé" },
    { prompt: "Kapverdy", correct: "Praia" },
    { prompt: "Keňa", correct: "Nairobi" },
    { prompt: "Komory", correct: "Moroni" },
    { prompt: "Kongo", correct: "Brazzaville" },
    { prompt: "Demokratická republika Kongo", correct: "Kinshasa" },
    { prompt: "Lesotho", correct: "Maseru" },
    { prompt: "Libérie", correct: "Monrovia" },
    { prompt: "Libye", correct: "Tripolis" },
    { prompt: "Madagaskar", correct: "Antananarivo" },
    { prompt: "Malawi", correct: "Lilongwe" },
    { prompt: "Mali", correct: "Bamako" },
    { prompt: "Maroko", correct: "Rabat" },
    { prompt: "Mauricius", correct: "Port Louis" },
    { prompt: "Mauritánie", correct: "Nuakšott" },
    { prompt: "Mozambik", correct: "Maputo" },
    { prompt: "Namibie", correct: "Windhoek" },
    { prompt: "Niger", correct: "Niamey" },
    { prompt: "Nigérie", correct: "Abuja" },
    { prompt: "Pobřeží slonoviny", correct: "Yamoussoukro" },
    { prompt: "Rovníková Guinea", correct: "Malabo" },
    { prompt: "Rwanda", correct: "Kigali" },
    { prompt: "Senegal", correct: "Dakar" },
    { prompt: "Seychely", correct: "Victoria" },
    { prompt: "Sierra Leone", correct: "Freetown" },
    { prompt: "Somálsko", correct: "Mogadišo" },
    { prompt: "Středoafrická republika", correct: "Bangui" },
    { prompt: "Súdán", correct: "Chartúm" },
    { prompt: "Svatý Tomáš a Princův ostrov", correct: "Svatý Tomáš" },
    { prompt: "Tanzanie", correct: "Dodoma" },
    { prompt: "Togo", correct: "Lomé" },
    { prompt: "Tunisko", correct: "Tunis" },
    { prompt: "Uganda", correct: "Kampala" },
    { prompt: "Zambie", correct: "Lusaka" },
    { prompt: "Zimbabwe", correct: "Harare" },

    // Severní a Střední Amerika
    { prompt: "Antigua a Barbuda", correct: "St. John's" },
    { prompt: "Bahamy", correct: "Nassau" },
    { prompt: "Barbados", correct: "Bridgetown" },
    { prompt: "Belize", correct: "Belmopan" },
    { prompt: "Dominika", correct: "Roseau" },
    { prompt: "Dominikánská republika", correct: "Santo Domingo" },
    { prompt: "Grenada", correct: "St. George's" },
    { prompt: "Guatemala", correct: "Guatemala" },
    { prompt: "Haiti", correct: "Port-au-Prince" },
    { prompt: "Honduras", correct: "Tegucigalpa" },
    { prompt: "Jamajka", correct: "Kingston" },
    { prompt: "Kanada", correct: "Ottawa" },
    { prompt: "Kostarika", correct: "San José" },
    { prompt: "Kuba", correct: "Havana" },
    { prompt: "Mexiko", correct: "Ciudad de México" },
    { prompt: "Nikaragua", correct: "Managua" },
    { prompt: "Panama", correct: "Panama" },
    { prompt: "Salvador", correct: "San Salvador" },
    { prompt: "Spojené státy americké", correct: "Washington, D.C." },
    { prompt: "Svatá Lucie", correct: "Castries" },
    { prompt: "Svatý Kryštof a Nevis", correct: "Basseterre" },
    { prompt: "Svatý Vincenc a Grenadiny", correct: "Kingstown" },
    { prompt: "Trinidad a Tobago", correct: "Port of Spain" },

    // Jižní Amerika
    { prompt: "Argentina", correct: "Buenos Aires" },
    { prompt: "Bolívie", correct: "Sucre" },
    { prompt: "Brazílie", correct: "Brasília" },
    { prompt: "Ekvádor", correct: "Quito" },
    { prompt: "Guyana", correct: "Georgetown" },
    { prompt: "Chile", correct: "Santiago de Chile" },
    { prompt: "Kolumbie", correct: "Bogotá" },
    { prompt: "Paraguay", correct: "Asunción" },
    { prompt: "Peru", correct: "Lima" },
    { prompt: "Surinam", correct: "Paramaribo" },
    { prompt: "Uruguay", correct: "Montevideo" },
    { prompt: "Venezuela", correct: "Caracas" },

    // Austrálie a Oceánie
    { prompt: "Austrálie", correct: "Canberra" },
    { prompt: "Fidži", correct: "Suva" },
    { prompt: "Kiribati", correct: "Jižní Tarawa" },
    { prompt: "Marshallovy ostrovy", correct: "Majuro" },
    { prompt: "Mikronésie", correct: "Palikir" },
    { prompt: "Nauru", correct: "Yaren" },
    { prompt: "Nový Zéland", correct: "Wellington" },
    { prompt: "Palau", correct: "Ngerulmud" },
    { prompt: "Papua-Nová Guinea", correct: "Port Moresby" },
    { prompt: "Samoa", correct: "Apia" },
    { prompt: "Šalamounovy ostrovy", correct: "Honiara" },
    { prompt: "Tonga", correct: "Nuku'alofa" },
    { prompt: "Tuvalu", correct: "Funafuti" },
    { prompt: "Vanuatu", correct: "Port Vila" }
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
            if (currentGameMode === 'math') {
                currentGameMode = 'easy-math';
            } else if (currentGameMode === 'easy-math') {
                currentGameMode = 'movies';
            } else if (currentGameMode === 'movies') {
                currentGameMode = 'capitals';
            } else {
                currentGameMode = 'math';
            }
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
    } else if (currentGameMode === 'easy-math') {
        for (let i = 0; i < TOTAL_ROUNDS; i++) {
            let num1 = Math.floor(Math.random() * 11);
            let num2 = Math.floor(Math.random() * 11);
            let op = Math.random() < 0.5 ? '+' : '-';

            if (op === '-' && num1 < num2) {
                let temp = num1;
                num1 = num2;
                num2 = temp;
            }

            let correct = op === '+' ? num1 + num2 : num1 - num2;
            
            let options = new Set([correct]);
            while (options.size < optionCountSetting) {
                let offset = Math.floor(Math.random() * 11) - 5;
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
    } else if (currentGameMode === 'movies') {
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
    } else if (currentGameMode === 'capitals') {
        let shuffledPool = [...CAPITAL_QUESTIONS].sort(() => Math.random() - 0.5);
        let selectedPool = shuffledPool.slice(0, TOTAL_ROUNDS);

        selectedPool.forEach(item => {
            let correct = item.correct;
            let otherAnswers = CAPITAL_QUESTIONS.map(q => q.correct).filter(ans => ans !== correct);
            otherAnswers.sort(() => Math.random() - 0.5);

            let options = new Set([correct]);
            for (let ans of otherAnswers) {
                if (options.size < optionCountSetting) {
                    options.add(ans);
                }
            }

            questions.push({
                prompt: `Hlavní město: ${item.prompt}`,
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
        io.emit('update-players', Object.values(players));
        io.emit('return-to-lobby');
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