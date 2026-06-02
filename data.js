// ============================================================
// data.js — Card & game data for Castle Chaos
// ============================================================

// --- Single currency ---
// Tuned for a punchy ~5-day game: 10 HP (Giant 15), assassins hit for 2.
const START_MONEY = 10;
const START_HEALTH = 10;
const HAND_LIMIT = 9;
const START_HAND_SIZE = 5;
const DAILY_DRAW = 2;        // new cards drawn each dawn
const DAILY_ASSASSINS = 2;   // assassins granted each dawn (Warlord gets +1)
const ASSASSIN_CAP = 4;      // max assassins you can stockpile

// --- Rulers (randomly assigned to every player at game start) ---
// A tight set of 4 distinct powers. Descriptions are kept literal so the
// blocked/immune messages in play read the same as the ruler card.
const RULERS = [
  { id: 'witch',    name: 'The Witch',    icon: '🧙‍♀️', passive: 'poison_immune',  desc: 'Immune to poison — poison never hurts you.' },
  { id: 'warlord',  name: 'The Warlord',  icon: '⚔️',    passive: 'extra_assassin', desc: 'Gains one extra assassin every dawn.' },
  { id: 'sentinel', name: 'The Sentinel', icon: '🛡️',    passive: 'night_shield',   desc: 'Begins every night already shielded.' },
  { id: 'giant',    name: 'The Giant',    icon: '🗿',    passive: 'tough',          desc: 'Tougher body — starts with 15 max HP.' },
];

// --- Players ---
const PLAYERS_CONFIG = [
  { id: 'player', name: 'YOU', homeTower: 'tower3', color: '#4a9eff', icon: '👤', ai: false },
  { id: 'red', name: 'RED', homeTower: 'tower1', color: '#ff4a4a', icon: '🔴', ai: true },
  { id: 'blue', name: 'BLUE', homeTower: 'tower2', color: '#4a7aff', icon: '🔵', ai: true },
];

// --- Card Types ---
// Item: played on YOURSELF (or, for Poison Vial, AIMED at a rival)
// Character: GIVEN to another player in exchange for coins — THEY use the effect.
//   An HONEST sale also pays the SELLER a bonus (see HONEST_BONUS) — honesty pays.
// Merchant (character): played for FREE to buy a rival's item with coins
// Assassin: hidden on the castle map (any time) to ambush a sleeper for 2 dmg

const HONEST_BONUS = 2;   // extra coins the seller earns on an honest sale

const ITEM_CARDS = [
  { id: 'health_vial', name: 'Health Vial', type: 'item', desc: 'Restore 1 HP.', icon: '🧪', effect: 'heal', value: 1, weight: 5, buyPrice: 3 },
  { id: 'coin_pouch', name: 'Coin Pouch', type: 'item', desc: 'Gain 4 coins.', icon: '💰', effect: 'money', value: 4, weight: 5, buyPrice: 3 },
  { id: 'shield', name: 'Iron Shield', type: 'item', desc: '40% chance to block an assassin tonight.', icon: '🛡️', effect: 'shield', value: 0.4, weight: 2, buyPrice: 5 },
  { id: 'poison_vial', name: 'Poison Vial', type: 'item', desc: 'Poison a rival — they lose 2 HP at next dawn. (Witch is immune.)', icon: '☠️', effect: 'poison', value: 2, weight: 3, buyPrice: 5, targeted: true },
  { id: 'antidote', name: 'Antidote', type: 'item', desc: 'Cure your poison & heal 1 HP.', icon: '💊', effect: 'antidote', value: 1, weight: 4, buyPrice: 4 },
  { id: 'battle_scroll', name: 'Battle Scroll', type: 'item', desc: 'Draw 2 cards.', icon: '📜', effect: 'draw', value: 2, weight: 4, buyPrice: 4 },
  { id: 'hidden_dagger', name: 'Hidden Dagger', type: 'item', desc: 'Gain an assassin for tonight.', icon: '🗡️', effect: 'assassin', value: 1, weight: 3, buyPrice: 5 },
  { id: 'royal_feast', name: 'Royal Feast', type: 'item', desc: '+1 max HP and heal 2 HP.', icon: '🍖', effect: 'maxhp', value: 2, weight: 2, buyPrice: 6 },
  // --- new unique items (shop / rare draws) ---
  { id: 'crown_jewel', name: 'Crown Jewel', type: 'item', desc: 'Gain 8 coins.', icon: '💎', effect: 'money', value: 8, weight: 1, buyPrice: 6, premium: true },
  { id: 'war_horn', name: 'War Horn', type: 'item', desc: 'Gain 2 assassins for tonight.', icon: '📯', effect: 'assassin', value: 2, weight: 1, buyPrice: 8, premium: true },
];

