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

  // Give starting hand — 5 cards, VARIED every game so no two openings feel
  // the same. Guaranteed: the free Merchant (so you always have the buy flow)
  // and at least one survival staple (heal / shield / antidote). The rest are
  // weighted random draws, shuffled so their order varies too.
  createStartingHand() {
    const hand = [this.createCard(CHARACTER_CARDS.find(c => c.id === 'merchant'))];
    // One guaranteed survival staple, picked at random from a small set
    const staples = ['health_vial', 'shield', 'antidote', 'royal_feast'];
    const stapleId = staples[Math.floor(Math.random() * staples.length)];
    hand.push(this.createCard(ITEM_CARDS.find(c => c.id === stapleId)));
    // Three fully random weighted draws to round out the opening
    for (let i = 0; i < 3; i++) hand.push(this.randomDraw());
    // Shuffle so the Merchant/staple aren't always first
    for (let i = hand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [hand[i], hand[j]] = [hand[j], hand[i]];
    }
    return hand;
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
