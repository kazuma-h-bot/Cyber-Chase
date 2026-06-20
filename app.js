/* ==========================================
   CYBER CHASE - Game Logic
========================================== */

// --- Game State ---
const state = {
    playerPos: { x: 0, y: 0 },
    enemyAPos: { x: 0, y: 0 },
    enemyBPos: { x: 0, y: 0 },
    enemyCPos: null, // Added for MILD/HARD mode
    enemyDPos: null, // Added for HARD mode (4th enemy)
    currentRound: 1, 
    maxRounds: 16, // Dynamic based on difficulty
    phase: 'player', // 'player' or 'enemy'
    lastMovedEnemy: null, // 'A', 'B', 'C', or 'D'
    difficulty: 'mild', // 'easy', 'mild', or 'hard'
    gameOver: false,
    winner: null, // 'player' or 'enemy'
    isProcessingAI: false
};

// --- DOM Elements ---
const screens = {
    title: document.getElementById('title-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
};

const boardElement = document.getElementById('game-board');
const roundCounter = document.getElementById('round-counter');
const phaseIndicator = document.getElementById('phase-indicator');
const nextEnemyIndicator = document.getElementById('next-enemy-indicator');
const statusLog = document.getElementById('status-log');

// Buttons
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const quitBtn = document.getElementById('quit-btn');
const retryBtn = document.getElementById('retry-btn');
const backTitleBtn = document.getElementById('back-title-btn');

// Result Screen Stats
const resultTitle = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');
const statRounds = document.getElementById('stat-rounds');
const statDifficulty = document.getElementById('stat-difficulty');
const statStatus = document.getElementById('stat-status');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    buildBoardDOM();
});

// Event Listeners
function setupEventListeners() {
    startBtn.addEventListener('click', () => {
        // Read selected difficulty
        const selectedDiff = document.querySelector('input[name="difficulty"]:checked').value;
        state.difficulty = selectedDiff;
        
        switchScreen('game');
        initGame();
    });

    restartBtn.addEventListener('click', () => {
        if (state.isProcessingAI) return;
        initGame();
    });

    quitBtn.addEventListener('click', () => {
        if (state.isProcessingAI) return;
        switchScreen('title');
    });

    retryBtn.addEventListener('click', () => {
        switchScreen('game');
        initGame();
    });

    backTitleBtn.addEventListener('click', () => {
        switchScreen('title');
    });
}

// Switch Screens
function switchScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Build 5x5 Board UI Grid
function buildBoardDOM() {
    boardElement.innerHTML = '';
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.dataset.coord = `${x},${y}`;
            
            // Mark start area (middle 2x2 in 4x4 grid)
            if (x >= 1 && x <= 2 && y >= 1 && y <= 2) {
                cell.classList.add('start-area');
            }
            
            boardElement.appendChild(cell);
        }
    }
}

// --- Game Control ---
function initGame() {
    // Set max rounds based on difficulty (4x4 scale)
    if (state.difficulty === 'easy') {
        state.maxRounds = 16;
    } else if (state.difficulty === 'mild') {
        state.maxRounds = 16;
    } else if (state.difficulty === 'hard') {
        state.maxRounds = 20;
    }

    state.currentRound = 1;
    state.phase = 'player';
    state.lastMovedEnemy = null; // null triggers forced A on first turn
    state.enemyCPos = null;
    state.enemyDPos = null;
    state.gameOver = false;
    state.winner = null;
    state.isProcessingAI = false;

    // Randomize initial positions in the middle 3x3
    randomizePositions();

    // Reset board UI
    clearMoveHighlights();
    
    // Create/Recreate tokens
    createTokens();
    
    // Update labels
    updateUI();
    
    // Check if player is immediately trapped (unlikely but possible if 9-cell randomization gets perfect block, though with 3 tokens it's mathematically impossible to trap player immediately because player has at least 2 empty adjacent slots in middle 3x3)
    checkGameState();
    
    if (!state.gameOver) {
        highlightValidMoves();
        logMessage('ミッション開始。あなたのターンです。移動先を選択してください。');
    }
}

