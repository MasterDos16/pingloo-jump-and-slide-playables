// v1.7.1

let activeCharMC = null;
let player;
let ground;
let gameRoot; 
let avalanche; 
let scene; // Сохраняем ссылку на сцену Pixi

let currentBgmInstance = null;
let currentBgmName = "";
let avalancheSoundInstance = null;

let velocityY = 0;
let isDiving = false;
let wasDiving = false; 
let inactivityFrames = 0; 
let isComboSliding = false;

let comboCount = 0;

let speedX = 15; 
let minSpeedX = 10; 
let maxSpeedX = 100; 
let worldOffsetX = 0; 

let avalancheWorldX = -500; 
let avalancheBaseSpeed = 12; 
let isGameOver = false;  
let isPlaying = false; 

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

let slideParticles = [];

window.isMusicOn = true;
window.isSoundsOn = true;

// Хранилище объектов для повторного использования (пул объектов)
let objPool = {
    coins: [], fishes: [], sleds: {0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[]}, coinFX: [], fishFX: [], comboText: [], comboFlash: []
};

// Логика лавины
function colorizeAvalanche(color) {
    if (!avalanche) return;
    function tintObj(obj) {
        // Красим только видимые спрайты и векторные шейпы
        if (obj instanceof PIXI.Sprite || obj instanceof PIXI.Graphics) {
            obj.tint = color;
        }
        if (obj.children) {
            obj.children.forEach(tintObj);
        }
    }
    tintObj(avalanche);
}

function safePlayAvalanche() {
    if (!avalanche) return;
    function playObj(obj) {
        if (typeof obj.gotoAndPlay === "function") obj.gotoAndPlay(0);
        else if (typeof obj.play === "function") obj.play();
        if (obj.framerate !== undefined) obj.framerate = 60; 
        if (obj.children) obj.children.forEach(playObj);
    }
    playObj(avalanche);
}

// Энергия и рыбки
let maxEnergy = 100;
let currentEnergy = 100;
let visualEnergy = 100; 
let energyDepletionRate = 0.08;
let fishes = [];
let nextFishX = 3000; 
let comboAnimTimer = 0;

// Санки
let sleds = [];
let nextSledX = 15000; 
let hasSled = false;
let sledTimer = 0;
let activeSledInstance = null;

let cameraContainer;

// Экономика и данные игрока
let globalCoins = 0;
let unlockedBiomes = [0]; 
let biomeCosts = [0, 250, 300, 300, 800, 800, 1800, 1800]; 
let unlockedChars = [0]; 
let charCosts = [0, 600, 900, 900]; 
window.selectedCharID = 0; 
let recordDistance = 0;
let adDistanceBuffer = 0;

// Единая функция облачного сохранения для YouTube
function saveProgress() {
    let dataObj = {
        coins: globalCoins,
        biomes: unlockedBiomes,
        chars: unlockedChars,
        selectedChar: window.selectedCharID,
        record: recordDistance
    };
    if (typeof ytgame !== 'undefined' && ytgame.game) {
        ytgame.game.saveData(JSON.stringify(dataObj)).catch(() => {});
    } else {
        // Фоллбэк для локального тестирования
        try { localStorage.setItem("pinglooSave", JSON.stringify(dataObj)); } catch(e){}
    }
}

function updateGlobalUI() {
    if (gameRoot.menuScreen) {
        if (gameRoot.menuScreen.txtRecord) gameRoot.menuScreen.txtRecord.text = recordDistance;
        if (gameRoot.menuScreen.txtTotalCoins) gameRoot.menuScreen.txtTotalCoins.text = globalCoins;
    }
    if (gameRoot.menuLevelScreen && gameRoot.menuLevelScreen.txtTotalCoins) {
        gameRoot.menuLevelScreen.txtTotalCoins.text = globalCoins;
    }
    if (gameRoot.menuCharScreen && gameRoot.menuCharScreen.txtTotalCoins) {
        gameRoot.menuCharScreen.txtTotalCoins.text = globalCoins;
    }
}

// Логика биомов

let currentBiomeIndex = 0;
let biomes = [
    { id: 0, startDist: 0,    lineColor: 0xA8E8E6, fillColor: 0xFFFFFF }, 
    { id: 1, startDist: 1500, lineColor: 0x63B6E5, fillColor: 0xABEFFF }, 
    { id: 2, startDist: 3000, lineColor: 0x99D798, fillColor: 0xBCFBB2 }, 
    { id: 3, startDist: 4500, lineColor: 0xD9B558, fillColor: 0xFFE783 }, 
    { id: 4, startDist: 6000, lineColor: 0xFECB8C, fillColor: 0xFEEDB5 }, 
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

function spawnSlideParticle(px, py, color) {
    let p;
    if (objPool.slideFX && objPool.slideFX.length > 0) {
        p = objPool.slideFX.pop();
        p.visible = true;
    } else {
        p = new PIXI.Sprite(PIXI.Texture.WHITE);
        p.width = 12; p.height = 12;
        p.anchor.set(0.5);
        if (!objPool.slideFX) objPool.slideFX = [];
        window.slideParticleContainer.addChild(p);
    }
    
    p.x = px + (Math.random() * 20 - 10) - worldOffsetX;
    p.worldX = px + (Math.random() * 20 - 10);
    p.y = py;
    
    p.tint = color;
    p.alpha = 1.0;
    p.scale.set(0.8 + Math.random() * 0.6);
    
    // Частицы летят в противоположную сторону (назад и чуть вверх)
    p.vx = -speedX * 0.3 - Math.random() * 10; 
    p.vy = -2 - Math.random() * 8; 
    
    slideParticles.push(p);
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
           fontFamily: "'PinglooFont', 'Arial Rounded MT Bold', 'Comic Sans MS', sans-serif", fontSize: 40, fontWeight: "bold",
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
    if (lib && lib[libName]) {
        return new lib[libName]();
    }
    return new PIXI.Container();
}

function spawnCoin(worldX, worldY) {
    let coinObj;
    if (objPool.coins.length > 0) {
        coinObj = objPool.coins.pop();
        coinObj.visible = true;
    } else {
        coinObj = PIXI.Sprite.from("img/coin.png"); 
        coinObj.anchor.set(0.5);
    }
    
    coinObj.scale.set(1);
    coinObj.alpha = 1;
    
    if (coinObj.parent !== coinsContainer) coinsContainer.addChild(coinObj); 
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
        fishObj = new PIXI.Sprite(); 
        fishObj.anchor.set(0.5);
    }
    
    fishObj.texture = PIXI.Texture.from("img/fish_" + currentBiomeIndex + ".png");
    
    fishObj.scale.set(currentBiomeIndex === 4 ? 1.6 : 1);
    fishObj.alpha = 1;
    
    if (fishObj.parent !== coinsContainer) coinsContainer.addChild(fishObj); 
    fishObj.x = worldX - worldOffsetX; 
    fishObj.y = worldY; 
    
    let nextY = getHillY(worldX + 5);
    let prevY = getHillY(worldX - 5);
    fishObj.rotation = Math.atan2(nextY - prevY, 10); 
    fishes.push({ shape: fishObj, worldX: worldX, worldY: worldY, hitRadius: 40, hit: false });
}

