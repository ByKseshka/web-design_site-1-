// ============================================================
// Platform.js — платформы: статические, движущиеся, лифты
// ============================================================

export class Platform {
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w ?? 64;
    this.h = opts.h ?? 32;
    this.type = opts.type || 'static'; // 'static' | 'moving' | 'elevator'
    this.color = opts.color || '#3a3a5a';
    this.id = opts.id || null;

    // Для движущихся: путь между (x,y) и (x2,y2)
    this.startX = this.x;
    this.startY = this.y;
    this.endX = opts.endX ?? this.x;
    this.endY = opts.endY ?? this.y;
    this.speed = opts.speed ?? 60;      // px/s
    this.t = opts.t ?? 0;               // фаза 0..1
    this.dir = 1;                       // направление движения по t
    this.axis = opts.axis || 'x';       // 'x' | 'y' | 'both'
    this.prevX = this.x;
    this.prevY = this.y;

    // Для лифта: вертикальное движение
    if (this.type === 'elevator') {
      this.axis = 'y';
      this.speed = opts.speed ?? 80;
    }
  }

  // Обновление движения
  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.type === 'static') return;

    const distX = this.endX - this.startX;
    const distY = this.endY - this.startY;
    const totalDist = Math.hypot(distX, distY);
    if (totalDist < 0.01) return;

    // Скорость движения по параметру t
    const dt_t = (this.speed * dt) / totalDist;
    this.t += dt_t * this.dir;

    if (this.t >= 1) { this.t = 1; this.dir = -1; }
    if (this.t <= 0) { this.t = 0; this.dir = 1; }

    this.x = this.startX + distX * this.t;
    this.y = this.startY + distY * this.t;
  }

  // Смещение платформы за кадр (для переноса игрока)
  getDelta() {
    return { dx: this.x - this.prevX, dy: this.y - this.prevY };
  }
}

// ============================================================
// Опасная зона (шипы, лава, зоны тьмы/света)
// ============================================================
export class Hazard {
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w ?? 64;
    this.h = opts.h ?? 32;
    this.type = opts.type || 'spike'; // 'spike' | 'dark' | 'light' | 'lava'
    this.color = this._defaultColor();
    this.damage = opts.damage ?? 1;
    this.moving = opts.moving || false;
    // Патрулирование
    this.startX = this.x;
    this.endX = opts.endX ?? this.x;
    this.speed = opts.speed ?? 100;
    this.dir = 1;
    this.prevX = this.x;
  }

  _defaultColor() {
    switch (this.type) {
      case 'spike': return '#a83232';
      case 'dark':  return '#2a003a';
      case 'light': return '#fff2b0';
      case 'lava':  return '#ff5500';
      default:      return '#a83232';
    }
  }

  update(dt) {
    this.prevX = this.x;
    if (!this.moving) return;
    const dist = Math.abs(this.endX - this.startX);
    if (dist < 0.01) return;
    const dt_t = (this.speed * dt) / dist;
    this.x += (this.endX - this.startX) * dt_t * this.dir;
    if ((this.dir > 0 && this.x >= Math.max(this.startX, this.endX)) ||
        (this.dir < 0 && this.x <= Math.min(this.startX, this.endX))) {
      this.dir *= -1;
    }
  }

  // Проверка, опасна ли зона для игрока данного типа
  isDangerousFor(playerType) {
    if (this.type === 'spike' || this.type === 'lava') return true;
    if (this.type === 'dark') return playerType === 'light';
    if (this.type === 'light') return playerType === 'dark';
    return false;
  }
}