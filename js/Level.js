// ============================================================
// Level.js — класс Level: загрузка, обновление логики, проверки
// ============================================================

import { Platform, Hazard } from './Platform.js';
import { Player } from './Player.js';
import { aabb } from './Collision.js';

export class Level {
  constructor(data) {
    this.data = data;
    this.index = data.index;
    this.name = data.name;
    this.width = data.width;
    this.height = data.height;
    this.targetTime = data.targetTime;

    // Сущности
    this.platforms = [];
    this.hazards = [];
    this.keys = [];
    this.doors = [];
    this.crystals = [];
    this.buttons = [];
    this.movableItems = [];
    this.enemies = [];
    this.traps = [];
    this.levers = [];
    this.goal = null;

    // Игроки
    this.players = [];
    this.spawnDark = { x: 100, y: 100 };
    this.spawnLight = { x: 200, y: 100 };

    // Состояние
    this.collectedKeys = 0;
    this.collectedCrystals = 0;
    this.totalCrystals = 0;
    this.doorOpen = false;
    this.completed = false;
    this.holdProgress = 0;
    this.leverActivated = false;

    this._build();
  }

  _build() {
    const d = this.data;

    for (const p of d.platforms || []) {
      this.platforms.push(new Platform(p));
    }

    for (const h of d.hazards || []) {
      this.hazards.push(new Hazard(h));
    }

    for (const k of d.keys || []) {
      this.keys.push({
        x: k.x, y: k.y, w: 32, h: 32,
        collected: false, id: k.id || null
      });
    }

    for (const dr of d.doors || []) {
      this.doors.push({
        x: dr.x, y: dr.y, w: 64, h: 96,
        open: false, requires: dr.requires || 1, id: dr.id || null
      });
    }

    for (const c of d.crystals || []) {
      this.crystals.push({ x: c.x, y: c.y, w: 24, h: 24, collected: false });
    }
    this.totalCrystals = this.crystals.length;

    for (const b of d.buttons || []) {
      this.buttons.push({
        x: b.x, y: b.y, w: 48, h: 16,
        pressed: false, targetId: b.targetId || null,
        color: b.color || '#c8a94a'
      });
    }

    for (const it of d.movableItems || []) {
      this.movableItems.push({
        x: it.x, y: it.y, w: 48, h: 48,
        vx: 0, vy: 0, onGround: false,
        carriedBy: null, color: it.color || '#a07a30'
      });
    }

    for (const e of d.enemies || []) {
      this.enemies.push({
        x: e.x, y: e.y, w: 48, h: 48,
        startX: e.x, endX: e.endX ?? e.x,
        speed: e.speed ?? 100,
        dir: 1,
        alive: true,
        deadly: true
      });
    }

    for (const t of d.traps || []) {
      this.traps.push({
        x: t.x, y: t.y, w: 48, h: 48,
        angle: 0, speed: t.speed ?? 2
      });
    }

    for (const l of d.levers || []) {
      this.levers.push({
        x: l.x, y: l.y, w: 32, h: 48,
        activated: false, targetId: l.targetId || null
      });
    }

    this.spawnDark = d.spawnDark || { x: 100, y: 500 };
    this.spawnLight = d.spawnLight || { x: 200, y: 500 };

    this.players = [
      new Player('dark', this.spawnDark.x, this.spawnDark.y),
      new Player('light', this.spawnLight.x, this.spawnLight.y)
    ];

    this.goal = d.goal || { x: this.width - 200, y: 100, w: 80, h: 120 };
  }

  reset() {
    for (const p of this.players) p.reset();
    for (const k of this.keys) k.collected = false;
    for (const c of this.crystals) c.collected = false;
    for (const d of this.doors) d.open = false;
    for (const b of this.buttons) b.pressed = false;
    for (const it of this.movableItems) {
      it.vx = 0; it.vy = 0; it.carriedBy = null;
    }
    for (const e of this.enemies) {
      e.x = e.startX;
      e.dir = 1;
      e.alive = true;
    }
    for (const l of this.levers) l.activated = false;
    this.collectedKeys = 0;
    this.collectedCrystals = 0;
    this.doorOpen = false;
    this.completed = false;
    this.holdProgress = 0;
    this.leverActivated = false;
  }

