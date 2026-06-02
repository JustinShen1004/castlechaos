// ============================================================
// shop.js — Market & Castle Map: fullscreen overlays openable any time
// ============================================================
// Both are opened from buttons during the DAY and pause the board (a
// fullscreen layer covers everything). The Market spends coins; the Map
// hides assassins. Closing returns to the day exactly where you left off.

Object.assign(Engine, {
  // --- Open / close the fullscreen overlays ---
  openMarket() {
    if (!this.state || this.state.overlay) return;
    if (this.state.phase === 'resolve' || this.state.phase === 'gameover') return;
    this.state.overlay = 'market';
    this.state.shopTab = this.state.shopTab || 'buffs';
    FX.sound('click');
    UI.render();
  },
  openMap() {
    if (!this.state || this.state.overlay) return;
    if (this.state.phase === 'resolve' || this.state.phase === 'gameover') return;
    this.state.overlay = 'map';
    FX.sound('click');
    UI.render();
  },
  closeOverlay() {
    this.state.overlay = null;
    FX.sound('click');
    UI.render();
  },

  // Flat lookup of a ware across every market tab
  shopWare(id) {
    for (const tab of SHOP_TABS) {
      const w = tab.items.find(x => x.id === id);
      if (w) return w;
    }
    return null;
  },

  buyShop(id) {
    if (this.state.overlay !== 'market') return;
    const w = this.shopWare(id);
    if (!w) return;
    const me = this.human();
    if (me.money < w.price) { this.notify('🪙 Not enough coins.', 'warn'); UI.render(); return; }

    if (w.kind === 'card' && me.hand.length >= HAND_LIMIT) {
      this.notify(`✋ Hand full (max ${HAND_LIMIT}) — use a card first.`, 'warn');
      UI.render();
      return;
    }
    me.money -= w.price;
    this.applyPurchase(me, w);
    UI.render();
  },

  // Apply a bought ware's effect to the buyer
  applyPurchase(p, w) {
    const isMe = p === this.human();
    if (w.kind === 'heal') { p.health += w.value; if (isMe) FX.event('heal'); }
    else if (w.kind === 'maxhp') { p.maxHealth += 1; p.health += w.value; if (isMe) FX.event('heal'); }
    else if (w.kind === 'shield') { p.shielded = true; if (isMe) FX.event('shield'); }
    else if (w.kind === 'antidote') { p.poisoned = false; p.poisonBy = null; p.health += w.value; if (isMe) FX.event('heal'); }
    else if (w.kind === 'assassin') {
      for (let i = 0; i < w.value; i++) p.assassins.push(CardSystem.createDailyAssassin());
      if (p.assassins.length > ASSASSIN_CAP) p.assassins = p.assassins.slice(-ASSASSIN_CAP);
      if (isMe) { FX.sound('click'); FX.float(`🥷 +${w.value}`, '#d4a8f0'); }
    } else if (w.kind === 'card') {
      const card = CardSystem.cardById(w.card);
      if (card) this.drawInto(p, card);
      if (isMe && card) { FX.sound('card'); FX.float(`+${card.icon} ${card.name}`, '#6bff8a'); }
    }
    if (isMe) this.notify(`🛍️ Bought ${w.icon} ${w.name} for ${w.price}🪙.`, 'good');
  },

  // Switch the visible market tab
  shopSelectTab(id) {
    if (this.state.overlay !== 'market') return;
    this.state.shopTab = id;
    FX.sound('click');
    UI.render();
  },

  // Bots visit the market once at dawn (called from endDay's lead-in)
  aiShop(ai) {
    let safety = 4;
    while (safety-- > 0 && ai.money >= 4 && Math.random() < 0.6) {
      const pool = [];
      if (ai.health < ai.maxHealth) pool.push(SHOP_BUFFS[0]);   // heal
      pool.push(SHOP_FORCES[0]);                                // hire assassin
      if (Math.random() < 0.3) pool.push(SHOP_BUFFS[2]);        // shield
      const w = pool[Math.floor(Math.random() * pool.length)];
      if (ai.money < w.price) break;
      ai.money -= w.price;
      this.applyPurchase(ai, w);
    }
  },
});
