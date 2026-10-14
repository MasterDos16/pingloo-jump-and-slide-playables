let activeCharMC = null;
let player;
let ground;
let hillShape; 
let gameRoot; 
let avalanche; 

// === ЗВУКИ И МУЗЫКА ===
let currentBgmInstance = null;
let currentBgmName = "";
let avalancheSoundInstance = null;

let velocityY = 0;
let isDiving = false;
let wasDiving = false; 
let inactivityFrames = 0; 
let isComboSliding = false;

let comboCount = 0;       
let comboMultiplier = 0;  

let speedX = 15; 
let minSpeedX = 2; 
let maxSpeedX = 100; 
let worldOffsetX = 0; 

let avalancheWorldX = -500; 
let avalancheBaseSpeed = 12; 
let isGameOver = false;  
let isPlaying = false; 

let maxFlightHeight = 0; 
let hasTouchedGroundOnce = false; 

let playerAnimLock = 0;       
let currentJumpHeight = 0;    
let trackSeed = 0; 

let playerHitboxOffset = 50; 
let baseY = 580; 
let currentState = "";

let coinsContainer;
let coins = [];
let nextCoinX = 2500;
let coinsCollected = 0;
let effects = []; 

// === ЭНЕРГИЯ И РЫБКИ ===
let maxEnergy = 100;
let currentEnergy = 100;
let visualEnergy = 100; // <--- ДОБАВЛЯЕМ ВИЗУАЛЬНУЮ ЭНЕРГИЮ
let energyDepletionRate = 0.08; 
let fishes = [];
let nextFishX = 3000; 
let comboAnimTimer = 0;

// === САНКИ И ТРАНСПОРТ ===
let sleds = [];
let nextSledX = 15000; // На какой дистанции впервые появляются сани
let hasSled = false;
let sledTimer = 0;
let activeSledInstance = null;

let cameraContainer;
let initialUI_Y = {};

// === ЭКОНОМИКА И ДАННЫЕ ИГРОКА ===
let globalCoins = parseInt(localStorage.getItem("pinglooTotalCoins")) || 0;
let unlockedBiomes = [0];
//let unlockedBiomes = JSON.parse(localStorage.getItem("pinglooUnlockedBiomes")) || [0]; 

let unlockedChars = [0, 1, 2, 3]; // Временно открыты все 4 персонажа
window.selectedCharID = parseInt(localStorage.getItem("pinglooSelectedChar")) || 0; // Запоминаем выбор

function updateGlobalUI() {
    let record = localStorage.getItem("pinglooRecordDistance") || 0;
    
    if (gameRoot.menuScreen) {
        if (gameRoot.menuScreen.txtRecord) gameRoot.menuScreen.txtRecord.text = record;
        if (gameRoot.menuScreen.txtTotalCoins) gameRoot.menuScreen.txtTotalCoins.text = globalCoins;
    }
    if (gameRoot.menuLevelScreen && gameRoot.menuLevelScreen.txtTotalCoins) {
        gameRoot.menuLevelScreen.txtTotalCoins.text = globalCoins;
    }
    if (gameRoot.menuCharScreen && gameRoot.menuCharScreen.txtTotalCoins) {
        gameRoot.menuCharScreen.txtTotalCoins.text = globalCoins;
    }
}

// === ЛОГИКА ПЕРЕХОДОВ БИОМОВ ===
let isTransitioning = false;
let transitionProgress = 0; 
let prevBiome = null;

function hexToRgb(hex) {
    let c = hex.substring(1).split('');
    if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    c = '0x' + c.join('');
    return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
}
function interpolateColor(color1, color2, factor) {
    let c1 = hexToRgb(color1);
    let c2 = hexToRgb(color2);
    let r = Math.round(c1.r + factor * (c2.r - c1.r));
    let g = Math.round(c1.g + factor * (c2.g - c1.g));
    let b = Math.round(c1.b + factor * (c2.b - c1.b));
    return `rgb(${r},${g},${b})`;
}

// === НАСТРОЙКИ БИОМОВ ===
let currentBiomeIndex = 0;
let biomes = [
    { id: 0, startDist: 0,    lineColor: "#A8E8E6", fillColor: "#FFFFFF" }, 
    { id: 1, startDist: 1500, lineColor: "#63B6E5", fillColor: "#ABEFFF" }, 
    { id: 2, startDist: 3000, lineColor: "#99D798", fillColor: "#BCFBB2" }, 
    { id: 3, startDist: 4500, lineColor: "#D9B558", fillColor: "#FFE783" }, 
    { id: 4, startDist: 6000, lineColor: "#C0BBA6", fillColor: "#E2DCC3" }, 
    { id: 5, startDist: 7500, lineColor: "#337B99", fillColor: "#57A6C8" }, 
    { id: 6, startDist: 9000, lineColor: "#27AE60", fillColor: "#EAFAF1" },
    { id: 7, startDist: 10500, lineColor: "#9B59B6", fillColor: "#D2B4DE" } // <--- Восьмой биом
];

function spawnBoostFlash() {
    let flash = new createjs.Shape();
    flash.graphics.beginFill("#00FFFF").drawCircle(0, 0, 50);
    flash.x = player.x;
    // Теперь вспышка центрируется прямо по точке регистрации персонажа.
    // Если нужно опустить её ещё чуть ниже (на пузико), сделай: player.y + 20;
    flash.y = player.y + 85;
    flash.alpha = 0.8;
    
    let playerIndex = cameraContainer.getChildIndex(player);
    cameraContainer.addChildAt(flash, playerIndex);
    effects.push({ shape: flash, type: "comboFlash", life: 1.0 });
}

function spawnComboText(combo) {
    // Если 1, пишем "COMBO!", иначе "COMBO xN!"
    let textStr = combo === 1 ? "COMBO!" : "COMBO x" + combo + "!";
    let txt = new createjs.Text(textStr, "bold 40px Arial Black", "#FFD700");
    txt.textAlign = "center";
    txt.shadow = new createjs.Shadow("#FF4500", 0, 4, 10); 
    txt.x = player.x;
    txt.y = player.y - 120; 
    
    cameraContainer.addChild(txt);
    effects.push({ shape: txt, type: "comboText" });
}

function spawnCoin(worldX, worldY) {
    let coinObj = new createjs.Container();
    let LibClassCoin = window.lib ? window.lib.Coin : null;
    if (!LibClassCoin && window.AdobeAn) {
        try {
            let compName = Object.keys(AdobeAn.compositions)[0];
            let compLib = AdobeAn.getComposition(compName).getLibrary();
            LibClassCoin = compLib.Coin;
        } catch(e) {}
    }

    if (LibClassCoin) {
        let actualCoin = new LibClassCoin();
        coinObj.addChild(actualCoin);
    }
    
    coinObj.x = worldX - worldOffsetX; 
    coinObj.y = worldY; 
    
    coinsContainer.addChild(coinObj);
    coins.push({ shape: coinObj, worldX: worldX, worldY: worldY, hitRadius: 35, hit: false });
}

function spawnFish(worldX, worldY) {
    let fishObj = new createjs.Container();
    let LibClassFish = window.lib ? window.lib.Fish : null;
    
    if (!LibClassFish && window.AdobeAn) {
        try {
            let compName = Object.keys(AdobeAn.compositions)[0];
            let compLib = AdobeAn.getComposition(compName).getLibrary();
            LibClassFish = compLib.Fish;
        } catch(e) {}
    }

    if (LibClassFish) {
        fishObj.addChild(new LibClassFish());
    } else {
        let shape = new createjs.Shape();
        shape.graphics.beginFill("#FF8C00").drawEllipse(-15, -10, 30, 20);
        fishObj.addChild(shape);
    }
    
    fishObj.x = worldX - worldOffsetX; 
    fishObj.y = worldY; 
    
    let nextY = getHillY(worldX + 5);
    let prevY = getHillY(worldX - 5);
    let angleRad = Math.atan2(nextY - prevY, 10);
    fishObj.rotation = angleRad * (180 / Math.PI); 
    
    coinsContainer.addChild(fishObj); 
    fishes.push({ shape: fishObj, worldX: worldX, worldY: worldY, hitRadius: 40, hit: false });
}

function spawnSled(worldX, worldY) {
    let sledObj = new createjs.Container();
    let LibClassSled = window.lib ? window.lib.Sled : null;
    
    if (!LibClassSled && window.AdobeAn) {
        try {
            let compName = Object.keys(AdobeAn.compositions)[0];
            let compLib = AdobeAn.getComposition(compName).getLibrary();
            LibClassSled = compLib.Sled;
        } catch(e) {}
    }

    if (LibClassSled) {
        sledObj.addChild(new LibClassSled());
    } else {
        let shape = new createjs.Shape();
        shape.graphics.beginFill("#8B4513").drawRect(-40, -15, 80, 30);
        sledObj.addChild(shape);
    }
    
    sledObj.x = worldX - worldOffsetX; 
    sledObj.y = worldY; 
    
    let nextY = getHillY(worldX + 5);
    let prevY = getHillY(worldX - 5);
    let angleRad = Math.atan2(nextY - prevY, 10);
    sledObj.rotation = angleRad * (180 / Math.PI); 
    
    // Добавляем сани в камеру прямо ПОД персонажа (перед player)
    let playerIndex = cameraContainer.getChildIndex(player);
    cameraContainer.addChildAt(sledObj, playerIndex);
    sleds.push({ shape: sledObj, worldX: worldX, worldY: worldY, hitRadius: 50, hit: false });
}

window.activeBiomes = { 0: {} };
window.biomeLoadQueue = [];
window.isBiomeLoading = false;

function queueBiomeLoad(index) {
    if (index === 0 || window.activeBiomes[index] || window.isBiomeLoading) return;
    window.isBiomeLoading = true;
    window.activeBiomes[index] = {}; 

    let classes = [
        { key: "sky", libName: "Sky_" + index },
        { key: "cloudsBack", libName: "CloudsBack_" + index },
        { key: "mountainsMid", libName: "MountainsMid_" + index },
        { key: "mountains", libName: "Mountains_" + index },
        { key: "trees", libName: "Trees_" + index },
        { key: "cloudsFront", libName: "CloudsFront_" + index }
    ];

    classes.forEach(item => {
        window.biomeLoadQueue.push({ index: index, key: item.key, libName: item.libName });
    });
}

