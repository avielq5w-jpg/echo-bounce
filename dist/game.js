/**
 * Echo Bounce - Phase 12: Major UX Refinement, Void Portal & Audio/Haptics
 */

// ===== Audio & Haptic Manager =====
class AudioManager {
    constructor() {
        this.ctx = null;
        this._ready = false;
    }

    // Must be called on a user gesture to unlock Web Audio
    unlock() {
        if (this._ready) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this._ready = true;
        } catch (e) { /* no audio support */ }
    }

    _tone(freq, endFreq, duration, type = 'sine', vol = 0.12, delay = 0) {
        if (!this._ready || !this.ctx) return;
        try {
            const t0 = this.ctx.currentTime + delay;
            const osc  = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t0);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
            gain.gain.setValueAtTime(vol, t0);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
            osc.start(t0);
            osc.stop(t0 + duration);
        } catch (e) {}
    }

    playBounce()      { this._tone(260, 130, 0.1,  'triangle', 0.07); }
    playPulse()       { this._tone(880, 440, 0.09, 'sine',     0.06); }
    playPortalEntry() {
        this._tone(440, 1200, 0.55, 'sine', 0.16);
        this._tone(660, 1800, 0.4,  'sine', 0.10, 0.08);
    }
    playDeath() {
        this._tone(180, 90, 0.12, 'sawtooth', 0.12);
        this._tone(120, 60, 0.22, 'sawtooth', 0.07, 0.1);
    }
    playLevelClear() {
        [523, 659, 784, 1047].forEach((f, i) =>
            this._tone(f, f * 1.1, 0.14, 'sine', 0.1, i * 0.09)
        );
    }
}

const Audio = new AudioManager();

// Haptic helper
function haptic(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {}
}

// --- Constants & Config ---
const CONFIG = {
    GRAVITY: 900,               // Gravity strength (px/s^2)
    IMPULSE_MAGNITUDE: 550,     // Impulse speed added per tap (px/s)
    ORB_RADIUS: 14,             // Radius of player light orb
    RESTITUTION: 0.82,          // Bounce energy preservation (82%)
    AIR_FRICTION: 0.996,        // Air resistance per frame
    MAX_VELOCITY: 1400,         // Velocity cap (px/s)
    PULSE_COOLDOWN: 2.0,        // Manual radar pulse cooldown (seconds)
    COLOR_CYAN: '#00f3ff',
    COLOR_PINK: '#ff007f',
    COLOR_GOLD: '#ffe600',
    COLOR_GREEN: '#00ff88',
    COLOR_PURPLE: '#a100ff',
    COLOR_RED: '#ff2a2a'
};

// Skin Glow Color Mapping
const SKINS = {
    cyan: '#00f3ff',
    gold: '#ffe600',
    pink: '#ff007f',
    green: '#00ff88',
    purple: '#a100ff'
};

// 3-Star Rating Target Thresholds per Level { time: maxSec, bounces: maxBounces }
const LEVEL_TARGETS = {
    1:  { time: 8.0,  bounces: 6 },
    2:  { time: 10.0, bounces: 8 },
    3:  { time: 12.0, bounces: 10 },
    4:  { time: 14.0, bounces: 12 },
    5:  { time: 15.0, bounces: 14 },
    6:  { time: 12.0, bounces: 10 },
    7:  { time: 14.0, bounces: 12 },
    8:  { time: 15.0, bounces: 13 },
    9:  { time: 16.0, bounces: 15 },
    10: { time: 18.0, bounces: 16 },
    11: { time: 14.0, bounces: 12 },
    12: { time: 16.0, bounces: 14 },
    13: { time: 18.0, bounces: 16 },
    14: { time: 20.0, bounces: 18 },
    15: { time: 22.0, bounces: 20 }
};

function calculateStars(levelIndex, timeSec, bounces) {
    const lvlNum = levelIndex + 1;
    const target = LEVEL_TARGETS[lvlNum] || { time: 15.0, bounces: 12 };
    let stars = 1; // 1 Star for completing
    if (timeSec <= target.time) stars++;
    if (bounces <= target.bounces) stars++;
    return stars;
}

function getStarsString(count) {
    if (!count || count <= 0) return '☆☆☆';
    if (count === 1) return '⭐☆☆';
    if (count === 2) return '⭐⭐☆';
    return '⭐⭐⭐';
}

// Language cycle order & display labels
const LANG_ORDER = ['en', 'he', 'es', 'fr', 'ja'];
const LANG_LABELS = { en: '🇬🇧 EN', he: '🇮🇱 HE', es: '🇪🇸 ES', fr: '🇫🇷 FR', ja: '🇯🇵 JA' };