function spawnSled(worldX, worldY) {
    let sledObj;
    let biomePool = objPool.sleds[currentBiomeIndex] || objPool.sleds[0];
    
    if (biomePool.length > 0) {
        sledObj = biomePool.pop();
        sledObj.visible = true;
    } else {
        let libName = "Sled_" + currentBiomeIndex;
        if (!lib || !lib[libName]) libName = "Sled_0"; // Фолбек
        sledObj = getCachedSprite(libName);
        sledObj.biomeID = currentBiomeIndex; // Запоминаем биом
        
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

function switchBiome(index) {
    currentBiomeIndex = index;

    // Палитра лавины
    let avalancheColors = [
        0xFFFFFF, // 0: Снег
        0xABEFFF, // 1: Ледник (в цвет холмов)
        0xFFFFFF, // 2: Луга
        0xFFE783, // 3: Пляж (цвет песка)
        0xFEEDB5, // 4: Подводный (иловая буря)
        0xFFFFFF, // 5: Ванная
        0xFAE08C, // 6: Пирамиды (цвет песка)
        0xAEAFCE  // 7: Космос (лунная буря)
    ];
    // Применяем цвет к лавине
    colorizeAvalanche(avalancheColors[index]);

    let layers = ["sky", "cloudsBack", "mountainsMid", "mountains", "trees", "cloudsFront"];
    
    for (let i = 0; i <= 7; i++) {
        layers.forEach(key => {
            let bgKey = "bg" + key.charAt(0).toUpperCase() + key.slice(1);
            let layer = gameRoot[key + "_" + i] || gameRoot[bgKey + "_" + i];
            
            if (layer) {
                let isTarget = (i === index);
                layer.visible = isTarget; 
                
                if (isTarget) {
                    if (typeof layer.play === "function") layer.play();
                } else {
                    if (typeof layer.stop === "function") layer.stop();
                }
                
                if (layer.initialX === undefined) {
                    layer.initialX = layer.x;
                    layer.initialY = layer.y;
                }
            }
        });
    }
}

// Движок анимаций
window.activeTweens = [];
function addTween(target, props, duration, onComplete = null, onUpdate = null) {
    let startProps = {};
    for (let key in props) startProps[key] = target[key];
    window.activeTweens.push({ target, startProps, targetProps: props, duration, time: 0, onComplete, onUpdate });
}

let screens = ["menuScreen", "menuLevelScreen", "menuCharScreen", "settingsScreen", "creditsScreen", "howToPlayScreen"];
    function showScreen(screenName) {
        screens.forEach(name => {
            if (gameRoot[name]) {
                let isTarget = (name === screenName);
                gameRoot[name].visible = isTarget;
                if (isTarget) {
            gameRoot.addChild(gameRoot[name]);
            if (typeof gameRoot[name].gotoAndPlay === "function") {
                gameRoot[name].gotoAndPlay(0);
            } else if (typeof gameRoot[name].play === "function") {
                gameRoot[name].play();
            }
        }
            }
        });
        updateGlobalUI(); 
    }

window.initGame = function(root, pixiScene) {
    gameRoot = root; 
    scene = pixiScene;

    // Загрузка облака YouTube и сохраненных данных
    function applyData(dataStr) {
        if (dataStr) {
            try {
                let data = JSON.parse(dataStr);
                globalCoins = data.coins !== undefined ? data.coins : 0;
                unlockedBiomes = data.biomes || [0];
                unlockedChars = data.chars || [0];
                window.selectedCharID = data.selectedChar || 0;
                recordDistance = data.record || 0;
            } catch(e) {}
        }
        updateGlobalUI();
    }

    if (typeof ytgame !== 'undefined' && ytgame.game) {
        ytgame.game.loadData().then(dataStr => {
            applyData(dataStr);
        }).catch(() => applyData(null));
    } else {
        let local = null;
        try { local = localStorage.getItem("pinglooSave"); } catch(e){}
        applyData(local);
    }

    let originalSoundPlay = createjs.Sound.play;
    createjs.Sound.play = function() {
        let instance = originalSoundPlay.apply(createjs.Sound, arguments);
        let srcStr = String(arguments[0]);
        
        if (!window.isMusicOn && srcStr.startsWith("Bgm")) {
            instance.paused = true;
        }
        
        if (!window.isSoundsOn && srcStr.startsWith("Sfx")) {
            instance.volume = 0;
        }
        
        if (createjs.Sound.muted) {
        }
        
        return instance;
    };

    // Внешние звуки
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
    createjs.Sound.registerSound("sounds/sfx_buy.mp3", "SfxBuy");
    createjs.Sound.registerSound("sounds/sfx_error.mp3", "SfxError");
    createjs.Sound.registerSound("sounds/sfx_countdown.mp3", "SfxCountdown");

    player = root.player;

    if (window.playerStartX === undefined) window.playerStartX = player.x;
    
    let isGoodStart = false;
    let px = window.playerStartX || 200; 
    while (!isGoodStart) {
        trackSeed = Math.random() * 100000;
        
        let y0 = getHillY(px - 100); 
        let y400 = getHillY(px + 300);  
        let y800 = getHillY(px + 700);  
        let y1200 = getHillY(px + 1100);  
        
        if (y0 < baseY - 50 &&       
            y400 > y0 + 60 &&        // Уверенный наклон вниз
            y800 > y400 + 40 &&
            y1200 > y800 + 20) {     // Мягкий выход со склона без резких стен
            isGoodStart = true; 
        }
    }
    
    ground = root.ground;
    if(ground) ground.visible = false; 

    avalanche = root.avalanche; 
    if (avalanche) {
        avalanche.visible = false;
    }

    window.stormContainer = new PIXI.Container();
    window.stormParticles = [];
    
    window.stormBackdrop = new PIXI.Sprite(PIXI.Texture.WHITE);
    window.stormBackdrop.width = 4000;
    window.stormBackdrop.height = 3000;
    window.stormBackdrop.anchor.set(1, 0.5);
    window.stormBackdrop.x = 200;
    window.stormContainer.addChild(window.stormBackdrop);

    for(let i = 0; i < 60; i++) {
        let p = new PIXI.Graphics();
        p.beginFill(0xFFFFFF);
        p.drawEllipse(0, 0, 180 + Math.random() * 100, 120 + Math.random() * 80); 
        p.endFill();
        
        p.offsetX = -1200 + Math.random() * 1400; 
        p.baseY = -800 + Math.random() * 1600; 
        
        p.alpha = 0.7 + Math.random() * 0.3;
        
        p.spinSpeed = (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.1);
        p.waveSpeed = 0.08 + Math.random() * 0.12;
        p.waveTime = Math.random() * 100;
        p.radius = 80 + Math.random() * 150;
        
        window.stormContainer.addChild(p);
        window.stormParticles.push(p);
    }

    cameraContainer = new PIXI.Container();
    coinsContainer = new PIXI.Container();
    
    window.hillContainer = new PIXI.Container();
    window.hillSlices = [];
    window.hillStrokes = [];
    
    // Создаем 160 полосок один раз
    for(let i = 0; i < 900; i++) {
        let fill = new PIXI.Sprite(PIXI.Texture.WHITE);
        fill.width = 12; // Шаг 25px + 2px нахлест
        fill.height = 2000;
        
        let stroke = new PIXI.Sprite(PIXI.Texture.WHITE);
        stroke.height = 6; // Толщина верхней линии
        stroke.anchor.set(0, 0.5); // Вращаем линию от левого края
        
        window.hillContainer.addChild(fill);
        window.hillContainer.addChild(stroke);
        
        window.hillSlices.push(fill);
        window.hillStrokes.push(stroke);
    }

    cameraContainer.addChild(player);      
    cameraContainer.addChild(window.hillContainer);
    cameraContainer.addChild(coinsContainer);

    window.slideParticleContainer = new PIXI.Container();
    cameraContainer.addChild(window.slideParticleContainer);
    cameraContainer.addChild(player);

    // Преспавн объектов для пула, чтобы не создавать их во время игры
    for (let i = 0; i < 40; i++) {
        let c = PIXI.Sprite.from("img/coin.png"); 
        c.anchor.set(0.5);
        c.visible = false;
        objPool.coins.push(c);
    }
    for (let i = 0; i < 10; i++) {
        let f = new PIXI.Sprite();
        f.anchor.set(0.5);
        f.visible = false;
        objPool.fishes.push(f);
    }

    if (avalanche) cameraContainer.addChild(avalanche);

    // Сортировка слоев: сначала фон, затем игрок, затем объекты
    root.addChild(cameraContainer);

    let allUI = ["pauseScreen", "gameOverScreen", "menuScreen", "txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    allUI.forEach(name => {
        if (root[name]) root.addChild(root[name]); 
    });

    switchBiome(window.selectedBiomeID || 0);

    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "txtSpeed"];
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
                    if (isGameOver || window.isGivingUp) return; 
                    
                    gameRoot.btnPause.visible = false; // Скрываем кнопку
                    if (window.isCountdown) return; 
                    createjs.Sound.play("SfxPause"); 
                    isPlaying = false;
                    if (currentBgmInstance) currentBgmInstance.paused = true;
                    if (player && typeof player.stop === "function") player.stop();
                    if (avalanche && typeof avalanche.stop === "function") avalanche.stop();
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
        if (typeof gameRoot.gameOverScreen.stop === "function") gameRoot.gameOverScreen.stop();
        
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

    if (cameraContainer) cameraContainer.visible = false;
    let uiListStart = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS"];
    uiListStart.forEach(name => { if (gameRoot[name]) gameRoot[name].visible = false; });

    showScreen(""); 

    let startOverlay = new PIXI.Container();
    let overlayBg = new PIXI.Graphics();
    // Фон #80C5FA (переведенный в hex 0x80C5FA)
    overlayBg.beginFill(0x80C5FA).drawRect(-2000, -2000, 6000, 6000).endFill();
    
    let style = new PIXI.TextStyle({ 
        fontFamily: "'PinglooFont', 'Arial Rounded MT Bold', 'Comic Sans MS', sans-serif",
        fontSize: 80, 
        fill: 0xFFFFFF 
    });
    let overlayTxt = new PIXI.Text("TAP TO START", style);
    overlayTxt.anchor.set(0.5);
    overlayTxt.x = 960; 
    overlayTxt.y = 540;
    
    startOverlay.addChild(overlayBg, overlayTxt);
    gameRoot.addChild(startOverlay);

    // Показываем Tap to Start
    let preloaderHTML = document.getElementById("game-preloader");
    if (preloaderHTML) {
        preloaderHTML.style.opacity = "0";
        setTimeout(() => { if (preloaderHTML.parentNode) preloaderHTML.remove(); }, 500);
    }

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
        
        if (createjs.Sound.activePlugin && createjs.Sound.activePlugin.context) {
            let ctx = createjs.Sound.activePlugin.context;
            if (ctx.state === "suspended") {
                ctx.resume().then(() => console.log("[AUDIO] Контекст успешно разблокирован!"));
            }
        }

        createjs.Sound.muted = false;
        createjs.Sound.volume = 1.0;
        
        createjs.Sound.play("SfxClick", { volume: 0.01 });

        clearInterval(pulseInterval); 
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
    // Обработка кнопок Настроек и Credits в главном меню
    if (gameRoot.menuScreen.btnSettings) {
        gameRoot.menuScreen.btnSettings.interactive = true;
        gameRoot.menuScreen.btnSettings.cursor = "pointer";
        gameRoot.menuScreen.btnSettings.on("pointerdown", () => {
            createjs.Sound.play("SfxClick");
            showScreen("settingsScreen");
        });
    }
    if (gameRoot.menuScreen.btnInfo) {
        gameRoot.menuScreen.btnInfo.interactive = true;
        gameRoot.menuScreen.btnInfo.cursor = "pointer";
        gameRoot.menuScreen.btnInfo.on("pointerdown", () => {
            createjs.Sound.play("SfxClick");
            showScreen("howToPlayScreen");
        });
    }

    // Настройки
    if (gameRoot.settingsScreen) {
        if (gameRoot.settingsScreen.btnBack) {
            gameRoot.settingsScreen.btnBack.interactive = true;
            gameRoot.settingsScreen.btnBack.cursor = "pointer";
            gameRoot.settingsScreen.btnBack.on("pointerdown", () => { 
                createjs.Sound.play("SfxClick"); 
                showScreen("menuScreen"); 
            });
        }
        
        if (gameRoot.settingsScreen.music_checkbox) {
            let mBox = gameRoot.settingsScreen.music_checkbox;
            mBox.interactive = true;
            mBox.cursor = "pointer";
            mBox.gotoAndStop(window.isMusicOn ? 0 : 1);
            mBox.on("pointerdown", () => {
                window.isMusicOn = !window.isMusicOn;
                mBox.gotoAndStop(window.isMusicOn ? 0 : 1);
                
                if (currentBgmInstance) {
                    currentBgmInstance.paused = !window.isMusicOn;
                } else if (window.isMusicOn && currentBgmName !== "") {
                    currentBgmInstance = createjs.Sound.play(currentBgmName, { loop: -1, volume: 0.5 });
                }
                
                if (window.isSoundsOn) createjs.Sound.play("SfxClick");
            });
        }

        if (gameRoot.settingsScreen.sounds_checkbox) {
            let sBox = gameRoot.settingsScreen.sounds_checkbox;
            sBox.interactive = true;
            sBox.cursor = "pointer";
            sBox.gotoAndStop(window.isSoundsOn ? 0 : 1);
            sBox.on("pointerdown", () => {
                window.isSoundsOn = !window.isSoundsOn;
                sBox.gotoAndStop(window.isSoundsOn ? 0 : 1);
                
                if (window.isSoundsOn) createjs.Sound.play("SfxClick");
            });
        }
    }

    // HOW TO PLAY
    if (gameRoot.howToPlayScreen) {
        let currentHowToPage = 0;
        let totalHowToPages = 0;
        
        while(gameRoot.howToPlayScreen["mcPage" + totalHowToPages]) {
            totalHowToPages++;
        }

        function updateHowToPage() {
            for (let i = 0; i < totalHowToPages; i++) {
                let page = gameRoot.howToPlayScreen["mcPage" + i];
                if (page) page.visible = (i === currentHowToPage);
            }
            if (gameRoot.howToPlayScreen.btnArrowLeft) {
                gameRoot.howToPlayScreen.btnArrowLeft.visible = (currentHowToPage > 0);
            }
            if (gameRoot.howToPlayScreen.btnArrowRight) {
                gameRoot.howToPlayScreen.btnArrowRight.visible = (currentHowToPage < totalHowToPages - 1);
            }
        }

        if (gameRoot.howToPlayScreen.btnArrowLeft) {
            gameRoot.howToPlayScreen.btnArrowLeft.interactive = true;
            gameRoot.howToPlayScreen.btnArrowLeft.cursor = "pointer";
            gameRoot.howToPlayScreen.btnArrowLeft.on("pointerdown", () => {
                createjs.Sound.play("SfxPage"); // Звук перелистывания
                if (currentHowToPage > 0) currentHowToPage--;
                updateHowToPage();
            });
        }

        if (gameRoot.howToPlayScreen.btnArrowRight) {
            gameRoot.howToPlayScreen.btnArrowRight.interactive = true;
            gameRoot.howToPlayScreen.btnArrowRight.cursor = "pointer";
            gameRoot.howToPlayScreen.btnArrowRight.on("pointerdown", () => {
                createjs.Sound.play("SfxPage"); // Звук перелистывания
                if (currentHowToPage < totalHowToPages - 1) currentHowToPage++;
                updateHowToPage();
            });
        }

        if (gameRoot.howToPlayScreen.btnBack) {
            gameRoot.howToPlayScreen.btnBack.interactive = true;
            gameRoot.howToPlayScreen.btnBack.cursor = "pointer";
            gameRoot.howToPlayScreen.btnBack.on("pointerdown", () => {
                createjs.Sound.play("SfxClick");
                showScreen("menuScreen");
            });
        }

        if (gameRoot.howToPlayScreen.btnCredits) {
            gameRoot.howToPlayScreen.btnCredits.interactive = true;
            gameRoot.howToPlayScreen.btnCredits.cursor = "pointer";
            gameRoot.howToPlayScreen.btnCredits.on("pointerdown", () => {
                createjs.Sound.play("SfxClick");
                showScreen("creditsScreen");
            });
        }
        
        updateHowToPage();
    }

    // CREDITS
    if (gameRoot.creditsScreen) {
        if (gameRoot.creditsScreen.btnMenu) {
            gameRoot.creditsScreen.btnMenu.interactive = true;
            gameRoot.creditsScreen.btnMenu.cursor = "pointer";
            gameRoot.creditsScreen.btnMenu.on("pointerdown", () => { 
                createjs.Sound.play("SfxClick"); 
                showScreen("menuScreen");
            });
        }
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
                createjs.Sound.play("SfxPage");
                if (currentBiomePage > 0) currentBiomePage--;
                updateBiomePage();
            });
        }
        if (gameRoot.menuLevelScreen.btnArrowRight) {
            gameRoot.menuLevelScreen.btnArrowRight.interactive = true;
            gameRoot.menuLevelScreen.btnArrowRight.cursor = "pointer";
            gameRoot.menuLevelScreen.btnArrowRight.on("pointerdown", () => {
                createjs.Sound.play("SfxPage");
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
                    if (!isUnlocked) {
                        btn.gotoAndStop(2); 
                        if (btn.txtCost) btn.txtCost.text = biomeCosts[i];
                    }
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
                } else {
                    if (globalCoins >= biomeCosts[i]) {
                        globalCoins -= biomeCosts[i];
                        unlockedBiomes.push(i);
                        saveProgress();
                        updateGlobalUI();
                        createjs.Sound.play("SfxBuy"); // УСПЕХ
                        updateBiomeUI(i);
                    } else {
                        createjs.Sound.play("SfxError"); // ОШИБКА
                        let coinTxt = gameRoot.menuLevelScreen.txtTotalCoins;
                        if (coinTxt && !coinTxt.isShaking) {
                            coinTxt.isShaking = true;
                            let startX = coinTxt.x;
                            addTween(coinTxt, { x: startX - 15 }, 40, () => {
                                addTween(coinTxt, { x: startX + 15 }, 40, () => {
                                    addTween(coinTxt, { x: startX }, 40, () => {
                                        coinTxt.isShaking = false;
                                    });
                                });
                            });
                        }
                    }
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
            saveProgress();
            
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
                    if (!unlockedChars.includes(i)) {
                    setButtonState(btn, 3);
                    if (btn.txtCost) btn.txtCost.text = charCosts[i]; // Текст ценника в символе
                }
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
                } else {
                    if (globalCoins >= charCosts[i]) {
                        globalCoins -= charCosts[i];
                        unlockedChars.push(i);
                        saveProgress();
                        updateGlobalUI();
                        createjs.Sound.play("SfxBuy"); // УСПЕХ
                        updateCharUI(i); 
                    } else {
                        createjs.Sound.play("SfxError"); // ОШИБКА
                        let coinTxt = gameRoot.menuCharScreen.txtTotalCoins;
                        if (coinTxt && !coinTxt.isShaking) {
                            coinTxt.isShaking = true;
                            let startX = coinTxt.x;
                            addTween(coinTxt, { x: startX - 15 }, 40, () => {
                                addTween(coinTxt, { x: startX + 15 }, 40, () => {
                                    addTween(coinTxt, { x: startX }, 40, () => coinTxt.isShaking = false );
                                });
                            });
                        }
                    }
                }
            });
            }
        });
        updateCharUI(window.selectedCharID);
    }

    if (gameRoot.pauseScreen) {
        gameRoot.pauseScreen.visible = false;
        if (typeof gameRoot.pauseScreen.stop === "function") gameRoot.pauseScreen.stop(); // ФИКС ЛАГА
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
            gameRoot.pauseScreen.btnMenu.removeAllListeners(); 
            gameRoot.pauseScreen.btnMenu.on("pointerdown", (e) => {
                if (e) e.stopPropagation();
                createjs.Sound.play("SfxClick");
                gameRoot.pauseScreen.visible = false;
                
                // Плавная сдача
                window.isGivingUp = true;
                isPlaying = true; 
                if (gameRoot.btnPause) gameRoot.btnPause.visible = false; 
                if (currentBgmInstance) currentBgmInstance.paused = !window.isMusicOn; 
                if (player && typeof player.play === "function") player.play(); 
                if (avalanche && typeof avalanche.play === "function") avalanche.play();
                
                if (hasSled) {
                 hasSled = false;
                 nextSledX = worldOffsetX + 30000 + Math.random() * 15000; // <--- Отодвинули далеко
                 createjs.Sound.play("SfxSledBreak");
                    player.y += 35;
                    if (activeSledInstance && activeSledInstance.parent) activeSledInstance.parent.removeChild(activeSledInstance);
                    activeSledInstance = null;
                    spawnBoostFlash();
                }
                
                let currentZoom = gameRoot.scale.x / (window.baseGameScale || 1.0);
                let targetDist = 1350 / currentZoom;
                let playerWorldX = worldOffsetX + player.x;
                
                avalancheWorldX = playerWorldX - targetDist + 200; 
                if (avalanche) {
                    avalanche.alpha = 0; 
                    addTween(avalanche, { alpha: 1 }, 400); // Проявляется за 0.4 сек
                }
            });
        }
    }
    
    // Стандартные глобальные клики
    window.addEventListener("pointerdown", () => { 
        if (isPlaying && !window.isGivingUp) isDiving = true; 
    });
    window.addEventListener("pointerup", () => isDiving = false);

    let lastW = 0, lastH = 0;

    window.orientationOverlay = new PIXI.Container();
    
    window.orientationOverlay.interactive = true; 
    
    let oriBg = new PIXI.Graphics().beginFill(0x80C5FA, 1.0).drawRect(-5000, -5000, 10000, 10000).endFill();
    
    let oriStyle = new PIXI.TextStyle({ 
        fontFamily: "'PinglooFont', 'Arial Rounded MT Bold', 'Comic Sans MS', sans-serif", 
        fontSize: 50, 
        fill: 0xFFFFFF, 
        fontWeight: "bold",
        align: "center",
        wordWrap: true,
        wordWrapWidth: 300 
    });
    let oriTxt = new PIXI.Text("PLEASE ROTATE\nYOUR DEVICE", oriStyle);
    oriTxt.anchor.set(0.5);
    window.orientationOverlay.addChild(oriBg, oriTxt);
    
    if (gameRoot.parent) gameRoot.parent.addChild(window.orientationOverlay);
    else gameRoot.addChild(window.orientationOverlay);

    window.handleResize = function() {
        let canvas = document.getElementById("stage");
        if (!canvas) return;

        let w = window.innerWidth;
        let h = window.innerHeight;

        let isPortrait = h > w;
        if (window.orientationOverlay) {
            window.orientationOverlay.visible = isPortrait;
            oriTxt.x = w / 2;
            oriTxt.y = h / 2;
            oriTxt.style.wordWrapWidth = w * 0.9; // Текст занимает не больше 90% ширины экрана
            oriTxt.style.fontSize = Math.min(w * 0.1, 70); // Размер шрифта сжимается на узких экранах
        }

        if (w === lastW && h === lastH) return;
        lastW = w; lastH = h;

        canvas.style.cssText = "position: absolute; left: 0px; top: 0px; width: 100%; height: 100%; touch-action: none; -webkit-touch-callout: none; user-select: none;";

        let scale = h / 1080;

        if (scene && scene.renderer) {
            scene.renderer.resize(w, h);
        }

        if (gameRoot) {
            window.baseGameScale = scale;
            gameRoot.scale.set(scale);
            gameRoot.rotation = 0;
            
            gameRoot.x = (w - (1920 * scale)) / 2;
            gameRoot.y = 0;
            gameRoot.baseX = gameRoot.x;
            gameRoot.baseY = 0;
        }
    };
    
    window.addEventListener("resize", window.handleResize);
    window.handleResize();

    let lastTime = performance.now();
    function browserLoop(currentTime) {
        let dt = (currentTime - lastTime) / 16.666;
        if (dt > 3) dt = 3;
        lastTime = currentTime;

        gameLoop(dt);

        requestAnimationFrame(browserLoop);
    }
    requestAnimationFrame(browserLoop);

    let preloader = document.getElementById("game-preloader");
    if (preloader) {
        preloader.style.opacity = "0"; 
        setTimeout(() => {
            if (preloader.parentNode) preloader.remove();
        }, 500);
    }

    // ИНТЕГРАЦИЯ YOUTUBE SDK
    if (typeof ytgame !== 'undefined') {
        if (ytgame.game) {
            ytgame.game.firstFrameReady(); 
            ytgame.game.gameReady();       
        }
        
        if (ytgame.system) {
            ytgame.system.onPause(() => { 
                if (isPlaying && !isGameOver && !window.isGivingUp && gameRoot.btnPause && gameRoot.btnPause.visible) {
                    gameRoot.btnPause.emit('pointerdown'); 
                } 
            });
            ytgame.system.onResume(() => {});
            if (typeof ytgame.system.isAudioEnabled === 'function') createjs.Sound.muted = !ytgame.system.isAudioEnabled();
            ytgame.system.onAudioEnabledChange((isAudioEnabled) => { createjs.Sound.muted = !isAudioEnabled; });
        }
    } else {
        createjs.Sound.muted = false;
        createjs.Sound.volume = 1.0;
        
        const unlockAudio = () => {
            if (createjs.Sound.activePlugin && createjs.Sound.activePlugin.context) {
                let ctx = createjs.Sound.activePlugin.context;
                if (ctx.state === "suspended") ctx.resume();
            }
            createjs.Sound.muted = false;
            
            document.removeEventListener("mousedown", unlockAudio, true);
            document.removeEventListener("touchstart", unlockAudio, true);
            document.removeEventListener("click", unlockAudio, true);
        };

        document.addEventListener("mousedown", unlockAudio, true);
        document.addEventListener("touchstart", unlockAudio, true);
        document.addEventListener("click", unlockAudio, true);
    }

    if (document.fonts) {
        document.fonts.ready.then(() => {
            if (window.orientationOverlay && window.orientationOverlay.children[1]) {
                window.orientationOverlay.children[1].style.fontFamily = "PinglooFont";
                window.orientationOverlay.children[1].dirty = true;
            }
            if (overlayTxt) {
                overlayTxt.style.fontFamily = "PinglooFont";
                overlayTxt.dirty = true;
            }
        });
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
        
        function safePlay(mc) {
            if (mc) {
                mc.visible = true;
                if (typeof mc.gotoAndPlay === "function") {
                    mc.gotoAndPlay(0);
                } else if (typeof mc.play === "function") {
                    mc.play();
                }
                
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
    
    let hMod = 1.0;
    if (currentBiomeIndex === 2 || currentBiomeIndex === 3 || currentBiomeIndex === 5) {
        hMod = 0.85; 
    }
    
    let wave1 = Math.sin(rx * 0.0022) * (150 * globalAmplitude * hMod); 
    let wave2 = Math.cos(rx * 0.0011) * (100 * hMod);  
    let wave3 = Math.cos(rx * 0.0033) * (30 * hMod);  
    let macroWave = Math.sin(rx * 0.00015) * (80 * hMod);
    
    let startRamp = 0;
    if (x < 3000) {
        let progress = Math.max(0, 3000 - x) / 3000;
        startRamp = progress * progress * progress * 500;
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
    if (avalanche) {
        addTween(avalanche, { x: avalanche.x + 650 }, 800, () => {
            if (typeof avalanche.stop === "function") avalanche.stop();
        });
    }

    if (currentBgmInstance) currentBgmInstance.stop();
    currentBgmName = ""; 
    if (avalancheSoundInstance) {
        avalancheSoundInstance.stop();
        avalancheSoundInstance = null;
    }
    createjs.Sound.play("SfxCrash");

    let fadeTime = 500; 
    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "txtSpeed"];
    uiList.forEach(name => {
        if (gameRoot[name]) addTween(gameRoot[name], {alpha: 0}, fadeTime);
    });

    if (gameRoot.gameOverScreen) {
        gameRoot.addChild(gameRoot.gameOverScreen); 
        gameRoot.gameOverScreen.visible = true; 

        if (gameRoot.gameOverScreen.mcNewRecord) {
            gameRoot.gameOverScreen.mcNewRecord.visible = false;
        }

        if (typeof gameRoot.gameOverScreen.gotoAndStop === "function") {
            gameRoot.gameOverScreen.gotoAndStop(0);
        }

        gameRoot.gameOverScreen.alpha = 0;
        gameRoot.gameOverScreen.y = gameRoot.gameOverScreen.initY + 100;
        addTween(gameRoot.gameOverScreen, { alpha: 1, y: gameRoot.gameOverScreen.initY }, 500);

        if (gameRoot.gameOverScreen.txtFinalDistance) {
            let distCounter = { val: 0 };
            gameRoot.gameOverScreen.txtFinalDistance.text = "0 m";
            
            addTween(distCounter, { val: finalDistance }, 2000, 
                () => { gameRoot.gameOverScreen.txtFinalDistance.text = finalDistance + " m"; }, 
                () => { gameRoot.gameOverScreen.txtFinalDistance.text = Math.floor(distCounter.val) + " m"; }
            );
        }

        if (finalDistance > recordDistance) {
            recordDistance = finalDistance; 
            if (gameRoot.gameOverScreen.mcNewRecord) {
                gameRoot.gameOverScreen.mcNewRecord.visible = true;
                if (typeof gameRoot.gameOverScreen.mcNewRecord.stop === "function") {
                    gameRoot.gameOverScreen.mcNewRecord.stop();
                }
            }
        }

        adDistanceBuffer += finalDistance;
        
        if (adDistanceBuffer >= 1500) {
            adDistanceBuffer = 0;
            
            setTimeout(() => {
                if (typeof ytgame !== 'undefined' && ytgame.ads) {
                    ytgame.ads.requestInterstitialAd().then(() => {
                    }).catch((error) => {
                    });
                }
            }, 1500); 
        }

        globalCoins += coinsCollected;
        saveProgress(); // Сохраняем в облако
        updateGlobalUI(); 

        if (typeof ytgame !== 'undefined' && ytgame.engagement) {
            ytgame.engagement.sendScore({ value: finalDistance });
        }
    }
}

function resetGame(startImmediately) {
    window.isGivingUp = false;
    window.consecutiveSleds = 0;
    if (gameRoot.pauseScreen) gameRoot.pauseScreen.visible = false;
    velocityY = 0;
    isDiving = false;
    wasDiving = false;
    inactivityFrames = 0;
    isComboSliding = false;
    comboCount = 0;
    speedX = 15;
    worldOffsetX = 0;
    avalancheWorldX = -3000; 
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
    
    window.isEnergyEmpty = false;

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

    window.activeTweens = [];

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
        let bID = sleds[i].shape.biomeID || 0;
        objPool.sleds[bID].push(sleds[i].shape);
    }
    sleds = [];
    
    nextSledX = 15000;
    hasSled = false;
    sledTimer = 0;
    
    if (activeSledInstance) {
        activeSledInstance.visible = false;
        let bID = activeSledInstance.biomeID || 0;
        objPool.sleds[bID].push(activeSledInstance);
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
    
    let uiList = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "txtSpeed"];
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

    if (gameRoot.gameOverOverlay) {
        if (gameRoot.gameOverOverlay.parent) gameRoot.gameOverOverlay.parent.removeChild(gameRoot.gameOverOverlay);
        gameRoot.gameOverOverlay = null;
    }

    isTransitioning = false;
    transitionProgress = 0;
    switchBiome(window.selectedBiomeID);

    if (player) {
        if (player.kiko_mc) { player.kiko_mc.visible = false; if (typeof player.kiko_mc.stop === "function") player.kiko_mc.stop(); }
    if (player.lulu_mc) { player.lulu_mc.visible = false; if (typeof player.lulu_mc.stop === "function") player.lulu_mc.stop(); }
    if (player.papi_mc) { player.papi_mc.visible = false; if (typeof player.papi_mc.stop === "function") player.papi_mc.stop(); }
    if (player.momi_mc) { player.momi_mc.visible = false; if (typeof player.momi_mc.stop === "function") player.momi_mc.stop(); }

        if (window.selectedCharID === 0) activeCharMC = player.kiko_mc;
        if (window.selectedCharID === 1) activeCharMC = player.lulu_mc;
        if (window.selectedCharID === 3) activeCharMC = player.papi_mc;
        if (window.selectedCharID === 2) activeCharMC = player.momi_mc;
        
        if (!activeCharMC) activeCharMC = player.kiko_mc; 
        activeCharMC.visible = true;

        if (startImmediately) {
            playMusic("BgmGame"); 
            window.isIntro = true;
            
            player.x = -250; 
            player.y = getHillY(worldOffsetX + player.x); 
            
            velocityY = -15; 
            speedX = 35; 
            
            setPlayerState("fly");
            
            if (avalanche) {
                avalanche.x = -3000;
                avalanche.visible = false;
                avalanche.alpha = 1;
                safePlayAvalanche();
            }
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
        avalanche.alpha = 1;
    }

    if (window.baseGameScale) {
        gameRoot.scale.set(window.baseGameScale);
        gameRoot.x = gameRoot.baseX || 0;
        gameRoot.y = gameRoot.baseY || 0;
    } else {
        gameRoot.scale.set(1);
        gameRoot.x = 0;
        gameRoot.y = 0;
    }

    let uiListUpdate = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "txtSpeed", "pauseScreen", "gameOverScreen"];
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
        if (typeof gameRoot.gameOverScreen.gotoAndStop === "function") {
            gameRoot.gameOverScreen.gotoAndStop(0);
        }
    }

    if (!startImmediately) {
        showScreen("menuScreen");
        
        let layers = ["sky", "cloudsBack", "mountainsMid", "mountains", "trees", "cloudsFront"];
        layers.forEach(key => {
            let bgKey = "bg" + key.charAt(0).toUpperCase() + key.slice(1);
            let layer = gameRoot[key + "_" + currentBiomeIndex] || gameRoot[bgKey + "_" + currentBiomeIndex];
            if (layer) {
                if (layer.initialX !== undefined) layer.x = layer.initialX;
                if (layer.initialY !== undefined) layer.y = layer.initialY;
            }
        });
    }
}