const CHARACTER_CARDS = [
  { id: 'chef', name: 'Chef', type: 'character', desc: 'Buyer restores 2 health.', icon: '👨‍🍳', effect: 'heal', value: 2, tradePrice: 3, weight: 5 },
  { id: 'bodyguard', name: 'Bodyguard', type: 'character', desc: 'Buyer gets a 40% block tonight.', icon: '💂', effect: 'shield', value: 0.4, tradePrice: 3, weight: 4 },
  { id: 'merchant', name: 'Merchant', type: 'character', desc: 'Play FREE to buy a rival\'s item with coins.', icon: '🧔', effect: 'trade', value: 0, tradePrice: 0, free: true },
  // --- characters ---
  { id: 'healer', name: 'Healer', type: 'character', desc: 'Buyer restores 3 health.', icon: '🧑‍⚕️', effect: 'heal', value: 3, tradePrice: 5, weight: 3 },
  { id: 'spy', name: 'Spy', type: 'character', desc: 'Buyer draws a card.', icon: '🕵️', effect: 'draw', value: 1, tradePrice: 2, weight: 4 },
  // --- special characters (premium; bought in the market) ---
  // Jester & Wizard have a BLUFF SPECIAL that fires when the buyer accepts a
  // bluffed offer (you claimed them but held something else, uncaught).
  { id: 'jester', name: 'Jester', type: 'character', desc: 'Honest: buyer draws 1. Bluff (uncaught): SWAP hands with them!', icon: '🃏', effect: 'draw', value: 1, tradePrice: 4, bluffSpecial: 'swap_hands', premium: true },
  { id: 'wizard', name: 'Wizard', type: 'character', desc: 'Honest: buyer heals 2. Bluff (uncaught): buyer −2 HP, you +1 HP.', icon: '🧙', effect: 'heal', value: 2, tradePrice: 5, bluffSpecial: 'wizard_strike', premium: true },
  { id: 'druid', name: 'Druid', type: 'character', desc: "Forest's Blessing — buyer gains +1 MAX HP and heals 1.", icon: '🌿', effect: 'forest', value: 1, tradePrice: 4, premium: true },
];

const ASSASSIN_CARDS = [
  { id: 'assassin_basic', name: 'Assassin', type: 'assassin', desc: 'Place at a location. Deals 2 damage.', icon: '🥷', damage: 2 },
];

const ALL_CARDS = [...ITEM_CARDS, ...CHARACTER_CARDS, ...ASSASSIN_CARDS];

// Pool of cards drawn each dawn. Excludes the free Merchant and all
// `premium` cards (those are market-only), and leans toward characters.
const DRAW_POOL = [...ITEM_CARDS, ...CHARACTER_CARDS].filter(c => !c.free && !c.premium);