function unloadBiome(index) {
    if (index === 0 || !window.activeBiomes[index]) return;
    let b = window.activeBiomes[index];
    
    for (let key in b) {
        if (b[key]) {
            if (b[key].cacheCanvas) b[key].uncache();
            if (b[key].parent) b[key].parent.removeChild(b[key]);
        }
    }
    delete window.activeBiomes[index]; 
}

window.initGame = function(root) {
    gameRoot = root; 

    // === РЕГИСТРАЦИЯ ВНЕШНИХ ЗВУКОВ ===
    createjs.Sound.registerSound("sounds/bgm_menu.mp3", "BgmMenu");
    createjs.Sound.registerSound("sounds/bgm_game.mp3", "BgmGame");
    createjs.Sound.registerSound("sounds/SfxCoin2.mp3", "SfxCoin");
    createjs.Sound.registerSound("sounds/SfxCombo2.mp3", "SfxCombo");
    createjs.Sound.registerSound("sounds/SfxAvalanche.mp3", "SfxAvalanche");
    createjs.Sound.registerSound("sounds/SfxCrash2.mp3", "SfxCrash");
    createjs.Sound.registerSound("sounds/SfxClick2.mp3", "SfxClick");
    createjs.Sound.registerSound("sounds/sfx_sled_pickup.mp3", "SfxSledPickup");
    createjs.Sound.registerSound("sounds/sfx_land2.mp3", "SfxLand");
    createjs.Sound.registerSound("sounds/sfx_sled_break.mp3", "SfxSledBreak");
    createjs.Sound.registerSound("sounds/sfx_fish2.mp3", "SfxFish");

    player = root.player;

    // Запоминаем изначальную позицию персонажа на экране
    if (window.playerStartX === undefined) {
        window.playerStartX = player.x;
    }
    
    let isGoodStart = false;
    while (!isGoodStart) {
        trackSeed = Math.random() * 100000;
        let px = player.x; 
        let y0 = getHillY(px);         
        let y100 = getHillY(px + 100); 
        let y200 = getHillY(px + 200); 
        if (y0 < baseY - 50 && y100 > y0 + 15 && y200 > y100 + 15) {
            isGoodStart = true; 
        }
    }
    
    ground = root.ground;
    if(ground) ground.visible = false; 
    avalanche = root.avalanche; 

    cameraContainer = new createjs.Container();
    cameraContainer.regX = 0; 
    cameraContainer.regY = 0;

    hillShape = new createjs.Shape();
    coinsContainer = new createjs.Container();

    cameraContainer.addChild(player);      // Сначала Кико (на самый низ камеры)
    cameraContainer.addChild(hillShape);   // Сверху накрываем холмами (снег перекроет живот)
    cameraContainer.addChild(coinsContainer); // Монетки поверх снега
    if (avalanche) cameraContainer.addChild(avalanche);

    window.bgSky = root.bgSky;
    window.bgCloudsBack = root.bgCloudsBack;
    window.bgMountains = root.bgMountains;
    window.bgTrees = root.bgTrees;
    window.bgCloudsFront = root.bgCloudsFront;

    // === 1. ЖЕЛЕЗОБЕТОННЫЙ СБРОС СМЕЩЕНИЙ ИЗ ANIMATE ===
    if (root.bgContainerMC) {
        // Убиваем скрытые сдвиги и центры регистрации
        root.bgContainerMC.setTransform(0, 0, 1, 1, 0, 0, 0, 0, 0);
        
        // === 2. ПЕРЕНОСИМ НУЛЕВОЙ БИОМ ВНУТРЬ ПАПКИ ===
        // Теперь они живут в одном доме с новыми биомами и не будут смещаться!
        if (window.bgSky) root.bgContainerMC.addChild(window.bgSky);
        if (window.bgCloudsBack) root.bgContainerMC.addChild(window.bgCloudsBack);
        if (window.bgMountains) root.bgContainerMC.addChild(window.bgMountains);
        if (window.bgTrees) root.bgContainerMC.addChild(window.bgTrees);
    }
    
    // === ДОБАВЛЯЕМ КАМЕРУ НА НУЖНЫЙ СЛОЙ ===
    if (root.bgContainerMC) {
        // Узнаем, на каком слое лежит папка с фонами
        let bgIndex = root.getChildIndex(root.bgContainerMC);
        
        // addChildAt ВСТАВЛЯЕТ камеру на сцену ровно на один слой выше фонов
        root.addChildAt(cameraContainer, bgIndex + 1);
        
        // Передние облака добавляем еще на один слой выше камеры
        if (window.bgCloudsFront) { 
            root.addChildAt(window.bgCloudsFront, bgIndex + 2); 
        }
    } else {
        // Резервный вариант, если папки вдруг нет
        root.addChild(cameraContainer);
        if (window.bgCloudsFront) root.addChild(window.bgCloudsFront);
    }

    // === БРОНЕБОЙНЫЙ ВЫВОД ИНТЕРФЕЙСА НА ВЕРХНИЙ СЛОЙ ===
    // Берем все экраны и элементы UI и принудительно кладем их поверх камеры и биомов
    let allUI = ["pauseScreen", "gameOverScreen", "menuScreen", "txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    allUI.forEach(name => {
        if (root[name]) {
            root.addChild(root[name]); // addChild всегда бросает объект на самый верх
        }
    });

    // Регистрируем нулевой биом
    window.activeBiomes[0] = {
        sky: window.bgSky,
        cloudsBack: window.bgCloudsBack,
        mountains: window.bgMountains,
        trees: window.bgTrees,
        cloudsFront: window.bgCloudsFront
    };
    
    Object.values(window.activeBiomes[0]).forEach(bg => {
        if (bg) { 
            bg.initialX = bg.x; 
            bg.initialY = bg.y; // Фиксируем высоту
        }
    });

    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiList.forEach(name => {
        if (gameRoot[name]) {
            gameRoot[name].initY = gameRoot[name].y;
            gameRoot[name].startX = gameRoot[name].x; 
            gameRoot[name].startScaleX = gameRoot[name].scaleX;
            gameRoot[name].startScaleY = gameRoot[name].scaleY;
            
            if (name === "btnPause") {
                gameRoot[name].cursor = "pointer";
                gameRoot[name].addEventListener("mousedown", () => { 
                    if (window.isCountdown) return; // БЛОКИРУЕМ НАЖАТИЕ ВО ВРЕМЯ ОТСЧЕТА
                    createjs.Sound.play("SfxClick");
                    isPlaying = false; 
                    //if (cameraContainer) cameraContainer.visible = false; // СКРЫВАЕМ ХОЛМЫ
                    if (gameRoot.pauseScreen) {
                        gameRoot.addChild(gameRoot.pauseScreen);
                        gameRoot.pauseScreen.visible = true;
                    }
                });
            }
        }
    });

    // === ЛОГИКА ЭКРАНА ПРОИГРЫША ===
    if (gameRoot.gameOverScreen) {
        // ЗАПОМИНАЕМ ИСХОДНЫЙ ЦЕНТР И МАСШТАБ ДЛЯ GAME OVER
        gameRoot.gameOverScreen.startX = gameRoot.gameOverScreen.x;
        gameRoot.gameOverScreen.initY = gameRoot.gameOverScreen.y;
        gameRoot.gameOverScreen.startScaleX = gameRoot.gameOverScreen.scaleX;
        gameRoot.gameOverScreen.startScaleY = gameRoot.gameOverScreen.scaleY;
        gameRoot.gameOverScreen.visible = false; 
        
        if (gameRoot.gameOverScreen.mcNewRecord) {
            gameRoot.gameOverScreen.mcNewRecord.visible = false; 
        }

        if (gameRoot.gameOverScreen.btnRestart) {
            gameRoot.gameOverScreen.btnRestart.cursor = "pointer";
            // Обязательно используй removeAllEventListeners, чтобы клики не дублировались при рестартах
            gameRoot.gameOverScreen.btnRestart.removeAllEventListeners("mousedown");
            gameRoot.gameOverScreen.btnRestart.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                resetGame(true); // true = запустить игру сразу
            });
        }
        
        if (gameRoot.gameOverScreen.btnMenu) {
            gameRoot.gameOverScreen.btnMenu.cursor = "pointer";
            gameRoot.gameOverScreen.btnMenu.removeAllEventListeners("mousedown");
            gameRoot.gameOverScreen.btnMenu.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                resetGame(false); // false = показать главное меню
            });
        }
    }

    // === ЛОГИКА МЕНЮ (МНОГОУРОВНЕВАЯ ВОРОНКА) ===
    let screens = ["menuScreen", "menuLevelScreen", "menuCharScreen"];

    // Универсальная функция для переключения экранов
    function showScreen(screenName) {
        screens.forEach(name => {
            if (gameRoot[name]) {
                gameRoot[name].visible = (name === screenName);
                // Кидаем активный экран поверх всего
                if (name === screenName) gameRoot.addChild(gameRoot[name]);
            }
        });
        updateGlobalUI(); // <--- ДОБАВЛЯЕМ ВОТ СЮДА
    }

    // Скрываем холмы и игровой интерфейс при старте
    if (cameraContainer) cameraContainer.visible = false;
    let uiListStart = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiListStart.forEach(name => { if (gameRoot[name]) gameRoot[name].visible = false; });

    // === СИСТЕМА TAP TO START (ДЛЯ РАЗБЛОКИРОВКИ ЗВУКА) ===
    showScreen(""); // Скрываем всё меню

    let startOverlay = new createjs.Container();
    let overlayBg = new createjs.Shape();
    // Черный фон на весь экран
    overlayBg.graphics.beginFill("#000000").drawRect(-2000, -2000, 6000, 6000); 
    
    let overlayTxt = new createjs.Text("TAP TO START", "bold 80px Arial Black", "#FFFFFF");
    overlayTxt.textAlign = "center";
    overlayTxt.textBaseline = "middle";
    overlayTxt.x = 960; 
    overlayTxt.y = 540;
    
    // Эффект пульсации текста
    createjs.Tween.get(overlayTxt, { loop: true })
        .to({ scaleX: 1.05, scaleY: 1.05, alpha: 0.8 }, 600, createjs.Ease.quadInOut)
        .to({ scaleX: 1, scaleY: 1, alpha: 1 }, 600, createjs.Ease.quadInOut);

    startOverlay.addChild(overlayBg, overlayTxt);
    gameRoot.addChild(startOverlay);

    startOverlay.cursor = "pointer";
    startOverlay.addEventListener("mousedown", () => {
        // Принудительно разблокируем аудио контекст браузера
        let ctx = createjs.Sound.activePlugin.context;
        if (ctx && ctx.state === "suspended") ctx.resume();

        createjs.Tween.removeTweens(overlayTxt);
        gameRoot.removeChild(startOverlay);
        
        showScreen("menuScreen"); // Открываем меню
        playMusic("BgmMenu");     // Врубаем музыку!
    });

    // 1. ГЛАВНОЕ МЕНЮ
    if (gameRoot.menuScreen && gameRoot.menuScreen.btnPlay) {
        // Убираем старый обработчик, чтобы он не запускал игру сразу
        gameRoot.menuScreen.btnPlay.removeAllEventListeners("mousedown");
        gameRoot.menuScreen.btnPlay.cursor = "pointer";
        gameRoot.menuScreen.btnPlay.addEventListener("mousedown", () => {
            createjs.Sound.play("SfxClick");
            showScreen("menuLevelScreen"); // Идем к выбору трассы
        });
    }

    // Глобальная переменная для хранения выбранного биома (0 по умолчанию)
    window.selectedBiomeID = 0; 

    // 2. ЭКРАН ВЫБОРА ТРАССЫ
    if (gameRoot.menuLevelScreen) {
        if (gameRoot.menuLevelScreen.btnBack) {
            gameRoot.menuLevelScreen.btnBack.cursor = "pointer";
            gameRoot.menuLevelScreen.btnBack.addEventListener("mousedown", () => { createjs.Sound.play("SfxClick"); showScreen("menuScreen")});
        }
        if (gameRoot.menuLevelScreen.btnNext) {
            gameRoot.menuLevelScreen.btnNext.cursor = "pointer";
            gameRoot.menuLevelScreen.btnNext.addEventListener("mousedown", () => { createjs.Sound.play("SfxClick"); showScreen("menuCharScreen")});
        }

        // === ЛОГИКА ПОДСВЕТКИ И ВЫБОРА БИОМОВ ===
// === ЛОГИКА ПАГИНАЦИИ И ВЫБОРА БИОМОВ ===
        let currentBiomePage = 0; 

        // Управление страницами
        function updateBiomePage() {
            if (gameRoot.menuLevelScreen.mcPage1) gameRoot.menuLevelScreen.mcPage1.visible = (currentBiomePage === 0);
            if (gameRoot.menuLevelScreen.mcPage2) gameRoot.menuLevelScreen.mcPage2.visible = (currentBiomePage === 1);
            
            // Прячем стрелки, если листать некуда
            if (gameRoot.menuLevelScreen.btnArrowLeft) gameRoot.menuLevelScreen.btnArrowLeft.visible = (currentBiomePage > 0);
            if (gameRoot.menuLevelScreen.btnArrowRight) gameRoot.menuLevelScreen.btnArrowRight.visible = (currentBiomePage < 1);
        }

        if (gameRoot.menuLevelScreen.btnArrowLeft) {
            gameRoot.menuLevelScreen.btnArrowLeft.cursor = "pointer";
            gameRoot.menuLevelScreen.btnArrowLeft.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                if (currentBiomePage > 0) currentBiomePage--;
                updateBiomePage();
            });
        }

        if (gameRoot.menuLevelScreen.btnArrowRight) {
            gameRoot.menuLevelScreen.btnArrowRight.cursor = "pointer";
            gameRoot.menuLevelScreen.btnArrowRight.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                if (currentBiomePage < 1) currentBiomePage++;
                updateBiomePage();
            });
        }

        // Логика состояний кнопок: 0 - открыто, 1 - выбрано, 2 - заблокировано
        function updateBiomeUI(selectedIndex) {
            window.selectedBiomeID = selectedIndex; 
            
            for (let i = 0; i <= 7; i++) { 
            let pageMC = (i < 4) ? gameRoot.menuLevelScreen.mcPage1 : gameRoot.menuLevelScreen.mcPage2;
                if (!pageMC) continue;
                
                let btn = pageMC["btnLevel" + i];
                if (btn && typeof btn.gotoAndStop === "function") {
                    let isUnlocked = unlockedBiomes.includes(i);
                    if (!isUnlocked) {
                        btn.gotoAndStop(2); 
                    } else if (i === selectedIndex) {
                        btn.gotoAndStop(1); 
                    } else {
                        btn.gotoAndStop(0); 
                    }
                }
            }
        }

        // Вешаем клики на все кнопки
        for (let i = 0; i <= 7; i++) {
            let pageMC = (i < 4) ? gameRoot.menuLevelScreen.mcPage1 : gameRoot.menuLevelScreen.mcPage2;
            if (pageMC && pageMC["btnLevel" + i]) {
                let btn = pageMC["btnLevel" + i];
                btn.cursor = "pointer";
                btn.addEventListener("mousedown", () => {
                    let isUnlocked = unlockedBiomes.includes(i);
                    
                    if (isUnlocked) {
                        createjs.Sound.play("SfxClick");
                        updateBiomeUI(i);
                    } else {
                        // ПОКУПКА ВРЕМЕННО ОТКЛЮЧЕНА ДЛЯ ДЕМКИ
                        // Просто ничего не делаем или проигрываем звук ошибки
                        console.log("Биом закрыт, покупка недоступна.");
                        // let biomePrice = 1000; 
                        // if (globalCoins >= biomePrice) {
                        //     globalCoins -= biomePrice;
                        //     unlockedBiomes.push(i);
                            
                        //     localStorage.setItem("pinglooTotalCoins", globalCoins);
                        //     localStorage.setItem("pinglooUnlockedBiomes", JSON.stringify(unlockedBiomes));
                            
                        //     createjs.Sound.play("SfxCoin"); 
                        //     updateGlobalUI(); 
                        //     updateBiomeUI(i); 
                        // }
                    }
                });
            }
        }

        updateBiomePage();
        updateBiomeUI(window.selectedBiomeID);
    }

    // 3. ЭКРАН ВЫБОРА ПЕРСОНАЖА
    if (gameRoot.menuCharScreen) {
        if (gameRoot.menuCharScreen.btnBack) {
            gameRoot.menuCharScreen.btnBack.cursor = "pointer";
            gameRoot.menuCharScreen.btnBack.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                showScreen("menuLevelScreen");
            });
        }
        if (gameRoot.menuCharScreen.btnStart) { 
            gameRoot.menuCharScreen.btnStart.cursor = "pointer";
            gameRoot.menuCharScreen.btnStart.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                showScreen(""); // Скрываем все экраны
                resetGame(true); // ЗАПУСКАЕМ ИГРУ
            });
        }

        // === ЛОГИКА ВЫБОРА ПЕРСОНАЖЕЙ ===
        let charBtns = ["btnChar0", "btnChar1", "btnChar2", "btnChar3"];

        function updateCharUI(selectedIndex) {
            // Запоминаем, кто был выбран до этого клика
            let prevSelectedCharID = window.selectedCharID;
            
            // Обновляем глобальный выбор
            window.selectedCharID = selectedIndex;
            localStorage.setItem("pinglooSelectedChar", window.selectedCharID); 

            charBtns.forEach((btnName, i) => {
                let btn = gameRoot.menuCharScreen[btnName];
                if (btn && typeof btn.gotoAndStop === "function") {
                    let isUnlocked = unlockedChars.includes(i);
                    
                    if (!isUnlocked) {
                        btn.gotoAndStop(3); // Кадр 4: Заблокирован (задел на будущее)
                    } else if (i === selectedIndex) {
                        btn.gotoAndStop(1); // Кадр 2: Выбран (Радость)
                    } else if (i === prevSelectedCharID && prevSelectedCharID !== selectedIndex) {
                        btn.gotoAndStop(2); // Кадр 3: Отмена выбора (Грусть/Вздох)
                    } else {
                        btn.gotoAndStop(0); // Кадр 1: Покой (Для остальных, кого не трогали)
                    }
                }
            });
        }

        // Вешаем клики на карточки персонажей
        charBtns.forEach((btnName, i) => {
            let btn = gameRoot.menuCharScreen[btnName];
            if (btn) {
                btn.cursor = "pointer";
                if (typeof btn.removeAllEventListeners === "function") {
                    btn.removeAllEventListeners("mousedown");
                }
                btn.addEventListener("mousedown", () => {
                    let isUnlocked = unlockedChars.includes(i);
                    
                    if (isUnlocked) {
                        createjs.Sound.play("SfxClick");
                        updateCharUI(i); // Обновляем UI, проигрываем реакцию
                    } else {
                        // ТУТ БУДЕТ ЛОГИКА ПОКУПКИ ПЕРСОНАЖЕЙ (как у биомов)
                        // createjs.Sound.play("SfxError");
                    }
                });
            }
        });

        // Инициализируем при старте меню
        updateCharUI(window.selectedCharID);
    }

    // === ЛОГИКА МЕНЮ ПАУЗЫ ===
    if (gameRoot.pauseScreen) {
        gameRoot.pauseScreen.visible = false; 
        
        // ЗАПОМИНАЕМ ИСХОДНЫЙ ЦЕНТР И МАСШТАБ
        gameRoot.pauseScreen.startX = gameRoot.pauseScreen.x;
        gameRoot.pauseScreen.initY = gameRoot.pauseScreen.y;
        gameRoot.pauseScreen.startScaleX = gameRoot.pauseScreen.scaleX;
        gameRoot.pauseScreen.startScaleY = gameRoot.pauseScreen.scaleY;

        if (gameRoot.pauseScreen.btnResume) {
            gameRoot.pauseScreen.btnResume.cursor = "pointer";
            gameRoot.pauseScreen.btnResume.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                // Вместо мгновенного старта вызываем нашу новую функцию
                resumeWithCountdown(); 
            });
        }
        
        if (gameRoot.pauseScreen.btnRestart) {
            gameRoot.pauseScreen.btnRestart.cursor = "pointer";
            gameRoot.pauseScreen.btnRestart.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                gameRoot.pauseScreen.visible = false;
                resetGame(true); // Запускаем заново
            });
        }
        
        if (gameRoot.pauseScreen.btnMenu) {
            gameRoot.pauseScreen.btnMenu.cursor = "pointer";
            gameRoot.pauseScreen.btnMenu.addEventListener("mousedown", () => {
                createjs.Sound.play("SfxClick");
                gameRoot.pauseScreen.visible = false;
                resetGame(false); // Выходим в главное меню
            });
        }
    }
    
    // Персонаж реагирует на экран, ТОЛЬКО если идет активная игра
    window.addEventListener("mousedown", () => { if (isPlaying) isDiving = true; });
    window.addEventListener("mouseup", () => isDiving = false);
    window.addEventListener("touchstart", () => { if (isPlaying) isDiving = true; });
    window.addEventListener("touchend", () => isDiving = false);

    // === УМНАЯ АДАПТИВНОСТЬ (С ПОВОРОТОМ ДВИЖКА И ПОДДЕРЖКОЙ RETINA) ===
    window.handleResize = function() {
        let canvas = document.getElementById("canvas");
        let anim_container = document.getElementById("animation_container");
        let dom_overlay_container = document.getElementById("dom_overlay_container"); 
        if (!canvas) return;

        let w = window.innerWidth;
        let h = window.innerHeight;
        let isPortrait = h > w;

        // 1. Очищаем мусорные стили и пробиваем клики
        let cssStyle = "position: absolute; top: 0px; left: 0px; width: " + w + "px; height: " + h + "px; overflow: hidden;";
        canvas.style.cssText = cssStyle;
        if (anim_container) anim_container.style.cssText = cssStyle;
        if (dom_overlay_container) dom_overlay_container.style.cssText = cssStyle + " pointer-events: none;";

        // 2. Узнаем плотность пикселей экрана (Retina/HiDPI)
        let pRatio = window.devicePixelRatio || 1;
        
        // 3. Задаем холсту физические пиксели устройства
        canvas.width = w * pRatio;
        canvas.height = h * pRatio;

        // ВАЖНО: Мы больше не трогаем ctx.scale, так как CreateJS его стирает.
        // Мы применяем pRatio напрямую к stage!

        if (gameRoot && gameRoot.stage) {
            if (isPortrait) {
                // ПОРТРЕТ: Игра лежит на боку
                // Базовый масштаб для ширины телефона + умножение на качество экрана
                let baseScale = w / 1080; 
                let finalScale = baseScale * pRatio;
                
                gameRoot.stage.scaleX = finalScale;
                gameRoot.stage.scaleY = finalScale;
                
                // Движок сам пересчитает координаты кликов!
                gameRoot.stage.rotation = 90;
                
                // Математически точный сдвиг перевернутого мира в координаты экрана
                gameRoot.stage.x = w * pRatio; // Сдвигаем на ширину экрана вправо
                gameRoot.stage.y = ((h * pRatio) - (1920 * finalScale)) / 2; // Центрируем по высоте
                
            } else {
                // ЛАНДШАФТ: Обычный режим
                let baseScale = h / 1080;
                let finalScale = baseScale * pRatio;
                
                gameRoot.stage.scaleX = finalScale;
                gameRoot.stage.scaleY = finalScale;
                gameRoot.stage.rotation = 0;
                
                // Центрируем по ширине экрана
                gameRoot.stage.x = ((w * pRatio) - (1920 * finalScale)) / 2;
                gameRoot.stage.y = 0;
            }
            
            // Принудительно рисуем кадр, чтобы всё встало на места мгновенно
            if (createjs.Ticker.paused || !isPlaying) {
                gameRoot.stage.update();
            }
        }
    };
    
    window.addEventListener("resize", window.handleResize);
    window.handleResize();

    createjs.Ticker.timingMode = createjs.Ticker.RAF; 
    createjs.Ticker.framerate = 60;
    createjs.Ticker.addEventListener("tick", gameLoop);
}

