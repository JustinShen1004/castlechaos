// ============================================================
// game.js — Screen routing & input for Castle Chaos
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showMenu()  { showScreen('menu-screen'); refreshMenu(); }
function showHowTo() { showScreen('howto-screen'); }
function showCollection() { showScreen('collection-screen'); UI.renderCollection(); }

// Show/hide the Continue button based on whether a saved game exists
function refreshMenu() {
  const btn = document.getElementById('continue-btn');
  if (btn) btn.classList.toggle('hidden', !(typeof Save !== 'undefined' && Save.hasGame()));
}

function startGame() {
  FX.ensure();           // unlock WebAudio on the click that starts the game
  if (typeof Save !== 'undefined') Save.clearGame(); // fresh game
  showScreen('game-screen');
  UI.init();
  Engine.init();
  Engine.startMorning(); // skip the ruler-reveal setup phase — go straight to Day 1
  UI.render();
}

// Resume a saved game from the menu
function continueGame() {
  FX.ensure();
  showScreen('game-screen');
  UI.init();
  if (!Engine.resume()) { startGame(); }
}

// SPACE drives the afternoon "work the room" mini-game
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    if (Engine.state && Engine.state.phase === 'afternoon' && Engine.state.activeZone) {
      e.preventDefault();
      Engine.workTask();
    }
  }
});

// Refresh menu state on first load
refreshMenu();
