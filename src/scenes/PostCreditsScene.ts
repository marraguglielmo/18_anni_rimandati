import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from '../config';
import { DialogueSystem, type DialogueLine } from '../systems/DialogueSystem';
import { TransitionSystem } from '../systems/TransitionSystem';
import {
  CHAR_CONFIGS,
  CHAR_SCALE,
  SHADOW_OFFSET_Y,
  addShadow,
  addNameLabel,
  generateSpriteTexture,
  loadPortraits,
} from '../systems/CharacterSprite';

const FONT = '"Press Start 2P", monospace';
const W = GAME_WIDTH;   // 480
const H = GAME_HEIGHT;  // 270

// Gruppo presente nella scena post-credits (piazza Cappuccini, 2026).
const GROUP = [
  'umberto', 'bubi', 'trande', 'guglielmo', 'aniceto',
  'ilaria', 'pietro', 'riccardo', 'stefano',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
//  DIALOGHI — placeholder: modificali pure liberamente.
// ─────────────────────────────────────────────────────────────────────────────

/** Chiacchiere del gruppo prima che arrivi Cece (scorrono da sole). */
const GROUP_CHAT: DialogueLine[] = [
  { speaker: 'umberto', text: 'Ragazzi, gelato?' },
  { speaker: 'ilaria',  text: 'A regà... ma hanno aperto il kebabbaro nuovo?' },
  { speaker: 'bubi',    text: 'Ehh ma ci ne sai tie...' },
];

/** Prima battuta di Cece appena arrivato (come nella scena iniziale). */
const CECE_ARRIVE: DialogueLine[] = [
  { speaker: 'cece', text: 'meh vagnoni... vi è piaciuto davvero?' },
];

/** Le 5 risposte del gruppo (placeholder: le scriverai tu). */
const RESPONSES: DialogueLine[] = [
  { speaker: 'trande',    text: 'Io voglio la mamma.' },
  { speaker: 'guglielmo', text: 'Cece ma tu già correvi?' },
  { speaker: 'pietro',    text: 'Vagnoni sciamune a casa.' },
  { speaker: 'aniceto',   text: 'Ahahahah palle nel culo.' },
  { speaker: 'stefano',   text: 'Figa che è sta merda?' },
];

/** Ultima frase di chiusura di Cece, guardando la camera. */
const CECE_FINAL: DialogueLine[] = [
  { speaker: 'cece', text: 'Vabe... *sorrisetto*' },
  { speaker: 'aniceto',   text: 'Cece quindi prossima festa??' },
  { speaker: 'cece', text: 'Eh amico mio... questa è un\'altra storia...' },
];

// ─────────────────────────────────────────────────────────────────────────────

export class PostCreditsScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;
  private cece!: Phaser.GameObjects.Sprite;
  private uiCam?: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super('PostCreditsScene');
  }

  preload(): void {
    loadPortraits(this, [...GROUP, 'cece']);
  }

  create(): void {
    TransitionSystem.fadeFromBlack(this, 700);

    for (const id of [...GROUP, 'cece']) {
      generateSpriteTexture(this, id, CHAR_CONFIGS[id]);
    }

    this.drawScene();
    this.placeGroup();

    this.dialogue = new DialogueSystem(this);
    this.time.delayedCall(900, () => void this.run());
  }

  // ─── Flusso ─────────────────────────────────────────────────────────────────

  private async run(): Promise<void> {
    // 1. Il gruppo chiacchiera (l'utente avanza con spazio/invio/click)
    await this.dlg(GROUP_CHAT);
    await this.delay(300);

    // 2. Arriva Cece dal basso, come nella scena iniziale
    await this.ceceWalksIn();
    await this.delay(250);

    // 3. Prima battuta di Cece (click per avanzare)
    await this.dlg(CECE_ARRIVE);

    // 4. Le 5 risposte del gruppo (click per avanzare)
    await this.dlg(RESPONSES);

    // 5. Cece si gira verso la camera (idle-down = guarda l'utente), zoom su di
    //    lui e frase finale; poi zoom-out prima dell'implosione.
    this.cece.play('cece-idle-down');
    await this.delay(400);
    await this.zoomOnCece();
    await this.dlg(CECE_FINAL);
    await this.delay(200);
    await this.zoomOutCece();
    await this.delay(200);

    // 6. Implosione verso il bianco + scritta finale
    await this.implodeToWhite();
  }

  // ─── Helpers dialogo ─────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  /** Dialogo con click/spazio/invio per avanzare. */
  private dlg(lines: DialogueLine[]): Promise<void> {
    return new Promise(resolve => this.dialogue.start({ lines, onComplete: resolve }));
  }

  // ─── Zoom stretto su Cece (come nella scena a casa) ──────────────────────────

  /** Zoom-in sulla camera principale su Cece; il dialogo resta nitido su una
   *  camera UI separata a zoom base. */
  private async zoomOnCece(): Promise<void> {
    const mainCam = this.cameras.main;
    const canvas = this.sys.game.canvas;

    // Camera UI: vede SOLO il box del dialogo, a zoom base
    this.uiCam = this.cameras.add(0, 0, canvas.width, canvas.height);
    this.uiCam.setZoom(RENDER_SCALE).centerOn(W / 2, H / 2);
    const dialogueCont = this.dialogue.uiContainer;
    const worldObjs = (this.children.list as Phaser.GameObjects.GameObject[])
      .filter(o => o !== dialogueCont);
    this.uiCam.ignore(worldObjs);
    mainCam.ignore(dialogueCont);   // il dialogo lo rende solo la uiCam

    mainCam.pan(this.cece.x, this.cece.y, 1200, 'Sine.easeInOut');
    mainCam.zoomTo(5.5, 1200, 'Sine.easeInOut');
    await this.delay(1300);
  }

  /** Ritorno all'inquadratura base prima dell'implosione. */
  private async zoomOutCece(): Promise<void> {
    const mainCam = this.cameras.main;
    if (this.uiCam) { this.cameras.remove(this.uiCam); this.uiCam = undefined; }
    mainCam.pan(W / 2, H / 2, 800, 'Sine.easeInOut');
    mainCam.zoomTo(RENDER_SCALE, 800, 'Sine.easeInOut');
    await this.delay(850);
  }

  // ─── Arrivo di Cece (come nella scena iniziale) ──────────────────────────────

  private ceceWalksIn(): Promise<void> {
    const cece = this.add.sprite(240, H + 20, 'char-cece', 1)
      .setScale(CHAR_SCALE).setDepth(H + 20);
    const shadow = addShadow(this, cece.x, cece.y);
    const label = addNameLabel(this, cece.x, cece.y, 'cece');
    cece.play('cece-walk-up');
    this.cece = cece;

    return new Promise(resolve => {
      this.tweens.add({
        targets: cece,
        y: 224,
        duration: 1500,
        ease: 'Linear',
        onUpdate: () => {
          cece.setDepth(cece.y);
          shadow.setPosition(cece.x, cece.y + SHADOW_OFFSET_Y).setDepth(cece.y - 1);
          label.setPosition(cece.x, cece.y - 20).setDepth(cece.y + 1);
        },
        onComplete: () => { cece.play('cece-idle-up'); resolve(); },
      });
    });
  }

  // ─── Personaggi del gruppo ───────────────────────────────────────────────────

  private placeGroup(): void {
    // Sparpagliati per la piazza, a scala piena come nel resto del gioco.
    // addShadow/addNameLabel gestiscono da soli offset dei piedi e altezza nome.
    // [id, x, y, direzione sguardo]
    const defs: [string, number, number, string][] = [
      ['stefano',    66, 152, 'right'],
      ['pietro',    210, 146, 'down'],
      ['guglielmo', 352, 158, 'left'],
      ['riccardo',  128, 188, 'down'],
      ['umberto',   276, 188, 'left'],
      ['ilaria',    414, 196, 'left'],
      ['trande',     90, 232, 'right'],
      ['aniceto',   190, 236, 'down'],
      ['bubi',      312, 232, 'up'],
    ];
    for (const [id, x, y, dir] of defs) {
      this.add.sprite(x, y, `char-${id}`, 1)
        .setScale(CHAR_SCALE).setDepth(y)
        .play(`${id}-idle-${dir}`);
      addShadow(this, x, y);        // ombra ai piedi (offset interno)
      addNameLabel(this, x, y, id); // nome sopra la testa (altezza corretta)
    }
  }

  // ─── Grafica: piazza Cappuccini di notte (2026) ──────────────────────────────

  private drawScene(): void {
    const g = this.add.graphics().setDepth(-10);

    // ── Cielo notturno ──────────────────────────────────────────────────
    g.fillStyle(0x0b1226, 1); g.fillRect(0, 0, W, 96);
    g.fillStyle(0x14203f, 1); g.fillRect(0, 70, W, 26);
    // luna + stelle
    g.fillStyle(0xf2ead0, 1); g.fillCircle(60, 26, 10);
    g.fillStyle(0x0b1226, 1); g.fillCircle(66, 22, 9);
    for (const [sx, sy] of [
      [110, 14], [150, 30], [300, 12], [340, 26], [420, 16], [450, 34], [250, 20], [200, 10],
    ] as [number, number][]) {
      g.fillStyle(0xdde0ff, 1); g.fillRect(sx, sy, 1, 1);
    }

    // ── Chiesa dei Cappuccini (centro, silhouette notturna) ──────────────
    g.fillStyle(0x2a2c3a, 1); g.fillRect(196, 26, 108, 70);
    g.fillStyle(0x232533, 1); g.fillTriangle(190, 28, 310, 28, 250, 2);
    g.fillStyle(0x1c1e2a, 1); g.fillRect(190, 24, 120, 4);   // cornicione
    g.fillStyle(0x3a3d4e, 1); g.fillRect(196, 26, 6, 70);    // lesena sx
    g.fillRect(298, 26, 6, 70);                               // lesena dx
    // croce
    g.fillStyle(0x4a4d5e, 1); g.fillRect(248, -8, 4, 12); g.fillRect(244, -4, 12, 4);
    // rosone illuminato
    g.fillStyle(0x2b4a6a, 1); g.fillCircle(250, 52, 8);
    g.fillStyle(0x6ea8d8, 0.9); g.fillCircle(250, 52, 5);
    // portone con luce calda
    g.fillStyle(0x120c06, 1); g.fillRect(238, 70, 24, 26); g.fillCircle(250, 70, 12);
    g.fillStyle(0xffcc66, 0.35); g.fillRect(243, 82, 14, 14);

    // ── Caffè Cappuccini (sinistra) ──────────────────────────────────────
    g.fillStyle(0x3b3527, 1); g.fillRect(38, 46, 80, 50);
    g.lineStyle(1, 0x2a2519); g.strokeRect(38, 46, 80, 50);
    g.fillStyle(0xffd27a, 0.85); g.fillRect(48, 58, 18, 14);  // vetrina illuminata
    g.fillStyle(0xffd27a, 0.85); g.fillRect(90, 58, 18, 14);
    g.fillStyle(0x2a1c10, 1); g.fillRect(70, 70, 16, 26);     // porta
    // tenda a strisce
    for (let i = 0; i < 7; i++) {
      g.fillStyle(i % 2 === 0 ? 0x9a2f2f : 0xd8cfb8, 1);
      g.fillRect(36 + i * 12, 40, 12, 8);
    }
    this.add.text(78, 30, 'CAFFÈ\nCAPPUCCINI', {
      fontFamily: FONT, fontSize: '5px', color: '#ffdd99',
      align: 'center', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(-9);

    // ── KEBAB "CLANDESTINO 13" (destra, novità 2026) ─────────────────────
    this.drawKebab(g, 352, 46, 100, 50);

    // ── Pavimento a basoli (notturno) ────────────────────────────────────
    g.fillStyle(0x4a4636, 1); g.fillRect(0, 96, W, H - 96);
    const stones = [0x5a5544, 0x524d3d, 0x605a48, 0x4d4838];
    for (let ty = 6; ty < H / 16 + 1; ty++) {
      for (let tx = 0; tx < W / 16; tx++) {
        g.fillStyle(stones[(tx * 7 + ty * 13) % stones.length], 1);
        g.fillRect(tx * 16 + 1, ty * 16 + 1, 14, 14);
      }
    }

    // ── Lampioni accesi ──────────────────────────────────────────────────
    for (const lx of [96, 384]) this.drawLamp(g, lx, 120);
  }

  private drawKebab(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    // Facciata mattoni scuri
    g.fillStyle(0x2e1a1a, 1); g.fillRect(x, y, w, h);
    g.lineStyle(1, 0x3d2424); g.strokeRect(x, y, w, h);
    // vetrina con luce calda dall'interno
    g.fillStyle(0xffb347, 0.9); g.fillRect(x + 8, y + 20, 34, 22);
    g.fillStyle(0x120a06, 1); g.fillRect(x + 52, y + 18, 18, 30);  // porta
    // spiedo döner nella vetrina (rotisserie verticale)
    g.fillStyle(0x8a5a2a, 1); g.fillEllipse(x + 25, y + 32, 12, 20);
    g.fillStyle(0xa06a34, 1); g.fillEllipse(x + 24, y + 30, 8, 16);
    g.fillStyle(0x5a3818, 1); g.fillRect(x + 24, y + 18, 2, 26);   // asta
    // awning rosso a frange
    g.fillStyle(0x8a1220, 1); g.fillRect(x - 2, y - 6, w + 4, 8);
    g.fillStyle(0xb01a2a, 1); g.fillRect(x - 2, y - 6, w + 4, 3);
    for (let i = 0; i < 9; i++) {
      g.fillStyle(0x8a1220, 1);
      g.fillTriangle(x + i * 11, y + 2, x + i * 11 + 6, y + 2, x + i * 11 + 3, y + 7);
    }
    // insegna al neon
    g.fillStyle(0x0a0a0a, 1); g.fillRect(x + 6, y - 22, w - 12, 15);
    g.lineStyle(1, 0xff2e4d); g.strokeRect(x + 6, y - 22, w - 12, 15);
    this.add.text(x + w / 2, y - 15, 'CLANDESTINO 13', {
      fontFamily: FONT, fontSize: '5px', color: '#ff5a6e',
      stroke: '#3a0008', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(-9);
    this.add.text(x + w / 2, y + h - 8, 'kebab • 2026', {
      fontFamily: FONT, fontSize: '4px', color: '#ffcc88',
    }).setOrigin(0.5, 0).setDepth(-9);
  }

  private drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0x2a2e3a, 1); g.fillRect(x - 1, y, 3, 60);      // palo
    g.fillStyle(0x3a3e4a, 1); g.fillRect(x - 6, y - 4, 14, 5);  // testa
    g.fillStyle(0xffe58a, 1); g.fillCircle(x + 1, y - 1, 4);    // lampada
    g.fillStyle(0xffe58a, 0.12); g.fillCircle(x + 1, y - 1, 20); // alone
  }

  // ─── Implosione verso il bianco + scritta finale ─────────────────────────────

  private async implodeToWhite(): Promise<void> {
    // Stessa animazione (potenziata) usata anche a casa di Cece con la torta.
    await TransitionSystem.implodeToWhite(this, this.cece.x, this.cece.y);

    // Scritta finale sul bianco (camera già al centro, zoom base)
    const end = this.add.text(W / 2, H / 2, 'Basta è finito il gioco...\nScia mbriacamune', {
      fontFamily: FONT, fontSize: '9px', color: '#111111', align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(9600).setAlpha(0);
    await this.delay(350);
    await new Promise<void>(resolve =>
      this.tweens.add({ targets: end, alpha: 1, duration: 700, onComplete: () => resolve() }),
    );

    // La scritta finale resta: nessun ritorno automatico alla schermata iniziale.
  }
}
