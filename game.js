// v1.6.3

let activeCharMC = null;
let player;
let ground;
let hillShape; 
let gameRoot; 
let avalanche; 
let scene; // Сохраняем ссылку на сцену Pixi

// === ЗВУКИ И МУЗЫКА (SoundJS остается, логика не меняется) ===
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

// ПУЛ ОБЪЕКТОВ: Хранилище для переиспользования
let objPool = {
    coins: [], fishes: [], sleds: [], coinFX: [], fishFX: [], comboText: [], comboFlash: []
};

// window.killPixiObj = function(obj) {
//     if (!obj) return;

//     // Мягко останавливаем все анимации, чтобы отвязать их от PixiAnimate
//     function stopAll(mc) {
//         if (!mc) return;
//         if (typeof mc.stop === "function") mc.stop();
//         if (PIXI && PIXI.animate && PIXI.animate.Animator) PIXI.animate.Animator.stop(mc);
//         if (mc.children) {
//             for (let i = 0; i < mc.children.length; i++) stopAll(mc.children[i]);
//         }
//     }
//     stopAll(obj);

//     // Убираем объект со сцены
//     if (obj.parent) obj.parent.removeChild(obj);
    
//     // Безопасное удаление
//     if (obj.destroy) {
//         try {
//             if (obj.isCustomEffect) {
//                 // Наши кастомные эффекты (вспышки и текст) удаляем вместе с текстурами навсегда
//                 obj.destroy({ children: true, texture: true, baseTexture: true });
//             } else {
//                 // Символы из библиотеки Animate удаляем БЕЗ затрагивания общих текстур
//                 obj.destroy({ children: true }); 
//             }
//         } catch(e) {}
//     }
// };

// === ЭНЕРГИЯ И РЫБКИ ===
let maxEnergy = 100;
let currentEnergy = 100;
let visualEnergy = 100; 
let energyDepletionRate = 0.08; 
let fishes = [];
let nextFishX = 3000; 
let comboAnimTimer = 0;

// === САНКИ И ТРАНСПОРТ ===
let sleds = [];
let nextSledX = 15000; 
let hasSled = false;
let sledTimer = 0;
let activeSledInstance = null;

let cameraContainer;
let initialUI_Y = {};

// === ЭКОНОМИКА И ДАННЫЕ ИГРОКА ===
let globalCoins = parseInt(localStorage.getItem("pinglooTotalCoins")) || 0;
let unlockedBiomes = [0, 1, 2, 3, 4, 5, 6, 7]; // Разблокированы все биомы
let unlockedChars = [0, 1, 2, 3]; 
window.selectedCharID = parseInt(localStorage.getItem("pinglooSelectedChar")) || 0; 