  // ============================================================
  // ОБНОВЛЕНИЕ УРОВНЯ
  //
  // Порядок:
  //   1) платформы двигаются
  //   2) опасные зоны
  //   3) перенос игроков движущимися платформами (до их физики)
  //   4) игроки (физика + коллизии с платформами, ящиками и «своими» блоками)
  //   5) враги, ловушки, ключи, кристаллы, кнопки, рычаги, двери, предметы, цель
  // ============================================================
  update(dt, input) {
    // 1) Платформы
    for (const p of this.platforms) p.update(dt);

    // 2) Опасные зоны
    for (const h of this.hazards) h.update(dt);

    // 3) Перенос игроков движущимися платформами
    for (const p of this.players) {
      this._carryByMovingPlatform(p);
    }

    // 4) Игроки — передаём «свои» hazard-блоки как твёрдые
    for (const p of this.players) {
      const safeHazardType = p.type === 'dark' ? 'dark' : 'light';
      const solidHazards = this.hazards.filter(h => h.type === safeHazardType);

      p.update(
        dt,
        input,
        this.platforms,
        this.hazards,        // полный список — для проверки смерти
        this.keys,
        this.movableItems,
        solidHazards         // твёрдые блоки для ЭТОГО игрока
      );
    }

    // 5) Враги
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.speed * e.dir * dt;
      if (e.x <= Math.min(e.startX, e.endX)) { e.x = Math.min(e.startX, e.endX); e.dir = 1; }
      if (e.x >= Math.max(e.startX, e.endX)) { e.x = Math.max(e.startX, e.endX); e.dir = -1; }
      for (const p of this.players) {
        if (p.alive && aabb(p, e)) p.kill();
      }
    }

    // 6) Ловушки
    for (const t of this.traps) {
      t.angle += t.speed * dt;
      for (const p of this.players) {
        if (p.alive && aabb(p, t)) p.kill();
      }
    }

    // 7) Ключи
    for (const k of this.keys) {
      if (k.collected) continue;
      for (const p of this.players) {
        if (p.alive && aabb(p, k)) {
          k.collected = true;
          this.collectedKeys++;
          break;
        }
      }
    }

    // 8) Кристаллы
    for (const c of this.crystals) {
      if (c.collected) continue;
      for (const p of this.players) {
        if (p.alive && aabb(p, c)) {
          c.collected = true;
          this.collectedCrystals++;
          break;
        }
      }
    }

    // 9) Кнопки
    for (const b of this.buttons) {
      let pressed = false;
      for (const p of this.players) {
        if (p.alive && aabb(p, b)) { pressed = true; break; }
      }
      for (const it of this.movableItems) {
        if (aabb(it, b)) { pressed = true; break; }
      }
      b.pressed = pressed;
    }

    // 10) Рычаги
    for (const l of this.levers) {
      for (const p of this.players) {
        if (p.alive && aabb(p, l) && !l.activated) {
          l.activated = true;
          this.leverActivated = true;
        }
      }
    }

    // 11) Двери
    for (const d of this.doors) {
      let shouldOpen = false;
      if (d.requires && this.collectedKeys >= d.requires) shouldOpen = true;
      if (d.id) {
        const btn = this.buttons.find(b => b.targetId === d.id);
        if (btn && btn.pressed) shouldOpen = true;
        const lev = this.levers.find(l => l.targetId === d.id);
        if (lev && lev.activated) shouldOpen = true;
      }
      d.open = shouldOpen;
    }

    // 12) Переносимые предметы
    this._updateMovableItems(dt);