const TRANSLATIONS = {
    en: {
        langCode: "EN",
        langLabel: "🇬🇧 EN",
        heroSubtitle: "NAVIGATE THE DARKNESS",
        menuPlay: "PLAY GAME",
        menuLevels: "LEVEL SELECT",
        menuProfile: "PROFILE & SKINS",
        menuTutorial: "HOW TO PLAY",
        levelSelectTitle: "LEVEL SELECT",
        levelSelectSub: "Select an unlocked labyrinth level",
        world1Title: "WORLD 1: CYBER NEON",
        world2Title: "WORLD 2: EMERALD ABYSS",
        world3Title: "WORLD 3: SOLAR CORE",
        btnBack: "BACK TO MENU",
        tutorialTitle: "HOW TO PLAY",
        tutorialSub: "Master the bouncing light orb",
        tutCard1Title: "Tap to Boost",
        tutCard1Desc: "Single tap anywhere on the canvas to propel your glowing orb in that direction.",
        tutCard2Title: "Echo Sonar",
        tutCard2Desc: "Walls are invisible in darkness! Impacts & double-taps emit sonar waves revealing nearby geometry.",
        tutCard3Title: "Avoid Red Hazards",
        tutCard3Desc: "Static, moving, and pulsing spikes reset your level instantly on contact.",
        tutCard4Title: "Reach Exit Portal",
        tutCard4Desc: "Bounce through the invisible maze and enter the glowing emerald/gold portal to win.",
        profileTitle: "PLAYER PROFILE",
        profileSub: "Lifetime Explorer & Orb Customization",
        lblPlayerName: "EXPLORER NAME",
        lblOrbSkin: "ORB GLOW SKIN",
        lblTrailSkin: "ECHO TRAIL EFFECT",
        lblTotalStars: "Total Stars Earned",
        lblGhostOrb: "GHOST REPLAY",
        lblLevelsCleared: "Levels Cleared",
        lblLifetimeBounces: "Total Lifetime Bounces",
        lblBestTimes: "BEST LEVEL TIMES & STARS",
        pauseTitle: "GAME PAUSED",
        pauseSub: "Take a breath or return to menu",
        btnResume: "RESUME GAME",
        btnRestart: "RESTART LEVEL",
        btnMainMenu: "MAIN MENU",
        deathTitle: "HAZARD IMPACT!",
        deathSub: "Restarting level...",
        mBounces: "Bounces",
        mTime: "Time Taken",
        btnNextLevel: "NEXT LEVEL",
        hudLevelPrefix: "LVL",
        level1Hint: "Tap anywhere to bounce. Hit walls to emit Echo waves!",
        level2Hint: "Avoid red spikes! Reach the glowing portal.",
        level3Hint: "Navigate the maze to reach the exit portal.",
        levelCompleteTitle: "LEVEL COMPLETE!",
        levelCompleteDesc: (lvl) => `Level ${lvl} cleared! Get ready for Level ${lvl + 1}.`,
        allCompleteTitle: "ALL WORLDS CLEARED!",
        allCompleteDesc: "Master of Echoes! You conquered all 15 levels across 3 worlds.",
        notCleared: "Not Cleared"
    },
    he: {
        langCode: "HE",
        langLabel: "🇮🇱 HE",
        heroSubtitle: "נווט בחשיכה",
        menuPlay: "התחל למשחק",
        menuLevels: "בחירת שלב",
        menuProfile: "פרופיל ועורים",
        menuTutorial: "איך משחקים",
        levelSelectTitle: "בחירת שלב",
        levelSelectSub: "בחר שלב פתוח במבוך",
        world1Title: "עולם 1: ניאון סייבר",
        world2Title: "עולם 2: תהום ברקת",
        world3Title: "עולם 3: ליבה סולארית",
        btnBack: "חזרה לתפריט",
        tutorialTitle: "איך משחקים",
        tutorialSub: "שלוט בכדור האור הקופץ",
        tutCard1Title: "לחץ כדי לקפוץ",
        tutCard1Desc: "לחץ בכל מקום במסך כדי לקפוץ ולכוון את כדור האור לכיוון המבוקש.",
        tutCard2Title: "גלי הד וסונאר",
        tutCard2Desc: "הקירות נסתרים בחשיכה! פגיעה בקיר או לחיצה כפולה פולטות גלי הד המגלים את הקירות.",
        tutCard3Title: "הזהר ממוקשים אדומים",
        tutCard3Desc: "מוקשים נייחים, זזים ופועמים מאפסים את השלב מיד בנגיעה.",
        tutCard4Title: "הגע לפורטל היציאה",
        tutCard4Desc: "קפוץ במבוך הנסתר והכנס לפורטל הירוק והזהוב הזוהר כדי לנצח.",
        profileTitle: "פרופיל שחקן",
        profileSub: "מדדי הנתונים ועיצוב הכדור",
        lblPlayerName: "שם השחקן",
        lblOrbSkin: "צבע הזוהר של הכדור",
        lblLevelsCleared: "שלבים הושלמו",
        lblLifetimeBounces: "סה\"כ קפיצות",
        lblBestTimes: "שיאי זמן לפי שלב",
        pauseTitle: "המשחק מושהה",
        pauseSub: "קח אוויר או חזור לתפריט",
        btnResume: "המשך במשחק",
        btnRestart: "אפס שלב",
        btnMainMenu: "תפריט ראשי",
        deathTitle: "פגיעה במוקש!",
        deathSub: "מאתחל שלב...",
        mBounces: "קפיצות",
        mTime: "זמן",
        btnNextLevel: "השלב הבא",
        hudLevelPrefix: "שלב",
        level1Hint: "לחץ בכל מקום כדי לקפוץ. פגש קירות כדי לפלוט גלי הד!",
        level2Hint: "הזהר ממוקשים אדומים! הגיע לפורטל הזוהר.",
        level3Hint: "נווט במבוך הנסתר כדי להגיע לפורטל היציאה.",
        levelCompleteTitle: "השלב הושלם!",
        levelCompleteDesc: (lvl) => `שלב ${lvl} הושלם בהצלחה! היערך לשלב ${lvl + 1}.`,
        allCompleteTitle: "כל העולמות הושלמו!",
        allCompleteDesc: "אלוף ההד! כבשת את כל 15 השלבים ב-3 העולמות.",
        notCleared: "טרם הושלם"
    },
    es: {
        langCode: "ES",
        langLabel: "🇪🇸 ES",
        heroSubtitle: "NAVEGA EN LA OSCURIDAD",
        menuPlay: "JUGAR",
        menuLevels: "NIVELES",
        menuProfile: "PERFIL Y SKINS",
        menuTutorial: "CÓMO JUGAR",
        levelSelectTitle: "SELECCIÓN DE NIVEL",
        levelSelectSub: "Selecciona un nivel desbloqueado",
        world1Title: "MUNDO 1: CIBER NEÓN",
        world2Title: "MUNDO 2: ABISMO ESMERALDA",
        world3Title: "MUNDO 3: NÚCLEO SOLAR",
        btnBack: "VOLVER AL MENÚ",
        tutorialTitle: "CÓMO JUGAR",
        tutorialSub: "Domina el orbe de luz",
        tutCard1Title: "Toca para Impulsar",
        tutCard1Desc: "Toca cualquier lugar de la pantalla para impulsar tu orbe de luz.",
        tutCard2Title: "Eco Sonar",
        tutCard2Desc: "¡Las paredes son invisibles! Los impactos emitirán ondas de eco.",
        tutCard3Title: "Evita Trampas Rojas",
        tutCard3Desc: "Las trampas estáticas, móviles y pulsantes reinician el nivel.",
        tutCard4Title: "Llega al Portal",
        tutCard4Desc: "Entra en el portal verde y dorado brillante para ganar.",
        profileTitle: "PERFIL DE JUGADOR",
        profileSub: "Métricas y Personalización del Orbe",
        lblPlayerName: "NOMBRE DE EXPLORADOR",
        lblOrbSkin: "COLOR DEL ORBE",
        lblLevelsCleared: "Niveles Superados",
        lblLifetimeBounces: "Rebotes Totales",
        lblBestTimes: "MEJORES TIEMPOS",
        pauseTitle: "JUEGO EN PAUSA",
        pauseSub: "Tómate un respiro o vuelve al menú",
        btnResume: "REANUDAR",
        btnRestart: "REINICIAR NIVEL",
        btnMainMenu: "MENÚ PRINCIPAL",
        deathTitle: "¡IMPACTO DE PELIGRO!",
        deathSub: "Reiniciando nivel...",
        mBounces: "Rebotes",
        mTime: "Tiempo",
        btnNextLevel: "SIGUIENTE NIVEL",
        hudLevelPrefix: "NIV",
        level1Hint: "Toca en cualquier lugar para rebotar y emitir ecos.",
        level2Hint: "¡Evita los pinchos rojos! Llega al portal.",
        level3Hint: "Navega por el laberinto para llegar al portal.",
        levelCompleteTitle: "¡NIVEL COMPLETADO!",
        levelCompleteDesc: (lvl) => `¡Nivel ${lvl} completado! Prepárate para el Nivel ${lvl + 1}.`,
        allCompleteTitle: "¡TODOS LOS MUNDOS SUPERADOS!",
        allCompleteDesc: "¡Maestro de los Ecos! Conquistaste los 15 niveles.",
        notCleared: "No Superado"
    },
    fr: {
        langCode: "FR",
        langLabel: "🇫🇷 FR",
        heroSubtitle: "NAVIGUEZ DANS L'OBSCURITÉ",
        menuPlay: "JOUER",
        menuLevels: "NIVEAUX",
        menuProfile: "PROFIL ET SKINS",
        menuTutorial: "COMMENT JOUER",
        levelSelectTitle: "CHOIX DU NIVEAU",
        levelSelectSub: "Sélectionnez un niveau déverrouillé",
        world1Title: "MONDE 1: CYBER NÉON",
        world2Title: "MONDE 2: ABYSS ÉMERAUDE",
        world3Title: "MONDE 3: CŒUR SOLAIRE",
        btnBack: "RETOUR AU MENU",
        tutorialTitle: "COMMENT JOUER",
        tutorialSub: "Maîtrisez l'orbe de lumière",
        tutCard1Title: "Touchez pour Sauter",
        tutCard1Desc: "Touchez n'importe où sur l'écran pour propulser votre orbe.",
        tutCard2Title: "Écho Sonar",
        tutCard2Desc: "Les murs sont invisibles! Les impacts émettent des ondes d'écho.",
        tutCard3Title: "Évitez les Pieges Rouges",
        tutCard3Desc: "Les pièges statiques, mobiles et pulsants réinitialisent le niveau.",
        tutCard4Title: "Atteignez le Portail",
        tutCard4Desc: "Entrez dans le portail étincelant pour gagner.",
        profileTitle: "PROFIL JOUEUR",
        profileSub: "Statistiques et Personnalisation",
        lblPlayerName: "NOM D'EXPLORATEUR",
        lblOrbSkin: "COULEUR DE L'ORBE",
        lblLevelsCleared: "Niveaux Réussis",
        lblLifetimeBounces: "Total des Rebounds",
        lblBestTimes: "MEILLEURS TEMPS",
        pauseTitle: "JEU EN PAUSE",
        pauseSub: "Faites une pause ou revenez au menu",
        btnResume: "REPRENDRE",
        btnRestart: "RECOMMENCER",
        btnMainMenu: "MENU PRINCIPAL",
        deathTitle: "IMPACT DE DANGER!",
        deathSub: "Redémarrage du niveau...",
        mBounces: "Rebonds",
        mTime: "Temps",
        btnNextLevel: "NIVEAU SUIVANT",
        hudLevelPrefix: "NIV",
        level1Hint: "Touchez n'importe où pour rebondir et créer des échos.",
        level2Hint: "Évitez les pics rouges! Atteignez le portail.",
        level3Hint: "Naviguez dans le labyrinthe pour atteindre la sortie.",
        levelCompleteTitle: "NIVEAU RÉUSSI!",
        levelCompleteDesc: (lvl) => `Niveau ${lvl} réussi! Préparez-vous au Niveau ${lvl + 1}.`,
        allCompleteTitle: "TOUS LES MONDES RÉUSSIS!",
        allCompleteDesc: "Maître des Échos! Vous avez vaincu les 15 niveaux.",
        notCleared: "Non Réussi"
    },
    ja: {
        langCode: "JA",
        langLabel: "🇯🇵 JA",
        heroSubtitle: "暗闇をナビゲート",
        menuPlay: "プレイ",
        menuLevels: "ステージ選択",
        menuProfile: "プロフィール",
        menuTutorial: "遊び方",
        levelSelectTitle: "ステージ選択",
        levelSelectSub: "解除されたステージを選択してください",
        world1Title: "ワールド 1: サイバーネオン",
        world2Title: "ワールド 2: エメラルドの深淵",
        world3Title: "ワールド 3: ソーラーコア",
        btnBack: "メニューに戻る",
        tutorialTitle: "遊び方",
        tutorialSub: "光のオーブを操作しよう",
        tutCard1Title: "タップで移動",
        tutCard1Desc: "画面をタップするとオーブがその方向に跳ねます。",
        tutCard2Title: "エコーソナー",
        tutCard2Desc: "壁は暗闇で不可視です！衝突でエコー波が発生します。",
        tutCard3Title: "赤い障害物を回避",
        tutCard3Desc: "静止・移動・パルス障害物に触れるとリセットされます。",
        tutCard4Title: "ポータルを目指せ",
        tutCard4Desc: "輝く緑と金のポータルに入るとクリアです。",
        profileTitle: "プレイヤープロフィール",
        profileSub: "記録とオーブのスキン変更",
        lblPlayerName: "プレイヤー名",
        lblOrbSkin: "オーブのスキンカラー",
        lblLevelsCleared: "クリアしたステージ",
        lblLifetimeBounces: "通算バウンド数",
        lblBestTimes: "ベストタイム",
        pauseTitle: "一時停止中",
        pauseSub: "休憩するかメニューに戻ります",
        btnResume: "再開する",
        btnRestart: "リトライ",
        btnMainMenu: "メインメニュー",
        deathTitle: "トラップに衝突！",
        deathSub: "リトライ中...",
        mBounces: "バウンド数",
        mTime: "タイム",
        btnNextLevel: "次のステージ",
        hudLevelPrefix: "STAGE",
        level1Hint: "タップして跳ね、壁に当ててエコーを発生させよう。",
        level2Hint: "赤いトゲを避けてポータルに到達しよう！",
        level3Hint: "迷路をナビゲートして出口を目指そう。",
        levelCompleteTitle: "ステージクリア！",
        levelCompleteDesc: (lvl) => `ステージ ${lvl} クリア！次のステージ ${lvl + 1} へ。`,
        allCompleteTitle: "全ワールド全制覇！",
        allCompleteDesc: "エコーのマスター！全15ステージを制覇しました。",
        notCleared: "未クリア"
    }
};

// --- Storage & Save System ---
class SaveSystem {
    constructor() {
        this.STORAGE_KEY = 'echo_bounce_save_v5';
        this.data = {
            playerName: 'Player 1',
            language: 'en',
            orbSkin: 'cyan',
            trailSkin: 'standard',
            ghostEnabled: true,
            unlockedLevel: 15, // all 15 levels unlocked for testing
            totalLifetimeBounces: 0,
            levelsCompleted: 0,
            bestTimes: {},
            stars: {},
            ghostTrajectories: {}
        };
        for (let i = 1; i <= 15; i++) {
            this.data.bestTimes[i] = null;
            this.data.stars[i] = 0;
        }
        this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.data = {
                    ...this.data,
                    ...parsed,
                    stars: { ...this.data.stars, ...(parsed.stars || {}) },
                    ghostTrajectories: { ...this.data.ghostTrajectories, ...(parsed.ghostTrajectories || {}) }
                };
            }
        } catch (e) {
            console.warn('Could not load saved data from localStorage', e);
        }
    }

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('Could not save data to localStorage', e);
        }
    }

    recordBounces(count) {
        this.data.totalLifetimeBounces += count;
        this.save();
    }

    recordLevelVictory(levelIndex, bounces, timeSec, trajectory) {
        const lvlNum = levelIndex + 1;
        
        if (this.data.unlockedLevel < lvlNum + 1 && lvlNum < 15) {
            this.data.unlockedLevel = lvlNum + 1;
        }

        const currentBest = this.data.bestTimes[lvlNum];
        const isNewBest = (currentBest === null || timeSec < currentBest);

        if (isNewBest) {
            this.data.bestTimes[lvlNum] = parseFloat(timeSec.toFixed(1));
            if (trajectory && trajectory.length > 0) {
                if (!this.data.ghostTrajectories) this.data.ghostTrajectories = {};
                this.data.ghostTrajectories[lvlNum] = trajectory;
            }
        }

        const newStars = calculateStars(levelIndex, timeSec, bounces);
        if (!this.data.stars) this.data.stars = {};
        const currentStars = this.data.stars[lvlNum] || 0;
        this.data.stars[lvlNum] = Math.max(currentStars, newStars);

        let completed = 0;
        for (let i = 1; i <= 15; i++) {
            if (this.data.bestTimes[i] !== null) completed++;
        }
        this.data.levelsCompleted = completed;

        this.recordBounces(bounces);
        this.save();

        return { stars: newStars, isNewBest };
    }
}

// --- Vector Math Utility ---
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    length() {
        return Math.hypot(this.x, this.y);
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }
}

// --- Particle System ---
class Particle {
    constructor(x, y, vx, vy, color, size, maxLife) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = maxLife;
        this.maxLife = maxLife;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const progress = Math.max(0, this.life / this.maxLife);
        const radius = Math.max(0, this.size * progress);
        if (radius <= 0) return;

        ctx.save();
        ctx.globalAlpha = progress;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- Sonar Echo Wave ---
class EchoWave {
    constructor(x, y, maxRadius = 240, duration = 1.6, color = CONFIG.COLOR_PINK) {
        this.x = x;
        this.y = y;
        this.currentRadius = 0;
        this.maxRadius = maxRadius;
        this.duration = duration;
        this.elapsed = 0;
        this.waveWidth = 35;
        this.color = color;
        this.speed = maxRadius / duration;
    }

    update(dt) {
        this.elapsed += dt;
        this.currentRadius = this.speed * this.elapsed;
    }

    isFinished() {
        return this.elapsed >= this.duration || this.currentRadius >= this.maxRadius;
    }

    getIlluminationAt(px, py) {
        const dist = Math.hypot(px - this.x, py - this.y);
        const diff = Math.abs(dist - this.currentRadius);
        if (diff < this.waveWidth) {
            const edgeFade = 1 - diff / this.waveWidth;
            const timeFade = 1 - this.elapsed / this.duration;
            return edgeFade * timeFade;
        }
        return 0;
    }

