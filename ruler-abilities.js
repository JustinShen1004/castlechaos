// ============================================================
// ruler-abilities.js — Signature ruler ABILITIES (golden cards)
// ============================================================
// Each ruler has ONE active ability (see RULER_ABILITIES in data.js). It is
// a shiny golden card that appears in hand only AFTER Night 2 (Day 3+), then
// recharges on a fixed cooldown (ABILITY_COOLDOWN days). Using it spends a
// play, exactly like a normal card.
//   🔮 Witch    — Magic Cauldron : 2 skeletons strike a rival (shield backlash)
//   🪨 Giant    — Titan's Endurance : heal last night's damage + brace
//   🛡️ Sentinel — Aegis Bulwark : raise a 60% block for the coming night

Object.assign(Engine, {
  // The ability definition for a given player's ruler (or null)
  abilityFor(player) {
    if (!player || !player.ruler) return null;
    return RULER_ABILITIES[player.ruler.ability] || null;
  },

  // Is this player's ability available to use right now?
  // Rules: game must be past Night 2 (day >= ABILITY_UNLOCK_DAY), and the
  // ability must be off cooldown (never used, or used >= COOLDOWN days ago).
  abilityReady(player) {
    if (!this.abilityFor(player)) return false;
    if (this.state.day < ABILITY_UNLOCK_DAY) return false;
    if (player.abilityUsedDay == null) return true;
    return (this.state.day - player.abilityUsedDay) >= ABILITY_COOLDOWN;
  },

  // Days remaining until the ability recharges (0 = ready), for UI hints
  abilityCooldownLeft(player) {
    if (player.abilityUsedDay == null) return 0;
    return Math.max(0, ABILITY_COOLDOWN - (this.state.day - player.abilityUsedDay));
  },

  // --- HUMAN: tapped the golden ability card in hand ---
  useAbility() {
    if (!this.canAct() || !this.isHumanTurn()) return;
    const me = this.human();
    const ab = this.abilityFor(me);
    if (!ab || !this.abilityReady(me)) { this.notify('✨ Your ability isn\'t ready yet.', 'warn'); return; }

    // Targeted abilities (Witch) ask for a victim first
    if (ab.targeted) {
      this.state.pendingAbility = { id: ab.id };
      this.notify(`${ab.icon} Choose a rival to unleash ${ab.name} on.`, 'info');
      UI.render();
      return;
    }
    this.resolveAbility(me, ab, null);
  },

  // Human picked a rival for a targeted ability (Witch)
  useAbilityOn(targetId) {
    const pa = this.state.pendingAbility;
    if (!pa) return;
    const me = this.human();
    const ab = this.abilityFor(me);
    const target = this.state.players.find(p => p.id === targetId);
    if (!ab || !target || target.dead || target === me) return;
    this.state.pendingAbility = null;
    this.resolveAbility(me, ab, target);
  },

  cancelAbility() {
    this.state.pendingAbility = null;
    UI.render();
  },

  // Apply an ability, mark its cooldown, then spend a play (if it's the
  // human's day-turn) or just repaint (AI / off-turn).
  resolveAbility(caster, ability, target) {
    caster.abilityUsedDay = this.state.day;
    if (ability.id === 'magic_cauldron')      this.castMagicCauldron(caster, target);
    else if (ability.id === 'titan_endurance') this.castTitanEndurance(caster);
    else if (ability.id === 'aegis_bulwark')   this.castAegisBulwark(caster);
    this.checkDeath(caster);
    this.alive().forEach(p => this.checkDeath(p));
    if (this.checkWin && this.checkWin()) return;
    if (this.state.phase === 'day' && caster === this.human() && this.isHumanTurn()) {
      this.consumePlay();
    } else {
      UI.render();
    }
  },

  // ============================================================
  // 🔮 WITCH — MAGIC CAULDRON
  // Summon 2 skeleton soldiers; each strikes the chosen rival for 2.
  // BUT if that rival had a shield up (played prior), the skeletons are
  // blocked — and one of them turns on the Witch for 2 backlash damage.
  // ============================================================
  castMagicCauldron(witch, target) {
    const witchHuman = witch === this.human();
    const targetHuman = target === this.human();
    FX.sound('poison'); FX.burst('💀', 10);
    if (witchHuman) FX.float('🔮 MAGIC CAULDRON', '#b46bff');

    if (target.shieldChance > 0) {
      // Shield played first → skeletons blocked; one rebounds on the Witch.
      target.shieldChance = 0; // the shield is shattered absorbing them
      witch.health -= 2;
      this.notify(
        `🔮 MAGIC CAULDRON! ${target.name}'s shield blocked the 2 skeletons — one turned on ` +
        `${witchHuman ? 'YOU' : witch.name} for 💀 −2 HP!`,
        witchHuman ? 'bad' : (targetHuman ? 'good' : 'info'));
      if (witchHuman) FX.event('damage');
      else if (targetHuman) FX.event('shield');
    } else {
      // No shield → both skeletons land for 2 each (4 total).
      target.health -= 4;
      this.notify(
        `🔮 MAGIC CAULDRON! 2 skeleton soldiers struck ${targetHuman ? 'YOU' : target.name} ` +
        `for 💀 −4 HP!`,
        targetHuman ? 'bad' : (witchHuman ? 'good' : 'info'));
      if (targetHuman) FX.event('damage');
      else if (witchHuman) FX.float('💀 −4!', '#b46bff');
    }
  },

  // ============================================================
  // 🪨 GIANT — TITAN'S ENDURANCE
  // Tank: recover ALL HP lost to last night's attacks (never above max),
  // then brace for a 50% block on the coming night.
  // ============================================================
  castTitanEndurance(giant) {
    const isMe = giant === this.human();
    const healed = Math.max(0, giant.lastNightDamage || 0);
    if (healed > 0) {
      giant.health = Math.min(giant.maxHealth, giant.health + healed);
      giant.lastNightDamage = 0;
    }
    this.giveShield(giant, 0.5);
    FX.sound('shield'); FX.burst('🪨', 8);
    if (isMe) { FX.event('heal'); FX.float("🪨 TITAN'S ENDURANCE", '#c8a060'); }
    this.notify(
      `🪨 TITAN'S ENDURANCE! ${isMe ? 'You tank' : giant.name + ' tanks'} ` +
      `${healed > 0 ? `back +${healed} HP from last night` : 'in — no damage to recover'} ` +
      `and braces for a 50% block tonight.`,
      isMe ? 'good' : 'info');
  },

  // ============================================================
  // 🛡️ SENTINEL — AEGIS BULWARK
  // Raise a towering shield: 60% chance to block an assassin this night.
  // ============================================================
  castAegisBulwark(sentinel) {
    const isMe = sentinel === this.human();
    this.giveShield(sentinel, 0.6);
    FX.sound('shield'); FX.burst('🛡️', 8);
    if (isMe) { FX.event('shield'); FX.float('🛡️ AEGIS BULWARK', '#6bb6ff'); }
    this.notify(
      `🛡️ AEGIS BULWARK! ${isMe ? 'You raise' : sentinel.name + ' raises'} a towering shield — ` +
      `60% to block an assassin tonight.`,
      isMe ? 'good' : 'info');
  },

  // ============================================================
  // AI: a bot fires its ability when it makes sense. Returns true if used.
  // Called from aiTakeTurn before the bot's normal item/trade logic.
  // ============================================================
  aiMaybeUseAbility(ai) {
    if (!this.abilityReady(ai)) return false;
    const ab = this.abilityFor(ai);
    if (!ab) return false;
    if (ab.id === 'magic_cauldron') {
      // Strike the most wounded living rival (prefer one without a shield)
      const rivals = this.alive().filter(p => p !== ai);
      if (!rivals.length) return false;
      rivals.sort((a, b) => (a.shieldChance - b.shieldChance) || (a.health - b.health));
      if (Math.random() < 0.7) { this.resolveAbility(ai, ab, rivals[0]); return true; }
      return false;
    }
    if (ab.id === 'titan_endurance') {
      if ((ai.lastNightDamage || 0) >= 2 || ai.health <= ai.maxHealth - 4) {
        this.resolveAbility(ai, ab, null); return true;
      }
      return false;
    }
    if (ab.id === 'aegis_bulwark') {
      if (ai.shieldChance < 0.6 && Math.random() < 0.6) { this.resolveAbility(ai, ab, null); return true; }
      return false;
    }
    return false;
  },
});
