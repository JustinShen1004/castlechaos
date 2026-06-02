// ============================================================
// trade-merchant.js — Merchant: buy a rival's item card with COINS
// ============================================================
// Played for free during your morning turn. Pick a rival, then pay
// coins to take one of their ITEM cards straight into your hand. The
// rival (AI) accepts or declines based on whether the price is fair.
// Straightforward: coins out, item in — no swapping, no item from you.

Object.assign(Engine, {
  // Step 1: player plays Merchant and chooses which rival to buy from
  startMerchantTrade(merchantUID, targetId) {
    if (!this.canAct()) return;
    const me = this.human();
    const target = this.state.players.find(p => p.id === targetId);
    if (!target || target.dead) return;
    const merchant = me.hand.find(c => c.uid === merchantUID);
    if (!merchant || merchant.id !== 'merchant') return;

    const theirItems = target.hand.filter(c => c.type === 'item');
    if (theirItems.length === 0) { this.notify(`🧔 ${target.name} has no items to sell.`, 'warn'); UI.render(); return; }
    if (me.hand.length >= HAND_LIMIT) { this.notify(`✋ Your hand is full (max ${HAND_LIMIT}).`, 'warn'); UI.render(); return; }

    // pendingItemTrade now means "buying an item for coins"
    this.state.pendingItemTrade = { merchantUID, target, wantUID: null };
    this.notify(`🧔 Merchant — buy an item from ${target.name} with coins.`, 'info');
    UI.render();
  },

  // The price a buyer pays for an item (its shop buyPrice, default 3)
  itemBuyPrice(card) {
    return (card && card.buyPrice) || 3;
  },

  // Step 2: player picks which of the rival's items to buy
  proposeItemBuy(wantUID) {
    const pit = this.state.pendingItemTrade;
    if (!pit) return;
    const me = this.human();
    const target = pit.target;
    const want = target.hand.find(c => c.uid === wantUID);
    if (!want) return;
    const price = this.itemBuyPrice(want);
    if (me.money < price) { this.notify(`🪙 You can't afford ${want.name} (${price}🪙).`, 'warn'); UI.render(); return; }

    pit.wantUID = wantUID;
    pit.price = price;
    // AI seller decides: usually accepts a fair offer; refuses sometimes
    const accept = Math.random() < 0.75;
    this.state.busy = true;
    this.notify(`🤝 Offering ${price}🪙 for ${target.name}'s ${want.icon} ${want.name}…`, 'info');
    UI.render();
    setTimeout(() => this.resolveItemBuy(accept), 2400);
  },

  resolveItemBuy(accepted) {
    const pit = this.state.pendingItemTrade;
    if (!pit) return;
    const me = this.human();
    const target = pit.target;
    const price = pit.price;
    this.state.pendingItemTrade = null;

    if (!accepted) {
      this.notify(`❌ ${target.name} refused to sell.`, 'warn');
      // The Merchant attempt still costs one play
      if (this.state.phase === 'day' && this.isHumanTurn()) this.consumePlay();
      else { this.state.busy = false; UI.render(); }
      return;
    }
    // Pay coins, move the item from the rival into your hand
    me.money -= price;
    target.money += price;
    const want = CardSystem.removeFromHand(target, pit.wantUID);
    if (want) me.hand.push(want);
    CardSystem.removeFromHand(me, pit.merchantUID); // Merchant is consumed
    FX.event('coins'); FX.float(`🛒 ${want ? want.icon : ''} bought!`, '#6bff8a');
    this.notify(`✅ Bought ${want.icon} ${want.name} from ${target.name} for ${price}🪙.`, 'good');
    if (this.state.phase === 'day' && this.isHumanTurn()) this.consumePlay();
    else { this.state.busy = false; UI.render(); }
  },

  cancelItemTrade() {
    if (!this.canAct()) return;
    this.state.pendingItemTrade = null;
    UI.render();
  },
});