// Randomize positions inside the middle 3x3 (1,1) to (3,3)
function randomizePositions() {
    if (state.difficulty === 'hard') {
        // HARD mode: 4 enemies (A, B, C, D). Player starts in the center 2x2.
        // 3 enemies block 3 neighbors, 1 neighbor left as escape route.
        // The 4th enemy is placed in any remaining open space on the board.
        const centerPositions = [
            { x: 1, y: 1 }, { x: 1, y: 2 },
            { x: 2, y: 1 }, { x: 2, y: 2 }
        ];
        const pPos = centerPositions[Math.floor(Math.random() * centerPositions.length)];
        state.playerPos = pPos;
        
        // Neighbors of P
        const neighbors = [
            { x: pPos.x - 1, y: pPos.y },
            { x: pPos.x + 1, y: pPos.y },
            { x: pPos.x, y: pPos.y - 1 },
            { x: pPos.x, y: pPos.y + 1 }
        ];
        
        // Shuffle neighbors to pick 3 to block, leaving 1 escape
        for (let i = neighbors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
        }
        
        const e1 = neighbors[0];
        const e2 = neighbors[1];
        const e3 = neighbors[2];
        const escapeRoute = neighbors[3]; // Not blocked!
        
        // Remaining board spots for the 4th enemy (D)
        const occupiedCoords = new Set([
            `${pPos.x},${pPos.y}`,
            `${e1.x},${e1.y}`,
            `${e2.x},${e2.y}`,
            `${e3.x},${e3.y}`,
            `${escapeRoute.x},${escapeRoute.y}`
        ]);
        
        const availableForD = [];
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                const coordStr = `${x},${y}`;
                if (!occupiedCoords.has(coordStr)) {
                    availableForD.push({ x, y });
                }
            }
        }
        
        const e4 = availableForD[Math.floor(Math.random() * availableForD.length)];
        
        // Randomly assign to A, B, C, and D
        const enemies = [e1, e2, e3, e4];
        for (let i = enemies.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [enemies[i], enemies[j]] = [enemies[j], enemies[i]];
        }
        state.enemyAPos = enemies[0];
        state.enemyBPos = enemies[1];
        state.enemyCPos = enemies[2];
        state.enemyDPos = enemies[3];
    } else if (state.difficulty === 'mild') {
        // MILD mode: 3 enemies (A, B, C) setup corners trapping but leaving 1 escape path
        const centerPositions = [
            { x: 1, y: 1 }, { x: 1, y: 2 },
            { x: 2, y: 1 }, { x: 2, y: 2 }
        ];
        const pPos = centerPositions[Math.floor(Math.random() * centerPositions.length)];
        state.playerPos = pPos;
        
        // Neighbors of P
        const neighbors = [
            { x: pPos.x - 1, y: pPos.y },
            { x: pPos.x + 1, y: pPos.y },
            { x: pPos.x, y: pPos.y - 1 },
            { x: pPos.x, y: pPos.y + 1 }
        ];
        
        // Shuffle neighbors to pick 3 randomly
        for (let i = neighbors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
        }
        
        state.enemyAPos = neighbors[0];
        state.enemyBPos = neighbors[1];
        state.enemyCPos = neighbors[2];
        state.enemyDPos = null;
    } else {
        // EASY: Random inside the central 2x2 grid (1,1) to (2,2), enemy C/D remains null
        const startPositions = [];
        for (let y = 1; y <= 2; y++) {
            for (let x = 1; x <= 2; x++) {
                startPositions.push({ x, y });
            }
        }

        // Shuffle
        for (let i = startPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [startPositions[i], startPositions[j]] = [startPositions[j], startPositions[i]];
        }

        // Assign
        state.playerPos = startPositions[0];
        state.enemyAPos = startPositions[1];
        state.enemyBPos = startPositions[2];
        state.enemyCPos = null;
        state.enemyDPos = null;
    }
}

