// ============================================================
// Save.js — сохранение и загрузка прогресса в localStorage
// ============================================================

const SAVE_KEY = 'darkLight_save_v1';

const DEFAULT_SAVE = {
  unlockedLevels: [1],
  levelStars: {},
  levelBestTime: {},
  settings: {
    musicVolume: 0.6,
    sfxVolume: 0.8,
    showHints: true
  },
  customTextures: {}
};

export class SaveManager {
  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw);
      // Мягкое слияние с дефолтами — на случай обновлений схемы
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings || {}) }
      };
    } catch (e) {
      console.warn('Не удалось загрузить сохранение, используется дефолт:', e);
      return structuredClone(DEFAULT_SAVE);
    }
  }

  static save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Не удалось сохранить (возможно, переполнение localStorage):', e);
    }
  }

  static reset() {
    localStorage.removeItem(SAVE_KEY);
  }

  static unlockLevel(save, n) {
    if (!save.unlockedLevels.includes(n)) {
      save.unlockedLevels.push(n);
      save.unlockedLevels.sort((a, b) => a - b);
    }
  }

  static setStars(save, level, stars) {
    const cur = save.levelStars[level] || 0;
    if (stars > cur) save.levelStars[level] = stars;
  }

  static isLevelUnlocked(save, n) {
    return save.unlockedLevels.includes(n);
  }
}