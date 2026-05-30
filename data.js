// ============================================================
// data.js — Card & game data for Castle Chaos
// ============================================================

// --- Single currency ---
const START_MONEY = 12;   // tighter start so coins feel meaningful
const START_HEALTH = 5;
const HAND_LIMIT = 7;
const START_HAND_SIZE = 4;
const DAILY_DRAW = 2; // new cards drawn each morning (on top of task cards)
const ASSASSIN_CAP = 4;   // max assassins you can stockpile (was an unbalanced 6)

// --- Rulers (randomly assigned to every player at game start) ---
// Reduced to a tight set of 4 distinct powers.
const RULERS = [
  { id: 'witch',    name: 'The Witch',    icon: '🧙‍♀️', passive: 'poison_immune',  desc: 'Immune to poison.' },
  { id: 'warlord',  name: 'The Warlord',  icon: '⚔️',    passive: 'extra_assassin', desc: 'Draw an extra assassin each day.' },
  { id: 'sentinel', name: 'The Sentinel', icon: '🛡️',    passive: 'night_shield',   desc: 'Regain a shield every midnight.' },
  { id: 'giant',    name: 'The Giant',    icon: '🗿',    passive: 'tough',          desc: 'Start with +1 max health (6 HP).' },
];

// --- Players ---
const PLAYERS_CONFIG = [
  { id: 'player', name: 'YOU', homeTower: 'tower3', color: '#4a9eff', icon: '👤', ai: false },
  { id: 'red', name: 'RED', homeTower: 'tower1', color: '#ff4a4a', icon: '🔴', ai: true },
  { id: 'blue', name: 'BLUE', homeTower: 'tower2', color: '#4a7aff', icon: '🔵', ai: true },
];

// --- Card Types ---
// Item: played on YOURSELF for a personal buff/resource
// Character: GIVEN to another player in exchange for coins — THEY use the effect
// Merchant (character): played for FREE to start an item-swap negotiation
// Assassin: place at midnight to damage others

const ITEM_CARDS = [
  { id: 'health_vial', name: 'Health Vial', type: 'item', desc: 'Restore 2 HP.', icon: '🧪', effect: 'heal', value: 2, weight: 5 },
  { id: 'coin_pouch', name: 'Coin Pouch', type: 'item', desc: 'Gain 4 coins.', icon: '💰', effect: 'money', value: 4, weight: 5 },
  { id: 'shield', name: 'Iron Shield', type: 'item', desc: '40% chance to block an assassin tonight.', icon: '🛡️', effect: 'shield', value: 0.4, weight: 1 },
  { id: 'antidote', name: 'Antidote', type: 'item', desc: 'BLOCK poison & heal 1 HP.', icon: '💊', effect: 'antidote', value: 1, weight: 4 },
  { id: 'battle_scroll', name: 'Battle Scroll', type: 'item', desc: 'Draw 2 cards.', icon: '📜', effect: 'draw', value: 2, weight: 4 },
  { id: 'hidden_dagger', name: 'Hidden Dagger', type: 'item', desc: 'Gain an assassin for tonight.', icon: '🗡️', effect: 'assassin', value: 1, weight: 3 },
  { id: 'royal_feast', name: 'Royal Feast', type: 'item', desc: '+1 max HP and heal 2 HP.', icon: '🍖', effect: 'maxhp', value: 2, weight: 2 },
];

const CHARACTER_CARDS = [
  { id: 'chef', name: 'Chef', type: 'character', desc: 'Buyer restores 2 health.', icon: '👨‍🍳', effect: 'heal', value: 2, tradePrice: 3 },
  { id: 'bodyguard', name: 'Bodyguard', type: 'character', desc: 'Buyer gets a 40% block tonight.', icon: '💂', effect: 'shield', value: 0.4, tradePrice: 3 },
  { id: 'merchant', name: 'Merchant', type: 'character', desc: 'Play FREE to open an item-card trade.', icon: '🧔', effect: 'trade', value: 0, tradePrice: 0, free: true },
  // --- new characters ---
  { id: 'noble', name: 'Noble', type: 'character', desc: 'Buyer gains 3 coins.', icon: '👑', effect: 'money', value: 3, tradePrice: 4 },
  { id: 'healer', name: 'Healer', type: 'character', desc: 'Buyer restores 3 health.', icon: '🧑‍⚕️', effect: 'heal', value: 3, tradePrice: 5 },
  { id: 'spy', name: 'Spy', type: 'character', desc: 'Buyer draws a card.', icon: '🕵️', effect: 'draw', value: 1, tradePrice: 2 },
];

const ASSASSIN_CARDS = [
  { id: 'assassin_basic', name: 'Assassin', type: 'assassin', desc: 'Place at a location. Deals 2 damage.', icon: '🥷', damage: 2 },
];

const ALL_CARDS = [...ITEM_CARDS, ...CHARACTER_CARDS, ...ASSASSIN_CARDS];

// Pool of cards that can be drawn each morning (no free Merchant flood)
const DRAW_POOL = [...ITEM_CARDS, ...CHARACTER_CARDS.filter(c => !c.free)];

// --- Afternoon supply raid (timed run on a castle map) ---
// You get a limited number of PICKS — choose which rooms to raid before the
// clock runs out. Each room previews and awards ONE specific card, once.
const AFTERNOON_SECONDS = 20;
const AFTERNOON_PICKS = 3;   // strategic: grab 3 of the 6 rooms
const TASK_ZONES = [
  { id: 'kitchen',    name: 'Kitchen',    icon: '🍳', color: '#c46b2a', task: 'Cook a Feast',   cardType: 'character', cardId: 'chef',          x: 18, y: 26 },
  { id: 'barracks',   name: 'Barracks',   icon: '🛡️', color: '#5a7ac4', task: 'Train Guards',  cardType: 'character', cardId: 'bodyguard',     x: 82, y: 26 },
  { id: 'treasury',   name: 'Treasury',   icon: '💰', color: '#d4af37', task: 'Count Coins',    cardType: 'item',      cardId: 'coin_pouch',    x: 50, y: 50 },
  { id: 'apothecary', name: 'Apothecary', icon: '🧪', color: '#3aa86b', task: 'Brew Tonics',    cardType: 'item',      cardId: 'health_vial',   x: 16, y: 74 },
  { id: 'armory',     name: 'Armory',     icon: '⚔️', color: '#8a8a9a', task: 'Forge Shields',  cardType: 'item',      cardId: 'shield',        x: 84, y: 74 },
  { id: 'shadows',    name: 'Shadows',    icon: '🥷', color: '#9a4a9a', task: 'Recruit Killer', cardType: 'assassin',  cardId: 'assassin_basic',x: 50, y: 86 },
];
const TASK_LINKS = [
  ['treasury','kitchen'], ['treasury','barracks'], ['treasury','apothecary'],
  ['treasury','armory'], ['treasury','shadows'],
  ['kitchen','apothecary'], ['barracks','armory'], ['apothecary','shadows'], ['armory','shadows'],
];

// --- Castle map (from castle_map.txt) — used for the midnight phase ---
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
