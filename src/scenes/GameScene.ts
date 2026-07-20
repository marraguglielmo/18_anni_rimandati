import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { TransitionSystem } from '../systems/TransitionSystem';

/** Per ora: schermata di fine demo dopo la battle. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(): void {
    TransitionSystem.fadeFromBlack(this, 600);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'FINE DEMO\n\n(continua...)', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
