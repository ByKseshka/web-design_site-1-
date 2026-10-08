// ============================================================
// Collision.js — AABB-коллизии, разрешение столкновений
// ============================================================

// Прямоугольник: {x, y, w, h}
export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

export function intersection(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// ============================================================
// Улучшенная коллизия: раздельная обработка X и Y,
// корректное определение onGround, устойчивость к застреванию
// ============================================================
export function moveAndCollide(entity, platforms, dt) {
  const wasOnGround = entity.onGround;
  entity.onGround = false;

  // --- По X ---
  entity.x += entity.vx * dt;
  for (const p of platforms) {
    if (!aabb(entity, p)) continue;
    const inter = intersection(entity, p);
    if (!inter) continue;
    if (entity.vx > 0) {
      entity.x -= inter.w;
    } else if (entity.vx < 0) {
      entity.x += inter.w;
    } else {
      if (entity.x + entity.w / 2 < p.x + p.w / 2) entity.x -= inter.w;
      else entity.x += inter.w;
    }
    entity.vx = 0;
  }

  // --- По Y ---
  entity.y += entity.vy * dt;
  for (const p of platforms) {
    if (!aabb(entity, p)) continue;
    const inter = intersection(entity, p);
    if (!inter) continue;

    if (entity.vy > 0) {
      entity.y -= inter.h;
      entity.vy = 0;
      entity.onGround = true;
    } else if (entity.vy < 0) {
      entity.y += inter.h;
      entity.vy = 0;
    } else {
      if (entity.y + entity.h / 2 < p.y + p.h / 2) {
        entity.y -= inter.h;
        entity.onGround = true;
      } else {
        entity.y += inter.h;
      }
      entity.vy = 0;
    }
  }

  // --- Дополнительная проверка onGround (coyote) ---
  if (!entity.onGround && wasOnGround) {
    const testRect = {
      x: entity.x + 2,
      y: entity.y + entity.h,
      w: entity.w - 4,
      h: 4
    };
    for (const p of platforms) {
      if (aabb(testRect, p)) {
        entity.onGround = true;
        break;
      }
    }
  }
}