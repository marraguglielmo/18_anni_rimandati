import Phaser from 'phaser';

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
/**
 * Risoluzione di rendering: il mondo resta 480x270 (coordinate invariate)
 * ma il canvas è 2x e ogni scena zooma la camera di 2. Così le FOTO dei
 * personaggi hanno il doppio dei pixel reali e si vedono nitide, mentre
 * la pixel art disegnata mantiene il suo look.
 */
export const RENDER_SCALE = 2;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  parent: 'game',
  backgroundColor: '#000000',
  pixelArt: true, // disabilita antialiasing, round pixels
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
};
