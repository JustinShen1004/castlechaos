// ============================================================
// trade-merchant.js — Merchant: free item-card swap negotiation
// ============================================================
// Played for free during morning. The player picks one of their ITEM
// cards to give and requests one of a rival's ITEM cards in return.
// The rival (AI) accepts or declines the 1-for-1 item swap.

Object.assign(Engine, {
  // Step 1: player plays Merchant and chooses which rival to trade with
  startMerchantTrade(merchantUID, targetId) {
    if (!this.canAct()) return;
    const me = this.human();
    const target = this.state.players.find(p => p.id === targetId);
    if (!target || target.dead) return;
    const merchant = me.hand.find(c => c.uid === merchantUID);
    if (!merchant || merchant.id !== 'merchant') return;

    const myItems = me.hand.filter(c => c.type === 'item');
    const theirItems = target.hand.filter(c => c.type === 'item');
    if (myItems.length === 0) { this.notify('🧔 You have no item cards to trade.', 'warn'); UI.render(); return; }
    if (theirItems.length === 0) { this.notify(`🧔 ${target.name} has no item cards to trade.`, 'warn'); UI.render(); return; }

    this.state.pendingItemTrade = { merchantUID, target, giveUID: null, wantUID: null };
    this.notify(`🧔 Merchant trade with ${target.name} — pick items to swap.`, 'info');
    UI.render();
  },

  // Step 2: player picks the item they give and the item they want
  proposeItemSwap(giveUID, wantUID) {
    const pit = this.state.pendingItemTrade;
    if (!pit) return;
    pit.giveUID = giveUID;
    pit.wantUID = wantUID;

    const me = this.human();
    const target = pit.target;
    const give = me.hand.find(c => c.uid === giveUID);
    const want = target.hand.find(c => c.uid === wantUID);
    if (!give || !want) return;

    // AI evaluates the swap: accept if the wanted card is not strictly better
    const rank = { coin_pouch: 3, health_vial: 2, shield: 1 };
    const fair = (rank[give.id] || 1) >= (rank[want.id] || 1) || Math.random() < 0.4;
    this.state.busy = true; // lock while the rival considers the swap
    setTimeout(() => this.resolveItemSwap(fair), 1400);
    this.notify(`🤝 Offering your ${give.icon} ${give.name} for ${target.name}'s ${want.icon} ${want.name}…`, 'info');
    UI.render();
  },

  resolveItemSwap(accepted) {
    const pit = this.state.pendingItemTrade;
    if (!pit) return;
    const me = this.human();
    const target = pit.target;
    this.state.pendingItemTrade = null;

    if (!accepted) {
      this.notify(`❌ ${target.name} declined the item swap.`, 'warn');
      // The Merchant attempt still costs one play
      if (this.state.phase === 'morning' && this.isHumanTurn()) this.consumePlay();
      else { this.state.busy = false; UI.render(); }
      return;
    }
    const give = CardSystem.removeFromHand(me, pit.giveUID);
    const want = CardSystem.removeFromHand(target, pit.wantUID);
    if (give) target.hand.push(give);
    if (want) me.hand.push(want);
    // Merchant card is consumed when the trade completes
    CardSystem.removeFromHand(me, pit.merchantUID);
    FX.sound('card'); FX.float('🤝 Swap!', '#6bff8a');
    this.notify(`✅ Swap! Gave ${give.icon} ${give.name}, got ${want.icon} ${want.name}.`, 'good');
    if (this.state.phase === 'morning' && this.isHumanTurn()) this.consumePlay();
    else { this.state.busy = false; UI.render(); }
  },

  cancelItemTrade() {
    if (!this.canAct()) return;
    this.state.pendingItemTrade = null;
    UI.render();
  },
});
