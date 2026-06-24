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
    selectedEnemy: null, // Added for HUMAN mode
    walls: [], // Added for Laser Walls (crossing-forbidden edges)
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

// Audio BGM Element
const titleBgm = document.getElementById('title-bgm');
const gameBgm = document.getElementById('game-bgm');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    buildBoardDOM();

    // Start splash screen countdown
    const splash = document.getElementById('splash-screen');
    if (splash) {
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.remove(); // Remove from DOM after fade-out transition completes
            }, 800); // matches CSS transition time (0.8s)
        }, 3000); // Display splash screen for 3 seconds
    }
});

// Play BGM on first user interaction on the title screen
document.addEventListener('click', startBgmOnInteraction, { once: true });
document.addEventListener('keydown', startBgmOnInteraction, { once: true });

function startBgmOnInteraction() {
    if (screens.title.classList.contains('active')) {
        titleBgm.volume = 0.2; // Moderate title BGM volume
        titleBgm.play().catch(err => console.log("BGM playback restriction: ", err));
    }
}

// Fade out BGM smoothly when game starts
function fadeOutBGM(audioElement, duration = 1000, callback) {
    if (!audioElement) return;
    if (audioElement.paused) {
        if (callback) callback();
        return;
    }
    
    const startVolume = audioElement.volume;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = startVolume / steps;
    
    let currentStep = 0;
    const interval = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
            audioElement.pause();
            audioElement.volume = startVolume; // Restore original volume for next playback
            clearInterval(interval);
            if (callback) callback();
        } else {
            audioElement.volume = Math.max(0, startVolume - (volumeStep * currentStep));
        }
    }, stepTime);
}

// Event Listeners
function setupEventListeners() {
    startBtn.addEventListener('click', () => {
        // Smoothly fade out title BGM and then start game BGM
        fadeOutBGM(titleBgm, 1000, () => {
            gameBgm.volume = 0.15; // Moderate volume for gameplay BGM
            gameBgm.play().catch(err => console.log("Game BGM playback restriction: ", err));
        });

        // Read selected difficulty
        const selectedDiff = document.querySelector('input[name="difficulty"]:checked').value;
        state.difficulty = selectedDiff;
        
        switchScreen('game');
        initGame();
    });

    restartBtn.addEventListener('click', () => {
        if (state.isProcessingAI) return;
        // Restart BGM track from beginning for restart feel
        gameBgm.currentTime = 0;
        initGame();
    });

    quitBtn.addEventListener('click', () => {
        if (state.isProcessingAI) return;
        
        // Stop game BGM immediately
        gameBgm.pause();
        gameBgm.currentTime = 0;

        switchScreen('title');
        
        // Restart Title BGM
        titleBgm.volume = 0.2;
        titleBgm.play().catch(err => console.log(err));
    });

    retryBtn.addEventListener('click', () => {
        switchScreen('game');
        gameBgm.currentTime = 0;
        gameBgm.volume = 0.15;
        gameBgm.play().catch(err => console.log(err));
        initGame();
    });

    backTitleBtn.addEventListener('click', () => {
        // Stop game BGM immediately
        gameBgm.pause();
        gameBgm.currentTime = 0;

        switchScreen('title');
        
        // Restart Title BGM
        titleBgm.volume = 0.2;
        titleBgm.play().catch(err => console.log(err));
    });
}