// Create or update HTML Elements for Tokens
function createTokens() {
    // Remove existing tokens
    const existingTokens = boardElement.querySelectorAll('.token');
    existingTokens.forEach(t => t.remove());

    // Player Token
    const playerToken = document.createElement('div');
    playerToken.id = 'token-player';
    playerToken.className = 'token player';
    playerToken.innerHTML = '<div class="token-inner"><span>P</span></div>';
    boardElement.appendChild(playerToken);

    // Enemy A Token
    const enemyAToken = document.createElement('div');
    enemyAToken.id = 'token-enemy-a';
    enemyAToken.className = 'token enemy-a';
    enemyAToken.innerHTML = '<div class="token-inner"><span>A</span></div>';
    boardElement.appendChild(enemyAToken);

    // Enemy B Token
    const enemyBToken = document.createElement('div');
    enemyBToken.id = 'token-enemy-b';
    enemyBToken.className = 'token enemy-b';
    enemyBToken.innerHTML = '<div class="token-inner"><span>B</span></div>';
    boardElement.appendChild(enemyBToken);

    // Enemy C Token (Only in MILD / HARD)
    if (state.difficulty === 'hard' || state.difficulty === 'mild') {
        const enemyCToken = document.createElement('div');
        enemyCToken.id = 'token-enemy-c';
        enemyCToken.className = 'token enemy-c';
        enemyCToken.innerHTML = '<div class="token-inner"><span>C</span></div>';
        boardElement.appendChild(enemyCToken);
    }

    // Enemy D Token (Only in HARD)
    if (state.difficulty === 'hard') {
        const enemyDToken = document.createElement('div');
        enemyDToken.id = 'token-enemy-d';
        enemyDToken.className = 'token enemy-d';
        enemyDToken.innerHTML = '<div class="token-inner"><span>D</span></div>';
        boardElement.appendChild(enemyDToken);
    }

    updateTokenPositions();
}

// Update the absolute layout positions of the tokens
function updateTokenPositions() {
    setTokenPos('token-player', state.playerPos);
    setTokenPos('token-enemy-a', state.enemyAPos);
    setTokenPos('token-enemy-b', state.enemyBPos);
    if ((state.difficulty === 'hard' || state.difficulty === 'mild') && state.enemyCPos) {
        setTokenPos('token-enemy-c', state.enemyCPos);
    }
    if (state.difficulty === 'hard' && state.enemyDPos) {
        setTokenPos('token-enemy-d', state.enemyDPos);
    }
}

function setTokenPos(tokenId, pos) {
    const token = document.getElementById(tokenId);
    if (!token) return;
    
    // Cell size in 4x4 is 25% width/height.
    token.style.left = `${pos.x * 25}%`;
    token.style.top = `${pos.y * 25}%`;
}

// --- UI Updates ---
function updateUI() {
    roundCounter.textContent = `${String(state.currentRound).padStart(2, '0')} / ${state.maxRounds}`;
    
    if (state.phase === 'player') {
        phaseIndicator.textContent = 'PLAYER';
        phaseIndicator.className = 'status-value blink-cyan';
    } else {
        phaseIndicator.textContent = 'ENEMY';
        phaseIndicator.className = 'status-value blink-magenta';
    }

    // Next enemy info (or locked status)
    if (state.difficulty === 'hard') {
        if (state.lastMovedEnemy === null) {
            nextEnemyIndicator.textContent = 'UNIT A';
            nextEnemyIndicator.style.color = 'var(--neon-magenta)';
        } else if (state.lastMovedEnemy === 'A') {
            nextEnemyIndicator.textContent = 'UNIT B / C / D';
            nextEnemyIndicator.style.color = 'var(--neon-orange)';
        } else if (state.lastMovedEnemy === 'B') {
            nextEnemyIndicator.textContent = 'UNIT A / C / D';
            nextEnemyIndicator.style.color = 'var(--neon-magenta)';
        } else if (state.lastMovedEnemy === 'C') {
            nextEnemyIndicator.textContent = 'UNIT A / B / D';
            nextEnemyIndicator.style.color = 'var(--neon-magenta)';
        } else {
            nextEnemyIndicator.textContent = 'UNIT A / B / C';
            nextEnemyIndicator.style.color = 'var(--neon-magenta)';
        }
    } else if (state.difficulty === 'mild') {
        if (state.lastMovedEnemy === null) {
            nextEnemyIndicator.textContent = 'UNIT A';
            nextEnemyIndicator.style.color = 'var(--neon-magenta)';
        } else if (state.lastMovedEnemy === 'A') {
            nextEnemyIndicator.textContent = 'UNIT B / C';
            nextEnemyIndicator.style.color = 'var(--neon-orange)';
        } else if (state.lastMovedEnemy === 'B') {
            nextEnemyIndicator.textContent = 'UNIT A / C';
            nextEnemyIndicator.style.color = 'var(--neon-magenta)';
        } else {
            nextEnemyIndicator.textContent = 'UNIT A / B';
            nextEnemyIndicator.style.color = 'var(--neon-magenta)';
        }
    } else {
        const nextEnemy = state.lastMovedEnemy === 'A' ? 'UNIT B' : 'UNIT A';
        nextEnemyIndicator.textContent = nextEnemy;
        if (nextEnemy === 'UNIT A') {
            nextEnemyIndicator.style.color = 'var(--neon-magenta)';
        } else {
            nextEnemyIndicator.style.color = 'var(--neon-orange)';
        }
    }
}

