/**
 * Echo Bounce — Auth & Leaderboard services
 * Ready for Capacitor native / Firebase Auth wrappers via:
 *   window.EchoAuthNative.signInWithGoogle / signInWithApple / signOut
 *   window.EchoFirebaseAuth.signInWithGoogle / signInWithApple / signOut
 *   window.EchoLeaderboardRemote.fetchTop / submitScore
 */

class AuthService {
    constructor() {
        this.STORAGE_KEY = 'echo_bounce_auth_v1';
        this.user = null;
        this._listeners = [];
        this._load();
    }

    isAuthenticated() {
        return !!(this.user && this.user.isGuest === false);
    }

    getUser() {
        return this.user;
    }

    onAuthStateChanged(cb) {
        this._listeners.push(cb);
        try { cb(this.user); } catch (e) {}
        return () => {
            this._listeners = this._listeners.filter(fn => fn !== cb);
        };
    }

    _emit() {
        for (const cb of this._listeners) {
            try { cb(this.user); } catch (e) {}
        }
    }

    _load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.uid && parsed.isGuest === false) {
                this.user = parsed;
            }
        } catch (e) {}
    }

    _persist() {
        try {
            if (this.user && this.user.isGuest === false) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.user));
            } else {
                localStorage.removeItem(this.STORAGE_KEY);
            }
        } catch (e) {}
    }

    _setUser(user) {
        this.user = user ? {
            uid: String(user.uid),
            displayName: user.displayName || null,
            email: user.email || null,
            photoURL: user.photoURL || null,
            provider: user.provider || 'unknown',
            isGuest: false,
            isLocalSession: !!user.isLocalSession
        } : null;
        this._persist();
        this._emit();
        return this.user;
    }

    /** Prefer native Capacitor bridge, then Firebase web wrapper, then local linked session. */
    async _resolveProviderSignIn(provider) {
        const nativeFn = window.EchoAuthNative && window.EchoAuthNative[
            provider === 'apple' ? 'signInWithApple' : 'signInWithGoogle'
        ];
        if (typeof nativeFn === 'function') {
            const result = await nativeFn();
            return { ...result, provider, isLocalSession: false };
        }

        const firebaseFn = window.EchoFirebaseAuth && window.EchoFirebaseAuth[
            provider === 'apple' ? 'signInWithApple' : 'signInWithGoogle'
        ];
        if (typeof firebaseFn === 'function') {
            const result = await firebaseFn();
            return { ...result, provider, isLocalSession: false };
        }

        // Scaffolding fallback: stable local linked account until wrappers are wired
        return this._localProviderSignIn(provider);
    }

    async _localProviderSignIn(provider) {
        const key = `echo_bounce_${provider}_uid`;
        let uid = null;
        try { uid = localStorage.getItem(key); } catch (e) {}
        if (!uid) {
            uid = `${provider}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            try { localStorage.setItem(key, uid); } catch (e) {}
        }
        return {
            uid,
            displayName: null,
            email: null,
            photoURL: null,
            provider,
            isGuest: false,
            isLocalSession: true
        };
    }

    async signInWithGoogle() {
        const user = await this._resolveProviderSignIn('google');
        return this._setUser(user);
    }

    async signInWithApple() {
        const user = await this._resolveProviderSignIn('apple');
        return this._setUser(user);
    }

    async signOut() {
        try {
            if (window.EchoAuthNative && typeof window.EchoAuthNative.signOut === 'function') {
                await window.EchoAuthNative.signOut();
            } else if (window.EchoFirebaseAuth && typeof window.EchoFirebaseAuth.signOut === 'function') {
                await window.EchoFirebaseAuth.signOut();
            }
        } catch (e) {
            console.warn('Auth signOut adapter error', e);
        }
        this._setUser(null);
    }

    /** Update display name on the active session (keeps uid). */
    updateDisplayName(name) {
        if (!this.user || this.user.isGuest !== false) return;
        this.user.displayName = name || this.user.displayName;
        this._persist();
        this._emit();
    }
}

class LeaderboardService {
    constructor() {
        this.CACHE_KEY = 'echo_bounce_lb_v1';
        this.GUEST_KEY = 'echo_bounce_guest_uid';
        this.entries = [];
        this._loadCache();
        if (!this.entries.length) {
            this.entries = this._seedEntries();
            this._saveCache();
        }
    }

    getGuestUid() {
        try {
            let id = localStorage.getItem(this.GUEST_KEY);
            if (!id) {
                id = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
                localStorage.setItem(this.GUEST_KEY, id);
            }
            return id;
        } catch (e) {
            return 'guest_local';
        }
    }

    _seedEntries() {
        const seed = [
            { name: 'NovaPulse', distance: 486, avatarHue: 190 },
            { name: 'EchoFox', distance: 412, avatarHue: 145 },
            { name: 'VoidRunner', distance: 355, avatarHue: 280 },
            { name: 'CyanDrift', distance: 298, avatarHue: 200 },
            { name: 'OrbitKid', distance: 241, avatarHue: 40 },
            { name: 'GlowByte', distance: 188, avatarHue: 320 },
            { name: 'Prism', distance: 142, avatarHue: 90 },
            { name: 'NightTap', distance: 96, avatarHue: 220 }
        ];
        return seed.map((s, i) => ({
            uid: `seed_${i}_${s.name.toLowerCase()}`,
            name: s.name,
            photoURL: null,
            avatarHue: s.avatarHue,
            distance: s.distance,
            updatedAt: Date.now() - i * 86400000,
            isSeed: true
        }));
    }

    _loadCache() {
        try {
            const raw = localStorage.getItem(this.CACHE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) this.entries = parsed;
        } catch (e) {}
    }

    _saveCache() {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.entries));
        } catch (e) {}
    }

    _sort() {
        this.entries.sort((a, b) => (b.distance || 0) - (a.distance || 0) || (a.name || '').localeCompare(b.name || ''));
    }

    async fetchTop(limit = 25) {
        if (window.EchoLeaderboardRemote && typeof window.EchoLeaderboardRemote.fetchTop === 'function') {
            try {
                const remote = await window.EchoLeaderboardRemote.fetchTop(limit);
                if (Array.isArray(remote) && remote.length) {
                    // Keep local-only rows that aren't on remote yet
                    const remoteUids = new Set(remote.map(r => r.uid));
                    const localOnly = this.entries.filter(e => !e.isSeed && !remoteUids.has(e.uid));
                    this.entries = [...remote.map(r => ({ ...r, isSeed: false })), ...localOnly];
                    this._sort();
                    this._saveCache();
                }
            } catch (e) {
                console.warn('Leaderboard remote fetch failed, using cache', e);
            }
        }
        this._sort();
        return this.entries.slice(0, limit);
    }

    /**
     * Submit / upsert an authenticated player's Endless best distance.
     * No-ops for guests (caller should check auth).
     */
    async submitScore({ uid, name, photoURL, distance }) {
        if (!uid) return { ok: false, reason: 'no-uid' };
        const dist = Math.max(0, Math.floor(distance || 0));
        if (dist <= 0) return { ok: false, reason: 'no-score' };

        const idx = this.entries.findIndex(e => e.uid === uid);
        const prev = idx >= 0 ? this.entries[idx] : null;
        const next = {
            uid,
            name: name || (prev && prev.name) || 'Player',
            photoURL: photoURL || (prev && prev.photoURL) || null,
            avatarHue: (prev && prev.avatarHue) != null ? prev.avatarHue : Math.floor(Math.random() * 360),
            distance: Math.max(dist, (prev && prev.distance) || 0),
            updatedAt: Date.now(),
            isSeed: false
        };

        if (idx >= 0) this.entries[idx] = next;
        else this.entries.push(next);
        this._sort();
        this._saveCache();

        if (window.EchoLeaderboardRemote && typeof window.EchoLeaderboardRemote.submitScore === 'function') {
            try {
                await window.EchoLeaderboardRemote.submitScore(next);
            } catch (e) {
                console.warn('Leaderboard remote submit failed; kept local', e);
                return { ok: true, queuedLocal: true, entry: next, rank: this.getRankForUid(uid) };
            }
        }

        return { ok: true, entry: next, rank: this.getRankForUid(uid) };
    }

    getRankForUid(uid) {
        if (!uid) return null;
        this._sort();
        const i = this.entries.findIndex(e => e.uid === uid);
        return i >= 0 ? i + 1 : null;
    }

    getEntry(uid) {
        return this.entries.find(e => e.uid === uid) || null;
    }

    /** Build view model: top list + current player row (auth or guest local best). */
    buildView(limit, currentUser, localBest, localName) {
        this._sort();
        const top = this.entries.slice(0, limit);
        let youUid = currentUser && currentUser.uid;
        let youName = (currentUser && (currentUser.displayName || localName)) || localName || 'You';
        let youPhoto = currentUser && currentUser.photoURL;
        let youDistance = Math.max(0, Math.floor(localBest || 0));
        let isGuest = !(currentUser && currentUser.isGuest === false);

        if (!isGuest) {
            const entry = this.getEntry(youUid);
            if (entry) youDistance = Math.max(youDistance, entry.distance || 0);
        }

        // Provisional guest rank against the board (not submitted globally)
        let rank = null;
        if (!isGuest && youUid) {
            rank = this.getRankForUid(youUid);
            if (rank == null && youDistance > 0) {
                rank = this.entries.filter(e => (e.distance || 0) > youDistance).length + 1;
            }
        } else if (youDistance > 0) {
            rank = this.entries.filter(e => (e.distance || 0) > youDistance).length + 1;
        }

        return {
            top,
            you: {
                uid: youUid || this.getGuestUid(),
                name: youName,
                photoURL: youPhoto || null,
                distance: youDistance,
                rank,
                isGuest,
                isOnBoard: !isGuest && !!this.getEntry(youUid)
            }
        };
    }
}

// Singleton exports for the game
window.EchoAuthService = window.EchoAuthService || new AuthService();
window.EchoLeaderboardService = window.EchoLeaderboardService || new LeaderboardService();