function updateGlobalUI() {
    let record = localStorage.getItem("pinglooRecordDistance") || 0;
    // В PixiJS свойство изменения текста это просто .text
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

// PixiJS работает с hex-числами для цветов, адаптируем математику
function hexToRgb(hexNum) {
    return { r: (hexNum >> 16) & 255, g: (hexNum >> 8) & 255, b: hexNum & 255 };
}
function interpolateColor(color1, color2, factor) {
    let c1 = hexToRgb(color1);
    let c2 = hexToRgb(color2);
    let r = Math.round(c1.r + factor * (c2.r - c1.r));
    let g = Math.round(c1.g + factor * (c2.g - c1.g));
    let b = Math.round(c1.b + factor * (c2.b - c1.b));
    return (r << 16) + (g << 8) + b; // Возвращаем чистое число цвета для видеокарты
}

// Заменили строковые цвета на числовые (0x вместо #) для аппаратного ускорения
let currentBiomeIndex = 0;
let biomes = [
    { id: 0, startDist: 0,    lineColor: 0xA8E8E6, fillColor: 0xFFFFFF }, 
    { id: 1, startDist: 1500, lineColor: 0x63B6E5, fillColor: 0xABEFFF }, 
    { id: 2, startDist: 3000, lineColor: 0x99D798, fillColor: 0xBCFBB2 }, 
    { id: 3, startDist: 4500, lineColor: 0xD9B558, fillColor: 0xFFE783 }, 
    { id: 4, startDist: 6000, lineColor: 0xC0BBA6, fillColor: 0xE2DCC3 }, 
    { id: 5, startDist: 7500, lineColor: 0x337B99, fillColor: 0x57A6C8 }, 
    { id: 6, startDist: 9000, lineColor: 0xC09F58, fillColor: 0xFAE08C },
    { id: 7, startDist: 10500, lineColor: 0x5F5E7D, fillColor: 0xAEAFCE } 
];

function spawnBoostFlash() {
    let flash;
    if (objPool.comboFlash.length > 0) {
        flash = objPool.comboFlash.pop();
        flash.scale.set(1);
        flash.alpha = 0.8;
        flash.visible = true;
    } else {
        flash = new PIXI.Graphics();
        flash.beginFill(0x00FFFF);
        flash.drawCircle(0, 0, 50);
        flash.endFill();
        let playerIndex = cameraContainer.getChildIndex(player);
        cameraContainer.addChildAt(flash, playerIndex);
    }
    flash.x = player.x;
    flash.y = player.y + 85;
    effects.push({ shape: flash, type: "comboFlash", life: 1.0 });
}

function spawnComboText(combo) {
    let textStr = combo === 1 ? "COMBO!" : "COMBO x" + combo + "!";
    let txt;
    if (objPool.comboText.length > 0) {
        txt = objPool.comboText.pop();
        txt.text = textStr;
        txt.alpha = 1;
        txt.visible = true;
    } else {
        let style = new PIXI.TextStyle({
            fontFamily: "Arial Black", fontSize: 40, fontWeight: "bold",
            fill: 0xFFD700, dropShadow: true, dropShadowColor: 0xFF4500, dropShadowDistance: 4, dropShadowBlur: 10
        });
        txt = new PIXI.Text(textStr, style);
        txt.anchor.set(0.5);
        cameraContainer.addChild(txt);
    }
    txt.x = player.x;
    txt.y = player.y - 120; 
    effects.push({ shape: txt, type: "comboText" });
}

window.cachedTextures = {};
function getCachedSprite(libName) {
    let r = (scene && scene.renderer) ? scene.renderer : (scene && scene.app && scene.app.renderer ? scene.app.renderer : null);
    if (!window.cachedTextures[libName] && lib && lib[libName] && r) {
        let tempMC = new lib[libName]();
        // Ставим максимальное качество (под плотность экрана) вместо 0.5
        window.cachedTextures[libName] = r.generateTexture(tempMC, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio || 2); 
        tempMC.destroy({ children: true });
    }
    if (window.cachedTextures[libName]) {
        let spr = new PIXI.Sprite(window.cachedTextures[libName]);
        spr.anchor.set(0.5); // Возвращаем якорь точно в центр
        return spr;
    }
    return (lib && lib[libName]) ? new lib[libName]() : new PIXI.Container();
}

function spawnCoin(worldX, worldY) {
    let coinObj;
    if (objPool.coins.length > 0) {
        coinObj = objPool.coins.pop();
        coinObj.visible = true;
    } else {
        coinObj = getCachedSprite("Coin");
        coinsContainer.addChild(coinObj);
    }
    coinObj.x = worldX - worldOffsetX; 
    coinObj.y = worldY; 
    coins.push({ shape: coinObj, worldX: worldX, worldY: worldY, hitRadius: 35, hit: false });
}

function spawnFish(worldX, worldY) {
    let fishObj;
    if (objPool.fishes.length > 0) {
        fishObj = objPool.fishes.pop();
        fishObj.visible = true;
    } else {
        fishObj = getCachedSprite("Fish");
        coinsContainer.addChild(fishObj); 
    }
    fishObj.x = worldX - worldOffsetX; 
    fishObj.y = worldY; 
    let nextY = getHillY(worldX + 5);
    let prevY = getHillY(worldX - 5);
    fishObj.rotation = Math.atan2(nextY - prevY, 10); 
    fishes.push({ shape: fishObj, worldX: worldX, worldY: worldY, hitRadius: 40, hit: false });
}

function spawnSled(worldX, worldY) {
    let sledObj;
    if (objPool.sleds.length > 0) {
        sledObj = objPool.sleds.pop();
        sledObj.visible = true;
    } else {
        sledObj = getCachedSprite("Sled");
        let playerIndex = cameraContainer.getChildIndex(player);
        cameraContainer.addChildAt(sledObj, playerIndex);
    }
    sledObj.x = worldX - worldOffsetX; 
    sledObj.y = worldY; 
    let nextY = getHillY(worldX + 5);
    let prevY = getHillY(worldX - 5);
    sledObj.rotation = Math.atan2(nextY - prevY, 10); 
    sleds.push({ shape: sledObj, worldX: worldX, worldY: worldY, hitRadius: 50, hit: false });
}

// === НОВАЯ СИСТЕМА БИОМОВ (На главной сцене) ===
function switchBiome(index) {
    currentBiomeIndex = index;
    let layers = ["sky", "cloudsBack", "mountainsMid", "mountains", "trees", "cloudsFront"];
    
    for (let i = 0; i <= 7; i++) {
        layers.forEach(key => {
            let bgKey = "bg" + key.charAt(0).toUpperCase() + key.slice(1);
            // Ищем слой по любым вариантам: trees_1, bgTrees_1 или просто bgTrees (для 0)
            let layer = gameRoot[key + "_" + i] || gameRoot[bgKey + "_" + i] || (i === 0 ? gameRoot[bgKey] : null);
            
            if (layer) {
                layer.visible = (i === index); 
                
                if (layer.initialX === undefined) {
                    layer.initialX = layer.x;
                    layer.initialY = layer.y;
                }
            }
        });
    }
}

// === МИНИ-ДВИЖОК АНИМАЦИЙ ===
window.activeTweens = [];
function addTween(target, props, duration, onComplete = null, onUpdate = null) {
    let startProps = {};
    for (let key in props) startProps[key] = target[key];
    window.activeTweens.push({ target, startProps, targetProps: props, duration, time: 0, onComplete, onUpdate });
}

window.initGame = function(root, pixiScene) {
    gameRoot = root; 
    scene = pixiScene;

    // === РЕГИСТРАЦИЯ ВНЕШНИХ ЗВУКОВ (SoundJS работает как раньше) ===
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
    createjs.Sound.registerSound("sounds/sfx_pause.mp3", "SfxPause");
    createjs.Sound.registerSound("sounds/sfx_page.mp3", "SfxPage");

    player = root.player;

    if (window.playerStartX === undefined) window.playerStartX = player.x;
    
    let isGoodStart = false;
    while (!isGoodStart) {
        trackSeed = Math.random() * 100000;
        let px = player.x; 
        let y0 = getHillY(px);         
        let y100 = getHillY(px + 100); 
        let y200 = getHillY(px + 200); 
        if (y0 < baseY - 50 && y100 > y0 + 15 && y200 > y100 + 15) isGoodStart = true; 
    }
    
    ground = root.ground;
    if(ground) ground.visible = false; 
    avalanche = root.avalanche; 

    cameraContainer = new PIXI.Container();
    hillShape = new PIXI.Graphics();
    coinsContainer = new PIXI.Container();

    cameraContainer.addChild(player);      
    cameraContainer.addChild(hillShape);   
    cameraContainer.addChild(coinsContainer); 
    if (avalanche) cameraContainer.addChild(avalanche);

    // Сортируем слои: Камера (игрок и монеты) над биомами, UI над камерой
    root.addChild(cameraContainer);

    let allUI = ["pauseScreen", "gameOverScreen", "menuScreen", "txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    allUI.forEach(name => {
        if (root[name]) root.addChild(root[name]); 
    });

    switchBiome(window.selectedBiomeID || 0);

    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiList.forEach(name => {
        if (gameRoot[name]) {
            gameRoot[name].initY = gameRoot[name].y;
            gameRoot[name].startX = gameRoot[name].x; 
            gameRoot[name].startScaleX = gameRoot[name].scale.x;
            gameRoot[name].startScaleY = gameRoot[name].scale.y;
            
            if (name === "btnPause") {
                gameRoot[name].interactive = true;
                gameRoot[name].cursor = "pointer";
                gameRoot[name].on("pointerdown", () => { 
                    if (window.isCountdown) return; 
                    createjs.Sound.play("SfxPause"); // НОВЫЙ ЗВУК
                    isPlaying = false; 
                    if (currentBgmInstance) currentBgmInstance.paused = true; // ПАУЗА МУЗЫКИ
                    if (player && typeof player.stop === "function") player.stop(); // ПАУЗА ПЕРСОНАЖА
                    if (avalanche && typeof avalanche.stop === "function") avalanche.stop(); // ПАУЗА ЛАВИНЫ
                    if (gameRoot.pauseScreen) {
                        gameRoot.addChild(gameRoot.pauseScreen);
                        gameRoot.pauseScreen.visible = true;
                    }
                });
            }
        }
    });

    if (gameRoot.gameOverScreen) {
        gameRoot.gameOverScreen.startX = gameRoot.gameOverScreen.x;
        gameRoot.gameOverScreen.initY = gameRoot.gameOverScreen.y;
        gameRoot.gameOverScreen.startScaleX = gameRoot.gameOverScreen.scale.x;
        gameRoot.gameOverScreen.startScaleY = gameRoot.gameOverScreen.scale.y;
        gameRoot.gameOverScreen.visible = false; 
        
        if (gameRoot.gameOverScreen.mcNewRecord) gameRoot.gameOverScreen.mcNewRecord.visible = false; 

        if (gameRoot.gameOverScreen.btnRestart) {
            gameRoot.gameOverScreen.btnRestart.interactive = true;
            gameRoot.gameOverScreen.btnRestart.cursor = "pointer";
            gameRoot.gameOverScreen.btnRestart.removeAllListeners();
            gameRoot.gameOverScreen.btnRestart.on("pointerdown", () => {
                createjs.Sound.play("SfxClick");
                resetGame(true); 
            });
        }
        
        if (gameRoot.gameOverScreen.btnMenu) {
            gameRoot.gameOverScreen.btnMenu.interactive = true;
            gameRoot.gameOverScreen.btnMenu.cursor = "pointer";
            gameRoot.gameOverScreen.btnMenu.removeAllListeners();
            gameRoot.gameOverScreen.btnMenu.on("pointerdown", () => {
                createjs.Sound.play("SfxClick");
                resetGame(false); 
            });
        }
    }

    let screens = ["menuScreen", "menuLevelScreen", "menuCharScreen"];
    function showScreen(screenName) {
        screens.forEach(name => {
            if (gameRoot[name]) {
                gameRoot[name].visible = (name === screenName);
                if (name === screenName) gameRoot.addChild(gameRoot[name]);
            }
        });
        updateGlobalUI(); 
    }

    if (cameraContainer) cameraContainer.visible = false;
    let uiListStart = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiListStart.forEach(name => { if (gameRoot[name]) gameRoot[name].visible = false; });

    showScreen(""); 

    // Стартовый экран разблокировки звука (PixiJS стиль)
    let startOverlay = new PIXI.Container();
    let overlayBg = new PIXI.Graphics();
    overlayBg.beginFill(0x000000).drawRect(-2000, -2000, 6000, 6000).endFill();
    
    let style = new PIXI.TextStyle({ fontFamily: "Arial Black", fontSize: 80, fontWeight: "bold", fill: 0xFFFFFF });
    let overlayTxt = new PIXI.Text("TAP TO START", style);
    overlayTxt.anchor.set(0.5);
    overlayTxt.x = 960; 
    overlayTxt.y = 540;
    
    startOverlay.addChild(overlayBg, overlayTxt);
    gameRoot.addChild(startOverlay);

    // Простейшая пульсация через стандартный setInterval (работает всегда и везде без ошибок тикера)
    let pulseTime = 0;
    let pulseInterval = setInterval(() => {
        pulseTime += 0.1;
        if (overlayTxt && overlayTxt.scale) {
            overlayTxt.scale.set(1 + Math.sin(pulseTime) * 0.05);
            overlayTxt.alpha = 0.9 + Math.sin(pulseTime) * 0.1;
        } else {
            clearInterval(pulseInterval);
        }
    }, 33); // ~30 кадров в секунду для плавной пульсации

    startOverlay.interactive = true;
    startOverlay.cursor = "pointer";
    startOverlay.on("pointerdown", () => {
        let ctx = createjs.Sound.activePlugin.context;
        if (ctx && ctx.state === "suspended") ctx.resume();

        clearInterval(pulseInterval); // Останавливаем анимацию
        if (startOverlay.parent) startOverlay.parent.removeChild(startOverlay);
        
        showScreen("menuScreen"); 
        playMusic("BgmMenu");     
    });

    if (gameRoot.menuScreen && gameRoot.menuScreen.btnPlay) {
        gameRoot.menuScreen.btnPlay.removeAllListeners();
        gameRoot.menuScreen.btnPlay.interactive = true;
        gameRoot.menuScreen.btnPlay.cursor = "pointer";
        gameRoot.menuScreen.btnPlay.on("pointerdown", () => {
            createjs.Sound.play("SfxClick");
            showScreen("menuLevelScreen"); 
        });
    }

    window.selectedBiomeID = 0; 

    if (gameRoot.menuLevelScreen) {
        if (gameRoot.menuLevelScreen.btnBack) {
            gameRoot.menuLevelScreen.btnBack.interactive = true;
            gameRoot.menuLevelScreen.btnBack.cursor = "pointer";
            gameRoot.menuLevelScreen.btnBack.on("pointerdown", () => { createjs.Sound.play("SfxClick"); showScreen("menuScreen")});
        }
        if (gameRoot.menuLevelScreen.btnNext) {
            gameRoot.menuLevelScreen.btnNext.interactive = true;
            gameRoot.menuLevelScreen.btnNext.cursor = "pointer";
            gameRoot.menuLevelScreen.btnNext.on("pointerdown", () => { createjs.Sound.play("SfxClick"); showScreen("menuCharScreen")});
        }

        let currentBiomePage = 0; 
        function updateBiomePage() {
            if (gameRoot.menuLevelScreen.mcPage1) gameRoot.menuLevelScreen.mcPage1.visible = (currentBiomePage === 0);
            if (gameRoot.menuLevelScreen.mcPage2) gameRoot.menuLevelScreen.mcPage2.visible = (currentBiomePage === 1);
            if (gameRoot.menuLevelScreen.btnArrowLeft) gameRoot.menuLevelScreen.btnArrowLeft.visible = (currentBiomePage > 0);
            if (gameRoot.menuLevelScreen.btnArrowRight) gameRoot.menuLevelScreen.btnArrowRight.visible = (currentBiomePage < 1);
        }

        if (gameRoot.menuLevelScreen.btnArrowLeft) {
            gameRoot.menuLevelScreen.btnArrowLeft.interactive = true;
            gameRoot.menuLevelScreen.btnArrowLeft.cursor = "pointer";
            gameRoot.menuLevelScreen.btnArrowLeft.on("pointerdown", () => {
                createjs.Sound.play("SfxPage"); // ЗВУК ПЕРЕЛИСТЫВАНИЯ
                if (currentBiomePage > 0) currentBiomePage--;
                updateBiomePage();
            });
        }
        if (gameRoot.menuLevelScreen.btnArrowRight) {
            gameRoot.menuLevelScreen.btnArrowRight.interactive = true;
            gameRoot.menuLevelScreen.btnArrowRight.cursor = "pointer";
            gameRoot.menuLevelScreen.btnArrowRight.on("pointerdown", () => {
                createjs.Sound.play("SfxPage"); // ЗВУК ПЕРЕЛИСТЫВАНИЯ
                if (currentBiomePage < 1) currentBiomePage++;
                updateBiomePage();
            });
        }

        function updateBiomeUI(selectedIndex) {
            window.selectedBiomeID = selectedIndex; 
            for (let i = 0; i <= 7; i++) { 
                let pageMC = (i < 4) ? gameRoot.menuLevelScreen.mcPage1 : gameRoot.menuLevelScreen.mcPage2;
                if (!pageMC) continue;
                let btn = pageMC["btnLevel" + i];
                if (btn && typeof btn.gotoAndStop === "function") {
                    let isUnlocked = unlockedBiomes.includes(i);
                    if (!isUnlocked) btn.gotoAndStop(2); 
                    else if (i === selectedIndex) btn.gotoAndStop(1); 
                    else btn.gotoAndStop(0); 
                }
            }
        }

        for (let i = 0; i <= 7; i++) {
            let pageMC = (i < 4) ? gameRoot.menuLevelScreen.mcPage1 : gameRoot.menuLevelScreen.mcPage2;
            if (pageMC && pageMC["btnLevel" + i]) {
                let btn = pageMC["btnLevel" + i];
                btn.interactive = true;
                btn.cursor = "pointer";
                btn.on("pointerdown", () => {
                    if (unlockedBiomes.includes(i)) {
                        createjs.Sound.play("SfxClick");
                        updateBiomeUI(i);
                    }
                });
            }
        }
        updateBiomePage();
        updateBiomeUI(window.selectedBiomeID);
    }

    if (gameRoot.menuCharScreen) {
        if (gameRoot.menuCharScreen.btnBack) {
            gameRoot.menuCharScreen.btnBack.interactive = true;
            gameRoot.menuCharScreen.btnBack.cursor = "pointer";
            gameRoot.menuCharScreen.btnBack.on("pointerdown", () => { createjs.Sound.play("SfxClick"); showScreen("menuLevelScreen"); });
        }
        if (gameRoot.menuCharScreen.btnStart) { 
            gameRoot.menuCharScreen.btnStart.interactive = true;
            gameRoot.menuCharScreen.btnStart.cursor = "pointer";
            gameRoot.menuCharScreen.btnStart.on("pointerdown", () => {
                createjs.Sound.play("SfxClick");
                showScreen(""); 
                resetGame(true); 
            });
        }

        let charBtns = ["btnChar0", "btnChar1", "btnChar2", "btnChar3"];
        function updateCharUI(selectedIndex) {
            let prevSelectedCharID = window.selectedCharID;
            window.selectedCharID = selectedIndex;
            localStorage.setItem("pinglooSelectedChar", window.selectedCharID); 
            
            function setButtonState(btn, frame) {
                if (!btn) return;
                if (typeof btn.gotoAndStop === "function") {
                    btn.gotoAndStop(frame);
                    if (btn.children && btn.children.length > 0) {
                        btn.children.forEach(child => {
                            if (typeof child.play === "function") {
                                child.play();
                                // Ускоряем анимацию, подгоняя под 60 FPS Pixi
                                if (child.framerate !== undefined) child.framerate = 60; 
                                else if (child.speed !== undefined) child.speed = 2.0; 
                            }
                        });
                    }
                }
            }

            charBtns.forEach((btnName, i) => {
                let btn = gameRoot.menuCharScreen[btnName];
                if (btn) {
                    if (!unlockedChars.includes(i)) setButtonState(btn, 3);
                    else if (i === selectedIndex) setButtonState(btn, 1);
                    else if (i === prevSelectedCharID && prevSelectedCharID !== selectedIndex) setButtonState(btn, 2);
                    else setButtonState(btn, 0);
                }
            });
        }
        charBtns.forEach((btnName, i) => {
            let btn = gameRoot.menuCharScreen[btnName];
            if (btn) {
                btn.interactive = true;
                btn.cursor = "pointer";
                btn.removeAllListeners();
                btn.on("pointerdown", () => {
                    if (unlockedChars.includes(i)) {
                        createjs.Sound.play("SfxClick");
                        updateCharUI(i); 
                    }
                });
            }
        });
        updateCharUI(window.selectedCharID);
    }

    if (gameRoot.pauseScreen) {
        gameRoot.pauseScreen.visible = false; 
        gameRoot.pauseScreen.startX = gameRoot.pauseScreen.x;
        gameRoot.pauseScreen.initY = gameRoot.pauseScreen.y;
        gameRoot.pauseScreen.startScaleX = gameRoot.pauseScreen.scale.x;
        gameRoot.pauseScreen.startScaleY = gameRoot.pauseScreen.scale.y;

        if (gameRoot.pauseScreen.btnResume) {
            gameRoot.pauseScreen.btnResume.interactive = true;
            gameRoot.pauseScreen.btnResume.cursor = "pointer";
            gameRoot.pauseScreen.btnResume.on("pointerdown", () => {
                createjs.Sound.play("SfxClick");
                resumeWithCountdown(); 
            });
        }
        if (gameRoot.pauseScreen.btnRestart) {
            gameRoot.pauseScreen.btnRestart.interactive = true;
            gameRoot.pauseScreen.btnRestart.cursor = "pointer";
            gameRoot.pauseScreen.btnRestart.on("pointerdown", () => {
                createjs.Sound.play("SfxClick");
                gameRoot.pauseScreen.visible = false;
                resetGame(true); 
            });
        }
        if (gameRoot.pauseScreen.btnMenu) {
            gameRoot.pauseScreen.btnMenu.interactive = true;
            gameRoot.pauseScreen.btnMenu.cursor = "pointer";
            gameRoot.pauseScreen.btnMenu.on("pointerdown", () => {
                createjs.Sound.play("SfxClick");
                gameRoot.pauseScreen.visible = false;
                resetGame(false); 
            });
        }
    }
    
    // Стандартные глобальные клики оставляем на window
    window.addEventListener("pointerdown", () => { if (isPlaying) isDiving = true; });
    window.addEventListener("pointerup", () => isDiving = false);

    let lastW = 0, lastH = 0;
    window.handleResize = function() {
        let canvas = document.getElementById("stage");
        if (!canvas) return;

        let w = window.innerWidth;
        let h = window.innerHeight;
        
        // ЗАЩИТА ОТ БЕСКОНЕЧНОГО ЦИКЛА В SAFARI (OUT OF MEMORY)
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;

        // ИСПРАВЛЕНИЕ КРАША: Запрещаем мобильному браузеру дергаться и скроллить при тапах (touch-action)
        canvas.style.cssText = "position: absolute; top: 0px; left: 0px; width: " + w + "px; height: " + h + "px; overflow: hidden; touch-action: none; -webkit-touch-callout: none; user-select: none;";
        
        // --- ДИНАМИЧЕСКОЕ КАЧЕСТВО ДЛЯ СМАРТФОНОВ ---
        // Считываем настройку из памяти. Если игрок выбрал низкое качество, ставим 1.
        // Иначе берем реальную плотность экрана телефона (2 или 3 для Retina).
        let isLowQuality = localStorage.getItem("pinglooLowQuality") === "true";
        let pixelRatio = isLowQuality ? 1 : (window.devicePixelRatio || 1);

        if (scene && scene.renderer) {
            scene.renderer.resolution = pixelRatio;
            scene.renderer.resize(w, h);
        } else if (scene && scene.app && scene.app.renderer) {
            scene.app.renderer.resolution = pixelRatio;
            scene.app.renderer.resize(w, h);
        } else {
            canvas.width = w * pixelRatio;
            canvas.height = h * pixelRatio;
        }

        if (gameRoot) {
            let targetW = 1920;
            let targetH = 1080;
            
            let finalScale = Math.min(w / targetW, h / targetH); 
            window.baseGameScale = finalScale;

            gameRoot.scale.set(finalScale);
            gameRoot.rotation = 0; 
            
            gameRoot.x = (w - (targetW * finalScale)) / 2;
            gameRoot.y = (h - (targetH * finalScale)) / 2; 
            
            gameRoot.baseX = gameRoot.x;
            gameRoot.baseY = gameRoot.y;
        }
    };
    
    window.addEventListener("resize", window.handleResize);
    window.handleResize();

    // ЗАПУСК ИГРОВОГО ЦИКЛА ЧЕРЕЗ БРАУЗЕРНЫЙ ТИКЕР
    let lastTime = performance.now();
    function browserLoop(currentTime) {
        let dt = (currentTime - lastTime) / 16.666;
        if (dt > 3) dt = 3;
        lastTime = currentTime;

        gameLoop(dt); // Передаем delta в наш игровой цикл

        requestAnimationFrame(browserLoop);
    }
    requestAnimationFrame(browserLoop);

    if (typeof yt !== 'undefined' && yt.game) {
        yt.game.ready();
    }
    window.handleResize();
}