function logMessage(msg, isEnemy = false) {
    statusLog.textContent = msg;
    if (isEnemy) {
        statusLog.className = 'info-log enemy-turn';
    } else {
        statusLog.className = 'info-log';
    }
}

// --- Movement Calculations ---
function getValidMoves(pos, otherTokens) {
    const moves = [];
    const dx = [0, 0, 1, -1];
    const dy = [1, -1, 0, 0];

    for (let i = 0; i < 4; i++) {
        const nx = pos.x + dx[i];
        const ny = pos.y + dy[i];

        // 1. Within board bounds (4x4)
        if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4) {
            // 2. No collision with other tokens
            const isColliding = otherTokens.some(t => t && t.x === nx && t.y === ny);
            if (!isColliding) {
                moves.push({ x: nx, y: ny });
            }
        }
    }
    return moves;
}

// Highlight moves for player
function highlightValidMoves() {
    clearMoveHighlights();
    
    if (state.gameOver || state.phase !== 'player') return;

    const enemies = [state.enemyAPos, state.enemyBPos];
    if ((state.difficulty === 'hard' || state.difficulty === 'mild') && state.enemyCPos) {
        enemies.push(state.enemyCPos);
    }
    if (state.difficulty === 'hard' && state.enemyDPos) {
        enemies.push(state.enemyDPos);
    }

    const validMoves = getValidMoves(state.playerPos, enemies);
    
    validMoves.forEach(move => {
        const cell = boardElement.querySelector(`.cell[data-x="${move.x}"][data-y="${move.y}"]`);
        if (cell) {
            cell.classList.add('valid-move');
            cell.addEventListener('click', handleCellClick);
        }
    });
}

function clearMoveHighlights() {
    const cells = boardElement.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.classList.remove('valid-move');
        cell.removeEventListener('click', handleCellClick);
    });
}

// Handle player selection of a cell
function handleCellClick(event) {
    if (state.gameOver || state.phase !== 'player' || state.isProcessingAI) return;

    const cell = event.currentTarget;
    const nx = parseInt(cell.dataset.x);
    const ny = parseInt(cell.dataset.y);

    const enemies = [state.enemyAPos, state.enemyBPos];
    if ((state.difficulty === 'hard' || state.difficulty === 'mild') && state.enemyCPos) {
        enemies.push(state.enemyCPos);
    }
    if (state.difficulty === 'hard' && state.enemyDPos) {
        enemies.push(state.enemyDPos);
    }

    // Double check valid
    const validMoves = getValidMoves(state.playerPos, enemies);
    const isValid = validMoves.some(m => m.x === nx && m.y === ny);

    if (isValid) {
        // Move player
        state.playerPos = { x: nx, y: ny };
        updateTokenPositions();
        clearMoveHighlights();
        
        logMessage(`逃亡者が (${nx}, ${ny}) に移動しました。`);
        
        // Transition to Enemy Phase
        state.phase = 'enemy';
        updateUI();
        
        // Check game state immediately after player move
        const roundFinished = checkGameState();
        
        if (!state.gameOver) {
            // Trigger Enemy Turn with a delay
            state.isProcessingAI = true;
            setTimeout(processEnemyTurn, 800);
        }
    }
}