    draw(ctx) {
        const progress = Math.min(1, this.elapsed / this.duration);
        const opacity = (1 - progress) * 0.75;
        const drawRadius = Math.max(0, this.currentRadius);
        if (opacity <= 0 || drawRadius <= 0) return;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(1, 3 * (1 - progress));
        ctx.shadowBlur = 14;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.arc(this.x, this.y, drawRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

// --- Wall Line Segment ---
class Wall {
    constructor(x1, y1, x2, y2, color = CONFIG.COLOR_PINK) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.color = color;
        this.illumination = 0;
    }

    update(dt, echoWaves) {
        this.illumination = Math.max(0, this.illumination - dt * 0.6);
        const samples = 6;
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const sx = this.x1 + (this.x2 - this.x1) * t;
            const sy = this.y1 + (this.y2 - this.y1) * t;

            for (const wave of echoWaves) {
                const waveIntensity = wave.getIlluminationAt(sx, sy);
                if (waveIntensity > this.illumination) {
                    this.illumination = Math.min(1, waveIntensity * 1.5);
                }
            }
        }
    }

    checkCollision(orb) {
        const dx = this.x2 - this.x1;
        const dy = this.y2 - this.y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return null;

        let t = ((orb.pos.x - this.x1) * dx + (orb.pos.y - this.y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const closestX = this.x1 + t * dx;
        const closestY = this.y1 + t * dy;

        const distX = orb.pos.x - closestX;
        const distY = orb.pos.y - closestY;
        const dist = Math.hypot(distX, distY);

        if (dist < orb.radius) {
            let nx = dist > 0 ? distX / dist : 0;
            let ny = dist > 0 ? distY / dist : -1;

            const overlap = orb.radius - dist;
            orb.pos.x += nx * overlap;
            orb.pos.y += ny * overlap;

            const vDotN = orb.vel.x * nx + orb.vel.y * ny;
            if (vDotN < 0) {
                orb.vel.x -= (1 + CONFIG.RESTITUTION) * vDotN * nx;
                orb.vel.y -= (1 + CONFIG.RESTITUTION) * vDotN * ny;
            }

            const normalImpactSpeed = -vDotN;
            if (normalImpactSpeed > 30.0) {
                this.illumination = 1.0;
                return { x: closestX, y: closestY, isRealBounce: true };
            } else {
                if (Math.abs(orb.vel.y) < 15) orb.vel.y = 0;
                if (Math.abs(orb.vel.x) < 15) orb.vel.x = 0;
                return { x: closestX, y: closestY, isRealBounce: false };
            }
        }
        return null;
    }

    draw(ctx) {
        if (this.illumination <= 0.01) return;

        ctx.save();
        ctx.globalAlpha = Math.min(1, this.illumination);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12 * this.illumination;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        ctx.restore();
    }
}

// --- Base Hazard Class ---
class Hazard {
    constructor(x, y, radius = 18) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.illumination = 0;
    }

    update(dt, echoWaves) {
        this.illumination = Math.max(0, this.illumination - dt * 0.6);
        for (const wave of echoWaves) {
            const intensity = wave.getIlluminationAt(this.x, this.y);
            if (intensity > this.illumination) {
                this.illumination = Math.min(1, intensity * 1.5);
            }
        }
    }

    checkCollision(orb) {
        const dist = Math.hypot(orb.pos.x - this.x, orb.pos.y - this.y);
        return dist < orb.radius + this.radius;
    }

    draw(ctx) {
        if (this.illumination <= 0.01) return;

        ctx.save();
        ctx.globalAlpha = Math.min(1, this.illumination);

        ctx.shadowBlur = 16 * this.illumination;
        ctx.shadowColor = CONFIG.COLOR_RED;
        ctx.strokeStyle = CONFIG.COLOR_RED;
        ctx.fillStyle = 'rgba(255, 42, 42, 0.25)';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
            const px = this.x + Math.cos(angle) * this.radius;
            const py = this.y + Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = CONFIG.COLOR_RED;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- World 2: Moving Hazard Spikes ---
class MovingHazard extends Hazard {
    constructor(x1, y1, x2, y2, speed = 120, radius = 18) {
        super(x1, y1, radius);
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.speed = speed;
        this.t = 0;
        this.dir = 1;
    }

    update(dt, echoWaves) {
        super.update(dt, echoWaves);
        const dist = Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
        if (dist > 0) {
            this.t += (this.speed * dt / dist) * this.dir;
            if (this.t >= 1) { this.t = 1; this.dir = -1; }
            if (this.t <= 0) { this.t = 0; this.dir = 1; }
            this.x = this.x1 + (this.x2 - this.x1) * this.t;
            this.y = this.y1 + (this.y2 - this.y1) * this.t;
        }
    }
}

// --- World 3: Pulsing Hazard Spikes (Timer ON/OFF) ---
class PulsingHazard extends Hazard {
    constructor(x, y, onDuration = 1.5, offDuration = 1.5, radius = 18) {
        super(x, y, radius);
        this.onDuration = onDuration;
        this.offDuration = offDuration;
        this.timer = 0;
        this.active = true;
    }

    update(dt, echoWaves) {
        super.update(dt, echoWaves);
        this.timer += dt;
        const cycle = this.onDuration + this.offDuration;
        const mod = this.timer % cycle;
        this.active = mod < this.onDuration;
    }

    checkCollision(orb) {
        if (!this.active) return false;
        return super.checkCollision(orb);
    }

    draw(ctx) {
        if (!this.active && this.illumination < 0.2) return;
        ctx.save();
        if (!this.active) {
            ctx.globalAlpha = Math.min(0.25, this.illumination * 0.35);
        }
        super.draw(ctx);
        ctx.restore();
    }
}

// --- Exit Portal ---
// ===== Cosmic Black Hole Exit Portal =====
class ExitPortal {
    constructor(x, y, radius = 22) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.diskAngle  = 0;   // accretion disk rotation
        this.orbitAngle = 0;   // orbiting particle angle
        this.illumination = 0.55;
    }

    update(dt, echoWaves) {
        this.diskAngle  += dt * 1.6;
        this.orbitAngle += dt * 2.2;
        this.illumination = Math.max(0.55, this.illumination - dt * 0.3);
        for (const wave of echoWaves) {
            const intensity = wave.getIlluminationAt(this.x, this.y);
            if (intensity > this.illumination) this.illumination = Math.min(1, intensity * 1.8);
        }
    }

    checkCollision(orb) {
        return Math.hypot(orb.pos.x - this.x, orb.pos.y - this.y) < orb.radius + this.radius * 0.75;
    }

    draw(ctx) {
        const { x, y, radius: r, diskAngle, orbitAngle, illumination: il } = this;
        ctx.save();
        ctx.globalAlpha = Math.min(1, il);

        // ── 1. Outer accretion glow ──
        const outerGlow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
        outerGlow.addColorStop(0,   'transparent');
        outerGlow.addColorStop(0.3, `rgba(0,255,136,${0.06 * il})`);
        outerGlow.addColorStop(0.6, `rgba(0,200,255,${0.04 * il})`);
        outerGlow.addColorStop(1,   'transparent');
        ctx.fillStyle = outerGlow;
        ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();

        // ── 2. Rotating elliptical accretion disk rings ──
        ctx.save();
        ctx.translate(x, y);

        // Outer ring
        ctx.rotate(diskAngle);
        ctx.strokeStyle = `rgba(0,255,136,${0.45 * il})`;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 14 * il;
        ctx.shadowColor = '#00ff88';
        ctx.beginPath(); ctx.ellipse(0, 0, r * 2.3, r * 0.52, 0, 0, Math.PI * 2); ctx.stroke();

        // Inner ring (counter-rotates)
        ctx.rotate(-diskAngle * 2.1);
        ctx.strokeStyle = `rgba(0,220,255,${0.35 * il})`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#00f3ff';
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.65, r * 0.35, 0.4, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        // ── 3. Gravitational lensing rings (subtle purple) ──
        ctx.shadowBlur = 0;
        for (let i = 0; i < 3; i++) {
            const rr = r * (0.85 + i * 0.28);
            ctx.strokeStyle = `rgba(180,80,255,${(0.18 - i * 0.05) * il})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
        }

        // ── 4. Orbiting particle dots ──
        const drawParticles = (count, radius, speed, color, size) => {
            for (let i = 0; i < count; i++) {
                const a = orbitAngle * speed + (i / count) * Math.PI * 2;
                const px = x + Math.cos(a) * radius;
                const py = y + Math.sin(a) * radius * 0.45;
                ctx.fillStyle = color;
                ctx.shadowBlur = 8 * il;
                ctx.shadowColor = color;
                ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
            }
        };
        drawParticles(7, r * 2.0, 1,    `rgba(0,255,136,${0.85 * il})`, 2.0);
        drawParticles(5, r * 1.65,-1.4, `rgba(0,220,255,${0.7  * il})`, 1.5);

        // ── 5. Event horizon — pure black void center ──
        const horizon = ctx.createRadialGradient(x, y, 0, x, y, r * 1.05);
        horizon.addColorStop(0,   '#000000');
        horizon.addColorStop(0.75,'#000000');
        horizon.addColorStop(0.9, `rgba(0,30,60,${0.6 * il})`);
        horizon.addColorStop(1,   'transparent');
        ctx.shadowBlur = 0;
        ctx.fillStyle = horizon;
        ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, Math.PI * 2); ctx.fill();

        // ── 6. Tiny bright singularity point ──
        ctx.fillStyle = `rgba(255,255,255,${0.7 * il})`;
        ctx.shadowBlur = 12 * il;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}

// --- Player Light Orb ---
class PlayerOrb {
    constructor(x, y, skinColor = 'cyan') {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, -100);
        this.radius = CONFIG.ORB_RADIUS;
        this.bounces = 0;
        this.trailTimer = 0;
        this.skinKey = skinColor;
        this.color = SKINS[skinColor] || CONFIG.COLOR_CYAN;
        this.drawScale = 1.0;  // shrinks to 0 during portal absorption
    }

    setSkin(skinColor) {
        this.skinKey = skinColor;
        this.color = SKINS[skinColor] || CONFIG.COLOR_CYAN;
    }

    reset(x, y) {
        this.pos.set(x, y);
        this.vel.set(0, -100);
        this.bounces = 0;
        this.drawScale = 1.0;
    }

    applyImpulse(targetX, targetY, gameInstance) {
        const dx = targetX - this.pos.x;
        const dy = targetY - this.pos.y;
        const dist = Math.hypot(dx, dy);

        let dirX = 0;
        let dirY = -1;

        if (dist > 5) {
            dirX = dx / dist;
            dirY = dy / dist;
        }

        this.vel.x += dirX * CONFIG.IMPULSE_MAGNITUDE;
        this.vel.y += dirY * CONFIG.IMPULSE_MAGNITUDE;

        const speed = this.vel.length();
        if (speed > CONFIG.MAX_VELOCITY) {
            this.vel.normalize();
            this.vel.x *= CONFIG.MAX_VELOCITY;
            this.vel.y *= CONFIG.MAX_VELOCITY;
        }

        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.5;
            const pSpeed = 60 + Math.random() * 80;
            gameInstance.particles.push(new Particle(
                this.pos.x,
                this.pos.y,
                Math.cos(angle) * pSpeed - dirX * 40,
                Math.sin(angle) * pSpeed - dirY * 40,
                this.color,
                3,
                0.4
            ));
        }

        gameInstance.echoWaves.push(new EchoWave(targetX, targetY, 110, 0.6, this.color));
    }

    update(dt, gameInstance) {
        this.vel.y += CONFIG.GRAVITY * dt;
        this.vel.x *= CONFIG.AIR_FRICTION;
        this.vel.y *= CONFIG.AIR_FRICTION;

        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;

        const wallWaveColor = gameInstance.getWaveColor();

        for (const wall of gameInstance.walls) {
            const impact = wall.checkCollision(this);
            if (impact && impact.isRealBounce) {
                this.bounces++;
                haptic(15);
                Audio.playBounce();
                gameInstance.echoWaves.push(new EchoWave(impact.x, impact.y, 140, 0.9, wallWaveColor));

                
                for (let i = 0; i < 8; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 40 + Math.random() * 100;
                    gameInstance.particles.push(new Particle(
                        impact.x,
                        impact.y,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        wallWaveColor,
                        2.5,
                        0.4
                    ));
                }
            }
        }

        this.trailTimer += dt;
        if (this.trailTimer >= 0.03 && this.vel.length() > 20) {
            this.trailTimer = 0;
            const trailSkin = (gameInstance.saveSystem && gameInstance.saveSystem.data) ? (gameInstance.saveSystem.data.trailSkin || 'standard') : 'standard';
            const speedRatio = Math.min(1, this.vel.length() / 800);

            if (trailSkin === 'fire') {
                const colors = ['#ffe600', '#ff7700', '#ff2a2a', '#ff9900'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                gameInstance.particles.push(new Particle(
                    this.pos.x + (Math.random() - 0.5) * 8,
                    this.pos.y + (Math.random() - 0.5) * 8,
                    -this.vel.x * 0.12 + (Math.random() - 0.5) * 30,
                    -this.vel.y * 0.12 - 35 + (Math.random() - 0.5) * 30,
                    color,
                    3 * speedRatio + 1.5,
                    0.35 + speedRatio * 0.25
                ));
            } else if (trailSkin === 'ice') {
                const colors = ['#00f3ff', '#ffffff', '#a0f0ff', '#88e0ff'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                gameInstance.particles.push(new Particle(
                    this.pos.x + (Math.random() - 0.5) * 10,
                    this.pos.y + (Math.random() - 0.5) * 10,
                    -this.vel.x * 0.1 + (Math.random() - 0.5) * 20,
                    -this.vel.y * 0.1 + (Math.random() - 0.5) * 20,
                    color,
                    2.2 * speedRatio + 1.2,
                    0.4 + speedRatio * 0.3
                ));
            } else if (trailSkin === 'electric') {
                const colors = ['#00f3ff', '#a100ff', '#ffffff', '#e066ff'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                const angle = Math.random() * Math.PI * 2;
                const pSpeed = 40 + Math.random() * 80;
                gameInstance.particles.push(new Particle(
                    this.pos.x + (Math.random() - 0.5) * 6,
                    this.pos.y + (Math.random() - 0.5) * 6,
                    Math.cos(angle) * pSpeed - this.vel.x * 0.1,
                    Math.sin(angle) * pSpeed - this.vel.y * 0.1,
                    color,
                    1.8 * speedRatio + 1,
                    0.25 + speedRatio * 0.2
                ));
            } else {
                // Standard Neon
                gameInstance.particles.push(new Particle(
                    this.pos.x + (Math.random() - 0.5) * 4,
                    this.pos.y + (Math.random() - 0.5) * 4,
                    -this.vel.x * 0.15 + (Math.random() - 0.5) * 20,
                    -this.vel.y * 0.15 + (Math.random() - 0.5) * 20,
                    this.color,
                    2.5 * speedRatio + 1,
                    0.4 + speedRatio * 0.3
                ));
            }
        }
    }

    draw(ctx) {
        const scale = (this.drawScale != null) ? this.drawScale : 1.0;
        if (scale <= 0) return;
        ctx.save();

        const glowRadius = this.radius * 3.5 * scale;
        const displayRadius = Math.max(0, this.radius * scale);

        if (glowRadius > 0) {
            const outerGlow = ctx.createRadialGradient(
                this.pos.x, this.pos.y, displayRadius * 0.2,
                this.pos.x, this.pos.y, glowRadius
            );
            outerGlow.addColorStop(0, this.color);
            outerGlow.addColorStop(0.35, this.color + '55');
            outerGlow.addColorStop(1, 'transparent');

            ctx.globalAlpha = scale;
            ctx.fillStyle = outerGlow;
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = scale;
        ctx.shadowBlur = 16 * scale;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, displayRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- Main Game Orchestrator ---
class EchoBounceGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.dpr = window.devicePixelRatio || 1;
        this.width = 0;
        this.height = 0;

        this.saveSystem = new SaveSystem();
        this.currentLevelIndex = 0; // 0 to 14 (15 Levels total, 3 Worlds)
        this.totalLevels = 15;

        this.player = null;
        this.walls = [];
        this.hazards = [];
        this.portal = null;
        this.echoWaves = [];
        this.particles = [];

        // Camera Transform State for Portal Win Zoom Transition
        this.camera = {
            x: 0,
            y: 0,
            scale: 1.0,
            targetScale: 1.0,
            flashAlpha: 0.0
        };
        this.portalAnimTimer = 0;

        this.pulseCooldown = 0;
        this.lastTime = 0;
        this.levelStartTime = 0;
        this.gameState = 'MENU';
        this.deathTimer = 0;
        this.absorptionTimer = 0;   // portal absorption animation timer
        this.carouselWorldIndex = 0; // last viewed world in level select carousel

        // Ghost Replay & Star Rating State
        this.currentTrajectory = [];
        this.recordTimer = 0;
        this.ghostData = null;
        this.ghostTime = 0;
        this.ghostPos = null;
        this.lastVictoryStars = 1;

        this.lastTapTime = 0;
        this.lastTapPos = { x: 0, y: 0 };

        // DOM Screen Elements
        this.elMenuScreen = document.getElementById('menu-screen');
        this.elLevelSelectScreen = document.getElementById('level-select-screen');
        this.elTutorialScreen = document.getElementById('tutorial-screen');
        this.elProfileScreen = document.getElementById('profile-screen');
        this.elGameHud = document.getElementById('game-hud');
        this.elGameActionBar = document.getElementById('game-action-bar');
        this.elPauseModal = document.getElementById('pause-modal');
        this.elDeathBanner = document.getElementById('death-banner');
        this.elVictoryModal = document.getElementById('victory-modal');
        this.elHintBanner = document.getElementById('level-hint-banner');
        this.elHintText = document.getElementById('hint-text');

        // i18n & Language Elements
        this.btnLangToggle = document.getElementById('btn-lang-toggle');
        this.elLangLabel = document.getElementById('lang-label');

        // HUD Elements
        this.elLevel = document.getElementById('stat-level');
        this.btnPulse = document.getElementById('btn-pulse');
        this.elCooldownBar = document.getElementById('pulse-cooldown-bar');
        this.btnReset = document.getElementById('btn-reset');
        this.btnPauseHud = document.getElementById('btn-pause-hud');

        // Victory Modal Elements
        this.elVicTitle = document.getElementById('vic-title');
        this.elVicDesc = document.getElementById('vic-desc');
        this.elVicBounces = document.getElementById('vic-bounces');
        this.elVicTime = document.getElementById('vic-time');
        this.btnNextLevel = document.getElementById('btn-next-level');

        // Profile Elements
        this.inputPlayerName = document.getElementById('input-player-name');
        this.skinSwatchesContainer = document.getElementById('skin-swatches');

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.bindEvents();
        this.bindNavigationEvents();
        this.bindSkinSelectorEvents();

        // Apply saved language & RTL settings
        this.setLanguage(this.saveSystem.data.language || 'en');

        // First-launch onboarding check
        const isFirstLaunch = !localStorage.getItem('echo_bounce_onboarded');
        if (isFirstLaunch) {
            this.switchState('ONBOARDING');
        } else {
            this.switchState('MENU');
        }

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    getWorldForLevel(levelIndex) {
        if (levelIndex < 5) return 1; // World 1: Cyber Neon (1-5)
        if (levelIndex < 10) return 2; // World 2: Emerald Abyss (6-10)
        return 3; // World 3: Solar Core (11-15)
    }

    getWallColor() {
        const world = this.getWorldForLevel(this.currentLevelIndex);
        if (world === 1) return CONFIG.COLOR_PINK;
        if (world === 2) return CONFIG.COLOR_GREEN;
        return CONFIG.COLOR_GOLD;
    }

    getWaveColor() {
        const world = this.getWorldForLevel(this.currentLevelIndex);
        if (world === 1) return CONFIG.COLOR_PINK;
        if (world === 2) return CONFIG.COLOR_PURPLE;
        return CONFIG.COLOR_RED;
    }

    resetCamera() {
        this.camera.x = this.width / 2;
        this.camera.y = this.height / 2;
        this.camera.scale = 1.0;
        this.camera.targetScale = 1.0;
        this.camera.flashAlpha = 0.0;
    }

    setLanguage(lang) {
        if (!TRANSLATIONS[lang]) lang = 'en';
        this.saveSystem.data.language = lang;
        this.saveSystem.save();

        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';

        if (this.elLangLabel) {
            const display = TRANSLATIONS[lang].langLabel || LANG_LABELS[lang] || lang.toUpperCase();
            this.elLangLabel.textContent = display;
        }

        // Apply static i18n translations to elements with data-i18n
        const dict = TRANSLATIONS[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });

        this.updateHudLevelBadge();

        if (this.gameState === 'LEVEL_SELECT') this.renderLevelSelect();
        if (this.gameState === 'PROFILE') this.renderProfile();
        if (this.gameState === 'PLAYING') this.updateOnScreenHint();
    }

    updateHudLevelBadge() {
        if (!this.elLevel) return;
        const lang = this.saveSystem.data.language || 'en';
        const prefix = TRANSLATIONS[lang].hudLevelPrefix || 'LVL';
        this.elLevel.textContent = `${prefix} ${this.currentLevelIndex + 1}/${this.totalLevels}`;
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);

        this.resetCamera();

        const skin = this.saveSystem ? this.saveSystem.data.orbSkin : 'cyan';
        if (!this.player) {
            this.player = new PlayerOrb(this.width / 2, this.height * 0.85, skin);
        } else {
            this.player.setSkin(skin);
            if (this.gameState === 'PLAYING') this.loadLevel(this.currentLevelIndex);
        }
    }

    switchState(newState) {
        this.gameState = newState;

        this.elMenuScreen.classList.add('hidden');
        this.elLevelSelectScreen.classList.add('hidden');
        this.elTutorialScreen.classList.add('hidden');
        this.elProfileScreen.classList.add('hidden');
        this.elGameHud.classList.add('hidden');
        this.elGameActionBar.classList.add('hidden');
        this.elPauseModal.classList.add('hidden');
        this.elDeathBanner.classList.add('hidden');
        this.elVictoryModal.classList.add('hidden');
        if (this.elHintBanner) this.elHintBanner.classList.add('hidden');

        switch (newState) {
            case 'MENU':
                this.resetCamera();
                this.elMenuScreen.classList.remove('hidden');
                this.createAmbientMenuWaves();
                break;

            case 'LEVEL_SELECT':
                this.renderLevelSelect();
                this.elLevelSelectScreen.classList.remove('hidden');
                break;

            case 'TUTORIAL':
                this.elTutorialScreen.classList.remove('hidden');
                break;

            case 'PROFILE':
                this.renderProfile();
                this.elProfileScreen.classList.remove('hidden');
                break;

            case 'PLAYING':
                this.resetCamera();
                this.elGameHud.classList.remove('hidden');
                this.elGameActionBar.classList.remove('hidden');
                this.updateOnScreenHint();
                break;

            case 'PORTAL_ANIMATION':
                this.elGameHud.classList.remove('hidden');
                this.elGameActionBar.classList.remove('hidden');
                break;

            case 'ABSORBING':
                this.elGameHud.classList.remove('hidden');
                this.elGameActionBar.classList.remove('hidden');
                break;

            case 'PAUSED':
                this.elGameHud.classList.remove('hidden');
                this.elGameActionBar.classList.remove('hidden');
                this.elPauseModal.classList.remove('hidden');
                break;

            case 'DEATH':
                this.elGameHud.classList.remove('hidden');
                this.elGameActionBar.classList.remove('hidden');
                this.elDeathBanner.classList.remove('hidden');
                break;

            case 'ONBOARDING': {
                const om = document.getElementById('onboarding-modal');
                if (om) {
                    om.classList.remove('hidden');
                    // Pre-fill existing name if any
                    const ni = document.getElementById('onboard-name-input');
                    const existing = this.saveSystem.data.playerName;
                    if (ni && existing && existing !== 'Player 1') ni.value = existing;
                }
                break;
            }

            case 'VICTORY':
                // Victory is now handled by seamless fade — keep modal hidden
                // (modal kept for fallback; finishVictorySequence skips it)
                break;
        }
    }

    updateOnScreenHint() {
        if (!this.elHintBanner || !this.elHintText) return;
        const lang = this.saveSystem.data.language || 'en';
        const dict = TRANSLATIONS[lang];

        if (this.currentLevelIndex === 0) {
            this.elHintText.textContent = dict.level1Hint;
            this.elHintBanner.classList.remove('hidden');
        } else if (this.currentLevelIndex === 1) {
            this.elHintText.textContent = dict.level2Hint;
            this.elHintBanner.classList.remove('hidden');
        } else {
            this.elHintText.textContent = dict.level3Hint;
            this.elHintBanner.classList.remove('hidden');

            setTimeout(() => {
                if (this.gameState === 'PLAYING' && this.currentLevelIndex >= 2) {
                    this.elHintBanner.classList.add('hidden');
                }
            }, 3500);
        }
    }

    createAmbientMenuWaves() {
        this.echoWaves = [
            new EchoWave(this.width * 0.5, this.height * 0.4, 220, 2.5, CONFIG.COLOR_CYAN)
        ];
    }

    startGameAtLevel(levelIndex) {
        this.currentLevelIndex = levelIndex;
        this.loadLevel(levelIndex);
        this.switchState('PLAYING');
    }

    loadLevel(levelIndex) {
        this.currentLevelIndex = levelIndex;
        const w = this.width;
        const h = this.height;

        this.resetCamera();
        const wallColor = this.getWallColor();

        this.walls = [
            new Wall(0, 0, w, 0, wallColor),
            new Wall(0, h, w, h, wallColor),
            new Wall(0, 0, 0, h, wallColor),
            new Wall(w, 0, w, h, wallColor)
        ];

        this.hazards = [];

        // --- WORLD 1: CYBER NEON (Levels 1 to 5) ---
        if (levelIndex === 0) {
            // Level 1: Intro Tutorial (0 hazards)
            this.walls.push(new Wall(w * 0.25, h * 0.65, w, h * 0.65, wallColor));
            this.walls.push(new Wall(0, h * 0.42, w * 0.75, h * 0.42, wallColor));
            this.portal = new ExitPortal(w * 0.5, h * 0.15, 24);

        } else if (levelIndex === 1) {
            // Level 2: Intro Hazard (1 static spike)
            this.walls.push(new Wall(w * 0.35, h * 0.72, w, h * 0.72, wallColor));
            this.walls.push(new Wall(0, h * 0.48, w * 0.65, h * 0.48, wallColor));
            this.walls.push(new Wall(w * 0.30, h * 0.30, w, h * 0.30, wallColor));
            this.hazards.push(new Hazard(w * 0.40, h * 0.48 - 18, 18));
            this.portal = new ExitPortal(w * 0.85, h * 0.12, 22);

        } else if (levelIndex === 2) {
            // Level 3: Void Labyrinth
            this.walls.push(new Wall(0, h * 0.78, w * 0.60, h * 0.78, wallColor));
            this.walls.push(new Wall(w * 0.40, h * 0.62, w, h * 0.62, wallColor));
            this.walls.push(new Wall(0, h * 0.46, w * 0.65, h * 0.46, wallColor));
            this.walls.push(new Wall(w * 0.35, h * 0.30, w, h * 0.30, wallColor));
            this.hazards.push(new Hazard(w * 0.75, h * 0.78 - 18, 18));
            this.hazards.push(new Hazard(w * 0.25, h * 0.62 - 18, 18));
            this.hazards.push(new Hazard(w * 0.80, h * 0.46 - 18, 18));
            this.portal = new ExitPortal(w * 0.20, h * 0.12, 20);

        } else if (levelIndex === 3) {
            // Level 4: Precision Pulse
            this.walls.push(new Wall(0, h * 0.80, w * 0.45, h * 0.80, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.80, w, h * 0.80, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.60, w * 0.75, h * 0.60, wallColor));
            this.walls.push(new Wall(0, h * 0.42, w * 0.45, h * 0.42, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.42, w, h * 0.42, wallColor));
            this.hazards.push(new Hazard(w * 0.50, h * 0.80 - 18, 18));
            this.hazards.push(new Hazard(w * 0.15, h * 0.60 - 18, 18));
            this.hazards.push(new Hazard(w * 0.85, h * 0.60 - 18, 18));
            this.portal = new ExitPortal(w * 0.50, h * 0.10, 19);

        } else if (levelIndex === 4) {
            // Level 5: Echo Core
            this.walls.push(new Wall(w * 0.30, h * 0.82, w, h * 0.82, wallColor));
            this.walls.push(new Wall(0, h * 0.68, w * 0.70, h * 0.68, wallColor));
            this.walls.push(new Wall(w * 0.30, h * 0.54, w, h * 0.54, wallColor));
            this.walls.push(new Wall(0, h * 0.40, w * 0.70, h * 0.40, wallColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.82 - 18, 18));
            this.hazards.push(new Hazard(w * 0.85, h * 0.68 - 18, 18));
            this.hazards.push(new Hazard(w * 0.15, h * 0.54 - 18, 18));
            this.portal = new ExitPortal(w * 0.88, h * 0.10, 18);

        // --- WORLD 2: EMERALD ABYSS (Levels 6 to 10 - MOVING HAZARDS) ---
        } else if (levelIndex === 5) {
            // Level 6: Emerald Slime (Intro Moving Hazard)
            this.walls.push(new Wall(0, h * 0.70, w * 0.65, h * 0.70, wallColor));
            this.walls.push(new Wall(w * 0.35, h * 0.45, w, h * 0.45, wallColor));
            // 1 Moving Spike sliding left & right
            this.hazards.push(new MovingHazard(w * 0.15, h * 0.70 - 18, w * 0.55, h * 0.70 - 18, 110, 18));
            this.portal = new ExitPortal(w * 0.20, h * 0.15, 22);

        } else if (levelIndex === 6) {
            // Level 7: Sliding Blades
            this.walls.push(new Wall(w * 0.25, h * 0.75, w, h * 0.75, wallColor));
            this.walls.push(new Wall(0, h * 0.55, w * 0.75, h * 0.55, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.35, w, h * 0.35, wallColor));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.75 - 18, w * 0.85, h * 0.75 - 18, 140, 18));
            this.hazards.push(new MovingHazard(w * 0.10, h * 0.55 - 18, w * 0.65, h * 0.55 - 18, 160, 18));
            this.portal = new ExitPortal(w * 0.80, h * 0.12, 20);

        } else if (levelIndex === 7) {
            // Level 8: Double Gate
            this.walls.push(new Wall(0, h * 0.78, w * 0.40, h * 0.78, wallColor));
            this.walls.push(new Wall(w * 0.60, h * 0.78, w, h * 0.78, wallColor));
            this.walls.push(new Wall(w * 0.20, h * 0.52, w * 0.80, h * 0.52, wallColor));
            this.walls.push(new Wall(0, h * 0.30, w * 0.40, h * 0.30, wallColor));
            this.walls.push(new Wall(w * 0.60, h * 0.30, w, h * 0.30, wallColor));
            this.hazards.push(new MovingHazard(w * 0.25, h * 0.52 - 18, w * 0.75, h * 0.52 - 18, 180, 18));
            this.portal = new ExitPortal(w * 0.50, h * 0.10, 19);

        } else if (levelIndex === 8) {
            // Level 9: Serpent Pass
            this.walls.push(new Wall(w * 0.25, h * 0.80, w, h * 0.80, wallColor));
            this.walls.push(new Wall(0, h * 0.65, w * 0.75, h * 0.65, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.50, w, h * 0.50, wallColor));
            this.walls.push(new Wall(0, h * 0.35, w * 0.75, h * 0.35, wallColor));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.80 - 18, w * 0.90, h * 0.80 - 18, 150, 18));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.65 - 18, w * 0.65, h * 0.65 - 18, 170, 18));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.50 - 18, w * 0.90, h * 0.50 - 18, 190, 18));
            this.portal = new ExitPortal(w * 0.15, h * 0.12, 18);

        } else if (levelIndex === 9) {
            // Level 10: Matrix Heart
            this.walls.push(new Wall(0, h * 0.82, w * 0.60, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.40, h * 0.66, w, h * 0.66, wallColor));
            this.walls.push(new Wall(0, h * 0.50, w * 0.60, h * 0.50, wallColor));
            this.walls.push(new Wall(w * 0.40, h * 0.34, w, h * 0.34, wallColor));
            this.hazards.push(new MovingHazard(w * 0.10, h * 0.82 - 18, w * 0.50, h * 0.82 - 18, 160, 18));
            this.hazards.push(new MovingHazard(w * 0.50, h * 0.66 - 18, w * 0.90, h * 0.66 - 18, 200, 18));
            this.hazards.push(new MovingHazard(w * 0.10, h * 0.50 - 18, w * 0.50, h * 0.50 - 18, 220, 18));
            this.portal = new ExitPortal(w * 0.85, h * 0.10, 18);

        // --- WORLD 3: SOLAR CORE (Levels 11 to 15 - PULSING HAZARDS) ---
        } else if (levelIndex === 10) {
            // Level 11: Solar Flare (Intro Pulsing Hazard)
            this.walls.push(new Wall(w * 0.20, h * 0.68, w, h * 0.68, wallColor));
            this.walls.push(new Wall(0, h * 0.44, w * 0.80, h * 0.44, wallColor));
            // 1 Pulsing Hazard toggling ON/OFF
            this.hazards.push(new PulsingHazard(w * 0.50, h * 0.68 - 18, 1.4, 1.4, 18));
            this.portal = new ExitPortal(w * 0.50, h * 0.12, 22);

        } else if (levelIndex === 11) {
            // Level 12: Lava Choke
            this.walls.push(new Wall(0, h * 0.76, w * 0.45, h * 0.76, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.76, w, h * 0.76, wallColor));
            this.walls.push(new Wall(w * 0.20, h * 0.52, w * 0.80, h * 0.52, wallColor));
            this.walls.push(new Wall(0, h * 0.32, w * 0.45, h * 0.32, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.32, w, h * 0.32, wallColor));
            this.hazards.push(new PulsingHazard(w * 0.50, h * 0.76 - 18, 1.2, 1.2, 18));
            this.hazards.push(new PulsingHazard(w * 0.30, h * 0.52 - 18, 1.5, 1.5, 18));
            this.hazards.push(new PulsingHazard(w * 0.70, h * 0.52 - 18, 1.5, 1.5, 18));
            this.portal = new ExitPortal(w * 0.50, h * 0.10, 19);

        } else if (levelIndex === 12) {
            // Level 13: Flame Wave
            this.walls.push(new Wall(w * 0.30, h * 0.80, w, h * 0.80, wallColor));
            this.walls.push(new Wall(0, h * 0.62, w * 0.70, h * 0.62, wallColor));
            this.walls.push(new Wall(w * 0.30, h * 0.44, w, h * 0.44, wallColor));
            this.walls.push(new Wall(0, h * 0.28, w * 0.70, h * 0.28, wallColor));
            this.hazards.push(new MovingHazard(w * 0.35, h * 0.80 - 18, w * 0.85, h * 0.80 - 18, 160, 18));
            this.hazards.push(new PulsingHazard(w * 0.35, h * 0.62 - 18, 1.2, 1.2, 18));
            this.hazards.push(new PulsingHazard(w * 0.50, h * 0.44 - 18, 1.0, 1.0, 18));
            this.portal = new ExitPortal(w * 0.85, h * 0.10, 18);

        } else if (levelIndex === 13) {
            // Level 14: Infernal Chamber
            this.walls.push(new Wall(0, h * 0.82, w * 0.45, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.82, w, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.64, w * 0.75, h * 0.64, wallColor));
            this.walls.push(new Wall(0, h * 0.46, w * 0.45, h * 0.46, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.46, w, h * 0.46, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.28, w * 0.75, h * 0.28, wallColor));
            this.hazards.push(new PulsingHazard(w * 0.50, h * 0.82 - 18, 1.1, 1.1, 18));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.64 - 18, w * 0.70, h * 0.64 - 18, 190, 18));
            this.hazards.push(new PulsingHazard(w * 0.50, h * 0.46 - 18, 0.9, 0.9, 18));
            this.hazards.push(new PulsingHazard(w * 0.50, h * 0.28 - 18, 1.3, 1.3, 18));
            this.portal = new ExitPortal(w * 0.50, h * 0.10, 18);

        } else {
            // Level 15: Core Apex (Master World 3 Boss Level)
            this.walls.push(new Wall(w * 0.35, h * 0.84, w, h * 0.84, wallColor));
            this.walls.push(new Wall(0, h * 0.70, w * 0.65, h * 0.70, wallColor));
            this.walls.push(new Wall(w * 0.35, h * 0.56, w, h * 0.56, wallColor));
            this.walls.push(new Wall(0, h * 0.42, w * 0.65, h * 0.42, wallColor));
            this.walls.push(new Wall(w * 0.35, h * 0.28, w, h * 0.28, wallColor));
            this.hazards.push(new MovingHazard(w * 0.40, h * 0.84 - 18, w * 0.90, h * 0.84 - 18, 200, 18));
            this.hazards.push(new PulsingHazard(w * 0.30, h * 0.70 - 18, 1.0, 1.0, 18));
            this.hazards.push(new MovingHazard(w * 0.40, h * 0.56 - 18, w * 0.90, h * 0.56 - 18, 220, 18));
            this.hazards.push(new PulsingHazard(w * 0.30, h * 0.42 - 18, 0.9, 0.9, 18));
            this.hazards.push(new PulsingHazard(w * 0.60, h * 0.28 - 18, 0.8, 0.8, 18));
            this.portal = new ExitPortal(w * 0.88, h * 0.10, 18);
        }

        const skin = this.saveSystem.data.orbSkin || 'cyan';
        if (this.player) {
            this.player.setSkin(skin);
            this.player.reset(w * 0.5, h * 0.88);
        }

        this.echoWaves = [];
        this.particles = [];
        this.pulseCooldown = 0;
        this.levelStartTime = performance.now();

        // Ghost Replay & Trajectory Setup
        this.currentTrajectory = [];
        this.recordTimer = 0;
        const lvlNum = levelIndex + 1;
        const trajMap = this.saveSystem.data.ghostTrajectories;
        this.ghostData = (trajMap && trajMap[lvlNum]) ? trajMap[lvlNum] : null;
        this.ghostTime = 0;
        this.ghostPos = null;

        this.updateHudLevelBadge();

        this.echoWaves.push(new EchoWave(w * 0.5, h * 0.88, 160, 1.0, this.player ? this.player.color : CONFIG.COLOR_CYAN));
    }

    bindNavigationEvents() {
        // Language Toggle (Cycles EN -> HE -> ES -> FR -> JA -> EN)
        if (this.btnLangToggle) {
            this.btnLangToggle.addEventListener('click', () => {
                const current = this.saveSystem.data.language || 'en';
                const nextIdx = (LANG_ORDER.indexOf(current) + 1) % LANG_ORDER.length;
                this.setLanguage(LANG_ORDER[nextIdx]);
            });
        }

        // Main Menu Buttons
        document.getElementById('btn-menu-play').addEventListener('click', () => {
            this.startGameAtLevel(this.saveSystem.data.unlockedLevel - 1);
        });

        document.getElementById('btn-menu-levels').addEventListener('click', () => {
            this.switchState('LEVEL_SELECT');
        });

        document.getElementById('btn-menu-profile').addEventListener('click', () => {
            this.switchState('PROFILE');
        });

        document.getElementById('btn-menu-tutorial').addEventListener('click', () => {
            this.switchState('TUTORIAL');
        });

        // Back Buttons
        document.getElementById('btn-level-back').addEventListener('click', () => {
            this.switchState('MENU');
        });
        document.getElementById('btn-tutorial-back').addEventListener('click', () => {
            this.switchState('MENU');
        });
        // Bottom back button
        document.getElementById('btn-profile-back').addEventListener('click', () => {
            this.switchState('MENU');
        });
        // Top back button (Phase 9)
        const btnProfileBackTop = document.getElementById('btn-profile-back-top');
        if (btnProfileBackTop) {
            btnProfileBackTop.addEventListener('click', () => {
                this.switchState('MENU');
            });
        }

        // Carousel dot click navigation
        document.querySelectorAll('#carousel-dots .dot').forEach((dot, idx) => {
            dot.addEventListener('click', () => {
                const carousel = document.getElementById('worlds-carousel');
                const slides = carousel ? carousel.querySelectorAll('.carousel-slide') : [];
                if (slides[idx]) {
                    slides[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    this.carouselWorldIndex = idx;
                    this.updateCarouselDots(idx);
                }
            });
        });

        // Onboarding Modal
        const onboardingModal = document.getElementById('onboarding-modal');
        const btnOnboardStart = document.getElementById('btn-onboard-start');
        if (btnOnboardStart) {
            btnOnboardStart.addEventListener('click', () => {
                Audio.unlock();
                const nameInput = document.getElementById('onboard-name-input');
                const name = nameInput ? nameInput.value.trim() : '';
                if (name) {
                    this.saveSystem.data.playerName = name;
                    this.saveSystem.save();
                }
                localStorage.setItem('echo_bounce_onboarded', '1');
                if (onboardingModal) onboardingModal.classList.add('hidden');
                this.switchState('MENU');
            });
        }

        // Player Name Auto Save
        if (this.inputPlayerName) {
            this.inputPlayerName.addEventListener('change', (e) => {
                this.saveSystem.data.playerName = e.target.value.trim() || 'Player 1';
                this.saveSystem.save();
            });
        }

        // HUD Pause Button
        if (this.btnPauseHud) {
            this.btnPauseHud.addEventListener('click', () => {
                if (this.gameState === 'PLAYING') {
                    this.switchState('PAUSED');
                }
            });
        }

        // Pause Modal Buttons
        document.getElementById('btn-pause-resume').addEventListener('click', () => {
            this.switchState('PLAYING');
        });
        document.getElementById('btn-pause-restart').addEventListener('click', () => {
            this.resetLevel();
            this.switchState('PLAYING');
        });
        document.getElementById('btn-pause-menu').addEventListener('click', () => {
            this.switchState('MENU');
        });

        // Unlock Web Audio on any user interaction
        document.addEventListener('touchstart', () => Audio.unlock(), { once: true, passive: true });
        document.addEventListener('pointerdown', () => Audio.unlock(), { once: true, passive: true });
    }

    bindSkinSelectorEvents() {
        // Orb Glow Swatches
        if (this.skinSwatchesContainer) {
            const swatches = this.skinSwatchesContainer.querySelectorAll('.skin-swatch');
            swatches.forEach(swatch => {
                swatch.addEventListener('click', () => {
                    const selectedColor = swatch.getAttribute('data-color');
                    this.saveSystem.data.orbSkin = selectedColor;
                    this.saveSystem.save();

                    swatches.forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');

                    if (this.player) {
                        this.player.setSkin(selectedColor);
                    }
                });
            });
        }

        // Echo Trail Effect Swatches
        const trailContainer = document.getElementById('trail-swatches');
        if (trailContainer) {
            const trailSwatches = trailContainer.querySelectorAll('.trail-swatch');
            trailSwatches.forEach(swatch => {
                swatch.addEventListener('click', () => {
                    const selectedTrail = swatch.getAttribute('data-trail');
                    this.saveSystem.data.trailSkin = selectedTrail;
                    this.saveSystem.save();

                    trailSwatches.forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');
                });
            });
        }

        // Ghost Replay Toggle Handler
        const toggleGhost = () => {
            const current = this.saveSystem.data.ghostEnabled !== false;
            const nextState = !current;
            this.saveSystem.data.ghostEnabled = nextState;
            this.saveSystem.save();

            const btnProfileGhost = document.getElementById('btn-toggle-ghost');
            if (btnProfileGhost) {
                btnProfileGhost.classList.toggle('active', nextState);
                btnProfileGhost.textContent = nextState ? '👻 GHOST: ON' : '👻 GHOST: OFF';
            }

            const btnPauseGhost = document.getElementById('btn-pause-ghost');
            if (btnPauseGhost) {
                btnPauseGhost.textContent = nextState ? '👻 GHOST: ON' : '👻 GHOST: OFF';
            }
        };

        const btnProfileGhost = document.getElementById('btn-toggle-ghost');
        if (btnProfileGhost) {
            btnProfileGhost.addEventListener('click', toggleGhost);
        }

        const btnPauseGhost = document.getElementById('btn-pause-ghost');
        if (btnPauseGhost) {
            btnPauseGhost.addEventListener('click', toggleGhost);
        }
    }

    bindEvents() {
        const handleTap = (clientX, clientY) => {
            if (this.gameState !== 'PLAYING') return;

            const rect = this.canvas.getBoundingClientRect();
            const tapX = clientX - rect.left;
            const tapY = clientY - rect.top;

            const now = performance.now();
            const timeDiff = now - this.lastTapTime;
            const distDiff = Math.hypot(tapX - this.lastTapPos.x, tapY - this.lastTapPos.y);

            if (timeDiff < 300 && distDiff < 50) {
                this.triggerManualPulse();
            } else {
                this.player.applyImpulse(tapX, tapY, this);
            }

            this.lastTapTime = now;
            this.lastTapPos = { x: tapX, y: tapY };
        };

        this.canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handleTap(e.clientX, e.clientY);
        });

        if (this.btnPulse) {
            this.btnPulse.addEventListener('click', (e) => {
                e.stopPropagation();
                this.triggerManualPulse();
            });
        }

        if (this.btnReset) {
            this.btnReset.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetLevel();
            });
        }

        if (this.btnNextLevel) {
            this.btnNextLevel.addEventListener('click', () => {
                if (this.currentLevelIndex < this.totalLevels - 1) {
                    this.startGameAtLevel(this.currentLevelIndex + 1);
                } else {
                    this.switchState('MENU');
                }
            });
        }
    }

    renderLevelSelect() {
        const carousel = document.getElementById('worlds-carousel');
        if (!carousel) return;

        const unlocked = this.saveSystem.data.unlockedLevel;
        const lang     = this.saveSystem.data.language || 'en';
        const dict     = TRANSLATIONS[lang];
        const notClearedStr = dict.notCleared;

        // World config: title, subtitle, badge emoji, theme colour, preview art HTML
        const worldConfigs = [
            {
                title:  dict.world1Title || 'CYBER NEON',
                sub:    (dict.worldSub1  || 'WORLD 1') + ' • LEVELS 1–5',
                badge:  '⚡',
                color:  'var(--neon-cyan)',
                art: `<div class="wpa-portal"></div>
                      <div class="wpa-wall wpa-wall-a"></div>
                      <div class="wpa-wall wpa-wall-b"></div>
                      <div class="wpa-hazard wpa-hz-1"></div>
                      <div class="wpa-hazard wpa-hz-2"></div>`
            },
            {
                title:  dict.world2Title || 'EMERALD ABYSS',
                sub:    (dict.worldSub2  || 'WORLD 2') + ' • LEVELS 6–10',
                badge:  '🌿',
                color:  'var(--neon-green)',
                art: `<div class="wpa-portal"></div>
                      <div class="wpa-wall wpa-wall-a"></div>
                      <div class="wpa-wall wpa-wall-b"></div>
                      <div class="wpa-moving-hz wpa-hz-1"></div>
                      <div class="wpa-moving-hz wpa-hz-2"></div>`
            },
            {
                title:  dict.world3Title || 'SOLAR CORE',
                sub:    (dict.worldSub3  || 'WORLD 3') + ' • LEVELS 11–15',
                badge:  '🔥',
                color:  'var(--neon-gold)',
                art: `<div class="wpa-portal"></div>
                      <div class="wpa-wall wpa-wall-a"></div>
                      <div class="wpa-wall wpa-wall-b"></div>
                      <div class="wpa-wall wpa-wall-c"></div>
                      <div class="wpa-pulse-hz wpa-hz-1"></div>
                      <div class="wpa-pulse-hz wpa-hz-2"></div>
                      <div class="wpa-pulse-hz wpa-hz-3"></div>`
            }
        ];

        let html = '';
        for (let w = 1; w <= 3; w++) {
            const startLvl = (w - 1) * 5 + 1;
            const endLvl   = w * 5;
            const cfg       = worldConfigs[w - 1];

            // Progress: total stars earned in this world
            let worldStars = 0;
            let clearedCount = 0;
            for (let i = startLvl; i <= endLvl; i++) {
                if (this.saveSystem.data.bestTimes[i] !== null) clearedCount++;
                worldStars += (this.saveSystem.data.stars ? (this.saveSystem.data.stars[i] || 0) : 0);
            }
            const allClear = clearedCount === 5;

            html += `<div class="carousel-slide" data-world="${w}">
                <div class="world-preview-art">${cfg.art}</div>
                <div class="world-card-header">
                    <div class="world-badge">${cfg.badge}</div>
                    <div class="world-card-info">
                        <h3 class="world-card-title" style="color:${cfg.color}">${cfg.title}</h3>
                        <p class="world-card-sub">${cfg.sub}</p>
                    </div>
                    <div class="world-progress-badge${allClear ? ' all-clear' : ''}">
                        ⭐ ${worldStars}/15
                    </div>
                </div>
                <div class="world-card-tap-prompt">
                    <span>🔍 TAP TO EXPLORE STAGES</span>
                </div>
            </div>`;
        }

        carousel.innerHTML = html;

        // ── Helper: find centred slide, toggle .active class, update dots ──
        const updateActiveSlide = () => {
            const slides  = carousel.querySelectorAll('.carousel-slide');
            const centerX = carousel.scrollLeft + carousel.offsetWidth / 2;
            let closestIdx = 0, closestDist = Infinity;
            slides.forEach((slide, idx) => {
                const dist = Math.abs((slide.offsetLeft + slide.offsetWidth / 2) - centerX);
                if (dist < closestDist) { closestDist = dist; closestIdx = idx; }
            });
            slides.forEach((s, i) => s.classList.toggle('active', i === closestIdx));
            this.carouselWorldIndex = closestIdx;
            this.updateCarouselDots(closestIdx);
        };

        // Restore last viewed world, then mark active
        const targetIdx = Math.min(2, Math.max(0, this.carouselWorldIndex || 0));
        requestAnimationFrame(() => {
            if (targetIdx > 0) {
                const slides = carousel.querySelectorAll('.carousel-slide');
                if (slides[targetIdx]) {
                    slides[targetIdx].scrollIntoView({ block: 'nearest', inline: 'center' });
                }
            }
            updateActiveSlide();
        });

        // Level button click events
        carousel.querySelectorAll('.wlg-btn.unlocked').forEach(btn => {
            btn.addEventListener('click', () => {
                const lvl = parseInt(btn.getAttribute('data-level'), 10);
                if (!isNaN(lvl)) this.startGameAtLevel(lvl - 1);
            });
        });

        // World card tap → open expanded overlay
        carousel.querySelectorAll('.carousel-slide').forEach(slide => {
            slide.addEventListener('click', (e) => {
                // Don't open if user clicked a button directly
                if (e.target.closest('.wlg-btn')) return;
                const w = parseInt(slide.getAttribute('data-world'), 10);
                if (!isNaN(w)) this._openWorldExpanded(w);
            });
        });

        // Sync dots + active class on scroll
        carousel.onscroll = updateActiveSlide;
    }

    updateCarouselDots(idx) {
        document.querySelectorAll('#carousel-dots .dot').forEach((d, i) => {
            d.classList.toggle('active', i === idx);
        });
    }

    renderProfile() {
        if (this.inputPlayerName) {
            this.inputPlayerName.value = this.saveSystem.data.playerName;
        }

        // Orb Glow Skin active swatch
        const activeSkin = this.saveSystem.data.orbSkin || 'cyan';
        if (this.skinSwatchesContainer) {
            this.skinSwatchesContainer.querySelectorAll('.skin-swatch').forEach(swatch => {
                if (swatch.getAttribute('data-color') === activeSkin) {
                    swatch.classList.add('active');
                } else {
                    swatch.classList.remove('active');
                }
            });
        }

        // Echo Trail Effect active swatch
        const activeTrail = this.saveSystem.data.trailSkin || 'standard';
        const trailContainer = document.getElementById('trail-swatches');
        if (trailContainer) {
            trailContainer.querySelectorAll('.trail-swatch').forEach(swatch => {
                if (swatch.getAttribute('data-trail') === activeTrail) {
                    swatch.classList.add('active');
                } else {
                    swatch.classList.remove('active');
                }
            });
        }

        // Ghost Toggle Button State
        const isGhostOn = this.saveSystem.data.ghostEnabled !== false;
        const btnProfileGhost = document.getElementById('btn-toggle-ghost');
        if (btnProfileGhost) {
            btnProfileGhost.classList.toggle('active', isGhostOn);
            btnProfileGhost.textContent = isGhostOn ? '👻 GHOST: ON' : '👻 GHOST: OFF';
        }
        const btnPauseGhost = document.getElementById('btn-pause-ghost');
        if (btnPauseGhost) {
            btnPauseGhost.textContent = isGhostOn ? '👻 GHOST: ON' : '👻 GHOST: OFF';
        }

        const lang = this.saveSystem.data.language || 'en';
        const notClearedStr = TRANSLATIONS[lang].notCleared;
        const hudLevelPrefix = TRANSLATIONS[lang].hudLevelPrefix || 'LVL';

        const elCleared = document.getElementById('prof-levels-cleared');
        const elTotalStars = document.getElementById('prof-total-stars');
        const elBounces = document.getElementById('prof-lifetime-bounces');
        const elBestTimes = document.getElementById('best-times-container');

        let totalStars = 0;
        for (let i = 1; i <= this.totalLevels; i++) {
            totalStars += (this.saveSystem.data.stars ? (this.saveSystem.data.stars[i] || 0) : 0);
        }

        if (elCleared) elCleared.textContent = `${this.saveSystem.data.levelsCompleted}/${this.totalLevels}`;
        if (elTotalStars) elTotalStars.textContent = `${totalStars}/45`;
        if (elBounces) elBounces.textContent = this.saveSystem.data.totalLifetimeBounces;

        if (elBestTimes) {
            let html = '';
            for (let i = 1; i <= this.totalLevels; i++) {
                const time = this.saveSystem.data.bestTimes[i];
                const isCleared = time !== null;
                const display = isCleared ? `${time}s` : notClearedStr;
                const valClass = isCleared ? '' : 'uncleared';
                const starCount = (this.saveSystem.data.stars ? (this.saveSystem.data.stars[i] || 0) : 0);
                const starsStr = isCleared ? getStarsString(starCount) : '☆☆☆';

                html += `
                    <div class="best-time-row">
                        <span class="bt-lvl">${hudLevelPrefix} ${i}</span>
                        <span class="bt-stars">${starsStr}</span>
                        <span class="bt-val ${valClass}">${display}</span>
                    </div>
                `;
            }
            elBestTimes.innerHTML = html;
        }
    }

    triggerManualPulse() {
        if (this.pulseCooldown > 0 || this.gameState !== 'PLAYING') return;

        this.pulseCooldown = CONFIG.PULSE_COOLDOWN;
        const waveRadius = Math.max(this.width, this.height) * 0.85;
        const waveColor = this.getWaveColor();
        this.echoWaves.push(new EchoWave(this.player.pos.x, this.player.pos.y, waveRadius, 1.8, waveColor));

        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 / 16) * i;
            const speed = 120 + Math.random() * 100;
            this.particles.push(new Particle(
                this.player.pos.x,
                this.player.pos.y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                waveColor,
                3,
                0.6
            ));
        }
    }

    triggerDeath() {
        if (this.gameState !== 'PLAYING') return;
        this.switchState('DEATH');
        this.deathTimer = 0.9;
        haptic([30, 50, 30]);       // haptic: death rumble
        Audio.playDeath();          // audio: death crunch

        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 220;
            this.particles.push(new Particle(
                this.player.pos.x,
                this.player.pos.y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                CONFIG.COLOR_RED,
                4, 0.7
            ));
        }
    }

    triggerVictory() {
        if (this.gameState !== 'PLAYING' && this.gameState !== 'ABSORBING') return;

        const elapsedSec = (performance.now() - this.levelStartTime) / 1000;
        const res = this.saveSystem.recordLevelVictory(
            this.currentLevelIndex, 
            this.player.bounces, 
            elapsedSec, 
            this.currentTrajectory
        );
        this.lastVictoryStars = res.stars;

        this.switchState('PORTAL_ANIMATION');
        this.portalAnimTimer = 0;

        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 120 + Math.random() * 300;
            const color = i % 2 === 0 ? CONFIG.COLOR_GREEN : CONFIG.COLOR_GOLD;
            this.particles.push(new Particle(
                this.portal.x,
                this.portal.y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                color,
                4.5,
                1.2
            ));
        }

        this.lastElapsedSec = elapsedSec;
    }

    finishVictorySequence() {
        const elapsedSec = this.lastElapsedSec || 0;
        const clearedLevel = this.currentLevelIndex + 1;
        const isLastLevel  = this.currentLevelIndex >= this.totalLevels - 1;

        Audio.playLevelClear();
        this.resetCamera();

        // Fade to black
        const fadeEl = document.getElementById('level-fade-overlay');
        if (fadeEl) fadeEl.classList.add('fading');

        setTimeout(() => {
            if (isLastLevel) {
                // All levels done — return to menu with celebration
                if (fadeEl) fadeEl.classList.remove('fading');
                this.switchState('MENU');
                return;
            }

            // Load the next level silently
            this.startGameAtLevel(this.currentLevelIndex + 1);

            // Brief pause then fade back in
            setTimeout(() => {
                if (fadeEl) fadeEl.classList.remove('fading');

                // Show non-intrusive top toast with Stars!
                const starsStr = getStarsString(this.lastVictoryStars || 1);
                this._showLevelToast(`✓ Level ${clearedLevel} cleared! ${elapsedSec.toFixed(1)}s ${starsStr}`);
            }, 80);
        }, 380);
    }

    _showLevelToast(msg) {
        const el = document.getElementById('level-toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('hidden');
        // Force reflow then animate in
        el.getBoundingClientRect();
        el.classList.add('show');
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.classList.add('hidden'), 350);
        }, 2600);
    }

    _showLockToast(msg) {
        const el = document.getElementById('lock-toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('hidden');
        el.getBoundingClientRect();
        el.classList.add('show');
        clearTimeout(this._lockToastTimeout);
        this._lockToastTimeout = setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.classList.add('hidden'), 350);
        }, 2400);
    }

    _openWorldExpanded(worldNum) {
        const overlay = document.getElementById('world-expanded-overlay');
        const card    = document.getElementById('world-expanded-card');
        if (!overlay || !card) return;

        const lang    = this.saveSystem.data.language || 'en';
        const dict    = TRANSLATIONS[lang];
        const unlocked = this.saveSystem.data.unlockedLevel;

        // World is unlocked if its first level is reachable
        const startLvl = (worldNum - 1) * 5 + 1;
        const endLvl   = worldNum * 5;
        const worldUnlocked = startLvl <= unlocked;

        if (!worldUnlocked) {
            const wName = [dict.world1Title, dict.world2Title, dict.world3Title][worldNum - 1] || `World ${worldNum}`;
            this._showLockToast(`🔒 Complete ${wName} to unlock!`);
            return;
        }

        const worldConfigs = [
            { title: dict.world1Title || 'CYBER NEON',   sub: 'WORLD 1 • LEVELS 1–5',   badge: '⚡', color: 'var(--neon-cyan)',
              bg: 'linear-gradient(160deg,#03030e,#06071c)', art:
              `<div class="wpa-portal"></div><div class="wpa-wall wpa-wall-a"></div><div class="wpa-wall wpa-wall-b"></div>` },
            { title: dict.world2Title || 'EMERALD ABYSS', sub: 'WORLD 2 • LEVELS 6–10',  badge: '🌿', color: 'var(--neon-green)',
              bg: 'linear-gradient(160deg,#020c06,#041510)', art:
              `<div class="wpa-portal"></div><div class="wpa-wall wpa-wall-a"></div><div class="wpa-wall wpa-wall-b"></div>` },
            { title: dict.world3Title || 'SOLAR CORE',    sub: 'WORLD 3 • LEVELS 11–15', badge: '🔥', color: 'var(--neon-gold)',
              bg: 'linear-gradient(160deg,#0d0400,#1b0900)', art:
              `<div class="wpa-portal"></div><div class="wpa-wall wpa-wall-a"></div><div class="wpa-wall wpa-wall-b"></div>` }
        ];
        const cfg = worldConfigs[worldNum - 1];

        let levelsHtml = '';
        for (let i = startLvl; i <= endLvl; i++) {
            const isUnlocked = i <= unlocked;
            const bestTime   = this.saveSystem.data.bestTimes[i];
            const isCleared  = bestTime !== null;
            const timeStr    = isCleared ? `${bestTime}s` : '—';
            const timeClass  = isCleared ? 'cleared' : 'uncleared';
            const btnClass   = isUnlocked ? 'unlocked' : 'locked';
            const starCount  = (this.saveSystem.data.stars ? (this.saveSystem.data.stars[i] || 0) : 0);
            const starsStr   = isCleared ? getStarsString(starCount) : '☆☆☆';

            levelsHtml += `<div class="wlg-btn ${btnClass}" data-level="${i}">
                <span class="wlg-num">${i}</span>
                <span class="wlg-stars">${starsStr}</span>
                <span class="wlg-time ${timeClass}">${timeStr}</span>
            </div>`;
        }

        const gridStyle = `
            repeating-linear-gradient(0deg,transparent,transparent 29px,rgba(255,255,255,0.04) 30px),
            repeating-linear-gradient(90deg,transparent,transparent 29px,rgba(255,255,255,0.04) 30px),
            ${cfg.bg}`;

        card.innerHTML = `
            <div class="wec-preview-art" style="background:${gridStyle}">${cfg.art}</div>
            <div class="wec-header">
                <div class="wec-header-content">
                    <div class="world-badge">${cfg.badge}</div>
                    <div class="world-card-info">
                        <h3 class="world-card-title" style="color:${cfg.color}">${cfg.title}</h3>
                        <p class="world-card-sub">${cfg.sub}</p>
                    </div>
                </div>
            </div>
            <div class="wec-level-grid">${levelsHtml}</div>
            <button class="wec-btn-close" id="btn-wec-close">← BACK TO WORLDS</button>
        `;

        // Wire level buttons
        card.querySelectorAll('.wlg-btn.unlocked').forEach(btn => {
            btn.addEventListener('click', () => {
                const lvl = parseInt(btn.getAttribute('data-level'), 10);
                if (!isNaN(lvl)) {
                    overlay.classList.add('hidden');
                    this.startGameAtLevel(lvl - 1);
                }
            });
        });

        // Close button
        document.getElementById('btn-wec-close')?.addEventListener('click', () => {
            overlay.classList.add('hidden');
        });

        overlay.classList.remove('hidden');
    }

    triggerAbsorption() {
        if (this.gameState !== 'PLAYING') return;
        this.absorptionTimer = 0;
        if (this.player) {
            this.player.vel.x = 0;
            this.player.vel.y = 0;
        }
        haptic([15, 30, 60, 30, 80]); // haptic: portal pulse rumble
        Audio.playPortalEntry();        // audio: cosmic whoosh
        this.switchState('ABSORBING');
    }

    resetLevel() {
        this.loadLevel(this.currentLevelIndex);
        this.switchState('PLAYING');
    }

    update(dt) {
        if (this.pulseCooldown > 0) {
            this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
            if (this.elCooldownBar) {
                const ratio = this.pulseCooldown / CONFIG.PULSE_COOLDOWN;
                this.elCooldownBar.style.transform = `scaleX(${ratio})`;
            }
        }

        if (this.gameState === 'DEATH') {
            this.deathTimer -= dt;
            if (this.deathTimer <= 0) {
                this.resetLevel();
            }
        }

        if (this.gameState === 'PORTAL_ANIMATION') {
            this.portalAnimTimer += dt;

            if (this.portal) {
                const lerpRate = dt * 6.0;
                this.camera.x += (this.portal.x - this.camera.x) * lerpRate;
                this.camera.y += (this.portal.y - this.camera.y) * lerpRate;
                this.camera.scale += (4.5 - this.camera.scale) * (dt * 4.5);
            }

            if (this.portalAnimTimer > 0.4) {
                const flashProgress = (this.portalAnimTimer - 0.4) / 0.6;
                this.camera.flashAlpha = Math.min(1.0, flashProgress);
            }

            if (this.portalAnimTimer >= 1.0) {
                this.finishVictorySequence();
            }
        }

        if (this.gameState === 'PLAYING') {
            this.player.update(dt, this);

            // Trajectory recording for Ghost Replay
            this.recordTimer += dt;
            if (this.recordTimer >= 0.04) {
                this.recordTimer = 0;
                if (!this.currentTrajectory) this.currentTrajectory = [];
                this.currentTrajectory.push([
                    Math.round(this.player.pos.x * 10) / 10,
                    Math.round(this.player.pos.y * 10) / 10
                ]);
            }

            // Ghost Orb Playback Update
            if (this.saveSystem.data.ghostEnabled !== false && this.ghostData && this.ghostData.length > 1) {
                this.ghostTime += dt;
                const sampleIndex = this.ghostTime / 0.04;
                const idx = Math.floor(sampleIndex);
                if (idx < this.ghostData.length - 1) {
                    const p1 = this.ghostData[idx];
                    const p2 = this.ghostData[idx + 1];
                    const t = sampleIndex - idx;
                    this.ghostPos = {
                        x: p1[0] + (p2[0] - p1[0]) * t,
                        y: p1[1] + (p2[1] - p1[1]) * t
                    };
                } else if (idx < this.ghostData.length) {
                    this.ghostPos = { x: this.ghostData[this.ghostData.length - 1][0], y: this.ghostData[this.ghostData.length - 1][1] };
                } else {
                    this.ghostPos = null;
                }
            } else {
                this.ghostPos = null;
            }

            // Gravitational portal pull — magnetic attraction when close
            if (this.portal) {
                const pdx = this.portal.x - this.player.pos.x;
                const pdy = this.portal.y - this.player.pos.y;
                const pdist = Math.hypot(pdx, pdy);
                const PULL_RADIUS = 90;
                if (pdist < PULL_RADIUS && pdist > 0) {
                    const pullStr = 500 * Math.pow(1 - pdist / PULL_RADIUS, 1.5);
                    this.player.vel.x += (pdx / pdist) * pullStr * dt;
                    this.player.vel.y += (pdy / pdist) * pullStr * dt;
                }
            }

            for (const hazard of this.hazards) {
                if (hazard.checkCollision(this.player)) {
                    this.triggerDeath();
                    break;
                }
            }

            if (this.gameState === 'PLAYING' && this.portal && this.portal.checkCollision(this.player)) {
                this.triggerAbsorption();
            }
        }

        // Portal absorption animation: shrink orb into portal, then trigger victory zoom
        if (this.gameState === 'ABSORBING') {
            const ABSORB_DURATION = 0.45;
            this.absorptionTimer += dt;
            const progress = Math.min(1, this.absorptionTimer / ABSORB_DURATION);

            if (this.portal && this.player) {
                // Smooth lerp orb toward portal center
                const lerpRate = dt * 14;
                this.player.pos.x += (this.portal.x - this.player.pos.x) * lerpRate;
                this.player.pos.y += (this.portal.y - this.player.pos.y) * lerpRate;
                this.player.vel.x = 0;
                this.player.vel.y = 0;
                this.player.drawScale = Math.max(0, 1 - progress);

                // Spiral particles pulled into portal
                if (Math.random() < 0.7) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.max(0, this.portal.radius * (1.8 - progress * 1.5));
                    this.particles.push(new Particle(
                        this.portal.x + Math.cos(angle) * r,
                        this.portal.y + Math.sin(angle) * r,
                        (Math.random() - 0.5) * 20,
                        (Math.random() - 0.5) * 20,
                        Math.random() < 0.5 ? CONFIG.COLOR_GREEN : CONFIG.COLOR_GOLD,
                        2.5, 0.3
                    ));
                }
            }

            if (this.absorptionTimer >= ABSORB_DURATION) {
                this.triggerVictory();
            }
        }

        for (let i = this.echoWaves.length - 1; i >= 0; i--) {
            const wave = this.echoWaves[i];
            wave.update(dt);
            if (wave.isFinished()) {
                this.echoWaves.splice(i, 1);
            }
        }

        for (const wall of this.walls) {
            wall.update(dt, this.echoWaves);
        }

        for (const hazard of this.hazards) {
            hazard.update(dt, this.echoWaves);
        }

        if (this.portal) {
            this.portal.update(dt, this.echoWaves);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render() {
        this.ctx.save();

        this.ctx.fillStyle = '#0a0a12';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.camera.scale !== 1.0 || this.camera.x !== this.width / 2 || this.camera.y !== this.height / 2) {
            this.ctx.translate(this.width / 2, this.height / 2);
            this.ctx.scale(this.camera.scale, this.camera.scale);
            this.ctx.translate(-this.camera.x, -this.camera.y);
        }

        this.renderGrid();

        for (const wall of this.walls) {
            wall.draw(this.ctx);
        }

        for (const hazard of this.hazards) {
            hazard.draw(this.ctx);
        }

        if (this.portal) {
            this.portal.draw(this.ctx);
        }

        for (const wave of this.echoWaves) {
            wave.draw(this.ctx);
        }

        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].draw(this.ctx);
        }

        // Draw Ghost Orb (PB Replay)
        if (this.ghostPos && this.saveSystem.data.ghostEnabled !== false && this.gameState !== 'MENU') {
            this.drawGhostOrb(this.ctx);
        }

        if (this.player && this.gameState !== 'DEATH' && this.gameState !== 'MENU') {
            this.player.draw(this.ctx);
        }

        this.ctx.restore();

        if (this.camera.flashAlpha > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = Math.min(1.0, this.camera.flashAlpha);
            this.ctx.fillStyle = '#00ff88';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.restore();
        }
    }

    drawGhostOrb(ctx) {
        if (!this.ghostPos) return;
        const gx = this.ghostPos.x;
        const gy = this.ghostPos.y;

        ctx.save();
        ctx.globalAlpha = 0.35;

        // Outer glow
        const glowRadius = CONFIG.ORB_RADIUS * 2.8;
        const gGrad = ctx.createRadialGradient(gx, gy, 2, gx, gy, glowRadius);
        gGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gGrad.addColorStop(0.5, 'rgba(0, 243, 255, 0.5)');
        gGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.arc(gx, gy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Dashed glowing circle
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(gx, gy, CONFIG.ORB_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        // Ghost text label above ghost orb
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 243, 255, 0.9)';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👻 GHOST', gx, gy - 18);

        ctx.restore();
    }

    renderGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        this.ctx.lineWidth = 1;

        const gridSize = 40;
        for (let x = 0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        if (dt > 0.05) dt = 0.05;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new EchoBounceGame();
});
