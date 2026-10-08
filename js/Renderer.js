// ============================================================
// Renderer.js — отрисовка сцены, HUD, эффектов
// ============================================================

export class Renderer {
  constructor(canvas, textureLoader) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.textures = textureLoader;

    // Фоновые частицы (для меню и уровней)
    this.bgParticles = [];
    for (let i = 0; i < 80; i++) {
      this.bgParticles.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        size: 1 + Math.random() * 3,
        alpha: 0.2 + Math.random() * 0.5,
        hue: Math.random() < 0.5 ? 45 : 270,
      });
    }
    this.time = 0;
  }

  // ---------- Очистка ----------
  clear(color = '#000000') {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  // ---------- Фон ----------
  drawBackground(dt = 0.016) {
    this.time += dt;
    // Градиент — тьма слева, свет справа
    const grd = this.ctx.createLinearGradient(0, 0, this.W, this.H);
    grd.addColorStop(0, '#0a0410');
    grd.addColorStop(0.5, '#100820');
    grd.addColorStop(1, '#1a1020');
    this.ctx.fillStyle = grd;
    this.ctx.fillRect(0, 0, this.W, this.H);

    // Частицы
    for (const p of this.bgParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) p.x = this.W;
      if (p.x > this.W) p.x = 0;
      if (p.y < 0) p.y = this.H;
      if (p.y > this.H) p.y = 0;
      this.ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(this.time * 2 + p.x));
      this.ctx.fillStyle = p.hue === 45 ? '#ffe080' : '#8060ff';
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  // ---------- Уровень ----------
  drawLevel(level, camera) {
    camera.apply(this.ctx);
    this.ctx.save();

    // Опасные зоны
    for (const h of level.hazards) {
      this._drawHazard(h);
    }

    // Платформы
    for (const p of level.platforms) {
      this._drawPlatform(p);
    }

    // Кнопки
    for (const b of level.buttons) {
      this._drawButton(b);
    }

    // Рычаги
    for (const l of level.levers) {
      this._drawLever(l);
    }

    // Переносимые предметы
    for (const it of level.movableItems) {
      this._drawMovableItem(it);
    }

    // Ключи
    for (const k of level.keys) {
      if (k.collected) continue;
      this._drawKey(k);
    }

    // Кристаллы
    for (const c of level.crystals) {
      if (c.collected) continue;
      this._drawCrystal(c);
    }

    // Двери
    for (const d of level.doors) {
      this._drawDoor(d);
    }

    // Цель
    this._drawGoal(level.goal);

    // Враги
    for (const e of level.enemies) {
      if (!e.alive) continue;
      this._drawEnemy(e);
    }

    // Ловушки
    for (const t of level.traps) {
      this._drawTrap(t);
    }

    // Игроки
    for (const p of level.players) {
      this._drawPlayer(p);
    }

    this.ctx.restore();
    camera.restore(this.ctx);
  }

  _drawPlatform(p) {
    // Текстура платформы
    const img = this.textures.get('platform');
    if (img) {
      // Тайлинг
      const cols = Math.ceil(p.w / 64);
      const rows = Math.ceil(p.h / 64);
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const dw = Math.min(64, p.w - cx * 64);
          const dh = Math.min(64, p.h - cy * 64);
          this.ctx.drawImage(img, 0, 0, dw, dh, p.x + cx * 64, p.y + cy * 64, dw, dh);
        }
      }
    } else {
      // Программная отрисовка
      const grd = this.ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      if (p.type === 'elevator') {
        grd.addColorStop(0, '#6a5a9a');
        grd.addColorStop(1, '#2a1a4a');
      } else if (p.type === 'moving') {
        grd.addColorStop(0, '#7a6aaa');
        grd.addColorStop(1, '#3a2a5a');
      } else {
        grd.addColorStop(0, '#4a4a6a');
        grd.addColorStop(1, '#1a1a2a');
      }
      this.ctx.fillStyle = grd;
      this.ctx.fillRect(p.x, p.y, p.w, p.h);
      // Контур со свечением
      this.ctx.strokeStyle = p.type === 'static' ? 'rgba(120,120,180,0.5)' : 'rgba(160,140,220,0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    }
  }

  _drawHazard(h) {
    const img = this.textures.get('hazard_' + h.type) || this.textures.get('hazard');
    if (img) {
      this.ctx.drawImage(img, h.x, h.y, h.w, h.h);
      return;
    }
    if (h.type === 'spike') {
      // Шипы
      this.ctx.fillStyle = '#5a2020';
      this.ctx.fillRect(h.x, h.y + h.h * 0.5, h.w, h.h * 0.5);
      this.ctx.fillStyle = '#c04040';
      const spikes = Math.floor(h.w / 16);
      for (let i = 0; i < spikes; i++) {
        const sx = h.x + i * 16;
        this.ctx.beginPath();
        this.ctx.moveTo(sx, h.y + h.h);
        this.ctx.lineTo(sx + 8, h.y);
        this.ctx.lineTo(sx + 16, h.y + h.h);
        this.ctx.closePath();
        this.ctx.fill();
      }
    } else if (h.type === 'lava') {
      const t = this.time * 2;
      const grd = this.ctx.createLinearGradient(h.x, h.y, h.x, h.y + h.h);
      grd.addColorStop(0, '#ff8030');
      grd.addColorStop(0.5, '#ff3010');
      grd.addColorStop(1, '#801000');
      this.ctx.fillStyle = grd;
      this.ctx.fillRect(h.x, h.y, h.w, h.h);
      // Волны
      this.ctx.fillStyle = 'rgba(255,200,80,0.6)';
      for (let i = 0; i < h.w; i += 20) {
        const y = h.y + Math.sin(t + i * 0.1) * 4;
        this.ctx.fillRect(h.x + i, y, 20, 3);
      }
    } else if (h.type === 'dark') {
      const grd = this.ctx.createRadialGradient(
        h.x + h.w / 2, h.y + h.h / 2, 2,
        h.x + h.w / 2, h.y + h.h / 2, Math.max(h.w, h.h) / 2
      );
      grd.addColorStop(0, '#8000c0');
      grd.addColorStop(0.7, '#2a0040');
      grd.addColorStop(1, 'rgba(20,0,40,0.9)');
      this.ctx.fillStyle = grd;
      this.ctx.fillRect(h.x, h.y, h.w, h.h);
    } else if (h.type === 'light') {
      const grd = this.ctx.createRadialGradient(
        h.x + h.w / 2, h.y + h.h / 2, 2,
        h.x + h.w / 2, h.y + h.h / 2, Math.max(h.w, h.h) / 2
      );
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.5, '#ffd060');
      grd.addColorStop(1, 'rgba(255,200,80,0.3)');
      this.ctx.fillStyle = grd;
      this.ctx.fillRect(h.x, h.y, h.w, h.h);
    }
  }

  _drawKey(k) {
    const img = this.textures.get('key');
    if (img) { this.ctx.drawImage(img, k.x, k.y, k.w, k.h); return; }
    // Программный ключ
    const t = this.time * 3;
    const bob = Math.sin(t) * 4;
    this.ctx.save();
    this.ctx.translate(k.x + k.w / 2, k.y + k.h / 2 + bob);
    this.ctx.rotate(Math.sin(t * 0.5) * 0.2);
    // Свечение
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#ffd700';
    this.ctx.fillStyle = '#ffd700';
    this.ctx.beginPath();
    this.ctx.arc(-6, 0, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillRect(-2, -2, 14, 4);
    this.ctx.fillRect(8, -2, 3, 8);
    this.ctx.fillRect(11, -2, 3, 6);
    this.ctx.shadowBlur = 0;
    this.ctx.restore();
  }

  _drawCrystal(c) {
    const img = this.textures.get('crystal');
    if (img) { this.ctx.drawImage(img, c.x, c.y, c.w, c.h); return; }
    const t = this.time * 4;
    const bob = Math.sin(t) * 3;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2 + bob;
    this.ctx.save();
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#80e0ff';
    this.ctx.fillStyle = '#a0f0ff';
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - c.h / 2);
    this.ctx.lineTo(cx + c.w / 2, cy);
    this.ctx.lineTo(cx, cy + c.h / 2);
    this.ctx.lineTo(cx - c.w / 2, cy);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - c.h / 2);
    this.ctx.lineTo(cx + c.w / 4, cy);
    this.ctx.lineTo(cx, cy + c.h / 2);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  _drawDoor(d) {
    const img = this.textures.get('door');
    if (img) { this.ctx.drawImage(img, d.x, d.y, d.w, d.h); return; }
    // Рамка
    this.ctx.fillStyle = '#2a1a3a';
    this.ctx.fillRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8);
    if (d.open) {
      // Открытая дверь — светящийся портал
      const grd = this.ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.h);
      grd.addColorStop(0, '#80ffe0');
      grd.addColorStop(1, '#40a0c0');
      this.ctx.fillStyle = grd;
      this.ctx.globalAlpha = 0.6 + 0.3 * Math.sin(this.time * 4);
      this.ctx.fillRect(d.x, d.y, d.w, d.h);
      this.ctx.globalAlpha = 1;
    } else {
      // Закрытая
      this.ctx.fillStyle = '#5a3050';
      this.ctx.fillRect(d.x, d.y, d.w, d.h);
      // Замок
      this.ctx.fillStyle = d.requires > 0 ? '#ffd700' : '#888';
      this.ctx.beginPath();
      this.ctx.arc(d.x + d.w / 2, d.y + d.h / 2, 10, 0, Math.PI * 2);
      this.ctx.fill();
      if (d.requires > 0) {
        this.ctx.fillStyle = '#222';
        this.ctx.font = 'bold 14px Montserrat';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(d.requires, d.x + d.w / 2, d.y + d.h / 2);
      }
    }
  }

  _drawGoal(goal) {
    const t = this.time * 2;
    this.ctx.save();
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = '#ffe080';
    const grd = this.ctx.createRadialGradient(
      goal.x + goal.w / 2, goal.y + goal.h / 2, 5,
      goal.x + goal.w / 2, goal.y + goal.h / 2, goal.w
    );
    grd.addColorStop(0, `rgba(255,240,180,${0.6 + 0.2 * Math.sin(t)})`);
    grd.addColorStop(0.5, 'rgba(255,200,80,0.3)');
    grd.addColorStop(1, 'rgba(255,200,80,0)');
    this.ctx.fillStyle = grd;
    this.ctx.fillRect(goal.x - goal.w, goal.y - goal.h, goal.w * 3, goal.h * 3);
    this.ctx.restore();
    this.ctx.strokeStyle = '#ffe080';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  }

  _drawEnemy(e) {
    const img = this.textures.get('enemy');
    if (img) { this.ctx.drawImage(img, e.x, e.y, e.w, e.h); return; }
    // Программный враг
    this.ctx.save();
    this.ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    const t = this.time * 4;
    // Тело
    this.ctx.fillStyle = '#802020';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, e.w / 2 - 4, 0, Math.PI * 2);
    this.ctx.fill();
    // Глаза
    this.ctx.fillStyle = '#ff4040';
    this.ctx.beginPath();
    this.ctx.arc(-6, -2, 4, 0, Math.PI * 2);
    this.ctx.arc(6, -2, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(-6, -2, 2, 0, Math.PI * 2);
    this.ctx.arc(6, -2, 2, 0, Math.PI * 2);
    this.ctx.fill();
    // Свечение
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#ff0000';
    this.ctx.strokeStyle = `rgba(255,60,60,${0.5 + 0.3 * Math.sin(t)})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, e.w / 2 - 2, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  _drawTrap(t) {
    this.ctx.save();
    this.ctx.translate(t.x + t.w / 2, t.y + t.h / 2);
    this.ctx.rotate(t.angle);
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = '#ff6060';
    // 4 лезвия
    this.ctx.fillStyle = '#c04040';
    for (let i = 0; i < 4; i++) {
      this.ctx.save();
      this.ctx.rotate(i * Math.PI / 2);
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(t.w / 2, -6);
      this.ctx.lineTo(t.w / 2, 6);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }
    this.ctx.fillStyle = '#402020';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  _drawButton(b) {
    const img = this.textures.get('button');
    if (img) { this.ctx.drawImage(img, b.x, b.y, b.w, b.h); return; }
    const pressed = b.pressed;
    const h = pressed ? b.h * 0.5 : b.h;
    const y = pressed ? b.y + b.h * 0.5 : b.y;
    this.ctx.fillStyle = pressed ? '#80ff80' : b.color;
    this.ctx.fillRect(b.x, y, b.w, h);
    this.ctx.strokeStyle = '#222';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(b.x, y, b.w, h);
    if (pressed) {
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#80ff80';
      this.ctx.strokeStyle = '#80ff80';
      this.ctx.strokeRect(b.x, y, b.w, h);
      this.ctx.shadowBlur = 0;
    }
  }

  _drawLever(l) {
    this.ctx.save();
    this.ctx.translate(l.x + l.w / 2, l.y + l.h);
    // База
    this.ctx.fillStyle = '#3a2a1a';
    this.ctx.fillRect(-l.w / 2, -8, l.w, 8);
    // Ручка
    const angle = l.activated ? -Math.PI / 4 : Math.PI / 4;
    this.ctx.rotate(angle);
    this.ctx.fillStyle = l.activated ? '#80ff80' : '#c8a94a';
    this.ctx.fillRect(-4, -l.h, 8, l.h);
    this.ctx.beginPath();
    this.ctx.arc(0, -l.h, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  _drawMovableItem(it) {
    const img = this.textures.get('movable');
    if (img) { this.ctx.drawImage(img, it.x, it.y, it.w, it.h); return; }
    const grd = this.ctx.createLinearGradient(it.x, it.y, it.x, it.y + it.h);
    grd.addColorStop(0, '#c8a060');
    grd.addColorStop(1, '#7a5020');
    this.ctx.fillStyle = grd;
    this.ctx.fillRect(it.x, it.y, it.w, it.h);
    this.ctx.strokeStyle = '#402010';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(it.x + 1, it.y + 1, it.w - 2, it.h - 2);
    // Крест-накрест
    this.ctx.beginPath();
    this.ctx.moveTo(it.x, it.y);
    this.ctx.lineTo(it.x + it.w, it.y + it.h);
    this.ctx.moveTo(it.x + it.w, it.y);
    this.ctx.lineTo(it.x, it.y + it.h);
    this.ctx.stroke();
  }

  // ---------- Игрок ----------
  _drawPlayer(p) {
    const spriteKey = p.type === 'dark' ? 'player_dark' : 'player_light';
    const img = this.textures.get(spriteKey);
    if (img) {
      this._drawPlayerSprite(p, img);
    } else {
      this._drawPlayerProgrammatic(p);
    }
    // Частицы
    this._drawParticles(p);
  }

  _drawPlayerSprite(p, img) {
    // Спрайт-лист: 8 кадров по 64×64
    const frameW = 64, frameH = 64;
    const frameCount = 8;
    const idx = Math.floor(p.animTime * 10) % frameCount;
    const sx = idx * frameW;
    this.ctx.save();
    this.ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    if (p.facing < 0) this.ctx.scale(-1, 1);
    // Если спрайт 64×64, а игрок 48×64 — масштабируем
    const dw = p.w, dh = p.h;
    this.ctx.drawImage(img, sx, 0, frameW, frameH, -dw / 2, -dh / 2, dw, dh);
    this.ctx.restore();
  }

  _drawPlayerProgrammatic(p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const t = p.animTime;
    const isDark = p.type === 'dark';

    this.ctx.save();
    this.ctx.translate(cx, cy);

    // Смерть — растворяем
    if (!p.alive) {
      this.ctx.globalAlpha = Math.max(0, 1 - p.deathTimer * 0.8);
    }

    // Свечение
    const glowColor = isDark ? '#8040ff' : '#ffe080';
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    this.ctx.shadowBlur = 30 * pulse;
    this.ctx.shadowColor = glowColor;

    // Тело — капсула
    const bodyGrd = this.ctx.createRadialGradient(0, 0, 2, 0, 0, p.h / 2);
    if (isDark) {
      bodyGrd.addColorStop(0, '#8040ff');
      bodyGrd.addColorStop(0.5, '#4020a0');
      bodyGrd.addColorStop(1, '#100020');
    } else {
      bodyGrd.addColorStop(0, '#ffffff');
      bodyGrd.addColorStop(0.5, '#ffe080');
      bodyGrd.addColorStop(1, '#c08020');
    }
    this.ctx.fillStyle = bodyGrd;

    // Анимация покачивания в idle
    let bob = 0;
    if (p.animState === 'idle') bob = Math.sin(t * 3) * 2;
    if (p.animState === 'run') bob = Math.abs(Math.sin(t * 12)) * -3;
    if (p.animState === 'jump') bob = -4;
    if (p.animState === 'fall') bob = 2;

    // Тело
    this.ctx.beginPath();
    this.ctx.ellipse(0, bob, p.w / 2 - 4, p.h / 2 - 4, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Внутренний «глаз» / ядро
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = isDark ? '#ffffff' : '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(p.facing * 4, -6 + bob, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = isDark ? '#000000' : '#a06020';
    this.ctx.beginPath();
    this.ctx.arc(p.facing * 6, -6 + bob, 2.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Крылья света при double jump
    if (!isDark && p.usedDoubleJump && !p.onGround) {
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#ffffa0';
      this.ctx.fillStyle = 'rgba(255,255,200,0.6)';
      this.ctx.beginPath();
      this.ctx.ellipse(-p.w / 2, 0, 12, 20, -0.3, 0, Math.PI * 2);
      this.ctx.ellipse(p.w / 2, 0, 12, 20, 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Dash-эффект
    if (p.dashTimer > 0) {
      this.ctx.globalAlpha = 0.5;
      this.ctx.shadowBlur = 40;
      this.ctx.shadowColor = '#c080ff';
      for (let i = 1; i <= 3; i++) {
        this.ctx.globalAlpha = 0.3 / i;
        this.ctx.beginPath();
        this.ctx.ellipse(-p.facing * i * 15, 0, p.w / 2 - 4, p.h / 2 - 4, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Win-анимация — руки вверх
    if (p.won) {
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = glowColor;
      this.ctx.beginPath();
      this.ctx.arc(-12, -p.h / 2 - 5, 4, 0, Math.PI * 2);
      this.ctx.arc(12, -p.h / 2 - 5, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  _drawParticles(p) {
    for (const pt of p.particles) {
      const alpha = pt.life / pt.maxLife;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.type === 'dark' ? '#a060ff' : '#ffe080';
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------
  drawHUD(game) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Верхняя панель с полупрозрачным фоном
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, this.W, 100);

    // Жизни (слева) — общие
    ctx.font = 'bold 40px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    const hearts = '❤️'.repeat(Math.max(0, game.lives));
    ctx.fillText(hearts, 30, 50);

    // Центр — название уровня
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "Playfair Display", serif';
    ctx.fillStyle = '#ffe080';
    ctx.fillText(`Уровень ${game.currentLevelIndex} — ${game.level?.name || ''}`, this.W / 2, 45);

    // Справа — таймер
    ctx.textAlign = 'right';
    ctx.font = 'bold 36px Montserrat, sans-serif';
    ctx.fillStyle = '#fff';
    const time = game.levelTime || 0;
    ctx.fillText(`⏱ ${this._formatTime(time)}`, this.W - 30, 40);

    // Под таймером — кристаллы
    ctx.font = '28px Montserrat, sans-serif';
    ctx.fillStyle = '#80e0ff';
    const collected = game.level?.collectedCrystals || 0;
    const total = game.level?.totalCrystals || 0;
    ctx.fillText(`💎 ${collected}/${total}`, this.W - 30, 80);

    // Угол — пауза
    ctx.font = '32px Montserrat, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('⏸ Esc', this.W - 120, this.H - 30);

    // Ключи
    if (game.level?.keys?.length > 0) {
      ctx.textAlign = 'left';
      ctx.font = '28px Montserrat, sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`🔑 ${game.level.collectedKeys}/${game.level.keys.length}`, 30, 90);
    }
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const cs = Math.floor((sec * 100) % 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
}