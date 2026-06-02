// ============================================================
// game.js — Screen routing & input for Castle Chaos
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showMenu()  { showScreen('menu-screen'); refreshMenu(); }
function showHowTo() { showScreen('howto-screen'); }
function showWhatsNew() { showScreen('whatsnew-screen'); }
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
  UI._setupTimer = null; // allow the ruler-reveal auto-advance to fire again
  Engine.init();         // shows the ruler-reveal setup, which auto-advances to Day 1
  UI.render();
}

// Resume a saved game from the menu
function continueGame() {
  FX.ensure();
  showScreen('game-screen');
  UI.init();
  if (!Engine.resume()) { startGame(); }
}

// Refresh menu state on first load
refreshMenu();