function setPlayerState(state) {
    if (currentState !== state) {
        if (!activeCharMC) return; 
        if (activeCharMC.animRoll) activeCharMC.animRoll.visible = false;
        if (activeCharMC.animDive) activeCharMC.animDive.visible = false;
        if (activeCharMC.animFly) activeCharMC.animFly.visible = false;
        if (activeCharMC.animHit) activeCharMC.animHit.visible = false;
        if (activeCharMC.animLand) activeCharMC.animLand.visible = false;
        if (activeCharMC.animCombo) activeCharMC.animCombo.visible = false;
        if (activeCharMC.animSled) activeCharMC.animSled.visible = false;
        
        // Умная функция запуска
        function safePlay(mc) {
            if (mc) {
                mc.visible = true;
                if (typeof mc.gotoAndPlay === "function") {
                    mc.gotoAndPlay(0);
                } else if (typeof mc.play === "function") {
                    mc.play();
                }
                
                // Форсируем 60 FPS для клипа и всех вложенных символов
                let fixSpeed = (obj) => {
                    if (obj.framerate !== undefined) obj.framerate = 60;
                    else if (obj.speed !== undefined) obj.speed = 2.0;
                    if (obj.children) obj.children.forEach(c => fixSpeed(c));
                };
                fixSpeed(mc);
            }
        }

        if (state === "roll") safePlay(activeCharMC.animRoll);
        if (state === "dive") safePlay(activeCharMC.animDive);
        if (state === "fly") safePlay(activeCharMC.animFly);
        if (state === "hit") safePlay(activeCharMC.animHit);
        if (state === "land") safePlay(activeCharMC.animLand);
        if (state === "combo") safePlay(activeCharMC.animCombo);
        if (state === "sled") safePlay(activeCharMC.animSled);
        
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
    
    let startRamp = 0;
    if (x < 3000) {
        let progress = Math.max(0, 3000 - x) / 3000;
        startRamp = progress * progress * progress * 700; 
    }
    
    return baseY + wave1 + wave2 + wave3 + macroWave - startRamp;
}

function playMusic(trackId) {
    if (currentBgmName === trackId) return; 
    if (currentBgmInstance) currentBgmInstance.stop();
    currentBgmName = trackId;
    currentBgmInstance = createjs.Sound.play(trackId, { loop: -1, volume: 0.5 });
}

function triggerGameOver(finalDistance) {
    if (player) {
        if (typeof player.stop === "function") player.stop();
        if (player.animRoll) player.animRoll.stop();
        if (player.animDive) player.animDive.stop();
        if (player.animFly) player.animFly.stop();
        if (player.animLand) player.animLand.stop();
    }
    if (avalanche) avalanche.stop();

    if (currentBgmInstance) currentBgmInstance.stop();
    currentBgmName = ""; 
    if (avalancheSoundInstance) {
        avalancheSoundInstance.stop();
        avalancheSoundInstance = null;
    }
    createjs.Sound.play("SfxCrash");

    let fadeTime = 500; 
    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiList.forEach(name => {
        if (gameRoot[name]) addTween(gameRoot[name], {alpha: 0}, fadeTime);
    });

    if (gameRoot.gameOverScreen) {
        gameRoot.addChild(gameRoot.gameOverScreen); 
        gameRoot.gameOverScreen.visible = true; 
        gameRoot.gameOverScreen.gotoAndPlay(2); 

        if (gameRoot.gameOverScreen.txtFinalDistance) {
            let distCounter = { val: 0 };
            gameRoot.gameOverScreen.txtFinalDistance.text = "0 m";
            
            // Плавно накручиваем счетчик от 0 до финального числа за 1 секунду
            addTween(distCounter, { val: finalDistance }, 1000, 
                () => { gameRoot.gameOverScreen.txtFinalDistance.text = finalDistance + " m"; }, 
                () => { gameRoot.gameOverScreen.txtFinalDistance.text = Math.floor(distCounter.val) + " m"; }
            );
        }

        let savedRecord = localStorage.getItem("pinglooRecordDistance") || 0;
        if (finalDistance > savedRecord) {
            localStorage.setItem("pinglooRecordDistance", finalDistance); 
            if (gameRoot.gameOverScreen.mcNewRecord) gameRoot.gameOverScreen.mcNewRecord.visible = true;
        }

        globalCoins += coinsCollected;
        localStorage.setItem("pinglooTotalCoins", globalCoins);
        updateGlobalUI(); 

        if (typeof yt !== 'undefined' && yt.game) {
            yt.game.sendScore({ score: finalDistance });
        }
    }
}

function resetGame(startImmediately) {
    if (gameRoot.pauseScreen) gameRoot.pauseScreen.visible = false;
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
    visualEnergy = maxEnergy; 
    nextFishX = 3000;
    comboAnimTimer = 0;
    isTransitioning = false;
    transitionProgress = 0;
    currentBiomeIndex = 0;

    trackSeed = Math.random() * 100000;

    if (currentBgmInstance) {
        currentBgmInstance.stop();
        currentBgmInstance = null;
    }
    currentBgmName = "";

    window.activeTweens = []; // Очищаем анимации

    // СБРАСЫВАЕМ ВСЁ В ПУЛ ВМЕСТО УДАЛЕНИЯ
    for (let i = 0; i < coins.length; i++) {
        coins[i].shape.visible = false;
        objPool.coins.push(coins[i].shape);
    }
    coins = [];
    
    for (let i = 0; i < fishes.length; i++) {
        fishes[i].shape.visible = false;
        objPool.fishes.push(fishes[i].shape);
    }
    fishes = [];

    for (let i = 0; i < sleds.length; i++) {
        sleds[i].shape.visible = false;
        objPool.sleds.push(sleds[i].shape);
    }
    sleds = [];
    
    // Сбрасываем таймеры и состояние санок здесь:
    nextSledX = 15000;
    hasSled = false;
    sledTimer = 0;
    
    if (activeSledInstance) {
        activeSledInstance.visible = false;
        objPool.sleds.push(activeSledInstance);
    }
    activeSledInstance = null;
    
    for (let i = 0; i < effects.length; i++) {
        let fx = effects[i];
        if (fx.shape) {
            fx.shape.visible = false;
            if (fx.type === "comboFlash") objPool.comboFlash.push(fx.shape);
            else if (fx.type === "comboText") objPool.comboText.push(fx.shape);
        } else {
            fx.visible = false;
            if (fx.poolType === "coinFX") objPool.coinFX.push(fx);
            else if (fx.poolType === "fishFX") objPool.fishFX.push(fx);
        }
    }
    effects = [];

    if (cameraContainer) {
        cameraContainer.alpha = 1;
        cameraContainer.visible = startImmediately;
    }
    
    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiList.forEach(name => {
        if (gameRoot[name]) {
            gameRoot[name].alpha = 1;
            gameRoot[name].visible = startImmediately; 
        }
    });

    if (gameRoot.bgContainerMC) {
        gameRoot.bgContainerMC.alpha = 1;
        gameRoot.bgContainerMC.visible = startImmediately;
    }
    if (window.bgCloudsFront) {
        window.bgCloudsFront.alpha = 1;
        window.bgCloudsFront.visible = startImmediately;
    }

    if (gameRoot.gameOverOverlay) {
        if (gameRoot.gameOverOverlay.parent) gameRoot.gameOverOverlay.parent.removeChild(gameRoot.gameOverOverlay);
        gameRoot.gameOverOverlay = null;
    }

    isTransitioning = false;
    transitionProgress = 0;
    switchBiome(window.selectedBiomeID);

    if (player) {
        if (player.kiko_mc) player.kiko_mc.visible = false;
        if (player.lulu_mc) player.lulu_mc.visible = false;
        if (player.papi_mc) player.papi_mc.visible = false;
        if (player.momi_mc) player.momi_mc.visible = false;

        if (window.selectedCharID === 0) activeCharMC = player.kiko_mc;
        if (window.selectedCharID === 1) activeCharMC = player.lulu_mc;
        if (window.selectedCharID === 3) activeCharMC = player.papi_mc;
        if (window.selectedCharID === 2) activeCharMC = player.momi_mc;
        
        if (!activeCharMC) activeCharMC = player.kiko_mc; 
        activeCharMC.visible = true;

        if (startImmediately) {
            playMusic("BgmGame"); 
            window.isIntro = true;
            player.x = -200; 
            player.y = getHillY(worldOffsetX + player.x) - 100; 
            velocityY = -20;  
            speedX = 25;     
            setPlayerState("fly");
        } else {
            playMusic("BgmMenu"); 
            window.isIntro = false;
            player.x = window.playerStartX; 
            player.y = baseY - 50;
            setPlayerState("roll");
        }
        player.rotation = 0;
        if (typeof player.play === "function") player.play(); 
    }
    if (avalanche) {
        avalanche.x = -500;
        if (typeof avalanche.play === "function") avalanche.play(); 
    }

    // Возвращаем правильный мобильный масштаб и центр экрана, а не сбрасываем в левый верхний угол
    if (window.baseGameScale) {
        gameRoot.scale.set(window.baseGameScale);
        gameRoot.x = gameRoot.baseX || 0;
        gameRoot.y = gameRoot.baseY || 0;
    } else {
        gameRoot.scale.set(1);
        gameRoot.x = 0;
        gameRoot.y = 0;
    }

    let uiListUpdate = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "pauseScreen", "gameOverScreen"];
    uiListUpdate.forEach(name => {
        let el = gameRoot[name];
        if (el && el.initY !== undefined) {
            el.scale.set(el.startScaleX, el.startScaleY);
            el.x = el.startX;
            el.y = el.initY;
        }
    });

    if (gameRoot.gameOverScreen) {
        gameRoot.gameOverScreen.visible = false;
        gameRoot.gameOverScreen.gotoAndStop(0); 
    }

    if (!startImmediately) {
        if (gameRoot.menuLevelScreen) gameRoot.menuLevelScreen.visible = false;
        if (gameRoot.menuCharScreen) gameRoot.menuCharScreen.visible = false;
        if (gameRoot.menuScreen) {
            gameRoot.addChild(gameRoot.menuScreen); 
            gameRoot.menuScreen.visible = true;
        }
    }
}

