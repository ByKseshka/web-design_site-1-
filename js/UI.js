// ============================================================
// UI.js — меню, экраны, HUD (отрисовка на Canvas)
// ============================================================

import { LEVELS } from './levels.js';

export class UI {
  constructor(renderer, game) {
    this.renderer = renderer;
    this.game = game;
    this.ctx = renderer.ctx;
    this.W = renderer.W;
    this.H = renderer.H;
    this.buttons = [];
    this.hovered = null;
    this.tooltip = null;
    this.tooltipTimer = 0;

    // Слайдеры и тумблеры (регистрируются при отрисовке)
    this.sliders = [];
    this.toggles = [];
    this.draggingSlider = null;
  }

  // ---------- Утилиты ----------
  _clearButtons() { this.buttons = []; }

  _addButton(x, y, w, h, label, onClick, opts = {}) {
    this.buttons.push({ x, y, w, h, label, onClick, ...opts });
  }

  handleMouse(mouse, input) {
    // 1) Перетаскивание слайдера
    if (input.mouse.down && this.draggingSlider) {
      const s = this.draggingSlider;
      const v = Math.max(0, Math.min(1, (mouse.x - s.x) / s.w));
      s.value = v;
      s.onChange(v);
    }
    if (!input.mouse.down) {
      this.draggingSlider = null;
    }

    // 2) Клики
    if (input.mouse.clicked) {
      // Тумблеры
      for (const t of this.toggles) {
        if (mouse.x >= t.x && mouse.x <= t.x + t.w &&
            mouse.y >= t.y && mouse.y <= t.y + t.h) {
          this.game.audio.playUIClick();
          t.onChange(!t.value);
          return;
        }
      }
      // Начало перетаскивания слайдера
      for (const s of this.sliders) {
        const hy = s.y - 20, hh = s.h + 40;
        if (mouse.x >= s.x - 20 && mouse.x <= s.x + s.w + 20 &&
            mouse.y >= hy && mouse.y <= hy + hh) {
          this.draggingSlider = s;
          const v = Math.max(0, Math.min(1, (mouse.x - s.x) / s.w));
          s.value = v;
          s.onChange(v);
          return;
        }
      }
    }

    // 3) Кнопки
    this.hovered = null;
    for (const b of this.buttons) {
      if (mouse.x >= b.x && mouse.x <= b.x + b.w &&
          mouse.y >= b.y && mouse.y <= b.y + b.h) {
        this.hovered = b;
        if (input.mouse.clicked && !b.disabled) {
          this.game.audio.playUIClick();
          b.onClick();
          break;
        }
      }
    }
  }

