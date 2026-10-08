// ============================================================
// Player.js — класс Player (Dark / Light)
// Физика, управление, способности, анимации
// ============================================================

import { moveAndCollide, aabb } from './Collision.js';

export const PLAYER_W = 48;
export const PLAYER_H = 64;

export const GRAVITY = 2000;
export const RUN_SPEED = 300;
export const JUMP_FORCE = -850;
export const DOUBLE_JUMP_FORCE = -750;
export const DASH_SPEED = 900;
export const DASH_DURATION = 0.25;
export const DASH_COOLDOWN = 1.0;
export const FRICTION = 0.85;
export const MAX_FALL = 1200;

export class Player {
  constructor(type, x, y) {
    this.type = type; // 'dark' | 'light'
    this.x = x;
    this.y = y;
    this.w = PLAYER_W;
    this.h = PLAYER_H;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;

    // Способности
    this.canDoubleJump = (type === 'light');
    this.canDash = (type === 'dark');
    this.jumpsLeft = this.canDoubleJump ? 2 : 1;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = 1;
    this.usedDoubleJump = false;

    // Coyote time + jump buffer
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;

    // Состояние
    this.alive = true;
    this.won = false;
    this.deathTimer = 0;
    this.winTimer = 0;
    this.spawnX = x;
    this.spawnY = y;

    // Анимация
    this.animState = 'idle';
    this.animTime = 0;
    this.facing = 1;
    this.blinkPhase = 0;

    // Частицы
    this.particles = [];

    // Свечение
    this.glow = type === 'dark' ? 0.6 : 0.9;

    // Что несёт игрок (переносимый предмет)
    this.carrying = null;
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
    this.won = false;
    this.deathTimer = 0;
    this.winTimer = 0;
    this.jumpsLeft = this.canDoubleJump ? 2 : 1;
    this.usedDoubleJump = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.particles = [];
    this.carrying = null;
    this.onGround = false;
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.deathTimer = 0;
    this.carrying = null;
    for (let i = 0; i < 24; i++) {
      this.particles.push({
        x: this.x + this.w / 2,
        y: this.y + this.h / 2,
        vx: (Math.random() - 0.5) * 400,
        vy: (Math.random() - 0.5) * 400 - 100,
        life: 1.0,
        maxLife: 1.0,
        size: 2 + Math.random() * 4
      });
    }
  }