function resumeWithCountdown() {
    if (gameRoot.pauseScreen) gameRoot.pauseScreen.visible = false;

    let count = 3;
    let style = new PIXI.TextStyle({
        fontFamily: "Arial Black", fontSize: 150, fontWeight: "bold",
        fill: 0xFFD700, dropShadow: true, dropShadowColor: 0xFF4500, dropShadowDistance: 8, dropShadowBlur: 15
    });
    let txt = new PIXI.Text(count, style);
    txt.anchor.set(0.5);
    
    txt.x = (960 - gameRoot.x) / gameRoot.scale.x;
    txt.y = (540 - gameRoot.y) / gameRoot.scale.y;
    
    gameRoot.addChild(txt); 

    function animateNumber() {
        if (count > 0) {
            txt.text = count;
            txt.alpha = 1;
            txt.scale.set(0.1); 
            
            let targetScale = 1 / gameRoot.scale.x; 

            // Замена Tween: Ручная анимация
            addTween(txt.scale, {x: targetScale, y: targetScale}, 300, () => {
                setTimeout(() => {
                    addTween(txt, {alpha: 0}, 200);
                    addTween(txt.scale, {x: targetScale * 1.5, y: targetScale * 1.5}, 200, () => {
                        count--;
                        animateNumber(); 
                    });
                }, 400);
            });
        } else {
            if (txt.parent) txt.parent.removeChild(txt);
            window.isCountdown = false; 
            isPlaying = true; 
            if (currentBgmInstance) currentBgmInstance.paused = false; // ВОЗВРАТ МУЗЫКИ
            if (player && typeof player.play === "function") player.play(); // ВОЗВРАТ ПЕРСОНАЖА
            if (avalanche && typeof avalanche.play === "function") avalanche.play(); // ВОЗВРАТ ЛАВИНЫ
        }
    }
    animateNumber();
}