  drawButton(b) {
    const ctx = this.ctx;
    const hovered = this.hovered === b;
    const disabled = !!b.disabled;
    ctx.save();
    const grd = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    if (disabled) {
      grd.addColorStop(0, '#333');
      grd.addColorStop(1, '#1a1a1a');
    } else if (hovered) {
      grd.addColorStop(0, '#6a4a9a');
      grd.addColorStop(1, '#3a2060');
    } else {
      grd.addColorStop(0, '#4a3060');
      grd.addColorStop(1, '#2a1040');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = disabled ? '#444' : (hovered ? '#ffe080' : '#8060a0');
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.font = 'bold 36px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = disabled ? '#666' : (hovered ? '#ffe080' : '#f0e0c0');
    if (b.icon) {
      ctx.fillText(b.icon + '  ' + b.label, b.x + b.w / 2, b.y + b.h / 2);
    } else {
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }
    ctx.restore();
  }

  // ---------- Меню ----------
  drawMainMenu(dt, input) {
    this._clearButtons();
    const r = this.renderer;
    r.clear('#050208');
    r.drawBackground(dt);
    this._drawFloatingSpheres(dt);

    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 140px "Playfair Display", serif';
    const grd = ctx.createLinearGradient(0, 150, 0, 350);
    grd.addColorStop(0, '#a060ff');
    grd.addColorStop(0.5, '#ffffff');
    grd.addColorStop(1, '#ffe080');
    ctx.fillStyle = grd;
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#ff8040';
    ctx.fillText('ТЬМА И СВЕТ', this.W / 2, 240);
    ctx.font = 'bold 32px Montserrat, sans-serif';
    ctx.fillStyle = '#c0a0e0';
    ctx.shadowBlur = 10;
    ctx.fillText('кооперативный платформер', this.W / 2, 330);
    ctx.restore();

    const bx = this.W / 2 - 250;
    const bw = 500, bh = 80;
    let by = 480;
    const gap = 100;

    this._addButton(bx, by, bw, bh, 'Начать игру', () => this.game.startNewGame());
    by += gap;
    this._addButton(bx, by, bw, bh, 'Выбор уровня', () => this.game.changeState('LEVEL_SELECT'));
    by += gap;
    this._addButton(bx, by, bw, bh, 'Как играть', () => this.game.changeState('HOW_TO_PLAY'));
    by += gap;
    this._addButton(bx, by, bw, bh, 'Настройки', () => this.game.changeState('SETTINGS'));

    for (const b of this.buttons) this.drawButton(b);

    this.handleMouse(input.mouse, input);

    ctx.font = '20px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('v1.0', this.W - 20, this.H - 20);
  }

  _drawFloatingSpheres(dt) {
    const ctx = this.ctx;
    const t = (this.game.menuTime = (this.game.menuTime || 0) + dt);
    const cx = this.W / 2;
    const cy = 720;
    const sep = 200 + Math.sin(t * 0.7) * 60;
    this._drawMenuSphere(cx - sep, cy + Math.sin(t * 1.3) * 30, 60, 'dark', t);
    this._drawMenuSphere(cx + sep, cy + Math.sin(t * 1.1 + 1) * 30, 60, 'light', t);
  }

  _drawMenuSphere(x, y, r, type, t) {
    const ctx = this.ctx;
    const isDark = type === 'dark';
    ctx.save();
    ctx.shadowBlur = 40 + 20 * Math.sin(t * 2);
    ctx.shadowColor = isDark ? '#8040ff' : '#ffe080';
    const grd = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    if (isDark) {
      grd.addColorStop(0, '#c080ff');
      grd.addColorStop(0.5, '#6020c0');
      grd.addColorStop(1, '#100020');
    } else {
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.5, '#ffe080');
      grd.addColorStop(1, '#c08020');
    }
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- Выбор уровня ----------
  drawLevelSelect(dt, input) {
    this._clearButtons();
    const r = this.renderer;
    r.clear('#050208');
    r.drawBackground(dt);

    const ctx = this.ctx;
    ctx.font = 'bold 72px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe080';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff8040';
    ctx.fillText('Выбор уровня', this.W / 2, 100);
    ctx.shadowBlur = 0;

    const save = this.game.save;
    const cols = 4, rows = 3;
    const cardW = 340, cardH = 200;
    const gapX = 40, gapY = 40;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = (this.W - totalW) / 2;
    const startY = 220;

    for (let i = 0; i < 12; i++) {
      const lvl = LEVELS[i];
      const c = i % cols;
      const rw = Math.floor(i / cols);
      const x = startX + c * (cardW + gapX);
      const y = startY + rw * (cardH + gapY);
      const unlocked = save.unlockedLevels.includes(lvl.index);
      const stars = save.levelStars[lvl.index] || 0;

      this._drawLevelCard(x, y, cardW, cardH, lvl, unlocked, stars, input);
    }

    this._addButton(50, this.H - 120, 300, 80, '← В меню', () => this.game.changeState('MENU'));
    for (const b of this.buttons) this.drawButton(b);

    this.handleMouse(input.mouse, input);

    if (this.tooltip && this.tooltipTimer > 0) {
      this.tooltipTimer -= dt;
      ctx.font = 'bold 28px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(this.tooltip).width + 40;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(input.mouse.x - tw / 2, input.mouse.y - 70, tw, 50);
      ctx.strokeStyle = '#ff6060';
      ctx.lineWidth = 2;
      ctx.strokeRect(input.mouse.x - tw / 2, input.mouse.y - 70, tw, 50);
      ctx.fillStyle = '#ff8080';
      ctx.fillText(this.tooltip, input.mouse.x, input.mouse.y - 45);
    }
  }

  _drawLevelCard(x, y, w, h, lvl, unlocked, stars, input) {
    const ctx = this.ctx;
    const mouse = input.mouse;
    const hovered = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;

    const grd = ctx.createLinearGradient(x, y, x, y + h);
    if (unlocked) {
      if (hovered) {
        grd.addColorStop(0, 'rgba(120,80,180,0.9)');
        grd.addColorStop(1, 'rgba(60,30,100,0.9)');
      } else {
        grd.addColorStop(0, 'rgba(70,50,110,0.8)');
        grd.addColorStop(1, 'rgba(30,15,60,0.8)');
      }
    } else {
      grd.addColorStop(0, 'rgba(40,40,40,0.8)');
      grd.addColorStop(1, 'rgba(20,20,20,0.8)');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = unlocked ? (hovered ? '#ffe080' : '#8060a0') : '#444';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeRect(x, y, w, h);

    ctx.font = 'bold 64px "Playfair Display", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = unlocked ? '#ffe080' : '#666';
    ctx.fillText(lvl.index, x + 20, y + 15);

    ctx.font = 'bold 28px Montserrat, sans-serif';
    ctx.fillStyle = unlocked ? '#f0e0c0' : '#777';
    ctx.fillText(lvl.name, x + 20, y + 90);

    ctx.font = '32px sans-serif';
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < stars ? '#ffd700' : 'rgba(255,255,255,0.15)';
      ctx.fillText('⭐', x + 20 + i * 40, y + 140);
    }

    if (!unlocked) {
      ctx.font = '64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('🔒', x + w - 70, y + 50);
    }

    if (hovered && input.mouse.clicked) {
      if (unlocked) {
        this.game.audio.playUIClick();
        this.game.startLevel(lvl.index);
      } else {
        this.tooltip = `Сначала пройдите уровень ${lvl.index - 1}`;
        this.tooltipTimer = 2;
      }
    }
  }

  // ---------- Как играть ----------
  drawHowToPlay(dt, input) {
    this._clearButtons();
    const r = this.renderer;
    r.clear('#050208');
    r.drawBackground(dt);

    const ctx = this.ctx;
    ctx.font = 'bold 72px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe080';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff8040';
    ctx.fillText('Как играть', this.W / 2, 100);
    ctx.shadowBlur = 0;

    ctx.font = '32px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f0e0c0';

    const lines = [
      ['🌑  Тьма (игрок 1)', '#a060ff'],
      ['   A / D — движение,  W — прыжок,  Shift — рывок (dash)', '#c0a0e0'],
      ['   Тьма не может ходить по светлым зонам!', '#ff8080'],
      ['', ''],
      ['☀️  Свет (игрок 2)', '#ffe080'],
      ['   ← / → — движение,  ↑ — прыжок (двойной в воздухе)', '#f0d0a0'],
      ['   Свет не может ходить по тёмным зонам!', '#ff8080'],
      ['', ''],
      ['🎯  Цель', '#80e0ff'],
      ['   Пройдите 12 Храмов Равновесия вместе.', '#c0d0e0'],
      ['   Собирайте ключи 🔑, кристаллы 💎 и открывайте двери.', '#c0d0e0'],
      ['   Уровень завершён, когда оба героя достигнут цели.', '#c0d0e0'],
      ['', ''],
      ['💡  Звёзды за уровень', '#ffd700'],
      ['   ⭐ — пройти уровень', '#f0e0c0'],
      ['   ⭐⭐ — уложиться в целевое время', '#f0e0c0'],
      ['   ⭐⭐⭐ — собрать все кристаллы', '#f0e0c0'],
    ];

    let y = 200;
    for (const [text, color] of lines) {
      ctx.fillStyle = color;
      ctx.fillText(text, 200, y);
      y += 48;
    }

    this._addButton(this.W / 2 - 150, this.H - 120, 300, 80, '← Назад', () => this.game.changeState('MENU'));
    for (const b of this.buttons) this.drawButton(b);
    this.handleMouse(input.mouse, input);
  }

  // ---------- Настройки ----------
  drawSettings(dt, input) {
    this._clearButtons();
    this.sliders = [];
    this.toggles = [];

    const r = this.renderer;
    r.clear('#050208');
    r.drawBackground(dt);

    const ctx = this.ctx;
    ctx.font = 'bold 72px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe080';
    ctx.fillText('Настройки', this.W / 2, 100);

    const save = this.game.save;
    ctx.font = '32px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f0e0c0';

    this._drawSlider(400, 250, 600, 20, save.settings.musicVolume, (v) => {
      save.settings.musicVolume = v;
      this.game.audio.setMusicVolume(v);
      this.game.persistSave();
    }, 'Музыка');

    this._drawSlider(400, 380, 600, 20, save.settings.sfxVolume, (v) => {
      save.settings.sfxVolume = v;
      this.game.audio.setSfxVolume(v);
      this.game.persistSave();
    }, 'Звуки');

    this._drawToggle(400, 510, save.settings.showHints, (v) => {
      save.settings.showHints = v;
      this.game.persistSave();
    }, 'Показывать подсказки');

    ctx.font = 'bold 40px "Playfair Display", serif';
    ctx.fillStyle = '#80e0ff';
    ctx.fillText('Пользовательские текстуры', 400, 620);

    ctx.font = '24px Montserrat, sans-serif';
    ctx.fillStyle = '#c0d0e0';
    const texInfo = [
      'Тьма (спрайт-лист): 512 × 64 px, PNG, 8 кадров по 64×64',
      'Свет (спрайт-лист): 512 × 64 px, PNG, 8 кадров по 64×64',
      'Тайл платформы: 64 × 64 px, PNG',
      'Ключ: 32 × 32 px, PNG;  Дверь: 64 × 96 px, PNG',
      'Фон уровня: 1920 × 1080 px, JPG/PNG',
    ];
    let ty = 660;
    for (const t of texInfo) {
      ctx.fillText(t, 400, ty);
      ty += 30;
    }

    this._addButton(400, 830, 280, 70, 'Загрузить Тьму', () => this._pickFile('player_dark'));
    this._addButton(720, 830, 280, 70, 'Загрузить Свет', () => this._pickFile('player_light'));
    this._addButton(1040, 830, 280, 70, 'Сбросить все', () => {
      this.game.textures.clearAll();
      save.customTextures = {};
      this.game.persistSave();
    });

    this._addButton(this.W / 2 - 150, this.H - 100, 300, 80, '← Назад', () => this.game.changeState('MENU'));
    for (const b of this.buttons) this.drawButton(b);
    this.handleMouse(input.mouse, input);
  }

  _pickFile(key) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg';
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const dataURL = await this.game.textures.loadFromFile(key, file);
        this.game.save.customTextures[key] = dataURL;
        this.game.persistSave();
        this.game.audio.playKeyPickup();
      } catch (e) {
        console.error(e);
        alert('Ошибка загрузки: ' + e.message);
      }
    };
    inp.click();
  }

  _drawSlider(x, y, w, h, value, onChange, label) {
    const ctx = this.ctx;
    ctx.fillStyle = '#f0e0c0';
    ctx.font = '32px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - 30);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#a060ff';
    ctx.fillRect(x, y, w * value, h);

    const hx = x + w * value;
    ctx.fillStyle = '#ffe080';
    ctx.beginPath();
    ctx.arc(hx, y + h / 2, h, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c0a0e0';
    ctx.font = '24px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(value * 100) + '%', x + w + 80, y + h / 2);
    ctx.textAlign = 'left';

    this.sliders.push({ x, y, w, h, value, onChange });
  }

  _drawToggle(x, y, value, onChange, label) {
    const ctx = this.ctx;
    ctx.fillStyle = '#f0e0c0';
    ctx.font = '32px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);

    const tx = x + 500;
    ctx.fillStyle = value ? '#80ff80' : '#555';
    ctx.fillRect(tx, y - 20, 80, 40);
    ctx.fillStyle = '#fff';
    const cx = value ? tx + 60 : tx + 20;
    ctx.beginPath();
    ctx.arc(cx, y, 16, 0, Math.PI * 2);
    ctx.fill();

    this.toggles.push({ x: tx, y: y - 20, w: 80, h: 40, value, onChange });
  }

  // ---------- Пауза ----------
  drawPause(dt, input) {
    this._clearButtons();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.font = 'bold 100px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe080';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff8040';
    ctx.fillText('ПАУЗА', this.W / 2, 300);
    ctx.shadowBlur = 0;

    const bx = this.W / 2 - 200;
    const bw = 400, bh = 80;
    let by = 450;
    this._addButton(bx, by, bw, bh, 'Продолжить', () => this.game.resume());
    by += 100;
    this._addButton(bx, by, bw, bh, 'Заново', () => this.game.restartLevel());
    by += 100;
    this._addButton(bx, by, bw, bh, 'Выбор уровня', () => this.game.changeState('LEVEL_SELECT'));
    by += 100;
    this._addButton(bx, by, bw, bh, 'В меню', () => this.game.changeState('MENU'));

    for (const b of this.buttons) this.drawButton(b);
    this.handleMouse(input.mouse, input);
  }

  // ---------- Результат ----------
  drawLevelComplete(dt, input) {
    this._clearButtons();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, this.W, this.H);

    const res = this.game.levelResult || { time: 0, stars: 0, crystals: 0, total: 0 };

    ctx.font = 'bold 100px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe080';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff8040';
    ctx.fillText('УРОВЕНЬ ПРОЙДЕН!', this.W / 2, 200);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 64px Montserrat, sans-serif';
    ctx.fillStyle = '#f0e0c0';
    const m = Math.floor(res.time / 60);
    const s = Math.floor(res.time % 60);
    const cs = Math.floor((res.time * 100) % 100);
    ctx.fillText(`⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`, this.W / 2, 340);

    const starAnimT = res.animTime = (res.animTime || 0) + dt;
    for (let i = 0; i < 3; i++) {
      const show = starAnimT > i * 0.5;
      const scale = show ? Math.min(1, (starAnimT - i * 0.5) / 0.3) : 0;
      ctx.save();
      ctx.translate(this.W / 2 - 120 + i * 120, 470);
      ctx.scale(scale, scale);
      ctx.font = '100px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = i < res.stars ? '#ffd700' : 'rgba(255,255,255,0.2)';
      ctx.shadowBlur = i < res.stars ? 30 : 0;
      ctx.shadowColor = '#ffd700';
      ctx.fillText('⭐', 0, 0);
      ctx.restore();
    }

    ctx.font = '36px Montserrat, sans-serif';
    ctx.fillStyle = '#80e0ff';
    ctx.fillText(`Собрано предметов: ${res.crystals}/${res.total}`, this.W / 2, 600);

    const bx = this.W / 2 - 480;
    const bw = 300, bh = 80;
    const by = 750;
    const idx = this.game.currentLevelIndex;
    if (idx < 12) {
      this._addButton(bx, by, bw, bh, 'Следующий →', () => this.game.startLevel(idx + 1));
    } else {
      this._addButton(bx, by, bw, bh, 'Финал →', () => this.game.playFinalCutscene());
    }
    this._addButton(bx + 320, by, bw, bh, 'Повторить', () => this.game.restartLevel());
    this._addButton(bx + 640, by, bw, bh, 'В меню', () => this.game.changeState('MENU'));
    this._addButton(bx + 960, by, bw, bh, 'Выбор уровня', () => this.game.changeState('LEVEL_SELECT'));

    for (const b of this.buttons) this.drawButton(b);
    this.handleMouse(input.mouse, input);
  }

  // ---------- Game Over ----------
  drawGameOver(dt, input) {
    this._clearButtons();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.font = 'bold 100px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff4040';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff0000';
    ctx.fillText('ТЬМА И СВЕТ ПАЛИ…', this.W / 2, 400);
    ctx.shadowBlur = 0;

    ctx.font = '36px Montserrat, sans-serif';
    ctx.fillStyle = '#c0a0e0';
    ctx.fillText('Попробуйте ещё раз', this.W / 2, 500);

    const bx = this.W / 2 - 320;
    const bw = 300, bh = 80;
    const by = 650;
    this._addButton(bx, by, bw, bh, 'Повторить', () => this.game.restartLevel());
    this._addButton(bx + 340, by, bw, bh, 'В меню', () => this.game.changeState('MENU'));

    for (const b of this.buttons) this.drawButton(b);
    this.handleMouse(input.mouse, input);
  }
}