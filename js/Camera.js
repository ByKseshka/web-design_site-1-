// ============================================================
// Camera.js — плавное слежение за игроками с динамическим зумом
// ============================================================

export class Camera {
  constructor(viewW = 1920, viewH = 1080) {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.viewW = viewW;
    this.viewH = viewH;

    this.minZoom = 0.7;
    this.maxZoom = 1.0;

    // Границы мира (устанавливаются Level)
    this.worldMinX = 0;
    this.worldMinY = 0;
    this.worldMaxX = 1920;
    this.worldMaxY = 1080;
  }

  // Центрируем камеру на игроках, регулируем зум
  follow(players, dt) {
    if (!players || players.length === 0) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of players) {
      if (!p) continue;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx);
      maxY = Math.max(maxY, cy);
    }

    if (minX === Infinity) return;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Разведение игроков определяет целевой зум
    const spreadX = maxX - minX;
    const spreadY = maxY - minY;
    const spread = Math.max(spreadX, spreadY);

    // Если игроки далеко — уменьшаем зум
    const margin = 500;
    const spreadWithMargin = spread + margin;
    const targetZ = Math.min(
      this.maxZoom,
      Math.max(this.minZoom, (Math.min(this.viewW, this.viewH)) / spreadWithMargin)
    );
    this.targetZoom = targetZ;

    // Плавный зум
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 4);

    // Желаемая позиция камеры (центр)
    let targetX = centerX - this.viewW / (2 * this.zoom);
    let targetY = centerY - this.viewH / (2 * this.zoom);

    // Плавное слежение
    const lerp = Math.min(1, dt * 5);
    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;

    // Ограничение границами мира
    const viewWidth = this.viewW / this.zoom;
    const viewHeight = this.viewH / this.zoom;
    if (this.worldMaxX - this.worldMinX <= viewWidth) {
      this.x = this.worldMinX + (this.worldMaxX - this.worldMinX - viewWidth) / 2;
    } else {
      this.x = Math.max(this.worldMinX, Math.min(this.worldMaxX - viewWidth, this.x));
    }
    if (this.worldMaxY - this.worldMinY <= viewHeight) {
      this.y = this.worldMinY + (this.worldMaxY - this.worldMinY - viewHeight) / 2;
    } else {
      this.y = Math.max(this.worldMinY, Math.min(this.worldMaxY - viewHeight, this.y));
    }
  }

  // Применить трансформацию к контексту
  apply(ctx) {
    ctx.save();
    ctx.translate(-this.x * this.zoom, -this.y * this.zoom);
    ctx.scale(this.zoom, this.zoom);
  }

  restore(ctx) {
    ctx.restore();
  }

  // Установить границы мира
  setWorldBounds(w, h) {
    this.worldMinX = 0;
    this.worldMinY = 0;
    this.worldMaxX = w;
    this.worldMaxY = h;
  }
}