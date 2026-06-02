// ============================================================
// tutorial.js — First-run guided coach-marks for Castle Chaos
// ============================================================
// A lightweight spotlight tour shown ONCE, on the player's very first
// morning. Each step dims the screen, cuts a glowing hole over a real
// UI element, and floats a tooltip beside it. Purely cosmetic overlay —
// it never touches game state, so the underlying turn waits politely.

const Tutorial = {
  steps: [
    { sel: null, title: '⚔️ Welcome, my lord!',
      body: 'Survive the nights and be the last ruler standing. Each day you trade and prepare; each night assassins strike. Quick tour!' },
    { sel: '#player-hand', title: '🃏 Your hand',
      body: 'You start with a handful of cards. Tap an <strong>item</strong> to use it. Sell a <strong>character</strong> HONESTLY for bonus coins — or bluff a pricier one.' },
    { sel: '.opponents-section', title: '🤝 Your rivals',
      body: 'Drag a character card onto a rival to offer it. If they call your bluff you lose coins — risky!' },
    { sel: '#action-area', title: '🏪 Market & 🗺️ Map',
      body: 'Open the <strong>Market</strong> any time to spend coins on buffs, assassins and rare cards. Open the <strong>Castle Map</strong> to hide your assassins in rooms.' },
    { sel: '#player-stats', title: '❤️ Your status',
      body: 'Watch your ❤️ health, 🪙 coins, 🃏 cards and 🥷 assassins. Reach 0 HP and you\'re out.' },
    { sel: null, title: "🌙 Then comes the night",
      body: 'When everyone\'s done, you choose where to sleep. Assassins hidden in your room hit for 2 HP each — choose wisely. Good luck!' },
  ],
  idx: 0,
  active: false,

  // Begin the tour if the player has never seen it. Returns true if started.
  maybeStart() {
    if (typeof Save === 'undefined' || Save.tutorialSeen()) return false;
    this.idx = 0;
    this.active = true;
    this.render();
    return true;
  },

  finish() {
    this.active = false;
    if (typeof Save !== 'undefined') Save.markTutorialSeen();
    const o = document.getElementById('tutorial-overlay');
    if (o) { o.classList.remove('show'); o.innerHTML = ''; }
  },

  next() {
    if (this.idx >= this.steps.length - 1) { this.finish(); return; }
    this.idx++;
    this.render();
  },

  render() {
    if (!this.active) return;
    const o = document.getElementById('tutorial-overlay');
    if (!o) return;
    const step = this.steps[this.idx];
    const last = this.idx === this.steps.length - 1;
    const target = step.sel && document.querySelector(step.sel);

    // Spotlight hole over the target (or a centered card when no target)
    let holeHTML = '', tipStyle = 'left:50%;top:50%;transform:translate(-50%,-50%);';
    if (target) {
      const r = target.getBoundingClientRect();
      const pad = 10;
      holeHTML = `<div class="tut-hole" style="left:${r.left - pad}px;top:${r.top - pad}px;` +
        `width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;"></div>`;
      // Place the tooltip above the target if it sits low on screen, else below
      const below = r.top < window.innerHeight * 0.5;
      const cx = Math.min(Math.max(r.left + r.width / 2, 220), window.innerWidth - 220);
      const y = below ? r.bottom + 18 : r.top - 18;
      tipStyle = `left:${cx}px;top:${y}px;transform:translate(-50%,${below ? '0' : '-100%'});`;
    }

    const dots = this.steps.map((_, i) =>
      `<span class="tut-dot${i === this.idx ? ' on' : ''}"></span>`).join('');
    o.innerHTML = holeHTML +
      `<div class="tut-tip" style="${tipStyle}">` +
        `<div class="tut-title">${step.title}</div>` +
        `<div class="tut-body">${step.body}</div>` +
        `<div class="tut-foot"><span class="tut-dots">${dots}</span>` +
          `<div class="tut-btns">` +
            (last ? '' : `<button class="tut-skip" onclick="Tutorial.finish()">Skip</button>`) +
            `<button class="tut-next" onclick="Tutorial.next()">${last ? "Let's play! ⚔️" : 'Next ▶'}</button>` +
          `</div></div>` +
      `</div>`;
    o.classList.add('show');
  },
};
