// ============================================================
// game-engine.js — Core game loop for Castle Chaos
// ============================================================

const Engine = {
  state: null,

  init() {
    // Randomly assign a unique ruler to each player
    const pool = [...RULERS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const players = PLAYERS_CONFIG.map((cfg, i) => {
      const ruler = pool[i];
      const maxHealth = START_HEALTH + (ruler.passive === 'tough' ? 1 : 0);
      return {
        ...cfg,
        ruler,
        maxHealth,
        health: maxHealth,
        money: START_MONEY,
        hand: CardSystem.createStartingHand(),
        assassins: [CardSystem.createDailyAssassin()],
        location: cfg.homeTower,
        poisoned: false,
        shielded: false,
        dead: false,
        placedAssassins: [], // [locationId, ...] set at midnight
        sleepLocation: null,
      };
    });

    this.state = {
      day: 1,
      phase: 'setup', // setup|morning|afternoon|evening|midnight|resolve
      players,
      turnIdx: 0,
      cook: null,
      notification: null, // {msg, type} big banner — replaces the history log
      pendingTrade: null,
      pendingItemTrade: null, // Merchant-initiated item swap
      timeLeft: 0,            // afternoon countdown
      doneZones: [],
      allDone: false,
      cardsEarned: 0,
      placing: false,         // midnight: placing assassins vs choosing sleep
      busy: false,            // input lock: true while a move/animation/AI is resolving
      winner: null,
    };

    this.notify('👑 Rulers assigned — the day begins shortly…', 'info');
    return this.state;
  },

  // Setup screen auto-advances to Day 1 (not a button press)
  beginGame() {
    if (this.state.phase !== 'setup') return;
    this.startMorning();
  },

  // Restore a saved in-progress game (snapshotted at the start of a day).
  // Just reinstate the state and repaint — the morning intro is player-driven
  // so there are no timers/AI callbacks left mid-flight. Returns true on success.
  resume() {
    const snap = (typeof Save !== 'undefined') && Save.loadGame();
    if (!snap || !snap.players || snap.phase !== 'morning' || snap.morningStarted) return false;
    this.state = snap;
    this.state.busy = false;
    this.state.cook = null;
    this.state.winner = null;
    this.state.pendingTrade = null;
    this.state.pendingItemTrade = null;
    UI.render();
    return true;
  },

  // --- Helpers ---
  human() { return this.state.players[0]; },
  alive() { return this.state.players.filter(p => !p.dead); },
  aliveAI() { return this.alive().filter(p => p.ai); },

  // Draw a card into a hand, respecting the 7-card hand limit.
  // Returns true if the card was added, false if the hand was full.
  drawInto(player, card = CardSystem.randomDraw()) {
    if (player.hand.length >= HAND_LIMIT) return false;
    player.hand.push(card);
    return true;
  },

  // Big, obvious notification banner. type: info | good | bad | warn
  notify(msg, type = 'info') {
    this.state.notification = { msg, type };
  },
  // Back-compat: older calls use log(); route them to the banner.
  log(msg) { this.notify(msg, 'info'); },

  // --- Ruler passive helper ---
  hasPassive(player, passive) {
    return player.ruler && player.ruler.passive === passive;
  },

  // --- Input lock ---------------------------------------------------------
  // While `busy` is true, every player-facing action is ignored so that one
  // move (and its animation / AI follow-up) fully completes before the next
  // can begin. lock() sets it; unlock() clears it and repaints.
  lock() { this.state.busy = true; UI.render(); },
  unlock() { this.state.busy = false; UI.render(); },
  // True if the player is allowed to act right now.
  canAct() { return this.state && !this.state.busy; },
  // Schedule work behind the lock: locks now, runs fn after `ms`, leaving the
  // lock for fn to release (or auto-releases if release !== false).
  defer(ms, fn) {
    this.lock();
    setTimeout(() => fn(), ms);
  },

  // ============================================================
  // MORNING PHASE — strict turn-based: 1 turn each, max 2 plays/turn
  // ============================================================
  startMorning() {
    this.state.phase = 'morning';
    this.state.morningStarted = false; // gate: show "MORNING" before play
    // Everyone moves to central
    this.alive().forEach(p => { p.location = 'central'; });
    // Give daily assassin (Warlord draws an extra one). Assassins ACCUMULATE
    // up to the cap. Skipped on Day 1 so you start the game with just 1.
    if (this.state.day > 1) {
      this.alive().forEach(p => {
        p.assassins.push(CardSystem.createDailyAssassin());
        if (this.hasPassive(p, 'extra_assassin')) p.assassins.push(CardSystem.createDailyAssassin());
        if (p.assassins.length > ASSASSIN_CAP) p.assassins = p.assassins.slice(-ASSASSIN_CAP);
      });
    }
    // Daily card draw — everyone draws fresh cards each morning (capped at 7)
    this.alive().forEach(p => {
      for (let i = 0; i < DAILY_DRAW; i++) this.drawInto(p);
    });
    // Resolve poison from last night (Witch is immune)
    this.alive().forEach(p => {
      if (p.poisoned) {
        p.poisoned = false;
        if (this.hasPassive(p, 'poison_immune')) return;
        p.health -= 1;
        this.checkDeath(p);
      }
    });

    // Turn order: human first, then living AIs — TWO full rounds (2 turns each)
    const order = this.alive().map(p => p.id);
    this.state.turnOrder = [...order, ...order];
    this.state.turnPos = 0;
    this.state.playsLeft = 2;
    this.state.busy = false;   // the Start button is now clickable

    this.notify(`☀️ Day ${this.state.day} — drew ${DAILY_DRAW} cards.`, 'info');
    UI.render();
  },

  // Player taps "Start" on the MORNING screen to begin taking turns
  beginMorningTurns() {
    if (!this.canAct() || this.state.morningStarted) return;
    this.state.morningStarted = true;
    this.startTurn();
  },

  // --- Turn helpers ---
  currentPlayer() {
    const id = this.state.turnOrder[this.state.turnPos];
    return this.state.players.find(p => p.id === id);
  },
  isHumanTurn() {
    const cur = this.currentPlayer();
    return cur && !cur.ai && !cur.dead;
  },

  startTurn() {
    // Skip dead players
    while (this.currentPlayer() && this.currentPlayer().dead) {
      this.state.turnPos++;
    }
    if (this.state.turnPos >= this.state.turnOrder.length) {
      this.endMorning();
      return;
    }
    const cur = this.currentPlayer();
    this.state.playsLeft = 2;
    if (cur.ai) {
      // Bot turn: keep input locked until the bot finishes acting
      this.state.busy = true;
      this.notify(`${cur.icon} ${cur.name}'s turn`, 'info');
      UI.render();
      setTimeout(() => this.aiTakeTurn(cur), 1600);
    } else {
      // Human turn: release the lock so the player can act
      this.state.busy = false;
      this.notify(`Your turn — play 2 cards or skip.`, 'info');
      UI.render();
    }
  },

  // Advance to the next player's turn (locked during the brief pause)
  nextTurn() {
    this.state.busy = true;
    this.state.turnPos++;
    UI.render();
    setTimeout(() => this.startTurn(), 900);
  },

  // Player chooses to skip the rest of their turn
  skipTurn() {
    if (!this.canAct() || !this.isHumanTurn()) return;
    this.notify(`You skip your turn.`, 'warn');
    this.nextTurn();
  },

  // Called after the human resolves a play; ends turn when out of plays
  consumePlay() {
    this.state.playsLeft--;
    if (this.state.playsLeft <= 0) {
      this.notify(`Turn over — no plays left.`, 'warn');
      this.nextTurn();
    } else {
      this.state.busy = false; // still your turn — you may act again
      UI.render();
    }
  },

  // Player offers a character card (truth or bluff) to a rival for coins
  offerTrade(cardUID, claimId, targetId) {
    if (!this.canAct()) return;
    const me = this.human();
    const target = this.state.players.find(p => p.id === targetId);
    if (!target || target.dead) return;

    const realCard = me.hand.find(c => c.uid === cardUID);
    if (!realCard) return;

    const claim = CHARACTER_CARDS.find(c => c.id === claimId);
    if (!claim) return;

    const isBluff = realCard.id !== claimId;

    this.state.pendingTrade = {
      from: me, to: target, realCard, claim, isBluff, cardUID, humanPlay: true
    };

    // Lock while the rival decides
    this.state.busy = true;
    this.notify(`📨 You offer ${claim.icon} ${claim.name} to ${target.name} — ${claim.tradePrice}🪙.`, 'info');
    UI.render();
    // AI decides
    if (target.ai) {
      setTimeout(() => this.aiRespondTrade(), 1600);
    }
  },

  aiRespondTrade() {
    const trade = this.state.pendingTrade;
    if (!trade) return;
    const buyer = trade.to;
    const price = trade.claim.tradePrice;

    // Smart-ish: the pricier the claim, the more suspicious the bot.
    // suspicion scales with price; bots challenge more on expensive offers.
    const canAfford = buyer.money >= price;
    const challengeChance = 0.15 + price * 0.07;       // e.g. price 4 -> ~0.43
    const roll = Math.random();
    if (buyer.money >= 2 && roll < challengeChance) {
      this.resolveChallenge();
    } else if (canAfford && roll < challengeChance + 0.5) {
      this.resolveAccept();
    } else {
      this.resolveDecline();
    }
  },

  resolveAccept() {
    const trade = this.state.pendingTrade;
    if (!trade) return;
    const wasHumanPlay = trade.humanPlay;
    const aiResume = trade.aiResume;
    this.state.pendingTrade = null;
    const youBuyer = trade.to === this.human();

    const cost = trade.claim.tradePrice;
    const paid = Math.min(trade.to.money, cost);
    trade.to.money -= paid;
    trade.from.money += paid;

    if (trade.isBluff) {
      // SCAM! The seller pockets the coins, the buyer gets nothing. Shown instantly.
      const youGotScammed = trade.to === this.human();
      const youScammed = trade.from === this.human();
      if (youGotScammed) FX.event('scam');
      else if (youScammed) { FX.sound('coins'); FX.float('SCAM! +' + paid + '🪙', '#ffd86b'); }
      else FX.sound('scam');
      this.notify(
        `🎭 SCAM! ${trade.from.name} bluffed — pocketed ${paid}🪙 for a worthless ${trade.claim.name}.`,
        youGotScammed ? 'bad' : 'good');
    } else {
      this.applyCharacterEffect(trade.to, trade.from, trade.claim);
      if (trade.from === this.human()) FX.sound('coins');
      this.notify(`✅ ${trade.to.name} bought ${trade.from.name}'s ${trade.claim.icon} ${trade.claim.name} — ${paid}🪙.`, 'good');
    }
    CardSystem.removeFromHand(trade.from, trade.cardUID);
    this.afterTrade(wasHumanPlay, aiResume);
  },

  resolveDecline() {
    const trade = this.state.pendingTrade;
    if (!trade) return;
    const wasHumanPlay = trade.humanPlay;
    const aiResume = trade.aiResume;
    this.state.pendingTrade = null;
    this.notify(`❌ ${trade.to.name} declined ${trade.from.name}'s offer.`, 'warn');
    // The offered card is spent even on a decline
    CardSystem.removeFromHand(trade.from, trade.cardUID);
    this.afterTrade(wasHumanPlay, aiResume);
  },

  resolveChallenge() {
    const trade = this.state.pendingTrade;
    if (!trade) return;
    const wasHumanPlay = trade.humanPlay;
    const aiResume = trade.aiResume;
    this.state.pendingTrade = null;
    const youChallenger = trade.to === this.human();

    if (trade.isBluff) {
      // Caught! The bigger the bluff, the bigger the fine (min 2, = the claim's price)
      const fine = Math.max(2, trade.claim.tradePrice);
      trade.from.money = Math.max(0, trade.from.money - fine);
      const t = youChallenger ? 'good' : 'bad';
      if (youChallenger) { FX.sound('coins'); FX.float('CAUGHT! 🎯', '#6bff8a'); }
      else { FX.event('damage'); }
      this.notify(`⚔️ CAUGHT! ${trade.to.name} called ${trade.from.name}'s bluff — −${fine}🪙.`, t);
    } else {
      // Wrong challenge! Challenger loses 2 money
      trade.to.money = Math.max(0, trade.to.money - 2);
      const t = youChallenger ? 'bad' : 'good';
      if (youChallenger) { FX.sound('scam'); FX.float('WRONG! -2🪙', '#ff6b6b'); }
      this.notify(`⚔️ HONEST! ${trade.from.name} told the truth — ${trade.to.name} loses 2🪙.`, t);
    }
    CardSystem.removeFromHand(trade.from, trade.cardUID);
    this.afterTrade(wasHumanPlay, aiResume);
  },

  // After any trade resolves: route based on who was acting.
  // - human's own play  -> consume one of the human's plays
  // - an AI's offer to the human -> resume that AI's turn
  afterTrade(wasHumanPlay, aiResume) {
    if (this.state.phase !== 'morning') { this.state.busy = false; UI.render(); return; }
    if (wasHumanPlay && this.isHumanTurn()) {
      // Stay locked through the brief beat before the play is consumed
      this.state.busy = true;
      UI.render();
      setTimeout(() => this.consumePlay(), 700);
    } else if (aiResume) {
      // The human just answered a bot's offer — keep locked while the bot continues
      this.state.busy = true;
      UI.render();
      setTimeout(() => this.aiTakeTurn(aiResume.ai, aiResume.playsMade), 1400);
    } else {
      UI.render();
    }
  },

  applyCharacterEffect(buyer, seller, card) {
    const buyerIsHuman = buyer === this.human();
    if (card.effect === 'heal') { buyer.health += card.value; if (buyerIsHuman) FX.event('heal'); else FX.sound('heal'); }
    else if (card.effect === 'shield') { buyer.shielded = true; if (buyerIsHuman) FX.event('shield'); else FX.sound('shield'); }
    else if (card.effect === 'money') { buyer.money += card.value; if (buyerIsHuman) FX.event('coins'); else FX.sound('coins'); }
    else if (card.effect === 'draw') { for (let i = 0; i < card.value; i++) this.drawInto(buyer); FX.sound('card'); }
  },

  // End morning, transition to the afternoon task run
  endMorning() {
    UI.transition('🌤️ AFTERNOON', 'Supply raid — pick your rooms before the clock runs out!', () => {
      this.startAfternoon();
    });
  },

  // ============================================================
  // AFTERNOON PHASE — timed supply raid; spend a few picks on rooms
  // ============================================================
  startAfternoon() {
    this.state.phase = 'afternoon';
    this.state.timeLeft = AFTERNOON_SECONDS;
    this.state.doneZones = [];          // completed zone ids (unique)
    this.state.allDone = false;
    this.state.cardsEarned = 0;
    this.state.picksLeft = AFTERNOON_PICKS; // limited picks — choose wisely
    this.state.activeZone = null;       // zone currently being worked
    this.state.workProgress = 0;        // 0-100 fill of the active task
    this.state.busy = false;            // player may click rooms freely
    this.notify(`🌤️ Supply raid! Work ${AFTERNOON_PICKS} rooms before time runs out.`, 'info');
    UI.render();
    // Countdown ticks once per second
    this._afternoonTimer = setInterval(() => this.tickAfternoon(), 1000);
  },

  tickAfternoon() {
    if (this.state.phase !== 'afternoon') return;
    this.state.timeLeft--;
    if (this.state.timeLeft <= 0) {
      this.endAfternoon();
    } else {
      UI.renderAfternoonTimer();
    }
  },

  // Click a glowing room -> begin working its task (a fill-the-bar mini-game)
  doTask(zoneId) {
    if (!this.canAct()) return;
    if (this.state.phase !== 'afternoon' || this.state.allDone) return;
    if (this.state.activeZone) return;             // already working a room
    if (this.state.doneZones.includes(zoneId)) return;
    if (this.state.picksLeft <= 0) return;
    const zone = TASK_ZONES.find(z => z.id === zoneId);
    if (!zone) return;
    this.state.activeZone = zone.id;
    this.state.workProgress = 0;
    FX.sound('click');
    this.notify(`⚒️ ${zone.task} — mash SPACE / tap to work!`, 'info');
    UI.render();
    // Progress slowly slips so you must keep tapping
    this._workTimer = setInterval(() => this.decayWork(), 140);
  },

  // Each tap/space press pushes the task forward
  workTask() {
    if (this.state.phase !== 'afternoon' || !this.state.activeZone) return;
    this.state.workProgress = Math.min(100, this.state.workProgress + 9);
    FX.sound('click');
    if (this.state.workProgress >= 100) { this.finishTask(); return; }
    UI.renderWorkBar();
  },

  // Idle slip — keeps the mini-game tense
  decayWork() {
    if (this.state.phase !== 'afternoon' || !this.state.activeZone) return;
    this.state.workProgress = Math.max(0, this.state.workProgress - 2);
    UI.renderWorkBar();
  },

  // Task bar filled -> award the room's card, spend a pick
  finishTask() {
    if (this._workTimer) { clearInterval(this._workTimer); this._workTimer = null; }
    const zone = TASK_ZONES.find(z => z.id === this.state.activeZone);
    this.state.activeZone = null;
    this.state.workProgress = 0;
    if (!zone) { UI.render(); return; }
    const me = this.human();
    const card = CardSystem.cardById(zone.cardId) || CardSystem.randomCard(zone.cardType);
    // Assassins go to the assassin pool; other cards respect the 7-card hand limit.
    if (card.type === 'assassin') {
      me.assassins.push(card);
      if (me.assassins.length > ASSASSIN_CAP) me.assassins = me.assassins.slice(-ASSASSIN_CAP);
    } else if (!this.drawInto(me, card)) {
      this.notify(`✋ Hand full (max ${HAND_LIMIT}) — ${zone.task} skipped.`, 'warn');
      UI.render();
      return; // don't spend the pick; player can clear space and retry
    }
    this.state.doneZones.push(zone.id);
    this.state.cardsEarned++;
    this.state.picksLeft--;
    FX.sound('done');
    FX.float(`+${card.icon} ${card.name}`, '#6bff8a');
    this.notify(`✅ ${zone.task}! Got ${card.icon} ${card.name}.`, 'good');
    // Out of picks (or every room raided) -> the raid is over, move on
    if (this.state.picksLeft <= 0 || this.state.doneZones.length >= TASK_ZONES.length) {
      this.state.allDone = true;
      if (this._afternoonTimer) { clearInterval(this._afternoonTimer); this._afternoonTimer = null; }
      this.notify('🏁 Raid complete!', 'good');
      this.defer(1100, () => this.endAfternoon());
    }
    UI.render();
  },

  // Back out of a task without spending a pick
  cancelTask() {
    if (this._workTimer) { clearInterval(this._workTimer); this._workTimer = null; }
    this.state.activeZone = null;
    this.state.workProgress = 0;
    UI.render();
  },

  endAfternoon() {
    if (this._afternoonTimer) { clearInterval(this._afternoonTimer); this._afternoonTimer = null; }
    if (this._workTimer) { clearInterval(this._workTimer); this._workTimer = null; }
    if (this.state.phase !== 'afternoon') return;
    this.state.activeZone = null; this.state.workProgress = 0;
    // AIs each gain 1-2 random cards from their "tasks" (capped at 7)
    this.aliveAI().forEach(p => {
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) this.drawInto(p);
    });
    const earned = this.state.cardsEarned;
    this.state.allDone = false;
    UI.transition('🌅 EVENING', `You gathered ${earned} card${earned === 1 ? '' : 's'} today.`, () => {
      this.startEvening();
    });
  },

  // ============================================================
  // EVENING — a cook is chosen by dice; effects are INSTANT
  // ============================================================
  // Pick tonight's cook. If it's the human, they choose; otherwise the
  // chosen AI decides immediately.
  startEvening() {
    this.state.phase = 'evening';
    const alive = this.alive();
    const cook = alive[Math.floor(Math.random() * alive.length)];
    this.state.cook = cook;
    if (cook === this.human()) {
      this.state.busy = false; // your choice — unlock the cook buttons
      this.notify('🍳 The dice chose YOU to cook!', 'info');
      UI.render();
    } else {
      this.state.busy = true;  // bot decides; keep locked
      this.notify(`🎲 ${cook.icon} ${cook.name} is cooking…`, 'info');
      UI.render();
      setTimeout(() => this.aiCook(cook), 1600);
    }
  },

  // Human's instant cook choice
  cook(poison) {
    if (!this.canAct()) return;
    if (this.state.cook !== this.human()) return;
    this.state.busy = true; // resolving the meal
    this.applyCook(this.human(), poison);
  },

  aiCook(cook) {
    // Bots poison ~35% of the time
    const poison = Math.random() < 0.35;
    this.applyCook(cook, poison);
  },

  // Apply the cooking result immediately and visibly, then go to midnight
  applyCook(cook, poison) {
    if (poison) {
      // Poison everyone but the cook — instantly, and everyone sees it
      const victims = this.alive().filter(p => p !== cook);
      victims.forEach(p => {
        if (this.hasPassive(p, 'poison_immune')) return;
        p.poisoned = true;
      });
      FX.event('poison');
      const cookIsHuman = cook === this.human();
      this.notify(`☠️ ${cookIsHuman ? 'You' : cook.name} POISONED the feast! Everyone else: −1 HP at dawn.`,
        cookIsHuman ? 'good' : 'bad');
    } else {
      // Clean meal — the cook earns 3 coins
      cook.money += 3;
      if (cook === this.human()) FX.event('coins');
      this.notify(`🍽️ ${cook === this.human() ? 'You' : cook.name} served a clean feast — +3🪙.`, 'good');
    }
    UI.transition('🌙 MIDNIGHT', 'Hide your assassins, then choose a bed.', () => {
      this.startMidnight();
    });
  },

  startMidnight() {
    this.state.phase = 'midnight';
    this.state.placing = true;      // true = placing assassins, false = choosing sleep
    this.state.busy = false;        // player places assassins / picks a bed
    UI.render();
  },

  // ============================================================
  // MIDNIGHT PHASE — place MANY assassins, then choose where to sleep
  // ============================================================
  placeAssassin(location) {
    if (!this.canAct()) return;
    const me = this.human();
    if (!this.state.placing) return;
    if (me.assassins.length === 0) return;
    me.placedAssassins.push(location);
    me.assassins.shift(); // consume one
    FX.sound('click');
    this.notify(`🥷 Assassin hidden in ${this.roomName(location)}. (${me.assassins.length} left)`, 'info');
    UI.render();
  },

  // Finish placing (or skip placing entirely) -> move to sleep choice
  donePlacing() {
    if (!this.canAct()) return;
    this.state.placing = false;
    this.notify('🛏️ Now choose your bed.', 'info');
    UI.render();
  },

  roomName(id) {
    const r = CASTLE_ROOMS.find(x => x.id === id);
    return r ? r.name : id;
  },

  chooseSleep(location) {
    if (!this.canAct()) return;
    if (this.state.placing) return; // must finish placing first
    const me = this.human();
    me.sleepLocation = location;
    this.state.busy = true; // night resolves now — lock everything

    // AI places its assassins and chooses sleep
    this.aliveAI().forEach(p => {
      const locs = ASSASSIN_LOCATIONS.filter(l => l !== p.homeTower);
      while (p.assassins.length > 0) {
        p.placedAssassins.push(locs[Math.floor(Math.random() * locs.length)]);
        p.assassins.shift();
      }
      // AI sleeps in its home tower 55% of the time (safe), else a random room
      if (Math.random() < 0.55) p.sleepLocation = p.homeTower;
      else p.sleepLocation = ASSASSIN_LOCATIONS[Math.floor(Math.random() * ASSASSIN_LOCATIONS.length)];
    });

    this.resolveNight();
  },

  // ============================================================
  // RESOLVE — narrated night: suspense beats, then advance the day
  // ============================================================
  resolveNight() {
    this.state.phase = 'resolve';
    this.state.busy = true; // lock everything while the night plays out
    UI.render();
    const me = this.human();

    // Sentinel ruler regains a shield each midnight
    this.alive().forEach(p => {
      if (this.hasPassive(p, 'night_shield') && !p.shielded) p.shielded = true;
    });

    // --- Resolve every victim's room. An attacker NEVER hits themselves
    // (you can hide an assassin in your own bed safely). ---
    const otherEvents = []; // brief lines about the AIs
    let myBeats = [];       // dramatic beats for YOUR room
    let playerDied = false;

    this.alive().forEach(victim => {
      if (!victim.sleepLocation) return;
      let struck = 0, blocked = 0;
      this.alive().forEach(attacker => {
        if (attacker === victim) return; // your own assassins can't harm you
        const hits = attacker.placedAssassins.filter(loc => loc === victim.sleepLocation).length;
        for (let i = 0; i < hits; i++) {
          if (victim.shielded && Math.random() < 0.4) { victim.shielded = false; blocked++; }
          else { victim.health -= 2; struck++; }
        }
      });
      if (victim === me) {
        myBeats = this.buildNightBeats(struck, blocked);
        if (me.health <= 0) playerDied = true;
      } else if (struck > 0) {
        otherEvents.push(`🥷 ${victim.name} was ambushed in ${this.roomName(victim.sleepLocation)} — −${struck * 2} HP!`);
      } else if (blocked > 0) {
        otherEvents.push(`🛡️ ${victim.name}'s guard held in ${this.roomName(victim.sleepLocation)}.`);
      } else {
        otherEvents.push(`😴 ${victim.name} slept soundly.`);
      }
    });

    // Clear placements now that hits are tallied
    this.alive().forEach(p => { p.placedAssassins = []; p.sleepLocation = null; });

    // Play the narrated sequence, then wrap up the night
    this.narrateNight(myBeats, otherEvents, playerDied);
  },

  // Build the suspense beats for the human's own room
  buildNightBeats(struck, blocked) {
    const room = this.roomName(this.human().sleepLocation);
    const beats = [];
    beats.push({ msg: `🌙 The torches die. You curl up in the ${room}…`, type: 'info' });
    if (struck === 0 && blocked === 0) {
      beats.push({ msg: `…only the wind. A floorboard settles.`, type: 'info' });
      beats.push({ msg: `😌 A quiet night. You wake unharmed.`, type: 'good' });
      return beats;
    }
    beats.push({ msg: `👣 A sound in the dark… footsteps draw near.`, type: 'warn' });
    beats.push({ msg: `🫨 A shadow slips beneath your door…`, type: 'warn' });
    const total = struck + blocked;
    for (let i = 0; i < total; i++) {
      // Interleave blocks and hits for drama; blocks first
      if (i < blocked) beats.push({ msg: `🛡️ Steel meets steel — your guard holds!`, type: 'good', fx: 'shield' });
      else beats.push({ msg: `🗡️ A blade flashes — SLASH! −2 HP`, type: 'bad', fx: 'damage' });
    }
    if (struck > 0) beats.push({ msg: `🩸 The assassin melts back into the night…`, type: 'bad' });
    else beats.push({ msg: `🏃 The intruder flees empty-handed!`, type: 'good' });
    return beats;
  },

  // Reveal the night one beat at a time (~2.2s each → ~15s total), then finish
  narrateNight(myBeats, otherEvents, playerDied) {
    const seq = [...myBeats];
    if (otherEvents.length) seq.push({ msg: '🏰 Elsewhere in the castle…', type: 'info' });
    otherEvents.forEach(e => seq.push({ msg: e, type: e.includes('ambushed') ? 'bad' : 'info' }));

    let i = 0;
    const step = () => {
      if (this.state.phase !== 'resolve') return; // safety
      if (i >= seq.length) { this.finishNight(playerDied); return; }
      const b = seq[i++];
      this.notify(b.msg, b.type);
      if (b.fx) FX.event(b.fx);
      UI.render();
      setTimeout(step, 2200);
    };
    step();
  },

  // After the narration: deaths, win check, advance the day
  finishNight(playerDied) {
    this.alive().forEach(p => this.checkDeath(p));
    if (this.checkWin()) return;
    this.state.day++;
    this.state.busy = false;
    setTimeout(() => {
      UI.transition(`☀️ DAY ${this.state.day}`, 'A new morning dawns.', () => this.startMorning());
    }, 1400);
    UI.render();
  },

  checkDeath(player) {
    if (player.health <= 0 && !player.dead) {
      player.dead = true;
      player.health = 0;
      this.log(`💀 ${player.name} has been eliminated!`);
    }
  },

  checkWin() {
    const alive = this.alive();
    if (alive.length === 1) {
      const won = alive[0] === this.human();
      this.state.winner = alive[0];
      this.endGame(won);
      if (won) FX.event('win'); else FX.sound('gong');
      this.notify(`🏆 ${alive[0].name} wins!`, won ? 'good' : 'bad');
      UI.render();
      return true;
    }
    if (this.human().dead) {
      this.state.winner = null;
      this.endGame(false);
      FX.sound('gong');
      this.notify('💀 You have been eliminated.', 'bad');
      UI.render();
      return true;
    }
    return false;
  },

  // Finalize a game: record stats and clear the saved in-progress snapshot
  endGame(won) {
    this.state.phase = 'gameover';
    if (typeof Save !== 'undefined') {
      Save.discoverFrom(this.human()); // unlock whatever you ended holding
      Save.recordResult(won, this.state.day);
      Save.clearGame();
    }
  },

  // ============================================================
  // USE ITEM — items are played on YOURSELF
  // ============================================================
  useItem(cardUID) {
    if (!this.canAct()) return;
    const me = this.human();
    const card = me.hand.find(c => c.uid === cardUID && c.type === 'item');
    if (!card) return;

    if (card.effect === 'heal') {
      me.health += card.value; // overheal allowed
      FX.event('heal');
      this.notify(`💚 ${card.icon} ${card.name} — +${card.value} HP.`, 'good');
    } else if (card.effect === 'money') {
      me.money += card.value;
      FX.event('coins');
      this.notify(`💰 ${card.icon} ${card.name} — +${card.value}🪙.`, 'good');
    } else if (card.effect === 'shield') {
      me.shielded = true;
      FX.event('shield');
      this.notify(`🛡️ ${card.icon} ${card.name} — 40% to block an assassin tonight.`, 'good');
    } else if (card.effect === 'antidote') {
      me.poisoned = false;
      me.health += card.value;
      FX.event('heal');
      this.notify(`💊 ${card.icon} ${card.name} — poison blocked, +${card.value} HP.`, 'good');
    } else if (card.effect === 'draw') {
      CardSystem.removeFromHand(me, cardUID); // free its slot first so draws fit the cap
      let drawn = 0;
      for (let i = 0; i < card.value; i++) if (this.drawInto(me)) drawn++;
      FX.sound('card'); FX.float(`+${drawn} cards`, '#6bb6ff');
      this.notify(`📜 ${card.icon} ${card.name} — drew ${drawn} card${drawn === 1 ? '' : 's'}.`, 'good');
    } else if (card.effect === 'assassin') {
      for (let i = 0; i < card.value; i++) me.assassins.push(CardSystem.createDailyAssassin());
      if (me.assassins.length > ASSASSIN_CAP) me.assassins = me.assassins.slice(-ASSASSIN_CAP);
      FX.sound('click'); FX.float('🥷 +1 Assassin', '#d4a8f0');
      this.notify(`🗡️ ${card.icon} ${card.name} — gained an assassin for tonight.`, 'good');
    } else if (card.effect === 'maxhp') {
      me.maxHealth += 1;
      me.health += card.value;
      FX.event('heal');
      this.notify(`🍖 ${card.icon} ${card.name} — +1 max HP, +${card.value} HP.`, 'good');
    }

    CardSystem.removeFromHand(me, cardUID);
    // During the morning turn, using an item costs one play
    if (this.state.phase === 'morning' && this.isHumanTurn()) this.consumePlay();
    else UI.render();
  },

  // ============================================================
  // AI TURN — up to 2 plays: offer a card to a rival (human or AI)
  // ============================================================
  aiTakeTurn(ai, playsMade = 0) {
    if (ai.dead || this.state.phase !== 'morning') { this.nextTurn(); return; }
    if (playsMade >= 2) { this.notify(`${ai.icon} ${ai.name} ends their turn.`, 'info'); this.nextTurn(); return; }

    const sellable = ai.hand.filter(c => c.type === 'character' && !c.free);
    // 35% chance to stop early (feels less robotic)
    if (sellable.length === 0 || (playsMade >= 1 && Math.random() < 0.4)) {
      this.notify(`${ai.icon} ${ai.name} ends their turn.`, 'info');
      this.nextTurn();
      return;
    }

    const realCard = sellable[Math.floor(Math.random() * sellable.length)];
    const sellableTypes = CHARACTER_CARDS.filter(c => !c.free);
    // Bots bluff like real players (~45%): claim a pricier card than they hold
    let claim = realCard;
    if (Math.random() < 0.45) {
      // Prefer claiming a higher-value card to maximize the scam profit
      const pricier = sellableTypes.filter(c => c.tradePrice >= realCard.tradePrice);
      const pool = pricier.length ? pricier : sellableTypes;
      claim = pool[Math.floor(Math.random() * pool.length)];
    }
    const isBluff = realCard.id !== claim.id;

    // Choose a target: prefer the human ~60% of the time
    const others = this.alive().filter(p => p !== ai);
    const human = this.human();
    let target;
    if (!human.dead && Math.random() < 0.6) target = human;
    else target = others[Math.floor(Math.random() * others.length)];

    if (target === human) {
      // Offer to the human and WAIT for their response; continue turn after.
      this.state.pendingTrade = {
        from: ai, to: human, realCard, claim, isBluff, cardUID: realCard.uid,
        humanPlay: false, aiResume: { ai, playsMade: playsMade + 1 }
      };
      // Release the lock so the human can Accept / Decline / Challenge
      this.state.busy = false;
      this.notify(`📨 ${ai.icon} ${ai.name} offers you ${claim.icon} ${claim.name} — ${claim.tradePrice}🪙.`, 'info');
      UI.render();
    } else {
      // AI-to-AI deal resolves immediately
      const paid = Math.min(target.money, claim.tradePrice || 2);
      const accepts = target.money >= claim.tradePrice && Math.random() < 0.7;
      if (accepts) {
        target.money -= paid; ai.money += paid;
        if (!isBluff) this.applyCharacterEffect(target, ai, claim);
        CardSystem.removeFromHand(ai, realCard.uid);
        this.notify(`🤝 ${ai.name} sold ${claim.icon} ${claim.name} to ${target.name}.`, 'info');
      } else {
        this.notify(`${target.name} declined ${ai.name}'s offer.`, 'warn');
      }
      UI.render();
      setTimeout(() => this.aiTakeTurn(ai, playsMade + 1), 1500);
    }
  },
};
