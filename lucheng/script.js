// 游戏配置
const LEVELS = [
    { distance: 20, tolerance: 2 },
    { distance: 45, tolerance: 2 },
    { distance: 72, tolerance: 2 },
    { distance: 60, tolerance: 2 },
    { distance: 90, tolerance: 2 },
    { distance: 100, tolerance: 2 }
];

const TRACK_WIDTH = 800; // 赛道宽度（像素）
const MAX_DISTANCE = 100; // 赛道最大距离（米）

// 游戏状态
let gameState = {
    currentLevel: 0,
    speed: 5,
    time: 4,
    isMoving: false,
    completedLevels: 0
};

// DOM 元素
const speedSlider = document.getElementById('speedSlider');
const timeSlider = document.getElementById('timeSlider');
const speedValue = document.getElementById('speedValue');
const timeValue = document.getElementById('timeValue');
const formulaResult = document.getElementById('formulaResult');
const targetDistance = document.getElementById('targetDistance');
const currentLevel = document.getElementById('currentLevel');
const starsDisplay = document.getElementById('starsDisplay');
const previewCar = document.getElementById('previewCar');
const parkingSign = document.getElementById('parkingSign');
const movingCar = document.getElementById('movingCar');
const launchBtn = document.getElementById('launchBtn');
const feedback = document.getElementById('feedback');
const levelCompleteModal = document.getElementById('levelCompleteModal');
const gameCompleteModal = document.getElementById('gameCompleteModal');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const restartBtn = document.getElementById('restartBtn');

// 初始化游戏
function initGame() {
    gameState.currentLevel = 0;
    gameState.completedLevels = 0;
    loadLevel(0);
}

// 加载关卡
function loadLevel(levelIndex) {
    gameState.currentLevel = levelIndex;
    const level = LEVELS[levelIndex];
    
    // 更新UI
    currentLevel.textContent = levelIndex + 1;
    targetDistance.textContent = level.distance;
    updateStarsDisplay();
    
    // 重置滑块
    speedSlider.value = 5;
    timeSlider.value = 4;
    gameState.speed = 5;
    gameState.time = 4;
    updateDisplay();
    
    // 重置反馈
    feedback.textContent = '';
    feedback.className = 'feedback';
    
    // 重置小车位置
    movingCar.classList.remove('active', 'moving');
    
    // 更新停车标志位置
    updateParkingSignPosition();
}

// 更新显示值
function updateDisplay() {
    speedValue.textContent = gameState.speed;
    timeValue.textContent = gameState.time;
    
    const distance = gameState.speed * gameState.time;
    formulaResult.textContent = `路程 = ${gameState.speed} × ${gameState.time} = ${distance} 米`;
    
    // 更新预测位置
    updatePreviewPosition();
}

// 更新预测小车位置
function updatePreviewPosition() {
    const distance = gameState.speed * gameState.time;
    const percentage = Math.min((distance / MAX_DISTANCE) * 100, 100);
    const pixelPosition = (percentage / 100) * (TRACK_WIDTH - 40);
    previewCar.style.left = pixelPosition + 'px';
}

// 更新停车标志位置
function updateParkingSignPosition() {
    const level = LEVELS[gameState.currentLevel];
    const percentage = (level.distance / MAX_DISTANCE) * 100;
    const pixelPosition = (percentage / 100) * (TRACK_WIDTH - 40);
    parkingSign.style.left = pixelPosition + 'px';
}

// 更新星星显示
function updateStarsDisplay() {
    const stars = '⭐'.repeat(gameState.completedLevels) + '☆'.repeat(LEVELS.length - gameState.completedLevels);
    starsDisplay.textContent = stars;
}

// 滑块事件监听
speedSlider.addEventListener('input', (e) => {
    gameState.speed = parseInt(e.target.value);
    updateDisplay();
});

timeSlider.addEventListener('input', (e) => {
    gameState.time = parseInt(e.target.value);
    updateDisplay();
});

// 出发按钮
launchBtn.addEventListener('click', launchCar);

function launchCar() {
    if (gameState.isMoving) return;
    
    gameState.isMoving = true;
    launchBtn.disabled = true;
    speedSlider.disabled = true;
    timeSlider.disabled = true;
    feedback.textContent = '';
    
    const distance = gameState.speed * gameState.time;
    const level = LEVELS[gameState.currentLevel];
    
    // 计算小车应该到达的位置
    const percentage = Math.min((distance / MAX_DISTANCE) * 100, 100);
    const finalPixelPosition = (percentage / 100) * (TRACK_WIDTH - 40);
    
    // 计算动画时间（基于实际时间）
    const animationDuration = gameState.time * 1000;
    
    // 重置动画（移除 moving class 以重新触发）
    movingCar.classList.remove('moving');
    movingCar.style.left = '10px';
    
    // 强制重排以重新触发动画
    void movingCar.offsetWidth;
    
    // 显示运动中的小车
    movingCar.classList.add('active');
    
    // 设置最终位置并启动动画
    movingCar.style.setProperty('--final-position', finalPixelPosition + 'px');
    movingCar.style.setProperty('--animation-duration', animationDuration + 'ms');
    movingCar.classList.add('moving');
    
    // 动画完成后检查结果
    setTimeout(() => {
        checkResult(distance, level);
    }, animationDuration);
}

function checkResult(distance, level) {
    const difference = Math.abs(distance - level.distance);
    const isSuccess = difference <= level.tolerance;
    
    movingCar.classList.remove('moving');
    
    if (isSuccess) {
        // 成功！
        gameState.completedLevels++;
        feedback.textContent = '✨ 完美停车！获得一颗星！';
        feedback.className = 'feedback success';
        
        // 显示完成模态框
        setTimeout(() => {
            levelCompleteModal.classList.add('active');
        }, 500);
    } else {
        // 失败，显示差距
        const direction = distance > level.distance ? '超过了' : '还差';
        const gap = Math.abs(distance - level.distance).toFixed(1);
        feedback.textContent = `再试一次！${direction} ${gap} 米`;
        feedback.className = 'feedback warning';
        
        // 重置按钮状态
        gameState.isMoving = false;
        launchBtn.disabled = false;
        speedSlider.disabled = false;
        timeSlider.disabled = false;
    }
}

// 下一关按钮
nextLevelBtn.addEventListener('click', () => {
    levelCompleteModal.classList.remove('active');
    
    if (gameState.currentLevel + 1 < LEVELS.length) {
        loadLevel(gameState.currentLevel + 1);
        gameState.isMoving = false;
        launchBtn.disabled = false;
        speedSlider.disabled = false;
        timeSlider.disabled = false;
    } else {
        // 游戏完成
        gameCompleteModal.classList.add('active');
    }
});

// 重新开始按钮
restartBtn.addEventListener('click', () => {
    gameCompleteModal.classList.remove('active');
    initGame();
    gameState.isMoving = false;
    launchBtn.disabled = false;
    speedSlider.disabled = false;
    timeSlider.disabled = false;
});

// 启动游戏
initGame();