function setPlayerState(state) {
    if (currentState !== state) {
        if (!activeCharMC) return; // Защита
        if (activeCharMC.animRoll) activeCharMC.animRoll.visible = false;
        if (activeCharMC.animDive) activeCharMC.animDive.visible = false;
        if (activeCharMC.animFly) activeCharMC.animFly.visible = false;
        if (activeCharMC.animHit) activeCharMC.animHit.visible = false;
        if (activeCharMC.animLand) activeCharMC.animLand.visible = false;
        if (activeCharMC.animCombo) activeCharMC.animCombo.visible = false;
        if (activeCharMC.animSled) activeCharMC.animSled.visible = false;
        
        if (state === "roll" && activeCharMC.animRoll) { activeCharMC.animRoll.visible = true; activeCharMC.animRoll.gotoAndPlay(0); }
        if (state === "dive" && activeCharMC.animDive) { activeCharMC.animDive.visible = true; activeCharMC.animDive.gotoAndPlay(0); }
        if (state === "fly" && activeCharMC.animFly) { activeCharMC.animFly.visible = true; activeCharMC.animFly.gotoAndPlay(0); }
        if (state === "hit" && activeCharMC.animHit) { activeCharMC.animHit.visible = true; activeCharMC.animHit.gotoAndPlay(0); }
        if (state === "land" && activeCharMC.animLand) { activeCharMC.animLand.visible = true; activeCharMC.animLand.gotoAndPlay(0); }
        if (state === "combo" && activeCharMC.animCombo) { activeCharMC.animCombo.visible = true; activeCharMC.animCombo.gotoAndPlay(0); }
        if (state === "sled" && activeCharMC.animSled) { activeCharMC.animSled.visible = true; activeCharMC.animSled.gotoAndPlay(0); }
        
        currentState = state;
    }
}

