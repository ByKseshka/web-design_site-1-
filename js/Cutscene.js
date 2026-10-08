// ============================================================
// Cutscene.js — кат-сцены на Canvas (анимация, а не картинки)
// ============================================================

export class Cutscene {
  constructor(renderer) {
    this.renderer = renderer;
    this.canvas = renderer.canvas;
    this.ctx = renderer.ctx;
    this.W = renderer.W;
    this.H = renderer.H;

    this.slides = [];
    this.currentSlide = 0;
    this.slideTime = 0;
    this.totalTime = 0;
    this.finished = false;
    this.skipped = false;
    this.onFinish = null;

    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        size: 1 + Math.random() * 3,
        alpha: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 2,
      });
    }
    this.sparks = [];

    // Защита от многократного срабатывания одного нажатия
    this.inputCooldown = 0;
  }

  start(slides, onFinish) {
    this.slides = slides;
    this.currentSlide = 0;
    this.slideTime = 0;
    this.totalTime = 0;
    this.finished = false;
    this.skipped = false;
    this.onFinish = onFinish || null;
    this.sparks = [];
    this.inputCooldown = 0;
  }

  nextSlide() {
    if (this.currentSlide < this.slides.length - 1) {
      this.currentSlide++;
      this.slideTime = 0;
      this._spawnSparks();
    } else {
      this.finish();
    }
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    if (this.onFinish) this.onFinish();
  }

  _spawnSparks() {
    for (let i = 0; i < 30; i++) {
      this.sparks.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 1.0,
        maxLife: 1.0,
        size: 2 + Math.random() * 4,
        hue: Math.random() < 0.5 ? 45 : 270,
      });
    }
  }

  update(dt, input) {
    if (this.finished) return;

    this.slideTime += dt;
    this.totalTime += dt;
    if (this.inputCooldown > 0) this.inputCooldown -= dt;

    // Управление
    if (this.inputCooldown <= 0) {
      if (input.wasPressed('Space') || input.wasPressed('Enter') || input.mouse.clicked) {
        this.inputCooldown = 0.2;
        this.nextSlide();
        return;
      }
      if (input.wasPressed('Escape')) {
        this.inputCooldown = 0.2;
        this.finish();
        return;
      }
    }

    // Авто-переход
    const slide = this.slides[this.currentSlide];
    if (slide && this.slideTime >= slide.duration) {
      this.nextSlide();
    }

    // Частицы
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 0.8;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    this._drawBackground();

    const slide = this.slides[this.currentSlide];
    if (!slide) return;

    if (slide.render) {
      this['_' + slide.render]?.(slide, ctx);
    }

    if (slide.text) this._drawText(slide.text);
    if (slide.title) this._drawTitle(slide.title, slide.name);

    this._drawSparks();
    this._drawProgress();

    ctx.font = '24px Montserrat, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Space / клик — далее   Esc — пропустить', this.W / 2, this.H - 30);
  }

  _drawBackground() {
    const ctx = this.ctx;
    const t = this.totalTime;
    const grd = ctx.createRadialGradient(this.W / 2, this.H / 2, 0, this.W / 2, this.H / 2, this.W * 0.7);
    grd.addColorStop(0, '#0a0418');
    grd.addColorStop(0.6, '#050208');
    grd.addColorStop(1, '#000000');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.W, this.H);

    for (const s of this.stars) {
      const a = s.alpha * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawText(text) {
    const ctx = this.ctx;
    const slide = this.slides[this.currentSlide];
    const alpha = Math.min(1, this.slideTime / 1.0);
    const timeLeft = slide.duration - this.slideTime;
    const fadeOut = timeLeft < 1 ? timeLeft : 1;

    ctx.globalAlpha = alpha * fadeOut;
    ctx.font = 'bold 48px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f0e0c0';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff8040';
    ctx.fillText(text, this.W / 2, this.H - 180);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  _drawTitle(title, name) {
    const ctx = this.ctx;
    const alpha = Math.min(1, this.slideTime / 0.8);
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 80px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe080';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ffa040';
    ctx.fillText(title, this.W / 2, this.H / 2 - 60);
    if (name) {
      ctx.font = 'bold 56px "Playfair Display", serif';
      ctx.fillStyle = '#f0d0a0';
      ctx.fillText(name, this.W / 2, this.H / 2 + 20);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  _drawProgress() {
    const ctx = this.ctx;
    const n = this.slides.length;
    const r = 8;
    const gap = 30;
    const totalW = n * gap;
    const startX = this.W / 2 - totalW / 2 + gap / 2;
    const y = this.H - 80;
    for (let i = 0; i < n; i++) {
      const cx = startX + i * gap;
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      if (i === this.currentSlide) {
        ctx.fillStyle = '#ffe080';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,224,128,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  _drawSparks() {
    const ctx = this.ctx;
    for (const s of this.sparks) {
      const a = s.life / s.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.hue === 45 ? '#ffe080' : '#a060ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------
  // Конкретные слайды
  // ------------------------------------------------------------
  _spheres_united(slide, ctx) {
    const t = this.slideTime;
    const cx = this.W / 2;
    const cy = this.H / 2 - 50;
    const sep = Math.max(0, 100 - t * 30);
    this._drawSphere(cx - sep, cy, 90, 'dark', t);
    this._drawSphere(cx + sep, cy, 90, 'light', t);
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 3);
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 250);
    grd.addColorStop(0, 'rgba(255,200,120,0.5)');
    grd.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _spheres_split(slide, ctx) {
    const t = this.slideTime;
    const cx = this.W / 2;
    const cy = this.H / 2 - 50;
    const sep = t * 60;
    this._drawSphere(cx - 90 - sep, cy, 90, 'dark', t);
    this._drawSphere(cx + 90 + sep, cy, 90, 'light', t);
    ctx.save();
    ctx.strokeStyle = `rgba(255,100,60,${0.6 + 0.4 * Math.sin(t * 8)})`;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff6030';
    ctx.beginPath();
    for (let y = cy - 200; y < cy + 200; y += 10) {
      const x = cx + Math.sin(y * 0.1 + t * 3) * 15;
      if (y === cy - 200) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _temples(slide, ctx) {
    const t = this.slideTime;
    const horizonY = this.H * 0.72;
    const grd = ctx.createLinearGradient(0, horizonY, 0, this.H);
    grd.addColorStop(0, '#1a0a20');
    grd.addColorStop(1, '#050208');
    ctx.fillStyle = grd;
    ctx.fillRect(0, horizonY, this.W, this.H - horizonY);

    for (let i = 0; i < 12; i++) {
      const x = 100 + i * (this.W - 200) / 11;
      const h = 60 + i * 3;
      const w = 40;
      const alpha = Math.min(1, t / 2) * (0.4 + 0.6 * (i / 12));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i % 2 === 0 ? '#3a2050' : '#503060';
      ctx.fillRect(x - w / 2, horizonY - h, w, h);
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - 5, horizonY - h);
      ctx.lineTo(x, horizonY - h - 20);
      ctx.lineTo(x + w / 2 + 5, horizonY - h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255,220,140,${0.5 + 0.5 * Math.sin(t * 2 + i)})`;
      ctx.fillRect(x - 5, horizonY - h + 15, 10, 15);
    }
    ctx.globalAlpha = 1;

    const dropY = Math.min(this.H / 2 - 50 + t * 60, horizonY - 150);
    this._drawSphere(this.W / 2 - 60, dropY, 50, 'dark', t);
    this._drawSphere(this.W / 2 + 60, dropY, 50, 'light', t);
  }

  _spheres_unite(slide, ctx) {
    const t = this.slideTime;
    const cx = this.W / 2;
    const cy = this.H / 2 - 50;
    const progress = Math.min(1, t / 3);
    const sep = 150 * (1 - progress);
    const flash = t > 3 ? Math.min(1, (t - 3) / 1) : 0;
    this._drawSphere(cx - sep, cy, 90, 'dark', t);
    this._drawSphere(cx + sep, cy, 90, 'light', t);
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = flash * (1 - flash * 0.3);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 400 * flash);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.3, 'rgba(255,240,180,0.8)');
      grd.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }
  }

  _level_intro(slide, ctx) {
    const t = this.slideTime;
    const cx = this.W / 2;
    const cy = this.H / 2 - 60;
    const alpha = Math.min(1, t / 0.6);
    if (slide.symbol) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 200px "Playfair Display", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe080';
      ctx.shadowBlur = 40 + 20 * Math.sin(t * 3);
      ctx.shadowColor = '#ffa040';
      ctx.fillText(slide.symbol, cx, cy);
      ctx.restore();
    }
  }

  _final_clock(slide, ctx) {
    const t = this.slideTime;
    const cx = this.W / 2;
    const cy = this.H / 2 - 40;
    ctx.save();
    ctx.translate(cx, cy);
    const r = 180;
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, '#402010');
    grd.addColorStop(0.7, '#1a0a05');
    grd.addColorStop(1, '#000000');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffe080';
    ctx.lineWidth = 6;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ffa040';
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(t * 1.5) * r * 0.6, Math.sin(t * 1.5) * r * 0.6);
    ctx.stroke();
    ctx.strokeStyle = '#ffe080';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(t * 6) * r * 0.85, Math.sin(t * 6) * r * 0.85);
    ctx.stroke();
    this._drawSphere(-30, 0, 25, 'dark', t);
    this._drawSphere(30, 0, 25, 'light', t);
    ctx.restore();
  }

  _final_world(slide, ctx) {
    const t = this.slideTime;
    const grd = ctx.createLinearGradient(0, this.H * 0.4, 0, this.H);
    grd.addColorStop(0, 'rgba(80,60,20,0)');
    grd.addColorStop(0.5, `rgba(180,140,60,${Math.min(1, t / 3) * 0.5})`);
    grd.addColorStop(1, `rgba(255,200,100,${Math.min(1, t / 3) * 0.8})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.W, this.H);

    for (let i = 0; i < 20; i++) {
      const x = 100 + i * 90;
      const y = this.H * 0.75 + Math.sin(i) * 20;
      const h = 60 + (i % 5) * 20;
      const grow = Math.min(1, Math.max(0, (t - i * 0.1) / 2));
      if (grow <= 0) continue;
      ctx.fillStyle = '#2a1a08';
      ctx.fillRect(x - 4, y - h * grow, 8, h * grow);
      ctx.fillStyle = `rgba(80,160,60,${grow})`;
      ctx.beginPath();
      ctx.arc(x, y - h * grow, 25 * grow, 0, Math.PI * 2);
      ctx.fill();
    }

    this._drawSphere(this.W / 2 - 40, 150, 40, 'dark', t);
    this._drawSphere(this.W / 2 + 40, 150, 40, 'light', t);
  }

  _final_logo(slide, ctx) {
    const t = this.slideTime;
    const alpha = Math.min(1, t / 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 140px "Playfair Display", serif';
    const grd = ctx.createLinearGradient(0, this.H / 2 - 100, 0, this.H / 2 + 100);
    grd.addColorStop(0, '#a060ff');
    grd.addColorStop(0.5, '#ffffff');
    grd.addColorStop(1, '#ffe080');
    ctx.fillStyle = grd;
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#ffa040';
    ctx.fillText('ТЬМА И СВЕТ', this.W / 2, this.H / 2 - 60);
    ctx.font = 'bold 36px Montserrat, sans-serif';
    ctx.fillStyle = '#f0d0a0';
    ctx.fillText('— СПАСИБО ЗА ИГРУ —', this.W / 2, this.H / 2 + 40);
    ctx.restore();
    if (Math.random() < 0.3) {
      this.sparks.push({
        x: Math.random() * this.W,
        y: this.H / 2 + 100,
        vx: (Math.random() - 0.5) * 100,
        vy: -100 - Math.random() * 200,
        life: 1.5,
        maxLife: 1.5,
        size: 2 + Math.random() * 4,
        hue: Math.random() < 0.5 ? 45 : 270,
      });
    }
  }

  _drawSphere(x, y, r, type, t) {
    const ctx = this.ctx;
    ctx.save();
    const isDark = type === 'dark';
    ctx.shadowBlur = 40;
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
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}