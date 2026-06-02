// ============================================================
// ui-actions.js — Action-area + overlay rendering per phase
// ============================================================

Object.assign(UI, {
  renderAction() {
    const s = Engine.state;
    // Pending interactions take priority over the phase panel
    if (s.pendingItemTrade) { this.actionArea.innerHTML = this.itemTradeHTML(); return; }
    if (s.pendingTarget)   { this.actionArea.innerHTML = this.targetHTML(); return; }
    let html = '';
    switch (s.phase) {
      case 'setup':    html = this.setupHTML(); break;
      case 'day':      html = this.dayHTML(); break;
      case 'sleep':    html = this.sleepHTML(); break;
      case 'resolve':  html = this.resolveHTML(); break;
      case 'gameover': html = this.gameoverHTML(); break;
    }
    this.actionArea.innerHTML = html;
  },

  // --- SETUP: rulers revealed (yours highlighted), auto-advances to Day 1 ---
  setupHTML() {
    if (!this._setupTimer) {
      this._setupTimer = setTimeout(() => Engine.beginGame(), 4200);
    }
    const me = Engine.human();
    const cards = Engine.state.players.map(p => {
      const you = !p.ai;
      return `<div class="ruler-reveal${you ? ' you' : ''}" style="--rc:${you ? '#6bff8a' : p.color};">` +
        `${you ? '<div class="ruler-you-tag">⭐ YOU ⭐</div>' : ''}` +
        `<div class="rr-who" style="color:${you ? '#6bff8a' : p.color};">${p.icon} ${you ? 'YOU' : p.name}</div>` +
        `<div class="rr-face">${p.ruler.icon}</div>` +
        `<div class="rr-name">${p.ruler.name}</div>` +
        `<div class="rr-desc">${p.ruler.desc}</div>` +
      `</div>`;
    }).join('');
    return `<div style="text-align:center;">` +
      `<h2 style="font-size:1.9em;color:#d4af37;letter-spacing:3px;">👑 RULERS ASSIGNED</h2>` +
      `<p style="font-size:1.15em;margin-top:6px;">You are the <strong style="color:#6bff8a;">${me.ruler.icon} ${me.ruler.name}</strong> — ${me.ruler.desc}</p>` +
      `<div class="ruler-grid">${cards}</div>` +
      `<p style="color:#a89070;margin-top:10px;">Your reign begins shortly…</p></div>`;
  },

  // --- DAY: intro gate, incoming offers, then your turn panel with buttons ---
  dayHTML() {
    const s = Engine.state, me = Engine.human();

    if (!s.dayStarted) {
      return `<div style="text-align:center;">` +
        `<h2 style="font-size:2.4em;color:#d4af37;letter-spacing:4px;">☀️ DAY ${s.day}</h2>` +
        `<p>Trade with rivals, use items, visit the market, and hide your assassins.</p>` +
        `<p style="color:#a89070;font-size:0.95em;margin-top:6px;">When everyone's done, choose where to sleep — and pray.</p>` +
        `<button class="btn-action" onclick="Engine.beginDayTurns()" style="margin-top:16px;">Begin ▶</button>` +
        `</div>`;
    }

    // Incoming offer to YOU (answerable even on a bot's turn)
    if (s.pendingTrade && s.pendingTrade.to === me) {
      const t = s.pendingTrade;
      return `<h3>📨 ${t.from.icon} ${t.from.name} offers you</h3>` +
        `<div class="offer-card"><div class="offer-art">${t.claim.icon}</div>` +
        `<div class="offer-name">${t.claim.name}</div>` +
        `<div class="offer-desc">${t.claim.desc}</div>` +
        `<div class="offer-price">${t.claim.tradePrice}🪙</div></div>` +
        `<div class="offer-actions">` +
        `<button class="btn-accept" onclick="Engine.resolveAccept()">✅ Pay</button>` +
        `<button class="btn-decline" onclick="Engine.resolveDecline()">❌ Pass</button>` +
        `<button class="btn-challenge" onclick="Engine.resolveChallenge()">⚔️ Bluff!</button></div>`;
    }
    if (s.pendingTrade) return `<h3>⏳ ${s.pendingTrade.to.name} is deciding…</h3>`;

    if (!Engine.isHumanTurn()) {
      const cur = Engine.currentPlayer();
      return `<h3>${cur ? cur.icon + ' ' + cur.name : 'A rival'} is taking their turn…</h3>` +
        this.dayToolbar(true);
    }

    // YOUR turn
    return `<h3>Your turn</h3>` +
      `<p>Plays left: <strong style="color:#6bff8a;font-size:1.3em;">${'🟢'.repeat(s.playsLeft)}${'⚪'.repeat(2 - s.playsLeft)}</strong></p>` +
      `<p style="color:#a89070;font-size:0.95em;">Tap an item, drag a character onto a rival, or use the buttons below.</p>` +
      this.dayToolbar(false) +
      `<button class="btn-action" onclick="Engine.skipTurn()" style="margin-top:10px;">End Turn ⏭</button>`;
  },

  // Market / Map buttons — always available during the day (they pause the game)
  dayToolbar(botTurn) {
    const me = Engine.human();
    return `<div class="day-toolbar">` +
      `<button class="tool-btn market" onclick="Engine.openMarket()">🏪 Market <span>🪙${me.money}</span></button>` +
      `<button class="tool-btn map" onclick="Engine.openMap()">🗺️ Castle Map <span>🥷${me.assassins.length}</span></button>` +
      `</div>`;
  },

  // --- Targeted item (Poison Vial): pick a rival ---
  targetHTML() {
    const me = Engine.human();
    const card = me.hand.find(c => c.uid === Engine.state.pendingTarget.cardUID);
    const targets = Engine.aliveAI();
    return `<h3>${card ? card.icon + ' ' + card.name : 'Choose a target'}</h3>` +
      `<p style="color:#a89070;">Use it on which rival?</p>` +
      `<div class="choice-grid">` +
      targets.map(p => `<button class="choice-btn" style="border-left:4px solid ${p.color}" ` +
        `onclick="Engine.usePoisonOn('${p.id}')">${p.icon} ${p.name} (❤️${p.health})</button>`).join('') +
      `</div><button class="btn-icon" onclick="Engine.cancelTarget()" style="margin-top:8px;">Cancel</button>`;
  },

  // --- SLEEP: choose your bed on the castle map ---
  sleepHTML() {
    const me = Engine.human();
    return `<div class="midnight-wrap">` +
      `<h3>🛏️ Choose where YOU sleep</h3>` +
      `<p>Hidden assassins strike for <strong style="color:#ff6b6b;">2 HP</strong> each. Need to plant more first? ` +
      `<button class="btn-icon" onclick="Engine.openMap()">🗺️ Open Map</button></p>` +
      this.castleMapHTML('sleep') + `</div>`;
  },

  // --- Merchant: buy a rival's item with coins ---
  itemTradeHTML() {
    const pit = Engine.state.pendingItemTrade;
    const me = Engine.human(), target = pit.target;
    if (pit.wantUID) {
      const want = target.hand.find(c => c.uid === pit.wantUID);
      return `<h3>🤝 Awaiting ${target.name}…</h3>` +
        `<p>Offering ${pit.price}🪙 for ${want ? want.icon + ' ' + want.name : 'an item'}.</p>`;
    }
    const theirItems = target.hand.filter(c => c.type === 'item');
    const buyBtns = theirItems.map(c => {
      const price = Engine.itemBuyPrice(c);
      const afford = me.money >= price;
      return `<button class="choice-btn${afford ? '' : ' locked'}" ${afford ? '' : 'disabled'} ` +
        `onclick="UI.confirmItemBuy('${c.uid}')">${c.icon} ${c.name} — 🪙${price}</button>`;
    }).join('') || `<p style="color:#a89070;">${target.name} has no items to sell.</p>`;
    return `<h3>🧔 Merchant — buy from ${target.name}</h3>` +
      `<p style="color:#a89070;">You have <strong style="color:#ffd86b;">🪙${me.money}</strong>. Pick an item to buy:</p>` +
      `<div class="choice-grid">${buyBtns}</div>` +
      `<div style="margin-top:14px;"><button class="btn-decline" onclick="UI.cancelItemTrade()">Cancel</button></div>`;
  },

  // --- Castle map (shared by the Map overlay and the Sleep panel) ---
  // mode: 'place' (hide assassins) | 'sleep' (pick a bed)
  castleMapHTML(mode) {
    const me = Engine.human();
    const links = CASTLE_LINKS.map(([a, b]) => {
      const ra = CASTLE_ROOMS.find(r => r.id === a), rb = CASTLE_ROOMS.find(r => r.id === b);
      return `<line x1="${ra.x}" y1="${ra.y}" x2="${rb.x}" y2="${rb.y}" />`;
    }).join('');
    const rooms = CASTLE_ROOMS.map(r => {
      const mine = me.placedAssassins.filter(l => l === r.id).length;
      const owner = r.home ? Engine.state.players.find(p => p.id === r.home) : null;
      const placeable = mode === 'place' && me.assassins.length > 0;
      const action = mode === 'place'
        ? (placeable ? `onclick="Engine.placeAssassin('${r.id}')"` : '')
        : `onclick="Engine.chooseSleep('${r.id}')"`;
      const cls = 'map-room' + (placeable ? ' placeable' : '') + (mode === 'sleep' ? ' sleepable' : '');
      const ownerTag = owner ? `<span class="mr-owner" style="color:${owner.color}">${owner.icon}</span>` : '';
      const marks = mine > 0 ? `<span class="mr-assassins">${'🥷'.repeat(mine)}</span>` : '';
      return `<div class="${cls}" style="left:${r.x}%;top:${r.y}%;" ${action}>` +
        `<div class="mr-icon">${r.icon}</div><div class="mr-name">${r.name}${ownerTag}</div>${marks}</div>`;
    }).join('');
    return `<div class="castle-map night-map">` +
      `<div class="night-sky">${this.starsHTML()}<div class="nm-moon">🌙</div>` +
        `<div class="nm-fog f1"></div><div class="nm-fog f2"></div></div>` +
      `<svg class="castle-links" viewBox="0 0 100 100" preserveAspectRatio="none">${links}</svg>` +
      rooms + `</div>`;
  },

  starsHTML() {
    let s = '';
    const pts = [[8,12],[22,8],[34,18],[46,6],[58,14],[68,9],[78,20],[90,11],
      [14,28],[40,30],[62,26],[86,32],[6,46],[30,52],[54,44],[74,50],[94,42]];
    pts.forEach((p, i) => {
      s += `<span class="nm-star" style="left:${p[0]}%;top:${p[1]}%;animation-delay:${(i % 5) * 0.4}s;"></span>`;
    });
    return s;
  },

  resolveHTML() {
    const me = Engine.human();
    const room = me.sleepLocation ? Engine.roomName(me.sleepLocation) : 'your chamber';
    return `<div class="night-scene">` +
      `<div class="ns-stars">${this.starsHTML()}</div>` +
      `<div class="ns-fog nf1"></div><div class="ns-fog nf2"></div>` +
      `<div class="night-moon">🌙</div>` +
      `<div class="ns-bed">🛏️</div>` +
      `<div class="night-z z1">💤</div><div class="night-z z2">💤</div><div class="night-z z3">💤</div>` +
      `<div class="night-room">You sleep in <strong>${room}</strong>…</div></div>`;
  },

  gameoverHTML() {
    const s = Engine.state;
    const w = s.winner;
    const win = w && w === Engine.human();
    const st = (typeof Save !== 'undefined') ? Save.data.stats : { plays: 0, wins: 0, bestDay: 0 };
    const allCards = [...CHARACTER_CARDS, ...ITEM_CARDS, ...ASSASSIN_CARDS];
    const collected = (typeof Save !== 'undefined') ? allCards.filter(c => Save.isUnlocked(c.id)).length : 0;
    const sub = win ? 'The last lord standing — the castle is yours!'
      : (w ? `${w.icon || ''} ${w.name} seizes the throne.` : 'Your line ends in the dark.');
    const emojis = win ? '👑✨🎉' : '🥀💀🕯️';
    return `<div class="endscreen ${win ? 'win' : 'lose'}">` +
      `<div class="end-emojis">${emojis}</div>` +
      `<h1 class="end-title">${win ? 'VICTORY' : 'DEFEAT'}</h1>` +
      `<p class="end-sub">${sub}</p>` +
      `<div class="end-stats">` +
        `<div class="end-stat"><span>Survived</span><strong>Day ${s.day}</strong></div>` +
        `<div class="end-stat"><span>Collected</span><strong>${collected}/${allCards.length}</strong></div>` +
        `<div class="end-stat"><span>Wins</span><strong>${st.wins}/${st.plays}</strong></div>` +
      `</div>` +
      `<div class="end-buttons">` +
        `<button class="btn-action" onclick="startGame()">⚔️ Play Again</button>` +
        `<button class="btn-secondary" onclick="showCollection()">📜 Collection</button>` +
        `<button class="btn-secondary" onclick="showMenu()">🏠 Menu</button>` +
      `</div></div>`;
  },

  // --- Sell flow: claim truthfully or bluff ---
  tradeStep2(cardUID, targetId) {
    const card = Engine.human().hand.find(c => c.uid === cardUID);
    if (!card) return;
    const target = Engine.state.players.find(p => p.id === targetId);
    const sellable = CHARACTER_CARDS.filter(c => !c.free);
    const opts = sellable.map(c => {
      const truth = c.id === card.id;
      const badge = truth
        ? `<span class="claim-badge truth">✓ HONEST (+${HONEST_BONUS}🪙)</span>`
        : `<span class="claim-badge bluff">🎭 BLUFF</span>`;
      return `<button class="claim-tile ${truth ? 'truth' : 'bluff'}" ` +
        `onclick="FX.sound('card');Engine.offerTrade('${cardUID}','${c.id}','${targetId}')">` +
        `${badge}<div class="claim-art">${c.icon}</div>` +
        `<div class="claim-name">${c.name}</div>` +
        `<div class="claim-price">${c.tradePrice}🪙</div></button>`;
    }).join('');
    this.actionArea.innerHTML =
      `<h3>Offer to ${target.icon} ${target.name}</h3>` +
      `<p style="color:#a89070;">You hold <strong>${card.icon} ${card.name}</strong> — sell it HONESTLY for a bonus, or bluff a pricier one.</p>` +
      `<div class="claim-grid">${opts}</div>` +
      `<button class="btn-icon" onclick="UI.render()" style="margin-top:12px;">Cancel</button>`;
  },

  // --- Merchant buy helpers ---
  confirmItemBuy(uid) { Engine.proposeItemBuy(uid); },
  cancelItemTrade() { Engine.cancelItemTrade(); },

  // --- Smooth phase transition overlay ---
  transition(title, sub, done) {
    if (Engine.state) Engine.state.busy = true;
    const o = document.getElementById('transition-overlay');
    let theme = 'night';
    if (title.includes('☀️') || title.includes('DAY')) theme = 'dawn';
    else if (title.includes('NIGHT')) theme = 'night';
    o.className = 'theme-' + theme;
    o.innerHTML = `<div class="transition-inner"><h1>${title}</h1><p>${sub || ''}</p></div>`;
    if (theme === 'dawn') FX.sound('gong');
    o.classList.add('show');
    setTimeout(() => {
      if (done) done();
      o.classList.remove('show');
    }, 1600);
  },
});