// --- Enemy AI & Processing ---
function processEnemyTurn() {
    if (state.gameOver) return;

    // Decide active enemy candidates
    let candidates = [];
    if (state.difficulty === 'hard') {
        // 4 enemies: Cannot move the one moved last turn
        if (state.lastMovedEnemy === null) {
            candidates = ['A']; // Forced A on first turn
        } else {
            const allEnemies = ['A', 'B', 'C', 'D'];
            candidates = allEnemies.filter(e => e !== state.lastMovedEnemy);
        }
    } else if (state.difficulty === 'mild') {
        // 3 enemies: Cannot move the one moved last turn
        if (state.lastMovedEnemy === null) {
            candidates = ['A'];
        } else {
            const allEnemies = ['A', 'B', 'C'];
            candidates = allEnemies.filter(e => e !== state.lastMovedEnemy);
        }
    } else {
        // 2 enemies: Alternating
        if (state.lastMovedEnemy === null || state.lastMovedEnemy === 'B') {
            candidates = ['A'];
        } else {
            candidates = ['B'];
        }
    }

    // Calculate best move among candidates
    let bestChoice = null; // { enemyId, move, score }
    const validMoveChoices = []; // Array of { enemyId, move } for random EASY mode

    candidates.forEach(enemyId => {
        let currentPos, other1, other2, other3;
        if (enemyId === 'A') {
            currentPos = state.enemyAPos;
            other1 = state.enemyBPos;
            other2 = (state.difficulty === 'hard' || state.difficulty === 'mild') ? state.enemyCPos : null;
            other3 = (state.difficulty === 'hard') ? state.enemyDPos : null;
        } else if (enemyId === 'B') {
            currentPos = state.enemyBPos;
            other1 = state.enemyAPos;
            other2 = (state.difficulty === 'hard' || state.difficulty === 'mild') ? state.enemyCPos : null;
            other3 = (state.difficulty === 'hard') ? state.enemyDPos : null;
        } else if (enemyId === 'C') {
            currentPos = state.enemyCPos;
            other1 = state.enemyAPos;
            other2 = state.enemyBPos;
            other3 = (state.difficulty === 'hard') ? state.enemyDPos : null;
        } else {
            currentPos = state.enemyDPos;
            other1 = state.enemyAPos;
            other2 = state.enemyBPos;
            other3 = state.enemyCPos;
        }

        // Get moves checking collision with other enemies and player
        const obstacles = [state.playerPos, other1];
        if (other2) obstacles.push(other2);
        if (other3) obstacles.push(other3);
        
        const moves = getValidMoves(currentPos, obstacles);

        moves.forEach(move => {
            validMoveChoices.push({ enemyId, move });

            let score;
            if (state.difficulty === 'hard') {
                score = evaluateMoveWithSimulations(enemyId, move, 100);
            } else if (state.difficulty === 'mild') {
                score = evaluateMoveWithSimulations(enemyId, move, 50);
            } else {
                const pathDist = getShortestPathLength(move, state.playerPos, [other1, other2, other3].filter(p => p !== null));
                score = -pathDist;
            }
            
            if (bestChoice === null || score > bestChoice.score) {
                bestChoice = { enemyId, move, score: score };
            }
        });
    });

    let chosenEnemyId = null;
    let chosenMove = null;

    if (validMoveChoices.length > 0) {
        const useRandom = (state.difficulty === 'easy' && Math.random() < 0.50);

        if (useRandom) {
            const pick = validMoveChoices[Math.floor(Math.random() * validMoveChoices.length)];
            chosenEnemyId = pick.enemyId;
            chosenMove = pick.move;
            logMessage(`追跡者${chosenEnemyId} がランダムな予測経路を選択。`, true);
        } else if (bestChoice) {
            chosenEnemyId = bestChoice.enemyId;
            chosenMove = bestChoice.move;
            if (state.difficulty === 'hard' || state.difficulty === 'mild') {
                const runs = state.difficulty === 'hard' ? 100 : 50;
                logMessage(`追跡者${chosenEnemyId} が${runs}回シミュレーション学習により最適包囲軌道を選択。`, true);
            } else {
                logMessage(`追跡者${chosenEnemyId} が最短インターセプト軌道を算出。`, true);
            }
        }
    }

    // Apply move if valid
    if (chosenEnemyId && chosenMove) {
        if (chosenEnemyId === 'A') {
            state.enemyAPos = chosenMove;
        } else if (chosenEnemyId === 'B') {
            state.enemyBPos = chosenMove;
        } else if (chosenEnemyId === 'C') {
            state.enemyCPos = chosenMove;
        } else if (chosenEnemyId === 'D') {
            state.enemyDPos = chosenMove;
        }
        updateTokenPositions();
        state.lastMovedEnemy = chosenEnemyId;
    } else {
        const lockedList = candidates.join(' & ');
        logMessage(`追跡者(${lockedList}) は移動ルートが遮断されています (PASS)。`, true);
        state.lastMovedEnemy = candidates[0];
    }

    // Delay before changing turn back to player
    setTimeout(() => {
        state.isProcessingAI = false;
        state.currentRound += 1;
        state.phase = 'player';
        updateUI();
        const ended = checkGameState();
        if (!ended) {
            highlightValidMoves();
            logMessage(`ラウンド ${state.currentRound}: あなたのターンです。`);
        }
    }, 600);
}

