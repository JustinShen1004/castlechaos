// ============================================================
// ui-actions.js — Action-area (center panel) rendering per phase
// ============================================================

Object.assign(UI, {
  renderAction() {
    const s = Engine.state;
    // Merchant item-swap overlay takes priority during morning
    if (s.pendingItemTrade) { this.actionArea.innerHTML = this.itemTradeHTML(); return; }
    let html = '';
    switch (s.phase) {
      case 'setup':     html = this.setupHTML(); break;
      case 'morning':   html = this.morningHTML(); break;
      case 'afternoon': html = this.afternoonHTML(); break;
      case 'evening':   html = this.eveningHTML(); break;
      case 'midnight':  html = this.midnightHTML(); break;
      case 'resolve':   html = this.resolveHTML(); break;
      case 'gameover':  html = this.gameoverHTML(); break;
    }
    this.actionArea.innerHTML = html;
  },

  // --- SETUP: rulers revealed, then auto-advances to Day 1 ---
  setupHTML() {
    // Kick off the auto-advance once (the day begins on its own)
    if (!this._setupTimer) {
      this._setupTimer = setTimeout(() => Engine.beginGame(), 3500);
    }
    const cards = Engine.state.players.map(p => {
      const you = !p.ai;
      return `<div style="flex:1;min-width:200px;background:rgba(0,0,0,0.5);` +
        `border:2px solid ${you ? '#6bff8a' : p.color};border-radius:10px;padding:14px;text-align:center;">` +
        `<div style="font-size:1em;color:${you ? '#6bff8a' : p.color};font-weight:bold;letter-spacing:2px;">` +
          `${p.icon} ${you ? 'YOU' : p.name}</div>` +
        `<div style="font-size:2.4em;margin:8px 0;">${p.ruler.icon}</div>` +
        `<div style="font-size:1.1em;color:#d4af37;font-weight:bold;">${p.ruler.name}</div>` +
        `<div style="font-size:0.85em;color:#c8b898;margin-top:6px;line-height:1.4;">${p.ruler.desc}</div>` +
      `</div>`;
    }).join('');
    return `<h3>👑 Rulers Assigned</h3>` +
      `<p>Each lord serves a ruler whose power shapes the game. Yours is highlighted.</p>` +
      `<div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0;">${cards}</div>` +
      `<p style="color:#a89070;">The day begins shortly…</p>`;
  },

  // --- MORNING (turn-based) ---
  morningHTML() {
    const s = Engine.state, me = Engine.human();

    // 1) Intro gate: show MORNING, then a Start button
    if (!s.morningStarted) {
      return `<div style="text-align:center;">` +
        `<h2 style="font-size:2.4em;color:#d4af37;letter-spacing:4px;">☀️ MORNING</h2>` +
        `<p>One turn each — play up to 2 cards.</p>` +
        `<button class="btn-action" onclick="Engine.beginMorningTurns()" style="margin-top:16px;">Start ▶</button>` +
        `</div>`;
    }

    // 2) An incoming offer to YOU (always answerable, even on a bot's turn)
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

    // 3) A bot's turn
    if (!Engine.isHumanTurn()) {
      const cur = Engine.currentPlayer();
      return `<h3>${cur ? cur.icon + ' ' + cur.name : 'A rival'} is taking their turn...</h3>`;
    }

    // 4) YOUR turn
    return `<h3>Your turn</h3>` +
      `<p>Plays left: <strong style="color:#6bff8a;font-size:1.3em;">${'🟢'.repeat(s.playsLeft)}${'⚪'.repeat(2 - s.playsLeft)}</strong></p>` +
      `<p style="color:#a89070;font-size:0.95em;">Tap an item to use it, or drag a character onto a rival.</p>` +
      `<button class="btn-action" onclick="Engine.skipTurn()" style="margin-top:12px;">Skip Turn ⏭</button>`;
  },

  // --- Merchant item-swap overlay ---
  itemTradeHTML() {
    const pit = Engine.state.pendingItemTrade;
    const me = Engine.human(), target = pit.target;

    if (pit.giveUID && pit.wantUID) {
      const give = me.hand.find(c => c.uid === pit.giveUID);
      const want = target.hand.find(c => c.uid === pit.wantUID);
      return `<h3>🤝 Awaiting ${target.name}...</h3>` +
        `<p>Offering ${give.icon} ${give.name} for ${want.icon} ${want.name}.</p>`;
    }

    const myItems = me.hand.filter(c => c.type === 'item');
    const theirItems = target.hand.filter(c => c.type === 'item');
    const giveBtns = myItems.map(c => `<button class="choice-btn ${this._giveSel===c.uid?'sel':''}" ` +
      `onclick="UI.selItem('give','${c.uid}')">${c.icon} ${c.name}</button>`).join('');
    const wantBtns = theirItems.map(c => `<button class="choice-btn ${this._wantSel===c.uid?'sel':''}" ` +
      `onclick="UI.selItem('want','${c.uid}')">${c.icon} ${c.name}</button>`).join('');
    const ready = this._giveSel && this._wantSel;
    return `<h3>🧔 Merchant Trade — ${target.name}</h3>` +
      `<p>You give:</p><div class="choice-grid">${giveBtns}</div>` +
      `<p style="margin-top:10px;">You want:</p><div class="choice-grid">${wantBtns}</div>` +
      `<div style="margin-top:14px;">` +
      `<button class="btn-accept" ${ready?'':'disabled'} onclick="UI.confirmItemSwap()">Propose Swap</button>` +
      `<button class="btn-decline" onclick="UI.cancelItemTrade()">Cancel</button></div>`;
  },

  // --- AFTERNOON (timed supply raid — spend picks on rooms) ---
  afternoonHTML() {
    const s = Engine.state;

    // Raid finished early -> brief celebratory beat before EVENING
    if (s.allDone) {
      return `<div class="afternoon-wrap"><div class="afternoon-top">` +
        `${this.afHeaderHTML(s)}</div>` +
        `<div style="text-align:center;padding:36px 0;">` +
        `<h2 style="font-size:2.4em;color:#6bff8a;letter-spacing:3px;text-shadow:0 0 24px rgba(107,255,138,0.6);">🏁 RAID COMPLETE</h2>` +
        `<p style="font-size:1.4em;color:#d8c8a8;margin-top:10px;">Grabbed <strong style="color:#6bff8a;">${s.cardsEarned}</strong> — heading to the feast…</p>` +
        `</div></div>`;
    }

    // Connecting paths between task rooms
    const links = TASK_LINKS.map(([a, b]) => {
      const ra = TASK_ZONES.find(z => z.id === a), rb = TASK_ZONES.find(z => z.id === b);
      return `<line x1="${ra.x}" y1="${ra.y}" x2="${rb.x}" y2="${rb.y}" />`;
    }).join('');

    const noPicks = s.picksLeft <= 0;
    const active = s.activeZone;
    const rooms = TASK_ZONES.map(z => {
      const done = s.doneZones.includes(z.id);
      const isActive = active === z.id;
      const spent = done || (noPicks && !isActive) || (active && !isActive);
      const reward = this.zoneReward(z);
      const cls = 'map-room task-node' + (done ? ' done' : '') +
        (isActive ? ' working' : '') + (spent && !done ? ' spent' : '');
      const onclick = (spent || done || active) ? '' : `onclick="Engine.doTask('${z.id}')"`;
      return `<div class="${cls}" style="left:${z.x}%;top:${z.y}%;--rc:${z.color};" ${onclick}>` +
        `<div class="mr-icon">${z.icon}</div>` +
        `<div class="mr-name">${z.name}</div>` +
        `<div class="tn-reward">${reward.icon} ${reward.name}</div>` +
        (done ? `<div class="tn-check">✓</div>` : '') +
        (isActive ? `<div class="tn-working">⚒️</div>` : '') +
      `</div>`;
    }).join('');

    // Bottom strip: either the live work bar (mid-task) or the pick prompt
    let footer;
    if (active) {
      const z = TASK_ZONES.find(x => x.id === active);
      footer = `<div class="work-zone" onclick="Engine.workTask()">` +
        `<div class="work-title">⚒️ ${z.task}</div>` +
        `<div class="work-bar"><div class="work-fill" id="work-fill" ` +
          `style="width:${s.workProgress}%;background:linear-gradient(90deg,${z.color},#fff8);"></div></div>` +
        `<div class="work-hint">Mash <strong>SPACE</strong> or tap the bar to work! ` +
        `<button class="btn-icon" onclick="event.stopPropagation();Engine.cancelTask()">Leave</button></div>` +
      `</div>`;
    } else {
      footer = `<p class="work-hint">${noPicks ? 'Out of picks — the clock is winding down…'
        : `Click a room to work it — <strong>${s.picksLeft}</strong> pick${s.picksLeft === 1 ? '' : 's'} left.`}</p>`;
    }

    return `<div class="afternoon-wrap">` +
      `<div class="afternoon-top">${this.afHeaderHTML(s)}</div>` +
      `<div class="castle-map task-map-board">` +
        `<svg class="castle-links" viewBox="0 0 100 100" preserveAspectRatio="none">${links}</svg>` +
        rooms +
      `</div>` +
      footer +
    `</div>`;
  },

  // Cheap partial update of just the work bar while mashing
  renderWorkBar() {
    const el = document.getElementById('work-fill');
    if (el) el.style.width = Engine.state.workProgress + '%';
  },

  // Top bar: timer + pick pips + cards earned
  afHeaderHTML(s) {
    const pips = '🔵'.repeat(Math.max(0, s.picksLeft)) +
      '⚫'.repeat(Math.max(0, AFTERNOON_PICKS - Math.max(0, s.picksLeft)));
    return `<div class="af-timer" id="af-timer">⏱️ ${s.timeLeft}s</div>` +
      `<div class="af-picks">PICKS ${pips}</div>` +
      `<div class="af-count">🃏 ${s.cardsEarned}</div>`;
  },

  // What card a room will award (for the on-room preview)
  zoneReward(z) {
    return CardSystem.cardById(z.cardId) || { icon: z.icon, name: z.task };
  },

  // Cheap partial update so the 1s timer doesn't rebuild the whole map
  renderAfternoonTimer() {
    const el = document.getElementById('af-timer');
    if (el) {
      const t = Engine.state.timeLeft;
      el.textContent = `⏱️ ${t}s`;
      el.classList.toggle('low', t <= 7);
    }
  },

  // --- EVENING (instant cook) ---
  eveningHTML() {
    const s = Engine.state, me = Engine.human();
    if (s.cook === me) {
      return `<div style="text-align:center;">` +
        `<h3>🍳 You're cooking tonight!</h3>` +
        `<p>Serve clean for <strong style="color:#ffd86b;">+3🪙</strong>, or poison the feast to hurt the others.</p>` +
        `<div style="margin-top:16px;">` +
        `<button class="btn-accept" onclick="Engine.cook(false)">🍽️ Serve Clean (+3🪙)</button>` +
        `<button class="btn-challenge" onclick="Engine.cook(true)">☠️ Poison the Feast</button></div>` +
        `</div>`;
    }
    const c = s.cook;
    return `<div style="text-align:center;"><h3>🎲 ${c ? c.icon + ' ' + c.name : 'A rival'} is cooking…</h3>` +
      `<p style="color:#a89070;">Hope it isn't poisoned.</p></div>`;
  },

  // --- MIDNIGHT (castle map) ---
  midnightHTML() {
    const me = Engine.human();
    const placing = Engine.state.placing;
    const left = me.assassins.length;

    let head;
    if (placing) {
      head = `<h3>🌙 Hide your assassins — <span style="color:#ff6b6b;">${left} left</span></h3>` +
        `<p>Click rooms to plant assassins. Each one hits a sleeper there for <strong style="color:#ff6b6b;">2 HP</strong>.</p>` +
        `<button class="btn-action" onclick="Engine.donePlacing()" style="margin-bottom:10px;">` +
        `${left > 0 ? 'Done Placing ▶' : 'Continue ▶'}</button>`;
    } else {
      head = `<h3>🛏️ Choose your bed</h3>` +
        `<p>Avoid rooms with hidden assassins — each hit costs <strong style="color:#ff6b6b;">2 HP</strong>.</p>`;
    }
    return `<div class="midnight-wrap">${head}${this.castleMapHTML()}</div>`;
  },

  // Shared castle map used at midnight. Shows your placed assassins.
  castleMapHTML() {
    const me = Engine.human();
    const placing = Engine.state.placing;
    const links = CASTLE_LINKS.map(([a, b]) => {
      const ra = CASTLE_ROOMS.find(r => r.id === a), rb = CASTLE_ROOMS.find(r => r.id === b);
      const x1 = ra.x, y1 = ra.y, x2 = rb.x, y2 = rb.y;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    }).join('');
    const rooms = CASTLE_ROOMS.map(r => {
      const mine = me.placedAssassins.filter(l => l === r.id).length;
      const owner = r.home ? Engine.state.players.find(p => p.id === r.home) : null;
      const action = placing
        ? (me.assassins.length > 0 ? `onclick="Engine.placeAssassin('${r.id}')"` : '')
        : `onclick="Engine.chooseSleep('${r.id}')"`;
      const cls = 'map-room' + (placing && me.assassins.length > 0 ? ' placeable' : '') +
        (!placing ? ' sleepable' : '');
      const ownerTag = owner ? `<span class="mr-owner" style="color:${owner.color}">${owner.icon}</span>` : '';
      const marks = mine > 0 ? `<span class="mr-assassins">${'🥷'.repeat(mine)}</span>` : '';
      return `<div class="${cls}" style="left:${r.x}%;top:${r.y}%;" ${action}>` +
        `<div class="mr-icon">${r.icon}</div><div class="mr-name">${r.name}${ownerTag}</div>${marks}</div>`;
    }).join('');
    return `<div class="castle-map">` +
      `<svg class="castle-links" viewBox="0 0 100 100" preserveAspectRatio="none">${links}</svg>` +
      rooms + `</div>`;
  },

  resolveHTML() {
    const me = Engine.human();
    const room = me.sleepLocation ? Engine.roomName(me.sleepLocation) : 'your chamber';
    return `<div class="night-scene">` +
      `<div class="night-moon">🌙</div>` +
      `<div class="night-z">💤</div>` +
      `<div class="night-room">You sleep in <strong>${room}</strong>…</div>` +
    `</div>`;
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

  // --- Sell flow: claim truthfully or bluff (Chef/Bodyguard/etc.) ---
  tradeStep2(cardUID, targetId) {
    const card = Engine.human().hand.find(c => c.uid === cardUID);
    if (!card) return;
    const target = Engine.state.players.find(p => p.id === targetId);
    const sellable = CHARACTER_CARDS.filter(c => !c.free); // exclude free Merchant
    const opts = sellable.map(c => {
      const truth = c.id === card.id;
      const badge = truth
        ? `<span class="claim-badge truth">✓ HONEST</span>`
        : `<span class="claim-badge bluff">🎭 BLUFF</span>`;
      return `<button class="claim-tile ${truth ? 'truth' : 'bluff'}" ` +
        `onclick="FX.sound('card');Engine.offerTrade('${cardUID}','${c.id}','${targetId}')">` +
        `${badge}<div class="claim-art">${c.icon}</div>` +
        `<div class="claim-name">${c.name}</div>` +
        `<div class="claim-price">${c.tradePrice}🪙</div></button>`;
    }).join('');
    this.actionArea.innerHTML =
      `<h3>Offer to ${target.icon} ${target.name}</h3>` +
      `<p style="color:#a89070;">You hold <strong>${card.icon} ${card.name}</strong> — claim it, or bluff a pricier one.</p>` +
      `<div class="claim-grid">${opts}</div>` +
      `<button class="btn-icon" onclick="UI.render()" style="margin-top:12px;">Cancel</button>`;
  },

  // --- Merchant item-swap selection helpers ---
  selItem(side, uid) {
    if (side === 'give') this._giveSel = uid; else this._wantSel = uid;
    this.renderAction();
  },
  confirmItemSwap() {
    if (!this._giveSel || !this._wantSel) return;
    Engine.proposeItemSwap(this._giveSel, this._wantSel);
    this._giveSel = null; this._wantSel = null;
  },
  cancelItemTrade() {
    this._giveSel = null; this._wantSel = null;
    Engine.cancelItemTrade();
  },
});
