import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { UI_OFF_X, UI_OFF_Y } from './TransitionSystem';
import { AudioManager } from './AudioManager';
import { getPortraitKey, loadPortraits as queuePortraitFiles } from './CharacterSprite';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface DialogueOptions {
  lines: DialogueLine[];
  onComplete?: () => void;
  /** Se true, ogni pagina avanza automaticamente dopo il typewriter + autoAdvanceDelay ms */
  autoAdvance?: boolean;
  /** Millisecondi di pausa DOPO l'ultimo carattere prima di avanzare (default 1800) */
  autoAdvanceDelay?: number;
}

/** Colore del nome per ogni personaggio. */
export const SPEAKER_COLORS: Record<string, string> = {
  umberto: '#6ab0ff',
  bubi: '#88dd66',
  cece: '#ffdd44',
  chiara: '#ff88cc',
  trande: '#ffaa55',
  ilaria: '#cc88ff',
  guglielmo: '#44ccaa',
  aniceto: '#dd6655',
  riccardo: '#7799ee',
  stefano: '#cccccc',
  soccorritore: '#aaccff',
  lerry:    '#ff9933',
  cosimino: '#bbbb77',
  christian: '#77bbdd',
  beatrice: '#ee77bb',
  'alessandra marzo': '#ff99cc',
  gnumma: '#994422',
};

const DEFAULT_NAME_COLOR = '#ffffff';
const TYPE_DELAY_MS = 35;
const FONT_FAMILY = '"Press Start 2P", monospace';
const FONT_SIZE = 6;
const LINE_SPACING = Math.round(FONT_SIZE * 0.6); // line-height 1.6
const MAX_VISIBLE_LINES = 2;
const BOX_HEIGHT_RATIO = 0.22;
const PORTRAIT_SIZE = 40;
const PORTRAIT_RADIUS = 6;
const PAD = 8;
const BORDER = 2;
const DEPTH = 1000;

interface Page {
  speaker: string;
  text: string;
}

/**
 * Sistema di dialogo a box fisso in basso.
 *
 * Mentre un dialogo è attivo:
 * - `dialogue.isActive` è true → il player deve controllarlo e non muoversi:
 *     if (this.dialogue.isActive) { player.setVelocity(0); return; }
 * - la scena emette gli eventi 'dialogue-start' / 'dialogue-end'.
 */
export class DialogueSystem {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly portraitRing: Phaser.GameObjects.Graphics;
  private readonly placeholder: Phaser.GameObjects.Graphics;
  private readonly placeholderInitial: Phaser.GameObjects.Text;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly portraitX: number;
  private readonly portraitY: number;

  private pages: Page[] = [];
  private pageIndex = 0;
  private fullText = '';
  private charIndex = 0;
  private typing = false;
  private typeTimer?: Phaser.Time.TimerEvent;
  private autoTimer?: Phaser.Time.TimerEvent;
  private autoAdvance = false;
  private autoAdvanceDelay = 1800;
  private onComplete?: () => void;
  private currentSpeaker = '';
  private lastShownSpeaker = '';
  private readonly attemptedPortraits = new Set<string>();
  private _active = false;
  private promptArrow!: Phaser.GameObjects.Text;
  private blinkTween?: Phaser.Tweens.Tween;

  get isActive(): boolean {
    return this._active;
  }

  /** Container UI del dialogo — usato per escluderlo dalla camera principale durante zoom. */
  get uiContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Dimensioni del MONDO (480x270), non del canvas: con il rendering 2x
    // scene.scale è 960x540 e il box finirebbe fuori dall'area visibile.
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;
    const boxH = Math.round(h * BOX_HEIGHT_RATIO); // ~59px
    const boxY = h - boxH;