// --- Monte Carlo Simulation AI for MILD / HARD Mode ---
function evaluateMoveWithSimulations(testEnemyId, firstMove, runs) {
    let scoreSum = 0;
    for (let r = 0; r < runs; r++) {
        scoreSum += runSingleSimulation(testEnemyId, firstMove);
    }
    return scoreSum / runs;
}

function runSingleSimulation(testEnemyId, firstMove) {
    // Clone state
    const simState = {
        player: { x: state.playerPos.x, y: state.playerPos.y },
        A: { x: state.enemyAPos.x, y: state.enemyAPos.y },
        B: { x: state.enemyBPos.x, y: state.enemyBPos.y },
        C: state.enemyCPos ? { x: state.enemyCPos.x, y: state.enemyCPos.y } : null,
        D: state.enemyDPos ? { x: state.enemyDPos.x, y: state.enemyDPos.y } : null,
        lastMoved: state.lastMovedEnemy,
        round: state.currentRound
    };

    // Apply the first candidate move
    if (testEnemyId === 'A') simState.A = { x: firstMove.x, y: firstMove.y };
    else if (testEnemyId === 'B') simState.B = { x: firstMove.x, y: firstMove.y };
    else if (testEnemyId === 'C') simState.C = { x: firstMove.x, y: firstMove.y };
    else if (testEnemyId === 'D') simState.D = { x: firstMove.x, y: firstMove.y };
    simState.lastMoved = testEnemyId;

    let turn = 'player';
    let stepCount = 0;

    const SIMULATION_DEPTH_LIMIT = 12;
    while (stepCount < SIMULATION_DEPTH_LIMIT && simState.round <= state.maxRounds) {
        if (turn === 'player') {
            // Player turns in simulation
            const enemies = [simState.A, simState.B];
            if (simState.C) enemies.push(simState.C);
            if (simState.D) enemies.push(simState.D);
            const pMoves = getValidMoves(simState.player, enemies);

            if (pMoves.length === 0) {
                // Checkmate! Enemy victory in simulation
                return 1000 - stepCount * 30; // Faster checkmate = higher score
            }

            const randomPMove = pMoves[Math.floor(Math.random() * pMoves.length)];
            simState.player = { x: randomPMove.x, y: randomPMove.y };
            
            turn = 'enemy';
        } else {
            // Enemy turns in simulation
            const allEnemies = ['A', 'B'];
            if (simState.C) allEnemies.push('C');
            if (simState.D) allEnemies.push('D');
            const candidates = allEnemies.filter(e => e !== simState.lastMoved);

            const enemyMoves = [];
            candidates.forEach(eId => {
                let currentPos, other1, other2, other3;
                if (eId === 'A') {
                    currentPos = simState.A;
                    other1 = simState.B;
                    other2 = simState.C;
                    other3 = simState.D;
                } else if (eId === 'B') {
                    currentPos = simState.B;
                    other1 = simState.A;
                    other2 = simState.C;
                    other3 = simState.D;
                } else if (eId === 'C') {
                    currentPos = simState.C;
                    other1 = simState.A;
                    other2 = simState.B;
                    other3 = simState.D;
                } else {
                    currentPos = simState.D;
                    other1 = simState.A;
                    other2 = simState.B;
                    other3 = simState.C;
                }

                const obstacles = [simState.player, other1];
                if (other2) obstacles.push(other2);
                if (other3) obstacles.push(other3);

                const moves = getValidMoves(currentPos, obstacles);
                moves.forEach(m => {
                    enemyMoves.push({ enemyId: eId, pos: m });
                });
            });

            if (enemyMoves.length === 0) {
                // Pass in simulation
                simState.lastMoved = candidates[0];
            } else {
                const pick = enemyMoves[Math.floor(Math.random() * enemyMoves.length)];
                if (pick.enemyId === 'A') simState.A = pick.pos;
                else if (pick.enemyId === 'B') simState.B = pick.pos;
                else if (pick.enemyId === 'C') simState.C = pick.pos;
                else if (pick.enemyId === 'D') simState.D = pick.pos;
                simState.lastMoved = pick.enemyId;
            }

            simState.round += 1;
            turn = 'player';
        }
        stepCount++;
    }

    // Fallback evaluation if checkmate not reached
    const finalEnemies = [simState.A, simState.B];
    if (simState.C) finalEnemies.push(simState.C);
    if (simState.D) finalEnemies.push(simState.D);
    const finalPMoves = getValidMoves(simState.player, finalEnemies);

    // Sum Manhattan distances to player
    let distanceSum = 0;
    const list = [simState.A, simState.B];
    if (simState.C) list.push(simState.C);
    if (simState.D) list.push(simState.D);
    list.forEach(e => {
        distanceSum += Math.abs(simState.player.x - e.x) + Math.abs(simState.player.y - e.y);
    });

    // Score: fewer player moves left is good, closer distance is good
    return (4 - finalPMoves.length) * 150 + (12 - distanceSum) * 20;
}