// Switch Screens
function switchScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Build 4x4 Board UI Grid
function buildBoardDOM() {
    boardElement.innerHTML = '';
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            // Add coordinate span for tech look
            const coordSpan = document.createElement('span');
            coordSpan.className = 'coord-text';
            coordSpan.textContent = `${x},${y}`;
            cell.appendChild(coordSpan);
            
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
        state.maxRounds = 20;
    } else if (state.difficulty === 'hard') {
        state.maxRounds = 20;
    } else if (state.difficulty === 'insame') {
        state.maxRounds = 24;
    } else if (state.difficulty === 'human') {
        state.maxRounds = 24;
    }

    state.currentRound = 1;
    state.phase = 'player';
    state.lastMovedEnemy = null; // null triggers forced A on first turn
    state.enemyCPos = null;
    state.enemyDPos = null;
    state.selectedEnemy = null;
    state.gameOver = false;
    state.winner = null;
    state.isProcessingAI = false;

    // Generate random laser walls based on difficulty
    let wallCount = 2;
    if (state.difficulty === 'easy') {
        wallCount = 1;
    } else if (state.difficulty === 'insame') {
        wallCount = 3;
    }
    state.walls = generateWalls(wallCount);

    // Randomize initial positions
    randomizePositions();

    // Reset board UI
    clearMoveHighlights();
    clearEnemyHighlights();
    renderWalls(); // Render the new laser walls
    
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
    // プレイヤーは中央4マスからランダムにスポーン
    const centerPositions = [
        { x: 1, y: 1 }, { x: 1, y: 2 },
        { x: 2, y: 1 }, { x: 2, y: 2 }
    ];
    state.playerPos = centerPositions[Math.floor(Math.random() * centerPositions.length)];

    // 敵は難易度に応じて端（四隅）の固定位置からスポーン
    if (state.difficulty === 'hard' || state.difficulty === 'insame') {
        // HARD / INSAME (4体): 四隅すべてを占有
        state.enemyAPos = { x: 0, y: 0 };
        state.enemyBPos = { x: 3, y: 0 };
        state.enemyCPos = { x: 0, y: 3 };
        state.enemyDPos = { x: 3, y: 3 };
    } else {
        // EASY / MILD / HUMAN (3体): 左上・右上・左下の3隅
        state.enemyAPos = { x: 0, y: 0 };
        state.enemyBPos = { x: 3, y: 0 };
        state.enemyCPos = { x: 0, y: 3 };
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

    // Enemy C Token (Always created since all difficulties have at least 3 enemies)
    const enemyCToken = document.createElement('div');
    enemyCToken.id = 'token-enemy-c';
    enemyCToken.className = 'token enemy-c';
    enemyCToken.innerHTML = '<div class="token-inner"><span>C</span></div>';
    boardElement.appendChild(enemyCToken);

    // Enemy D Token (Only in HARD and INSAME)
    if (state.difficulty === 'hard' || state.difficulty === 'insame') {
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
    if (state.enemyCPos) {
        setTokenPos('token-enemy-c', state.enemyCPos);
    }
    if (state.enemyDPos) {
        setTokenPos('token-enemy-d', state.enemyDPos);
    }
}

function setTokenPos(tokenId, pos) {
    const token = document.getElementById(tokenId);
    if (!token) return;
    
    // Exact alignment calculation taking 4x4 grid gaps (8px) into account
    token.style.left = `calc(${pos.x} * (25% + 2px))`;
    token.style.top = `calc(${pos.y} * (25% + 2px))`;
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
    if (state.difficulty === 'hard' || state.difficulty === 'insame') {
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
    } else {
        // EASY / MILD / HUMAN (3 enemies)
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
            // 2. Check for Laser Wall block
            if (isWallBlocking(pos, { x: nx, y: ny })) {
                continue;
            }
            
            // 3. No collision with other tokens
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
    if (state.enemyCPos) {
        enemies.push(state.enemyCPos);
    }
    if (state.enemyDPos) {
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
    if (state.enemyCPos) {
        enemies.push(state.enemyCPos);
    }
    if (state.enemyDPos) {
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
    if (state.difficulty === 'hard' || state.difficulty === 'insame') {
        // 4 enemies: Cannot move the one moved last turn
        if (state.lastMovedEnemy === null) {
            candidates = ['A']; // Forced A on first turn
        } else {
            const allEnemies = ['A', 'B', 'C', 'D'];
            candidates = allEnemies.filter(e => e !== state.lastMovedEnemy);
        }
    } else {
        // EASY / MILD / HUMAN (3 enemies): Cannot move the one moved last turn
        if (state.lastMovedEnemy === null) {
            candidates = ['A'];
        } else {
            const allEnemies = ['A', 'B', 'C'];
            candidates = allEnemies.filter(e => e !== state.lastMovedEnemy);
        }
    }

    // HUMAN mode branch: Player controls the enemies manually
    if (state.difficulty === 'human') {
        state.isProcessingAI = false; // Allow human clicking
        state.selectedEnemy = null;

        // Check if there are any valid moves for all candidates
        let anyMovePossible = false;
        const choices = []; // candidates that actually have valid moves
        
        candidates.forEach(enemyId => {
            const currentPos = enemyId === 'A' ? state.enemyAPos : (enemyId === 'B' ? state.enemyBPos : state.enemyCPos);
            const others = [state.playerPos];
            if (enemyId !== 'A') others.push(state.enemyAPos);
            if (enemyId !== 'B') others.push(state.enemyBPos);
            if (enemyId !== 'C') others.push(state.enemyCPos);
            
            const moves = getValidMoves(currentPos, others);
            if (moves.length > 0) {
                anyMovePossible = true;
                choices.push(enemyId);
            }
        });

        if (!anyMovePossible) {
            // Pass automatically if no enemy can move
            const lockedList = candidates.join(' & ');
            logMessage(`追跡者(${lockedList}) は移動ルートが遮断されています (PASS)。`, true);
            state.lastMovedEnemy = candidates[0]; // fallback
            
            setTimeout(() => {
                state.currentRound += 1;
                state.phase = 'player';
                updateUI();
                const ended = checkGameState();
                if (!ended) {
                    highlightValidMoves();
                    logMessage(`ラウンド ${state.currentRound}: あなたのターンです。`);
                }
            }, 1200);
            return;
        }

        // Setup manual selection
        if (state.lastMovedEnemy === null) {
            // First turn: Force UNIT A, but use 2-step selection for UI consistency
            logMessage('追跡者(人間)のターンです。動かす UNIT A (強制・点滅) を選択してください。', true);
            highlightSelectableEnemies(['A']);
        } else {
            logMessage('追跡者(人間)のターンです。動かすUNIT(点滅)を選択してください。', true);
            highlightSelectableEnemies(choices);
        }
        return;
    }

    // Calculate best move among candidates
    let bestChoice = null; // { enemyId, move, score }
    const validMoveChoices = []; // Array of { enemyId, move } for random EASY mode

    candidates.forEach(enemyId => {
        let currentPos, other1, other2, other3;
        if (enemyId === 'A') {
            currentPos = state.enemyAPos;
            other1 = state.enemyBPos;
            other2 = state.enemyCPos;
            other3 = state.enemyDPos;
        } else if (enemyId === 'B') {
            currentPos = state.enemyBPos;
            other1 = state.enemyAPos;
            other2 = state.enemyCPos;
            other3 = state.enemyDPos;
        } else if (enemyId === 'C') {
            currentPos = state.enemyCPos;
            other1 = state.enemyAPos;
            other2 = state.enemyBPos;
            other3 = state.enemyDPos;
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

            // 1. 直後の仮の盤面におけるプレイヤーの移動可能マス数（自由度）を算出
            const simEnemies = [other1];
            if (other2) simEnemies.push(other2);
            if (other3) simEnemies.push(other3);
            simEnemies.push(move); // この敵の移動先も障害物に含める
            
            const immediatePlayerMoves = getValidMoves(state.playerPos, simEnemies);
            const immediateMobility = immediatePlayerMoves.length; // 0〜4

            // 2. シミュレーション（または最短経路）スコアの取得
            let simScore;
            if (state.difficulty === 'hard' || state.difficulty === 'insame') {
                simScore = evaluateMoveWithSimulations(enemyId, move, 100);
            } else if (state.difficulty === 'mild' || state.difficulty === 'easy') {
                simScore = evaluateMoveWithSimulations(enemyId, move, 50);
            } else {
                const pathDist = getShortestPathLength(move, state.playerPos, [other1, other2, other3].filter(p => p !== null));
                simScore = -pathDist * 100; // スケール調整
            }
            
            // 3. 総合評価スコア: 「直後のプレイヤーの逃げ道の少なさ」を極めて高く評価（重み 800）
            let score = (4 - immediateMobility) * 800 + simScore;
            
            if (bestChoice === null || score > bestChoice.score) {
                bestChoice = { enemyId, move, score: score };
            }
        });
    });

    let chosenEnemyId = null;
    let chosenMove = null;

    if (validMoveChoices.length > 0) {
        const useRandom = false;

        if (useRandom) {
            const pick = validMoveChoices[Math.floor(Math.random() * validMoveChoices.length)];
            chosenEnemyId = pick.enemyId;
            chosenMove = pick.move;
            logMessage(`追跡者${chosenEnemyId} がランダムな予測経路を選択。`, true);
        } else if (bestChoice) {
            chosenEnemyId = bestChoice.enemyId;
            chosenMove = bestChoice.move;
            if (state.difficulty === 'hard' || state.difficulty === 'insame' || state.difficulty === 'mild' || state.difficulty === 'easy') {
                const runs = (state.difficulty === 'hard' || state.difficulty === 'insame') ? 100 : 50;
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
    if (state.enemyCPos) {
        enemies.push(state.enemyCPos);
    }
    if (state.enemyDPos) {
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

    // Smoothly fade out game BGM when mission ends
    fadeOutBGM(gameBgm, 1000);

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

// --- Interactive Human vs Human Enemy turn ---
function highlightSelectableEnemies(choices) {
    clearEnemyHighlights();
    
    if (state.gameOver || state.phase !== 'enemy') return;

    choices.forEach(enemyId => {
        const pos = enemyId === 'A' ? state.enemyAPos : (enemyId === 'B' ? state.enemyBPos : state.enemyCPos);
        const cell = boardElement.querySelector(`.cell[data-x="${pos.x}"][data-y="${pos.y}"]`);
        if (cell) {
            cell.classList.add('selectable-enemy');
            cell.dataset.enemyId = enemyId;
            cell.addEventListener('click', handleEnemyCellClick);
        }
    });
}

function handleEnemyCellClick(event) {
    if (state.gameOver || state.phase !== 'enemy') return;

    const cell = event.currentTarget;
    const enemyId = cell.dataset.enemyId;
    
    state.selectedEnemy = enemyId;
    
    // Clear styling but maintain selectable tags so player can switch choice
    const cells = boardElement.querySelectorAll('.cell');
    cells.forEach(c => {
        c.classList.remove('selected-enemy-owner');
        c.classList.remove('valid-enemy-move');
        c.removeEventListener('click', handleEnemyMoveClick);
    });

    cell.classList.add('selected-enemy-owner');
    logMessage(`追跡者${enemyId} が選択されました。移動先を指定してください。`, true);
    
    highlightEnemyMoves(enemyId);
}

function highlightEnemyMoves(enemyId) {
    // Determine current position and obstacles
    const currentPos = enemyId === 'A' ? state.enemyAPos : (enemyId === 'B' ? state.enemyBPos : state.enemyCPos);
    
    // Highlight the selected enemy's owner cell
    const ownerCell = boardElement.querySelector(`.cell[data-x="${currentPos.x}"][data-y="${currentPos.y}"]`);
    if (ownerCell) {
        ownerCell.classList.add('selected-enemy-owner');
    }

    const obstacles = [state.playerPos];
    if (enemyId !== 'A') obstacles.push(state.enemyAPos);
    if (enemyId !== 'B') obstacles.push(state.enemyBPos);
    if (enemyId !== 'C') obstacles.push(state.enemyCPos);

    const moves = getValidMoves(currentPos, obstacles);

    moves.forEach(move => {
        const cell = boardElement.querySelector(`.cell[data-x="${move.x}"][data-y="${move.y}"]`);
        if (cell) {
            cell.classList.add('valid-enemy-move');
            cell.addEventListener('click', handleEnemyMoveClick);
        }
    });
}

function handleEnemyMoveClick(event) {
    if (state.gameOver || state.phase !== 'enemy' || !state.selectedEnemy) return;

    const cell = event.currentTarget;
    const tx = parseInt(cell.dataset.x);
    const ty = parseInt(cell.dataset.y);

    const enemyId = state.selectedEnemy;
    const nextPos = { x: tx, y: ty };

    // Apply movement
    if (enemyId === 'A') state.enemyAPos = nextPos;
    else if (enemyId === 'B') state.enemyBPos = nextPos;
    else if (enemyId === 'C') state.enemyCPos = nextPos;

    updateTokenPositions();
    clearEnemyHighlights();
    
    state.lastMovedEnemy = enemyId;
    state.selectedEnemy = null;

    logMessage(`追跡者${enemyId} が (${tx}, ${ty}) に移動しました。`, true);

    // End Enemy turn and transition back to player
    state.isProcessingAI = true; // Temporary lock during delay
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
    }, 800);
}

function clearEnemyHighlights() {
    const cells = boardElement.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.classList.remove('selectable-enemy');
        cell.classList.remove('selected-enemy-owner');
        cell.classList.remove('valid-enemy-move');
        cell.removeEventListener('click', handleEnemyCellClick);
        cell.removeEventListener('click', handleEnemyMoveClick);
        delete cell.dataset.enemyId;
    });
}

// --- Laser Wall Helper Functions ---

function generateWalls(count) {
    const candidates = [];
    
    // Vertical walls adjacent to the center 4 cells (y=1 or 2, x=0, 1, or 2)
    for (let y = 1; y <= 2; y++) {
        for (let x = 0; x < 3; x++) {
            candidates.push({ type: 'vertical', x: x, y: y });
        }
    }
    // Horizontal walls adjacent to the center 4 cells (x=1 or 2, y=0, 1, or 2)
    for (let y = 0; y < 3; y++) {
        for (let x = 1; x <= 2; x++) {
            candidates.push({ type: 'horizontal', x: x, y: y });
        }
    }
    
    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    
    // Select walls ensuring no coordinate (x, y) is duplicated
    const selected = [];
    const usedCoords = new Set();
    
    for (const wall of candidates) {
        if (selected.length >= count) break;
        const coordKey = `${wall.x},${wall.y}`;
        if (!usedCoords.has(coordKey)) {
            selected.push(wall);
            usedCoords.add(coordKey);
        }
    }
    
    return selected;
}

function renderWalls() {
    // Clear previous walls styling
    const cells = boardElement.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.classList.remove('wall-right');
        cell.classList.remove('wall-bottom');
    });
    
    // Add border-wall classes to cells
    if (state.walls) {
        state.walls.forEach(wall => {
            const cell = boardElement.querySelector(`.cell[data-x="${wall.x}"][data-y="${wall.y}"]`);
            if (cell) {
                if (wall.type === 'vertical') {
                    cell.classList.add('wall-right');
                } else {
                    cell.classList.add('wall-bottom');
                }
            }
        });
    }
}

function isWallBlocking(from, to) {
    if (!state.walls || state.walls.length === 0) return false;
    
    for (const wall of state.walls) {
        if (wall.type === 'vertical') {
            // Vertical wall blocks movement between (wall.x, wall.y) and (wall.x+1, wall.y)
            if (from.y === wall.y && to.y === wall.y) {
                if ((from.x === wall.x && to.x === wall.x + 1) || (from.x === wall.x + 1 && to.x === wall.x)) {
                    return true;
                }
            }
        } else if (wall.type === 'horizontal') {
            // Horizontal wall blocks movement between (wall.x, wall.y) and (wall.x, wall.y+1)
            if (from.x === wall.x && to.x === wall.x) {
                if ((from.y === wall.y && to.y === wall.y + 1) || (from.y === wall.y + 1 && to.y === wall.y)) {
                    return true;
                }
            }
        }
    }
    return false;
}