function resumeWithCountdown() {
    if (gameRoot.pauseScreen) gameRoot.pauseScreen.visible = false;

    let count = 3;
    let style = new PIXI.TextStyle({
        fontFamily: "'PinglooFont', 'Arial Rounded MT Bold', 'Comic Sans MS', sans-serif", fontSize: 150, fontWeight: "bold",
        fill: 0xFFD700, stroke: 0xFF4500, strokeThickness: 8, dropShadow: true
    });
    let txt = new PIXI.Text(count, style);
    txt.anchor.set(0.5);
    
    txt.x = window.innerWidth / 2;
    txt.y = window.innerHeight / 2;
    
    if (gameRoot.parent) gameRoot.parent.addChild(txt); 
    else gameRoot.addChild(txt); 
    createjs.Sound.play("SfxCountdown");

    function animateNumber() {
        if (count > 0) {
            txt.text = count;
            txt.alpha = 1; 
            txt.scale.set(0.1); 

            addTween(txt.scale, {x: 1, y: 1}, 300, () => {
                setTimeout(() => {
                    addTween(txt, {alpha: 0}, 200, () => {
                        count--;
                        animateNumber(); 
                    });
                    addTween(txt.scale, {x: 1.5, y: 1.5}, 200);
                }, 200);
            });
        } else {
            if (txt.parent) txt.parent.removeChild(txt);
            window.isCountdown = false; 
            isPlaying = true; 
            if (gameRoot.btnPause) gameRoot.btnPause.visible = true; 
            if (currentBgmInstance) currentBgmInstance.paused = !window.isMusicOn;
            if (player && typeof player.play === "function") player.play(); 
            if (avalanche && typeof avalanche.play === "function") avalanche.play();
        }
    }
    animateNumber();
}