// Breadth First Search to find shortest path to target
function getShortestPathLength(start, target, obstacles) {
    const queue = [{ x: start.x, y: start.y, dist: 0 }];
    const visited = Array(4).fill(null).map(() => Array(4).fill(false));
    visited[start.y][start.x] = true;
    
    if (obstacles) {
        obstacles.forEach(obs => {
            if (obs) visited[obs.y][obs.x] = true;
        });
    }
    
    const dx = [0, 0, 1, -1];
    const dy = [1, -1, 0, 0];
    
    while (queue.length > 0) {
        const curr = queue.shift();
        
        if (curr.x === target.x && curr.y === target.y) {
            return curr.dist;
        }
        
        for (let i = 0; i < 4; i++) {
            const nx = curr.x + dx[i];
            const ny = curr.y + dy[i];
            
            if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4 && !visited[ny][nx]) {
                visited[ny][nx] = true;
                queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
            }
        }
    }
    
    // If blocked, return a high cost (fallback to Manhattan distance)
    return Math.abs(start.x - target.x) + Math.abs(start.y - target.y) + 100;
}

// --- Win/Loss Checker ---
function checkGameState() {
    // 1. Check for player trapped (Checkmate condition)
    const enemies = [state.enemyAPos, state.enemyBPos];
    if ((state.difficulty === 'hard' || state.difficulty === 'mild') && state.enemyCPos) {
        enemies.push(state.enemyCPos);
    }
    if (state.difficulty === 'hard' && state.enemyDPos) {
        enemies.push(state.enemyDPos);
    }
    const playerValidMoves = getValidMoves(state.playerPos, enemies);
    
    if (playerValidMoves.length === 0) {
        endGame('enemy'); // Enemy wins (Checkmate)
        return true;
    }

    // 2. Check for survival limit
    // If the game reaches round maxRounds + 1 (meaning player survived all rounds)
    if (state.currentRound > state.maxRounds) {
        endGame('player'); // Player wins
        return true;
    }

    return false;
}

function endGame(winner) {
    state.gameOver = true;
    state.winner = winner;
    clearMoveHighlights();

    // Delay result screen display for dramatic effect
    setTimeout(() => {
        showResultScreen();
    }, 1200);
}

function showResultScreen() {
    switchScreen('result');
    
    // Fill result details
    statRounds.textContent = Math.min(state.currentRound, state.maxRounds);
    statDifficulty.textContent = state.difficulty.toUpperCase();
    
    if (state.winner === 'player') {
        resultTitle.textContent = 'MISSION SUCCESS';
        resultTitle.className = 'result-title success';
        resultSubtitle.textContent = `${state.maxRounds} ROUNDS SURVIVED`;
        statStatus.textContent = 'EVADED (生存成功)';
        statStatus.className = 'stat-value highlight-green';
    } else {
        resultTitle.textContent = 'MISSION FAILED';
        resultTitle.className = 'result-title failed';
        resultSubtitle.textContent = 'UNIT CAPTURED / CHECKMATE';
        statStatus.textContent = 'CAPTURED (完全包囲)';
        statStatus.className = 'stat-value highlight-red';
    }
}
