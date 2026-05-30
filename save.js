// ============================================================
// save.js — Persistent profile + in-progress game (localStorage)
// ============================================================
// Survives refresh, code updates, and closing the tab. Stores:
//   - unlocked card ids (the collection you've discovered)
//   - lifetime stats (plays, wins, best day reached)
//   - a snapshot of the current game so you can Continue

const Save = {
  KEY: 'castlechaos_v1',
  data: null,

  defaults() {
    return { unlocked: [], stats: { plays: 0, wins: 0, bestDay: 0 }, game: null };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.data = raw ? { ...this.defaults(), ...JSON.parse(raw) } : this.defaults();
    } catch (e) {
      this.data = this.defaults();
    }
    // Heal missing sub-objects after a schema bump
    if (!this.data.stats) this.data.stats = this.defaults().stats;
    if (!Array.isArray(this.data.unlocked)) this.data.unlocked = [];
    return this.data;
  },

  persist() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  // --- Collection ---
  isUnlocked(id) { return this.data.unlocked.includes(id); },
  unlock(id) {
    if (!id || this.data.unlocked.includes(id)) return false;
    this.data.unlocked.push(id);
    this.persist();
    return true; // newly unlocked
  },
  // Unlock everything currently in the human's possession; collect new ids
  discoverFrom(player) {
    const fresh = [];
    const ids = [...player.hand.map(c => c.id), ...player.assassins.map(c => c.id)];
    ids.forEach(id => { if (this.unlock(id)) fresh.push(id); });
    return fresh;
  },

  // --- Stats ---
  recordResult(won, day) {
    this.data.stats.plays++;
    if (won) this.data.stats.wins++;
    if (day > this.data.stats.bestDay) this.data.stats.bestDay = day;
    this.persist();
  },

  // --- In-progress game snapshot ---
  // We persist ONE clean checkpoint: the start of each day (morning intro,
  // before turns begin). No timers, AI callbacks, or object cross-references
  // are live there, so a JSON round-trip + reload restores it perfectly.
  hasGame() { return !!this.data.game; },
  saveGame(state) {
    if (!state) return;
    if (state.phase !== 'morning' || state.morningStarted) return;
    try {
      const snap = JSON.parse(JSON.stringify(state));
      snap.cook = null; snap.winner = null; snap.busy = false;
      snap.pendingTrade = null; snap.pendingItemTrade = null;
      this.data.game = snap;
      this.persist();
    } catch (e) {}
  },
  loadGame() { return this.data.game ? JSON.parse(JSON.stringify(this.data.game)) : null; },
  clearGame() { this.data.game = null; this.persist(); },
};

Save.load();