function getHillY(x) {
    let rx = x + trackSeed;
    let globalAmplitude = 1 + Math.sin(rx * 0.0004) * 0.4; 
    let wave1 = Math.sin(rx * 0.0022) * (150 * globalAmplitude); 
    let wave2 = Math.cos(rx * 0.0011) * 100;  
    let wave3 = Math.cos(rx * 0.0033) * 30;  
    let macroWave = Math.sin(rx * 0.00015) * 80;
    
    // === ГАРАНТИЯ ВЫСОКОГО СТАРТОВОГО ХОЛМА (ТРАМПЛИН) ===
    let startRamp = 0;
    if (x < 3000) {
        // Чем ближе к старту (x=0), тем больше значение. К 3000 пикселей оно плавно сходит на нет.
        let progress = Math.max(0, 3000 - x) / 3000;
        // Кубическая функция сделает спуск очень плавным
        startRamp = progress * progress * progress * 700; 
    }
    
    return baseY + wave1 + wave2 + wave3 + macroWave - startRamp;
}

function playMusic(trackId) {
    if (currentBgmName === trackId) return; // Если этот трек уже играет, ничего не делаем
    
    // Останавливаем старую музыку, если она есть
    if (currentBgmInstance) {
        currentBgmInstance.stop();
    }
    
    currentBgmName = trackId;
    // Запускаем новую музыку с зацикливанием (loop: -1)
    currentBgmInstance = createjs.Sound.play(trackId, { loop: -1, volume: 0.5 });
}

function triggerGameOver(finalDistance) {
    if (player) {
        player.stop();
        if (player.animRoll) player.animRoll.stop();
        if (player.animDive) player.animDive.stop();
        if (player.animFly) player.animFly.stop();
        if (player.animLand) player.animLand.stop();
    }
    if (avalanche) avalanche.stop();

    // Глушим музыку и гул, играем звук поражения
    if (currentBgmInstance) currentBgmInstance.stop();
    currentBgmName = ""; // <--- ВОТ ЭТА СТРОЧКА РЕШИТ ПРОБЛЕМУ РЕСТАРТА
    if (avalancheSoundInstance) {
        avalancheSoundInstance.stop();
        avalancheSoundInstance = null;
    }
    createjs.Sound.play("SfxCrash");

    let fadeTime = 500; 

    // 1. Плавно растворяем камеру (холмы и Кико)
    if (cameraContainer) {
        //createjs.Tween.get(cameraContainer).to({alpha: 0}, fadeTime);
    }

    // 2. Плавно растворяем интерфейс
    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiList.forEach(name => {
        if (gameRoot[name]) {
            createjs.Tween.get(gameRoot[name]).to({alpha: 0}, fadeTime);
        }
    });

    // 4. ПОКАЗЫВАЕМ ЭКРАН ПРОИГРЫША
    if (gameRoot.gameOverScreen) {
        // Повторный addChild принудительно швыряет меню поверх фильтра и вообще всех слоев!
        gameRoot.addChild(gameRoot.gameOverScreen); 
        gameRoot.gameOverScreen.visible = true; 
        gameRoot.gameOverScreen.gotoAndPlay(2); 

        if (gameRoot.gameOverScreen.txtFinalDistance) {
            gameRoot.gameOverScreen.txtFinalDistance.text = finalDistance + " м";
        }

        let savedRecord = localStorage.getItem("pinglooRecordDistance") || 0;
        if (finalDistance > savedRecord) {
            localStorage.setItem("pinglooRecordDistance", finalDistance); 
            if (gameRoot.gameOverScreen.mcNewRecord) {
                gameRoot.gameOverScreen.mcNewRecord.visible = true;
            }
        }

        // === ДОБАВЛЯЕМ СОХРАНЕНИЕ МОНЕТ ===
        globalCoins += coinsCollected;
        localStorage.setItem("pinglooTotalCoins", globalCoins);
        updateGlobalUI(); // Обновляем тексты на экране!
    }
}

