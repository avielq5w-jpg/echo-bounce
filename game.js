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

    playBounce()      {
        if (this._ready && (!window.game || window.game.saveSystem.data.sfxEnabled !== false)) this._tone(260, 130, 0.1, 'triangle', 0.07);
    }
    playPulse()       {
        if (this._ready && (!window.game || window.game.saveSystem.data.sfxEnabled !== false)) this._tone(880, 440, 0.09, 'sine', 0.06);
    }
    playPortalEntry() {
        if (!this._ready || (window.game && window.game.saveSystem.data.sfxEnabled === false)) return;
        this._tone(440, 1200, 0.55, 'sine', 0.16);
        this._tone(660, 1800, 0.4,  'sine', 0.10, 0.08);
    }
    playDeath() {
        if (!this._ready || (window.game && window.game.saveSystem.data.sfxEnabled === false)) return;
        this._tone(180, 90, 0.12, 'sawtooth', 0.12);
        this._tone(120, 60, 0.22, 'sawtooth', 0.07, 0.1);
    }
    playLevelClear() {
        if (!this._ready || (window.game && window.game.saveSystem.data.sfxEnabled === false)) return;
        [523, 659, 784, 1047].forEach((f, i) =>
            this._tone(f, f * 1.1, 0.14, 'sine', 0.1, i * 0.09)
        );
    }
}

const Audio = new AudioManager();

// Haptic helper — respects hapticsEnabled setting
function haptic(pattern) {
    try {
        if (navigator.vibrate && window.game && window.game.saveSystem && window.game.saveSystem.data.hapticsEnabled !== false) {
            navigator.vibrate(pattern);
        } else if (navigator.vibrate && (!window.game || !window.game.saveSystem)) {
            navigator.vibrate(pattern); // fallback before game init
        }
    } catch(e) {}
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
    COLOR_RED: '#ff2a2a',
    // Endless Mode
    ENDLESS_PX_PER_METER: 40,
    ENDLESS_SCROLL_BASE: 28,       // comfortable start once pressure engages
    ENDLESS_SCROLL_ACCEL: 0.85,    // subtle per-meter increase
    ENDLESS_SCROLL_MAX: 160,
    ENDLESS_FALL_MARGIN: 28,
    // Set false before App Store / Play release — enables Endless camera overlay on device too
    DEV_TOOLS: true
};

/** Dev tools: CONFIG.DEV_TOOLS, ?dev=1, localStorage, or local browser. */
function isDevMode() {
    try {
        if (CONFIG.DEV_TOOLS === true) return true;
        const params = new URLSearchParams(window.location.search || '');
        const q = params.get('dev');
        if (q === '1' || q === 'true') return true;
        if (q === '0' || q === 'false') return false;
        if (localStorage.getItem('echo_bounce_dev') === '1') return true;
        const native = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
            && window.Capacitor.isNativePlatform());
        if (native) return false;
        const host = window.location.hostname || '';
        return host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:';
    } catch (e) {
        return false;
    }
}

// Strict 4-Color Palettes per World
const WORLD_THEMES = {
    0: {
        bg: '#0A0C14',
        wall: '#00E5FF',
        hazard: '#FF007F',
        portalBase: '#7B1FA2',
        portalAccent: '#00E5FF'
    },
    1: {
        bg: '#0B0C10',
        wall: '#00E5FF',
        hazard: '#FF007F',
        portalBase: '#7B1FA2',
        portalAccent: '#00E5FF'
    },
    2: {
        bg: '#051914',
        wall: '#00FF87',
        hazard: '#FFD700',
        portalBase: '#004D40',
        portalAccent: '#FFD700'
    },
    3: {
        bg: '#1A0505',
        wall: '#FF9900',
        hazard: '#FF003C',
        portalBase: '#4A000B',
        portalAccent: '#FF9900'
    }
};

// Skin Glow Color Mapping
const SKINS = {
    cyan: '#00f3ff',
    gold: '#ffe600',
    pink: '#ff007f',
    green: '#00ff88',
    purple: '#a100ff'
};

// Unified Theme Presets: each sets orbSkin + trailSkin together
const THEMES = {
    cyber:   { color: 'cyan',   trail: 'standard', label: 'Cyber Neon' },
    solar:   { color: 'gold',   trail: 'fire',      label: 'Solar Fire' },
    arctic:  { color: 'cyan',   trail: 'ice',       label: 'Arctic Ice'  },
    volt:    { color: 'purple', trail: 'electric',  label: 'Volt Electric' },
    emerald: { color: 'green',  trail: 'standard',  label: 'Emerald Abyss' },
    crimson: { color: 'pink',   trail: 'fire',      label: 'Crimson Storm' }
};

