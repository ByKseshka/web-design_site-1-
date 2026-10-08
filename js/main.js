// ============================================================
// main.js — точка входа
// Инициализация игры, привязка к Canvas, запуск цикла
// ============================================================

import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);
  game.start();

  // Делаем игру доступной из консоли для отладки
  window.__game = game;
});