// --- Castle map — used to hide assassins (any time) and to sleep at night ---
// x/y are percentage positions on the map board. `home` marks tower owners.
const CASTLE_ROOMS = [
  { id: 'tower1',  name: 'Tower I',   icon: '🗼', x: 18, y: 12, home: 'red' },
  { id: 'tower2',  name: 'Tower II',  icon: '🗼', x: 50, y: 12, home: 'blue' },
  { id: 'tower3',  name: 'Tower III', icon: '🗼', x: 82, y: 12, home: 'player' },
  { id: 'kitchen', name: 'Kitchen',   icon: '🍳', x: 18, y: 42 },
  { id: 'central', name: 'Central Chamber', icon: '🏰', x: 50, y: 42 },
  { id: 'assassins', name: 'Assassins Guild', icon: '🗡️', x: 82, y: 42 },
  { id: 'library', name: 'Library',   icon: '📚', x: 18, y: 70 },
  { id: 'garden',  name: 'Garden',    icon: '🌿', x: 82, y: 70 },
  { id: 'docks',   name: 'Docks',     icon: '⚓', x: 82, y: 92 },
  { id: 'closet1', name: 'Closet I',  icon: '🧹', x: 30, y: 92 },
  { id: 'closet2', name: 'Closet II', icon: '🧹', x: 55, y: 92 },
];
const CASTLE_LINKS = [
  ['central','kitchen'], ['central','assassins'], ['kitchen','library'],
  ['assassins','garden'], ['garden','docks'], ['closet1','garden'], ['closet2','assassins'],
];

// Locations where assassins can be placed / players can sleep (the castle interior)
const ASSASSIN_LOCATIONS = CASTLE_ROOMS.map(r => r.id);

// --- MARKET --------------------------------------------------------------
// Openable any time during the day via a button (pauses the game). Three
// tabs of wares. `kind` tells the engine how to apply a purchase; `card`
// adds a card by id to the buyer's hand.
const SHOP_BUFFS = [
  { id: 'buy_hp',      name: 'Hearty Meal',   icon: '❤️', desc: '+2 HP now.',            price: 4,  kind: 'heal',   value: 2 },
  { id: 'buy_maxhp',   name: 'Royal Banquet', icon: '🍖', desc: '+1 MAX HP, heal 1.',    price: 7,  kind: 'maxhp',  value: 1 },
  { id: 'buy_shield',  name: 'Iron Shield',   icon: '🛡️', desc: '40% block tonight.',     price: 5,  kind: 'shield', value: 0.4 },
  { id: 'buy_antidote',name: 'Antidote',      icon: '💊', desc: 'Cure poison + heal 1.',  price: 4,  kind: 'antidote', value: 1 },
];
const SHOP_FORCES = [
  { id: 'buy_assassin',  name: 'Hire Assassin', icon: '🥷', desc: '+1 assassin for tonight.',  price: 4,  kind: 'assassin', value: 1 },
  { id: 'buy_assassin2', name: 'Death Squad',   icon: '🗡️', desc: '+2 assassins for tonight.',  price: 7,  kind: 'assassin', value: 2 },
  { id: 'buy_poison',    name: 'Poison Vial',   icon: '☠️', desc: 'Card: poison a rival for 2.', price: 5,  kind: 'card', card: 'poison_vial' },
  { id: 'buy_warhorn',   name: 'War Horn',      icon: '📯', desc: 'Card: +2 assassins on use.', price: 8,  kind: 'card', card: 'war_horn' },
];
const SHOP_CARDS = [
  { id: 'buy_jester', name: 'Jester', icon: '🃏', desc: 'Swap hands on a clean bluff.', price: 6, kind: 'card', card: 'jester' },
  { id: 'buy_wizard', name: 'Wizard', icon: '🧙', desc: 'Strike on a clean bluff.',     price: 7, kind: 'card', card: 'wizard' },
  { id: 'buy_druid',  name: 'Druid',  icon: '🌿', desc: "Forest's Blessing buff.",       price: 5, kind: 'card', card: 'druid' },
  { id: 'buy_jewel',  name: 'Crown Jewel', icon: '💎', desc: 'Card: +8 coins on use.',   price: 6, kind: 'card', card: 'crown_jewel' },
];
const SHOP_TABS = [
  { id: 'buffs',  name: 'Buffs',     icon: '✨', items: SHOP_BUFFS },
  { id: 'forces', name: 'Assassins', icon: '🥷', items: SHOP_FORCES },
  { id: 'cards',  name: 'New Cards', icon: '🆕', items: SHOP_CARDS },
];
