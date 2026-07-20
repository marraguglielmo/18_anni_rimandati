import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import {
  addShadow,
  CHAR_CONFIGS,
  CHAR_SCALE,
  FRAME_H,
  generateSpriteTexture,
  loadPortraits,
  SHADOW_OFFSET_Y,
} from '../systems/CharacterSprite';
import { SPEAKER_COLORS } from '../systems/DialogueSystem';
import { TransitionSystem } from '../systems/TransitionSystem';

const CHAR_IDS = ['umberto', 'bubi', 'cece', 'chiara', 'trande', 'ilaria', 'guglielmo', 'aniceto'];
const WALK_SPEED = 20; // px/s verso il basso

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  shadow: Phaser.GameObjects.Ellipse;
}

export class PreviewScene extends Phaser.Scene {
  private walkers: Walker[] = [];

  constructor() {
    super('PreviewScene');
  }

  preload(): void {
    // Foto dei volti: se un file manca, il sistema usa la faccia disegnata
    loadPortraits(this, CHAR_IDS);
  }

  create(): void {
    TransitionSystem.fadeFromBlack(this, 300);
    this.add
      .text(GAME_WIDTH / 2, 14, 'CHARACTER PREVIEW', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#555555',
      })
      .setOrigin(0.5);

    const step = GAME_WIDTH / CHAR_IDS.length;
    CHAR_IDS.forEach((id, i) => {
      const key = generateSpriteTexture(this, id, CHAR_CONFIGS[id]);
      const x = Math.round(step * (i + 0.5));

      const shadow = addShadow(this, x, 100);
      const sprite = this.add.sprite(x, 100, key, 1).setScale(CHAR_SCALE);
      sprite.play(`${id}-walk-down`);

      const label = this.add
        .text(x, 100 + FRAME_H / 2 + 4, id.toUpperCase(), {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '6px',
          color: SPEAKER_COLORS[id] ?? '#ffffff',
        })
        .setOrigin(0.5, 0);

      this.walkers.push({ sprite, label, shadow });
    });
  }

  update(_time: number, delta: number): void {
    const dy = (WALK_SPEED * delta) / 1000;
    for (const w of this.walkers) {
      w.sprite.y += dy;
      if (w.sprite.y > GAME_HEIGHT + FRAME_H) w.sprite.y = -FRAME_H;
      w.label.y = w.sprite.y + FRAME_H / 2 + 4;
      w.shadow.setPosition(w.sprite.x, w.sprite.y + SHADOW_OFFSET_Y);
    }
  }
}