function resetGame(startImmediately) {
    // 1. Сбрасываем все числовые переменные
    velocityY = 0;
    isDiving = false;
    wasDiving = false;
    inactivityFrames = 0;
    isComboSliding = false;
    comboCount = 0;
    speedX = 15;
    worldOffsetX = 0;
    avalancheWorldX = -500;
    avalancheBaseSpeed = 12;
    isGameOver = false;
    isPlaying = startImmediately; 
    maxFlightHeight = 0;
    hasTouchedGroundOnce = false;
    playerAnimLock = 0;
    currentJumpHeight = 0;
    currentState = "";
    nextCoinX = 2500;
    coinsCollected = 0;
    currentEnergy = maxEnergy;
    visualEnergy = maxEnergy; // <--- СБРАСЫВАЕМ ПРИ РЕСТАРТЕ
    nextFishX = 3000;
    comboAnimTimer = 0;
    isTransitioning = false;
    transitionProgress = 0;
    currentBiomeIndex = 0;

    // Генерируем новую трассу, чтобы не бегать по одной и той же
    trackSeed = Math.random() * 100000;

    // 2. Очищаем массивы и удаляем объекты со сцены
    if (coinsContainer) {
        coinsContainer.removeAllChildren();
    }
    coins = [];
    fishes = [];

    // === ДОБАВЬ ВОТ ЭТОТ ЦИКЛ ===
    for (let i = 0; i < sleds.length; i++) {
        if (sleds[i].shape && sleds[i].shape.parent) {
            sleds[i].shape.parent.removeChild(sleds[i].shape);
        }
    }
    // ============================

    sleds = [];
    nextSledX = 15000;
    hasSled = false;
    sledTimer = 0;
    if (activeSledInstance && activeSledInstance.parent) {
        activeSledInstance.parent.removeChild(activeSledInstance);
    }
    activeSledInstance = null;
    
    // Удаляем эффекты (комбо-текст и вспышки)
    for (let i = 0; i < effects.length; i++) {
        if (effects[i].shape && effects[i].shape.parent) {
            effects[i].shape.parent.removeChild(effects[i].shape);
        }
    }
    effects = [];

    // 3. Возвращаем прозрачность (alpha) всем слоям
    if (cameraContainer) {
        createjs.Tween.removeTweens(cameraContainer); // Останавливаем анимацию затухания, если она еще идет
        cameraContainer.alpha = 1;
        // Если рестарт (true) - показываем холмы. Если идем в меню (false) - прячем!
        cameraContainer.visible = startImmediately;
    }
    
    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiList.forEach(name => {
        if (gameRoot[name]) {
            createjs.Tween.removeTweens(gameRoot[name]);
            gameRoot[name].alpha = 1;
            gameRoot[name].visible = startImmediately; // Прячем счетчики и паузу в меню
        }
    });

    if (gameRoot.bgContainerMC) {
        createjs.Tween.removeTweens(gameRoot.bgContainerMC);
        gameRoot.bgContainerMC.alpha = 1;
        // Задние фоны (небо) можно оставить видимыми для красоты, либо тоже скрыть:
        gameRoot.bgContainerMC.visible = startImmediately;
    }
    if (window.bgCloudsFront) {
        createjs.Tween.removeTweens(window.bgCloudsFront);
        window.bgCloudsFront.alpha = 1;
        gameRoot.bgCloudsFront.visible = startImmediately;
    }

    // УДАЛЯЕМ ХОЛОДНЫЙ ФИЛЬТР ПРИ РЕСТАРТЕ
    if (gameRoot.gameOverOverlay) {
        createjs.Tween.removeTweens(gameRoot.gameOverOverlay);
        if (gameRoot.gameOverOverlay.parent) {
            gameRoot.gameOverOverlay.parent.removeChild(gameRoot.gameOverOverlay);
        }
        gameRoot.gameOverOverlay = null;
    }

    // 4. Удаляем все биомы, кроме нулевого
    for (let idx in window.activeBiomes) {
        if (idx !== "0") unloadBiome(Number(idx));
    }
    window.biomeLoadQueue = [];
    window.isBiomeLoading = false;

    // === УПРАВЛЕНИЕ ВИДИМОСТЬЮ И ЗАГРУЗКОЙ БИОМОВ ===
    // Синхронизируем игровой индекс с выбранным в меню
    currentBiomeIndex = window.selectedBiomeID;

    if (window.activeBiomes[0]) {
        Object.values(window.activeBiomes[0]).forEach(bg => {
            if (bg) {
                createjs.Tween.removeTweens(bg); 
                // Если выбран НЕ нулевой биом, прячем его!
                bg.visible = (window.selectedBiomeID === 0); 
                bg.alpha = 1;
            }
        });
    }

    // Если игрок выбрал другой биом, ставим его в очередь на загрузку при старте
    if (window.selectedBiomeID !== 0) {
        queueBiomeLoad(window.selectedBiomeID);
    }

    // 5. Возвращаем Кико и лавину на старт
    if (player) {
        // === ПЕРЕКЛЮЧЕНИЕ СКИНОВ ===
        if (player.kiko_mc) player.kiko_mc.visible = false;
        if (player.lulu_mc) player.lulu_mc.visible = false;
        if (player.papi_mc) player.papi_mc.visible = false;
        if (player.momi_mc) player.momi_mc.visible = false;

        if (window.selectedCharID === 0) activeCharMC = player.kiko_mc;
        if (window.selectedCharID === 1) activeCharMC = player.lulu_mc;
        if (window.selectedCharID === 3) activeCharMC = player.papi_mc;
        if (window.selectedCharID === 2) activeCharMC = player.momi_mc;
        
        // Если что-то пошло не так, по умолчанию Кико
        if (!activeCharMC) activeCharMC = player.kiko_mc; 
        activeCharMC.visible = true;
        // ============================
        if (startImmediately) {
            playMusic("BgmGame"); // Включаем музыку уровня
            window.isIntro = true;
            player.x = -200; // Начинаем чуть дальше за экраном для плавности
            // Спавним ниже, чтобы не улетал в небеса
            player.y = getHillY(worldOffsetX + player.x) - 100; 
            velocityY = -20;  // Мягкий подброс, а не выстрел
            speedX = 25;     // Скорость мира чуть выше базовой, без экстрима
            setPlayerState("fly");
        } else {
            playMusic("BgmMenu"); // Включаем музыку меню
            window.isIntro = false;
            player.x = window.playerStartX; // Обычная позиция для меню
            player.y = baseY - 50;
            setPlayerState("roll");
        }
        player.rotation = 0;
        player.play(); // Размораживаем анимацию
    }
    if (avalanche) {
        avalanche.x = -500;
        avalanche.play(); // Размораживаем анимацию лавины
    }

    // === СБРОС МАСШТАБА И КАМЕРЫ ===
    gameRoot.scaleX = 1;
    gameRoot.scaleY = 1;
    gameRoot.x = 0;
    gameRoot.y = 0;

    // Сброс UI на начальные позиции, чтобы в меню ничего не съезжало
    let uiListUpdate = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "pauseScreen", "gameOverScreen"];
    uiListUpdate.forEach(name => {
        let el = gameRoot[name];
        if (el && el.initY !== undefined) {
            el.scaleX = el.startScaleX;
            el.scaleY = el.startScaleY;
            el.x = el.startX;
            el.y = el.initY;
        }
    });

    // 6. Прячем экран проигрыша и сбрасываем его анимацию
    if (gameRoot.gameOverScreen) {
        gameRoot.gameOverScreen.visible = false;
        gameRoot.gameOverScreen.gotoAndStop(0); 
    }

    // 7. Если нажали "Меню", показываем его и прячем остальные
    if (!startImmediately) {
        if (gameRoot.menuLevelScreen) gameRoot.menuLevelScreen.visible = false;
        if (gameRoot.menuCharScreen) gameRoot.menuCharScreen.visible = false;
        if (gameRoot.menuScreen) {
            gameRoot.addChild(gameRoot.menuScreen); // Кидаем наверх
            gameRoot.menuScreen.visible = true;
        }
    }
}

function resumeWithCountdown() {
    // 1. Прячем меню паузы и сразу возвращаем холмы на фон
    if (gameRoot.pauseScreen) gameRoot.pauseScreen.visible = false;
    //if (cameraContainer) cameraContainer.visible = true; 

    let count = 3;
    
    // 2. Создаем сочный текст в стиле Комбо
    let txt = new createjs.Text(count, "bold 150px Arial Black", "#FFD700");
    txt.textAlign = "center";
    txt.textBaseline = "middle";
    txt.shadow = new createjs.Shadow("#FF4500", 0, 8, 15);
    
    // 3. Высчитываем центр с учетом того, что мир мог сдвинуться или отдалиться
    txt.x = (960 - gameRoot.x) / gameRoot.scaleX;
    txt.y = (540 - gameRoot.y) / gameRoot.scaleY;
    
    gameRoot.addChild(txt); // Бросаем на самый верх

    // 4. Рекурсивная анимация цифр
    function animateNumber() {
        if (count > 0) {
            txt.text = count;
            txt.alpha = 1;
            txt.scaleX = 0.1; 
            txt.scaleY = 0.1;
            
            // Целевой масштаб (учитываем зум камеры, чтобы цифры всегда казались одинаковыми)
            let targetScale = 1 / gameRoot.scaleX; 

            // Вспышка (увеличивается), пауза, растворение
            createjs.Tween.get(txt)
                .to({scaleX: targetScale, scaleY: targetScale}, 300, createjs.Ease.backOut)
                .wait(400)
                .to({alpha: 0, scaleX: targetScale * 1.5, scaleY: targetScale * 1.5}, 200)
                .call(() => {
                    count--;
                    animateNumber(); // Запускаем следующую цифру
                });
        } else {
            // Отсчет окончен
            if (txt.parent) txt.parent.removeChild(txt);
            window.isCountdown = false; // СНИМАЕМ БЛОКИРОВКУ
            isPlaying = true; // Размораживаем физику и движок!
        }
    }
    
    animateNumber();
}

