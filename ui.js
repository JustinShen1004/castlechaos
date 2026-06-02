// ============================================================
// ui.js — UI for Castle Chaos (matches game.html layout)
// ============================================================

const UI = {
  init() {
    this.dayCounter = document.getElementById('day-counter');
    this.phaseName = document.getElementById('phase-name');
    this.playerRuler = document.getElementById('player-ruler');
    this.playerRulerInfo = document.getElementById('player-ruler-info');
    this.notifBanner = document.getElementById('notification-banner');
    this.opp1 = document.getElementById('opp-1');
    this.opp2 = document.getElementById('opp-2');
    this.actionArea = document.getElementById('action-area');
    this.playerStats = document.getElementById('player-stats');
    this.playerHand = document.getElementById('player-hand');
  },

  render() {
    if (!Engine.state) return;
    const s = Engine.state;
    // Persist progress + discover any cards now in hand (survives refresh/quit)
    if (typeof Save !== 'undefined') {
      Save.discoverFrom(Engine.human());
      Save.saveGame(s);
    }
    document.body.dataset.phase = s.phase; // drives phase color theme
    const gs = document.getElementById('game-screen');
    gs.classList.toggle('night-mode', s.phase === 'sleep' || s.phase === 'resolve');
    gs.classList.toggle('gameover-mode', s.phase === 'gameover');
    gs.classList.toggle('busy', !!s.busy); // input lock: a move is resolving
    this.renderHeader();
    this.renderNotification();
    this.renderOpponents();
    this.renderPlayerStats();
    this.renderHand();
    this.renderAction();
    this.renderOverlay();
  },

  // --- Fullscreen overlays (Market / Castle Map) that pause the board ---
  renderOverlay() {
    let el = document.getElementById('game-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'game-overlay';
      document.body.appendChild(el);
    }
    const ov = Engine.state.overlay;
    if (!ov) { el.classList.remove('open'); el.innerHTML = ''; return; }
    el.innerHTML = ov === 'market' ? this.marketOverlayHTML() : this.mapOverlayHTML();
    el.classList.add('open');
  },

  // Fullscreen MARKET — spend coins on three tabs of wares
  marketOverlayHTML() {
    const s = Engine.state, me = Engine.human();
    const curTab = s.shopTab || 'buffs';
    const tabBtns = SHOP_TABS.map(t =>
      `<button class="shop-tab${t.id === curTab ? ' on' : ''}" ` +
      `onclick="Engine.shopSelectTab('${t.id}')">${t.icon} ${t.name}</button>`).join('');
    const tab = SHOP_TABS.find(t => t.id === curTab) || SHOP_TABS[0];
    const wares = tab.items.map(w => {
      const afford = me.money >= w.price;
      const cardFull = w.kind === 'card' && me.hand.length >= HAND_LIMIT;
      const locked = !afford || cardFull;
      return `<div class="shop-item${locked ? ' locked' : ''}">` +
        `<div class="shop-art">${w.icon}</div>` +
        `<div class="shop-name">${w.name}</div>` +
        `<div class="shop-desc">${w.desc}</div>` +
        `<button class="shop-buy${afford ? '' : ' poor'}" ${locked ? 'disabled' : ''} ` +
          `onclick="Engine.buyShop('${w.id}')">${cardFull ? '✋ Full' : '🪙 ' + w.price}</button>` +
      `</div>`;
    }).join('');
    return `<div class="overlay-panel market-panel">` +
      `<div class="shop-head"><h2>🏪 MARKET</h2>` +
        `<div class="shop-purse">🪙 <strong>${me.money}</strong></div></div>` +
      `<div class="shop-tabs">${tabBtns}</div>` +
      `<div class="shop-grid">${wares}</div>` +
      `<button class="btn-action" onclick="Engine.closeOverlay()">Close ✕</button>` +
    `</div>`;
  },

  // Fullscreen CASTLE MAP — hide assassins anywhere, any time
  mapOverlayHTML() {
    const me = Engine.human();
    const left = me.assassins.length;
    return `<div class="overlay-panel map-panel">` +
      `<div class="shop-head"><h2>🗺️ CASTLE MAP</h2>` +
        `<div class="shop-purse">🥷 <strong>${left}</strong> left</div></div>` +
      `<p style="text-align:center;color:#c8b8e0;margin:-4px 0 8px;">` +
        `${left > 0 ? 'Click a room to hide an assassin there — it ambushes anyone sleeping there for 2 HP.' : 'No assassins to hide right now. Buy more in the Market or wait for dawn.'}</p>` +
      this.castleMapHTML('place') +
      `<button class="btn-action" onclick="Engine.closeOverlay()" style="margin-top:12px;">Close ✕</button>` +
    `</div>`;
  },

  // --- Header ---
  renderHeader() {
    const s = Engine.state;
    const phases = { setup:'👑 RULERS', day:'☀️ DAY', sleep:'🌙 NIGHT',
      resolve:'⚔️ NIGHT', gameover:'🏁 GAME OVER' };
    this.dayCounter.textContent = `DAY ${s.day}`;
    this.phaseName.textContent = phases[s.phase] || s.phase;
    this.playerRuler.innerHTML = '';
    const me = Engine.human();
    this.playerRulerInfo.innerHTML = me.ruler
      ? `<span class="ruler-tag">Your Ruler</span> ${me.ruler.icon} <strong>${me.ruler.name}</strong> — <span class="ruler-power">${me.ruler.desc}</span>`
      : '';
  },

  // --- Big notification banner (replaces history log) ---
  renderNotification() {
    const n = Engine.state.notification;
    this.notifBanner.innerHTML = n
      ? `<div class="notif ${n.type}" key="${Date.now()}">${n.msg}</div>` : '';
  },

  // --- Opponent cards (top) ---
  renderOpponents() {
    const s = Engine.state;
    const ais = s.players.filter(p => p.ai);
    const cur = (s.phase === 'day' && s.dayStarted) ? Engine.currentPlayer() : null;
    const canDrop = s.phase === 'day' && s.dayStarted && Engine.isHumanTurn() && !s.pendingTrade && !s.pendingItemTrade && !s.overlay;
    [this.opp1, this.opp2].forEach((el, i) => {
      const ai = ais[i];
      if (!ai) { el.innerHTML = ''; el.className = 'opponent-card'; return; }
      const isTurn = cur && cur.id === ai.id;
      el.className = 'opponent-card' + (ai.dead ? ' dead' : '') +
        (isTurn ? ' active-turn' : '') + (canDrop ? ' drop-ready' : '');
      el.dataset.pid = ai.id;
      const ruler = ai.ruler ? `${ai.ruler.icon} ${ai.ruler.name}` : '';
      const turnTag = isTurn ? `<span class="turn-badge">● THEIR TURN</span>` : '';
      el.innerHTML =
        `<div class="opponent-header">` +
          `<span class="opponent-name" style="color:${ai.color}">${ai.icon} ${ai.name}</span>` +
          `<span class="opponent-ruler">${ruler}</span>` +
        `</div>` +
        turnTag +
        `<div class="opponent-stats">` +
          `<div class="stat-box stat-heart">❤️ ${ai.health}</div>` +
          `<div class="stat-box stat-coins">🪙 ${ai.money}</div>` +
          `<div class="stat-box stat-cards">🃏 ${ai.hand.length}</div>` +
          (ai.shielded ? `<div class="stat-box stat-shield">🛡️</div>` : '') +
        `</div>` +
        (canDrop && !ai.dead ? `<div class="card-hint" style="margin-top:8px;color:#6bff8a;">⬇ drop a card to give</div>` : '');
      // Drop handlers (idempotent)
      el.ondragover = (e) => { if (this._dragUID && canDrop && !ai.dead) { e.preventDefault(); el.classList.add('drop-hover'); } };
      el.ondragleave = () => el.classList.remove('drop-hover');
      el.ondrop = (e) => {
        e.preventDefault();
        el.classList.remove('drop-hover');
        const uid = this._dragUID;
        if (uid && canDrop && !ai.dead) this.playCardOn(uid, ai.id);
      };
    });
  },

  // --- Player stats (bottom bar) ---
  renderPlayerStats() {
    const me = Engine.human();
    const poison = me.poisoned ? `<div class="stat-box stat-heart">☠️</div>` : '';
    const shield = me.shielded ? `<div class="stat-box stat-shield">🛡️</div>` : '';
    const hp = me.health > me.maxHealth ? `${me.health} ✨` : `${me.health}/${me.maxHealth}`;
    this.playerStats.innerHTML =
      `<div class="stat-box stat-heart">❤️ ${hp}</div>` +
      `<div class="stat-box stat-coins">🪙 ${me.money}</div>` +
      `<div class="stat-box stat-cards">🃏 ${me.hand.length}</div>` +
      `<div class="stat-box stat-assassin">🥷 ${me.assassins.length}</div>` +
      shield + poison;
  },

  // Can the human play this card right now? (drives black-out states)
  canPlay(card) {
    const s = Engine.state;
    if (s.busy) return false;                    // a move is still resolving
    if (s.overlay) return false;                 // market/map overlay is open
    if (card.type === 'assassin') return false;  // assassins are hidden on the map
    if (s.phase !== 'day') return false;
    if (!s.dayStarted) return false;
    if (s.pendingTrade || s.pendingItemTrade || s.pendingTarget) return false;
    if (!Engine.isHumanTurn()) return false;
    if (s.playsLeft <= 0) return false;
    return true;
  },

  // --- Hand (bottom) ---
  renderHand() {
    const me = Engine.human();
    let html = '';
    me.hand.forEach(card => {
      const ok = this.canPlay(card);
      const draggable = ok && card.type === 'character';
      const locked = !ok;
      let hint = '';
      if (ok && card.type === 'character') hint = card.id === 'merchant'
        ? `<div class="card-hint">BUY AN ITEM</div>` : `<div class="card-hint">GIVE TO RIVAL</div>`;
      else if (ok && card.type === 'item') hint = `<div class="card-hint">USE ON SELF</div>`;
      html += `<div class="card ${card.type}${draggable ? ' draggable-card' : ''}${locked ? ' locked' : ''}" ` +
        `${draggable ? 'draggable="true"' : ''} data-uid="${card.uid}" ` +
        `onclick="UI.cardClick('${card.uid}')">` +
        `<button class="card-info" onclick="event.stopPropagation();UI.showInfo('${card.uid}')">i</button>` +
        `<div class="card-type-tag">${card.type.toUpperCase()}</div>` +
        `<div class="card-name">${card.name}</div>` +
        `<div class="card-art">${card.icon}</div>` +
        `<div class="card-desc">${card.desc}</div>${hint}</div>`;
    });
    me.assassins.forEach(() => {
      html += `<div class="card assassin locked">` +
        `<div class="card-type-tag">ASSASSIN</div>` +
        `<div class="card-name">Assassin</div>` +
        `<div class="card-art">🥷</div>` +
        `<div class="card-desc">Hide on the map. 2 dmg.</div>` +
        `<div class="card-hint">USE 🗺️ MAP</div></div>`;
    });
    this.playerHand.innerHTML = html || '<p style="color:#6a5a4a;padding:20px;">No cards in hand.</p>';
    this.wireDrag();
  },

  // Attach drag listeners to draggable cards
  wireDrag() {
    this.playerHand.querySelectorAll('.draggable-card').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        this._dragUID = el.dataset.uid;
        el.classList.add('dragging');
        this.playerHand.classList.add('drag-active');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        this.playerHand.classList.remove('drag-active');
        this._dragUID = null;
        document.querySelectorAll('.drop-hover').forEach(d => d.classList.remove('drop-hover'));
      });
    });
  },

  cardClick(uid) {
    const card = Engine.human().hand.find(c => c.uid === uid);
    if (!card) return;
    if (!this.canPlay(card)) { this.showInfo(uid); return; } // locked -> just show details
    // brief play animation on the card element
    const el = this.playerHand.querySelector(`.card[data-uid="${uid}"]`);
    if (el) { el.classList.add('card-played'); }
    FX.sound('card');
    if (card.type === 'item') Engine.useItem(uid);
    else if (card.type === 'character') this.pickTarget(card);
  },

  // --- Card Collection (title screen) ---
  renderCollection() {
    const all = [...CHARACTER_CARDS, ...ITEM_CARDS, ...ASSASSIN_CARDS];
    const unlockedCount = all.filter(c => Save.isUnlocked(c.id)).length;
    const st = Save.data.stats;
    document.getElementById('collection-stats').innerHTML =
      `<div class="cstat"><span>📦 Collected</span><strong>${unlockedCount}/${all.length}</strong></div>` +
      `<div class="cstat"><span>🎮 Games</span><strong>${st.plays}</strong></div>` +
      `<div class="cstat"><span>🏆 Wins</span><strong>${st.wins}</strong></div>` +
      `<div class="cstat"><span>📅 Best Day</span><strong>${st.bestDay}</strong></div>`;

    const html = all.map(c => {
      const got = Save.isUnlocked(c.id);
      if (!got) {
        return `<div class="coll-card locked">` +
          `<div class="coll-art">❓</div><div class="coll-name">???</div>` +
          `<div class="coll-tag">${c.type.toUpperCase()}</div></div>`;
      }
      return `<div class="coll-card ${c.type}">` +
        `<div class="coll-art">${c.icon}</div>` +
        `<div class="coll-name">${c.name}</div>` +
        `<div class="coll-desc">${c.desc}</div>` +
        `<div class="coll-tag">${c.type.toUpperCase()}</div></div>`;
    }).join('');
    document.getElementById('collection-grid').innerHTML = html;
  },

  // Card detail popup — works for your cards and opponent/known cards
  showInfo(uid) {
    const all = [...Engine.state.players.flatMap(p => p.hand), ...CHARACTER_CARDS, ...ITEM_CARDS, ...ASSASSIN_CARDS];
    const card = all.find(c => c.uid === uid) || all.find(c => c.id === uid);
    if (!card) return;
    const extra = card.type === 'character'
      ? (card.free ? 'Free to play. Buy a rival\'s item with coins.' : `Costs the buyer ${card.tradePrice} 🪙. They USE the effect.`)
      : card.type === 'item' ? (card.targeted ? 'Aimed at a rival.' : 'Played on yourself.')
      : 'Hidden on the castle map to ambush a sleeper.';
    document.getElementById('card-modal').innerHTML =
      `<div class="modal-back" onclick="UI.closeInfo()"></div>` +
      `<div class="modal-card ${card.type}">` +
        `<div class="card-art" style="font-size:4em;">${card.icon}</div>` +
        `<h2 style="color:#d4af37;">${card.name}</h2>` +
        `<div class="card-type-tag" style="font-size:0.9em;">${card.type.toUpperCase()}</div>` +
        `<p style="margin:10px 0;font-size:1.1em;">${card.desc}</p>` +
        `<p style="color:#a89070;font-size:0.95em;">${extra}</p>` +
        `<button class="btn-icon" onclick="UI.closeInfo()" style="margin-top:14px;">Close</button>` +
      `</div>`;
    document.getElementById('card-modal').classList.add('open');
  },
  closeInfo() {
    const m = document.getElementById('card-modal');
    m.classList.remove('open'); m.innerHTML = '';
  },

  // After picking a card (click or drag), choose which rival to play it on
  pickTarget(card) {
    const targets = Engine.aliveAI();
    const verb = card.id === 'merchant' ? 'buy an item from' : 'sell to';
    this.actionArea.innerHTML = `<h3>${card.icon} ${card.name}</h3><p>Who do you want to ${verb}?</p>` +
      `<div class="choice-grid">` +
      targets.map(p => `<button class="choice-btn" style="border-left:4px solid ${p.color}" ` +
        `onclick="UI.playCardOn('${card.uid}','${p.id}')">${p.icon} ${p.name} (🪙${p.money})</button>`).join('') +
      `</div><button class="btn-icon" onclick="UI.render()" style="margin-top:8px;">Cancel</button>`;
  },

  // Route a played card to the right flow based on its type
  playCardOn(uid, aiId) {
    const card = Engine.human().hand.find(c => c.uid === uid);
    if (!card || !this.canPlay(card)) return;
    if (card.id === 'merchant') Engine.startMerchantTrade(uid, aiId);
    else this.tradeStep2(uid, aiId); // Chef / Bodyguard: choose truth or bluff
  },

  // --- Smooth phase transition overlay ---
  transition(title, sub, done) {
    // Lock input for the duration of the curtain so nothing resolves under it
    if (Engine.state) Engine.state.busy = true;
    const o = document.getElementById('transition-overlay');
    // Theme the curtain by its title emoji so each phase feels distinct
    let theme = 'night';
    if (title.includes('☀️') || title.includes('DAY')) theme = 'dawn';
    else if (title.includes('AFTERNOON')) theme = 'day';
    else if (title.includes('EVENING')) theme = 'dusk';
    else if (title.includes('MIDNIGHT')) theme = 'night';
    o.className = 'theme-' + theme;
    o.innerHTML = `<div class="transition-inner"><h1>${title}</h1><p>${sub || ''}</p></div>`;
    if (theme === 'dawn') FX.sound('gong');
    o.classList.add('show');
    setTimeout(() => {
      if (done) done();         // swap phase behind the curtain (sets its own lock state)
      o.classList.remove('show');
    }, 1600);
  },
};