    // 13) Проверка цели
    this._checkGoal();
  }

  // ============================================================
  // ПЕРЕНОС ИГРОКА ДВИЖУЩЕЙСЯ ПЛАТФОРМОЙ
  // ============================================================
  _carryByMovingPlatform(player) {
    if (!player.alive) return;
    if (player.dashTimer > 0) return;

    for (const p of this.platforms) {
      if (p.type === 'static') continue;

      const feetY = player.y + player.h;
      const onTop = Math.abs(feetY - p.y) <= 8;
      const overlapX = (player.x + player.w > p.x + 2) && (player.x < p.x + p.w - 2);
      const notJumpingUp = player.vy >= -30;

      if (onTop && overlapX && notJumpingUp) {
        const delta = p.getDelta();
        player.x += delta.dx;
        player.y += delta.dy;
        player.y = p.y - player.h;
        if (player.vy > 0) player.vy = 0;
        player.onGround = true;
      }
    }
  }

  // ============================================================
  // ФИЗИКА ПЕРЕНОСИМЫХ ПРЕДМЕТОВ
  //  - гравитация
  //  - коллизии с платформами
  //  - коллизии с игроками (двусторонние)
  //  - игрок может толкать ящик
  // ============================================================
  _updateMovableItems(dt) {
    for (const it of this.movableItems) {
      // Несёт игрок — привязка над головой
      if (it.carriedBy) {
        const p = it.carriedBy;
        it.x = p.x + p.w / 2 - it.w / 2;
        it.y = p.y - it.h - 4;
        continue;
      }

      // Гравитация
      it.vy += 2000 * dt;
      if (it.vy > 1200) it.vy = 1200;

      // --- По X ---
      it.x += it.vx * dt;

      // Столкновения с платформами по X
      for (const p of this.platforms) {
        if (!aabb(it, p)) continue;
        const inter = Math.min((it.x + it.w) - p.x, (p.x + p.w) - it.x);
        if (it.x + it.w / 2 < p.x + p.w / 2) it.x -= inter;
        else it.x += inter;
        it.vx = 0;
      }

      // Столкновения с игроками по X — расталкивание
      for (const pl of this.players) {
        if (!pl.alive) continue;
        if (!aabb(it, pl)) continue;
        const inter = Math.min((it.x + it.w) - pl.x, (pl.x + pl.w) - it.x);
        if (pl.x + pl.w / 2 < it.x + it.w / 2) {
          pl.x -= inter;
          if (pl.vx > 0) pl.vx = 0;
        } else {
          pl.x += inter;
          if (pl.vx < 0) pl.vx = 0;
        }
      }

      // --- По Y ---
      it.y += it.vy * dt;
      it.onGround = false;

      // Столкновения с платформами по Y
      for (const p of this.platforms) {
        if (!aabb(it, p)) continue;
        if (it.vy > 0) {
          it.y = p.y - it.h;
          it.vy = 0;
          it.onGround = true;
        } else if (it.vy < 0) {
          it.y = p.y + p.h;
          it.vy = 0;
        }
      }

      // Столкновения с игроками по Y
      for (const pl of this.players) {
        if (!pl.alive) continue;
        if (!aabb(it, pl)) continue;

        const itBottom = it.y + it.h;
        const plBottom = pl.y + pl.h;

        // Ящик падает сверху на игрока — останавливается на голове
        if (it.vy > 0 && itBottom - pl.y < it.h / 2) {
          it.y = pl.y - it.h;
          it.vy = 0;
          it.onGround = true;
        }
        // Игрок падает сверху на ящик — встаёт на ящик
        else if (pl.vy > 0 && plBottom - it.y < pl.h / 2) {
          pl.y = it.y - pl.h;
          pl.vy = 0;
          pl.onGround = true;
        }
        // Иначе — выталкивание по меньшей стороне
        else {
          const overlapTop = plBottom - it.y;
          const overlapBottom = itBottom - pl.y;
          if (overlapTop < overlapBottom) {
            pl.y = it.y - pl.h;
            pl.vy = 0;
            pl.onGround = true;
          } else {
            it.y = plBottom;
            it.vy = 0;
          }
        }
      }

      // --- Толкание ящика игроком ---
      for (const pl of this.players) {
        if (!pl.alive) continue;
        const plRect = pl.getRect();
        const expanded = {
          x: plRect.x - 4,
          y: plRect.y + 4,
          w: plRect.w + 8,
          h: plRect.h - 8
        };
        if (!aabb(expanded, it)) continue;

        if (pl.vx > 0 && plRect.x + plRect.w <= it.x + 8) {
          it.x += pl.vx * dt;
          it.vx = pl.vx;
        } else if (pl.vx < 0 && plRect.x >= it.x + it.w - 8) {
          it.x += pl.vx * dt;
          it.vx = pl.vx;
        }
      }
    }
  }

  tryPickup(player) {
    if (player.carrying) {
      const it = player.carrying;
      it.carriedBy = null;
      it.vx = player.facing * 300;
      it.vy = -200;
      player.carrying = null;
      return { event: 'drop' };
    }
    for (const it of this.movableItems) {
      if (it.carriedBy) continue;
      if (aabb(player, it)) {
        it.carriedBy = player;
        player.carrying = it;
        return { event: 'pickup' };
      }
    }
    return { event: null };
  }

  _checkGoal() {
    const playersAtGoal = this.players.every(p =>
      p.alive && aabb(p, this.goal)
    );
    if (playersAtGoal) {
      this.completed = true;
      for (const p of this.players) p.won = true;
    }
  }

  getStars(time, crystals, totalCrystals) {
    let stars = 0;
    if (time <= this.targetTime) stars++;
    if (time <= this.targetTime * 0.8) stars++;
    if (crystals >= totalCrystals && totalCrystals > 0) stars++;
    if (stars === 0) stars = 1;
    return Math.min(3, stars);
  }
}