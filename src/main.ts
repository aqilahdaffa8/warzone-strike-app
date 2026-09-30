import * as THREE from 'three';
import { Game } from './core/Game';

function initialize(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) {
    console.error('Fatal: Failed to find canvas element with id #game-canvas');
    return;
  }

  (window as unknown as { THREE: typeof THREE }).THREE = THREE;
  const game = new Game(canvas);
  game.start();
  (window as unknown as { __WARZONE_GAME__: Game }).__WARZONE_GAME__ = game;
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