function gameLoop(dt) {
    // Обработка анимаций
    for (let i = window.activeTweens.length - 1; i >= 0; i--) {
        let tw = window.activeTweens[i];
        tw.time += dt * 16.666; 
        let progress = Math.min(tw.time / tw.duration, 1);
        for (let prop in tw.targetProps) {
            tw.target[prop] = tw.startProps[prop] + (tw.targetProps[prop] - tw.startProps[prop]) * progress;
        }
        if (tw.onUpdate) tw.onUpdate();
        if (progress >= 1) {
            if (tw.onComplete) tw.onComplete();
            window.activeTweens.splice(i, 1);
        }
    }

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
        if (hasSled) {
            // На санках энергия не тратится
        } else {
            let currentRate = energyDepletionRate;
            
            if (speedX < 10) {
                currentRate *= 2.0; 
            } else if (speedX < 25) {
                currentRate *= 1.2; 
            } else if (speedX < 40) {
                currentRate *= 1.0; 
            } else if (speedX < 65) {
                currentRate *= 0.4; 
            } else {
                currentRate = 0; 
            }

            if (currentBiomeIndex === 2) currentRate *= 0.7;
            
            if (!window.isEnergyEmpty) {
                currentEnergy -= currentRate * dt;
            }
            
            if (currentEnergy <= 0) {
                currentEnergy = 0;
                window.isEnergyEmpty = true;
            } else {
                window.isEnergyEmpty = false;
            }
        }
        
        if (window.isEnergyEmpty) {
            speedX -= 0.05 * dt; 
            if (speedX < 10) speedX = 10;
        }
    }
    
    if (isDiving) inactivityFrames = 0; 
    else inactivityFrames += dt; 
    
    let distanceMeters = Math.floor(worldOffsetX / 100);

    let activeBiome = biomes[currentBiomeIndex];
    let currentLineColor = activeBiome.lineColor;
    let currentFillColor = activeBiome.fillColor;

    // Параллаксы фона
    let bgWidth = 1920; 
    let b = {}; 
    let layers = ["sky", "cloudsBack", "mountainsMid", "mountains", "trees", "cloudsFront"];
    
    layers.forEach(key => {
        let bgKey = "bg" + key.charAt(0).toUpperCase() + key.slice(1);
        b[key] = gameRoot[key + "_" + currentBiomeIndex] || gameRoot[bgKey + "_" + currentBiomeIndex];
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

    let step = 10; 
    let startX = worldOffsetX - (worldOffsetX % step) - 2000;

    for(let i = 0; i < window.hillSlices.length; i++) {
        let px = startX + (i * step);
        let py = getHillY(px);
        let nextY = getHillY(px + step);
        
        let fill = window.hillSlices[i];
        fill.x = px - worldOffsetX;
        fill.y = py;
        fill.tint = currentFillColor;
        
        let stroke = window.hillStrokes[i];
        stroke.x = fill.x;
        stroke.y = py;
        stroke.tint = currentLineColor;
        
        stroke.rotation = Math.atan2(nextY - py, step);
        stroke.width = Math.sqrt(step * step + (nextY - py) * (nextY - py)) + 2; 
    }

    let baseGrav = (window.selectedCharID === 1) ? 0.35 : (window.selectedCharID === 3) ? 0.60 : 0.45;
    let diveGrav = (window.selectedCharID === 1) ? 2.0 : (window.selectedCharID === 3) ? 3.5 : 2.5;
    
    let currentGravity = isDiving ? diveGrav : baseGrav;

    if (currentBiomeIndex === 7) currentGravity *= 0.65;
    
    velocityY += currentGravity * dt;
    
    player.y += velocityY * dt;

    if (player.y < -600 && velocityY < 0) {
        let altitudeFactor = (Math.abs(player.y) - 600) / 400; 
        if (altitudeFactor > 1) altitudeFactor = 1;
        
        // Рассчет арки прыжка
        let progressiveGravity = 2.5 * (altitudeFactor * altitudeFactor); 
        
        velocityY += progressiveGravity * dt;
    }

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

        if (!hasSled && speedX > 5 && slopeForce > -0.2) {
            spawnSlideParticle(player.x + worldOffsetX - 20, player.y + 45, currentLineColor);
            if (Math.random() > 0.5) spawnSlideParticle(player.x + worldOffsetX - 10, player.y + 50, currentLineColor);
        }

        if (speedX > 45 && Math.random() > 0.4) {
            let line = new PIXI.Graphics();
            line.beginFill(0xFFFFFF).drawRect(0, 0, 150 + Math.random() * 200, 2 + Math.random() * 3).endFill();
            line.x = player.x + 800 + Math.random() * 500; 
            line.y = player.y + (Math.random() * 400 - 200);
            line.alpha = 0.4 + Math.random() * 0.3;
            cameraContainer.addChildAt(line, cameraContainer.getChildIndex(player)); 
            effects.push({ shape: line, type: "speedLine", life: 0 });
        }
        
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
                if (currentJumpHeight > 60) {
                    createjs.Sound.play("SfxLand");
                }
                
                let speedPenalty = 0;
                
                if (slopeForce < 0) {
                    // Увеличил множитель комбо-штрафа с 1.5 до 3.5
                    speedPenalty = 2 + (Math.abs(slopeForce) * 8); 
                    if (comboCount > 0) speedPenalty += (comboCount * 3.5);
                    isComboSliding = false;
                    comboCount = 0; 
                } else {
                    speedPenalty = 1;
                    isComboSliding = false;
                    comboCount = 0; 
                }
                
                if (!hasSled) speedX -= speedPenalty; 
                
                if (currentJumpHeight > 250) { 
                    if (!hasSled) setPlayerState("land"); 
                    playerAnimLock = 15;
                    if (!hasSled) speedX -= (slopeForce < 0 ? 5 : 1); // Мягче штраф за высоту на спуске
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
            if (playerAnimLock <= 0 && !hasSled) setPlayerState(isComboSliding ? "combo" : "dive");
            if (slopeForce > 0) {
                let normalBoost = (window.selectedCharID === 3) ? 2.2 : (window.selectedCharID === 2) ? 1.85 : 1.8;
                speedX += slopeForce * (hasSled ? 3.0 : normalBoost) * dt;
            } else {
                if (!hasSled && slopeForce < -0.2) {
                    speedX -= 1.5 * dt;
                } else {
                    speedX += slopeForce * (hasSled ? 1.2 : 2.5) * dt;
                }
            }
        } else {
         if (playerAnimLock <= 0 && !hasSled) { 
             setPlayerState(window.isGivingUp ? "dive" : "roll");
         }
            if (slopeForce > 0) {
                speedX += slopeForce * (hasSled ? 0.8 : 0.2) * dt; 
            } else {
                speedX += slopeForce * (hasSled ? 0.3 : 0.6) * dt; 
            }
            
            let airFriction = speedX * 0.003; 
            
            if (inactivityFrames > 300) {
                speedX -= (hasSled ? airFriction * 0.5 : airFriction * 2.5) * dt; 
            } else {
                speedX -= (hasSled ? airFriction * 0.2 : airFriction) * dt; 
            }
        }

        velocityY = slopeForce * speedX; 
        
        if (justReleased && slopeForce < -0.05 && playerAnimLock <= 0) {
            let jumpBase = (window.selectedCharID === 1) ? 1.36 : 1.3; 
            let jumpMultiplier = jumpBase + (speedX * 0.02);
            
            velocityY = slopeForce * speedX * jumpMultiplier; 
            isComboSliding = false;
            
            let speedTransfer = speedX * 0.01; 
            speedX -= speedTransfer;           
            velocityY -= speedTransfer * 1.2;        

            if (velocityY < -35) velocityY = -35; 
            player.y -= 10; 
        }
        targetRotation = angleRad;
    } else {
        if (distFromGround > currentJumpHeight) currentJumpHeight = distFromGround; 
        if (distFromGround > 20 && playerAnimLock <= 0) {
            if (!hasSled) setPlayerState("fly"); 
        }
        
        let airAngle = Math.atan2(velocityY, speedX);
        targetRotation = airAngle;
        
        if (inactivityFrames > 300) speedX -= 0.02 * dt; 
        else speedX -= 0.01 * dt; 
    }
    
    let rotationDiff = targetRotation - player.rotation;
    rotationDiff = ((rotationDiff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    player.rotation += rotationDiff * 0.2 * dt;
    
    if (window.isGivingUp) {
        speedX -= 0.3 * dt;
        if (speedX < 0) speedX = 0;
    } else {
        if (speedX < minSpeedX) speedX = minSpeedX; 
    }
    if (speedX > maxSpeedX) speedX = maxSpeedX;

    wasDiving = isDiving; 
    let playerWorldX = worldOffsetX + player.x;

    // ПУЗЫРЬКИ ИЗО РТА В ВОДЕ (С ритмом дыхания)
    let isBreathingPhase = Math.sin(worldOffsetX * 0.003) > 0;

    if (currentBiomeIndex === 4 && isBreathingPhase && Math.random() > 0.6) {
        let bub = new PIXI.Graphics();
        bub.beginFill(0xFFFFFF).drawCircle(0,0, 3 + Math.random()*4).endFill();
        
        bub.x = player.x + Math.cos(player.rotation) * 60 - Math.sin(player.rotation) * -20; 
        bub.y = player.y + Math.sin(player.rotation) * 60 + Math.cos(player.rotation) * -20;
        bub.alpha = 0.6;
        
        cameraContainer.addChild(bub);
        effects.push({ shape: bub, type: "bubble", life: 0 });
    }

    while (nextCoinX < worldOffsetX + 5000) {
        if (Math.abs(nextCoinX - nextSledX) < 1200) nextCoinX += 1200;
        if (Math.abs(nextCoinX - nextFishX) < 1500) nextCoinX += 1500;
        
        let patternType = Math.floor(Math.random() * 4); 
        
        if (currentBiomeIndex === 6) patternType = (Math.random() > 0.5) ? 0 : 3;
        
        let startX = nextCoinX;
        let skyHeight = 400 + Math.random() * 800; 

        if (patternType === 0) {
            let numCoins = 6 + Math.floor(Math.random() * 6);
            // Цепочки на земле в 2 раза длиннее
            if (currentBiomeIndex === 6) numCoins = 15 + Math.floor(Math.random() * 10); 
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
            if (currentBiomeIndex === 7) nextCoinX += 3500;
        }
    }

    if (hasSled) {
        nextFishX = worldOffsetX + 5000; 
    } else {
        if (currentEnergy > 75) {
            if (nextFishX < worldOffsetX + 5000) nextFishX = worldOffsetX + 5000;
        } else {
            while (nextFishX < worldOffsetX + 5000) {
                let foundDownhill = false;
                for (let scanX = nextFishX; scanX < nextFishX + 2000; scanX += 40) {
                    if (Math.abs(scanX - nextSledX) < 1500) continue;
                    if (Math.abs(scanX - nextCoinX) < 1500) continue; 
                    
                    let nextY = getHillY(scanX + 10);
                    let prevY = getHillY(scanX - 10);
                    
                    let isValidSpawn = (currentBiomeIndex === 4) ? true : (nextY - prevY > 4);
                    
                    if (isValidSpawn) {
                        let fishCount = (currentBiomeIndex === 3) ? 3 : 1;
                        let fishSpacing = 350;
                        
                        for (let k = 0; k < fishCount; k++) {
                            let currentFishX = scanX + k * fishSpacing;
                            
                            let fishY = (currentBiomeIndex === 4) 
                                ? getHillY(currentFishX) - 300 - Math.random() * 200
                                : getHillY(currentFishX) - 80;
                            
                            spawnFish(currentFishX, fishY); 
                        }
                        
                        let baseDist = 4000 + Math.random() * 3000;
                        if (currentBiomeIndex === 2) baseDist *= 1.5; 
                        else if (currentBiomeIndex === 4) baseDist *= 0.25; 
                        
                        nextFishX = scanX + baseDist; 
                        
                        foundDownhill = true;
                        break;
                    }
                }
                if (!foundDownhill) nextFishX += 2000; 
            }
        }
    }

    while (!hasSled && nextSledX < worldOffsetX + 6000) {
        spawnSled(nextSledX, getHillY(nextSledX));
        nextSledX += 30000 + Math.random() * 15000; 
    }

    // Частицы скольжения
    for (let i = slideParticles.length - 1; i >= 0; i--) {
        let p = slideParticles[i];
        p.x = p.worldX - worldOffsetX;
        p.worldX += p.vx * dt; 
        p.y += p.vy * dt;     
        
        p.alpha -= 0.02 * dt;  
        p.scale.x -= 0.01 * dt;
        p.scale.y -= 0.01 * dt;
        
        if (p.alpha <= 0 || p.scale.x <= 0) {
            p.visible = false;
            objPool.slideFX.push(p);
            slideParticles.splice(i, 1);
        }
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
        else if (fx.type === "bubble") {
            fx.shape.x -= (3 + Math.random() * 3) * dt; 
            fx.shape.y -= (2 + Math.random() * 2) * dt; 
            
            fx.shape.x += Math.sin(fx.life * 0.15) * 2;

            fx.life += dt;
            if (fx.life > 60) fx.shape.alpha -= 0.05 * dt;
            
            if (fx.shape.alpha <= 0 || fx.shape.x < -100) {
                if (fx.shape.parent) fx.shape.parent.removeChild(fx.shape);
                effects.splice(i, 1);
            }
        }
        else if (fx.type === "speedLine") {
            fx.shape.x -= (speedX * 0.8 + 20) * dt; 
            fx.shape.scale.x -= 0.01 * dt; 
            if (fx.shape.scale.x <= 0 || fx.shape.x < player.x - 1200) {
                if (fx.shape.parent) fx.shape.parent.removeChild(fx.shape);
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

    let baseMagnet = (window.selectedCharID === 2) ? 280 : 35; 
    let coinMagnetBonus = (window.selectedCharID === 2) ? 150 : 35; 
    let fishHitRadius = (currentBiomeIndex === 4) ? 200 : 100;

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

        if (!c.hit && distX < (c.hitRadius + coinMagnetBonus) && distY < (c.hitRadius + coinMagnetBonus)) {
            c.hit = true;
            coinsCollected++;
            createjs.Sound.play("SfxCoin"); 
            
            let startScale = c.shape.scale.x;
            
            addTween(c.shape, { x: player.x, y: player.y - 20, alpha: 0 }, 250, () => {
                c.shape.visible = false;
                c.shape.alpha = 1;
                c.shape.scale.set(startScale);
                objPool.coins.push(c.shape); 
            });
            
            addTween(c.shape.scale, { x: 0, y: 0 }, 250);

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

        if (!f.hit && distX < fishHitRadius && distY < fishHitRadius) {
            f.hit = true;
            createjs.Sound.play("SfxFish"); 
            
            currentEnergy += (window.selectedCharID === 3) ? 30 : 16;
            if (currentEnergy > maxEnergy) currentEnergy = maxEnergy;
            
            let startScale = f.shape.scale.x;
            addTween(f.shape, { x: player.x, y: player.y - 20, alpha: 0 }, 250, () => {
                f.shape.visible = false;
                f.shape.alpha = 1;
                f.shape.scale.set(startScale);
                objPool.fishes.push(f.shape);
            });
            addTween(f.shape.scale, { x: 0, y: 0 }, 250);
            
            fishes.splice(i, 1);
        }
    }

    if (hasSled) {
        sledTimer -= dt;
        
        if (activeSledInstance) {
            let sledOffsetY = 85;
            let sledOffsetX = 0; 
            let rad = player.rotation;
            setPlayerState("sled"); 
            
            activeSledInstance.x = player.x + Math.cos(rad) * sledOffsetX - Math.sin(rad) * sledOffsetY;
            activeSledInstance.y = player.y + Math.sin(rad) * sledOffsetX + Math.cos(rad) * sledOffsetY;
            activeSledInstance.rotation = player.rotation;
        }

        if (sledTimer <= 0) {
            hasSled = false;
            
            if (Math.random() < 0.25 && window.consecutiveSleds < 1) {
                nextSledX = worldOffsetX + 3000 + Math.random() * 3000;
                window.consecutiveSleds++;
            } else {
                nextSledX = worldOffsetX + 30000 + Math.random() * 15000;
                window.consecutiveSleds = 0;
            }

            createjs.Sound.play("SfxSledBreak"); 
            player.y += 35; 
            
            activeSledInstance.visible = false;
            if (activeSledInstance.children[0] && typeof activeSledInstance.children[0].stop === "function") activeSledInstance.children[0].stop();
            let bID = activeSledInstance.biomeID || 0;
            objPool.sleds[bID].push(activeSledInstance);
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
            let bID = s.shape.biomeID || 0;
            objPool.sleds[bID].push(s.shape);
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

    if (!window.isIntro) {
        let distanceToAvalanche = playerWorldX - avalancheWorldX;
        
        avalancheBaseSpeed += 0.001 * dt;
        if (avalancheBaseSpeed > 32) avalancheBaseSpeed = 32; 
        
        let currentAvalancheSpeed = avalancheBaseSpeed;

        let currentZoom = gameRoot.scale.x / (window.baseGameScale || 1.0);
        let targetDist = 1350 / currentZoom;

        if (speedX <= 20 && !window.isGivingUp) {
            if (distanceToAvalanche > targetDist) {
                avalancheWorldX = playerWorldX - targetDist; 
            }
            currentAvalancheSpeed = 15; 
        } else {
            currentAvalancheSpeed = window.isGivingUp ? 45 : avalancheBaseSpeed;
        }

        avalancheWorldX += currentAvalancheSpeed * dt; 
        distanceToAvalanche = playerWorldX - avalancheWorldX;
        
        if (avalanche) {
            avalanche.x = avalancheWorldX - worldOffsetX; 
            avalanche.visible = (distanceToAvalanche < targetDist + 500);
        }
        
        // Звук лавины и конец игры при столкновении
        if (distanceToAvalanche < 1500 && !isGameOver) {
            if (!avalancheSoundInstance) avalancheSoundInstance = createjs.Sound.play("SfxAvalanche", { loop: -1, volume: 0 });
            if (window.isSoundsOn) {
                let vol = 1 - (distanceToAvalanche / 1500);
                avalancheSoundInstance.volume = (vol < 0) ? 0 : vol; 
            } else {
                avalancheSoundInstance.volume = 0;
            }
        } else if (avalancheSoundInstance) {
            avalancheSoundInstance.stop();
            avalancheSoundInstance = null;
        }
        
        if (distanceToAvalanche < 80) {
            if (!isGameOver) {
                if (hasSled) {
                    hasSled = false;
                    nextSledX = worldOffsetX + 30000 + Math.random() * 15000;
                    createjs.Sound.play("SfxSledBreak"); 
                    player.y += 35;
                    if (activeSledInstance && activeSledInstance.parent) activeSledInstance.parent.removeChild(activeSledInstance);
                    activeSledInstance = null;
                    
                    avalancheWorldX -= 800; 
                    speedX += 12; 
                    spawnBoostFlash();
                } else {
                    isGameOver = true;
                    let finalDist = Math.floor(worldOffsetX / 100);
                    triggerGameOver(finalDist);
                }
            }
        }
    } else {
        if (avalanche) avalanche.visible = false;
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

        // Проверяем мобильное устройство
        let isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        let maxZoomOut = isMobile ? 0.42 : 0.6;

        targetScale = baseScale * (1.0 - Math.min(heightFactor, maxZoomOut)); 
    }

    let oldScale = gameRoot.scale.x;
    let zoomSpeed = (targetScale > oldScale) 
        ? 0.015 + Math.abs(targetScale - oldScale) * 0.08 
        : 0.02 + (Math.abs(velocityY) * 0.001); 

    let currentScale = oldScale + (targetScale - oldScale) * (zoomSpeed * dt);
    gameRoot.scale.set(currentScale);
    gameRoot.x += player.x * (oldScale - currentScale);

    let targetCameraY = gameRoot.baseY || 0; 
    let cameraFocusY = 350; 

    if (player.y < cameraFocusY) {
        targetCameraY = (gameRoot.baseY || 0) + (cameraFocusY - player.y) * currentScale; 
    }

    if (targetCameraY > (gameRoot.baseY || 0) + 800) {
        targetCameraY = (gameRoot.baseY || 0) + 800;
    }

    gameRoot.y += (targetCameraY - gameRoot.y) * 0.1 * dt;
    
    let baseHScale = window.baseGameScale || 1.0;
    let cameraZoom = gameRoot.scale.x / baseHScale;
    let invZoom = 1 / cameraZoom;
    
    let uiListUpdate = ["txtDistance", "txtCoins", "btnPause", "mcEnergyBar", "iconCoin", "iconDistance", "txtFPS", "txtSpeed", "pauseScreen", "gameOverScreen"];
    
    for (let i = 0; i < uiListUpdate.length; i++) {
        let el = gameRoot[uiListUpdate[i]];
        if (el && el.initY !== undefined) {
            el.scale.set(el.startScaleX * invZoom, el.startScaleY * invZoom);
            el.x = (el.startX - ((gameRoot.x - (gameRoot.baseX || 0)) / baseHScale)) * invZoom;
            el.y = (el.initY - ((gameRoot.y - (gameRoot.baseY || 0)) / baseHScale)) * invZoom;
        }
    }

    let displayDist = distanceMeters - (distanceMeters % 5);
    if (gameRoot.txtDistance && gameRoot.txtDistance.text != displayDist) gameRoot.txtDistance.text = displayDist;
    if (gameRoot.txtCoins && gameRoot.txtCoins.text != coinsCollected) gameRoot.txtCoins.text = coinsCollected;

    if (gameRoot.mcEnergyBar) {
        visualEnergy += (currentEnergy - visualEnergy) * 0.08 * dt; 
        let percent = Math.max(0, Math.min(1, visualEnergy / maxEnergy));
        
        let targetFrame = Math.floor(percent * 99);
        if (typeof gameRoot.mcEnergyBar.gotoAndStop === "function") {
            gameRoot.mcEnergyBar.gotoAndStop(targetFrame);
        }
        
        if (percent < 0.20 && currentEnergy > 0 && !window.isEnergyEmpty) {
            gameRoot.mcEnergyBar.alpha = 0.1 + Math.abs(Math.sin(performance.now() * 0.015)) * 0.9;
        } else {
            gameRoot.mcEnergyBar.alpha = 1;
        }
    }
}