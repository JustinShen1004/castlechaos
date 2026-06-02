// ============================================================
// cards.js — Card system for Castle Chaos
// ============================================================

const CardSystem = {
  generateUID() {
    return 'c_' + Math.random().toString(36).substr(2, 8);
  },

  // Create a card instance from a template
  createCard(template) {
    return { ...template, uid: this.generateUID() };
  },

  // Get a random card of a specific type
  randomCard(type) {
    let pool;
    if (type === 'item') pool = ITEM_CARDS;
    else if (type === 'character') pool = CHARACTER_CARDS;
    else if (type === 'assassin') pool = ASSASSIN_CARDS;
    else pool = ALL_CARDS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return this.createCard(pick);
  },

  // Build a specific card by its id (across all pools)
  cardById(id) {
    const tpl = ALL_CARDS.find(c => c.id === id);
    return tpl ? this.createCard(tpl) : null;
  },

  // A card from the daily-draw pool (excludes the free Merchant).
  // Weighted: rarer cards (low `weight`) appear far less often.
  randomDraw() {
    const total = DRAW_POOL.reduce((sum, c) => sum + (c.weight || 1), 0);
    let roll = Math.random() * total;
    for (const tpl of DRAW_POOL) {
      roll -= (tpl.weight || 1);
      if (roll <= 0) return this.createCard(tpl);
    }
    return this.createCard(DRAW_POOL[DRAW_POOL.length - 1]);
  },

  // Give starting hand — 5 cards: Merchant + 2 staple items + 2 random draws
  createStartingHand() {
    return [
      this.createCard(CHARACTER_CARDS.find(c => c.id === 'merchant')),
      this.createCard(ITEM_CARDS.find(c => c.id === 'health_vial')),
      this.createCard(ITEM_CARDS.find(c => c.id === 'coin_pouch')),
      this.randomDraw(),
      this.randomDraw(),
    ];
  },

  // Give daily assassin
  createDailyAssassin() {
    return this.createCard(ASSASSIN_CARDS[0]);
  },

  // Add card to hand (respects limit)
  addToHand(player, card) {
    if (player.hand.length < HAND_LIMIT) {
      player.hand.push(card);
      return true;
    }
    return false;
  },

  // Remove card from hand by uid
  removeFromHand(player, uid) {
    const idx = player.hand.findIndex(c => c.uid === uid);
    if (idx === -1) return null;
    return player.hand.splice(idx, 1)[0];
  },
};
