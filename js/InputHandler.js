// ============================================================
// InputHandler.js — обработка клавиатуры и мыши
// ============================================================

export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};               // текущее состояние
    this.keysPressed = {};        // "только что нажата" — сбрасывается каждый фикс-шаг
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.anyKeyPressed = false;

    window.addEventListener('keydown', (e) => {
      // Предотвращаем скролл стрелками/пробелом
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Space'].includes(e.key) ||
          e.code === 'Space') {
        e.preventDefault();
      }
      if (!this.keys[e.code]) {
        this.keysPressed[e.code] = true;
        this.anyKeyPressed = true;
      }
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    });

    canvas.addEventListener('mousedown', () => {
      this.mouse.down = true;
      this.mouse.clicked = true;
    });

    canvas.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });

    canvas.addEventListener('mouseleave', () => {
      this.mouse.down = false;
    });
  }

  isDown(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.keysPressed[code]; }

  // Вызывается после каждого фиксированного шага физики
  endFrame() {
    this.keysPressed = {};
    this.mouse.clicked = false;
    this.anyKeyPressed = false;
  }
}