    // Sfondo nero semi-trasparente con bordo bianco 2px
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, boxY, w, boxH);
    bg.lineStyle(BORDER, 0xffffff, 1);
    bg.strokeRect(BORDER / 2, boxY + BORDER / 2, w - BORDER, boxH - BORDER);

    // Portrait 40x40 a sinistra, centrato verticalmente
    this.portraitX = PAD;
    this.portraitY = Math.round(boxY + (boxH - PORTRAIT_SIZE) / 2);
    const pcx = this.portraitX + PORTRAIT_SIZE / 2;
    const pcy = this.portraitY + PORTRAIT_SIZE / 2;

    // Placeholder colorato (rettangolo arrotondato + iniziale)
    this.placeholder = scene.add.graphics();
    this.placeholderInitial = scene.add
      .text(pcx, pcy, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: '#000000',
      })
      .setOrigin(0.5);

    // Cornice colorata per personaggio attorno al ritratto
    this.portraitRing = scene.add.graphics();

    // Immagine portrait con angoli arrotondati via geometry mask
    this.portrait = scene.add.image(pcx, pcy, '__WHITE').setVisible(false);
    const maskShape = scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRoundedRect(
      this.portraitX,
      this.portraitY,
      PORTRAIT_SIZE,
      PORTRAIT_SIZE,
      PORTRAIT_RADIUS
    );
    maskShape.setScrollFactor(0);
    maskShape.setPosition(UI_OFF_X, UI_OFF_Y); // stesso offset UI del container
    this.portrait.setMask(maskShape.createGeometryMask());

    // Nome (colorato) sopra il testo
    const textX = PAD + PORTRAIT_SIZE + PAD;
    this.nameText = scene.add.text(textX, boxY + PAD, '', {
      fontFamily: FONT_FAMILY,
      fontSize: `${FONT_SIZE}px`,
      color: DEFAULT_NAME_COLOR,
    });

    // Corpo del testo, max 2 righe visibili
    this.bodyText = scene.add.text(textX, boxY + PAD + FONT_SIZE + 6, '', {
      fontFamily: FONT_FAMILY,
      fontSize: `${FONT_SIZE}px`,
      color: '#ffffff',
      lineSpacing: LINE_SPACING,
      wordWrap: { width: w - textX - PAD },
    });

    // Indicatore "click per continuare" — ▼ lampeggiante in basso a destra del box
    this.promptArrow = scene.add
      .text(w - 6, h - 4, '▼', {
        fontFamily: FONT_FAMILY,
        fontSize: '6px',
        color: '#ffffff',
      })
      .setOrigin(1, 1)
      .setAlpha(0);

    // Offset UI: compensa l'ancoraggio dello zoom al centro del canvas
    this.container = scene.add
      .container(UI_OFF_X, UI_OFF_Y, [
        bg,
        this.placeholder,
        this.placeholderInitial,
        this.portrait,
        this.portraitRing,
        this.nameText,
        this.bodyText,
        this.promptArrow,
      ])
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    // Input: click / Spazio / Enter
    scene.input.on('pointerdown', this.handleAdvance, this);
    const kb = scene.input.keyboard;
    if (kb) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', this.handleAdvance, this);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', this.handleAdvance, this);
    }

    // Gestione caricamento lazy dei portrait
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      if (this._active && key.startsWith(`portrait-${this.currentSpeaker}-`)) {
        this.updatePortrait(this.currentSpeaker);
      }
    });
  }

  /** Avvia un dialogo. Ignorato se un dialogo è già attivo. */
  start(options: DialogueOptions): void {
    if (this._active || options.lines.length === 0) return;
    this.onComplete = options.onComplete;
    this.autoAdvance = options.autoAdvance ?? false;
    this.autoAdvanceDelay = options.autoAdvanceDelay ?? 1800;
    this.pages = this.buildPages(options.lines);
    this.loadPortraits(options.lines);
    this._active = true;
    this.lastShownSpeaker = '';
    this.scene.events.emit('dialogue-start');

    // Entrata animata: il box sale dal basso con leggero overshoot
    this.scene.tweens.killTweensOf(this.container);
    this.container.setVisible(true).setAlpha(0).setY(UI_OFF_Y + 16);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: UI_OFF_Y,
      duration: 240,
      ease: 'Back.easeOut',
    });

    this.showPage(0);
  }

  /** Interrompe immediatamente il dialogo in corso (senza chiamare onComplete). */
  stop(): void {
    if (!this._active) return;
    this.typeTimer?.remove();
    this.autoTimer?.remove();
    this.autoTimer = undefined;
    this._active = false;
    this.container.setVisible(false);
    this.onComplete = undefined;
  }

  destroy(): void {
    this.typeTimer?.remove();
    this.autoTimer?.remove();
    this.scene.input.off('pointerdown', this.handleAdvance, this);
    this.container.destroy();
  }

  /** Spezza ogni riga in pagine da max 2 righe visibili (word wrap). */
  private buildPages(lines: DialogueLine[]): Page[] {
    const pages: Page[] = [];
    for (const line of lines) {
      const wrapped = this.bodyText.getWrappedText(line.text);
      for (let i = 0; i < wrapped.length; i += MAX_VISIBLE_LINES) {
        pages.push({
          speaker: line.speaker,
          text: wrapped.slice(i, i + MAX_VISIBLE_LINES).join('\n'),
        });
      }
    }
    return pages;
  }

  private loadPortraits(lines: DialogueLine[]): void {
    const speakers = [...new Set(lines.map((l) => l.speaker))];
    let queued = false;
    for (const s of speakers) {
      if (getPortraitKey(this.scene, s) || this.attemptedPortraits.has(s)) continue;
      this.attemptedPortraits.add(s);
      queuePortraitFiles(this.scene, [s]);
      queued = true;
    }
    if (queued) this.scene.load.start();
  }

  private showPage(index: number): void {
    this.pageIndex = index;
    const page = this.pages[index];
    this.updatePortrait(page.speaker);

    this.nameText
      .setText(page.speaker.toUpperCase())
      .setColor(SPEAKER_COLORS[page.speaker] ?? DEFAULT_NAME_COLOR);

    // Pop del ritratto e del nome quando cambia chi parla
    if (page.speaker !== this.lastShownSpeaker) {
      this.lastShownSpeaker = page.speaker;
      this.popIn(this.portrait);
      this.popIn(this.nameText);
    }

    // Nascondi il prompt mentre si scrive
    this.hidePromptArrow();

    // Typewriter: 35ms a carattere
    this.fullText = page.text;
    this.charIndex = 0;
    this.bodyText.setText('');
    this.typing = true;
    this.typeTimer?.remove();
    this.typeTimer = this.scene.time.addEvent({
      delay: TYPE_DELAY_MS,
      repeat: this.fullText.length - 1,
      callback: () => {
        this.charIndex++;
        this.bodyText.setText(this.fullText.slice(0, this.charIndex));
        // bip ogni 3 lettere (ogni lettera è troppo fastidioso)
        if (this.charIndex % 3 === 0) {
          AudioManager.get().playSFX(this.scene, 'text', 0.2);
        }
        if (this.charIndex >= this.fullText.length) {
          this.typing = false;
          if (this.autoAdvance) {
            this.autoTimer = this.scene.time.delayedCall(
              this.autoAdvanceDelay,
              () => this.handleAdvance(),
            );
          } else {
            // Mostra il prompt di avanzamento
            this.showPromptArrow();
          }
        }
      },
    });
  }

  /** Piccolo "pop" elastico su un elemento (mantiene la scala originale). */
  private popIn(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Graphics): void {
    const sx = obj.scaleX;
    const sy = obj.scaleY;
    this.scene.tweens.killTweensOf(obj);
    obj.setScale(sx * 0.75, sy * 0.75);
    this.scene.tweens.add({
      targets: obj,
      scaleX: sx,
      scaleY: sy,
      duration: 160,
      ease: 'Back.easeOut',
    });
  }

  private showPromptArrow(): void {
    this.blinkTween?.stop();
    this.promptArrow.setAlpha(1);
    this.blinkTween = this.scene.tweens.add({
      targets: this.promptArrow,
      alpha: 0,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private hidePromptArrow(): void {
    this.blinkTween?.stop();
    this.blinkTween = undefined;
    this.promptArrow.setAlpha(0);
  }

  private updatePortrait(speaker: string): void {
    this.currentSpeaker = speaker;
    const key = getPortraitKey(this.scene, speaker);

    // Cornice "ritratto" col colore identità del personaggio
    const ringColor = Phaser.Display.Color.HexStringToColor(
      SPEAKER_COLORS[speaker] ?? DEFAULT_NAME_COLOR
    ).color;
    this.portraitRing.clear();
    this.portraitRing.lineStyle(1, 0xffffff, 0.7);
    this.portraitRing.strokeRoundedRect(
      this.portraitX - 2,
      this.portraitY - 2,
      PORTRAIT_SIZE + 4,
      PORTRAIT_SIZE + 4,
      PORTRAIT_RADIUS + 2
    );
    this.portraitRing.lineStyle(2, ringColor, 1);
    this.portraitRing.strokeRoundedRect(
      this.portraitX - 1,
      this.portraitY - 1,
      PORTRAIT_SIZE + 2,
      PORTRAIT_SIZE + 2,
      PORTRAIT_RADIUS + 1
    );
    if (key) {
      // Le foto nel box chat si vedono alla qualità originale (filtro liscio)
      this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.portrait
        .setTexture(key)
        .setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE)
        .setVisible(true);
      this.placeholder.setVisible(false);
      this.placeholderInitial.setVisible(false);
    } else {
      this.portrait.setVisible(false);
      const hex = SPEAKER_COLORS[speaker] ?? DEFAULT_NAME_COLOR;
      const color = Phaser.Display.Color.HexStringToColor(hex).color;
      this.placeholder.clear();
      this.placeholder.fillStyle(color, 1);
      this.placeholder.fillRoundedRect(
        this.portraitX,
        this.portraitY,
        PORTRAIT_SIZE,
        PORTRAIT_SIZE,
        PORTRAIT_RADIUS
      );
      this.placeholder.setVisible(true);
      this.placeholderInitial.setText(speaker.charAt(0).toUpperCase()).setVisible(true);
    }
  }

  private handleAdvance(): void {
    if (!this._active) return;

    // Cancella eventuale timer auto-advance in corso
    this.autoTimer?.remove();
    this.autoTimer = undefined;

    // Nasconde subito il prompt (qualunque cosa succeda dopo)
    this.hidePromptArrow();

    AudioManager.get().playSFX(this.scene, 'confirm', 0.8);

    if (this.typing) {
      // Testo in corso → mostra tutto subito, poi aspetta il delay (se autoAdvance)
      this.typeTimer?.remove();
      this.typing = false;
      this.bodyText.setText(this.fullText);
      if (this.autoAdvance) {
        this.autoTimer = this.scene.time.delayedCall(
          this.autoAdvanceDelay,
          () => this.handleAdvance(),
        );
      } else {
        // Testo completo ma non autoAdvance: mostra subito il prompt
        this.showPromptArrow();
      }
      return;
    }

    if (this.pageIndex < this.pages.length - 1) {
      this.showPage(this.pageIndex + 1);
    } else {
      this.end();
    }
  }

  private end(): void {
    this._active = false;
    this.typeTimer?.remove();
    this.autoTimer?.remove();
    this.autoTimer = undefined;
    this.hidePromptArrow();
    // Uscita animata: fade rapido verso il basso, poi nascondi
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: UI_OFF_Y + 10,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this._active) this.container.setVisible(false).setAlpha(1).setY(UI_OFF_Y);
      },
    });
    this.scene.events.emit('dialogue-end');
    const cb = this.onComplete;
    this.onComplete = undefined;
    cb?.();
  }
}
