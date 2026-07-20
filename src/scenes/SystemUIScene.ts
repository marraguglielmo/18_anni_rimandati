/**
 * SystemUIScene — scena parallela permanente (come MobileControlsScene).
 * Layer di sistema sopra al gioco, canvas 960×540, nessuna camera zoom:
 *
 *  • Pausa universale — P (mette in pausa tutte le scene di gioco)
 *  • Mute — M, persistente
 *  • Toast retrò (eventi globali 'fable18-toast')
 *  • Coriandoli full-screen (eventi 'fable18-confetti')
 *  • Easter egg: Konami code (↑↑↓↓←→←→BA) e parole segrete digitate
 */
import Phaser from 'phaser';
import { Settings } from '../systems/Settings';
import { AudioManager } from '../systems/AudioManager';
import { getPortraitKey } from '../systems/CharacterSprite';

const FONT = '"Press Start 2P", monospace';

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
];

const CONFETTI_COLORS = [0xff5566, 0x55aaff, 0xffdd55, 0xaa66ff, 0x66dd88, 0xff88cc];

export class SystemUIScene extends Phaser.Scene {
  static readonly KEY = 'SystemUIScene';

  private isPausedByUs = false;
  private pausedSceneKeys: string[] = [];
  private pausePanel?: Phaser.GameObjects.Container;

  private konamiIdx = 0;
  private wordBuffer = '';
  private activeToasts = 0;

  constructor() {
    super({ key: SystemUIScene.KEY });
  }

  create(): void {
    this.game.sound.mute = Settings.data.muted;

    // ── Eventi globali ───────────────────────────────────────────────────
    this.game.events.on('fable18-toast', this.showToast, this);
    this.game.events.on('fable18-confetti', this.confettiStorm, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('fable18-toast', this.showToast, this);
      this.game.events.off('fable18-confetti', this.confettiStorm, this);
    });

    // ── Tastiera di sistema ──────────────────────────────────────────────
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      // Pausa / opzioni
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyM') this.toggleMute();

      // Konami code
      if (e.code === KONAMI[this.konamiIdx]) {
        this.konamiIdx++;
        if (this.konamiIdx >= KONAMI.length) {
          this.konamiIdx = 0;
          this.gnummaMode();
        }
      } else {
        this.konamiIdx = e.code === KONAMI[0] ? 1 : 0;
      }

