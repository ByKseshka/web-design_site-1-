// ============================================================
// Game.js — класс Game (игровой цикл, состояния)
// Фиксированный шаг физики 1/60, рендер через requestAnimationFrame
// ============================================================

import { InputHandler } from './InputHandler.js';
import { AudioManager } from './Audio.js';
import { SaveManager } from './Save.js';
import { TextureLoader } from './TextureLoader.js';
import { Renderer } from './Renderer.js';
import { Camera } from './Camera.js';
import { Level } from './Level.js';
import { UI } from './UI.js';
import { Cutscene } from './Cutscene.js';
import { LEVELS, INTRO_CUTSCENE, FINAL_CUTSCENE, getLevelHint } from './levels.js';

export const GameState = {
  MENU: 'MENU',
  LEVEL_SELECT: 'LEVEL_SELECT',
  HOW_TO_PLAY: 'HOW_TO_PLAY',
  SETTINGS: 'SETTINGS',
  CUTSCENE_INTRO: 'CUTSCENE_INTRO',
  CUTSCENE_LEVEL: 'CUTSCENE_LEVEL',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE',
  GAME_OVER: 'GAME_OVER',
  CUTSCENE_FINAL: 'CUTSCENE_FINAL',
};

const FIXED_STEP = 1 / 60;
const MAX_ITERATIONS = 5;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = GameState.MENU;
    this.prevState = null;

    // Менеджеры
    this.input = new InputHandler(canvas);
    this.audio = new AudioManager();
    this.save = SaveManager.load();
    this.textures = new TextureLoader();
    this.renderer = new Renderer(canvas, this.textures);
    this.camera = new Camera(canvas.width, canvas.height);
    this.ui = new UI(this.renderer, this);
    this.cutscene = new Cutscene(this.renderer);

    // Уровень
    this.level = null;
    this.currentLevelIndex = 1;
    this.levelTime = 0;
    this.lives = 3;
    this.levelResult = null;

    this._restoreTextures();

    this.audio.musicVolume = this.save.settings.musicVolume;
    this.audio.sfxVolume = this.save.settings.sfxVolume;

    // Цикл
    this.lastTime = 0;
    this.accumulator = 0;
    this.running = false;
    this.rafId = null;
    this.audioInitialized = false;

    // Инициализация звука — только после жеста
    window.addEventListener('keydown', () => this._initAudioOnce(), { once: true });
    window.addEventListener('mousedown', () => this._initAudioOnce(), { once: true });

    // Esc — пауза
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === GameState.PLAYING) this.pause();
        else if (this.state === GameState.PAUSED) this.resume();
      }
      // E — взаимодействие (подбор/бросок предмета)
      if (e.code === 'KeyE' && this.state === GameState.PLAYING && this.level) {
        for (const p of this.level.players) {
          this.level.tryPickup(p);
        }
      }
    });

    // Клик по кнопке паузы
    canvas.addEventListener('mousedown', (e) => {
      if (this.state !== GameState.PLAYING) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (x > canvas.width - 220 && y > canvas.height - 70) {
        this.pause();
      }
    });
  }

  _initAudioOnce() {
    if (this.audioInitialized) return;
    this.audio.ensure();
    this.audio.setMusicVolume(this.save.settings.musicVolume);
    this.audio.setSfxVolume(this.save.settings.sfxVolume);
    this.audioInitialized = true;
    this._startMusicForState();
  }

  _startMusicForState() {
    if (!this.audioInitialized) return;
    if (this.state === GameState.MENU || this.state === GameState.LEVEL_SELECT ||
        this.state === GameState.HOW_TO_PLAY || this.state === GameState.SETTINGS) {
      this.audio.playMenuMusic();
    } else if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
      this.audio.playLevelMusic(this.currentLevelIndex - 1);
    } else if (this.state === GameState.CUTSCENE_INTRO ||
               this.state === GameState.CUTSCENE_LEVEL ||
               this.state === GameState.CUTSCENE_FINAL) {
      this.audio.playCutsceneMusic();
    }
  }

  async _restoreTextures() {
    const ct = this.save.customTextures || {};
    for (const key in ct) {
      try {
        await this.textures.loadFromDataURL(key, ct[key]);
      } catch (e) {
        console.warn('Не удалось восстановить текстуру', key, e);
      }
    }
  }

  persistSave() {
    SaveManager.save(this.save);
  }

  changeState(newState) {
    this.prevState = this.state;
    this.state = newState;
    this._startMusicForState();
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  // ============================================================
  // Игровой цикл — фиксированный шаг физики
  // ВАЖНО: input.endFrame() вызывается ПОСЛЕ каждого шага физики,
  // чтобы оба игрока корректно получали "wasPressed" в одном кадре.
  // ============================================================
  loop(timestamp) {
    if (!this.running) return;

    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    if (dt > 0.1) dt = 0.1;

    this.accumulator += dt;

    let iterations = 0;
    while (this.accumulator >= FIXED_STEP && iterations < MAX_ITERATIONS) {
      this.update(FIXED_STEP);
      this.input.endFrame();
      this.accumulator -= FIXED_STEP;
      iterations++;
    }

    if (iterations >= MAX_ITERATIONS) {
      this.accumulator = 0;
    }

    this.render(dt);

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    switch (this.state) {
      case GameState.MENU:
        break;

      case GameState.PLAYING:
        this._updatePlaying(dt);
        break;

      case GameState.CUTSCENE_INTRO:
      case GameState.CUTSCENE_LEVEL:
      case GameState.CUTSCENE_FINAL:
        this.cutscene.update(dt, this.input);
        break;

      default:
        break;
    }
  }

  // ============================================================
  // Обновление во время игры.
  // Мёртвый игрок возрождается через 1.2 сек, жизни -1.
  // Уровень НЕ перезапускается, второй игрок продолжает.
  // ============================================================
  _updatePlaying(dt) {
    if (!this.level) return;

    this.levelTime += dt;
    this.level.update(dt, this.input);
    this.camera.follow(this.level.players, dt);

    // Возрождение мёртвых
    for (const p of this.level.players) {
      if (!p.alive && p.deathTimer >= 1.2) {
        if (this.lives > 1) {
          this.lives--;
          p.alive = true;
          p.x = p.spawnX;
          p.y = p.spawnY;
          p.vx = 0;
          p.vy = 0;
          p.deathTimer = 0;
          p.particles = [];
          p.onGround = false;
          p.jumpsLeft = p.canDoubleJump ? 2 : 1;
        } else {
          // Последняя жизнь — game over
          this.lives = 0;
          this.audio.stopMusic();
          this.audio.playLose();
          this.changeState(GameState.GAME_OVER);
          return;
        }
      }
    }

    if (this.level.completed && this.state === GameState.PLAYING) {
      this._onLevelComplete();
    }
  }

  _onLevelComplete() {
    this.audio.stopMusic();
    this.audio.playWin();
    const time = this.levelTime;
    const crystals = this.level.collectedCrystals;
    const total = this.level.totalCrystals;
    const stars = this.level.getStars(time, crystals, total);

    this.levelResult = { time, stars, crystals, total, animTime: 0 };

    SaveManager.setStars(this.save, this.currentLevelIndex, stars);
    const best = this.save.levelBestTime[this.currentLevelIndex] || Infinity;
    if (time < best) this.save.levelBestTime[this.currentLevelIndex] = time;
    if (this.currentLevelIndex < 12) {
      SaveManager.unlockLevel(this.save, this.currentLevelIndex + 1);
    }
    this.persistSave();

    for (let i = 0; i < stars; i++) {
      setTimeout(() => this.audio.playStar(i), 500 + i * 500);
    }

    this.changeState(GameState.LEVEL_COMPLETE);
  }

  render(dt) {
    const r = this.renderer;

    switch (this.state) {
      case GameState.MENU:
        this.ui.drawMainMenu(dt, this.input);
        break;

      case GameState.LEVEL_SELECT:
        this.ui.drawLevelSelect(dt, this.input);
        break;

      case GameState.HOW_TO_PLAY:
        this.ui.drawHowToPlay(dt, this.input);
        break;

      case GameState.SETTINGS:
        this.ui.drawSettings(dt, this.input);
        break;

      case GameState.PLAYING:
        r.clear('#000000');
        r.drawBackground(dt);
        if (this.level) r.drawLevel(this.level, this.camera);
        r.drawHUD(this);
        break;

      case GameState.PAUSED:
        r.clear('#000000');
        r.drawBackground(dt);
        if (this.level) r.drawLevel(this.level, this.camera);
        r.drawHUD(this);
        this.ui.drawPause(dt, this.input);
        break;

      case GameState.LEVEL_COMPLETE:
        r.clear('#000000');
        r.drawBackground(dt);
        this.ui.drawLevelComplete(dt, this.input);
        break;

      case GameState.GAME_OVER:
        r.clear('#000000');
        r.drawBackground(dt);
        this.ui.drawGameOver(dt, this.input);
        break;

      case GameState.CUTSCENE_INTRO:
      case GameState.CUTSCENE_LEVEL:
      case GameState.CUTSCENE_FINAL:
        this.cutscene.render();
        break;
    }
  }

  // ---------- Публичные методы ----------
  startNewGame() {
    this.lives = 3;
    this.currentLevelIndex = 1;
    this.startIntroCutscene();
  }

  startIntroCutscene() {
    this.changeState(GameState.CUTSCENE_INTRO);
    this.cutscene.start(INTRO_CUTSCENE, () => {
      this.startLevel(this.currentLevelIndex);
    });
  }

  startLevel(index) {
    if (index < 1 || index > 12) return;
    if (!SaveManager.isLevelUnlocked(this.save, index)) return;
    this.currentLevelIndex = index;
    const data = LEVELS[index - 1];
    this.level = new Level(data);
    this.levelTime = 0;
    this.lives = 3;
    this.camera.setWorldBounds(data.width, data.height);
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.zoom = 1;

    const hint = getLevelHint(index);
    if (hint && this.save.settings.showHints) {
      this.changeState(GameState.CUTSCENE_LEVEL);
      this.cutscene.start([hint], () => {
        this.changeState(GameState.PLAYING);
      });
    } else {
      this.changeState(GameState.PLAYING);
    }
  }

  restartLevel() {
    if (!this.level) return;
    this.level.reset();
    this.levelTime = 0;
    this.lives = 3;
    this.changeState(GameState.PLAYING);
    this._startMusicForState();
  }

  pause() {
    if (this.state !== GameState.PLAYING) return;
    this.changeState(GameState.PAUSED);
  }

  resume() {
    if (this.state !== GameState.PAUSED) return;
    this.changeState(GameState.PLAYING);
  }

  playFinalCutscene() {
    this.changeState(GameState.CUTSCENE_FINAL);
    this.cutscene.start(FINAL_CUTSCENE, () => {
      this.changeState(GameState.MENU);
    });
  }
}