// 3-Star Rating Target Thresholds per Level { time: maxSec, bounces: maxBounces }
const LEVEL_TARGETS = {
    1:  { time: 6.0,  bounces: 4 },
    2:  { time: 8.0,  bounces: 6 },
    3:  { time: 10.0, bounces: 8 },
    4:  { time: 10.0, bounces: 8 },
    5:  { time: 12.0, bounces: 10 },
    6:  { time: 14.0, bounces: 12 },
    7:  { time: 14.0, bounces: 12 },
    8:  { time: 15.0, bounces: 13 },
    9:  { time: 16.0, bounces: 14 },
    10: { time: 16.0, bounces: 15 },
    11: { time: 18.0, bounces: 16 },
    12: { time: 18.0, bounces: 16 },
    13: { time: 20.0, bounces: 18 },
    14: { time: 12.0, bounces: 10 },
    15: { time: 14.0, bounces: 12 },
    16: { time: 15.0, bounces: 13 },
    17: { time: 16.0, bounces: 14 },
    18: { time: 18.0, bounces: 15 },
    19: { time: 18.0, bounces: 16 },
    20: { time: 20.0, bounces: 18 },
    21: { time: 20.0, bounces: 18 },
    22: { time: 22.0, bounces: 20 },
    23: { time: 24.0, bounces: 22 },
    24: { time: 12.0, bounces: 10 },
    25: { time: 14.0, bounces: 12 },
    26: { time: 15.0, bounces: 13 },
    27: { time: 16.0, bounces: 14 },
    28: { time: 18.0, bounces: 16 },
    29: { time: 18.0, bounces: 16 },
    30: { time: 20.0, bounces: 18 },
    31: { time: 22.0, bounces: 20 },
    32: { time: 24.0, bounces: 22 },
    33: { time: 26.0, bounces: 24 }
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
        menuCampaign: "CAMPAIGN MODE",
        menuCampaignSub: "Story worlds & levels",
        menuEndless: "ENDLESS MODE",
        menuEndlessSub: "Climb until you fall",
        menuLevels: "LEVEL SELECT",
        menuLeaderboard: "LEADERBOARD",
        leaderboardSoon: "Leaderboard coming soon",
        menuProfile: "PROFILE & SKINS",
        menuProfileShort: "Profile",
        menuSettings: "Settings",
        endlessGameOverTitle: "RUN OVER",
        endlessGameOverDesc: "You fell behind the climb.",
        endlessDistance: "Distance",
        endlessBest: "Best",
        btnRetry: "TRY AGAIN",
        menuTutorial: "HOW TO PLAY",
        levelSelectTitle: "LEVEL SELECT",
        levelSelectSub: "Tap world card to view stages",
        world0Title: "TRAINING GROUND",
        world0Sub: "WORLD 0 • LEVELS 1–3",
        world1Title: "CYBER NEON",
        world1Sub: "WORLD 1 • LEVELS 4–13",
        world2Title: "EMERALD ABYSS",
        world2Sub: "WORLD 2 • LEVELS 14–23",
        world3Title: "SOLAR CORE",
        world3Sub: "WORLD 3 • LEVELS 24–33",
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
        pauseSoundOn: "Sound",
        pauseSoundOff: "Sound",
        pauseVibrateOn: "Vibration",
        pauseVibrateOff: "Vibration",
        btnResume: "RESUME GAME",
        btnRestart: "RESTART LEVEL",
        btnMainMenu: "MAIN MENU",
        deathTitle: "HAZARD IMPACT!",
        deathSub: "Restarting level...",
        mBounces: "Bounces",
        mTime: "Time Taken",
        btnNextLevel: "NEXT LEVEL",
        hudLevelPrefix: "LVL",
        level1Hint: "Tap anywhere to bounce. Reach the portal!",
        level2Hint: "Tap the glowing button to reveal walls!",
        level3Hint: "Avoid the pink spike. Reach the portal!",
        levelCompleteTitle: "LEVEL COMPLETE!",
        levelCompleteDesc: (lvl) => `Level ${lvl} cleared! Get ready for Level ${lvl + 1}.`,
        allCompleteTitle: "ALL WORLDS CLEARED!",
        allCompleteDesc: "Master of Echoes! You conquered all 33 levels across 4 worlds.",
        notCleared: "Not Cleared"
    },
    he: {
        langCode: "HE",
        langLabel: "🇮🇱 HE",
        heroSubtitle: "נווט בחשיכה",
        menuPlay: "התחל למשחק",
        menuCampaign: "מצב קמפיין",
        menuCampaignSub: "עולמות ושלבי סיפור",
        menuEndless: "מצב אינסופי",
        menuEndlessSub: "טפס עד שתיפול",
        menuLevels: "בחירת שלב",
        menuLeaderboard: "טבלת שיאים",
        leaderboardSoon: "טבלת השיאים בקרוב",
        menuProfile: "פרופיל וערכות נושא",
        menuProfileShort: "פרופיל",
        menuSettings: "הגדרות",
        endlessGameOverTitle: "הריצה הסתיימה",
        endlessGameOverDesc: "נפלת מתחת למסך העולה.",
        endlessDistance: "מרחק",
        endlessBest: "שיא",
        btnRetry: "נסה שוב",
        menuTutorial: "איך משחקים",
        levelSelectTitle: "בחירת שלב",
        levelSelectSub: "הקש על כרטיס העולם לצפייה בשלבים",
        world1Title: "ניאון סייבר",
        world2Title: "תהום ברקת",
        world3Title: "ליבה סולארית",
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
        pauseSoundOn: "צליל",
        pauseSoundOff: "צליל",
        pauseVibrateOn: "רטט",
        pauseVibrateOff: "רטט",
        btnResume: "המשך במשחק",
        btnRestart: "אפס שלב",
        btnMainMenu: "תפריט ראשי",
        deathTitle: "פגיעה במוקש!",
        deathSub: "מאתחל שלב...",
        mBounces: "קפיצות",
        mTime: "זמן",
        btnNextLevel: "השלב הבא",
        hudLevelPrefix: "שלב",
        level1Hint: "לחץ בכל מקום כדי לקפוץ. הגע לפורטל!",
        level2Hint: "לחץ על הכפתור הזוהר כדי לגלות קירות!",
        level3Hint: "הימנע מהמוקש הוורוד. הגע לפורטל!",
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
        menuCampaign: "MODO CAMPAÑA",
        menuCampaignSub: "Mundos e historia",
        menuEndless: "MODO INFINITO",
        menuEndlessSub: "Sube hasta caer",
        menuLevels: "NIVELES",
        menuLeaderboard: "CLASIFICACIÓN",
        leaderboardSoon: "Clasificación pronto",
        menuProfile: "PERFIL Y SKINS",
        menuProfileShort: "Perfil",
        menuSettings: "Ajustes",
        endlessGameOverTitle: "FIN DE LA CARRERA",
        endlessGameOverDesc: "Caíste por debajo de la subida.",
        endlessDistance: "Distancia",
        endlessBest: "Mejor",
        btnRetry: "REINTENTAR",
        menuTutorial: "CÓMO JUGAR",
        levelSelectTitle: "SELECCIÓN DE NIVEL",
        levelSelectSub: "Toca la tarjeta del mundo para ver etapas",
        world1Title: "CIBER NEÓN",
        world2Title: "ABISMO ESMERALDA",
        world3Title: "NÚCLEO SOLAR",
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
        pauseSoundOn: "Sonido",
        pauseSoundOff: "Sonido",
        pauseVibrateOn: "Vibración",
        pauseVibrateOff: "Vibración",
        btnResume: "REANUDAR",
        btnRestart: "REINICIAR NIVEL",
        btnMainMenu: "MENÚ PRINCIPAL",
        deathTitle: "¡IMPACTO DE PELIGRO!",
        deathSub: "Reiniciando nivel...",
        mBounces: "Rebotes",
        mTime: "Tiempo",
        btnNextLevel: "SIGUIENTE NIVEL",
        hudLevelPrefix: "NIV",
        level1Hint: "¡Toca en cualquier lugar para rebotar. Llega al portal!",
        level2Hint: "¡Toca el botón brillante para revelar paredes!",
        level3Hint: "¡Evita la trampa rosa. Llega al portal!",
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
        menuCampaign: "MODE CAMPAGNE",
        menuCampaignSub: "Mondes & niveaux",
        menuEndless: "MODE SANS FIN",
        menuEndlessSub: "Grimpez jusqu'à la chute",
        menuLevels: "NIVEAUX",
        menuLeaderboard: "CLASSEMENT",
        leaderboardSoon: "Classement bientôt",
        menuProfile: "PROFIL ET SKINS",
        menuProfileShort: "Profil",
        menuSettings: "Réglages",
        endlessGameOverTitle: "COURSE TERMINÉE",
        endlessGameOverDesc: "Vous êtes tombé sous l'écran.",
        endlessDistance: "Distance",
        endlessBest: "Record",
        btnRetry: "RÉESSAYER",
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
        pauseSoundOn: "Son",
        pauseSoundOff: "Son",
        pauseVibrateOn: "Vibration",
        pauseVibrateOff: "Vibration",
        btnResume: "REPRENDRE",
        btnRestart: "RECOMMENCER",
        btnMainMenu: "MENU PRINCIPAL",
        deathTitle: "IMPACT DE DANGER!",
        deathSub: "Redémarrage du niveau...",
        mBounces: "Rebonds",
        mTime: "Temps",
        btnNextLevel: "NIVEAU SUIVANT",
        hudLevelPrefix: "NIV",
        level1Hint: "Touchez n'importe où pour rebondir. Atteignez le portail!",
        level2Hint: "Touchez le bouton lumineux pour révéler les murs!",
        level3Hint: "Évitez le piège rose. Atteignez le portail!",
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
        menuCampaign: "キャンペーン",
        menuCampaignSub: "ストーリーワールド",
        menuEndless: "エンドレス",
        menuEndlessSub: "落ちるまで登れ",
        menuLevels: "ステージ選択",
        menuLeaderboard: "リーダーボード",
        leaderboardSoon: "リーダーボードは近日公開",
        menuProfile: "プロフィール",
        menuProfileShort: "プロフィール",
        menuSettings: "設定",
        endlessGameOverTitle: "ラン終了",
        endlessGameOverDesc: "画面の下に落ちました。",
        endlessDistance: "距離",
        endlessBest: "ベスト",
        btnRetry: "リトライ",
        menuTutorial: "遊び方",
        levelSelectTitle: "ステージ選択",
        levelSelectSub: "ワールドカードをタップしてステージを表示",
        world1Title: "サイバーネオン",
        world2Title: "エメラルドの深淵",
        world3Title: "ソーラーコア",
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
        pauseSoundOn: "サウンド",
        pauseSoundOff: "サウンド",
        pauseVibrateOn: "振動",
        pauseVibrateOff: "振動",
        btnResume: "再開する",
        btnRestart: "リトライ",
        btnMainMenu: "メインメニュー",
        deathTitle: "トラップに衝突！",
        deathSub: "リトライ中...",
        mBounces: "バウンド数",
        mTime: "タイム",
        btnNextLevel: "次のステージ",
        hudLevelPrefix: "STAGE",
        level1Hint: "どこでもタップして跳ねよう。ポータルを目指せ！",
        level2Hint: "光るボタンをタップして壁を見よう！",
        level3Hint: "ピンクのトゲを避けてポータルへ！",
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
            theme: 'cyber',
            ghostEnabled: true,
            sfxEnabled: true,
            hapticsEnabled: true,
            unlockedLevel: 99, // Dev/Debug Override: Unlock all 33 levels across 4 worlds for testing
            totalLifetimeBounces: 0,
            levelsCompleted: 0,
            bestTimes: {},
            stars: {},
            ghostTrajectories: {},
            endlessBestDistance: 0
        };
        for (let i = 1; i <= 33; i++) {
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
                    unlockedLevel: 99, // Dev Override: force all worlds unlocked
                    stars: { ...this.data.stars, ...(parsed.stars || {}) },
                    ghostTrajectories: { ...this.data.ghostTrajectories, ...(parsed.ghostTrajectories || {}) },
                    endlessBestDistance: Math.max(0, parsed.endlessBestDistance || 0)
                };
            }
        } catch (e) {
            console.warn('Could not load saved data from localStorage', e);
        }
    }

    recordEndlessRun(distanceM) {
        const dist = Math.max(0, Math.floor(distanceM));
        const prev = this.data.endlessBestDistance || 0;
        const isNewBest = dist > prev;
        if (isNewBest) {
            this.data.endlessBestDistance = dist;
            this.save();
        }
        return { distance: dist, best: this.data.endlessBestDistance || 0, isNewBest };
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

// --- Endless Mode: hand-authored passable chunks (world Y grows upward = decreasing y) ---
// Endless chunk bands by distance (meters)
const ENDLESS_CHUNKS = [
    // 0–50m Warmup — wide platforms, no traps
    {
        id: 'warmup_open',
        band: 'warmup',
        height: 260,
        build(game, yTop, w, colors) {
            const y = yTop + 130;
            const gap = 160;
            game._endlessAddWall(0, y, w * 0.5 - gap * 0.5, y, colors.wall);
            game._endlessAddWall(w * 0.5 + gap * 0.5, y, w, y, colors.wall);
        }
    },
    {
        id: 'warmup_left',
        band: 'warmup',
        height: 250,
        build(game, yTop, w, colors) {
            game._endlessAddWall(w * 0.4, yTop + 125, w, yTop + 125, colors.wall);
        }
    },
    {
        id: 'warmup_right',
        band: 'warmup',
        height: 250,
        build(game, yTop, w, colors) {
            game._endlessAddWall(0, yTop + 125, w * 0.6, yTop + 125, colors.wall);
        }
    },
    {
        id: 'warmup_steps',
        band: 'warmup',
        height: 280,
        build(game, yTop, w, colors) {
            game._endlessAddWall(0, yTop + 90, w * 0.65, yTop + 90, colors.wall);
            game._endlessAddWall(w * 0.35, yTop + 200, w, yTop + 200, colors.wall);
        }
    },
    // 50–100m — occasional static mid-air traps
    {
        id: 'static_air_left',
        band: 'staticTraps',
        height: 270,
        build(game, yTop, w, colors) {
            game._endlessAddWall(w * 0.35, yTop + 135, w, yTop + 135, colors.wall);
            game._endlessAddHazard(w * 0.22, yTop + 70, 15, colors.hazard);
        }
    },
    {
        id: 'static_air_right',
        band: 'staticTraps',
        height: 270,
        build(game, yTop, w, colors) {
            game._endlessAddWall(0, yTop + 135, w * 0.65, yTop + 135, colors.wall);
            game._endlessAddHazard(w * 0.78, yTop + 70, 15, colors.hazard);
        }
    },
    {
        id: 'static_center_shelf',
        band: 'staticTraps',
        height: 280,
        build(game, yTop, w, colors) {
            const y = yTop + 140;
            const gap = 110;
            game._endlessAddWall(0, y, w * 0.5 - gap * 0.5, y, colors.wall);
            game._endlessAddWall(w * 0.5 + gap * 0.5, y, w, y, colors.wall);
            if (Math.random() < 0.55) {
                game._endlessAddHazard(w * 0.5, yTop + 60, 14, colors.hazard);
            }
        }
    },
    // 100–125m — sparse diagonals
    {
        id: 'diag_left_ramp',
        band: 'diagonal',
        height: 290,
        build(game, yTop, w, colors) {
            game._endlessAddWall(w * 0.1, yTop + 60, w * 0.45, yTop + 180, colors.wall);
            game._endlessAddWall(w * 0.55, yTop + 220, w, yTop + 220, colors.wall);
        }
    },
    {
        id: 'diag_right_ramp',
        band: 'diagonal',
        height: 290,
        build(game, yTop, w, colors) {
            game._endlessAddWall(w * 0.9, yTop + 60, w * 0.55, yTop + 180, colors.wall);
            game._endlessAddWall(0, yTop + 220, w * 0.45, yTop + 220, colors.wall);
        }
    },
    {
        id: 'diag_soft_v',
        band: 'diagonal',
        height: 280,
        build(game, yTop, w, colors) {
            game._endlessAddWall(w * 0.12, yTop + 50, w * 0.4, yTop + 160, colors.wall);
            game._endlessAddWall(w * 0.88, yTop + 50, w * 0.6, yTop + 160, colors.wall);
            game._endlessAddWall(0, yTop + 230, w * 0.32, yTop + 230, colors.wall);
            game._endlessAddWall(w * 0.68, yTop + 230, w, yTop + 230, colors.wall);
        }
    },
    // 125–150m — floating squares & triangles
    {
        id: 'shapes_square_lane',
        band: 'shapes',
        height: 290,
        build(game, yTop, w, colors) {
            game._endlessAddWall(0, yTop + 200, w * 0.55, yTop + 200, colors.wall);
            game._endlessAddBox(w * 0.72, yTop + 100, 44, 44, colors.wall);
            game._endlessAddHazard(w * 0.3, yTop + 90, 14, colors.hazard);
        }
    },
    {
        id: 'shapes_tri_pair',
        band: 'shapes',
        height: 300,
        build(game, yTop, w, colors) {
            game._endlessAddWall(w * 0.4, yTop + 220, w, yTop + 220, colors.wall);
            game._endlessAddTriangle(w * 0.25, yTop + 110, 48, colors.wall);
            game._endlessAddBox(w * 0.7, yTop + 80, 36, 36, colors.wall);
        }
    },
    {
        id: 'shapes_scatter',
        band: 'shapes',
        height: 300,
        build(game, yTop, w, colors) {
            const y = yTop + 230;
            const gap = 100;
            game._endlessAddWall(0, y, w * 0.5 - gap * 0.5, y, colors.wall);
            game._endlessAddWall(w * 0.5 + gap * 0.5, y, w, y, colors.wall);
            game._endlessAddTriangle(w * 0.5, yTop + 100, 42, colors.wall);
            game._endlessAddBox(w * 0.2, yTop + 140, 32, 32, colors.wall);
        }
    },
    // 150–200m — slow moving traps
    {
        id: 'moving_slow_left',
        band: 'moving',
        height: 280,
        build(game, yTop, w, colors) {
            const y = yTop + 145;
            const gap = 105;
            game._endlessAddWall(0, y, w * 0.5 - gap * 0.5, y, colors.wall);
            game._endlessAddWall(w * 0.5 + gap * 0.5, y, w, y, colors.wall);
            game._endlessAddMovingHazard(w * 0.1, y - 18, w * 0.5 - gap * 0.5 - 24, y - 18, 55, 15, colors.hazard);
        }
    },
    {
        id: 'moving_slow_right',
        band: 'moving',
        height: 280,
        build(game, yTop, w, colors) {
            game._endlessAddWall(0, yTop + 140, w * 0.62, yTop + 140, colors.wall);
            game._endlessAddMovingHazard(w * 0.15, yTop + 140 - 18, w * 0.5, yTop + 140 - 18, 60, 15, colors.hazard);
            game._endlessAddWall(w * 0.4, yTop + 240, w, yTop + 240, colors.wall);
        }
    },
    {
        id: 'moving_mid_air',
        band: 'moving',
        height: 290,
        build(game, yTop, w, colors) {
            game._endlessAddWall(w * 0.3, yTop + 210, w, yTop + 210, colors.wall);
            game._endlessAddMovingHazard(w * 0.2, yTop + 90, w * 0.75, yTop + 90, 50, 14, colors.hazard);
        }
    },
    // 200m+ — faster movers + diagonals + shapes
    {
        id: 'challenge_combo_a',
        band: 'challenge',
        height: 310,
        build(game, yTop, w, colors) {
            game._endlessAddWall(w * 0.1, yTop + 50, w * 0.42, yTop + 150, colors.wall);
            game._endlessAddWall(w * 0.55, yTop + 200, w, yTop + 200, colors.wall);
            game._endlessAddMovingHazard(w * 0.58, yTop + 200 - 18, w * 0.9, yTop + 200 - 18, 120, 15, colors.hazard);
            game._endlessAddBox(w * 0.25, yTop + 230, 36, 36, colors.wall);
        }
    },
    {
        id: 'challenge_combo_b',
        band: 'challenge',
        height: 320,
        build(game, yTop, w, colors) {
            game._endlessAddWall(0, yTop + 90, w * 0.55, yTop + 90, colors.wall);
            game._endlessAddHazard(w * 0.3, yTop + 90 - 18, 15, colors.hazard);
            game._endlessAddWall(w * 0.9, yTop + 140, w * 0.5, yTop + 230, colors.wall);
            game._endlessAddMovingHazard(w * 0.15, yTop + 160, w * 0.45, yTop + 160, 130, 14, colors.hazard);
            game._endlessAddTriangle(w * 0.7, yTop + 280, 40, colors.wall);
        }
    },
    {
        id: 'challenge_combo_c',
        band: 'challenge',
        height: 300,
        build(game, yTop, w, colors) {
            const y = yTop + 150;
            const gap = 90;
            game._endlessAddWall(0, y, w * 0.5 - gap * 0.5, y, colors.wall);
            game._endlessAddWall(w * 0.5 + gap * 0.5, y, w, y, colors.wall);
            game._endlessAddMovingHazard(w * 0.08, y - 18, w * 0.5 - gap * 0.5 - 18, y - 18, 140, 15, colors.hazard);
            game._endlessAddBox(w * 0.5, yTop + 70, 40, 40, colors.wall);
            game._endlessAddHazard(w * 0.78, yTop + 240, 15, colors.hazard);
        }
    }
];

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
        this.vx *= 0.95;
        this.vy *= 0.95;
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
        // shadowBlur removed: extremely expensive on Android WebView GPUs
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- Nexus Live Wallpaper Background Stream System ---
class NexusStream {
    constructor(width, height, gridSize = 40) {
        this.gridSize = gridSize;
        this.reset(width, height, true);
    }

    reset(width, height, isInitial = false) {
        this.isVert = Math.random() < 0.5;
        this.speed = (60 + Math.random() * 80) * (Math.random() < 0.5 ? 1 : -1);
        
        // Colors directly inspired by classic Nexus Live Wallpaper (Cyan, Blue, Gold, Green, Red)
        const colors = [
            { head: '#00f3ff', glow: 'rgba(0, 243, 255, 0.5)' },   // Cyan
            { head: '#3399ff', glow: 'rgba(51, 153, 255, 0.5)' },   // Nexus Blue
            { head: '#ffcc00', glow: 'rgba(255, 204, 0, 0.5)' },   // Nexus Gold
            { head: '#00ff88', glow: 'rgba(0, 255, 136, 0.5)' },   // Nexus Green
            { head: '#ff3344', glow: 'rgba(255, 51, 68, 0.5)' }     // Nexus Red
        ];
        this.colorCfg = colors[Math.floor(Math.random() * colors.length)];
        this.headSize = 10 + Math.floor(Math.random() * 4); // 10px to 13px square head
        this.trailLength = 160 + Math.random() * 140;       // glowing tail length

        const colCount = Math.max(1, Math.floor((width || 400) / this.gridSize));
        const rowCount = Math.max(1, Math.floor((height || 800) / this.gridSize));

        if (this.isVert) {
            const col = Math.floor(Math.random() * colCount);
            this.x = col * this.gridSize + (this.gridSize - this.headSize) / 2;
            this.y = isInitial ? Math.random() * (height || 800) : (this.speed > 0 ? -this.trailLength : (height || 800) + this.trailLength);
        } else {
            const row = Math.floor(Math.random() * rowCount);
            this.y = row * this.gridSize + (this.gridSize - this.headSize) / 2;
            this.x = isInitial ? Math.random() * (width || 400) : (this.speed > 0 ? -this.trailLength : (width || 400) + this.trailLength);
        }

        this.alpha = 0.4 + Math.random() * 0.35;
    }

    update(dt, width, height) {
        const w = width || 400;
        const h = height || 800;
        if (this.isVert) {
            this.y += this.speed * dt;
            if ((this.speed > 0 && this.y - this.trailLength > h) ||
                (this.speed < 0 && this.y + this.trailLength < 0)) {
                this.reset(w, h);
            }
        } else {
            this.x += this.speed * dt;
            if ((this.speed > 0 && this.x - this.trailLength > w) ||
                (this.speed < 0 && this.x + this.trailLength < 0)) {
                this.reset(w, h);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;

        const head = this.colorCfg.head;
        const glow = this.colorCfg.glow;
        const hs = this.headSize;

        if (this.isVert) {
            // Trailing light stripe behind head
            const trailY = this.speed > 0 ? this.y - this.trailLength : this.y + hs + this.trailLength;
            const grad = ctx.createLinearGradient(this.x + hs / 2, this.y + hs / 2, this.x + hs / 2, trailY);
            grad.addColorStop(0, glow);
            grad.addColorStop(1, 'transparent');

            ctx.fillStyle = grad;
            if (this.speed > 0) {
                ctx.fillRect(this.x + 1, this.y - this.trailLength, hs - 2, this.trailLength);
            } else {
                ctx.fillRect(this.x + 1, this.y + hs, hs - 2, this.trailLength);
            }

            // Glowing Leading Square Head
            ctx.shadowBlur = 10;
            ctx.shadowColor = head;
            ctx.fillStyle = head;
            ctx.fillRect(this.x, this.y, hs, hs);

        } else {
            // Trailing light stripe behind head
            const trailX = this.speed > 0 ? this.x - this.trailLength : this.x + hs + this.trailLength;
            const grad = ctx.createLinearGradient(this.x + hs / 2, this.y + hs / 2, trailX, this.y + hs / 2);
            grad.addColorStop(0, glow);
            grad.addColorStop(1, 'transparent');

            ctx.fillStyle = grad;
            if (this.speed > 0) {
                ctx.fillRect(this.x - this.trailLength, this.y + 1, this.trailLength, hs - 2);
            } else {
                ctx.fillRect(this.x + hs, this.y + 1, this.trailLength, hs - 2);
            }

            // Glowing Leading Square Head
            ctx.shadowBlur = 10;
            ctx.shadowColor = head;
            ctx.fillStyle = head;
            ctx.fillRect(this.x, this.y, hs, hs);
        }

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
    constructor(x1, y1, x2, y2, color = '#00e5ff', renderable = true) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.color = color;
        this.renderable = renderable;
        this.illumination = 0;
        this.flashTimer = 0; // Echo wave hit flash decay timer (~300ms)
    }

    update(dt, echoWaves) {
        this.flashTimer = Math.max(0, this.flashTimer - dt * 3.3); // ~300ms fade back
        this.illumination = Math.max(0, this.illumination - dt * 1.5);
        const samples = 6;
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const sx = this.x1 + (this.x2 - this.x1) * t;
            const sy = this.y1 + (this.y2 - this.y1) * t;

            for (const wave of echoWaves) {
                const waveIntensity = wave.getIlluminationAt(sx, sy);
                if (waveIntensity > 0.15) {
                    this.flashTimer = Math.max(this.flashTimer, waveIntensity);
                    this.illumination = Math.max(this.illumination, waveIntensity * 1.5);
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
                this.flashTimer = 1.0;
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

    draw(ctx, gameInstance) {
        if (!this.renderable) return;

        const flash = Math.max(this.illumination, this.flashTimer);
        const levelIndex = gameInstance ? gameInstance.currentLevelIndex : 0;
        const isEndless = !!(gameInstance && gameInstance.isEndless) || !!this.alwaysLit;

        // Endless Mode: always fully visible neon platforms (ignore campaign dark/blueprint state)
        if (isEndless) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 5.5;
            ctx.beginPath();
            ctx.moveTo(this.x1, this.y1);
            ctx.lineTo(this.x2, this.y2);
            ctx.stroke();
            ctx.shadowBlur = 6;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(this.x1, this.y1);
            ctx.lineTo(this.x2, this.y2);
            ctx.stroke();
            ctx.restore();
            return;
        }

        // Level 1 (Index 0): Faint Blueprint Mode — unrevealed walls render at ~18% opacity outline
        // Level 2+ (Index 1+): Standard Dark Mode — unrevealed walls hidden at ~4% opacity until Echo/Sonar hits
        const isBlueprint = (levelIndex === 0);
        const baseAlpha = isBlueprint ? 0.18 : 0.04;

        if (!isBlueprint && flash < 0.015) return; // skip draw when completely dark on Level 2+ for performance

        const alpha = Math.min(1, baseAlpha + (1 - baseAlpha) * flash);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';

        // Subtle blueprint glow for Level 1, dynamic glow when flash > 0.3
        const glowAmount = isBlueprint ? (flash > 0.3 ? 8 + 18 * flash : 6) : (flash > 0.3 ? 8 + 18 * flash : 4);
        ctx.shadowBlur = glowAmount;
        ctx.shadowColor = (flash > 0.3 || isBlueprint) ? this.color : '#ffffff';

        // Base Neon Rod
        ctx.strokeStyle = flash > 0.3 ? '#ffffff' : this.color;
        ctx.lineWidth = isBlueprint ? 4.5 : 5.5;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        // Inner bright core line
        if (flash > 0.15 || isBlueprint) {
            ctx.shadowBlur = flash > 0.3 ? 10 : (isBlueprint ? 4 : 0);
            ctx.strokeStyle = flash > 0.3 ? '#ffffff' : (isBlueprint ? 'rgba(0, 243, 255, 0.45)' : 'rgba(255, 255, 255, 0.85)');
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(this.x1, this.y1);
            ctx.lineTo(this.x2, this.y2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// --- Base Hazard Class (Pulsing Hazard Mines with Particle Sparks) ---
class Hazard {
    constructor(x, y, radius = 18, color = '#FF007F') {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.illumination = 0;
        this.pulseTimer = Math.random() * Math.PI * 2;
        this.sparks = [];
    }

    update(dt, echoWaves) {
        this.pulseTimer += dt * 3.5;
        this.illumination = Math.max(0, this.illumination - dt * 0.6);
        for (const wave of echoWaves) {
            const intensity = wave.getIlluminationAt(this.x, this.y);
            if (intensity > this.illumination) {
                this.illumination = Math.min(1, intensity * 1.5);
            }
        }

        // Spawn occasional subtle floating spark particles
        if (Math.random() < 0.2) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.radius;
            this.sparks.push({
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist,
                vx: (Math.random() - 0.5) * 14,
                vy: -10 - Math.random() * 16,
                life: 0.35 + Math.random() * 0.3,
                maxLife: 0.65,
                size: 1.2 + Math.random() * 1.5
            });
        }

        // Update active sparks
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;
            if (s.life <= 0) this.sparks.splice(i, 1);
        }
    }

    checkCollision(orb) {
        const dist = Math.hypot(orb.pos.x - this.x, orb.pos.y - this.y);
        if (dist >= orb.radius + this.radius) return false;
        // Only lethal from above: orb center must be at or above hazard's lower bound.
        // This prevents false kills when the orb slides along the floor beneath a top-mounted triangle.
        return orb.pos.y <= this.y + this.radius * 0.65;
    }

    draw(ctx) {
        const baseAlpha = this.alwaysLit
            ? 1
            : Math.min(1, 0.45 + 0.55 * this.illumination);

        ctx.save();
        ctx.globalAlpha = baseAlpha;

        // Pulsing outer aura shadowBlur in theme hazard color
        const pulse = 0.5 + 0.5 * Math.sin(this.pulseTimer);
        const blurAmount = 14 + pulse * 14;

        ctx.shadowBlur = blurAmount;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        
        let hex = this.color.replace('#', '');
        let r = parseInt(hex.substring(0, 2), 16) || 255;
        let g = parseInt(hex.substring(2, 4), 16) || 0;
        let b = parseInt(hex.substring(4, 6), 16) || 127;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.25 + 0.2 * pulse})`;
        ctx.lineWidth = 2.5;

        // Hazard Triangle Body
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
            const px = this.x + Math.cos(angle) * (this.radius + pulse * 1.2);
            const py = this.y + Math.sin(angle) * (this.radius + pulse * 1.2);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner glowing core dot
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = pulse > 0.5 ? '#ffffff' : this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw floating spark particles matching theme hazard color
        for (const s of this.sparks) {
            const sparkAlpha = Math.max(0, s.life / s.maxLife) * baseAlpha;
            ctx.shadowBlur = 6;
            ctx.shadowColor = this.color;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${sparkAlpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// --- World 2: Moving Hazard Spikes ---
class MovingHazard extends Hazard {
    constructor(x1, y1, x2, y2, speed = 120, radius = 18, color = '#FF007F') {
        super(x1, y1, radius, color);
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
    constructor(x, y, onDuration = 1.5, offDuration = 1.5, radius = 18, color = '#FF007F') {
        super(x, y, radius, color);
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
    constructor(x, y, radius = 22, baseColor = '#7B1FA2', accentColor = '#00E5FF') {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.baseColor = baseColor;
        this.accentColor = accentColor;
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
        const { x, y, radius: r, diskAngle, orbitAngle, illumination: il, baseColor, accentColor } = this;
        ctx.save();
        ctx.globalAlpha = Math.min(1, il);

        // ── 1. Outer accretion glow ──
        const outerGlow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
        outerGlow.addColorStop(0,   'transparent');
        outerGlow.addColorStop(0.4, accentColor);
        outerGlow.addColorStop(0.85, baseColor);
        outerGlow.addColorStop(1,   'transparent');
        ctx.fillStyle = outerGlow;
        ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();

        // ── 2. Rotating elliptical accretion disk rings ──
        ctx.save();
        ctx.translate(x, y);

        // Outer ring (Accent Color)
        ctx.rotate(diskAngle);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 14 * il;
        ctx.shadowColor = accentColor;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 2.3, r * 0.52, 0, 0, Math.PI * 2); ctx.stroke();

        // Inner ring (Base Color)
        ctx.rotate(-diskAngle * 2.1);
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2.0;
        ctx.shadowColor = baseColor;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.65, r * 0.35, 0.4, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        // ── 3. Gravitational lensing rings ──
        ctx.shadowBlur = 0;
        for (let i = 0; i < 3; i++) {
            const rr = r * (0.85 + i * 0.28);
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = Math.min(1, (0.25 - i * 0.06) * il);
            ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = Math.min(1, il);

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
        drawParticles(7, r * 2.0, 1,    accentColor, 2.2);
        drawParticles(5, r * 1.65,-1.4, baseColor,   1.8);

        // ── 5. Event horizon — black hole void center ──
        const horizon = ctx.createRadialGradient(x, y, 0, x, y, r * 1.05);
        horizon.addColorStop(0,   '#000000');
        horizon.addColorStop(0.75,'#000000');
        horizon.addColorStop(0.95, baseColor);
        horizon.addColorStop(1,   'transparent');
        ctx.shadowBlur = 0;
        ctx.fillStyle = horizon;
        ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, Math.PI * 2); ctx.fill();

        // ── 6. Tiny bright singularity point ──
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 12 * il;
        ctx.shadowColor = accentColor;
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}

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
        if (gameInstance.isEndless && typeof gameInstance._endlessOnFirstMove === 'function') {
            gameInstance._endlessOnFirstMove();
        }
    }

    update(dt, gameInstance) {
        // --- Sub-step physics to prevent tunneling at high speeds ---
        const speed = this.vel.length();
        // Max safe step: one sub-step should move at most half the orb radius
        const MAX_STEP_DIST = this.radius * 0.55;
        const numSteps = Math.max(1, Math.ceil(speed * dt / MAX_STEP_DIST));
        const subDt = dt / numSteps;

        const wallWaveColor = gameInstance.getWaveColor();

        for (let step = 0; step < numSteps; step++) {
            // Apply gravity & friction per sub-step
            this.vel.y += CONFIG.GRAVITY * subDt;
            this.vel.x *= Math.pow(CONFIG.AIR_FRICTION, subDt / (1 / 60));
            this.vel.y *= Math.pow(CONFIG.AIR_FRICTION, subDt / (1 / 60));

            this.pos.x += this.vel.x * subDt;
            this.pos.y += this.vel.y * subDt;

            for (const wall of gameInstance.walls) {
                const impact = wall.checkCollision(this);
                if (impact && impact.isRealBounce) {
                    this.bounces++;
                    haptic(15);
                    Audio.playBounce();
                    if (gameInstance.isEndless && wall._endlessCull && typeof gameInstance._endlessOnPlatformTouch === 'function') {
                        gameInstance._endlessOnPlatformTouch();
                    }
                    gameInstance.echoWaves.push(new EchoWave(impact.x, impact.y, 140, 0.9, wallWaveColor));

                    for (let i = 0; i < 8; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spd = 40 + Math.random() * 100;
                        gameInstance.particles.push(new Particle(
                            impact.x, impact.y,
                            Math.cos(angle) * spd, Math.sin(angle) * spd,
                            wallWaveColor, 2.5, 0.4
                        ));
                    }
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
        // desynchronized: true lets the browser skip compositor sync on Android,
        // giving a meaningful FPS boost in Capacitor WebViews
        this.ctx = this.canvas.getContext('2d', { desynchronized: true });
        
        this.dpr = window.devicePixelRatio || 1;
        this.width = 0;
        this.height = 0;

        this.saveSystem = new SaveSystem();
        this.currentLevelIndex = 0; // 0 to 32 (33 Levels total, 4 Worlds)
        this.totalLevels = 23;

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
            flashAlpha: 0.0,   // legacy; no longer used for green flash
            blackFadeAlpha: 0.0 // used for fade-to-black portal exit
        };
        this.portalAnimTimer = 0;

        this.pulseCooldown = 0;
        this.lastTime = 0;
        this.levelStartTime = 0;
        this.gameState = 'MENU';
        this.deathTimer = 0;
        this.shakeTimer = 0;        // 150ms Glitch Shake timer
        this.redFlashTimer = 0;     // 150ms Red Flash timer
        this.absorptionTimer = 0;   // portal absorption animation timer
        this.carouselWorldIndex = 0; // last viewed world in level select carousel

        // Live Nexus Wallpaper streams
        this.nexusStreams = [];
        this.initNexusStreams();

        // Ghost Replay & Star Rating State
        this.currentTrajectory = [];
        this.recordTimer = 0;
        this.ghostData = null;
        this.ghostTime = 0;
        this.ghostPos = null;
        this.lastVictoryStars = 1;

        this.lastTapTime = 0;
        this.lastTapPos = { x: 0, y: 0 };

        // Endless Mode state
        this.isEndless = false;
        this.endlessScrollY = 0;
        this.endlessScrollSpeed = CONFIG.ENDLESS_SCROLL_BASE;
        this.endlessSpawnY = 0;
        this.endlessMinPlayerY = 0;
        this.endlessDistanceM = 0;
        this.endlessNextChunkY = 0;
        this.endlessLastChunkId = null;
        this.endlessChunks = [];
        this.endlessColors = null;
        this.endlessFloorY = 0;
        this.endlessScrollActive = false;
        this.endlessHasMoved = false;
        this.endlessTouchedPlatform = false;
        this._endlessGameOverLatched = false;
        this.devGodMode = false;
        this.isDevBuild = isDevMode();

        // DOM Screen Elements
        this.elMenuScreen = document.getElementById('menu-screen');
        this.elLevelSelectScreen = document.getElementById('level-select-screen');
        this.elTutorialScreen = document.getElementById('tutorial-screen');
        this.elProfileScreen = document.getElementById('profile-screen');
        this.elSettingsModal = document.getElementById('settings-modal');
        this.elGameHud = document.getElementById('game-hud');
        this.elGameActionBar = document.getElementById('game-action-bar');
        this.elPauseModal = document.getElementById('pause-modal');
        this.elEndlessGameOverModal = document.getElementById('endless-gameover-modal');
        this.elDeathBanner = document.getElementById('death-banner');
        this.elVictoryModal = document.getElementById('victory-modal');
        this.elHintBanner = document.getElementById('level-hint-banner');
        this.elHintText = document.getElementById('hint-text');
        this.elDevEndlessOverlay = document.getElementById('dev-endless-overlay');
        this.btnDevCamUp = document.getElementById('dev-cam-up');
        this.btnDevCamDown = document.getElementById('dev-cam-down');
        this.btnDevGodMode = document.getElementById('dev-god-mode');

        // i18n — managed via Settings modal pill
        this.btnLangToggle = document.getElementById('btn-lang-toggle'); // null in Phase 13
        this.elLangLabel = document.getElementById('lang-label');

        // HUD Elements
        this.elLevel = document.getElementById('stat-level');
        this.elDistance = document.getElementById('stat-distance');
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
        if (levelIndex < 3) return 0;  // World 0: Training Ground (Levels 1-3)
        if (levelIndex < 13) return 1; // World 1: Cyber Neon (Levels 4-13 -> Displays Levels 1-10)
        if (levelIndex < 23) return 2; // World 2: Emerald Abyss (Levels 14-23 -> Displays Levels 11-20)
        return 3;                      // World 3: Solar Core (Levels 24-33 -> Displays Levels 21-30)
    }

    getDisplayLevelInfo(levelIndex) {
        const idx = parseInt(levelIndex, 10);
        if (idx < 3) {
            return {
                isTutorial: true,
                displayNum: idx + 1,
                badgeText: `STAGE T${idx + 1}`,
                toastText: `Stage T${idx + 1}`
            };
        }
        const mainLvlNum = idx - 2; // Index 3 -> Level 1, Index 32 -> Level 30
        return {
            isTutorial: false,
            displayNum: mainLvlNum,
            badgeText: `LVL ${mainLvlNum}`,
            toastText: `Level ${mainLvlNum}`
        };
    }

    getWallColor() {
        const world = this.getWorldForLevel(this.currentLevelIndex);
        const theme = WORLD_THEMES[world] || WORLD_THEMES[1];
        return theme.wall;
    }

    getWaveColor() {
        const world = this.getWorldForLevel(this.currentLevelIndex);
        const theme = WORLD_THEMES[world] || WORLD_THEMES[1];
        return theme.wall;
    }

    resetCamera() {
        this.camera.x = this.width / 2;
        this.camera.y = this.height / 2;
        this.camera.scale = 1.0;
        this.camera.targetScale = 1.0;
        this.camera.flashAlpha = 0.0;
        this.camera.blackFadeAlpha = 0.0;
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
        this._syncMainMenu();

        if (this.gameState === 'LEVEL_SELECT') this.renderLevelSelect();
        if (this.gameState === 'PROFILE') this.renderProfile();
        if (this.gameState === 'PLAYING') this.updateOnScreenHint();
    }

    _syncMainMenu() {
        const elBest = document.getElementById('menu-endless-best');
        if (elBest) {
            const best = Math.floor(this.saveSystem.data.endlessBestDistance || 0);
            elBest.textContent = `${best}m`;
        }
    }

    updateHudLevelBadge() {
        if (!this.elLevel) return;
        const lang = this.saveSystem.data.language || 'en';
        const prefix = TRANSLATIONS[lang].hudLevelPrefix || 'LVL';
        if (this.currentLevelIndex < 3) {
            this.elLevel.textContent = `TUTORIAL ${this.currentLevelIndex + 1}/3`;
        } else {
            // First 3 are tutorial, next 20 are Worlds 1 and 2.
            this.elLevel.textContent = `${prefix} ${this.currentLevelIndex - 2}/20`;
        }
        this._syncPlayHudMode();
        this._updateEndlessDistanceHud();
    }

    _syncPlayHudMode() {
        if (this.elLevel) this.elLevel.classList.toggle('hidden', !!this.isEndless);
        if (this.elDistance) this.elDistance.classList.toggle('hidden', !this.isEndless);
        // Endless: keep the screen clear — no radar/retry action bar
        if (this.elGameActionBar && this.isEndless) {
            this.elGameActionBar.classList.add('hidden');
        }
    }

    _updateEndlessDistanceHud() {
        if (!this.elDistance || !this.isEndless) return;
        this.elDistance.textContent = `${Math.floor(this.endlessDistanceM)}m`;
    }

    _syncDevEndlessOverlay() {
        if (!this.elDevEndlessOverlay) return;
        const show = this.isDevBuild && this.isEndless && this.gameState === 'PLAYING';
        this.elDevEndlessOverlay.classList.toggle('hidden', !show);
        this.elDevEndlessOverlay.setAttribute('aria-hidden', show ? 'false' : 'true');
        if (this.btnDevGodMode) {
            this.btnDevGodMode.classList.toggle('active', !!this.devGodMode);
            this.btnDevGodMode.textContent = this.devGodMode ? 'God Mode ON' : 'God Mode';
        }
    }

    /** Instantly shift Endless camera + ball by ±meters for high-altitude chunk testing. */
    _devShiftEndlessMeters(deltaM) {
        if (!this.isDevBuild || !this.isEndless || !this.player) return;
        if (this.gameState !== 'PLAYING') return;

        const px = deltaM * CONFIG.ENDLESS_PX_PER_METER;
        // World Y decreases upward; +meters ⇒ move up (negative Y)
        let dy = -px;

        // Clamp so we never drop the orb below the spawn floor line
        const maxPlayerY = this.endlessSpawnY;
        if (this.player.pos.y + dy > maxPlayerY) {
            dy = maxPlayerY - this.player.pos.y;
        }

        if (Math.abs(dy) < 0.5) return;

        this.player.pos.y += dy;
        this.player.vel.x = 0;
        this.player.vel.y = 0;
        this.camera.y += dy;
        this.endlessScrollY += dy;

        // Distance tracks test altitude (not lifetime peak) so −50m can step tiers down
        this.endlessMinPlayerY = this.player.pos.y;
        this.endlessDistanceM = Math.max(0, (this.endlessSpawnY - this.endlessMinPlayerY) / CONFIG.ENDLESS_PX_PER_METER);

        // Engage pressure so auto-scroll / spawn logic stays active while scouting
        this.endlessHasMoved = true;
        this.endlessTouchedPlatform = true;
        this.endlessScrollActive = true;

        const viewTop = this.camera.y - (this.height * 0.5) / (this.camera.scale || 1);
        while (this.endlessNextChunkY > viewTop - this.height) {
            this._spawnEndlessChunk();
        }
        this._cullEndlessGeometry();
        this._updateEndlessDistanceHud();
    }

    _toggleDevGodMode() {
        if (!this.isDevBuild || !this.isEndless) return;
        this.devGodMode = !this.devGodMode;
        this._syncDevEndlessOverlay();
    }

    screenToWorld(sx, sy) {
        const s = this.camera.scale || 1;
        return {
            x: this.camera.x + (sx - this.width / 2) / s,
            y: this.camera.y + (sy - this.height / 2) / s
        };
    }

    _endlessAddWall(x1, y1, x2, y2, color) {
        const wall = new Wall(x1, y1, x2, y2, color);
        wall._endlessCull = true;
        wall.alwaysLit = true;
        wall.illumination = 1;
        this.walls.push(wall);
        return wall;
    }

    _endlessAddHazard(x, y, r, color) {
        const h = new Hazard(x, y, r, color);
        h._endlessCull = true;
        h.alwaysLit = true;
        h.illumination = 1;
        this.hazards.push(h);
        return h;
    }

    _endlessAddMovingHazard(x1, y1, x2, y2, speed, r, color) {
        const h = new MovingHazard(x1, y1, x2, y2, speed, r, color);
        h._endlessCull = true;
        h.alwaysLit = true;
        h.illumination = 1;
        this.hazards.push(h);
        return h;
    }

    _endlessAddBox(cx, cy, width, height, color) {
        const hw = width / 2;
        const hh = height / 2;
        this._endlessAddWall(cx - hw, cy - hh, cx + hw, cy - hh, color);
        this._endlessAddWall(cx + hw, cy - hh, cx + hw, cy + hh, color);
        this._endlessAddWall(cx + hw, cy + hh, cx - hw, cy + hh, color);
        this._endlessAddWall(cx - hw, cy + hh, cx - hw, cy - hh, color);
    }

    _endlessAddTriangle(cx, cy, size, color) {
        const h = size * 0.866;
        const topY = cy - h * 0.55;
        const botY = cy + h * 0.45;
        const leftX = cx - size * 0.5;
        const rightX = cx + size * 0.5;
        this._endlessAddWall(cx, topY, rightX, botY, color);
        this._endlessAddWall(rightX, botY, leftX, botY, color);
        this._endlessAddWall(leftX, botY, cx, topY, color);
    }

    _refreshEndlessSideWalls() {
        this.walls = this.walls.filter(w => !w._endlessSide);
        const w = this.width;
        const color = (this.endlessColors && this.endlessColors.wall) || this.getWallColor();
        const yTop = this.endlessNextChunkY - this.height;
        const yBot = this.endlessFloorY + this.height;
        const left = new Wall(0, yTop, 0, yBot, color);
        const right = new Wall(w, yTop, w, yBot, color);
        left._endlessSide = true;
        right._endlessSide = true;
        left.alwaysLit = true;
        right.alwaysLit = true;
        left.illumination = 1;
        right.illumination = 1;
        this.walls.push(left, right);
    }

    _getEndlessBand() {
        const d = this.endlessDistanceM || 0;
        if (d < 50) return 'warmup';
        if (d < 100) return 'staticTraps';
        if (d < 125) return 'diagonal';
        if (d < 150) return 'shapes';
        if (d < 200) return 'moving';
        return 'challenge';
    }

    _getEndlessChunkPool() {
        const band = this._getEndlessBand();
        let pool = ENDLESS_CHUNKS.filter(c => c.band === band && c.id !== this.endlessLastChunkId);
        if (pool.length === 0) {
            pool = ENDLESS_CHUNKS.filter(c => c.band === band);
        }
        if (pool.length === 0) pool = ENDLESS_CHUNKS.slice();
        return pool;
    }

    _spawnEndlessChunk() {
        const pool = this._getEndlessChunkPool();
        const chunk = pool[Math.floor(Math.random() * pool.length)] || ENDLESS_CHUNKS[0];
        const yTop = this.endlessNextChunkY - chunk.height;
        chunk.build(this, yTop, this.width, this.endlessColors);
        this.endlessChunks.push({ id: chunk.id, band: chunk.band, yTop, yBottom: this.endlessNextChunkY });
        this.endlessLastChunkId = chunk.id;
        this.endlessNextChunkY = yTop;
        this._refreshEndlessSideWalls();
    }

    _endlessOnFirstMove() {
        if (!this.isEndless || this.endlessHasMoved) return;
        this.endlessHasMoved = true;
        this._tryStartEndlessScroll();
    }

    _endlessOnPlatformTouch() {
        if (!this.isEndless || this.endlessTouchedPlatform) return;
        this.endlessTouchedPlatform = true;
        this._tryStartEndlessScroll();
    }

    _tryStartEndlessScroll() {
        if (this.endlessScrollActive) return;
        if (!this.endlessHasMoved || !this.endlessTouchedPlatform) return;
        this.endlessScrollActive = true;
        // Continue pressure from the current camera so the view doesn't jump
        this.endlessScrollY = this.camera.y;
    }

    _cullEndlessGeometry() {
        // Drop geometry fully below the bottom of the moving viewport
        const cullLine = this.camera.y + (this.height * 0.5) / (this.camera.scale || 1) + 80;
        this.walls = this.walls.filter(wall => {
            if (wall._endlessSide || wall._endlessFloor) return true;
            if (!wall._endlessCull) return true;
            const minY = Math.min(wall.y1, wall.y2);
            return minY < cullLine;
        });
        this.hazards = this.hazards.filter(h => {
            if (!h._endlessCull) return true;
            return h.y < cullLine;
        });
        this.endlessChunks = this.endlessChunks.filter(c => c.yTop < cullLine);
    }

    startEndlessMode() {
        this.isEndless = true;
        this._endlessGameOverLatched = false;
        this.portal = null;
        this.walls = [];
        this.hazards = [];
        this.echoWaves = [];
        this.particles = [];
        this.ghostData = null;
        this.ghostPos = null;
        this.currentTrajectory = [];

        const theme = WORLD_THEMES[1];
        this.endlessColors = theme;
        const w = this.width;
        const floorY = this.getBottomFloorY();
        this.endlessFloorY = floorY;

        const floor = new Wall(0, floorY, w, floorY, theme.wall);
        floor._endlessFloor = true;
        floor.alwaysLit = true;
        floor.illumination = 1;
        this.walls.push(floor);

        this.endlessSpawnY = floorY - CONFIG.ORB_RADIUS - 2;
        this.endlessMinPlayerY = this.endlessSpawnY;
        this.endlessDistanceM = 0;
        this.endlessLastChunkId = null;
        this.endlessChunks = [];
        this.endlessNextChunkY = floorY - 180;
        this.endlessScrollSpeed = CONFIG.ENDLESS_SCROLL_BASE;
        this.endlessScrollActive = false;
        this.endlessHasMoved = false;
        this.endlessTouchedPlatform = false;
        // Frame spawn near lower third; pressure scroll waits for first move + first step
        this.endlessScrollY = floorY - this.height * 0.42;
        this.camera.x = w / 2;
        this.camera.y = this.endlessScrollY;
        this.camera.scale = 1.0;
        this.camera.targetScale = 1.0;
        this._zoomOutEntry = false;

        this._refreshEndlessSideWalls();
        for (let i = 0; i < 3; i++) this._spawnEndlessChunk();
        // Force full glow in case any wall was spawned without the flag
        for (const wall of this.walls) {
            wall.alwaysLit = true;
            wall.illumination = 1;
        }
        for (const h of this.hazards) {
            h.alwaysLit = true;
            h.illumination = 1;
        }

        const skin = this.saveSystem.data.orbSkin || 'cyan';
        if (!this.player) {
            this.player = new PlayerOrb(w * 0.5, this.endlessSpawnY, skin);
        } else {
            this.player.reset(w * 0.5, this.endlessSpawnY);
            this.player.setSkin(skin);
        }

        this.levelStartTime = performance.now();
        this._updateEndlessDistanceHud();
        this.switchState('PLAYING');
        this._syncDevEndlessOverlay();
        this.echoWaves.push(new EchoWave(w * 0.5, this.endlessSpawnY, 180, 1.1, theme.wall));
    }

    triggerEndlessGameOver() {
        if (!this.isEndless || this._endlessGameOverLatched) return;
        if (this.devGodMode) return;
        if (this.gameState !== 'PLAYING' && this.gameState !== 'PAUSED') return;
        this._endlessGameOverLatched = true;

        this.shakeTimer = 0.22;
        this.redFlashTimer = 0.22;
        haptic([40, 30, 40]);
        Audio.playDeath();

        const orbX = this.player ? this.player.pos.x : this.width / 2;
        const orbY = this.player ? this.player.pos.y : this.height / 2;
        const shatterColors = [CONFIG.COLOR_RED, '#ff5500', '#ffaa00', '#ff007f', '#ffffff'];
        for (let i = 0; i < 36; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 240;
            this.particles.push(new Particle(
                orbX, orbY,
                Math.cos(angle) * speed, Math.sin(angle) * speed,
                shatterColors[Math.floor(Math.random() * shatterColors.length)],
                2.5 + Math.random() * 3, 0.55 + Math.random() * 0.25
            ));
        }

        const result = this.saveSystem.recordEndlessRun(this.endlessDistanceM);
        const lang = this.saveSystem.data.language || 'en';
        const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

        const desc = document.getElementById('endless-go-desc');
        if (desc) {
            desc.textContent = result.isNewBest
                ? `${dict.endlessGameOverDesc || ''} ★`
                : (dict.endlessGameOverDesc || '');
        }
        const elDist = document.getElementById('endless-go-distance');
        const elBest = document.getElementById('endless-go-best');
        if (elDist) elDist.textContent = `${result.distance}m`;
        if (elBest) elBest.textContent = `${result.best}m`;

        this.switchState('ENDLESS_GAME_OVER');
    }

    updateEndless(dt) {
        if (!this.isEndless || this.gameState !== 'PLAYING' || !this.player) return;

        this.endlessMinPlayerY = Math.min(this.endlessMinPlayerY, this.player.pos.y);
        this.endlessDistanceM = Math.max(0, (this.endlessSpawnY - this.endlessMinPlayerY) / CONFIG.ENDLESS_PX_PER_METER);

        this.camera.x = this.width / 2;

        if (this.endlessScrollActive) {
            // Smooth subtle speed curve with distance
            const t = this.endlessDistanceM;
            this.endlessScrollSpeed = Math.min(
                CONFIG.ENDLESS_SCROLL_MAX,
                CONFIG.ENDLESS_SCROLL_BASE + t * CONFIG.ENDLESS_SCROLL_ACCEL + t * t * 0.002
            );
            this.endlessScrollY -= this.endlessScrollSpeed * dt;
            // Follow player up, but never scroll back down; pressure from auto-scroll
            const followY = Math.min(this.endlessScrollY, this.player.pos.y);
            this.camera.y = Math.min(this.camera.y, followY);
        } else {
            // Pre-pressure: only follow the player upward so they can climb into view
            if (this.player.pos.y < this.camera.y) {
                this.camera.y = this.player.pos.y;
            }
        }

        this._updateEndlessDistanceHud();

        // Spawn more chunks as the camera approaches the top of generated content
        const viewTop = this.camera.y - (this.height * 0.5) / (this.camera.scale || 1);
        while (this.endlessNextChunkY > viewTop - this.height) {
            this._spawnEndlessChunk();
        }

        this._cullEndlessGeometry();

        // Kill line only after pressure scroll has started (skipped in God Mode)
        if (this.endlessScrollActive && !this.devGodMode) {
            const viewBottom = this.camera.y + (this.height * 0.5) / (this.camera.scale || 1) - CONFIG.ENDLESS_FALL_MARGIN;
            if (this.player.pos.y > viewBottom) {
                this.triggerEndlessGameOver();
            }
        }
    }

    getBottomFloorY() {
        let safeBottom = 34; // default iOS home indicator baseline (px)
        try {
            const testEl = document.createElement('div');
            testEl.style.paddingBottom = 'env(safe-area-inset-bottom, 34px)';
            testEl.style.position = 'fixed';
            testEl.style.visibility = 'hidden';
            document.body.appendChild(testEl);
            const val = parseFloat(window.getComputedStyle(testEl).paddingBottom);
            if (!isNaN(val) && val > 0) safeBottom = val;
            document.body.removeChild(testEl);
        } catch(e) {}
        return this.height - (safeBottom + 28);
    }

    getTopSafetyMargin(portalRadius = 22) {
        let safeTop = 0;
        try {
            const testEl = document.createElement('div');
            testEl.style.paddingTop = 'env(safe-area-inset-top, 0px)';
            testEl.style.position = 'fixed';
            testEl.style.visibility = 'hidden';
            document.body.appendChild(testEl);
            const val = parseFloat(window.getComputedStyle(testEl).paddingTop);
            if (!isNaN(val) && val > 0) safeTop = val;
            document.body.removeChild(testEl);
        } catch(e) {}

        // Enforce top exclusion boundary: minimum 80px + env(safe-area-inset-top)
        // so the Exit Portal & accretion disk strictly render below top HUD buttons (Pause & LVL badge)
        return 80 + safeTop + portalRadius * 0.5;
    }

    createExitPortal(rawX, rawY, radius, baseColor, accentColor) {
        const minY = this.getTopSafetyMargin(radius);
        const clampedY = Math.max(rawY, minY);
        const clampedX = Math.max(radius + 20, Math.min(this.width - radius - 20, rawX));
        return new ExitPortal(clampedX, clampedY, radius, baseColor, accentColor);
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
        const floorY = this.getBottomFloorY();
        if (!this.player) {
            this.player = new PlayerOrb(this.width / 2, floorY - CONFIG.ORB_RADIUS - 2, skin);
        } else {
            this.player.setSkin(skin);
            if (this.gameState === 'PLAYING') this.loadLevel(this.currentLevelIndex);
        }

        if (!this.nexusStreams || this.nexusStreams.length === 0) {
            this.initNexusStreams();
        }
    }

    initNexusStreams() {
        this.nexusStreams = [];
        for (let i = 0; i < 14; i++) {
            this.nexusStreams.push(new NexusStream(this.width || 400, this.height || 800));
        }
    }

    switchState(newState) {
        this.gameState = newState;

        this.elMenuScreen.classList.add('hidden');
        this.elLevelSelectScreen.classList.add('hidden');
        if (this.elTutorialScreen) this.elTutorialScreen.classList.add('hidden');
        this.elProfileScreen.classList.add('hidden');
        this.elGameHud.classList.add('hidden');
        this.elGameActionBar.classList.add('hidden');
        this.elPauseModal.classList.add('hidden');
        if (this.elEndlessGameOverModal) this.elEndlessGameOverModal.classList.add('hidden');
        if (this.elDeathBanner) this.elDeathBanner.classList.add('hidden');
        this.elVictoryModal.classList.add('hidden');
        if (this.elHintBanner) this.elHintBanner.classList.add('hidden');
        if (this.elSettingsModal) this.elSettingsModal.classList.add('hidden');
        if (this.elDevEndlessOverlay) this.elDevEndlessOverlay.classList.add('hidden');

        switch (newState) {
            case 'MENU':
                this.isEndless = false;
                this.resetCamera();
                this.elMenuScreen.classList.remove('hidden');
                this.createAmbientMenuWaves();
                this._syncPlayHudMode();
                this._syncMainMenu();
                break;

            case 'LEVEL_SELECT':
                this.renderLevelSelect();
                this.elLevelSelectScreen.classList.remove('hidden');
                break;

            case 'TUTORIAL':
                if (this.elTutorialScreen) this.elTutorialScreen.classList.remove('hidden');
                break;

            case 'SETTINGS':
                this.elMenuScreen.classList.remove('hidden');
                if (this.elSettingsModal) this.elSettingsModal.classList.remove('hidden');
                this._syncSettingsUI();
                break;

            case 'PROFILE':
                this.renderProfile();
                this.elProfileScreen.classList.remove('hidden');
                break;

            case 'PLAYING':
                if (!this.isEndless) {
                    // Zoom-out entry: start slightly zoomed in, ease back to 1.0
                    this.camera.x = this.width / 2;
                    this.camera.y = this.height / 2;
                    this.camera.scale = 1.18;
                    this.camera.targetScale = 1.0;
                    this.camera.flashAlpha = 0.0;
                    this.camera.blackFadeAlpha = 0.0;
                    this._zoomOutEntry = true;
                } else {
                    this.camera.flashAlpha = 0.0;
                    this.camera.blackFadeAlpha = 0.0;
                }
                this.elGameHud.classList.remove('hidden');
                if (!this.isEndless) this.elGameActionBar.classList.remove('hidden');
                this._syncPlayHudMode();
                this._syncDevEndlessOverlay();
                this.updateOnScreenHint();
                this._firstTapDone = false;
                break;

            case 'PORTAL_ANIMATION':
                this.elGameHud.classList.remove('hidden');
                if (!this.isEndless) this.elGameActionBar.classList.remove('hidden');
                break;

            case 'ABSORBING':
                this.elGameHud.classList.remove('hidden');
                if (!this.isEndless) this.elGameActionBar.classList.remove('hidden');
                break;

            case 'PAUSED':
                this.elGameHud.classList.remove('hidden');
                if (!this.isEndless) this.elGameActionBar.classList.remove('hidden');
                this.elPauseModal.classList.remove('hidden');
                this._syncPauseUI();
                break;

            case 'DEATH':
                this.elGameHud.classList.remove('hidden');
                if (!this.isEndless) this.elGameActionBar.classList.remove('hidden');
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

            case 'ENDLESS_GAME_OVER':
                this.elGameHud.classList.remove('hidden');
                if (this.elEndlessGameOverModal) this.elEndlessGameOverModal.classList.remove('hidden');
                this._syncPlayHudMode();
                break;
        }
    }

    updateOnScreenHint() {
        if (!this.elHintBanner || !this.elHintText) return;
        if (this.isEndless) {
            this.elHintBanner.classList.add('hidden');
            return;
        }
        const lang = this.saveSystem.data.language || 'en';
        const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];

        // Clear any previously pending auto-hide timer
        if (this._hintAutoHideTimer) {
            clearTimeout(this._hintAutoHideTimer);
            this._hintAutoHideTimer = null;
        }

        let hintText = null;
        if (this.currentLevelIndex === 0) {
            hintText = dict.level1Hint;
        } else if (this.currentLevelIndex === 1) {
            hintText = dict.level2Hint;
        } else if (this.currentLevelIndex === 2) {
            hintText = dict.level3Hint;
        }

        if (!hintText) {
            this.elHintBanner.classList.add('hidden');
            return;
        }

        this.elHintText.textContent = hintText;
        // Reset opacity in case it was faded out previously
        this.elHintBanner.style.transition = '';
        this.elHintBanner.style.opacity = '1';
        this.elHintBanner.classList.remove('hidden');

        // Auto-fade after 4.5 seconds for tutorial levels (1-3)
        this._hintAutoHideTimer = setTimeout(() => {
            this._fadeOutHintBanner();
        }, 4500);
    }

    _fadeOutHintBanner() {
        if (!this.elHintBanner) return;
        this.elHintBanner.style.transition = 'opacity 0.5s ease';
        this.elHintBanner.style.opacity = '0';
        setTimeout(() => {
            if (this.elHintBanner) this.elHintBanner.classList.add('hidden');
        }, 520);
        if (this._hintAutoHideTimer) {
            clearTimeout(this._hintAutoHideTimer);
            this._hintAutoHideTimer = null;
        }
    }

    createAmbientMenuWaves() {
        this.echoWaves = [
            new EchoWave(this.width * 0.5, this.height * 0.4, 220, 2.5, CONFIG.COLOR_CYAN)
        ];
    }

    // --- Geometry Helpers ---
    addBox(cx, cy, width, height, color) {
        const hw = width / 2;
        const hh = height / 2;
        this.walls.push(new Wall(cx - hw, cy - hh, cx + hw, cy - hh, color)); // Top
        this.walls.push(new Wall(cx + hw, cy - hh, cx + hw, cy + hh, color)); // Right
        this.walls.push(new Wall(cx + hw, cy + hh, cx - hw, cy + hh, color)); // Bottom
        this.walls.push(new Wall(cx - hw, cy + hh, cx - hw, cy - hh, color)); // Left
    }

    addFunnel(x, y, widthTop, widthBottom, height, color) {
        const hwT = widthTop / 2;
        const hwB = widthBottom / 2;
        // Left funnel wall
        this.walls.push(new Wall(x - hwT, y, x - hwB, y + height, color));
        // Right funnel wall
        this.walls.push(new Wall(x + hwT, y, x + hwB, y + height, color));
    }

    addZigZag(x, y, width, height, segments, color) {
        let curX = x - width / 2;
        let curY = y;
        const segH = height / segments;
        for (let i = 0; i < segments; i++) {
            const nextX = (i % 2 === 0) ? x + width / 2 : x - width / 2;
            const nextY = curY + segH;
            this.walls.push(new Wall(curX, curY, nextX, nextY, color));
            curX = nextX;
            curY = nextY;
        }
    }

    startGameAtLevel(levelIndex) {
        // Always coerce to integer — a string index causes all `=== N` checks
        // in loadLevel to silently fall through to the else (Level 15) branch.
        this.isEndless = false;
        const idx = parseInt(levelIndex, 10);
        if (isNaN(idx)) { console.error('startGameAtLevel: invalid levelIndex', levelIndex); return; }
        const clamped = Math.max(0, Math.min(idx, this.totalLevels - 1));
        const worldId = this.getWorldForLevel(clamped);
        console.log('Transitioning to: world', worldId, 'level index', clamped, '(level', clamped + 1, ')');
        this.currentLevelIndex = clamped;
        this.loadLevel(clamped);
        this.switchState('PLAYING');
    }

    loadLevel(levelIndex) {
        this.currentLevelIndex = parseInt(levelIndex, 10);
        this._victorySequenceStarted = false; // Reset one-shot guard for new level
        const w = this.width;
        const h = this.height;

        this.resetCamera();
        const world = this.getWorldForLevel(levelIndex);
        const theme = WORLD_THEMES[world] || WORLD_THEMES[1];
        const wallColor = theme.wall;
        const hazardColor = theme.hazard;
        const portalBase = theme.portalBase;
        const portalAccent = theme.portalAccent;

        const floorY = this.getBottomFloorY();
        this.walls = [
            new Wall(0, 0, w, 0, wallColor, false), // Top boundary: active physics, unrendered visual
            new Wall(0, floorY, w, floorY, wallColor, true),  // Elevated bottom boundary wall above safe area
            new Wall(0, 0, 0, h, wallColor, true),  // Left boundary wall
            new Wall(w, 0, w, h, wallColor, true)   // Right boundary wall
        ];

        this.hazards = [];

        // --- WORLD 0: TRAINING GROUND (Levels 1 to 3 - LevelIndex 0..2) ---
        if (levelIndex === 0) {
            // Level 1: Basic Movement Physics (0 hazards, Faint Blueprint Mode)
            // Introduce a funnel shape forcing the ball to the center
            this.addFunnel(w * 0.5, h * 0.5, w * 0.8, w * 0.3, h * 0.25, wallColor);
            this.walls.push(new Wall(0, h * 0.45, w * 0.25, h * 0.45, wallColor));
            this.walls.push(new Wall(w * 0.75, h * 0.45, w, h * 0.45, wallColor));
            this.portal = this.createExitPortal(w * 0.5, h * 0.15, 24, portalBase, portalAccent);

        } else if (levelIndex === 1) {
            // Level 2: Sonar Pulse Onboarding (0 hazards, Dark Mode + Sonar Tutorial Prompt)
            this.walls.push(new Wall(w * 0.35, h * 0.72, w, h * 0.72, wallColor));
            this.walls.push(new Wall(0, h * 0.48, w * 0.65, h * 0.48, wallColor));
            this.walls.push(new Wall(w * 0.30, h * 0.30, w, h * 0.30, wallColor));
            this.portal = this.createExitPortal(w * 0.85, h * 0.12, 22, portalBase, portalAccent);

        } else if (levelIndex === 2) {
            // Level 3: First Static Hazard Avoidance
            this.walls.push(new Wall(w * 0.35, h * 0.72, w, h * 0.72, wallColor));
            this.walls.push(new Wall(0, h * 0.48, w * 0.65, h * 0.48, wallColor));
            this.walls.push(new Wall(w * 0.30, h * 0.30, w, h * 0.30, wallColor));
            this.hazards.push(new Hazard(w * 0.40, h * 0.48 - 18, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.20, h * 0.12, 20, portalBase, portalAccent);

        // --- WORLD 1: CYBER NEON (Levels 4 to 13 - LevelIndex 3..12 - 10 LEVELS) ---
        } else if (levelIndex === 3) {
            // Level 4: Vertical Ricochet Chute (Cyber Neon 1)
            this.walls.push(new Wall(0, h * 0.8, w * 0.35, h * 0.8, wallColor));
            this.walls.push(new Wall(w * 0.65, h * 0.8, w, h * 0.8, wallColor));
            this.walls.push(new Wall(w * 0.35, h * 0.8, w * 0.35, h * 0.3, wallColor)); // Left chute wall
            this.walls.push(new Wall(w * 0.65, h * 0.8, w * 0.65, h * 0.3, wallColor)); // Right chute wall
            this.hazards.push(new Hazard(w * 0.35, h * 0.55, 18, hazardColor)); // Spikes on the chute wall
            this.hazards.push(new Hazard(w * 0.65, h * 0.40, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.50, h * 0.15, 20, portalBase, portalAccent);

        } else if (levelIndex === 4) {
            // Level 5: Central CPU Block Puzzle
            this.walls.push(new Wall(0, h * 0.82, w * 0.3, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.7, h * 0.82, w, h * 0.82, wallColor));
            // Central block
            this.addBox(w * 0.5, h * 0.5, w * 0.4, h * 0.25, wallColor);
            this.hazards.push(new Hazard(w * 0.5, h * 0.625 + 18, 18, hazardColor)); // Below CPU
            this.hazards.push(new Hazard(w * 0.3, h * 0.5, 18, hazardColor)); // Left side of CPU
            this.hazards.push(new Hazard(w * 0.7, h * 0.5, 18, hazardColor)); // Right side of CPU
            this.portal = this.createExitPortal(w * 0.50, h * 0.15, 19, portalBase, portalAccent);

        } else if (levelIndex === 5) {
            // Level 6: Zigzag Precision Setup
            this.walls.push(new Wall(w * 0.2, h * 0.85, w, h * 0.85, wallColor));
            this.addZigZag(w * 0.5, h * 0.35, w * 0.6, h * 0.45, 4, wallColor);
            this.hazards.push(new Hazard(w * 0.3, h * 0.6, 18, hazardColor)); // Moved to the right
            this.hazards.push(new Hazard(w * 0.8, h * 0.5, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.2, h * 0.4, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.80, h * 0.12, 18, portalBase, portalAccent);

        } else if (levelIndex === 6) {
            // Level 7: The Funnel Gate (Redesigned)
            this.addFunnel(w * 0.5, h * 0.4, w * 0.9, w * 0.3, h * 0.4, wallColor);
            this.hazards.push(new Hazard(w * 0.25, h * 0.6, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.75, h * 0.6, 18, hazardColor));
            this.addBox(w * 0.5, h * 0.25, w * 0.2, h * 0.05, wallColor);
            this.portal = this.createExitPortal(w * 0.50, h * 0.12, 19, portalBase, portalAccent);

        } else if (levelIndex === 7) {
            // Level 8: Zig-Zag Minefield
            this.walls.push(new Wall(w * 0.25, h * 0.84, w, h * 0.84, wallColor));
            this.walls.push(new Wall(0, h * 0.70, w * 0.75, h * 0.70, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.56, w, h * 0.56, wallColor));
            this.walls.push(new Wall(0, h * 0.42, w * 0.75, h * 0.42, wallColor)); 
            this.hazards.push(new Hazard(w * 0.35, h * 0.84 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.85, h * 0.84 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.70 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.65, h * 0.70 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.35, h * 0.56 - 18, 18, hazardColor));
            // New Traps based on user feedback
            this.hazards.push(new Hazard(w * 0.15, h * 0.42 - 18, 18, hazardColor)); // Below portal
            this.hazards.push(new Hazard(w * 0.40, h * 0.42 - 18, 18, hazardColor)); // Middle
            this.hazards.push(new Hazard(w * 0.35, h * 0.12, 18, hazardColor));      // Right of portal
            this.portal = this.createExitPortal(w * 0.15, h * 0.12, 18, portalBase, portalAccent);

        } else if (levelIndex === 8) {
            // Level 9: Choke Chamber
            this.walls.push(new Wall(0, h * 0.82, w * 0.45, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.82, w, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.20, h * 0.64, w * 0.80, h * 0.64, wallColor));
            this.walls.push(new Wall(0, h * 0.46, w * 0.45, h * 0.46, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.46, w, h * 0.46, wallColor));
            // Removed trap blocking the gap at start
            this.hazards.push(new Hazard(w * 0.30, h * 0.64 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.70, h * 0.64 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.46 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.85, h * 0.46 - 18, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.50, h * 0.10, 19, portalBase, portalAccent);

        } else if (levelIndex === 9) {
            // Level 10: Hexa Spike Corridor -> Redesigned into a zigzag descent!
            this.walls.push(new Wall(0, h * 0.82, w * 0.60, h * 0.82, wallColor));
            this.addZigZag(w * 0.5, h * 0.40, w * 0.5, h * 0.35, 3, wallColor);
            this.hazards.push(new Hazard(w * 0.15, h * 0.82 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.80, h * 0.60 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.20, h * 0.45 - 18, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.85, h * 0.10, 18, portalBase, portalAccent);

        } else if (levelIndex === 10) {
            // Level 11: Diamond Maze (Redesigned as vertical pinball drop)
            this.addFunnel(w * 0.5, h * 0.6, w * 0.8, w * 0.2, h * 0.2, wallColor);
            this.addFunnel(w * 0.5, h * 0.3, w * 0.2, w * 0.8, h * 0.2, wallColor);
            this.hazards.push(new Hazard(w * 0.5, h * 0.75, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.25, h * 0.45, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.75, h * 0.45, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.50, h * 0.10, 19, portalBase, portalAccent);

        } else if (levelIndex === 11) {
            // Level 12: Cyber Core (New)
            this.addBox(w * 0.5, h * 0.5, w * 0.6, h * 0.15, wallColor); 
            this.walls.push(new Wall(0, h * 0.75, w * 0.3, h * 0.75, wallColor));
            this.walls.push(new Wall(w * 0.7, h * 0.75, w, h * 0.75, wallColor));
            this.walls.push(new Wall(w * 0.2, h * 0.25, w * 0.8, h * 0.25, wallColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.75 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.85, h * 0.75 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.50, h * 0.65, 18, hazardColor)); 
            this.hazards.push(new Hazard(w * 0.50, h * 0.35, 18, hazardColor)); 
            this.portal = this.createExitPortal(w * 0.50, h * 0.10, 19, portalBase, portalAccent);

        } else if (levelIndex === 12) {
            // Level 13: Apex Master
            this.walls.push(new Wall(w * 0.30, h * 0.84, w, h * 0.84, wallColor));
            this.walls.push(new Wall(0, h * 0.70, w * 0.60, h * 0.70, wallColor));
            this.addBox(w * 0.5, h * 0.45, w * 0.3, h * 0.15, wallColor); 
            this.walls.push(new Wall(w * 0.40, h * 0.25, w, h * 0.25, wallColor));
            this.hazards.push(new Hazard(w * 0.45, h * 0.84 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.85, h * 0.84 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.70 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.50, h * 0.60, 18, hazardColor)); 
            this.hazards.push(new Hazard(w * 0.50, h * 0.30, 18, hazardColor)); 
            this.hazards.push(new Hazard(w * 0.20, h * 0.45, 18, hazardColor)); 
            this.hazards.push(new Hazard(w * 0.80, h * 0.45, 18, hazardColor)); 
            this.portal = this.createExitPortal(w * 0.15, h * 0.10, 22, portalBase, portalAccent);

        // --- WORLD 2: EMERALD ABYSS (Levels 14 to 23 - LevelIndex 13..22 - 10 LEVELS) ---
        } else if (levelIndex === 13) {
            // Level 14: Emerald Slime Patrol (Intro Linear Moving Hazard)
            this.walls.push(new Wall(0, h * 0.70, w * 0.65, h * 0.70, wallColor));
            this.walls.push(new Wall(w * 0.35, h * 0.45, w, h * 0.45, wallColor));
            this.hazards.push(new MovingHazard(w * 0.15, h * 0.70 - 18, w * 0.55, h * 0.70 - 18, 110, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.20, h * 0.15, 22, portalBase, portalAccent);

        } else if (levelIndex === 14) {
            // Level 15: Dual Patrol Blades
            this.walls.push(new Wall(w * 0.25, h * 0.75, w, h * 0.75, wallColor));
            this.walls.push(new Wall(0, h * 0.55, w * 0.75, h * 0.55, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.35, w, h * 0.35, wallColor));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.75 - 18, w * 0.85, h * 0.75 - 18, 140, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.10, h * 0.55 - 18, w * 0.65, h * 0.55 - 18, 160, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.80, h * 0.12, 20, portalBase, portalAccent);

        } else if (levelIndex === 15) {
            // Level 16: Guarded Gate
            this.walls.push(new Wall(0, h * 0.78, w * 0.40, h * 0.78, wallColor));
            this.walls.push(new Wall(w * 0.60, h * 0.78, w, h * 0.78, wallColor));
            this.walls.push(new Wall(w * 0.20, h * 0.52, w * 0.80, h * 0.52, wallColor));
            this.walls.push(new Wall(0, h * 0.30, w * 0.40, h * 0.30, wallColor));
            this.walls.push(new Wall(w * 0.60, h * 0.30, w, h * 0.30, wallColor));
            this.hazards.push(new MovingHazard(w * 0.25, h * 0.52 - 18, w * 0.75, h * 0.52 - 18, 180, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.50, h * 0.70, 18, hazardColor)); // Raised so orb can clear the bottom gap
            this.portal = this.createExitPortal(w * 0.50, h * 0.10, 19, portalBase, portalAccent);

        } else if (levelIndex === 16) {
            // Level 17: Serpent Pass Patrol
            this.walls.push(new Wall(w * 0.25, h * 0.80, w, h * 0.80, wallColor));
            this.walls.push(new Wall(0, h * 0.65, w * 0.75, h * 0.65, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.50, w, h * 0.50, wallColor));
            this.walls.push(new Wall(0, h * 0.35, w * 0.75, h * 0.35, wallColor));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.80 - 18, w * 0.90, h * 0.80 - 18, 150, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.65 - 18, w * 0.65, h * 0.65 - 18, 170, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.50, h * 0.50 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.35 - 18, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.15, h * 0.12, 18, portalBase, portalAccent);

        } else if (levelIndex === 17) {
            // Level 18: Cross Patrol Matrix
            this.walls.push(new Wall(0, h * 0.82, w * 0.60, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.40, h * 0.66, w, h * 0.66, wallColor));
            this.walls.push(new Wall(0, h * 0.50, w * 0.60, h * 0.50, wallColor));
            this.walls.push(new Wall(w * 0.40, h * 0.34, w, h * 0.34, wallColor));
            this.hazards.push(new MovingHazard(w * 0.10, h * 0.82 - 18, w * 0.50, h * 0.82 - 18, 160, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.50, h * 0.66 - 18, w * 0.90, h * 0.66 - 18, 200, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.10, h * 0.50 - 18, w * 0.50, h * 0.50 - 18, 220, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.85, h * 0.10, 18, portalBase, portalAccent);

        } else if (levelIndex === 18) {
            // Level 19: Abyss Sweep
            this.walls.push(new Wall(w * 0.25, h * 0.82, w, h * 0.82, wallColor));
            this.walls.push(new Wall(0, h * 0.66, w * 0.75, h * 0.66, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.50, w, h * 0.50, wallColor));
            this.walls.push(new Wall(0, h * 0.34, w * 0.75, h * 0.34, wallColor));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.82 - 18, w * 0.90, h * 0.82 - 18, 160, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.10, h * 0.66 - 18, w * 0.65, h * 0.66 - 18, 180, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.50 - 18, w * 0.90, h * 0.50 - 18, 210, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.20, h * 0.34 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.60, h * 0.34 - 18, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.50, h * 0.10, 19, portalBase, portalAccent);

        } else if (levelIndex === 19) {
            // Level 20: Blade Runner
            this.walls.push(new Wall(0, h * 0.80, w * 0.45, h * 0.80, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.80, w, h * 0.80, wallColor));
            this.walls.push(new Wall(w * 0.20, h * 0.60, w * 0.80, h * 0.60, wallColor));
            this.walls.push(new Wall(0, h * 0.40, w * 0.45, h * 0.40, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.40, w, h * 0.40, wallColor));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.80 - 18, w * 0.40, h * 0.80 - 18, 170, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.60, h * 0.80 - 18, w * 0.95, h * 0.80 - 18, 170, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.25, h * 0.60 - 18, w * 0.75, h * 0.60 - 18, 220, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.40 - 18, w * 0.40, h * 0.40 - 18, 190, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.85, h * 0.10, 18, portalBase, portalAccent);

        } else if (levelIndex === 20) {
            // Level 21: Emerald Gauntlet
            this.walls.push(new Wall(w * 0.30, h * 0.84, w, h * 0.84, wallColor));
            this.walls.push(new Wall(0, h * 0.70, w * 0.70, h * 0.70, wallColor));
            this.walls.push(new Wall(w * 0.30, h * 0.56, w, h * 0.56, wallColor));
            this.walls.push(new Wall(0, h * 0.42, w * 0.70, h * 0.42, wallColor));
            this.hazards.push(new MovingHazard(w * 0.35, h * 0.84 - 18, w * 0.95, h * 0.84 - 18, 180, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.70 - 18, w * 0.65, h * 0.70 - 18, 200, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.35, h * 0.56 - 18, w * 0.95, h * 0.56 - 18, 220, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.42 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.55, h * 0.42 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.85, h * 0.42 - 18, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.15, h * 0.12, 18, portalBase, portalAccent);

        } else if (levelIndex === 21) {
            // Level 22: Kinetic Abyss
            this.walls.push(new Wall(0, h * 0.82, w * 0.45, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.82, w, h * 0.82, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.64, w * 0.75, h * 0.64, wallColor));
            this.walls.push(new Wall(0, h * 0.46, w * 0.45, h * 0.46, wallColor));
            this.walls.push(new Wall(w * 0.55, h * 0.46, w, h * 0.46, wallColor));
            this.walls.push(new Wall(w * 0.25, h * 0.28, w * 0.75, h * 0.28, wallColor));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.82 - 18, w * 0.40, h * 0.82 - 18, 190, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.60, h * 0.82 - 18, w * 0.95, h * 0.82 - 18, 190, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.30, h * 0.64 - 18, w * 0.70, h * 0.64 - 18, 220, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.46 - 18, w * 0.40, h * 0.46 - 18, 210, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.60, h * 0.46 - 18, w * 0.95, h * 0.46 - 18, 210, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.50, h * 0.28 - 18, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.50, h * 0.10, 18, portalBase, portalAccent);

        } else if (levelIndex === 22) {
            // Level 23: World 2 Emerald Apex Master Level
            this.walls.push(new Wall(w * 0.35, h * 0.84, w, h * 0.84, wallColor));
            this.walls.push(new Wall(0, h * 0.70, w * 0.65, h * 0.70, wallColor));
            this.walls.push(new Wall(w * 0.35, h * 0.56, w, h * 0.56, wallColor));
            this.walls.push(new Wall(0, h * 0.42, w * 0.65, h * 0.42, wallColor));
            this.walls.push(new Wall(w * 0.35, h * 0.28, w, h * 0.28, wallColor));
            this.hazards.push(new MovingHazard(w * 0.40, h * 0.84 - 18, w * 0.90, h * 0.84 - 18, 200, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.70 - 18, w * 0.60, h * 0.70 - 18, 220, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.40, h * 0.56 - 18, w * 0.90, h * 0.56 - 18, 240, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.05, h * 0.42 - 18, w * 0.60, h * 0.42 - 18, 230, 18, hazardColor));
            this.hazards.push(new MovingHazard(w * 0.40, h * 0.28 - 18, w * 0.90, h * 0.28 - 18, 250, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.56 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.85, h * 0.42 - 18, 18, hazardColor));
            this.hazards.push(new Hazard(w * 0.15, h * 0.28 - 18, 18, hazardColor));
            this.portal = this.createExitPortal(w * 0.88, h * 0.10, 18, portalBase, portalAccent);

        // --- Worlds 3 and 4 levels have been removed. ---
        } else {
            // Fallback for any invalid level index
            this.walls.push(new Wall(0, h * 0.8, w, h * 0.8, wallColor));
            this.portal = this.createExitPortal(w * 0.5, h * 0.1, 20, portalBase, portalAccent);
        }

        const skin = this.saveSystem.data.orbSkin || 'cyan';
        const spawnY = floorY - CONFIG.ORB_RADIUS - 2;
        if (this.player) {
            this.player.setSkin(skin);
            this.player.reset(w * 0.5, spawnY);
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

        this.echoWaves.push(new EchoWave(w * 0.5, spawnY, 160, 1.0, this.player ? this.player.color : CONFIG.COLOR_CYAN));

        // Clear Sonar tutorial highlight button state
        if (this.btnPulse) {
            this.btnPulse.classList.remove('pulse-tutorial-glow');
        }

        // Onboarding Tutorial Logic (World 1: Levels 1-3)
        if (levelIndex === 1) {
            // Level 2 (Sonar Pulse Tutorial): Highlight Sonar button with pulsing glow
            if (this.btnPulse) {
                this.btnPulse.classList.add('pulse-tutorial-glow');
            }
            // Trigger 1 free full-screen pulse at level start after 400ms
            setTimeout(() => {
                if (this.gameState === 'PLAYING' && this.currentLevelIndex === 1) {
                    this.triggerFreeAutoPulse();
                }
            }, 400);
        }

        this.updateOnScreenHint();
    }

    bindNavigationEvents() {
        // Legacy lang toggle (null in Phase 13 — safety guard)
        if (this.btnLangToggle) {
            this.btnLangToggle.addEventListener('click', () => {
                const current = this.saveSystem.data.language || 'en';
                const nextIdx = (LANG_ORDER.indexOf(current) + 1) % LANG_ORDER.length;
                this.setLanguage(LANG_ORDER[nextIdx]);
            });
        }

        // Main Menu Buttons
        const btnCampaign = document.getElementById('btn-menu-campaign');
        if (btnCampaign) {
            btnCampaign.addEventListener('click', () => {
                this.isEndless = false;
                this.switchState('LEVEL_SELECT');
            });
        }
        const btnEndless = document.getElementById('btn-menu-endless');
        if (btnEndless) {
            btnEndless.addEventListener('click', () => this.startEndlessMode());
        }
        const btnLeaderboard = document.getElementById('btn-menu-leaderboard');
        if (btnLeaderboard) {
            btnLeaderboard.addEventListener('click', () => {
                const lang = this.saveSystem.data.language || 'en';
                const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
                this._showLockToast(dict.leaderboardSoon || 'Leaderboard coming soon');
            });
        }

        // Dev Endless overlay (only wired when isDevMode)
        if (this.isDevBuild) {
            const bindDevBtn = (el, fn) => {
                if (!el) return;
                el.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fn();
                });
            };
            bindDevBtn(this.btnDevCamUp, () => this._devShiftEndlessMeters(50));
            bindDevBtn(this.btnDevCamDown, () => this._devShiftEndlessMeters(-50));
            bindDevBtn(this.btnDevGodMode, () => this._toggleDevGodMode());
        }
        const btnProfile = document.getElementById('btn-menu-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => this.switchState('PROFILE'));
        }

        // Settings button
        const btnSettings = document.getElementById('btn-menu-settings');
        if (btnSettings) btnSettings.addEventListener('click', () => this.switchState('SETTINGS'));

        // Settings modal close
        const btnSettingsClose = document.getElementById('btn-settings-close');
        if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => this.switchState('MENU'));

        // Settings: Language pill (cycles all langs)
        const btnSettingsLang = document.getElementById('btn-settings-lang');
        if (btnSettingsLang) {
            btnSettingsLang.addEventListener('click', () => {
                const current = this.saveSystem.data.language || 'en';
                const nextIdx = (LANG_ORDER.indexOf(current) + 1) % LANG_ORDER.length;
                this.setLanguage(LANG_ORDER[nextIdx]);
                this._syncSettingsUI();
            });
        }

        // Settings: SFX toggle
        const toggleSfx = document.getElementById('toggle-sfx');
        if (toggleSfx) {
            toggleSfx.addEventListener('click', () => {
                const next = this.saveSystem.data.sfxEnabled === false;
                this.saveSystem.data.sfxEnabled = next;
                this.saveSystem.save();
                this._syncSettingsUI();
            });
        }

        // Settings: Haptics toggle
        const toggleHaptics = document.getElementById('toggle-haptics');
        if (toggleHaptics) {
            toggleHaptics.addEventListener('click', () => {
                const next = this.saveSystem.data.hapticsEnabled === false;
                this.saveSystem.data.hapticsEnabled = next;
                this.saveSystem.save();
                this._syncSettingsUI();
            });
        }

        // Settings: Ghost toggle (settings only — not on pause menu)
        const toggleGhostSettings = document.getElementById('toggle-ghost-settings');
        if (toggleGhostSettings) {
            toggleGhostSettings.addEventListener('click', () => {
                const next = this.saveSystem.data.ghostEnabled === false;
                this.saveSystem.data.ghostEnabled = next;
                this.saveSystem.save();
                this._syncSettingsUI();
            });
        }

        // Settings: How To Play accordion
        const btnHtp = document.getElementById('btn-htp-toggle');
        const htpBody = document.getElementById('settings-htp-body');
        const htpArrow = document.getElementById('htp-arrow');
        if (btnHtp && htpBody) {
            btnHtp.addEventListener('click', () => {
                const wasHidden = htpBody.classList.contains('hidden');
                htpBody.classList.toggle('hidden', !wasHidden);
                if (htpArrow) htpArrow.classList.toggle('open', wasHidden);
            });
        }

        // Back Buttons
        document.getElementById('btn-level-back').addEventListener('click', () => this.switchState('MENU'));
        const btnTutBack = document.getElementById('btn-tutorial-back');
        if (btnTutBack) btnTutBack.addEventListener('click', () => this.switchState('MENU'));
        document.getElementById('btn-profile-back').addEventListener('click', () => this.switchState('MENU'));
        const btnProfileBackTop = document.getElementById('btn-profile-back-top');
        if (btnProfileBackTop) btnProfileBackTop.addEventListener('click', () => this.switchState('MENU'));

        // Carousel dot click navigation
        document.querySelectorAll('#carousel-dots .dot').forEach((dot, idx) => {
            dot.addEventListener('click', () => {
                const carousel = document.getElementById('worlds-carousel');
                const slides = carousel ? carousel.querySelectorAll('.carousel-slide') : [];
                if (slides[idx] && carousel) {
                    const slide  = slides[idx];
                    const target = slide.offsetLeft + slide.offsetWidth / 2 - carousel.offsetWidth / 2;
                    carousel.scrollTo({ left: target, behavior: 'smooth' });
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
            if (this.isEndless) {
                this.startEndlessMode();
            } else {
                this.resetLevel();
                this.switchState('PLAYING');
            }
        });
        document.getElementById('btn-pause-menu').addEventListener('click', () => {
            this.isEndless = false;
            this.switchState('MENU');
        });
        document.getElementById('btn-pause-level-select').addEventListener('click', () => {
            this.isEndless = false;
            this.switchState('LEVEL_SELECT');
        });

        const btnEndlessRetry = document.getElementById('btn-endless-retry');
        if (btnEndlessRetry) {
            btnEndlessRetry.addEventListener('click', () => this.startEndlessMode());
        }
        const btnEndlessMenu = document.getElementById('btn-endless-menu');
        if (btnEndlessMenu) {
            btnEndlessMenu.addEventListener('click', () => {
                this.isEndless = false;
                this.switchState('MENU');
            });
        }

        const togglePauseSound = document.getElementById('toggle-pause-sound');
        if (togglePauseSound) {
            togglePauseSound.addEventListener('click', () => {
                const next = this.saveSystem.data.sfxEnabled === false;
                this.saveSystem.data.sfxEnabled = next;
                this.saveSystem.save();
                this._syncPauseUI();
                this._syncSettingsUI();
            });
        }
        const togglePauseVibrate = document.getElementById('toggle-pause-vibrate');
        if (togglePauseVibrate) {
            togglePauseVibrate.addEventListener('click', () => {
                const next = this.saveSystem.data.hapticsEnabled === false;
                this.saveSystem.data.hapticsEnabled = next;
                this.saveSystem.save();
                this._syncPauseUI();
                this._syncSettingsUI();
                if (next) haptic([30]);
            });
        }

        // Unlock Web Audio on any user interaction
        document.addEventListener('touchstart', () => Audio.unlock(), { once: true, passive: true });
        document.addEventListener('pointerdown', () => Audio.unlock(), { once: true, passive: true });
    }

    bindSkinSelectorEvents() {
        // Legacy orb swatches (not shown in Phase 13 UI, but kept for save compat)
        if (this.skinSwatchesContainer) {
            this.skinSwatchesContainer.querySelectorAll('.skin-swatch').forEach(swatch => {
                swatch.addEventListener('click', () => {
                    const selectedColor = swatch.getAttribute('data-color');
                    this.saveSystem.data.orbSkin = selectedColor;
                    this.saveSystem.save();
                    this.skinSwatchesContainer.querySelectorAll('.skin-swatch').forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');
                    if (this.player) this.player.setSkin(selectedColor);
                });
            });
        }

        // Unified Theme Presets
        const themeContainer = document.getElementById('theme-presets');
        if (themeContainer) {
            themeContainer.querySelectorAll('.theme-preset').forEach(card => {
                card.addEventListener('click', () => {
                    const themeKey = card.getAttribute('data-theme');
                    const theme = THEMES[themeKey];
                    if (!theme) return;
                    this.saveSystem.data.theme = themeKey;
                    this.saveSystem.data.orbSkin = theme.color;
                    this.saveSystem.data.trailSkin = theme.trail;
                    this.saveSystem.save();
                    themeContainer.querySelectorAll('.theme-preset').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    if (this.player) this.player.setSkin(theme.color);
                });
            });
        }
    }

    bindEvents() {
        const handleTap = (clientX, clientY) => {
            if (this.gameState !== 'PLAYING') return;

            // First tap → immediately fade out tutorial hint banner
            if (!this._firstTapDone) {
                this._firstTapDone = true;
                this._fadeOutHintBanner();
            }

            const rect = this.canvas.getBoundingClientRect();
            const tapX = clientX - rect.left;
            const tapY = clientY - rect.top;
            const world = this.screenToWorld(tapX, tapY);

            const now = performance.now();
            const timeDiff = now - this.lastTapTime;
            const distDiff = Math.hypot(tapX - this.lastTapPos.x, tapY - this.lastTapPos.y);

            if (timeDiff < 300 && distDiff < 50) {
                this.triggerManualPulse();
            } else {
                this.player.applyImpulse(world.x, world.y, this);
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
                if (this.isEndless) this.startEndlessMode();
                else this.resetLevel();
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
        const dict     = TRANSLATIONS[lang] || TRANSLATIONS['en'];

        // World config for 4 Worlds (World 0: Training, World 1: Cyber, World 2: Emerald, World 3: Solar)
        const worldConfigs = [
            {
                title:  dict.world0Title || 'TRAINING GROUND',
                sub:    dict.world0Sub   || 'TUTORIAL • 3 STAGES',
                badge:  '📐',
                color:  'var(--neon-cyan)',
                startLvl: 1, endLvl: 3, count: 3, maxStars: 9,
                art: `<div class="wpa-portal"></div>
                      <div class="wpa-tg-wall"></div>
                      <div class="wpa-tg-orb"></div>
                      <div class="wpa-tg-pulse"></div>`
            },
            {
                title:  dict.world1Title || 'CYBER NEON',
                sub:    dict.world1Sub   || 'WORLD 1 • LEVELS 1–10',
                badge:  '⚡',
                color:  'var(--neon-cyan)',
                startLvl: 4, endLvl: 13, count: 10, maxStars: 30,
                art: `<div class="wpa-portal"></div>
                      <div class="wpa-wall wpa-wall-a"></div>
                      <div class="wpa-wall wpa-wall-b"></div>
                      <div class="wpa-neon-spike wpa-sp-1"></div>
                      <div class="wpa-neon-spike wpa-sp-2"></div>
                      <div class="wpa-neon-spike wpa-sp-3"></div>`
            },
            {
                title:  dict.world2Title || 'EMERALD ABYSS',
                sub:    dict.world2Sub   || 'WORLD 2 • LEVELS 11–20',
                badge:  '🌿',
                color:  'var(--neon-green)',
                startLvl: 14, endLvl: 23, count: 10, maxStars: 30,
                art: `<div class="wpa-portal"></div>
                      <div class="wpa-rail wpa-rail-1"></div>
                      <div class="wpa-rail wpa-rail-2"></div>
                      <div class="wpa-sliding-trap wpa-st-1"></div>
                      <div class="wpa-sliding-trap wpa-st-2"></div>`
            },
                        {
                title:  dict.world3Title || 'SOLAR CORE',
                sub:    dict.world3Sub   || 'WORLD 3 • LEVELS 21–30',
                badge:  '🔒',
                color:  '#555',
                startLvl: 24, endLvl: 33, count: 10, maxStars: 30,
                locked: true,
                art: `<div class="wpa-portal" style="filter: grayscale(1) opacity(0.5)"></div>`
            },
            {
                title:  'ABYSSAL VOID',
                sub:    'WORLD 4 • LEVELS 31–40',
                badge:  '🔒',
                color:  '#555',
                startLvl: 34, endLvl: 43, count: 10, maxStars: 30,
                locked: true,
                art: `<div class="wpa-portal" style="filter: grayscale(1) opacity(0.5)"></div>`
            }
        ];

        let html = '';
        for (let w = 0; w < worldConfigs.length; w++) {
            const cfg = worldConfigs[w];
            let worldStars = 0;
            let clearedCount = 0;

            for (let i = cfg.startLvl; i <= cfg.endLvl; i++) {
                if (this.saveSystem.data.bestTimes[i] !== null) clearedCount++;
                worldStars += (this.saveSystem.data.stars ? (this.saveSystem.data.stars[i] || 0) : 0);
            }
            const allClear = clearedCount === cfg.count;

            html += `<div class="carousel-slide" data-world="${w}">
                <div class="world-preview-art">${cfg.art}</div>
                <div class="world-card-footer">
                    <div class="world-card-top-row">
                        <div class="world-badge-group">
                            <span class="world-badge">${cfg.badge}</span>
                            <span class="world-card-sub">${cfg.locked ? 'COMING SOON' : cfg.sub}</span>
                        </div>
                        ${!cfg.locked ? `<div class="world-progress-badge${allClear ? ' all-clear' : ''}">
                            ⭐ ${worldStars}/${cfg.maxStars}
                        </div>` : ''}
                    </div>
                    <h3 class="world-card-title" style="color:${cfg.color}">${cfg.locked ? 'COMING SOON' : cfg.title}</h3>
                </div>
            </div>`;
        }

        carousel.innerHTML = html;

        // Render dynamic pagination dots for 4 worlds
        const dotsEl = document.getElementById('carousel-dots');
        if (dotsEl) {
            let dotsHtml = '';
            for (let w = 0; w < worldConfigs.length; w++) {
                dotsHtml += `<span class="dot${w === 0 ? ' active' : ''}" data-world="${w}"></span>`;
            }
            dotsEl.innerHTML = dotsHtml;
        }

        // Helper: find centred slide, toggle .active class, update dots
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

        const targetIdx = Math.min(3, Math.max(0, this.carouselWorldIndex || 0));
        const centreSlide = (idx) => {
            const slides = carousel.querySelectorAll('.carousel-slide');
            const slide  = slides[idx];
            if (!slide) return;
            const target = slide.offsetLeft + slide.offsetWidth / 2 - carousel.offsetWidth / 2;
            carousel.scrollLeft = target;
            updateActiveSlide();
        };
        requestAnimationFrame(() => requestAnimationFrame(() => centreSlide(targetIdx)));

        // World card tap → open expanded overlay
        carousel.querySelectorAll('.carousel-slide').forEach(slide => {
            slide.addEventListener('click', (e) => {
                if (e.target.closest('.wlg-btn')) return;
                const w = parseInt(slide.getAttribute('data-world'), 10);
                if (!isNaN(w)) this._openWorldExpanded(w);
            });
        });

        carousel.onscroll = updateActiveSlide;
    }

    updateCarouselDots(idx) {
        document.querySelectorAll('#carousel-dots .dot').forEach((d, i) => {
            d.classList.toggle('active', i === idx);
        });
    }

    // Sync all Settings modal toggle UI to current save state
    _syncSettingsUI() {
        const d = this.saveSystem.data;

        // Language pill label
        const langSub = document.getElementById('settings-lang-sub');
        const btnLangPill = document.getElementById('btn-settings-lang');
        const langNames = { en: 'English', he: 'Hebrew', es: 'Spanish', fr: 'French', ja: 'Japanese' };
        const lang = d.language || 'en';
        if (langSub) langSub.textContent = langNames[lang] || lang.toUpperCase();
        if (btnLangPill) {
            const nextIdx = (LANG_ORDER.indexOf(lang) + 1) % LANG_ORDER.length;
            const nextLang = LANG_ORDER[nextIdx].toUpperCase();
            btnLangPill.textContent = `${lang.toUpperCase()} → ${nextLang}`;
        }

        // SFX toggle
        const sfxOn = d.sfxEnabled !== false;
        const toggleSfx = document.getElementById('toggle-sfx');
        if (toggleSfx) {
            toggleSfx.setAttribute('data-state', sfxOn ? 'on' : 'off');
            toggleSfx.setAttribute('aria-checked', String(sfxOn));
        }

        // Haptics toggle
        const hapOn = d.hapticsEnabled !== false;
        const toggleHap = document.getElementById('toggle-haptics');
        if (toggleHap) {
            toggleHap.setAttribute('data-state', hapOn ? 'on' : 'off');
            toggleHap.setAttribute('aria-checked', String(hapOn));
        }

        // Ghost toggle
        const ghostOn = d.ghostEnabled !== false;
        const toggleGh = document.getElementById('toggle-ghost-settings');
        if (toggleGh) {
            toggleGh.setAttribute('data-state', ghostOn ? 'on' : 'off');
            toggleGh.setAttribute('aria-checked', String(ghostOn));
        }
    }

    _syncPauseUI() {
        const d = this.saveSystem.data;
        const sfxOn = d.sfxEnabled !== false;
        const hapOn = d.hapticsEnabled !== false;

        const toggleSound = document.getElementById('toggle-pause-sound');
        if (toggleSound) {
            toggleSound.setAttribute('data-state', sfxOn ? 'on' : 'off');
            toggleSound.setAttribute('aria-checked', String(sfxOn));
        }

        const toggleVibrate = document.getElementById('toggle-pause-vibrate');
        if (toggleVibrate) {
            toggleVibrate.setAttribute('data-state', hapOn ? 'on' : 'off');
            toggleVibrate.setAttribute('aria-checked', String(hapOn));
        }
    }

    renderProfile() {
        if (this.inputPlayerName) {
            this.inputPlayerName.value = this.saveSystem.data.playerName;
        }

        // Theme Preset active highlight
        const activeTheme = this.saveSystem.data.theme || 'cyber';
        const themeContainer = document.getElementById('theme-presets');
        if (themeContainer) {
            themeContainer.querySelectorAll('.theme-preset').forEach(card => {
                card.classList.toggle('active', card.getAttribute('data-theme') === activeTheme);
            });
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

    triggerFreeAutoPulse() {
        if (this.gameState !== 'PLAYING' || !this.player) return;
        const waveRadius = Math.max(this.width, this.height) * 0.9;
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

    triggerManualPulse() {
        const activeCd = (this.currentLevelIndex === 1) ? 1.0 : CONFIG.PULSE_COOLDOWN;
        if (this.pulseCooldown > 0 || this.gameState !== 'PLAYING') return;

        // Clear Level 2 Sonar tutorial glow highlight & hint text when Sonar is used
        if (this.btnPulse) {
            this.btnPulse.classList.remove('pulse-tutorial-glow');
        }
        if (this.currentLevelIndex === 1) {
            this._fadeOutHintBanner();
        }

        this.pulseCooldown = activeCd;
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
        if (this.devGodMode) return;
        if (this.isEndless) {
            this.triggerEndlessGameOver();
            return;
        }
        this.switchState('DEATH');
        this.deathTimer = 0.75;     // 750ms satisfying shatter & fade timing
        this.shakeTimer = 0.22;     // 220ms Glitch Shake effect
        this.redFlashTimer = 0.22;  // 220ms Red Flash overlay
        haptic([40, 30, 40]);       // haptic: brief vibration
        Audio.playDeath();          // audio: death crunch

        // Rich 2-layer Orb Shatter particle explosion effect at collision point
        const orbX = this.player ? this.player.pos.x : this.width / 2;
        const orbY = this.player ? this.player.pos.y : this.height / 2;
        const shatterColors = [CONFIG.COLOR_RED, '#ff5500', '#ffaa00', '#ff007f', '#ffffff'];
        
        // Layer 1: Fast directional sparks (45 particles)
        for (let i = 0; i < 45; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 120 + Math.random() * 280;
            const color = shatterColors[Math.floor(Math.random() * shatterColors.length)];
            const size = 2.5 + Math.random() * 3.5;
            this.particles.push(new Particle(
                orbX,
                orbY,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                color,
                size,
                0.6 + Math.random() * 0.25
            ));
        }

        // Layer 2: Expanding debris shockwave ring (16 particles)
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
            const speed = 70 + Math.random() * 90;
            const size = 3 + Math.random() * 2;
            this.particles.push(new Particle(
                orbX,
                orbY,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                '#ff3366',
                size,
                0.65 + Math.random() * 0.2
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
        // One-shot guard: prevent multiple calls from queuing duplicate setTimeout chains
        if (this._victorySequenceStarted) return;
        this._victorySequenceStarted = true;

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

            // Load the next level silently — explicit parseInt guards against string coercion
            const nextIdx = parseInt(this.currentLevelIndex, 10) + 1;
            this.startGameAtLevel(nextIdx);

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
        if (worldNum >= 3) return; // Locked worlds
        const overlay = document.getElementById('world-expanded-overlay');
        const card    = document.getElementById('world-expanded-card');
        if (!overlay || !card) return;

        const lang    = this.saveSystem.data.language || 'en';
        const dict    = TRANSLATIONS[lang] || TRANSLATIONS['en'];
        const unlocked = this.saveSystem.data.unlockedLevel;

        const worldRanges = [
            { start: 1,  end: 3,  count: 3 },  // World 0: Training Ground
            { start: 4,  end: 13, count: 10 }, // World 1: Cyber Neon
            { start: 14, end: 23, count: 10 }, // World 2: Emerald Abyss
            { start: 24, end: 33, count: 10 }  // World 3: Solar Core
        ];

        const range = worldRanges[worldNum] || worldRanges[0];
        const startLvl = range.start;
        const endLvl   = range.end;
        const worldUnlocked = startLvl <= unlocked;

        if (!worldUnlocked) {
            const wName = [dict.world0Title, dict.world1Title, dict.world2Title, dict.world3Title][worldNum] || `World ${worldNum}`;
            this._showLockToast(`🔒 Complete ${wName} to unlock!`);
            return;
        }

        const worldConfigs = [
            { title: dict.world0Title || 'TRAINING GROUND', sub: dict.world0Sub || 'TUTORIAL • 3 STAGES',   badge: '📐', color: 'var(--neon-cyan)',
              bg: 'linear-gradient(160deg,#03030e,#06071c)', art: `<div class="wpa-portal"></div><div class="wpa-tg-wall"></div>` },
            { title: dict.world1Title || 'CYBER NEON',   sub: dict.world1Sub || 'WORLD 1 • LEVELS 1–10',  badge: '⚡', color: 'var(--neon-cyan)',
              bg: 'linear-gradient(160deg,#03030e,#06071c)', art: `<div class="wpa-portal"></div><div class="wpa-wall wpa-wall-a"></div>` },
            { title: dict.world2Title || 'EMERALD ABYSS', sub: dict.world2Sub || 'WORLD 2 • LEVELS 11–20', badge: '🌿', color: 'var(--neon-green)',
              bg: 'linear-gradient(160deg,#020c06,#041510)', art: `<div class="wpa-portal"></div><div class="wpa-rail wpa-rail-1"></div>` },
            { title: dict.world3Title || 'SOLAR CORE',    sub: dict.world3Sub || 'WORLD 3 • LEVELS 21–30', badge: '🔥', color: 'var(--neon-gold)',
              bg: 'linear-gradient(160deg,#0d0400,#1b0900)', art: `<div class="wpa-portal"></div><div class="wpa-booster-field"><div class="wpa-booster-arrow">▲</div></div>` }
        ];
        const cfg = worldConfigs[worldNum];

        let levelsHtml = '';
        for (let i = startLvl; i <= endLvl; i++) {
            const isUnlocked = true; // Dev Override: all levels unlocked for testing
            const bestTime   = this.saveSystem.data.bestTimes[i];
            const isCleared  = bestTime !== null;
            const timeStr    = isCleared ? `${bestTime}s` : '—';
            const timeClass  = isCleared ? 'cleared' : 'uncleared';
            const btnClass   = isUnlocked ? 'unlocked' : 'locked';
            const starCount  = (this.saveSystem.data.stars ? (this.saveSystem.data.stars[i] || 0) : 0);
            const starsStr   = isCleared ? getStarsString(starCount) : '☆☆☆';

            let numDisplay = '';
            if (worldNum === 0) {
                numDisplay = `T${i}`;
            } else {
                numDisplay = `${i - 3}`; // i=4 -> 1, i=13 -> 10, i=14 -> 11, i=23 -> 20, i=24 -> 21, i=33 -> 30
            }

            levelsHtml += `<div class="wlg-btn ${btnClass}" data-level="${i}">
                <span class="wlg-num">${numDisplay}</span>
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
        if (this.nexusStreams) {
            for (let i = 0; i < this.nexusStreams.length; i++) {
                this.nexusStreams[i].update(dt, this.width, this.height);
            }
        }

        if (this.pulseCooldown > 0) {
            this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
            if (this.elCooldownBar) {
                const activeCd = (this.currentLevelIndex === 1) ? 1.0 : CONFIG.PULSE_COOLDOWN;
                const ratio = this.pulseCooldown / activeCd;
                this.elCooldownBar.style.transform = `scaleX(${ratio})`;
            }
        }

        if (this.shakeTimer > 0) {
            this.shakeTimer = Math.max(0, this.shakeTimer - dt);
        }
        if (this.redFlashTimer > 0) {
            this.redFlashTimer = Math.max(0, this.redFlashTimer - dt);
        }

        if (this.gameState === 'DEATH') {
            this.deathTimer -= dt;
            if (this.deathTimer <= 0) {
                this.resetLevel();
            }
        }

        if (this.gameState === 'PORTAL_ANIMATION') {
            this.portalAnimTimer += dt;
            // Total duration: 0.9s — zoom into black hole center, then fade to black
            const ANIM_DURATION = 0.9;

            if (this.portal) {
                // Smooth lerp camera toward portal center
                const lerpRate = dt * 5.5;
                this.camera.x += (this.portal.x - this.camera.x) * lerpRate;
                this.camera.y += (this.portal.y - this.camera.y) * lerpRate;
                // Scale up toward portal (zoom into black void)
                const targetZoom = 5.5;
                this.camera.scale += (targetZoom - this.camera.scale) * (dt * 3.8);
            }

            // Fade to BLACK (not green) starting at 35% progress
            if (this.portalAnimTimer > 0.35) {
                const fadeProgress = (this.portalAnimTimer - 0.35) / 0.55;
                this.camera.blackFadeAlpha = Math.min(1.0, fadeProgress * fadeProgress);
            }

            if (this.portalAnimTimer >= ANIM_DURATION) {
                this.camera.blackFadeAlpha = 1.0;
                // Switch state FIRST so this block never re-fires on subsequent frames
                this.switchState('VICTORY');
                this.finishVictorySequence();
            }
        }

        if (this.gameState === 'PLAYING') {
            // Zoom-out entry animation: ease camera scale back to 1.0
            if (this._zoomOutEntry && this.camera.scale > 1.005) {
                this.camera.scale += (1.0 - this.camera.scale) * (dt * 4.5);
                if (this.camera.scale <= 1.005) {
                    this.camera.scale = 1.0;
                    this._zoomOutEntry = false;
                }
            } else if (this._zoomOutEntry) {
                this.camera.scale = 1.0;
                this._zoomOutEntry = false;
            }

            this.player.update(dt, this);

            if (this.isEndless) {
                this.updateEndless(dt);
            }

            // Trajectory recording for Ghost Replay (campaign only)
            if (!this.isEndless) {
            this.recordTimer += dt;
            if (this.recordTimer >= 0.04) {
                this.recordTimer = 0;
                if (!this.currentTrajectory) this.currentTrajectory = [];
                this.currentTrajectory.push([
                    Math.round(this.player.pos.x * 10) / 10,
                    Math.round(this.player.pos.y * 10) / 10
                ]);
            }
            }

            // Ghost Orb Playback Update
            if (!this.isEndless && this.saveSystem.data.ghostEnabled !== false && this.ghostData && this.ghostData.length > 1) {
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

            // Gravitational portal pull — slower suck when very close (< 60px)
            if (!this.isEndless && this.portal) {
                const pdx = this.portal.x - this.player.pos.x;
                const pdy = this.portal.y - this.player.pos.y;
                const pdist = Math.hypot(pdx, pdy);
                const PULL_RADIUS = 90;
                if (pdist < PULL_RADIUS && pdist > 0) {
                    // Slow down player speed as it nears the portal center
                    const proximityFactor = pdist / PULL_RADIUS;
                    const speedDamp = 0.85 + proximityFactor * 0.15; // clamp speed less as it gets closer
                    this.player.vel.x *= speedDamp;
                    this.player.vel.y *= speedDamp;

                    const pullStr = 500 * Math.pow(1 - pdist / PULL_RADIUS, 1.5);
                    this.player.vel.x += (pdx / pdist) * pullStr * dt;
                    this.player.vel.y += (pdy / pdist) * pullStr * dt;
                }
            }

            if (!this.devGodMode) {
                for (const hazard of this.hazards) {
                    if (hazard.checkCollision(this.player)) {
                        this.triggerDeath();
                        break;
                    }
                }
            }

            if (!this.isEndless && this.gameState === 'PLAYING' && this.portal && this.portal.checkCollision(this.player)) {
                this.triggerAbsorption();
            }
        }

        // Portal absorption animation: slowly pull orb toward portal center, shrink to 0 over 0.6s
        if (this.gameState === 'ABSORBING') {
            const ABSORB_DURATION = 0.6;
            this.absorptionTimer += dt;
            const progress = Math.min(1, this.absorptionTimer / ABSORB_DURATION);

            if (this.portal && this.player) {
                // Smooth slow lerp toward portal center (slower than before = feels like gravity suck)
                const lerpRate = dt * (4 + progress * 10); // starts slow, accelerates
                this.player.pos.x += (this.portal.x - this.player.pos.x) * lerpRate;
                this.player.pos.y += (this.portal.y - this.player.pos.y) * lerpRate;
                this.player.vel.x = 0;
                this.player.vel.y = 0;
                // Smooth easeIn scale from 1 → 0
                this.player.drawScale = Math.max(0, 1 - progress * progress);

                // Spiral particles pulled into portal
                if (Math.random() < 0.75) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.max(0, this.portal.radius * (2.0 - progress * 1.8));
                    this.particles.push(new Particle(
                        this.portal.x + Math.cos(angle) * r,
                        this.portal.y + Math.sin(angle) * r,
                        (Math.random() - 0.5) * 15,
                        (Math.random() - 0.5) * 15,
                        Math.random() < 0.5 ? CONFIG.COLOR_GREEN : CONFIG.COLOR_GOLD,
                        2.0, 0.25
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

        const worldId = this.isEndless ? 1 : this.getWorldForLevel(this.currentLevelIndex);
        const theme = WORLD_THEMES[worldId] || WORLD_THEMES[1];

        this.ctx.fillStyle = theme.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Glitch Shake effect during hazard impact (150ms)
        if (this.shakeTimer > 0) {
            const intensity = (this.shakeTimer / 0.15) * 8;
            const shakeX = (Math.random() - 0.5) * intensity;
            const shakeY = (Math.random() - 0.5) * intensity;
            this.ctx.translate(shakeX, shakeY);
        }

        if (this.camera.scale !== 1.0 || this.camera.x !== this.width / 2 || this.camera.y !== this.height / 2) {
            this.ctx.translate(this.width / 2, this.height / 2);
            this.ctx.scale(this.camera.scale, this.camera.scale);
            this.ctx.translate(-this.camera.x, -this.camera.y);
        }

        this.renderGrid();

        // Draw live Nexus Light Streams behind menu/UI screens
        if (this.nexusStreams && (this.gameState === 'MENU' || this.gameState === 'LEVEL_SELECT' || this.gameState === 'SETTINGS' || this.gameState === 'PROFILE')) {
            for (let i = 0; i < this.nexusStreams.length; i++) {
                this.nexusStreams[i].draw(this.ctx);
            }
        }

        for (const wall of this.walls) {
            wall.draw(this.ctx, this);
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

        if (this.player && this.gameState !== 'DEATH' && this.gameState !== 'MENU' && this.gameState !== 'ENDLESS_GAME_OVER') {
            this.player.draw(this.ctx);
        }

        this.ctx.restore();

        // Subtle 150ms Red Flash overlay on hazard collision
        if (this.redFlashTimer > 0) {
            this.ctx.save();
            const flashAlpha = (this.redFlashTimer / 0.15) * 0.35;
            this.ctx.globalAlpha = Math.min(0.35, flashAlpha);
            this.ctx.fillStyle = '#ff0033';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.restore();
        }

        // Black fade overlay for portal exit (replaces green flash)
        if (this.camera.blackFadeAlpha > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = Math.min(1.0, this.camera.blackFadeAlpha);
            this.ctx.fillStyle = '#000000';
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
        const worldId = this.isEndless ? 1 : this.getWorldForLevel(this.currentLevelIndex);
        const theme = WORLD_THEMES[worldId] || WORLD_THEMES[1];

        this.ctx.save();
        this.ctx.globalAlpha = 0.065;
        this.ctx.strokeStyle = theme.wall;
        this.ctx.lineWidth = 1;

        const gridSize = 40;
        const s = this.camera.scale || 1;
        const camActive = this.camera.scale !== 1.0
            || this.camera.x !== this.width / 2
            || this.camera.y !== this.height / 2;

        // When the camera transform is active, tile across the visible world rect
        // so the neon grid never runs out as endless mode scrolls upward.
        let x0, y0, x1, y1;
        if (camActive) {
            const halfW = this.width / (2 * s);
            const halfH = this.height / (2 * s);
            x0 = this.camera.x - halfW - gridSize;
            x1 = this.camera.x + halfW + gridSize;
            y0 = this.camera.y - halfH - gridSize;
            y1 = this.camera.y + halfH + gridSize;
        } else {
            x0 = 0;
            y0 = 0;
            x1 = this.width;
            y1 = this.height;
        }

        const startX = Math.floor(x0 / gridSize) * gridSize;
        const startY = Math.floor(y0 / gridSize) * gridSize;

        for (let x = startX; x <= x1; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, y0);
            this.ctx.lineTo(x, y1);
            this.ctx.stroke();
        }
        for (let y = startY; y <= y1; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x0, y);
            this.ctx.lineTo(x1, y);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        // Cap dt to 33ms (30fps floor) — prevents huge jumps on lag spikes
        if (dt > 0.033) dt = 0.033;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new EchoBounceGame();
});