      // Parole segrete digitate
      if (/^[a-z]$/i.test(e.key)) {
        this.wordBuffer = (this.wordBuffer + e.key.toLowerCase()).slice(-12);
        if (this.wordBuffer.endsWith('cece')) {
          this.wordBuffer = '';
          this.ceceEgg();
        } else if (this.wordBuffer.endsWith('gnumma')) {
          this.wordBuffer = '';
          this.gnummaMode();
        }
      }
    });
  }

  private toggleMute(): void {
    Settings.data.muted = !Settings.data.muted;
    Settings.save();
    this.game.sound.mute = Settings.data.muted;
    this.showToast(Settings.data.muted ? 'AUDIO: OFF' : 'AUDIO: ON');
  }

  // ═══════════════════════════════════════════════════════════════ pausa

  private togglePause(): void {
    if (this.isPausedByUs) {
      this.isPausedByUs = false;
      for (const key of this.pausedSceneKeys) this.scene.resume(key);
      this.pausedSceneKeys = [];
      this.game.sound.resumeAll();
      this.pausePanel?.destroy();
      this.pausePanel = undefined;
      return;
    }

    // Pausa tutte le scene attive tranne i layer di sistema
    const skip = new Set([SystemUIScene.KEY, 'MobileControlsScene']);
    this.pausedSceneKeys = this.game.scene
      .getScenes(true)
      .map((s) => s.scene.key)
      .filter((k) => !skip.has(k));
    if (this.pausedSceneKeys.length === 0) return;

    this.isPausedByUs = true;
    for (const key of this.pausedSceneKeys) this.scene.pause(key);
    this.game.sound.pauseAll();
    this.buildPausePanel();
  }

  private buildPausePanel(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    const veil = this.add.rectangle(cx, cy, W, H, 0x000000, 0.62);

    const panel = this.add.graphics();
    const PW = 380;
    const PH = 230;
    panel.fillStyle(0x0a0a14, 0.94);
    panel.fillRoundedRect(cx - PW / 2, cy - PH / 2, PW, PH, 10);
    panel.lineStyle(3, 0xffdd44, 1);
    panel.strokeRoundedRect(cx - PW / 2, cy - PH / 2, PW, PH, 10);

    const title = this.add
      .text(cx, cy - PH / 2 + 42, 'PAUSA', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    title.setShadow(3, 3, '#ff7700', 0, true, true);

    const lines = [
      '[P]  RIPRENDI',
      `[M]  AUDIO ${Settings.data.muted ? 'OFF' : 'ON'}`,
    ];
    const items = lines.map((txt, i) =>
      this.add
        .text(cx, cy - 14 + i * 32, txt, {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#dddddd',
        })
        .setOrigin(0.5)
    );

    const hint = this.add
      .text(cx, cy + PH / 2 - 24, 'psst... ↑↑↓↓←→←→ B A', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#555577',
      })
      .setOrigin(0.5);

    this.pausePanel = this.add
      .container(0, 0, [veil, panel, title, ...items, hint])
      .setDepth(9200)
      .setAlpha(0);
    this.tweens.add({ targets: this.pausePanel, alpha: 1, duration: 160 });
  }

  // ═══════════════════════════════════════════════════════════════ toast

  private showToast(text: string): void {
    const W = this.scale.width;
    const PAD = 14;
    const y = 24 + this.activeToasts * 52;
    this.activeToasts++;

    const t = this.add
      .text(0, 0, text, {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);

    const bw = t.width + PAD * 2;
    const bh = 38;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a14, 0.92);
    bg.fillRoundedRect(-PAD, -bh / 2, bw, bh, 7);
    bg.lineStyle(2, 0xffdd44, 1);
    bg.strokeRoundedRect(-PAD, -bh / 2, bw, bh, 7);
    bg.lineStyle(4, 0xffdd44, 1);
    bg.lineBetween(-PAD + 2, -bh / 2 + 7, -PAD + 2, bh / 2 - 7);

    const cont = this.add
      .container(W + 20, y + bh / 2, [bg, t])
      .setDepth(9300);

    AudioManager.get().playSFX(this, 'confirm', 0.5);
    this.tweens.add({
      targets: cont,
      x: W - bw - 10,
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.time.delayedCall(2600, () => {
      this.tweens.add({
        targets: cont,
        x: W + 30,
        alpha: 0,
        duration: 260,
        ease: 'Quad.easeIn',
        onComplete: () => {
          cont.destroy();
          this.activeToasts = Math.max(0, this.activeToasts - 1);
        },
      });
    });
  }

  // ═══════════════════════════════════════════════════════════ coriandoli

  private confettiStorm(count = 80): void {
    const W = this.scale.width;
    const H = this.scale.height;
    for (let i = 0; i < count; i++) {
      const piece = this.add
        .rectangle(
          Phaser.Math.Between(6, W - 6),
          Phaser.Math.Between(-H, -10),
          5,
          8,
          CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        )
        .setDepth(9100)
        .setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: piece,
        y: H + 20,
        x: piece.x + Phaser.Math.Between(-60, 60),
        angle: piece.angle + Phaser.Math.Between(180, 720),
        duration: Phaser.Math.Between(1600, 3200),
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════ easter egg

  /** Konami code (o digitare "gnumma"): GNUMMA MODE. */
  private gnummaMode(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const first = !Settings.data.gnummaUnlocked;
    Settings.data.gnummaUnlocked = true;
    Settings.save();

    AudioManager.get().playSFX(this, 'fanfare', 0.7);
    this.confettiStorm(160);
    this.showToast(first ? 'SEGRETO SBLOCCATO: GNUMMA MODE' : 'GNUMMA MODE!');

    // Onda arcobaleno additiva su tutto lo schermo
    const wave = this.add
      .rectangle(W / 2, H / 2, W, H, 0xff0000, 0.22)
      .setDepth(9050)
      .setBlendMode(Phaser.BlendModes.ADD);
    const hue = { t: 0 };
    this.tweens.add({
      targets: hue,
      t: 1,
      duration: 3600,
      onUpdate: () => {
        const c = Phaser.Display.Color.HSVToRGB((hue.t * 3) % 1, 0.85, 1) as Phaser.Display.Color;
        wave.setFillStyle(c.color, 0.22 * (1 - hue.t));
      },
      onComplete: () => wave.destroy(),
    });

    // Scritta gigante che sfonda
    const big = this.add
      .text(W / 2, H / 2, 'GNUMMA\nMODE', {
        fontFamily: FONT,
        fontSize: '44px',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 10,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(9150)
      .setScale(4)
      .setAlpha(0)
      .setAngle(-6);
    this.tweens.add({
      targets: big,
      scale: 1,
      alpha: 1,
      duration: 320,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: big,
          angle: 6,
          duration: 380,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut',
        });
        this.tweens.add({
          targets: big,
          alpha: 0,
          scale: 1.6,
          delay: 1900,
          duration: 420,
          onComplete: () => big.destroy(),
        });
      },
    });
  }

  /** Digitare "cece": lui vede tutto. */
  private ceceEgg(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const first = !Settings.data.ceceFound;
    Settings.data.ceceFound = true;
    Settings.save();

    AudioManager.get().playSFX(this, 'scontro', 0.5);
    this.showToast(first ? 'SEGRETO SBLOCCATO: L’OCCHIO DI CECE' : 'CECE TI OSSERVA...');

    // Flash giallo
    const flash = this.add
      .rectangle(W / 2, H / 2, W, H, 0xffdd44, 0.28)
      .setDepth(9040);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 450,
      onComplete: () => flash.destroy(),
    });

    // Il ritratto di Cece sbircia dal bordo destro
    const key = getPortraitKey(this, 'cece');
    if (key) {
      const img = this.add
        .image(W + 90, H - 130, key)
        .setDisplaySize(150, 150)
        .setDepth(9160)
        .setAngle(-10);
      this.tweens.add({
        targets: img,
        x: W - 62,
        duration: 340,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: img,
            angle: 8,
            duration: 300,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
          });
          this.tweens.add({
            targets: img,
            x: W + 110,
            delay: 1600,
            duration: 300,
            ease: 'Quad.easeIn',
            onComplete: () => img.destroy(),
          });
        },
      });
    }
  }
}
