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
      const maxHealth = START_HEALTH + (ruler.passive === 'tough' ? 5 : 0);
      return {
        ...cfg,
        ruler,
        maxHealth,
        health: maxHealth,
        money: START_MONEY,
        hand: CardSystem.createStartingHand(),
        assassins: [CardSystem.createDailyAssassin(), CardSystem.createDailyAssassin()],
        location: cfg.homeTower,
        poisoned: false,
        poisonBy: null,    // who poisoned you (for the dawn message)
        shieldChance: 0,   // 0 = no shield; else 0..1 chance to block each assassin hit tonight
        dead: false,
        placedAssassins: [], // [locationId, ...] — hidden any time via the map
        sleepLocation: null,
        lastNightDamage: 0,  // HP lost to assassins last night (Giant's ability heals this)
        abilityUsedDay: null, // day the ruler ability was last used (null = never)
      };
    });

    this.state = {
      day: 1,
      phase: 'setup', // setup|day|sleep|resolve|gameover
      players,
      notification: null, // {msg, type} big banner
      pendingTrade: null,
      pendingItemTrade: null,  // Merchant: buy a rival's item with coins
      pendingTarget: null,     // targeted item (e.g. Poison Vial) awaiting a victim
      pendingAbility: null,    // targeted ruler ability (Witch) awaiting a victim
      overlay: null,           // null | 'market' | 'map' — fullscreen pause overlay
      shopTab: 'buffs',
      dayStarted: false,       // gate before the day's turns (also the save point)
      busy: false,             // input lock while a move/AI resolves
      winner: null,
    };

    this.notify('👑 Rulers assigned — your reign begins…', 'info');
    return this.state;
  },

  // Setup screen auto-advances to Day 1 (not a button press)
  beginGame() {
    if (this.state.phase !== 'setup') return;
    this.startDay();
  },

  // Restore a saved in-progress game (snapshotted at the start of a day,
  // before turns begin — no live timers/AI callbacks there).
  resume() {
    const snap = (typeof Save !== 'undefined') && Save.loadGame();
    if (!snap || !snap.players || snap.phase !== 'day' || snap.dayStarted) return false;
    this.state = snap;
    this.state.busy = false;
    this.state.overlay = null;
    this.state.winner = null;
    this.state.pendingTrade = null;
    this.state.pendingItemTrade = null;
    this.state.pendingTarget = null;
    this.state.pendingAbility = null;
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
  // Private notify: only surfaces to the banner when the affected player is
  // the human. Rivals' own item/ability use stays hidden & stealthy.
  notifyMine(player, msg, type = 'info') {
    if (player === this.human()) this.notify(msg, type);
  },
  // Back-compat: older calls use log(); route them to the banner.
  log(msg) { this.notify(msg, 'info'); },

  // --- Ruler passive helper ---
  hasPassive(player, passive) {
    return player.ruler && player.ruler.passive === passive;
  },

  // Grant a shield for the coming night. Shields are CHANCE-BASED: `chance`
  // is the probability (0..1) that each incoming assassin hit is blocked.
  // Stacking takes the BEST chance rather than adding (keeps it readable).
  giveShield(player, chance) {
    player.shieldChance = Math.max(player.shieldChance || 0, chance);
  },
  // Human-readable shield percentage for the UI (e.g. "40%"). 0 if none.
  shieldPct(player) { return Math.round((player.shieldChance || 0) * 100); },

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
  // DAY PHASE — dawn upkeep, then strict turn-based trading.
  // The Market and Castle Map are openable any time (they pause the game).
  // ============================================================
  startDay() {
    this.state.phase = 'day';
    this.state.dayStarted = false; // gate: show the DAY intro before turns
    this.state.overlay = null;
    this.alive().forEach(p => { p.location = 'central'; });

    // Dawn upkeep (skipped on Day 1 so you open with your starting hand + kit)
    if (this.state.day > 1) {
      this.alive().forEach(p => {
        for (let i = 0; i < DAILY_ASSASSINS; i++) p.assassins.push(CardSystem.createDailyAssassin());
        if (p.assassins.length > ASSASSIN_CAP) p.assassins = p.assassins.slice(-ASSASSIN_CAP);
        for (let i = 0; i < DAILY_DRAW; i++) this.drawInto(p);
      });
      this.resolveDawnPoison();
    }
    // Bots quietly visit the market at dawn
    this.aliveAI().forEach(ai => { if (this.aiShop) this.aiShop(ai); });

    // Turn order: human first, then living AIs — TWO full rounds (2 turns each)
    const order = this.alive().map(p => p.id);
    this.state.turnOrder = [...order, ...order];
    this.state.turnPos = 0;
    this.state.playsLeft = 2;
    this.state.busy = false;

    this.notify(this.state.day === 1
      ? `☀️ Day 1 — survive the nights. Trade, arm up, and hide your killers.`
      : `☀️ Day ${this.state.day} dawns — drew ${DAILY_DRAW} cards.`, 'info');
    UI.render();
  },

  // Poison ticks at dawn for 2 (Witch immune — clearly announced).
  resolveDawnPoison() {
    this.alive().forEach(p => {
      if (!p.poisoned) return;
      p.poisoned = false;
      const by = p.poisonBy; p.poisonBy = null;
      if (this.hasPassive(p, 'poison_immune')) {
        if (p === this.human()) { FX.event('shield'); }
        this.notify(`🧙‍♀️ ${p === this.human() ? 'You are' : p.name + ' is'} the Witch — poison is blocked!`, p === this.human() ? 'good' : 'info');
        return;
      }
      p.health -= 2;
      if (p === this.human()) FX.event('poison');
      this.notify(`☠️ ${p === this.human() ? 'You take' : p.name + ' takes'} 2 poison damage at dawn!`, p === this.human() ? 'bad' : 'info');
      this.checkDeath(p);
    });
  },

  // Player taps "Begin" on the DAY intro to start taking turns
  beginDayTurns() {
    if (!this.canAct() || this.state.dayStarted) return;
    this.state.dayStarted = true;
    this.startTurn();
    if (typeof Tutorial !== 'undefined' && this.state.day === 1) {
      setTimeout(() => Tutorial.maybeStart(), 200);
    }
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
    while (this.currentPlayer() && this.currentPlayer().dead) {
      this.state.turnPos++;
    }
    if (this.state.turnPos >= this.state.turnOrder.length) {
      this.endDay();
      return;
    }
    const cur = this.currentPlayer();
    this.state.playsLeft = 2;
    if (cur.ai) {
      this.state.busy = true;
      this.notify(`${cur.icon} ${cur.name}'s turn`, 'info');
      UI.render();
      setTimeout(() => this.aiTakeTurn(cur), 2600);
    } else {
      this.state.busy = false;
      this.notify(`Your turn — trade, use items, shop, or hide assassins.`, 'info');
      UI.render();
    }
  },

  nextTurn() {
    this.state.busy = true;
    this.state.turnPos++;
    UI.render();
    setTimeout(() => this.startTurn(), 1400);
  },

  skipTurn() {
    if (!this.canAct() || !this.isHumanTurn()) return;
    this.notify(`You end your turn.`, 'warn');
    this.nextTurn();
  },

  consumePlay() {
    this.state.playsLeft--;
    if (this.state.playsLeft <= 0) {
      this.notify(`Turn over — no plays left.`, 'warn');
      this.nextTurn();
    } else {
      this.state.busy = false;
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
      setTimeout(() => this.aiRespondTrade(), 2600);
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
      // Consume the played card, THEN fire any bluff special (Jester/Wizard).
      // Removing first keeps swap-hands correct (the spent card isn't swapped).
      CardSystem.removeFromHand(trade.from, trade.cardUID);
      if (trade.realCard && trade.realCard.bluffSpecial) {
        this.applyBluffSpecial(trade.from, trade.to, trade.realCard);
      }
    } else {
      this.applyCharacterEffect(trade.to, trade.from, trade.claim);
      // Honest sales pay the SELLER a bonus on top of the buyer's coins — honesty pays.
      const bonus = HONEST_BONUS;
      trade.from.money += bonus;
      if (trade.from === this.human()) { FX.sound('coins'); FX.float(`HONEST +${bonus}🪙`, '#6bff8a'); }
      this.notify(`✅ ${trade.to.name} bought ${trade.from.name}'s ${trade.claim.icon} ${trade.claim.name} — ${paid}🪙 +${bonus}🪙 honesty bonus to ${trade.from.name}.`, 'good');
      CardSystem.removeFromHand(trade.from, trade.cardUID);
    }
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
    if (this.state.phase !== 'day') { this.state.busy = false; UI.render(); return; }
    if (wasHumanPlay && this.isHumanTurn()) {
      // Stay locked through the brief beat before the play is consumed
      this.state.busy = true;
      UI.render();
      setTimeout(() => this.consumePlay(), 1200);
    } else if (aiResume) {
      // The human just answered a bot's offer — keep locked while the bot continues
      this.state.busy = true;
      UI.render();
      setTimeout(() => this.aiTakeTurn(aiResume.ai, aiResume.playsMade), 2400);
    } else {
      UI.render();
    }
  },

  applyCharacterEffect(buyer, seller, card) {
    const buyerIsHuman = buyer === this.human();
    const sellerIsHuman = seller === this.human();
    if (card.effect === 'heal') { buyer.health += card.value; if (buyerIsHuman) FX.event('heal'); }
    else if (card.effect === 'shield') { this.giveShield(buyer, card.value || 0.4); if (buyerIsHuman) FX.event('shield'); }
    else if (card.effect === 'money') { buyer.money += card.value; if (buyerIsHuman) FX.event('coins'); }
    else if (card.effect === 'draw') { for (let i = 0; i < card.value; i++) this.drawInto(buyer); if (buyerIsHuman || sellerIsHuman) FX.sound('card'); }
    else if (card.effect === 'forest') {
      buyer.maxHealth += 1;
      buyer.health += card.value;
      if (buyerIsHuman) { FX.event('heal'); FX.float('🌿 Forest\'s Blessing', '#6bff8a'); }
      else if (sellerIsHuman) FX.sound('heal');
    }
  },

  // Bluff specials (Jester / Wizard): fire when a BLUFFED offer is ACCEPTED
  // (uncaught). `from` is the bluffer/seller, `to` is the duped buyer.
  applyBluffSpecial(from, to, claim) {
    const fromHuman = from === this.human();
    const toHuman = to === this.human();
    if (claim.bluffSpecial === 'swap_hands') {
      const tmp = from.hand; from.hand = to.hand; to.hand = tmp;
      if (fromHuman || toHuman) { FX.sound('card'); FX.burst('🃏', 8); FX.float('🃏 HANDS SWAPPED!', '#d4a8f0'); }
      if (fromHuman || toHuman) this.notify(`🃏 JESTER! ${from.name} swapped hands with ${to.name}!`,
        fromHuman ? 'good' : 'bad');
    } else if (claim.bluffSpecial === 'wizard_strike') {
      to.health -= 2;
      from.health += 1;
      this.checkDeath(to);
      if (toHuman) FX.event('damage');
      else if (fromHuman) { FX.event('heal'); FX.float('🧙 STRIKE! −2 / +1', '#b46bff'); }
      if (fromHuman || toHuman) this.notify(`🧙 WIZARD! ${from.name}'s spell hit ${to.name} for 2 — ${from.name} +1 HP.`,
        fromHuman ? 'good' : 'bad');
    }
  },

  // ============================================================
  // END OF DAY -> SLEEP. After everyone's turns, the player chooses
  // a bed; assassins (hidden any time via the map) resolve instantly.
  // ============================================================
  endDay() {
    this.state.phase = 'sleep';
    this.state.busy = false;
    this.state.overlay = null;
    // AIs hunt: each assassin covers a DISTINCT room. Rivals' home towers and
    // the central hub come first (likeliest beds), then a shuffled sweep of the
    // rest — so no room is ever guaranteed safe and someone usually bleeds.
    this.aliveAI().forEach(p => {
      const rivals = this.alive().filter(q => q !== p);
      const head = [...rivals.map(q => q.homeTower), 'central'];
      const rest = ASSASSIN_LOCATIONS.filter(l => !head.includes(l));
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const order = [...head, ...rest];
      let idx = 0;
      while (p.assassins.length > 0) {
        p.placedAssassins.push(order[idx % order.length]);
        idx++;
        p.assassins.shift();
      }
      // Bots sleep somewhat unpredictably: usually home, sometimes elsewhere
      p.sleepLocation = (Math.random() < 0.6)
        ? p.homeTower
        : ASSASSIN_LOCATIONS[Math.floor(Math.random() * ASSASSIN_LOCATIONS.length)];
    });
    this.notify('🌙 Night falls — choose where YOU sleep.', 'info');
    UI.render();
  },

  roomName(id) {
    const r = CASTLE_ROOMS.find(x => x.id === id);
    return r ? r.name : id;
  },

  // Hide one assassin in a room (available any time the map overlay is open)
  placeAssassin(location) {
    if (!this.canAct()) return;
    const me = this.human();
    if (me.assassins.length === 0) { this.notify('No assassins left to hide.', 'warn'); return; }
    me.placedAssassins.push(location);
    me.assassins.shift();
    FX.sound('click');
    this.notify(`🥷 Assassin hidden in ${this.roomName(location)}. (${me.assassins.length} left)`, 'info');
    UI.render();
  },

  // At night the player taps a room to sleep there -> resolve instantly
  chooseSleep(location) {
    if (!this.canAct()) return;
    if (this.state.phase !== 'sleep') return;
    const me = this.human();
    // GATE: you must commit at least one assassin before the night resolves.
    if (me.placedAssassins.length === 0) {
      this.notify('🥷 Hide at least one assassin on the map before you sleep!', 'warn');
      this.state.overlay = 'map';
      UI.render();
      return;
    }
    me.sleepLocation = location;
    this.state.busy = true;
    this.resolveNight();
  },

  // ============================================================
  // RESOLVE — instant, fluid night: tally hits, show one clear banner,
  // then dawn arrives. No long narration, no blocking.
  // ============================================================
  resolveNight() {
    this.state.phase = 'resolve';
    this.state.busy = true;
    UI.render();
    const me = this.human();

    // Sentinel begins the night already lightly shielded (a modest passive block)
    this.alive().forEach(p => {
      if (this.hasPassive(p, 'night_shield')) this.giveShield(p, Math.max(p.shieldChance || 0, 0.3));
    });

    let myStruck = 0, myBlocked = 0;
    const otherEvents = [];
    this.alive().forEach(victim => {
      if (!victim.sleepLocation) return;
      let struck = 0, blocked = 0;
      this.alive().forEach(attacker => {
        if (attacker === victim) return; // your own assassins never harm you
        const hits = attacker.placedAssassins.filter(loc => loc === victim.sleepLocation).length;
        for (let i = 0; i < hits; i++) {
          // Chance-based block: roll against the shield's chance for THIS hit
          if (victim.shieldChance > 0 && Math.random() < victim.shieldChance) blocked++;
          else { victim.health -= 2; struck++; }
        }
      });
      victim.lastNightDamage = struck * 2; // remembered for the Giant's ability
      if (victim === me) { myStruck = struck; myBlocked = blocked; }
      else if (struck > 0) otherEvents.push(`🥷 ${victim.name} was ambushed in ${this.roomName(victim.sleepLocation)} — −${struck * 2} HP!`);
      else if (blocked > 0) otherEvents.push(`🛡️ ${victim.name}'s shield held in ${this.roomName(victim.sleepLocation)}.`);
    });

    // Clear placements + spent shields now that hits are tallied
    this.alive().forEach(p => { p.placedAssassins = []; p.sleepLocation = null; p.shieldChance = 0; });

    // One clear banner for the player's own night
    if (myStruck > 0) { FX.event('damage'); this.notify(`🗡️ You were ambushed for −${myStruck * 2} HP!${myBlocked ? ` (${myBlocked} blocked 🛡️)` : ''}`, 'bad'); }
    else if (myBlocked > 0) { FX.event('shield'); this.notify(`🛡️ Your shield blocked the assassins — unharmed!`, 'good'); }
    else { this.notify(`😌 A quiet night — you wake unharmed.`, 'good'); }

    setTimeout(() => this.finishNight(otherEvents), 3000);
  },

  // After the night: report rivals, deaths, win check, advance the day
  finishNight(otherEvents) {
    if (otherEvents && otherEvents.length) {
      // Show the rivals' fates on their own beat so it's readable
      this.notify(otherEvents.join('  '), 'info');
      UI.render();
      setTimeout(() => this.finishNight([]), 2600);
      return;
    }
    this.alive().forEach(p => this.checkDeath(p));
    if (this.checkWin()) return;
    this.state.day++;
    this.state.busy = false;
    setTimeout(() => {
      UI.transition(`☀️ DAY ${this.state.day}`, 'A new dawn breaks over the castle.', () => this.startDay());
    }, 2000);
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
  // USE ITEM — most items act on YOURSELF; targeted items (Poison Vial)
  // open a rival picker first.
  // ============================================================
  useItem(cardUID) {
    if (!this.canAct()) return;
    const me = this.human();
    const card = me.hand.find(c => c.uid === cardUID && c.type === 'item');
    if (!card) return;

    // Targeted items ask for a victim before resolving
    if (card.targeted) {
      this.state.pendingTarget = { cardUID };
      this.notify(`☠️ Choose a rival to use ${card.icon} ${card.name} on.`, 'info');
      UI.render();
      return;
    }

    this.applyItemSelf(me, card);
    CardSystem.removeFromHand(me, cardUID);
    if (this.state.phase === 'day' && this.isHumanTurn()) this.consumePlay();
    else UI.render();
  },

  // Resolve a non-targeted item on its user
  applyItemSelf(me, card) {
    const isMe = me === this.human();
    if (card.effect === 'heal') {
      me.health += card.value;
      if (isMe) FX.event('heal');
      this.notifyMine(me, `💚 ${card.icon} ${card.name} — +${card.value} HP.`, 'good');
    } else if (card.effect === 'money') {
      me.money += card.value;
      if (isMe) FX.event('coins');
      this.notifyMine(me, `💰 ${card.icon} ${card.name} — +${card.value}🪙.`, 'good');
    } else if (card.effect === 'shield') {
      this.giveShield(me, card.value || 0.4);
      if (isMe) FX.event('shield');
      this.notifyMine(me, `🛡️ ${card.icon} ${card.name} — ${Math.round((card.value || 0.4) * 100)}% to block an assassin tonight.`, 'good');
    } else if (card.effect === 'antidote') {
      me.poisoned = false; me.poisonBy = null;
      me.health += card.value;
      if (isMe) FX.event('heal');
      this.notifyMine(me, `💊 ${card.icon} ${card.name} — poison cured, +${card.value} HP.`, 'good');
    } else if (card.effect === 'draw') {
      let drawn = 0;
      for (let i = 0; i < card.value; i++) if (this.drawInto(me)) drawn++;
      if (isMe) { FX.sound('card'); FX.float(`+${drawn} cards`, '#6bb6ff'); }
      this.notifyMine(me, `📜 ${card.icon} ${card.name} — drew ${drawn} card${drawn === 1 ? '' : 's'}.`, 'good');
    } else if (card.effect === 'assassin') {
      for (let i = 0; i < card.value; i++) me.assassins.push(CardSystem.createDailyAssassin());
      if (me.assassins.length > ASSASSIN_CAP) me.assassins = me.assassins.slice(-ASSASSIN_CAP);
      if (isMe) { FX.sound('click'); FX.float(`🥷 +${card.value}`, '#d4a8f0'); }
      this.notifyMine(me, `🗡️ ${card.icon} ${card.name} — gained ${card.value} assassin${card.value === 1 ? '' : 's'} for tonight.`, 'good');
    } else if (card.effect === 'maxhp') {
      me.maxHealth += 1;
      me.health += card.value;
      if (isMe) FX.event('heal');
      this.notifyMine(me, `🍖 ${card.icon} ${card.name} — +1 max HP, +${card.value} HP.`, 'good');
    }
  },

  // Apply a targeted item (Poison Vial) to a chosen rival
  usePoisonOn(targetId) {
    const pt = this.state.pendingTarget;
    if (!pt) return;
    const me = this.human();
    const card = me.hand.find(c => c.uid === pt.cardUID && c.type === 'item');
    const target = this.state.players.find(p => p.id === targetId);
    if (!card || !target || target.dead || target === me) return;
    this.state.pendingTarget = null;

    if (card.effect === 'poison') {
      target.poisoned = true; target.poisonBy = me.id;
      FX.event('poison');
      this.notify(`☠️ You poisoned ${target.name}! They lose 2 HP at dawn${this.hasPassive(target, 'poison_immune') ? ' — unless the Witch shrugs it off' : ''}.`, 'good');
    }
    CardSystem.removeFromHand(me, pt.cardUID);
    if (this.state.phase === 'day' && this.isHumanTurn()) this.consumePlay();
    else UI.render();
  },

  cancelTarget() {
    this.state.pendingTarget = null;
    UI.render();
  },

  // ============================================================
  // AI TURN — bots may use a helpful item, then offer a card to a rival.
  // ============================================================
  aiTakeTurn(ai, playsMade = 0) {
    if (ai.dead || this.state.phase !== 'day') { this.nextTurn(); return; }
    if (playsMade >= 2) { this.notify(`${ai.icon} ${ai.name} ends their turn.`, 'info'); this.nextTurn(); return; }

    // First, a bot may fire its signature ruler ability (counts as a play)
    if (this.aiMaybeUseAbility && this.aiMaybeUseAbility(ai)) {
      UI.render();
      setTimeout(() => this.aiTakeTurn(ai, playsMade + 1), 2400);
      return;
    }

    // Next, a bot may use a beneficial item on itself (heal when hurt, etc.)
    if (this.aiMaybeUseItem(ai)) {
      UI.render();
      setTimeout(() => this.aiTakeTurn(ai, playsMade + 1), 2200);
      return;
    }

    const sellable = ai.hand.filter(c => c.type === 'character' && !c.free);
    if (sellable.length === 0 || (playsMade >= 1 && Math.random() < 0.4)) {
      this.notify(`${ai.icon} ${ai.name} ends their turn.`, 'info');
      this.nextTurn();
      return;
    }

    const realCard = sellable[Math.floor(Math.random() * sellable.length)];
    const sellableTypes = CHARACTER_CARDS.filter(c => !c.free);
    let claim = realCard;
    if (Math.random() < 0.45) {
      const pricier = sellableTypes.filter(c => c.tradePrice >= realCard.tradePrice);
      const pool = pricier.length ? pricier : sellableTypes;
      claim = pool[Math.floor(Math.random() * pool.length)];
    }
    const isBluff = realCard.id !== claim.id;

    const others = this.alive().filter(p => p !== ai);
    if (others.length === 0) { this.nextTurn(); return; } // no one left to deal with
    const human = this.human();
    let target;
    if (!human.dead && Math.random() < 0.6) target = human;
    else target = others[Math.floor(Math.random() * others.length)];
    if (!target) { this.nextTurn(); return; }

    if (target === human) {
      this.state.pendingTrade = {
        from: ai, to: human, realCard, claim, isBluff, cardUID: realCard.uid,
        humanPlay: false, aiResume: { ai, playsMade: playsMade + 1 }
      };
      this.state.busy = false;
      this.notify(`📨 ${ai.icon} ${ai.name} offers you ${claim.icon} ${claim.name} — ${claim.tradePrice}🪙.`, 'info');
      UI.render();
    } else {
      const paid = Math.min(target.money, claim.tradePrice || 2);
      const accepts = target.money >= claim.tradePrice && Math.random() < 0.7;
      if (accepts) {
        target.money -= paid; ai.money += paid;
        if (!isBluff) {
          this.applyCharacterEffect(target, ai, claim);
          ai.money += HONEST_BONUS; // honesty bonus for AI-to-AI sale too
        }
        CardSystem.removeFromHand(ai, realCard.uid);
        if (isBluff && realCard.bluffSpecial) this.applyBluffSpecial(ai, target, realCard);
      } else {
        // AI-to-AI decline stays private
      }
      UI.render();
      setTimeout(() => this.aiTakeTurn(ai, playsMade + 1), 2400);
    }
  },

  // A bot uses one helpful item if it makes sense. Returns true if it did.
  aiMaybeUseItem(ai) {
    const items = ai.hand.filter(c => c.type === 'item');
    if (!items.length) return false;
    // Pick a sensible item: heal/antidote when hurt or poisoned; else coins/draw/shield
    let pick = null;
    if (ai.poisoned) pick = items.find(c => c.effect === 'antidote');
    if (!pick && ai.health < ai.maxHealth) pick = items.find(c => c.effect === 'heal' || c.effect === 'maxhp');
    if (!pick) pick = items.find(c => c.effect === 'money' || c.effect === 'draw' || c.effect === 'assassin');
    // Bots aim Poison Vials at the human or a random rival
    if (!pick) {
      const poison = items.find(c => c.effect === 'poison');
      if (poison && Math.random() < 0.7) {
        const victims = this.alive().filter(p => p !== ai);
        const v = victims[Math.floor(Math.random() * victims.length)];
        if (v) {
          v.poisoned = true; v.poisonBy = ai.id;
          CardSystem.removeFromHand(ai, poison.uid);
          this.notifyMine(v, `☠️ ${ai.name} poisoned YOU!`, 'bad');
          return true;
        }
      }
    }
    if (!pick || Math.random() < 0.4) return false; // don't always burn items
    this.applyItemSelf(ai, pick);
    CardSystem.removeFromHand(ai, pick.uid);
    return true;
  },
};
