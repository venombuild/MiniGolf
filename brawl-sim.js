(function (global) {
  const BALL_R = 18;
  const ARENA_R = 150;
  const CENTER = 170;
  const BALL_SPEED = 165;
  const SHIELD_R = 13;
  const HAMMER_R = 15;
  const PROJECTILE_SPEED = 210;
  const HAMMER_SPEED = 220;
  const HAMMER_MIN_OUTBOUND_TIME = 0.42;
  const MAX_BATTLE_TIME = 120;
  const DT = 0.033;

  const HEROES = {
    ironman: {
      id: "ironman", name: "Iron Man", abbr: "IM", color: "#c41e2a", hp: 100,
      power: { type: "beam", name: "Unibeam", damage: 12, range: 140, interval: 3.2, windup: 0.5 }
    },
    cap: {
      id: "cap", name: "Captain America", abbr: "CA", color: "#1e4a8c", hp: 115,
      power: {
        type: "shield", name: "Shield Throw", interval: 4.5, windup: 0.35,
        shieldDamage: 6, shieldLife: 2.6, damageReduction: 0.5, buffTime: 5
      }
    },
    thor: {
      id: "thor", name: "Thor", abbr: "TH", color: "#6b4ce6", hp: 105,
      power: {
        type: "hammer", name: "Mjolnir", interval: 4.0,
        meleeDamage: 7, meleeInterval: 1.6,
        hammerDamage: 11, boomerangRange: 180,
        wallSlamDamage: 6, returnImpactDamage: 8
      }
    },
    hulk: {
      id: "hulk", name: "Hulk", abbr: "HK", color: "#3d8b37", hp: 135,
      power: { type: "touch", name: "Smash", damage: 18, interval: 3.8 }
    }
  };

  let S = null;

  function getHeroDef(id) { return HEROES[id]; }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function isFrozen(fighter) {
    return fighter.windup || fighter.recover > 0;
  }

  function hasProjectile(owner, type) {
    return S.projectiles.some((p) => p.owner === owner && p.type === type);
  }

  function randomVelocity() {
    const angle = Math.random() * Math.PI * 2;
    return { vx: Math.cos(angle) * BALL_SPEED, vy: Math.sin(angle) * BALL_SPEED };
  }

  function resolveProjectileWall(proj, speed) {
    if (speed == null) speed = PROJECTILE_SPEED;
    const dx = proj.x - CENTER;
    const dy = proj.y - CENTER;
    const d = Math.sqrt(dx * dx + dy * dy);
    const maxD = ARENA_R - proj.r;

    if (d > maxD && d > 0) {
      const nx = dx / d;
      const ny = dy / d;
      proj.x = CENTER + nx * maxD;
      proj.y = CENTER + ny * maxD;
      const dot = proj.vx * nx + proj.vy * ny;
      proj.vx -= 2 * dot * nx;
      proj.vy -= 2 * dot * ny;
      const mag = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy) || 1;
      proj.vx = (proj.vx / mag) * speed;
      proj.vy = (proj.vy / mag) * speed;
    }
  }

  function finishBattle(winner) {
    S.winner = winner;
    S.running = false;
  }

  function dealDamage(attacker, defender, amount) {
    if (!S.running || defender.hp <= 0) return;

    let damage = amount;

    if (defender.shieldBuff && defender.shieldBuff.until > S.elapsed) {
      damage = Math.round(damage * (1 - defender.shieldBuff.reduction));
    }

    if (defender.shield > 0) {
      const blocked = Math.min(defender.shield, damage);
      damage -= blocked;
      defender.shield -= blocked;
    }

    defender.hp = Math.max(0, defender.hp - damage);
    if (defender.hp <= 0) finishBattle(attacker);
  }

  function catchShield(fighter, proj) {
    const power = getHeroDef(fighter.heroId).power;
    fighter.shieldBuff = {
      reduction: power.damageReduction,
      until: S.elapsed + power.buffTime
    };
    fighter.powerTimer = 0;
    S.projectiles = S.projectiles.filter((p) => p !== proj);
  }

  function launchShield(fighter, target) {
    const dx = target.x - fighter.x;
    const dy = target.y - fighter.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const power = getHeroDef(fighter.heroId).power;

    S.projectiles.push({
      type: "shield",
      owner: fighter,
      x: fighter.x,
      y: fighter.y,
      vx: (dx / d) * PROJECTILE_SPEED,
      vy: (dy / d) * PROJECTILE_SPEED,
      r: SHIELD_R,
      life: power.shieldLife,
      returning: false,
      hitCd: 0
    });
  }

  function launchHammer(fighter, target) {
    const dx = target.x - fighter.x;
    const dy = target.y - fighter.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;

    S.projectiles.push({
      type: "hammer",
      owner: fighter,
      x: fighter.x,
      y: fighter.y,
      vx: (dx / d) * HAMMER_SPEED,
      vy: (dy / d) * HAMMER_SPEED,
      r: HAMMER_R,
      phase: "outbound",
      life: 0,
      hitCd: 0,
      wallHitCd: 0,
      returnHitCd: 0,
      grabbed: null
    });
    fighter.powerTimer = 0;
  }

  function catchHammer(fighter, proj) {
    if (proj.grabbed) {
      proj.grabbed.grabbedBy = null;
      proj.grabbed = null;
    }
    S.projectiles = S.projectiles.filter((p) => p !== proj);
  }

  function resolveCircleWall(ball) {
    const dx = ball.x - CENTER;
    const dy = ball.y - CENTER;
    const d = Math.sqrt(dx * dx + dy * dy);
    const maxD = ARENA_R - BALL_R;

    if (d > maxD && d > 0) {
      const nx = dx / d;
      const ny = dy / d;
      ball.x = CENTER + nx * maxD;
      ball.y = CENTER + ny * maxD;
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
      ball.vx = (ball.vx / speed) * BALL_SPEED;
      ball.vy = (ball.vy / speed) * BALL_SPEED;
    }
  }

  function updateGrabbedFighter(proj, dt) {
    if (!proj.grabbed || proj.grabbed.hp <= 0) return;
    const f = proj.grabbed;
    const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy) || 1;
    const nx = proj.vx / speed;
    const ny = proj.vy / speed;
    const anchorX = proj.x - nx * (BALL_R + proj.r - 4);
    const anchorY = proj.y - ny * (BALL_R + proj.r - 4);
    const pull = Math.min(1, 20 * dt);
    f.x += (anchorX - f.x) * pull;
    f.y += (anchorY - f.y) * pull;
    f.vx = proj.vx * 0.55;
    f.vy = proj.vy * 0.55;
    f.grabbedBy = proj;
    resolveCircleWall(f);
  }

  function updateProjectiles(dt) {
    S.projectiles.forEach((proj) => {
      if (proj.type === "shield") {
        proj.hitCd = Math.max(0, proj.hitCd - dt);

        if (proj.returning) {
          const owner = proj.owner;
          const dx = owner.x - proj.x;
          const dy = owner.y - proj.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          proj.vx = (dx / d) * PROJECTILE_SPEED * 1.3;
          proj.vy = (dy / d) * PROJECTILE_SPEED * 1.3;
          if (d < BALL_R + SHIELD_R + 4) {
            catchShield(owner, proj);
            return;
          }
        } else {
          proj.life -= dt;
          if (proj.life <= 0) proj.returning = true;
        }

        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        if (!proj.returning) resolveProjectileWall(proj);

        S.fighters.forEach((f) => {
          if (f === proj.owner || f.hp <= 0 || proj.hitCd > 0) return;
          if (dist(proj, f) <= proj.r + BALL_R) {
            const power = getHeroDef(proj.owner.heroId).power;
            dealDamage(proj.owner, f, power.shieldDamage);
            proj.hitCd = 0.45;
          }
        });
      }

      if (proj.type === "hammer") {
        proj.hitCd = Math.max(0, proj.hitCd - dt);
        proj.wallHitCd = Math.max(0, proj.wallHitCd - dt);
        proj.returnHitCd = Math.max(0, proj.returnHitCd - dt);
        proj.life += dt;
        const owner = proj.owner;
        if (!owner || owner.hp <= 0) return;

        const power = getHeroDef(owner.heroId).power;

        if (proj.phase === "returning") {
          const dx = owner.x - proj.x;
          const dy = owner.y - proj.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          proj.vx = (dx / d) * HAMMER_SPEED;
          proj.vy = (dy / d) * HAMMER_SPEED;
        }

        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        if (proj.phase === "outbound") {
          resolveProjectileWall(proj, HAMMER_SPEED);
          if (dist(proj, owner) >= power.boomerangRange && proj.life >= HAMMER_MIN_OUTBOUND_TIME) {
            proj.phase = "returning";
          }
        }

        updateGrabbedFighter(proj, dt);

        if (proj.grabbed && proj.grabbed.hp > 0) {
          const g = proj.grabbed;
          const centerDist = Math.sqrt((g.x - CENTER) * (g.x - CENTER) + (g.y - CENTER) * (g.y - CENTER));
          const atWall = centerDist >= ARENA_R - BALL_R - 0.5;

          if (atWall && proj.wallHitCd <= 0) {
            dealDamage(owner, g, power.wallSlamDamage);
            proj.wallHitCd = 0.35;
          }

          if (proj.phase === "returning" && dist(owner, g) <= BALL_R * 2 + 1 && proj.returnHitCd <= 0) {
            dealDamage(owner, g, power.returnImpactDamage);
            proj.returnHitCd = 0.45;
          }
        }

        if (proj.phase === "returning" && dist(proj, owner) < BALL_R + HAMMER_R + 6) {
          catchHammer(owner, proj);
          return;
        }

        S.fighters.forEach((f) => {
          if (f === owner || f.hp <= 0 || proj.hitCd > 0 || f.grabbedBy) return;
          if (dist(proj, f) <= proj.r + BALL_R) {
            dealDamage(owner, f, power.hammerDamage);
            proj.grabbed = f;
            f.grabbedBy = proj;
            proj.hitCd = 0.35;
          }
        });
      }
    });

    S.projectiles = S.projectiles.filter((p) => {
      if (p.type === "shield" && p.returning && p.owner.hp <= 0) return false;
      return true;
    });
  }

  function tryTouchPowers(a, b) {
    [[a, b], [b, a]].forEach(([attacker, defender]) => {
      if (isFrozen(attacker) || defender.hp <= 0) return;
      const power = getHeroDef(attacker.heroId).power;
      const holdingHammer = attacker.heroId !== "thor" || !hasProjectile(attacker, "hammer");

      if (power.type === "touch" && attacker.powerTimer >= power.interval) {
        dealDamage(attacker, defender, power.damage);
        attacker.powerTimer = 0;
        return;
      }

      if (power.meleeDamage && holdingHammer && attacker.meleeTimer >= power.meleeInterval) {
        dealDamage(attacker, defender, power.meleeDamage);
        attacker.meleeTimer = 0;
      }
    });
  }

  function resolveBallCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const minD = BALL_R * 2;
    let touched = false;

    if (d < minD && d > 0) {
      touched = true;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = minD - d;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      if (a.grabbedBy || b.grabbedBy) return;

      if (!isFrozen(a) && !isFrozen(b)) {
        const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (dvn > 0) {
          a.vx -= dvn * nx;
          a.vy -= dvn * ny;
          b.vx += dvn * nx;
          b.vy += dvn * ny;
        }

        const sa = Math.sqrt(a.vx * a.vx + a.vy * a.vy) || 1;
        const sb = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
        a.vx = (a.vx / sa) * BALL_SPEED;
        a.vy = (a.vy / sa) * BALL_SPEED;
        b.vx = (b.vx / sb) * BALL_SPEED;
        b.vy = (b.vy / sb) * BALL_SPEED;
      }
    }

    if (touched) tryTouchPowers(a, b);
  }

  function canStartBeam(attacker, defender) {
    const p = getHeroDef(attacker.heroId).power;
    return p.type === "beam" && dist(attacker, defender) <= p.range;
  }

  function canThrowShield(fighter) {
    if (hasProjectile(fighter, "shield")) return false;
    if (fighter.shieldBuff && fighter.shieldBuff.until > S.elapsed) return false;
    return true;
  }

  function startWindup(attacker, defender, kind) {
    attacker.savedVx = attacker.vx;
    attacker.savedVy = attacker.vy;
    attacker.vx = 0;
    attacker.vy = 0;
    const power = getHeroDef(attacker.heroId).power;
    attacker.windup = {
      kind: kind || power.type,
      defender,
      timeLeft: power.windup || 0.35
    };
  }

  function fireBeam(attacker, defender) {
    const power = getHeroDef(attacker.heroId).power;
    dealDamage(attacker, defender, power.damage);
    attacker.powerTimer = 0;
  }

  function updateFighterAction(fighter, dt) {
    if (fighter.windup) {
      fighter.windup.timeLeft -= dt;
      if (fighter.windup.timeLeft <= 0) {
        const target = fighter.windup.defender;
        const kind = fighter.windup.kind;
        fighter.windup = null;

        if (S.running && target && target.hp > 0) {
          if (kind === "beam") fireBeam(fighter, target);
          else if (kind === "shield") launchShield(fighter, target);
        }
        fighter.recover = 0.25;
      }
      return;
    }

    if (fighter.recover > 0) {
      fighter.recover -= dt;
      if (fighter.recover <= 0) {
        const sx = fighter.savedVx || 0;
        const sy = fighter.savedVy || 0;
        const speed = Math.sqrt(sx * sx + sy * sy);
        if (speed < 10) {
          const v = randomVelocity();
          fighter.vx = v.vx;
          fighter.vy = v.vy;
        } else {
          fighter.vx = (sx / speed) * BALL_SPEED;
          fighter.vy = (sy / speed) * BALL_SPEED;
        }
      }
    }
  }

  function battleStep(dt) {
    if (!S.running) return;

    S.elapsed += dt;
    const f1 = S.fighters[0];
    const f2 = S.fighters[1];

    [f1, f2].forEach((fighter) => updateFighterAction(fighter, dt));
    if (!S.running) return;

    [f1, f2].forEach((ball) => {
      if (isFrozen(ball) || ball.grabbedBy) return;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      resolveCircleWall(ball);
    });
    resolveBallCollision(f1, f2);
    if (!S.running) return;

    updateProjectiles(dt);
    if (!S.running) return;

    [f1, f2].forEach((fighter) => {
      if (isFrozen(fighter)) return;
      const opponent = fighter === f1 ? f2 : f1;
      const power = getHeroDef(fighter.heroId).power;
      fighter.powerTimer += dt;
      if (power.meleeInterval) fighter.meleeTimer += dt;

      if (power.type === "beam" && fighter.powerTimer >= power.interval && canStartBeam(fighter, opponent)) {
        startWindup(fighter, opponent, "beam");
      }

      if (power.type === "shield" && fighter.powerTimer >= power.interval && canThrowShield(fighter)) {
        startWindup(fighter, opponent, "shield");
      }

      if (power.type === "hammer" && fighter.powerTimer >= power.interval && !hasProjectile(fighter, "hammer")) {
        launchHammer(fighter, opponent);
      }
    });
  }

  function makeFighter(player, heroId) {
    const hero = getHeroDef(heroId);
    const v = randomVelocity();
    return {
      player,
      heroId,
      hp: hero.hp,
      maxHp: hero.hp,
      x: player === 1 ? CENTER - 65 : CENTER + 65,
      y: player === 1 ? CENTER - 40 : CENTER + 40,
      vx: v.vx,
      vy: v.vy,
      powerTimer: hero.power.interval * 0.5,
      meleeTimer: 0,
      shield: 0,
      shieldBuff: null,
      grabbedBy: null,
      windup: null,
      recover: 0,
      savedVx: 0,
      savedVy: 0
    };
  }

  function simBattle(p1HeroId, p2HeroId) {
    S = {
      running: true,
      elapsed: 0,
      winner: null,
      fighters: [makeFighter(1, p1HeroId), makeFighter(2, p2HeroId)],
      projectiles: []
    };

    while (S.running && S.elapsed < MAX_BATTLE_TIME) {
      battleStep(DT);
    }

    if (S.running) {
      const f1 = S.fighters[0];
      const f2 = S.fighters[1];
      if (f1.hp > f2.hp) S.winner = f1;
      else if (f2.hp > f1.hp) S.winner = f2;
    }

    const result = {
      winnerId: S.winner ? S.winner.heroId : null,
      p1HeroId,
      p2HeroId,
      elapsed: S.elapsed,
      timedOut: !S.winner
    };
    S = null;
    return result;
  }

  function pickRandomHero(excludeId) {
    const ids = Object.keys(HEROES);
    let pick = ids[Math.floor(Math.random() * ids.length)];
    while (pick === excludeId) pick = ids[Math.floor(Math.random() * ids.length)];
    return pick;
  }

  function runBatch(count) {
    const wins = {};
    Object.keys(HEROES).forEach((id) => { wins[id] = 0; });
    let timeouts = 0;
    const start = performance.now();

    for (let i = 0; i < count; i += 1) {
      const p1 = pickRandomHero(null);
      const p2 = pickRandomHero(p1);
      const result = simBattle(p1, p2);
      if (result.winnerId) wins[result.winnerId] += 1;
      else timeouts += 1;
    }

    return {
      count,
      wins,
      timeouts,
      elapsedMs: Math.round(performance.now() - start)
    };
  }

  function runBatchAsync(count, onProgress) {
    return new Promise(function (resolve) {
      const wins = {};
      Object.keys(HEROES).forEach((id) => { wins[id] = 0; });
      let timeouts = 0;
      let done = 0;
      const start = performance.now();
      const chunk = 5;

      function step() {
        const end = Math.min(done + chunk, count);
        while (done < end) {
          const p1 = pickRandomHero(null);
          const p2 = pickRandomHero(p1);
          const result = simBattle(p1, p2);
          if (result.winnerId) wins[result.winnerId] += 1;
          else timeouts += 1;
          done += 1;
        }

        if (onProgress) onProgress(done, count);

        if (done >= count) {
          resolve({
            count,
            wins,
            timeouts,
            elapsedMs: Math.round(performance.now() - start)
          });
          return;
        }

        setTimeout(step, 0);
      }

      step();
    });
  }

  global.BrawlSim = {
    HEROES,
    simBattle,
    runBatch,
    runBatchAsync
  };
})(typeof window !== "undefined" ? window : globalThis);
