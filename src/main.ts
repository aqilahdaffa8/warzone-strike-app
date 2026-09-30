import { Game } from './core/Game';

function initialize(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) {
    console.error('Fatal: Failed to find canvas element with id #game-canvas');
    return;
  }

  const game = new Game(canvas);
  game.start();
}

window.addEventListener('DOMContentLoaded', initialize);
