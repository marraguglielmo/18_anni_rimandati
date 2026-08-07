import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { DialogueSystem } from '../systems/DialogueSystem';
import { TransitionSystem } from '../systems/TransitionSystem';

const TEST_LINES = [
  {
    speaker: 'bubi',
    text: 'Porcodiddio vagnoni, siamo gli unici senza il video del 18esimo',
  },
  {
    speaker: 'umberto',
    text: 'È un vuoto assurdo. Senza quel video è come se non fossimo mai diventati maggiorenni',
  },
  {
    speaker: 'cece',
    text: 'Ou cujuni... se volete questo video ve lo genero io con l\'AI! ahahaha!',
  },
];

export class TestScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;

  constructor() {
    super('TestScene');
  }

  create(): void {
    TransitionSystem.fadeFromBlack(this, 300);
    this.add
      .text(GAME_WIDTH / 2, 40, 'DIALOGUE TEST', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#444444',
      })
      .setOrigin(0.5);

    this.dialogue = new DialogueSystem(this);

    // Esempio: il player controllerebbe this.dialogue.isActive per bloccarsi.
    this.startDialogue();
  }

  private startDialogue(): void {
    this.dialogue.start({
      lines: TEST_LINES,
      onComplete: () => {
        const done = this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'FINE DIALOGO\n\npremi per ripetere', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            color: '#ffffff',
            align: 'center',
          })
          .setOrigin(0.5);
        // Piccolo delay per non catturare lo stesso click che ha chiuso il dialogo
        this.time.delayedCall(100, () => {
          this.input.once('pointerdown', () => {
            done.destroy();
            this.startDialogue();
          });
        });
      },
    });
  }
}