function gameLoop() {
    // === ИСПРАВЛЕННАЯ ПООЧЕРЕДНАЯ ЗАГРУЗКА БИОМА ===
    if (window.biomeLoadQueue && window.biomeLoadQueue.length > 0) {
        let task = window.biomeLoadQueue.shift(); 
        
        let compLib = window.lib;
        if (!compLib && window.AdobeAn) {
            try {
                let compName = Object.keys(AdobeAn.compositions)[0];
                compLib = AdobeAn.getComposition(compName).getLibrary();
            } catch(e) {}
        }

        let ClassRef = compLib ? compLib[task.libName] : null;
        if (ClassRef) {
            let layer = new ClassRef();
            layer.alpha = 1;
            
            let b = window.activeBiomes[task.index];
            b[task.key] = layer;

            let lookupKey = task.key;
            if (lookupKey === "mountainsMid" && !window.activeBiomes[0][lookupKey]) lookupKey = "cloudsBack";
            
            let baseLayer = window.activeBiomes[0][lookupKey];
            
            // 1. Копируем координаты нулевого биома
            if (baseLayer) {
                layer.x = baseLayer.x;
                layer.y = baseLayer.y;
                layer.scaleX = baseLayer.scaleX;
                layer.scaleY = baseLayer.scaleY;
                layer.initialX = baseLayer.initialX !== undefined ? baseLayer.initialX : baseLayer.x;
                layer.initialY = baseLayer.initialY !== undefined ? baseLayer.initialY : baseLayer.y;
                
                // ВЫВОД В КОНСОЛЬ ДЛЯ СВЕРКИ
                console.log(`[${task.key}] Базовый Y: ${baseLayer.initialY} | Новый Y: ${layer.initialY}`);
            } else {
                layer.initialX = 0; layer.initialY = 0;
            }
            
            // === 3. ИДЕАЛЬНОЕ ВПЛЕТЕНИЕ СЛОЕВ ===
            if (task.key === "cloudsFront") {
                if (baseLayer && baseLayer.parent) {
                    baseLayer.parent.addChildAt(layer, baseLayer.parent.getChildIndex(baseLayer) + 1);
                } else {
                    gameRoot.addChild(layer);
                }
            } else {
                // Если нулевой биом лежит в bgContainerMC, вставляем новый СТРОГО над ним!
                // Горы_1 лягут прямо над Горами_0, Лес_1 над Лесом_0. Иерархия не сломается!
                if (gameRoot.bgContainerMC && baseLayer && baseLayer.parent === gameRoot.bgContainerMC) {
                    let baseIndex = gameRoot.bgContainerMC.getChildIndex(baseLayer);
                    gameRoot.bgContainerMC.addChildAt(layer, baseIndex + 1);
                } else if (gameRoot.bgContainerMC) {
                    gameRoot.bgContainerMC.addChild(layer);
                } else {
                    gameRoot.addChildAt(layer, 0); 
                }
            }
            
            if (window.biomeLoadQueue.length === 0) {
                window.isBiomeLoading = false;
            }
        }
    }


    if (isGameOver) return; 
    if (!isPlaying) return; 

    worldOffsetX += speedX; 

    // === ЛОГИКА ВЫЛЕТА КИКО ИЗ-ЗА КАДРА ===
    if (window.isIntro) {
        let dx = window.playerStartX - player.x;
        if (dx > 2) {
            // Коэффициент 0.05 дает мягкое, парящее появление в кадре
            player.x += dx * 0.05; 
        } else {
            player.x = window.playerStartX; // Фиксируем на месте
            window.isIntro = false;         // Вылет окончен
        }
    }

    if (isPlaying && !isGameOver) {
        currentEnergy -= energyDepletionRate;
        if (currentEnergy <= 0) {
            currentEnergy = 0;
            speedX -= 0.05; 
        }
    }
    
    if (isDiving) inactivityFrames = 0; 
    else inactivityFrames++; 
    
    let distanceMeters = Math.floor(worldOffsetX / 100);

    // let targetBiomeIndex = 0;
    // for (let i = biomes.length - 1; i >= 0; i--) {
    //     if (distanceMeters >= biomes[i].startDist) {
    //         targetBiomeIndex = i;
    //         break;
    //     }
    // }

    // if (targetBiomeIndex + 1 < biomes.length) {
    //     let distToNext = biomes[targetBiomeIndex + 1].startDist - distanceMeters;
    //     if (distToNext > 0 && distToNext <= 150) {
    //         queueBiomeLoad(targetBiomeIndex + 1); 
    //     }
    // }

    // if (currentBiomeIndex !== targetBiomeIndex && !isTransitioning) {
    //     isTransitioning = true;
    //     transitionProgress = 0;
    //     prevBiome = biomes[currentBiomeIndex];
        
    //     queueBiomeLoad(targetBiomeIndex); 
    //     currentBiomeIndex = targetBiomeIndex;
    // }

    let activeBiome = biomes[currentBiomeIndex];
    let currentLineColor = activeBiome.lineColor;
    let currentFillColor = activeBiome.fillColor;

    if (isTransitioning) {
        transitionProgress += (1 / 45); 

        let prevBgs = window.activeBiomes[prevBiome.id];
        let nextBgs = window.activeBiomes[currentBiomeIndex];

        if (transitionProgress >= 1) {
            transitionProgress = 1;
            isTransitioning = false;
            
            if (prevBiome.id !== 0) {
                unloadBiome(prevBiome.id);
            } else {
                if (prevBgs) Object.values(prevBgs).forEach(bg => { if(bg) bg.visible = false; });
            }
        }
        
        currentLineColor = interpolateColor(prevBiome.lineColor, activeBiome.lineColor, transitionProgress);
        currentFillColor = interpolateColor(prevBiome.fillColor, activeBiome.fillColor, transitionProgress);

        if (prevBgs) Object.values(prevBgs).forEach(bg => { if(bg) { bg.alpha = 1 - transitionProgress; bg.visible = true; } });
        if (nextBgs) Object.values(nextBgs).forEach(bg => { if(bg) { bg.alpha = transitionProgress; bg.visible = true; } });
    }
    
    let bgWidth = 1920; 

    for (let idx in window.activeBiomes) {
        let b = window.activeBiomes[idx];

        if (b.cloudsBack) b.cloudsBack.x = b.cloudsBack.initialX - ((worldOffsetX * 0.05) % bgWidth);
        if (b.mountainsMid) b.mountainsMid.x = b.mountainsMid.initialX - ((worldOffsetX * 0.085) % bgWidth);
        if (b.mountains) b.mountains.x = b.mountains.initialX - ((worldOffsetX * 0.1) % bgWidth);
        if (b.trees) b.trees.x = b.trees.initialX - ((worldOffsetX * 0.4) % bgWidth);
        if (b.cloudsFront) b.cloudsFront.x = b.cloudsFront.initialX - ((worldOffsetX * 0.8) % bgWidth);

        if (b.sky && b.sky.initialY !== undefined) b.sky.y = b.sky.initialY - (gameRoot.y * 0.5);
        if (b.cloudsBack && b.cloudsBack.initialY !== undefined) b.cloudsBack.y = b.cloudsBack.initialY - (gameRoot.y * 0.5);
        if (b.mountainsMid && b.mountainsMid.initialY !== undefined) b.mountainsMid.y = b.mountainsMid.initialY - (gameRoot.y * 0.45);
        if (b.mountains && b.mountains.initialY !== undefined) b.mountains.y = b.mountains.initialY - (gameRoot.y * 0.4);
        if (b.trees && b.trees.initialY !== undefined) b.trees.y = b.trees.initialY - (gameRoot.y * 0.2);
        if (b.cloudsFront && b.cloudsFront.initialY !== undefined) b.cloudsFront.y = b.cloudsFront.initialY + (gameRoot.y * 0.4);
    }

    hillShape.graphics.clear();
    hillShape.graphics.setStrokeStyle(4).beginStroke(currentLineColor).beginFill(currentFillColor);
    
    // РАСШИРЕННЫЕ ГРАНИЦЫ: Рисуем линию холмов далеко за пределами экрана
    let drawStart = -3000; // Было -1000
    let drawEnd = 8000;    // Было 3500
    let drawStep = 50;
    
    for (let i = drawStart; i <= drawEnd; i += drawStep) {
        let hillY = getHillY(i + worldOffsetX);
        if (i === drawStart) {
            hillShape.graphics.moveTo(i, hillY);
        } else {
            hillShape.graphics.lineTo(i, hillY);
        }
    }
    hillShape.graphics.lineTo(drawEnd, 8000); 
    hillShape.graphics.lineTo(drawStart, 8000);    
    hillShape.graphics.closePath();        
    hillShape.graphics.endFill().endStroke();

    let baseGrav = 0.45;
    let diveGrav = 2.5;
    
    if (window.selectedCharID === 1) { // Лулу
        baseGrav = 0.40; // Было 0.35 (чуть-чуть утяжелили)
        diveGrav = 2.2;  // Было 2.0
    } else if (window.selectedCharID === 3) { // Папи (тяжелый)
        baseGrav = 0.55; 
        diveGrav = 3.0; 
    }
    
    let currentGravity = isDiving ? diveGrav : baseGrav;
    
    velocityY += currentGravity;
    player.y += velocityY; 

    // Если мы на санях, виртуально "удлиняем" хитбокс, чтобы вытолкнуть Кико над снегом
    let currentHitboxOffset = hasSled ? 85 : 50; 
    let playerBottom = player.y + currentHitboxOffset;
    let currentGroundY = getHillY(player.x + worldOffsetX); 
    let distFromGround = currentGroundY - playerBottom;

    let nextY = getHillY(player.x + worldOffsetX + 5);
    let prevY = getHillY(player.x + worldOffsetX - 5);
    let angleRad = Math.atan2(nextY - prevY, 10); 

    let targetRotation = 0;
    let justReleased = (wasDiving && !isDiving);

    if (playerAnimLock > 0) playerAnimLock--; 
    // Считаем, что были в воздухе, если состояние "fly", ЛИБО если мы на санях и высоко прыгнули
    let wasInAir = (currentState === "fly" || (hasSled && currentJumpHeight > 20));

    if (distFromGround <= 0) {
        hasTouchedGroundOnce = true; 
        
        player.y = currentGroundY - currentHitboxOffset;
        let slopeForce = Math.sin(angleRad); 
        
        if (wasInAir) {
            let isPerfectLanding = (currentJumpHeight > 80 && isDiving && slopeForce > 0.1);

            if (isPerfectLanding) {
                isComboSliding = true;
                comboAnimTimer = 90; 
                comboCount++; // Счетчик теперь растет бесконечно (6, 7, 8...)
                
                // Ограничиваем только бонус к скорости, чтобы игра не сломалась
                let effectiveCombo = comboCount > 5 ? 5 : comboCount; 
                
                let boost = 3 + (effectiveCombo * 1.5);
                speedX += boost;
                
                spawnBoostFlash();
                spawnComboText(comboCount); // Передаем красивое большое число!
                createjs.Sound.play("SfxCombo");
                
            } else {
                // ДОБАВЛЯЕМ ЗВУК ОБЫЧНОГО ПРИЗЕМЛЕНИЯ:
                createjs.Sound.play("SfxLand");
                if (comboCount > 0) {
                    let speedPenalty = comboCount * 3; 
                    if (!hasSled) speedX -= speedPenalty; // <--- БЕЗ ШТРАФА НА САНЯХ
                    isComboSliding = false;
                    comboCount = 0; 
                }
                
                if (currentJumpHeight > 250) { 
                    if (!hasSled) setPlayerState("land"); // <--- Блокируем для саней
                    playerAnimLock = 15;
                    if (!hasSled) speedX -= 5; // <--- БЕЗ ШТРАФА НА САНЯХ
                    isComboSliding = false;
                } 
            }
            
            currentJumpHeight = 0; 
        }

        if (isComboSliding) {
            comboAnimTimer--;
            if (comboAnimTimer <= 0) isComboSliding = false; 
        }

        // Сбалансированная турбо-физика БЕЗ жестких лимитов
        let downHillBoost = hasSled ? 3.0 : 2.0;   // На санях разгон вниз почти в 2 раза мощнее!
        let upHillPenalty = hasSled ? 2.0 : 2.5;   // На санях подъем ВООБЩЕ ПОЧТИ НЕ ТОРМОЗИТ (0.2 против 2.5)
        let neutralDecay = hasSled ? 0.01 : 0.05;

        // === СТРОГОЕ РАЗДЕЛЕНИЕ ФИЗИКИ (Оригинал vs Сани) ===
        if (isDiving) {
            if (playerAnimLock === 0 && !hasSled) {
                setPlayerState(isComboSliding ? "combo" : "dive"); 
            }
            
            // slopeForce > 0 = спуск (разгон), slopeForce < 0 = подъем (тормоз)
            if (slopeForce > 0) {
                let normalBoost = (window.selectedCharID === 2) ? 2.5 : 1.8; 
                speedX += slopeForce * (hasSled ? 3.0 : normalBoost);
            } else {
                speedX += slopeForce * (hasSled ? 1.2 : 2.5); // Оригинальные 2.5 без саней
            }
        } else {
         if (playerAnimLock === 0 && !hasSled) { // <--- Добавили !hasSled
             setPlayerState("roll");
         }
            
            if (slopeForce > 0) {
                speedX += slopeForce * (hasSled ? 0.8 : 0.2); // Оригинальные 0.2 без саней
            } else {
                speedX += slopeForce * (hasSled ? 0.3 : 0.6); // Оригинальные 0.6 без саней
            }
            
            if (inactivityFrames > 300) {
                speedX -= (hasSled ? 0.03 : 0.15); // Оригинальные 0.15 без саней
            } else {
                speedX -= (hasSled ? 0.01 : 0.05); // Оригинальные 0.05 без саней
            }
        }

        velocityY = slopeForce * speedX; 
        
        if (justReleased && slopeForce < -0.05 && playerAnimLock === 0) {
            // Лулу отталкивается сильнее (база 1.45 вместо 1.3)
            let jumpBase = (window.selectedCharID === 1) ? 1.36 : 1.3; 
            let jumpMultiplier = jumpBase + (speedX * 0.02);
            
            // Мы убрали искусственный множитель * 1.3 для саней.
            // Теперь высота прыжка честно зависит только от набранной скорости!
            
            velocityY = slopeForce * speedX * jumpMultiplier; 
            isComboSliding = false;
            
            let speedTransfer = speedX * 0.05; 
            speedX -= speedTransfer;           
            velocityY -= speedTransfer * 1.2;        

            if (velocityY < -35) {
                velocityY = -35; 
            }

            player.y -= 10; 
        }

        targetRotation = angleRad * (180 / Math.PI); 
    } else {
        if (distFromGround > currentJumpHeight) {
            currentJumpHeight = distFromGround; 
        }

        if (distFromGround > 20 && playerAnimLock === 0) {
            if (!hasSled) setPlayerState("fly"); // <--- Блокируем для саней
        }
        
        let airAngle = Math.atan2(velocityY, speedX);
        targetRotation = airAngle * (180 / Math.PI);
        
        if (inactivityFrames > 300) speedX -= 0.02; 
        else speedX -= 0.01; 
    }
    
    let rotationDiff = targetRotation - player.rotation;
    rotationDiff = ((rotationDiff + 540) % 360) - 180;
    player.rotation += rotationDiff * 0.2;
    
    if (speedX < minSpeedX) speedX = minSpeedX;
    if (speedX > maxSpeedX) speedX = maxSpeedX;

    wasDiving = isDiving; 
    
    let playerWorldX = worldOffsetX + player.x;

    while (nextCoinX < worldOffsetX + 6000) {
        // Если монеты хотят заспавниться на месте саней или рыбок — толкаем их на 1200 пикселей вперед
        if (Math.abs(nextCoinX - nextSledX) < 1200) nextCoinX += 1200;
        if (Math.abs(nextCoinX - nextFishX) < 1200) nextCoinX += 1200;
        let patternType = Math.floor(Math.random() * 4); 
        let startX = nextCoinX;
        let skyHeight = 400 + Math.random() * 800; 

        if (patternType === 0) {
            let numCoins = 6 + Math.floor(Math.random() * 6);
            let spacing = 90;
            for (let i = 0; i < numCoins; i++) {
                let cx = startX + (i * spacing);
                spawnCoin(cx, getHillY(cx) - 80);
            }
            nextCoinX += (numCoins * spacing) + 3000 + Math.random() * 2000;
        } 
        else if (patternType === 1) {
            let cy = getHillY(startX) - skyHeight; 
            let spacing = 70;
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    spawnCoin(startX + (col * spacing) - (spacing * 2), cy + (row * spacing) - (spacing * 2));
                }
            }
            nextCoinX += 3500 + Math.random() * 2000;
        } 
        else if (patternType === 2) {
            let cy = getHillY(startX) - skyHeight; 
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) { 
                spawnCoin(startX + Math.cos(a) * 200, cy + Math.sin(a) * 200);
            }
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) { 
                spawnCoin(startX + Math.cos(a) * 100, cy + Math.sin(a) * 100);
            }
            spawnCoin(startX, cy); 
            nextCoinX += 3500 + Math.random() * 2000;
        }
        else {
            let cy = getHillY(startX) - skyHeight; 
            let rows = 5;
            let spacing = 75;
            for (let r = 0; r < rows; r++) {
                let coinsInRow = r + 1;
                let startOffsetX = -(coinsInRow - 1) * (spacing / 2);
                for (let c = 0; c < coinsInRow; c++) {
                    spawnCoin(startX + startOffsetX + (c * spacing), cy + (r * spacing));
                }
            }
            nextCoinX += 3500 + Math.random() * 2000;
        }
    }

    while (nextFishX < worldOffsetX + 6000) {
        let foundDownhill = false;
        for (let scanX = nextFishX; scanX < nextFishX + 2000; scanX += 40) {
            // Если мы слишком близко к будущим саням, пропускаем эту точку
            if (Math.abs(scanX - nextSledX) < 1200) continue;
            let nextY = getHillY(scanX + 10);
            let prevY = getHillY(scanX - 10);
            if (nextY - prevY > 4) {
                spawnFish(scanX, getHillY(scanX) - 40); 
                nextFishX = scanX + 1500 + Math.random() * 2000; 
                foundDownhill = true;
                break;
            }
        }
        if (!foundDownhill) nextFishX += 2000; 
    }

    while (!hasSled && nextSledX < worldOffsetX + 6000) {
        spawnSled(nextSledX, getHillY(nextSledX));
        nextSledX += 12000 + Math.random() * 8000; // Сани появляются не слишком часто
    }

    for (let i = effects.length - 1; i >= 0; i--) {
        let fx = effects[i];
        if (fx.type === "comboFlash") {
            fx.shape.scaleX += 0.15;
            fx.shape.scaleY += 0.15;
            fx.shape.alpha -= 0.05;
            if (fx.shape.alpha <= 0) {
                if (fx.shape.parent) fx.shape.parent.removeChild(fx.shape);
                effects.splice(i, 1);
            }
        } 
        else if (fx.type === "comboText") {
            fx.shape.y -= 2; 
            fx.shape.alpha -= 0.03; 
            if (fx.shape.alpha <= 0) {
                if (fx.shape.parent) fx.shape.parent.removeChild(fx.shape);
                effects.splice(i, 1);
            }
        } 
        else {
            fx.x = fx.worldX - worldOffsetX; 
            // Увеличили зону жизни эффекта до -3000
            if (fx.x < -3000 || !fx.parent || (fx.currentFrame && fx.currentFrame >= fx.totalFrames - 1)) {
                if (fx.parent) fx.parent.removeChild(fx);
                effects.splice(i, 1);
            }
        }
    }

    // Моми (3) притягивает фарм с огромного расстояния (+100 пикселей радиуса)
        let magnetBonus = (window.selectedCharID === 2) ? 200 : 30;

    for (let i = coins.length - 1; i >= 0; i--) {
        let c = coins[i];
        c.shape.x = c.worldX - worldOffsetX;
        c.shape.y = c.worldY; 

        let distX = Math.abs(c.worldX - playerWorldX);
        let distY = Math.abs(c.shape.y - player.y);

        // Для монет:
        if (!c.hit && distX < (c.hitRadius + magnetBonus) && distY < (c.hitRadius + magnetBonus)) {
            c.hit = true;
            coinsCollected++;
            createjs.Sound.play("SfxCoin"); // Звук монетки
            coinsContainer.removeChild(c.shape);
            
            let LibClassFX = window.lib ? window.lib.CoinFX : null;
            if (!LibClassFX && window.AdobeAn) {
                try {
                    let compName = Object.keys(AdobeAn.compositions)[0];
                    let compLib = AdobeAn.getComposition(compName).getLibrary();
                    LibClassFX = compLib.CoinFX;
                } catch(e) {}
            }

            if (LibClassFX) {
                let fx = new LibClassFX();
                fx.worldX = c.worldX; 
                fx.y = c.shape.y;
                coinsContainer.addChild(fx);
                effects.push(fx);
            }
        }
        // Монеты исчезают далеко за левым краем
        if (c.shape.x < -3000 || c.hit) {
            if (!c.hit) coinsContainer.removeChild(c.shape);
            coins.splice(i, 1);
        }
    }

    for (let i = fishes.length - 1; i >= 0; i--) {
        let f = fishes[i];
        f.shape.x = f.worldX - worldOffsetX;
        f.shape.y = f.worldY; 

        let distX = Math.abs(f.worldX - playerWorldX);
        let distY = Math.abs(f.shape.y - player.y);

        // Для рыбок:
        if (!f.hit && distX < (f.hitRadius + magnetBonus) && distY < (f.hitRadius + magnetBonus)) {
            f.hit = true;
            createjs.Sound.play("SfxFish"); // <--- ЗВУК РЫБКИ
            
            // Папи (2) получает 24 энергии вместо 16
            let energyGain = (window.selectedCharID === 3) ? 24 : 16; 
            currentEnergy += energyGain; 
            
            if (currentEnergy > maxEnergy) currentEnergy = maxEnergy;
            coinsContainer.removeChild(f.shape);
            
            let LibClassFX = window.lib ? window.lib.FishFX : null;
            if (!LibClassFX && window.AdobeAn) {
                try {
                    let compName = Object.keys(AdobeAn.compositions)[0];
                    let compLib = AdobeAn.getComposition(compName).getLibrary();
                    LibClassFX = compLib.FishFX;
                } catch(e) {}
            }
            if (LibClassFX) {
                let fx = new LibClassFX();
                fx.worldX = f.worldX; 
                fx.y = f.shape.y;
                coinsContainer.addChild(fx);
                effects.push(fx); 
            }
            fishes.splice(i, 1);
        } else if (f.shape.x < -3000) { // Было -200! Теперь удаляем далеко слева
            coinsContainer.removeChild(f.shape);
            fishes.splice(i, 1);
        }
    }

    // === ОБРАБОТКА АКТИВНЫХ САНЕЙ ===
    if (hasSled) {
        sledTimer--;
        
        if (activeSledInstance) {
            let sledOffsetY = 85; 
            let sledOffsetX = 0; 
            let rad = player.rotation * Math.PI / 180;

            setPlayerState("sled"); // <--- ВОТ ТАК ВКЛЮЧАЕМ АНИМАЦИЮ САНЕЙ
            
            activeSledInstance.x = player.x + Math.cos(rad) * sledOffsetX - Math.sin(rad) * sledOffsetY;
            activeSledInstance.y = player.y + Math.sin(rad) * sledOffsetX + Math.cos(rad) * sledOffsetY;
            activeSledInstance.rotation = player.rotation;
        }

        // Время жизни саней истекло
        if (sledTimer <= 0) {
            hasSled = false;
            
            // ЖЕСТКИЙ КУЛДАУН: Новые сани появятся минимум через 15 000 пикселей от текущего места!
            nextSledX = worldOffsetX + 5000 + Math.random() * 10000;
            
            createjs.Sound.play("SfxSledBreak"); 
            
            // ВАЖНО: Компенсируем разницу хитбоксов, чтобы Кико не "падал" и не получал штраф за приземление!
            player.y += 35; 
            
            if (activeSledInstance && activeSledInstance.parent) {
                activeSledInstance.parent.removeChild(activeSledInstance);
            }
            activeSledInstance = null;
            spawnBoostFlash();
        }
    }

    // Проверка столкновения с санками на трассе
    for (let i = sleds.length - 1; i >= 0; i--) {
        let s = sleds[i];
        s.shape.x = s.worldX - worldOffsetX;
        s.shape.y = s.worldY; 

        let distX = Math.abs(s.worldX - playerWorldX);
        let distY = Math.abs(s.shape.y - player.y);

        if (!hasSled && !s.hit && distX < (s.hitRadius + 30) && distY < (s.hitRadius + 30)) {
            s.hit = true;
            hasSled = true;
            // Лулу (1) едет на 5 сек дольше (1200 кадров), остальные 15 сек (900)
            sledTimer = (window.selectedCharID === 1) ? 1200 : 900;
            speedX += 25; // Увеличиваем буст при подборе (было 8)
            spawnBoostFlash();
            spawnComboText("TURBO SLED!");
            createjs.Sound.play("SfxSledPickup");
            
            activeSledInstance = s.shape;
            // Убедимся, что сани лежат под персонажем в контейнере
            if (cameraContainer.getChildIndex(activeSledInstance) > cameraContainer.getChildIndex(player)) {
                cameraContainer.swapChildren(activeSledInstance, player);
            }
            
            sleds.splice(i, 1);
            continue;
        }

        // Неподобранные сани исчезают далеко за экраном
        if (s.shape.x < -3000 || s.hit) { // Было -200
            if (!s.hit && s.shape.parent) s.shape.parent.removeChild(s.shape);
            sleds.splice(i, 1);
        }
    }

    let distanceToAvalanche = playerWorldX - avalancheWorldX;
    avalancheBaseSpeed += 0.002;
    let currentAvalancheSpeed = avalancheBaseSpeed;

    if (distanceToAvalanche > 2500) {
        currentAvalancheSpeed = speedX + 1.5; 
    } else if (distanceToAvalanche < 1000) {
        currentAvalancheSpeed = speedX - 0.5; 
        if (currentAvalancheSpeed < 18) currentAvalancheSpeed = 18;
    }

    avalancheWorldX += currentAvalancheSpeed; 
    if (avalanche) avalanche.x = avalancheWorldX - worldOffsetX; 
    // ЗВУК ЛАВИНЫ (Нарастает при приближении)
    if (distanceToAvalanche < 1500 && !isGameOver) {
        if (!avalancheSoundInstance) {
            avalancheSoundInstance = createjs.Sound.play("SfxAvalanche", { loop: -1, volume: 0 });
        }
        // Громкость от 0 до 1 в зависимости от близости
        avalancheSoundInstance.volume = 1 - (distanceToAvalanche / 1500); 
    } else if (avalancheSoundInstance) {
        avalancheSoundInstance.stop();
        avalancheSoundInstance = null;
    }
    // Вызов Game Over
    if (avalancheWorldX > playerWorldX - 80) {
        if (!isGameOver) {
            if (hasSled) {
                // СПАСЕНИЕ САНЯМИ: Уничтожаем сани, но спасаем игрока!
                hasSled = false;
                
                // ЖЕСТКИЙ КУЛДАУН (спасение от спавна прямо в лавине)
                nextSledX = worldOffsetX + 15000 + Math.random() * 10000;
                
                createjs.Sound.play("SfxSledBreak"); // <--- ЗВУК ПОЛОМКИ ОТ ЛАВИНЫ
                player.y += 35;
                if (activeSledInstance && activeSledInstance.parent) {
                    activeSledInstance.parent.removeChild(activeSledInstance);
                }
                activeSledInstance = null;
                avalancheWorldX -= 700; // Отбрасываем лавину назад
                speedX += 10; // Импульс ускорения
                spawnBoostFlash();
            } else {
                isGameOver = true;
                triggerGameOver(distanceMeters);
            }
        }
    }
    
    if (distFromGround > 0 && hasTouchedGroundOnce) {
        let currentAirHeight = Math.floor(distFromGround / 10);
        if (currentAirHeight > maxFlightHeight) maxFlightHeight = currentAirHeight;
    }

    let targetScale = 1.0; 
    let minZoomHeight = 150; 
    
    let predictedDist = distFromGround;
    if (velocityY > 0) {
        predictedDist -= (velocityY * 10); 
        if (predictedDist < 0) predictedDist = 0;
    }
    
    if (predictedDist > minZoomHeight) {
        let excessHeight = predictedDist - minZoomHeight;
        let heightFactor = excessHeight / 1000; 
        targetScale = 1.0 - Math.min(heightFactor, 0.6); 
    }

    let oldScale = gameRoot.scaleX;
    let zoomSpeed = 0.02; 
    
    if (targetScale > oldScale) {
        zoomSpeed = 0.015 + Math.abs(targetScale - oldScale) * 0.08; 
    } else {
        zoomSpeed = 0.02 + (Math.abs(velocityY) * 0.001); 
    }

    let currentScale = oldScale + (targetScale - oldScale) * zoomSpeed;
    gameRoot.scaleX = currentScale;
    gameRoot.scaleY = currentScale;
    gameRoot.x += player.x * (oldScale - currentScale);

    let targetCameraY = 0; 
    let cameraFocusY = 250; 
    let scaledPlayerY = player.y * currentScale;

    if (scaledPlayerY < cameraFocusY) {
        targetCameraY = cameraFocusY - scaledPlayerY; 
    }

    gameRoot.y += (targetCameraY - gameRoot.y) * 0.1;
    if (gameRoot.y < 0) gameRoot.y = 0;

    let invScale = 1 / gameRoot.scaleX;
    let uiListUpdate = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "pauseScreen", "gameOverScreen"];
    
    for (let i = 0; i < uiListUpdate.length; i++) {
        let el = gameRoot[uiListUpdate[i]];
        if (el && el.initY !== undefined) {
            el.scaleX = el.startScaleX * invScale;
            el.scaleY = el.startScaleY * invScale;
            el.x = (el.startX - gameRoot.x) * invScale;
            el.y = (el.initY - gameRoot.y) * invScale;
        }
    }

    if (gameRoot.txtDistance) gameRoot.txtDistance.text = distanceMeters;
    if (gameRoot.txtCoins) gameRoot.txtCoins.text = coinsCollected;
    if (gameRoot.txtFPS) gameRoot.txtFPS.text = "FPS: " + Math.round(createjs.Ticker.getMeasuredFPS());

    if (gameRoot.mcEnergyBar) {
        // Плавное перетекание визуала к реальному значению (0.08 — скорость анимации, можешь менять)
        visualEnergy += (currentEnergy - visualEnergy) * 0.08; 
        
        let frame = Math.max(0, Math.floor((visualEnergy / maxEnergy) * 999));
        gameRoot.mcEnergyBar.gotoAndStop(frame);
    }
}