  // ============================================================
  // Обновление игрока.
  //   platforms     — статические и движущиеся платформы
  //   hazards       — ВСЕ опасные зоны (и свои, и чужие) — для проверки смерти
  //   keys          — ключи (не используется здесь, но передаётся)
  //   movableItems  — переносимые ящики (твёрдые для игрока)
  //   solidHazards  — блоки ТЬМЫ/СВЕТА, безопасные для ЭТОГО игрока.
  //                   Например, для Тьмы это блоки с type === 'dark':
  //                   они становятся твёрдыми (можно стоять), но НЕ убивают.
  // ============================================================
  update(dt, input, platforms, hazards, keys, movableItems, solidHazards) {
    // Частицы всегда
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life -= dt * 1.2;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (!this.alive) {
      this.deathTimer += dt;
      this.animState = 'death';
      return { event: null };
    }
    if (this.won) {
      this.winTimer += dt;
      this.animState = 'win';
      return { event: null };
    }

    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    // ---- Управление ----
    const left  = this.type === 'dark' ? input.isDown('KeyA') : input.isDown('ArrowLeft');
    const right = this.type === 'dark' ? input.isDown('KeyD') : input.isDown('ArrowRight');
    const jump  = this.type === 'dark' ? input.wasPressed('KeyW') : input.wasPressed('ArrowUp');
    const dash  = this.type === 'dark' ? input.wasPressed('ShiftLeft') : false;

    // ---- Coyote time / jump buffer ----
    if (this.onGround) this.coyoteTimer = 0.12;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    if (jump) this.jumpBufferTimer = 0.15;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    // ---- Dash ----
    if (this.canDash && dash && this.dashCooldown <= 0 && this.dashTimer <= 0) {
      this.dashTimer = DASH_DURATION;
      this.dashCooldown = DASH_COOLDOWN;
      this.dashDir = this.facing;
      for (let i = 0; i < 12; i++) {
        this.particles.push({
          x: this.x + this.w / 2,
          y: this.y + this.h / 2,
          vx: -this.dashDir * (100 + Math.random() * 200),
          vy: (Math.random() - 0.5) * 120,
          life: 0.4,
          maxLife: 0.4,
          size: 3 + Math.random() * 4
        });
      }
      return { event: 'dash' };
    }

    // ---- Горизонтальное движение ----
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDir * DASH_SPEED;
      this.vy = 0;
      this.animState = 'dash';
    } else {
      const accel = this.onGround ? 2600 : 1800;
      if (left && !right) {
        this.vx -= accel * dt;
        this.facing = -1;
      } else if (right && !left) {
        this.vx += accel * dt;
        this.facing = 1;
      } else {
        if (this.onGround) {
          this.vx *= Math.pow(FRICTION, dt * 60);
          if (Math.abs(this.vx) < 5) this.vx = 0;
        } else {
          this.vx *= Math.pow(0.98, dt * 60);
        }
      }
      if (this.vx > RUN_SPEED) this.vx = RUN_SPEED;
      if (this.vx < -RUN_SPEED) this.vx = -RUN_SPEED;
    }

    // ---- Прыжок (coyote time + jump buffer) ----
    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0 || this.onGround) {
        this.vy = JUMP_FORCE;
        this.jumpsLeft = this.canDoubleJump ? 1 : 0;
        this.usedDoubleJump = false;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        return { event: 'jump' };
      } else if (this.canDoubleJump && this.jumpsLeft > 0) {
        this.vy = DOUBLE_JUMP_FORCE;
        this.jumpsLeft--;
        this.usedDoubleJump = true;
        this.jumpBufferTimer = 0;
        for (let i = 0; i < 16; i++) {
          this.particles.push({
            x: this.x + this.w / 2,
            y: this.y + this.h,
            vx: (Math.random() - 0.5) * 300,
            vy: Math.random() * 200,
            life: 0.5,
            maxLife: 0.5,
            size: 3 + Math.random() * 4
          });
        }
        return { event: 'doubleJump' };
      }
    }

    // ---- Гравитация ----
    if (this.dashTimer <= 0) {
      this.vy += GRAVITY * dt;
      if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    }

    // ---- Столкновения ----
    // Собираем «твёрдые» тела:
    //   платформы + переносимые ящики + БЕЗОПАСНЫЕ для этого игрока
    //   hazard-блоки (dark для Тьмы, light для Света).
    // Чужие hazard-блоки в solids НЕ попадают — в них игрок умирает
    // (проверяется ниже через isDangerousFor).
    let solids = platforms;
    if (movableItems && movableItems.length) solids = solids.concat(movableItems);
    if (solidHazards && solidHazards.length) solids = solids.concat(solidHazards);

    moveAndCollide(this, solids, dt);

    if (this.onGround) {
      this.jumpsLeft = this.canDoubleJump ? 2 : 1;
      this.usedDoubleJump = false;
    }

    // ---- Опасные зоны (убивают только «чужие» блоки) ----
    for (const hz of hazards) {
      if (hz.isDangerousFor(this.type) && aabb(this, hz)) {
        this.kill();
        return { event: 'death' };
      }
    }

    // ---- Анимация ----
    this.animTime += dt;
    if (this.dashTimer > 0) this.animState = 'dash';
    else if (!this.onGround) this.animState = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 20) this.animState = 'run';
    else this.animState = 'idle';

    this.blinkPhase += dt * 6;

    return { event: null };
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}