# Castle Chaos - Implementation Plan

## Current State
- `game.html` — HTML shell with canvas, info panel, title overlay
- `game.js` — Map rendering with 11 rooms, connections, click-to-travel
- `castle_map.txt` — Text reference map

## Architecture: New Files

| File | Purpose |
|------|---------|
| `cards.js` | Card definitions, deck logic (draw, discard, shuffle) |
| `gameloop.js` | Turn phases (morning trade → task → reward → end turn) |
| `tasks.js` | Zone-specific tasks, difficulty, resolution |
| `combat.js` | Simple card-based encounter resolution |
| `ui.js` | HUD rendering (hand, resources, phase indicator, buttons) |
| `data.js` | All card data, task data, zone configs |

## Implementation Steps

### Step 1: `data.js` — Game data definitions
- Resource types: gold, food, materials, poison, knowledge
- Item cards (30+): tools, buffs, resources with rarity (common/rare/epic)
- Character cards (15+): assassin, worker, guard, spy, etc. with stats (attack, defense, skill)
- Zone task configs: which zone offers which task types
- Rarity weights for reward draws

### Step 2: `cards.js` — Card system engine
- `createDeck()` — build starting deck
- `shuffleDeck(deck)` — Fisher-Yates shuffle
- `drawCards(deck, n)` — draw n cards from top
- `discardCard(hand, index, discard)` — move card to discard pile
- `useCard(card, context)` — apply card effect
- Player state: `{ hand: [], deck: [], discard: [], storage: [] }`

### Step 3: `gameloop.js` — Core turn loop
- Game state: `{ turn: 1, phase: 'morning'|'task'|'reward'|'end', resources: {} }`
- `startMorning()` — show trade UI, draw 2 cards
- `startTaskPhase()` — enable zone clicking for tasks
- `resolveTask(zone, cardsPlayed)` — calculate outcome
- `startRewardPhase(results)` — give cards/resources based on outcome
- `endTurn()` — increment turn, reset phase, discard excess cards

### Step 4: `tasks.js` — Zone-linked task system
- Each zone has 2-3 task types (e.g., Kitchen: "Cook Feast", "Poison Brew")
- Task difficulty scales with turn number
- Tasks require specific resources or card plays to complete
- Success/failure determined by card stats vs difficulty threshold

### Step 5: `combat.js` — Encounter resolution
- Encounters triggered by certain tasks or zones (Assassins Guild, Towers)
- Player plays character cards + item cards
- Total attack/defense vs enemy stats
- Simple outcome: win (bonus reward), lose (lose resources), draw (partial)

### Step 6: `ui.js` — HUD and interface
- Top bar: turn counter, phase name, resource counts
- Bottom panel: replace info panel with context-sensitive UI per phase
- Card hand display: clickable cards along bottom
- Trade UI: resource exchange buttons during morning phase
- Task UI: shows available tasks when clicking a zone

### Step 7: Update `game.html`
- Add script tags for new files (in order: data, cards, tasks, combat, gameloop, ui)
- Add HUD container divs

### Step 8: Update `game.js`
- Hook room clicks into task system during task phase
- Add tower connections (tower1↔library, tower1↔kitchen, tower2↔central, tower2↔assassins, tower3↔garden, tower3↔central)
- Keep all existing map rendering untouched

## Zone → Task Mapping

| Zone | Task Types |
|------|-----------|
| Central Chamber | Diplomacy, Command |
| Library | Research, Decode |
| Assassins Guild | Assassination, Espionage |
| Kitchen | Cook Feast, Poison Brew |
| Garden | Harvest, Alchemy |
| Docks | Smuggle, Trade Route |
| Closet 1 | Scavenge |
| Closet 2 | Eavesdrop |
| North Tower | Scout, Ambush |
| East Tower | Signal, Defend |
| South Tower | Dragon Lore, Ritual |

## Turn Flow Diagram

```
Morning Phase → Draw 2 cards, trade resources
     ↓
Task Phase → Click a zone, pick a task, play cards
     ↓
Reward Phase → Earn cards/resources based on outcome
     ↓
End Turn → Discard to hand limit (7), advance turn
```