function gameLoop(dt) {
    // === ОБРАБОТКА МИНИ-ДВИЖКА АНИМАЦИЙ ===
    for (let i = window.activeTweens.length - 1; i >= 0; i--) {
        let tw = window.activeTweens[i];
        tw.time += dt * 16.666; 
        let progress = Math.min(tw.time / tw.duration, 1);
        for (let prop in tw.targetProps) {
            tw.target[prop] = tw.startProps[prop] + (tw.targetProps[prop] - tw.startProps[prop]) * progress;
        }
        if (tw.onUpdate) tw.onUpdate(); // ДОБАВЛЕНО
        if (progress >= 1) {
            if (tw.onComplete) tw.onComplete();
            window.activeTweens.splice(i, 1);
        }
    }

    // if (window.biomeLoadQueue && window.biomeLoadQueue.length > 0) {
    //     let task = window.biomeLoadQueue.shift(); 
        
    //     if (lib) {
    //         let ClassRef = lib[task.libName];
    //         if (ClassRef) {
    //             let layer = new ClassRef();
    //             layer.alpha = 1;
                
    //             let b = window.activeBiomes[task.index];
    //             b[task.key] = layer;

    //             let lookupKey = task.key;
    //             if (lookupKey === "mountainsMid" && !window.activeBiomes[0][lookupKey]) lookupKey = "cloudsBack";
                
    //             let baseLayer = window.activeBiomes[0][lookupKey];
                
    //             if (baseLayer) {
    //                 layer.x = baseLayer.x;
    //                 layer.y = baseLayer.y;
    //                 layer.scale.set(baseLayer.scale.x, baseLayer.scale.y);
    //                 layer.initialX = baseLayer.initialX !== undefined ? baseLayer.initialX : baseLayer.x;
    //                 layer.initialY = baseLayer.initialY !== undefined ? baseLayer.initialY : baseLayer.y;
    //             } else {
    //                 layer.initialX = 0; layer.initialY = 0;
    //             }
                
    //             if (task.key === "cloudsFront") {
    //                 if (baseLayer && baseLayer.parent) {
    //                     baseLayer.parent.addChildAt(layer, baseLayer.parent.getChildIndex(baseLayer) + 1);
    //                 } else {
    //                     gameRoot.addChild(layer);
    //                 }
    //             } else {
    //                 if (gameRoot.bgContainerMC && baseLayer && baseLayer.parent === gameRoot.bgContainerMC) {
    //                     let baseIndex = gameRoot.bgContainerMC.getChildIndex(baseLayer);
    //                     gameRoot.bgContainerMC.addChildAt(layer, baseIndex + 1);
    //                 } else if (gameRoot.bgContainerMC) {
    //                     gameRoot.bgContainerMC.addChild(layer);
    //                 } else {
    //                     gameRoot.addChildAt(layer, 0); 
    //                 }
    //             }
                
    //             if (window.biomeLoadQueue.length === 0) window.isBiomeLoading = false;
    //         }
    //     }
    // }

    if (isGameOver) return; 
    if (!isPlaying) return; 

    worldOffsetX += speedX * dt;

    if (window.isIntro) {
        let dx = window.playerStartX - player.x;
        if (dx > 2) {
            player.x += (dx * 0.05) * dt; 
        } else {
            player.x = window.playerStartX; 
            window.isIntro = false;         
        }
    }

    if (isPlaying && !isGameOver) {
        currentEnergy -= energyDepletionRate * dt;
        if (currentEnergy <= 0) {
            currentEnergy = 0;
            speedX -= 0.05 * dt; 
        }
    }
    
    if (isDiving) inactivityFrames = 0; 
    else inactivityFrames += dt; 
    
    let distanceMeters = Math.floor(worldOffsetX / 100);

    let activeBiome = biomes[currentBiomeIndex];
    let currentLineColor = activeBiome.lineColor;
    let currentFillColor = activeBiome.fillColor;

    // --- ПАРАЛЛАКС ФОНА (Горизонтальный и Вертикальный) ---
    let bgWidth = 1920; 
    let b = {}; 
    let layers = ["sky", "cloudsBack", "mountainsMid", "mountains", "trees", "cloudsFront"];
    
    // Собираем слои только текущего биома с учетом префикса bg
    layers.forEach(key => {
        let bgKey = "bg" + key.charAt(0).toUpperCase() + key.slice(1);
        b[key] = gameRoot[key + "_" + currentBiomeIndex] || gameRoot[bgKey + "_" + currentBiomeIndex] || (currentBiomeIndex === 0 ? gameRoot[bgKey] : null);
    });

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

    // --- ОПТИМИЗАЦИЯ РЕНДЕРА ГОРЫ ---
    if (!hillShape.lastDrawX || worldOffsetX < hillShape.lastDrawX || (worldOffsetX - hillShape.lastDrawX > 1500)) {
        hillShape.lastDrawX = worldOffsetX;
        
        hillShape.clear();
        hillShape.lineStyle(4, currentLineColor, 1);
        hillShape.beginFill(currentFillColor);
        
        let drawStart = worldOffsetX - 2500; 
        let drawEnd = worldOffsetX + 7500; 
        let drawStep = 150; 
        
        for (let i = drawStart; i <= drawEnd; i += drawStep) {
            let hillY = getHillY(i); // Считаем по абсолютным координатам
            if (i === drawStart) {
                hillShape.moveTo(i, hillY);
            } else {
                hillShape.lineTo(i, hillY);
            }
        }
        hillShape.lineTo(drawEnd, 8000); 
        hillShape.lineTo(drawStart, 8000);    
        hillShape.endFill();
    }
    
    // Вместо перерисовки просто сдвигаем геометрию влево
    hillShape.x = -worldOffsetX;

    let baseGrav = (window.selectedCharID === 1) ? 0.40 : (window.selectedCharID === 3) ? 0.55 : 0.45;
    let diveGrav = (window.selectedCharID === 1) ? 2.2 : (window.selectedCharID === 3) ? 3.0 : 2.5;
    
    let currentGravity = isDiving ? diveGrav : baseGrav;
    
    velocityY += currentGravity * dt;
    player.y += velocityY * dt;

    let currentHitboxOffset = hasSled ? 85 : 50; 
    let playerBottom = player.y + currentHitboxOffset;
    let currentGroundY = getHillY(player.x + worldOffsetX); 
    let distFromGround = currentGroundY - playerBottom;

    let nextY = getHillY(player.x + worldOffsetX + 5);
    let prevY = getHillY(player.x + worldOffsetX - 5);
    let angleRad = Math.atan2(nextY - prevY, 10); 

    let targetRotation = 0;
    let justReleased = (wasDiving && !isDiving);

    if (playerAnimLock > 0) playerAnimLock -= dt; 
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
                comboCount++; 
                
                let effectiveCombo = comboCount > 5 ? 5 : comboCount; 
                speedX += (3 + (effectiveCombo * 1.5));
                
                spawnBoostFlash();
                spawnComboText(comboCount); 
                createjs.Sound.play("SfxCombo");
                
            } else {
                createjs.Sound.play("SfxLand");
                if (comboCount > 0) {
                    let speedPenalty = comboCount * 3; 
                    if (!hasSled) speedX -= speedPenalty; 
                    isComboSliding = false;
                    comboCount = 0; 
                }
                
                if (currentJumpHeight > 250) { 
                    if (!hasSled) setPlayerState("land"); 
                    playerAnimLock = 15;
                    if (!hasSled) speedX -= 5; 
                    isComboSliding = false;
                } 
            }
            currentJumpHeight = 0; 
        }

        if (isComboSliding) {
            comboAnimTimer -= dt;
            if (comboAnimTimer <= 0) isComboSliding = false; 
        }

        if (isDiving) {
            if (playerAnimLock <= 0 && !hasSled) {
                setPlayerState(isComboSliding ? "combo" : "dive"); 
            }
            if (slopeForce > 0) {
                let normalBoost = (window.selectedCharID === 2) ? 2.5 : 1.8; 
                speedX += slopeForce * (hasSled ? 3.0 : normalBoost) * dt;
            } else {
                speedX += slopeForce * (hasSled ? 1.2 : 2.5) * dt; 
            }
        } else {
         if (playerAnimLock <= 0 && !hasSled) { 
             setPlayerState("roll");
         }
            if (slopeForce > 0) {
                speedX += slopeForce * (hasSled ? 0.8 : 0.2) * dt; 
            } else {
                speedX += slopeForce * (hasSled ? 0.3 : 0.6) * dt; 
            }
            
            if (inactivityFrames > 300) {
                speedX -= (hasSled ? 0.03 : 0.15) * dt; 
            } else {
                speedX -= (hasSled ? 0.01 : 0.05) * dt; 
            }
        }

        velocityY = slopeForce * speedX; 
        
        if (justReleased && slopeForce < -0.05 && playerAnimLock <= 0) {
            let jumpBase = (window.selectedCharID === 1) ? 1.36 : 1.3; 
            let jumpMultiplier = jumpBase + (speedX * 0.02);
            
            velocityY = slopeForce * speedX * jumpMultiplier; 
            isComboSliding = false;
            
            let speedTransfer = speedX * 0.05; 
            speedX -= speedTransfer;           
            velocityY -= speedTransfer * 1.2;        

            if (velocityY < -35) velocityY = -35; 
            player.y -= 10; 
        }
        targetRotation = angleRad; // РАДИАНЫ!
    } else {
        if (distFromGround > currentJumpHeight) currentJumpHeight = distFromGround; 
        if (distFromGround > 20 && playerAnimLock <= 0) {
            if (!hasSled) setPlayerState("fly"); 
        }
        
        let airAngle = Math.atan2(velocityY, speedX);
        targetRotation = airAngle; // РАДИАНЫ!
        
        if (inactivityFrames > 300) speedX -= 0.02 * dt; 
        else speedX -= 0.01 * dt; 
    }
    
    // PixiJS работает в радианах. 180 градусов = Math.PI
    let rotationDiff = targetRotation - player.rotation;
    rotationDiff = ((rotationDiff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    player.rotation += rotationDiff * 0.2 * dt;
    
    if (speedX < minSpeedX) speedX = minSpeedX;
    if (speedX > maxSpeedX) speedX = maxSpeedX;

    wasDiving = isDiving; 
    let playerWorldX = worldOffsetX + player.x;

    // --- ДИСТАНЦИЯ 3500 (Объекты появляются на 2500px раньше, чем войдут в кадр) ---
    while (nextCoinX < worldOffsetX + 5000) {
        if (Math.abs(nextCoinX - nextSledX) < 1200) nextCoinX += 1200;
        if (Math.abs(nextCoinX - nextFishX) < 1200) nextCoinX += 1200;
        let patternType = Math.floor(Math.random() * 4); 
        let startX = nextCoinX;
        let skyHeight = 400 + Math.random() * 800; 

        if (patternType === 0) {
            let numCoins = 6 + Math.floor(Math.random() * 6);
            let spacing = 90;
            for (let i = 0; i < numCoins; i++) spawnCoin(startX + (i * spacing), getHillY(startX + (i * spacing)) - 80);
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
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) spawnCoin(startX + Math.cos(a) * 200, cy + Math.sin(a) * 200);
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) spawnCoin(startX + Math.cos(a) * 100, cy + Math.sin(a) * 100);
            spawnCoin(startX, cy); 
            nextCoinX += 3500 + Math.random() * 2000;
        }
        else {
            let cy = getHillY(startX) - skyHeight; 
            let spacing = 75;
            for (let r = 0; r < 5; r++) {
                let coinsInRow = r + 1;
                let startOffsetX = -(coinsInRow - 1) * (spacing / 2);
                for (let c = 0; c < coinsInRow; c++) spawnCoin(startX + startOffsetX + (c * spacing), cy + (r * spacing));
            }
            nextCoinX += 3500 + Math.random() * 2000;
        }
    }

    while (nextFishX < worldOffsetX + 5000) {
        let foundDownhill = false;
        for (let scanX = nextFishX; scanX < nextFishX + 2000; scanX += 40) {
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

    while (!hasSled && nextSledX < worldOffsetX + 3500) {
        spawnSled(nextSledX, getHillY(nextSledX) - 40);
        nextSledX += 24000 + Math.random() * 16000; 
    }

    for (let i = effects.length - 1; i >= 0; i--) {
        let fx = effects[i];
        if (fx.type === "comboFlash") {
            fx.shape.scale.x += 0.15 * dt;
            fx.shape.scale.y += 0.15 * dt;
            fx.shape.alpha -= 0.05 * dt;
            if (fx.shape.alpha <= 0) {
                fx.shape.visible = false;
                objPool.comboFlash.push(fx.shape);
                effects.splice(i, 1);
            }
        } 
        else if (fx.type === "comboText") {
            fx.shape.y -= 2 * dt; 
            fx.shape.alpha -= 0.03 * dt; 
            if (fx.shape.alpha <= 0) {
                fx.shape.visible = false;
                objPool.comboText.push(fx.shape);
                effects.splice(i, 1);
            }
        } 
        else {
            fx.x = fx.worldX - worldOffsetX; 
            fx.life = (fx.life || 0) + dt; 
            
            if (fx.x < -3000 || fx.life > 90 || (fx.currentFrame && fx.currentFrame >= fx.totalFrames - 2)) {
                fx.visible = false;
                if (typeof fx.stop === "function") fx.stop(); // ОСТАНОВКА АНИМАЦИИ
                if (fx.poolType === "coinFX") objPool.coinFX.push(fx);
                else if (fx.poolType === "fishFX") objPool.fishFX.push(fx);
                effects.splice(i, 1);
            }
        }
    }

    let magnetBonus = (window.selectedCharID === 2) ? 200 : 30;

    for (let i = coins.length - 1; i >= 0; i--) {
        let c = coins[i];
        c.shape.x = c.worldX - worldOffsetX;
        c.shape.y = c.worldY; 

        if (c.shape.x < -1500) {
            c.shape.visible = false;
            if (c.shape.children[0] && typeof c.shape.children[0].stop === "function") c.shape.children[0].stop(); // ОСТАНОВКА АНИМАЦИИ
            objPool.coins.push(c.shape); 
            coins.splice(i, 1);
            continue;
        }

        if (c.shape.x > 5000) {
            c.shape.visible = false;
            continue; 
        }
        
        c.shape.visible = true;

        let distX = Math.abs(c.worldX - playerWorldX);
        let distY = Math.abs(c.shape.y - player.y);

        if (!c.hit && distX < (c.hitRadius + magnetBonus) && distY < (c.hitRadius + magnetBonus)) {
            c.hit = true;
            coinsCollected++;
            createjs.Sound.play("SfxCoin"); 
            
            // Запоминаем оригинальный размер монетки
            let startScale = c.shape.scale.x;
            
            // Анимация 1: монетка летит в центр персонажа и растворяется
            addTween(c.shape, { x: player.x, y: player.y - 20, alpha: 0 }, 250, () => {
                c.shape.visible = false;
                c.shape.alpha = 1;
                c.shape.scale.set(startScale); // Восстанавливаем размер для пула
                objPool.coins.push(c.shape); 
            });
            
            // Анимация 2: монетка сжимается до нуля
            addTween(c.shape.scale, { x: 0, y: 0 }, 250);

            // Удаляем монету из активного массива, чтобы она отвязалась от трассы и полетела в Кико
            coins.splice(i, 1);
        }
    }

    for (let i = fishes.length - 1; i >= 0; i--) {
        let f = fishes[i];
        f.shape.x = f.worldX - worldOffsetX;
        f.shape.y = f.worldY; 

        if (f.shape.x < -1500) {
            f.shape.visible = false;
            if (f.shape.children[0] && typeof f.shape.children[0].stop === "function") f.shape.children[0].stop();
            objPool.fishes.push(f.shape);
            fishes.splice(i, 1);
            continue;
        }

        if (f.shape.x > 5000) {
            f.shape.visible = false;
            continue; 
        }
        
        f.shape.visible = true;

        let distX = Math.abs(f.worldX - playerWorldX);
        let distY = Math.abs(f.shape.y - player.y);

        if (!f.hit && distX < (f.hitRadius + magnetBonus) && distY < (f.hitRadius + magnetBonus)) {
            f.hit = true;
            createjs.Sound.play("SfxFish"); 
            
            currentEnergy += (window.selectedCharID === 3) ? 24 : 16; 
            if (currentEnergy > maxEnergy) currentEnergy = maxEnergy;
            
            let spawnY = f.shape.y; 
            
            f.shape.visible = false;
            if (f.shape.children[0] && typeof f.shape.children[0].stop === "function") f.shape.children[0].stop();
            objPool.fishes.push(f.shape);
            
            if (lib && lib.FishFX) {
                let fx;
                if (objPool.fishFX.length > 0) {
                    fx = objPool.fishFX.pop();
                    fx.visible = true;
                    if (typeof fx.gotoAndPlay === "function") fx.gotoAndPlay(0);
                } else {
                    fx = new lib.FishFX();
                    fx.poolType = "fishFX";
                    coinsContainer.addChild(fx);
                }
                fx.worldX = f.worldX; 
                fx.y = spawnY;
                fx.life = 0;
                effects.push(fx); 
            }
            fishes.splice(i, 1);
        }
    }

    if (hasSled) {
        sledTimer -= dt;
        
        if (activeSledInstance) {
            let sledOffsetY = 40; 
            let sledOffsetX = 0; 
            let rad = player.rotation;
            setPlayerState("sled"); 
            
            activeSledInstance.x = player.x + Math.cos(rad) * sledOffsetX - Math.sin(rad) * sledOffsetY;
            activeSledInstance.y = player.y + Math.sin(rad) * sledOffsetX + Math.cos(rad) * sledOffsetY;
            activeSledInstance.rotation = player.rotation;
        }

        if (sledTimer <= 0) {
            hasSled = false;
            nextSledX = worldOffsetX + 5000 + Math.random() * 10000;
            createjs.Sound.play("SfxSledBreak"); 
            player.y += 35; 
            
            activeSledInstance.visible = false;
            if (activeSledInstance.children[0] && typeof activeSledInstance.children[0].stop === "function") activeSledInstance.children[0].stop();
            objPool.sleds.push(activeSledInstance);
            activeSledInstance = null;
            spawnBoostFlash();
        }
    }

    for (let i = sleds.length - 1; i >= 0; i--) {
        let s = sleds[i];
        s.shape.x = s.worldX - worldOffsetX;
        s.shape.y = s.worldY; 

        if (s.shape.x < -1500) {
            s.shape.visible = false;
            if (s.shape.children[0] && typeof s.shape.children[0].stop === "function") s.shape.children[0].stop();
            objPool.sleds.push(s.shape);
            sleds.splice(i, 1);
            continue;
        }

        if (s.shape.x > 5000) {
            s.shape.visible = false;
            continue; 
        }
        
        s.shape.visible = true;

        let distX = Math.abs(s.worldX - playerWorldX);
        let distY = Math.abs(s.shape.y - player.y);

        if (!hasSled && !s.hit && distX < (s.hitRadius + 30) && distY < (s.hitRadius + 30)) {
            s.hit = true;
            hasSled = true;
            sledTimer = (window.selectedCharID === 1) ? 1200 : 900;
            speedX += 25; 
            spawnBoostFlash();
            spawnComboText("TURBO SLED!");
            createjs.Sound.play("SfxSledPickup");
            
            activeSledInstance = s.shape;
            if (cameraContainer.getChildIndex(activeSledInstance) > cameraContainer.getChildIndex(player)) {
                cameraContainer.swapChildren(activeSledInstance, player);
            }
            sleds.splice(i, 1);
            continue;
        }
    }
    
    let distanceToAvalanche = playerWorldX - avalancheWorldX;
    avalancheBaseSpeed += 0.002 * dt;
    let currentAvalancheSpeed = avalancheBaseSpeed;

    if (distanceToAvalanche > 2500) currentAvalancheSpeed = speedX + 1.5;
    else if (distanceToAvalanche < 1000) {
        currentAvalancheSpeed = speedX - 0.5; 
        if (currentAvalancheSpeed < 18) currentAvalancheSpeed = 18;
    }

    avalancheWorldX += currentAvalancheSpeed * dt; 
    if (avalanche) avalanche.x = avalancheWorldX - worldOffsetX; 
    
    if (distanceToAvalanche < 1500 && !isGameOver) {
        if (!avalancheSoundInstance) avalancheSoundInstance = createjs.Sound.play("SfxAvalanche", { loop: -1, volume: 0 });
        avalancheSoundInstance.volume = 1 - (distanceToAvalanche / 1500); 
    } else if (avalancheSoundInstance) {
        avalancheSoundInstance.stop();
        avalancheSoundInstance = null;
    }
    
    if (avalancheWorldX > playerWorldX - 80) {
        if (!isGameOver) {
            if (hasSled) {
                hasSled = false;
                nextSledX = worldOffsetX + 15000 + Math.random() * 10000;
                createjs.Sound.play("SfxSledBreak"); 
                player.y += 35;
                if (activeSledInstance && activeSledInstance.parent) activeSledInstance.parent.removeChild(activeSledInstance);
                activeSledInstance = null;
                avalancheWorldX -= 700; 
                speedX += 10; 
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

    let baseScale = window.baseGameScale || 1.0;
    let targetScale = baseScale;
    let minZoomHeight = 150; 
    
    let predictedDist = distFromGround;
    if (velocityY > 0) {
        predictedDist -= (velocityY * 10); 
        if (predictedDist < 0) predictedDist = 0;
    }
    
    if (predictedDist > minZoomHeight) {
        let excessHeight = predictedDist - minZoomHeight;
        let heightFactor = excessHeight / 1000; 
        targetScale = baseScale * (1.0 - Math.min(heightFactor, 0.6)); 
    }

    let oldScale = gameRoot.scale.x;
    let zoomSpeed = (targetScale > oldScale) 
        ? 0.015 + Math.abs(targetScale - oldScale) * 0.08 
        : 0.02 + (Math.abs(velocityY) * 0.001); 

    let currentScale = oldScale + (targetScale - oldScale) * (zoomSpeed * dt);
    gameRoot.scale.set(currentScale);
    gameRoot.x += player.x * (oldScale - currentScale);

    // Возвращаем классическую камеру: жесткий горизонт, подъем только при высоких прыжках
    let targetCameraY = gameRoot.baseY || 0; 
    let cameraFocusY = 350; 
    let scaledPlayerY = player.y * currentScale;

    if (scaledPlayerY < cameraFocusY) {
        targetCameraY = (gameRoot.baseY || 0) + (cameraFocusY - scaledPlayerY); 
    }

    gameRoot.y += (targetCameraY - gameRoot.y) * 0.1 * dt;
    
    let baseHScale = window.baseGameScale || 1.0;
    let cameraZoom = gameRoot.scale.x / baseHScale;
    let invZoom = 1 / cameraZoom;
    
    let uiListUpdate = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "pauseScreen", "gameOverScreen"];
    
    for (let i = 0; i < uiListUpdate.length; i++) {
        let el = gameRoot[uiListUpdate[i]];
        if (el && el.initY !== undefined) {
            el.scale.set(el.startScaleX * invZoom, el.startScaleY * invZoom);
            el.x = (el.startX - ((gameRoot.x - (gameRoot.baseX || 0)) / baseHScale)) * invZoom;
            el.y = (el.initY - ((gameRoot.y - (gameRoot.baseY || 0)) / baseHScale)) * invZoom;
        }
    }

    // --- ОПТИМИЗАЦИЯ ТЕКСТА (Защита от утечки текстур) ---
    // Обновляем текст только если значение реально изменилось
    if (gameRoot.txtDistance && gameRoot.txtDistance.text != distanceMeters) gameRoot.txtDistance.text = distanceMeters;
    if (gameRoot.txtCoins && gameRoot.txtCoins.text != coinsCollected) gameRoot.txtCoins.text = coinsCollected;
    if (gameRoot.txtFPS && gameRoot.txtFPS.text !== "FPS: 60") gameRoot.txtFPS.text = "FPS: 60";

    if (gameRoot.mcEnergyBar) {
        visualEnergy += (currentEnergy - visualEnergy) * 0.08 * dt; 
        let percent = Math.max(0, Math.min(1, visualEnergy / maxEnergy));
        
        // 100 кадров = от 0 до 99
        let targetFrame = Math.floor(percent * 99);
        if (typeof gameRoot.mcEnergyBar.gotoAndStop === "function") {
            gameRoot.mcEnergyBar.gotoAndStop(targetFrame);
        }
    }
}