import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { DialogueSystem, type DialogueLine } from '../systems/DialogueSystem';
import { TransitionSystem } from '../systems/TransitionSystem';
import {
  CHAR_CONFIGS,
  CHAR_SCALE,
  generateSpriteTexture,
  loadPortraits,
} from '../systems/CharacterSprite';

const FONT = '"Press Start 2P", monospace';
const W = GAME_WIDTH;   // 480
const H = GAME_HEIGHT;  // 270

// Amici generici per la folla in strada
const EXTRA_CONFIGS = [
  { shirtColor: 0xcc5577 },
  { shirtColor: 0x55aacc },
  { shirtColor: 0x99cc44 },
  { shirtColor: 0xaa6633 },
  { shirtColor: 0x7755cc },
  { shirtColor: 0xdd9922 },
  // folla aggiuntiva per scena interna
  { shirtColor: 0x44bb88 },
  { shirtColor: 0xee5533 },
  { shirtColor: 0x9988cc },
  { shirtColor: 0x55ccdd },
  { shirtColor: 0xff9966 },
  { shirtColor: 0x66cc88 },
];

// ─── Dialoghi ────────────────────────────────────────────────────────────────

const WALK_LINES: DialogueLine[] = [
  { speaker: 'umberto', text: 'Cece... chianu... addu cazzu sciamu?' },
  { speaker: 'trande',  text: 'Mena pe la mamma maria mi fa male tutto.' },
  { speaker: 'bubi',    text: 'Trande ma se si pampasciune' },
  { speaker: 'trande',  text: 'Non è colpa mia se quella bici di merda non aveva i freni.' },
];

// Umberto ha urgenza → minigioco pipì
const PIP_SETUP_LINES: DialogueLine[] = [
  { speaker: 'umberto', text: 'Raga aspettate. *hic* Ho un problema urgente.' },
  { speaker: 'bubi',    text: 'Tie si nu problema.' },
  { speaker: 'umberto', text: 'Devo pisciare, accompagnatemi *hic*' },
  { speaker: 'trande',  text: 'Sine sciamu ca nu te manteni tisu.' },
  { speaker: 'bubi',  text: 'Pisciu puru ieu.' },
  { speaker: 'cece',  text: 'Vabe noi entriamo, quando finite entrate.' },
];

// Dopo il minigioco: confusione per essere stati lasciati fuori
const POST_PIP_LINES: DialogueLine[] = [
  { speaker: 'bubi',    text: 'Ou cujune ta pisciatu susu.' },
  { speaker: 'umberto', text: '*hic* È solo birra *hic*' },
  { speaker: 'trande',  text: 'Vabe entriamo ragazzi.' },
  { speaker: 'bubi',    text: 'Sciamu.' },
];

const SETUP_LINES: DialogueLine[] = [
  { speaker: 'guglielmo', text: '*dall\'interno* Veloci veloci!' },
  { speaker: 'bubi',   text: 'Ci sta fecene??.' },
  { speaker: 'trande',    text: 'Ve lo dico io: robe da froci.' },
];

const ENTER_LINES: DialogueLine[] = [
  { speaker: 'cece', text: 'Pronti.' },
  { speaker: 'cece', text: 'Entrate.' },
];


const ARRIVE_LINES: DialogueLine[] = [
  { speaker: 'umberto',   text: '...' },
  { speaker: 'bubi',      text: '...Cece.' },
  { speaker: 'trande',    text: 'La torta... cazzo significa 18??' },
  { speaker: 'cece',      text: 'Pensavate ci scordassimo di voi, eh?? Impossibile, amici miei.' },
];

const SPEECH_LINES: DialogueLine[] = [
  { speaker: 'cece',      text: 'Sei anni fa la pandemia ci ha fregato. Stasera recuperiamo tutto.' },
  { speaker: 'cece',      text: 'Niente festa, niente video? Adesso ci pensa Cece.' },
  { speaker: 'aniceto',   text: 'Contenti porco dio??' },
  { speaker: 'guglielmo', text: 'Avete visto che alla fine ci siamo riusciti?' },
  { speaker: 'umberto',   text: 'Raga. Questa è la serata più bella della mia vita. Davvero...' },
  { speaker: 'bubi',      text: 'Porco dio... top 3 momenti della mia vita.' },
  { speaker: 'trande',    text: 'Grazie ragazzi era ora eh!!' },
  { speaker: 'bubi',      text: 'Cittu Trande.' },
  { speaker: 'cece',      text: 'Adesso... si soffia.' },
];

const CECE_TO_CAMERA: DialogueLine[] = [
  { speaker: 'cece', text: '...' },
  { speaker: 'cece', text: 'E tu.' },
  { speaker: 'cece', text: 'Grazie per aver giocato con noi.' },
  { speaker: 'cece', text: 'Davvero.' },
  { speaker: 'cece', text: 'Senza di te non esisterebbe niente di tutto questo.' },
  { speaker: 'cece', text: 'Ci vediamo alla prossima festa.' },
];

// ─── Scena ───────────────────────────────────────────────────────────────────

export class CeceScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;
  private ceceSprite!: Phaser.GameObjects.Sprite;
  /** Tutti gli sprite della folla nella scena interna — faded out prima dello zoom su Cece. */
  private crowdSprites: Phaser.GameObjects.Sprite[] = [];
  /** Camera UI separata per il dialogo durante lo zoom su Cece. */
  private uiCam?: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super('CeceScene');
  }

  preload(): void {
    loadPortraits(this, [
      'umberto', 'bubi', 'guglielmo', 'aniceto', 'trande', 'cece',
      'ilaria', 'riccardo', 'stefano', 'cosimino', 'donbiagio', 'christian', 'lerry', 'beatrice',
    ]);
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(2);
    cam.centerOn(W / 2, H / 2);

    for (const id of [
      'umberto', 'bubi', 'guglielmo', 'aniceto', 'trande', 'cece',
      'ilaria', 'riccardo', 'stefano', 'cosimino', 'donbiagio', 'christian', 'lerry', 'beatrice',
    ]) {
      generateSpriteTexture(this, id, CHAR_CONFIGS[id]);
    }
    EXTRA_CONFIGS.forEach((cfg, i) => {
      generateSpriteTexture(this, `ext${i}`, cfg);
    });
    // ext6-ext9: figuranti aggiuntivi per la scena festa

    this.dialogue = new DialogueSystem(this);
    this.cameras.main.fadeIn(800, 0, 0, 0);
    // BGM globale già in corso; EndScene avvierà melancholy come FGM

    this.time.delayedCall(900, () => void this.run());
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  /** Dialogo con click (interno casa). */
  private dlg(lines: DialogueLine[]): Promise<void> {
    return new Promise(resolve => this.dialogue.start({ lines, onComplete: resolve }));
  }

  /** Dialogo auto-avanzante (esterno / camminata). */
  private dlgAuto(lines: DialogueLine[], delayMs = 1400): Promise<void> {
    return new Promise(resolve =>
      this.dialogue.start({ lines, onComplete: resolve, autoAdvance: true, autoAdvanceDelay: delayMs })
    );
  }

  private tweenP(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(resolve =>
      this.tweens.add({ ...config, onComplete: () => resolve() })
    );
  }

  // ─── Main flow ───────────────────────────────────────────────────────────────

  private async run(): Promise<void> {
    const initData = (this.scene.settings.data ?? {}) as Record<string, unknown>;

    if (initData.skipToCamera) {
      await this.skipToFinalScene();
      await this.cameraFlashExit();
    } else if (initData.phase === 'after-pip') {
      // CeceScene ripartita dopo il minigioco pipì
      await this.outsideBuilding_postPip();
      await this.delay(200);
      await this.interiorReveal();
      await this.delay(400);
      await this.ceceToCamera();
      await this.cameraFlashExit();
    } else {
      await this.streetWalk();
      await this.delay(200);
      await this.outsideBuilding_prePip(); // → transiziona a PipScene, non ritorna mai
    }
  }

  /** Scorciatoia debug: salta tutto e va direttamente al momento Cece → utente. */
  private async skipToFinalScene(): Promise<void> {
    this.drawInteriorTopDown();
    this.drawGiantCake(W / 2, 110);
    this.drawStaticBanners();

    // Amici in semicerchio (piazzati istantaneamente)
    const backRow: [string, number, number][] = [
      ['ext0', 80, 58], ['guglielmo', 120, 52], ['aniceto', 165, 50],
      ['ext1', 210, 54], ['ext2', 255, 52], ['ext3', 300, 58],
    ];
    for (const [id, x, y] of backRow) {
      this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE * 0.75).setDepth(y)
        .play(`${id}-idle-down`);
    }
    for (const [id, x, y] of [['umberto', W / 2 - 28, 185], ['bubi', W / 2, 185], ['trande', W / 2 + 28, 185]] as [string, number, number][]) {
      this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE).setDepth(y)
        .play(`${id}-idle-down`);
    }

    // Cece già in posizione finale (davanti a tutto)
    this.ceceSprite = this.add.sprite(W / 2, 145, 'char-cece', 1)
      .setScale(CHAR_SCALE * 0.88).setDepth(200);
    this.ceceSprite.play('cece-idle-down');

    await this.delay(700);
    await this.ceceToCamera();
  }

  /**
   * Transizione epica finale (~5 secondi):
   *  0. Scintille di anticipazione attorno a Cece
   *  1a. 200 pixel colorati dai 4 bordi del mondo convergono su Cece
   *  1b. 80 particelle bianche da un anello attorno a Cece convergono al centro
   *  1c. 40 raggi veloci dagli angoli
   *  2. 3 onde di glow pulsante al centro
   *  3. 5 anelli di flash rapidi
   *  4. Onda d'urto bianca esplosiva → EndScene
   */
  private async cameraFlashExit(): Promise<void> {
    if (this.uiCam) {
      this.cameras.remove(this.uiCam);
      this.uiCam = undefined;
    }

    const cx = this.ceceSprite?.x ?? W / 2;
    const cy = this.ceceSprite?.y ?? H / 2;
    const COLORS = [0xff3366, 0x3399ff, 0xffdd33, 0x33ff88, 0xcc44ff, 0xff8833, 0xffcc00, 0x00ccff];
    const MARGIN = 16;

    await this.delay(300);

    // ── FASE 0: scintille di anticipazione attorno a Cece ─────────────
    for (let i = 0; i < 24; i++) {
      const g     = this.add.graphics().setDepth(440);
      const angle = (i / 24) * Math.PI * 2;
      const dist  = Phaser.Math.Between(8, 28);
      g.fillStyle(COLORS[i % COLORS.length], 1);
      g.fillRect(-1, -1, 3, 3);
      g.setPosition(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
      this.tweens.add({
        targets: g,
        x: cx, y: cy,
        scaleX: 0.1, scaleY: 0.1,
        alpha: 0,
        duration: Phaser.Math.Between(250, 550),
        delay: i * 18,
        ease: 'Quad.easeIn',
        onComplete: () => g.destroy(),
      });
    }
    await this.delay(450);

    // ── FASE 1a: 200 pixel colorati dai 4 bordi → Cece ────────────────
    for (let i = 0; i < 200; i++) {
      const g    = this.add.graphics().setDepth(450);
      const edge = i % 4;
      const startX =
        edge === 0 ? Phaser.Math.Between(0, W) :
        edge === 1 ? Phaser.Math.Between(0, W) :
        edge === 2 ? -MARGIN :
                      W + MARGIN;
      const startY =
        edge === 0 ? -MARGIN :
        edge === 1 ?  H + MARGIN :
                      Phaser.Math.Between(0, H);
      const sz = Phaser.Math.Between(3, 11);
      g.fillStyle(COLORS[i % COLORS.length], 1);
      g.fillRect(0, 0, sz, sz);
      g.setPosition(startX, startY);
      this.tweens.add({
        targets: g,
        x: cx + Phaser.Math.Between(-5, 5),
        y: cy + Phaser.Math.Between(-5, 5),
        scaleX: 0.12, scaleY: 0.12,
        alpha: 0.9,
        duration: Phaser.Math.Between(900, 1900),
        delay: i * 10,
        ease: 'Quad.easeIn',
        onComplete: () => g.destroy(),
      });
    }

    // ── FASE 1b: 80 particelle bianche da anello attorno a Cece ───────
    for (let i = 0; i < 80; i++) {
      const g     = this.add.graphics().setDepth(448);
      const angle = Math.random() * Math.PI * 2;
      const dist  = Phaser.Math.Between(30, 100);
      const sz    = Phaser.Math.Between(2, 6);
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(0, 0, sz, sz);
      g.setPosition(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
      this.tweens.add({
        targets: g,
        x: cx + Phaser.Math.Between(-4, 4),
        y: cy + Phaser.Math.Between(-4, 4),
        scaleX: 0.1, scaleY: 0.1,
        alpha: { from: 0, to: 0.8 },
        duration: Phaser.Math.Between(700, 1500),
        delay: i * 22 + 200,
        ease: 'Cubic.easeIn',
        onComplete: () => g.destroy(),
      });
    }

    // ── FASE 1c: 40 raggi veloci dagli angoli ─────────────────────────
    const corners: [number, number][] = [
      [-MARGIN, -MARGIN], [W + MARGIN, -MARGIN],
      [-MARGIN, H + MARGIN], [W + MARGIN, H + MARGIN],
    ];
    for (let i = 0; i < 40; i++) {
      const g          = this.add.graphics().setDepth(452);
      const [sx, sy]   = corners[i % 4];
      const sz         = Phaser.Math.Between(4, 8);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, sz, sz);
      g.setPosition(sx, sy);
      this.tweens.add({
        targets: g,
        x: cx + Phaser.Math.Between(-8, 8),
        y: cy + Phaser.Math.Between(-8, 8),
        scaleX: 0.08, scaleY: 0.08,
        alpha: 0.95,
        duration: Phaser.Math.Between(500, 1100),
        delay: i * 28 + 100,
        ease: 'Expo.easeIn',
        onComplete: () => g.destroy(),
      });
    }

    await this.delay(2700); // aspetta convergenza della maggior parte delle particelle

    // ── FASE 2: 3 onde di glow pulsante al centro ─────────────────────
    for (let wave = 0; wave < 3; wave++) {
      const glow  = this.add.graphics().setDepth(455);
      const state = { r: 4, a: 0.95 };
      this.tweens.add({
        targets: state,
        r: 28 + wave * 14,
        a: 0,
        duration: 380,
        ease: 'Sine.easeOut',
        onUpdate: () => {
          glow.clear();
          glow.fillStyle(0xffffff, state.a);
          glow.fillCircle(cx, cy, state.r);
        },
        onComplete: () => glow.destroy(),
      });
      await this.delay(180);
    }
    await this.delay(180);

    // ── FASE 3: 5 anelli di flash rapidi ──────────────────────────────
    for (let r = 6; r <= 30; r += 6) {
      const ring = this.add.graphics().setDepth(460);
      ring.fillStyle(0xffffff, 1);
      ring.fillCircle(cx, cy, r);
      await this.delay(55);
      ring.destroy();
    }
    await this.delay(40);

    // ── FASE 4: onda d'urto bianca esplosiva ──────────────────────────
    const shockwave = this.add.graphics().setDepth(470);
    const dummy     = { r: 0 };
    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: dummy,
        r: 420,
        duration: 750,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          shockwave.clear();
          shockwave.fillStyle(0xffffff, 1);
          shockwave.fillCircle(cx, cy, dummy.r);
        },
        onComplete: () => {
          shockwave.clear();
          shockwave.fillStyle(0xffffff, 1);
          shockwave.fillRect(-60, -60, W + 120, H + 120);
          resolve();
        },
      });
    });

    await this.delay(180);
    this.scene.start('EndScene');
  }

  // ─── Fase 1: strada ──────────────────────────────────────────────────────────

  private async streetWalk(): Promise<void> {
    this.drawStreet();

    const caption = this.add
      .text(W / 2, 20, 'UN ISOLATO PIÙ TARDI...', {
        fontFamily: FONT, fontSize: '7px',
        color: '#cccccc', stroke: '#000000', strokeThickness: 3,
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);
    await this.tweenP({ targets: caption, alpha: 1, duration: 600 });
    await this.delay(900);
    await this.tweenP({ targets: caption, alpha: 0, duration: 400 });
    caption.destroy();

    // 12 personaggi su 3 fasce di profondità
    type WD = { id: string; startX: number; y: number; scaleF: number; dur: number };
    const defs: WD[] = [
      // fondo
      { id: 'ext0', startX: -10,  y: 187, scaleF: 0.72, dur: 5200 },
      { id: 'ext1', startX: -45,  y: 189, scaleF: 0.72, dur: 5400 },
      { id: 'ext2', startX: -80,  y: 186, scaleF: 0.72, dur: 5000 },
      { id: 'ext3', startX:-115,  y: 188, scaleF: 0.72, dur: 5300 },
      // mezzo
      { id: 'guglielmo', startX: -18, y: 194, scaleF: 0.86, dur: 4600 },
      { id: 'aniceto',   startX: -55, y: 196, scaleF: 0.86, dur: 4800 },
      { id: 'ext4',      startX: -88, y: 193, scaleF: 0.86, dur: 4700 },
      { id: 'ext5',      startX:-125, y: 195, scaleF: 0.86, dur: 4900 },
      // primo piano — festeggiati + Cece in testa
      { id: 'cece',    startX:  10, y: 202, scaleF: 1.0, dur: 3800 },
      { id: 'umberto', startX: -25, y: 204, scaleF: 1.0, dur: 4200 },
      { id: 'bubi',    startX: -55, y: 200, scaleF: 1.0, dur: 4000 },
      { id: 'trande',  startX: -90, y: 202, scaleF: 1.0, dur: 4300 },
    ];

    const walkers: Phaser.GameObjects.Sprite[] = [];
    for (const d of defs) {
      const s = this.add.sprite(d.startX, d.y, `char-${d.id}`, 1)
        .setScale(CHAR_SCALE * d.scaleF).setDepth(d.y);
      s.play(`${d.id}-idle-right`);
      walkers.push(s);
      this.tweens.add({ targets: s, x: W + 30, duration: d.dur, ease: 'Linear' });
    }

    // Dialogo in parallelo con la camminata; aspettiamo che finisca prima di uscire
    const walkDlg = this.dlgAuto(WALK_LINES, 1100);
    await this.delay(5600);
    walkers.forEach(s => s.destroy());
    await walkDlg; // garantisce che l'ultima riga sia leggibile
  }

  // ─── Helper: door overlay (riusato in entrambe le fasi) ─────────────────────

  private makeDoorOverlay(): {
    gfx: Phaser.GameObjects.Graphics;
    open: () => Promise<void>;
    close: () => Promise<void>;
  } {
    const DOOR_L = 221, DOOR_T = 134, DOOR_W = 38, DOOR_H = 61;
    const gfx = this.add.graphics().setDepth(4).setAlpha(0);
    gfx.fillStyle(0xffcc55, 1);
    gfx.fillRect(DOOR_L, DOOR_T, DOOR_W, DOOR_H);
    gfx.fillStyle(0xffee99, 0.45);
    gfx.fillRect(DOOR_L + 3, DOOR_T + 2, 15, DOOR_H - 2);
    return {
      gfx,
      open:  () => this.tweenP({ targets: gfx, alpha: 1, duration: 200 }),
      close: () => this.tweenP({ targets: gfx, alpha: 0, duration: 350 }),
    };
  }

  // ─── Fase 2a: tutti arrivano fuori → pipì emergency → transizione a PipScene ─

  private async outsideBuilding_prePip(): Promise<void> {
    this.drawBuildingExterior();
    const DOOR_CX = 240;
    const door = this.makeDoorOverlay();

    // Gruppo arriva da sinistra
    const groupDefs: [string, number, number][] = [
      ['cece',      60,  185],
      ['umberto',  105,  190],
      ['bubi',     135,  188],
      ['trande',   165,  190],
      ['guglielmo', 82,  178],
      ['aniceto',  118,  176],
    ];
    const sprites: Record<string, Phaser.GameObjects.Sprite> = {};
    for (const [id, x, y] of groupDefs) {
      sprites[id] = this.add.sprite(x - 60, y, `char-${id}`, 1)
        .setScale(CHAR_SCALE * (y < 185 ? 0.86 : 1.0)).setDepth(y);
      sprites[id].play(`${id}-idle-right`);
    }
    await this.tweenP({ targets: Object.values(sprites), x: `+=55`, duration: 1200, ease: 'Quad.easeOut' });

    await this.delay(200);
    for (const [id, s] of Object.entries(sprites)) s.play(`${id}-idle-down`);
    await this.delay(300);

    // Umberto ha un problema urgente
    await this.dlgAuto(PIP_SETUP_LINES);

    // Umberto, Bubi, Trande si spostano verso il muretto (sinistra)
    for (const id of ['umberto', 'bubi', 'trande']) sprites[id].play(`${id}-idle-left`);
    await this.tweenP({
      targets: ['umberto', 'bubi', 'trande'].map(id => sprites[id]),
      x: 40, duration: 700, ease: 'Linear',
    });
    for (const id of ['umberto', 'bubi', 'trande']) sprites[id].play(`${id}-idle-down`);

    // Nel frattempo Cece + gli altri scivolano dentro in silenzio
    await this.delay(400);
    for (const id of ['cece', 'guglielmo', 'aniceto']) sprites[id].play(`${id}-idle-right`);
    await this.tweenP({
      targets: ['cece', 'guglielmo', 'aniceto'].map(id => sprites[id]),
      x: DOOR_CX, duration: 700, ease: 'Linear',
    });
    await door.open();
    await this.delay(120);
    ['cece', 'guglielmo', 'aniceto'].forEach(id => { sprites[id].setAlpha(0); sprites[id].destroy(); });
    await door.close();

    await this.delay(600);

    // Fade → PipScene (questa funzione non ritorna mai)
    TransitionSystem.fadeToScene(this, 'PipScene', undefined, 800);
    return new Promise(() => {}); // hang — la scena sarà fermata da Phaser
  }

  // ─── Fase 2b: dopo la pipì — trio confuso fuori, bussa, entra ────────────────

  private async outsideBuilding_postPip(): Promise<void> {
    this.drawBuildingExterior();
    const DOOR_CX = 240;
    const door = this.makeDoorOverlay();

    // Solo Umberto, Bubi, Trande — erano al muretto (partono da sinistra)
    const trioDefs: [string, number, number][] = [
      ['umberto', 50,  190],
      ['bubi',    80,  188],
      ['trande',  110, 190],
    ];
    const sprites: Record<string, Phaser.GameObjects.Sprite> = {};
    for (const [id, x, y] of trioDefs) {
      sprites[id] = this.add.sprite(x, y, `char-${id}`, 1)
        .setScale(CHAR_SCALE).setDepth(y);
      sprites[id].play(`${id}-idle-down`);
    }

    await this.delay(400);

    // Confusione per essere stati lasciati fuori
    await this.dlgAuto(POST_PIP_LINES);

    // Sentono rumore dall'interno
    await this.dlgAuto(SETUP_LINES);

    // Cece apre la porta e chiama
    await door.open();
    await this.delay(150);
    await this.dlgAuto(ENTER_LINES, 1600);

    // Trio entra
    for (const id of ['umberto', 'bubi', 'trande']) sprites[id].play(`${id}-idle-right`);
    await this.tweenP({
      targets: Object.values(sprites),
      x: DOOR_CX, duration: 700, ease: 'Linear',
    });
    await this.delay(150);
    Object.values(sprites).forEach(s => { s.setAlpha(0); s.destroy(); });
    await door.close();
  }

  // ─── Fase 3: interno — prospettiva dall'alto, torta al centro ────────────────

  private async interiorReveal(): Promise<void> {
    this.drawInteriorTopDown();

    // Torta gigante al centro (già visibile quando i festeggiati entrano)
    const cakeGlow = this.drawGiantCake(W / 2, 110);
    this.drawStaticBanners();

    // ──────────────────────────────────────────────────────────────────
    // FILA 1 — parete di fondo (y=44). 10 figuranti su tutta la larghezza.
    // Tutti extras, testa appena fuori dalla parete (y=38-41).
    // ──────────────────────────────────────────────────────────────────
    const row1: [string, number][] = [
      ['ext0',  24], ['ext1',  72], ['ext2', 120], ['ext3', 168],
      ['ext4', 218], ['ext5', 266], ['ext6', 314], ['ext7', 362],
      ['ext8', 410], ['ext9', 456],
    ];
    for (const [id, x] of row1) {
      const s = this.add.sprite(x, 44, `char-${id}`, 1)
        .setScale(CHAR_SCALE * 0.84).setDepth(44)
        .play(`${id}-idle-down`);
      this.crowdSprites.push(s);
    }

    // ──────────────────────────────────────────────────────────────────
    // FILA 2 — intorno al tavolo principale (y=66, depth=66).
    // Importante: il cake ha depth=80 → chi è a depth<80 viene coperto
    // dal cake SE le x si sovrappongono (x=204-276). Quindi:
    //   • Posizioni LEFT  (x<190): ilaria, lerry, guglielmo
    //   • Posizioni RIGHT (x>290): aniceto, beatrice, christian, donbiagio
    // ──────────────────────────────────────────────────────────────────
    const row2: [string, number][] = [
      ['ilaria',    82], ['lerry',    134], ['guglielmo', 180],
      // gap 180-298 = zona torta → nessuno nascosto dalla torta
      ['aniceto',  298], ['beatrice', 344], ['christian', 392], ['donbiagio', 440],
    ];
    for (const [id, x] of row2) {
      const s = this.add.sprite(x, 66, `char-${id}`, 1)
        .setScale(CHAR_SCALE * 0.96).setDepth(66)
        .play(`${id}-idle-down`);
      this.crowdSprites.push(s);
    }

    // ──────────────────────────────────────────────────────────────────
    // LATI (y=88, depth=88 > cake 80) — cosimino e riccardo ai lati.
    // ──────────────────────────────────────────────────────────────────
    const sideRow: [string, number][] = [
      ['cosimino', 36], ['riccardo', 444],
    ];
    for (const [id, x] of sideRow) {
      const s = this.add.sprite(x, 88, `char-${id}`, 1)
        .setScale(CHAR_SCALE * 1.0).setDepth(88)
        .play(`${id}-idle-down`);
      this.crowdSprites.push(s);
    }

    // ──────────────────────────────────────────────────────────────────
    // TAVOLINI LATERALI (y=128)
    // ──────────────────────────────────────────────────────────────────
    const tableRow: [string, number][] = [
      ['ext10',  36], ['stefano',  82],    // tavolino cibo sx
      ['ext11', 398],                      // tavolino drink dx
    ];
    for (const [id, x] of tableRow) {
      const s = this.add.sprite(x, 128, `char-${id}`, 1)
        .setScale(CHAR_SCALE * 1.0).setDepth(128)
        .play(`${id}-idle-down`);
      this.crowdSprites.push(s);
    }

    // ── Cece — centro, dietro la torta (y=74, depth=74 < 80 = torta)
    // È nascosta dalla torta di proposito: emergerà quando avanza a y=145.
    this.ceceSprite = this.add.sprite(W / 2, 74, 'char-cece', 1)
      .setScale(CHAR_SCALE * 0.96).setDepth(74);
    this.ceceSprite.play('cece-idle-down');

    await this.delay(500);

    // I tre festeggiati entrano dal basso
    const festY = H + 10;
    const umberto = this.add.sprite(W / 2 - 28, festY, 'char-umberto', 1)
      .setScale(CHAR_SCALE).setDepth(festY);
    umberto.play('umberto-idle-up');
    const bubi = this.add.sprite(W / 2, festY + 6, 'char-bubi', 1)
      .setScale(CHAR_SCALE).setDepth(festY + 1);
    bubi.play('bubi-idle-up');
    const trande = this.add.sprite(W / 2 + 28, festY, 'char-trande', 1)
      .setScale(CHAR_SCALE).setDepth(festY);
    trande.play('trande-idle-up');

    // Camminano verso la torta (prospettiva: salgono = si avvicinano)
    const targetY = 185;
    await this.tweenP({
      targets: [umberto, bubi, trande],
      y: targetY,
      duration: 1600,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        [umberto, bubi, trande].forEach(s => s.setDepth(s.y));
      },
    });

    umberto.play('umberto-idle-down');
    bubi.play('bubi-idle-down');
    trande.play('trande-idle-down');

    await this.delay(400);
    await this.dlg(ARRIVE_LINES);

    // Coriandoli esplosivi
    this.burstConfetti();
    await this.delay(300);

    await this.dlg(SPEECH_LINES);

    // ── Soffiare le candeline ─────────────────────────────────────────
    // I tre festeggiati guardano verso la torta
    umberto.play('umberto-idle-up');
    bubi.play('bubi-idle-up');
    trande.play('trande-idle-up');
    await this.delay(400);

    // Puffs d'aria da ognuno verso le fiamme (y~80)
    const CAKE_X = W / 2, CAKE_Y = 110;
    const CFLAME_Y = CAKE_Y - 30; // y=80 — cima fiamma
    for (const blower of [umberto, bubi, trande]) {
      for (let p = 0; p < 10; p++) {
        const pg = this.add.graphics().setDepth(200);
        pg.fillStyle(0xddeeff, 0.72);
        const sz = Phaser.Math.Between(4, 8);
        pg.fillEllipse(0, 0, sz, Math.round(sz * 0.65));
        pg.setPosition(blower.x + Phaser.Math.Between(-5, 5), blower.y - 13);
        this.tweens.add({
          targets: pg,
          y: CFLAME_Y + Phaser.Math.Between(-4, 4),
          x: `+=${Phaser.Math.Between(-18, 18)}`,
          alpha: 0, scaleX: 2.2, scaleY: 2.2,
          duration: 380 + p * 35,
          delay: p * 48,
          ease: 'Quad.easeOut',
          onComplete: () => pg.destroy(),
        });
      }
    }

    // ── Spegni le candeline una per una con stagger ───────────────────────────
    // Le fiamme sono parte del Graphics a depth=80. Per "spegnerle" sovrapponiamo
    // un cap depth=82 che copre la fiamma con il colore del tavolo, poi fumo.

    // Colori candelina (stesso ordine di drawGiantCake)
    const CX_ARR  = [-28, -19, -10, -1, 8, 17, 26, 35];
    const CANDLE_COLORS = [0xff6699,0x66aaff,0xffdd44,0x88ff88,0xcc88ff,0xff9933,0xff6699,0x66aaff];
    // Colore sfondo tavolo a quella altezza (2a1a08) — copre la fiamma gialla
    const TABLE_BG = 0x2a1a08;

    // Attendi l'arrivo dei puffs
    await this.delay(450);

    for (let ci = 0; ci < CX_ARR.length; ci++) {
      const candleX = CAKE_X + CX_ARR[ci];

      this.time.delayedCall(ci * 75, () => {
        // ── Spegni: copri fiamma con colore candela + sfondo ──────────────
        const cap = this.add.graphics().setDepth(82);
        // Ridisegna il corpo della candela uguale a drawGiantCake
        cap.fillStyle(CANDLE_COLORS[ci], 1);
        cap.fillRect(candleX - 1, CAKE_Y - 28, 3, 14); // stelo
        // Copri l'area fiamma con il colore del tavolo (strato sotto la fiamma)
        cap.fillStyle(TABLE_BG, 1);
        cap.fillRect(candleX - 3, CAKE_Y - 36, 7, 10); // area fiamma spenta

        // ── Fumo che sale dalla candela spenta ───────────────────────────
        for (let p = 0; p < 5; p++) {
          const smoke = this.add.graphics().setDepth(85 + p);
          smoke.fillStyle(0x999999, 0.55 - p * 0.08);
          const sr = 2 + p * 0.5;
          smoke.fillEllipse(0, 0, sr * 2, sr * 2.5);
          smoke.setPosition(
            candleX + Phaser.Math.Between(-1, 1),
            CAKE_Y - 34 - p * 2,
          );
          this.tweens.add({
            targets: smoke,
            y: CAKE_Y - 50 - p * 4,
            x: `+=${Phaser.Math.Between(-4, 4)}`,
            alpha: 0,
            scaleX: 2.5,
            scaleY: 2.5,
            duration: 600 + p * 80,
            delay: p * 90,
            ease: 'Sine.easeOut',
            onComplete: () => smoke.destroy(),
          });
        }
      });
    }

    // Fade out del glow pulsante dopo che le candele si spengono
    await this.delay(200);
    this.tweens.killTweensOf(cakeGlow);
    this.tweens.add({ targets: cakeGlow, alpha: 0, duration: 600 });

    await this.delay(600);

    // Ritornano a guardare in avanti
    umberto.play('umberto-idle-down');
    bubi.play('bubi-idle-down');
    trande.play('trande-idle-down');
    await this.delay(400);

    // ── Cece sfonda la torta ──────────────────────────────────────────────────
    // La torta è a depth=80. Cece parte a depth=74 (DIETRO).
    // A ~200ms nel tween raggiunge y≈110 (centro torta) → buca e sbuca davanti.

    const CAKE_CX = W / 2;
    const CAKE_CY = 110;

    // Programma il buco ~200ms dopo l'inizio del movimento
    this.time.delayedCall(200, () => {
      // Cece emerge dal buco
      this.ceceSprite.setDepth(85);

      // ── Buco nella torta (depth=82 → copre la torta al depth=80) ──────────
      const holeG = this.add.graphics().setDepth(82);

      // Interno scuro (buio dentro la torta)
      holeG.fillStyle(0x110500, 1);
      holeG.fillEllipse(CAKE_CX, CAKE_CY + 8, 24, 32);

      // Bordi spezzati — frammenti di glassa bianca
      holeG.fillStyle(0xffffff, 1);
      holeG.fillRect(CAKE_CX - 16, CAKE_CY - 4,  7, 3);
      holeG.fillRect(CAKE_CX +  9, CAKE_CY - 5,  6, 3);
      holeG.fillRect(CAKE_CX - 13, CAKE_CY + 22, 5, 3);
      holeG.fillRect(CAKE_CX +  8, CAKE_CY + 20, 7, 3);
      holeG.fillRect(CAKE_CX - 18, CAKE_CY + 8,  3, 5);
      holeG.fillRect(CAKE_CX + 16, CAKE_CY + 6,  3, 6);

      // Striscia gialla (strato glassa gialla visibile sul bordo)
      holeG.fillStyle(0xffd700, 1);
      holeG.fillRect(CAKE_CX - 14, CAKE_CY - 1, 5, 2);
      holeG.fillRect(CAKE_CX + 10, CAKE_CY - 2, 4, 2);

      // ── Camera shake all'impatto ──────────────────────────────────────────
      this.cameras.main.shake(180, 0.0045);

      // ── Pezzi di torta che volano e rimangono a terra ─────────────────────
      const LAYER_COLS = [0x8b4513, 0x8b4513, 0xffd700, 0xffffff, 0xffd700, 0xff6699];
      for (let i = 0; i < 14; i++) {
        const pg = this.add.graphics().setDepth(200 + i);
        const col = LAYER_COLS[i % LAYER_COLS.length];
        pg.fillStyle(col, 1);
        const pw = Phaser.Math.Between(4, 9);
        const ph = Phaser.Math.Between(3, 7);
        pg.fillRect(-pw / 2, -ph / 2, pw, ph);

        // Parte dal bordo del buco
        const startX = CAKE_CX + Phaser.Math.Between(-10, 10);
        const startY = CAKE_CY + Phaser.Math.Between(-5, 15);
        pg.setPosition(startX, startY);

        // Atterra a sinistra o destra della torta (rimane a terra)
        const side = i % 2 === 0 ? -1 : 1;
        const landX = CAKE_CX + side * Phaser.Math.Between(20, 70) + Phaser.Math.Between(-12, 12);
        const landY = CAKE_CY + Phaser.Math.Between(35, 65); // cade verso il basso

        this.tweens.add({
          targets: pg,
          x: landX,
          y: landY,
          angle: Phaser.Math.Between(-200, 200),
          duration: Phaser.Math.Between(350, 650),
          delay: i * 22,
          ease: 'Quad.easeOut',
          // Nessun destroy/fade: i pezzi restano a terra
        });
      }
    });

    // Cece cammina in avanti (sfondando la torta)
    await this.tweenP({ targets: this.ceceSprite, y: 145, duration: 700, ease: 'Quad.easeOut' });
    this.ceceSprite.setDepth(200); // davanti a tutto
    this.ceceSprite.play('cece-idle-down');
  }

  // ─── Fase 4: camera zooma su Cece — dialogo su camera UI separata ────────────

  private async ceceToCamera(): Promise<void> {
    const mainCam = this.cameras.main;
    const CECE_ZOOM = 5.5;   // zoom camera principale su Cece
    const DURATION  = 1400;  // ms animazione zoom-in

    // ── 1. Camera UI separata: mantiene il dialogo al zoom=2 originale ───────
    const canvas = this.sys.game.canvas;
    this.uiCam = this.cameras.add(0, 0, canvas.width, canvas.height);
    this.uiCam.setZoom(2).centerOn(W / 2, H / 2);

    // uiCam vede SOLO il container del dialogo; ignora tutto il resto
    const dialogueCont = this.dialogue.uiContainer;
    const worldObjs = (this.children.list as Phaser.GameObjects.GameObject[])
      .filter(o => o !== dialogueCont);
    this.uiCam.ignore(worldObjs);

    // mainCam ignora il container del dialogo (lo rende solo uiCam)
    mainCam.ignore(dialogueCont);

    // ── 1b. Fade out folla — prima dello zoom, per evitare sparizione brusca ──
    if (this.crowdSprites.length > 0) {
      await this.tweenP({
        targets: this.crowdSprites,
        alpha: 0,
        duration: 500,
        ease: 'Sine.easeIn',
      });
    }

    await this.delay(300);

    // ── 2. Zoom + pan su Cece — metodi built-in Phaser ────────────────────
    const cecY = this.ceceSprite.y;
    mainCam.pan(W / 2, cecY, DURATION, 'Sine.easeInOut');
    mainCam.zoomTo(CECE_ZOOM, DURATION, 'Sine.easeInOut');
    await this.delay(DURATION + 100);

    await this.delay(300);
    await this.dlg(CECE_TO_CAMERA); // click-to-advance
    await this.delay(300);

    // ── 3. Zoom out + ritorno al centro prima della transizione ───────────
    if (this.uiCam) {
      this.cameras.remove(this.uiCam);
      this.uiCam = undefined;
    }
    mainCam.pan(W / 2, H / 2, 800, 'Sine.easeInOut');
    mainCam.zoomTo(2, 800, 'Sine.easeInOut');
    await this.delay(900);
  }

  // ─── Grafica: via di periferia notturna (paesino, non città) ────────────────

  private drawStreet(): void {
    const g = this.add.graphics().setDepth(0);

    // Cielo notturno
    g.fillStyle(0x060a14, 1); g.fillRect(0, 0, W, H);

    // Luna crescente (a destra in alto)
    g.fillStyle(0xf4e8b8, 1); g.fillCircle(446, 22, 14);      // disco luna
    g.fillStyle(0x060a14, 1); g.fillCircle(454, 18, 13);       // morso ombra → falce

    // Stelle (alcune 2×2 per varietà)
    for (const [sx, sy, big] of [
      [30,8,0],[80,14,0],[140,6,1],[200,11,0],[290,7,0],[360,16,0],[430,9,0],[470,13,0],
      [55,28,0],[120,38,0],[255,24,1],[340,33,0],[175,18,0],[305,35,0],
    ] as [number,number,number][]) {
      g.fillStyle(0xdde0ff, 1);
      if (big) g.fillRect(sx - 1, sy - 1, 2, 2);
      else     g.fillRect(sx, sy, 1, 1);
    }

    // ── Casa 1: intonaco giallo caldo (sx) ───────────────────────────────
    g.fillStyle(0xc8b880, 1); g.fillRect(0, 108, 98, 87);
    g.fillStyle(0xb0a068, 1); g.fillRect(0, 104, 100, 6);   // cornicione
    this.drawWin(g, 12, 126, true);
    this.drawWin(g, 56, 126, false);
    this.drawWin(g, 12, 157, false);
    this.drawWin(g, 56, 157, true);
    g.fillStyle(0x3a1e0a, 1); g.fillRect(38, 162, 20, 30);
    g.fillStyle(0x6a3818, 1); g.fillRect(40, 164, 16, 28);

    // ── Casa 2: intonaco rosato/albicocca ────────────────────────────────
    g.fillStyle(0xc0a098, 1); g.fillRect(106, 120, 76, 75);
    g.fillStyle(0xa08078, 1); g.fillRect(104, 116, 80, 6);
    this.drawWin(g, 114, 135, true);
    this.drawWin(g, 150, 135, false);
    this.drawWin(g, 130, 163, true);
    g.fillStyle(0x3a1e0a, 1); g.fillRect(134, 168, 16, 27);
    g.fillStyle(0x5c3010, 1); g.fillRect(136, 170, 12, 25);

    // ── Casa in costruzione ───────────────────────────────────────────────
    // Pareti in blocchi di cemento a vista
    g.fillStyle(0x72808a, 1); g.fillRect(194, 95, 116, 100);
    // Giunti blocchi
    g.lineStyle(1, 0x50606a, 0.7);
    for (let cy = 107; cy < 195; cy += 12) g.lineBetween(194, cy, 310, cy);
    for (let cx = 210; cx < 310; cx += 20) g.lineBetween(cx, 95, cx, 195);
    // Aperture grezze (no infissi)
    g.fillStyle(0x040608, 1);
    g.fillRect(204, 112, 26, 24);   // finestra sx
    g.fillRect(276, 112, 26, 24);   // finestra dx
    g.fillRect(236, 152, 34, 40);   // porta
    // Ponteggio metallico
    g.lineStyle(2, 0x8a7a5a, 1);
    g.lineBetween(188, 65, 188, 195);   // palo sx
    g.lineBetween(316, 65, 316, 195);   // palo dx
    g.lineBetween(250, 65, 250, 195);   // palo centro
    g.lineBetween(188, 65,  316, 65);   // traversa alta
    g.lineBetween(188, 95,  316, 95);   // traversa media
    g.lineBetween(188, 145, 316, 145);  // traversa bassa
    // Tavoloni ponteggio
    g.fillStyle(0x52381a, 1);
    g.fillRect(186, 62, 132, 5);
    g.fillRect(186, 92, 132, 4);
    // Catasta sabbia ai piedi sx
    g.fillStyle(0x9a8840, 0.85); g.fillEllipse(176, 195, 32, 9);
    // Blocchi accatastati dx
    g.fillStyle(0x606e78, 1);
    g.fillRect(320, 183, 22, 10);
    g.fillRect(322, 173, 18, 10);
    g.fillRect(324, 164, 14, 10);

    // ── Casa 3: intonaco verde salvia ────────────────────────────────────
    g.fillStyle(0xa0b099, 1); g.fillRect(334, 112, 88, 83);
    g.fillStyle(0x82906a, 1); g.fillRect(332, 107, 92, 7);
    this.drawWin(g, 344, 128, false);
    this.drawWin(g, 386, 128, true);
    this.drawWin(g, 344, 158, true);
    this.drawWin(g, 386, 158, false);
    g.fillStyle(0x3a1e0a, 1); g.fillRect(366, 163, 18, 28);
    g.fillStyle(0x5c3010, 1); g.fillRect(368, 165, 14, 26);

    // ── Casa 4 parziale (destra) ─────────────────────────────────────────
    g.fillStyle(0xb0a8c8, 1); g.fillRect(436, 118, 44, 77);
    g.fillStyle(0x90889a, 1); g.fillRect(434, 113, 46, 7);
    this.drawWin(g, 442, 132, true);

    // ── Lampione ─────────────────────────────────────────────────────────
    g.fillStyle(0x3a3e55, 1); g.fillRect(430, 120, 4, 75);
    g.fillStyle(0x4a4e68, 1); g.fillRect(416, 116, 26, 6);
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    glow.fillStyle(0xffee88, 1); glow.fillCircle(432, 120, 30); glow.setAlpha(0.12);
    this.tweens.add({ targets: glow, alpha: 0.20, duration: 1800, yoyo: true, repeat: -1 });

    // ── Marciapiede e strada ─────────────────────────────────────────────
    g.fillStyle(0x1e2230, 1); g.fillRect(0, 190, W, 12);
    g.fillStyle(0x111520, 1); g.fillRect(0, 200, W, 70);
    g.fillStyle(0x2a2e40, 1);
    for (let lx = 0; lx < W; lx += 32) g.fillRect(lx, 216, 18, 3);
  }

  /** Finestra con persiane in stile meridionale. */
  private drawWin(g: Phaser.GameObjects.Graphics, x: number, y: number, lit: boolean): void {
    const WW = 20, WH = 17;
    g.fillStyle(0x2e1806, 1); g.fillRect(x - 2, y - 2, WW + 4, WH + 4); // incasso
    g.fillStyle(lit ? 0xffdd88 : 0x06080e, 1); g.fillRect(x, y, WW, WH);
    if (lit) { g.fillStyle(0xfff4aa, 0.4); g.fillRect(x + 2, y + 2, 8, WH - 4); }
    // Persiane
    g.fillStyle(0x3e2610, 1);
    g.fillRect(x - 7, y - 2, 6, WH + 4);
    g.fillRect(x + WW + 1, y - 2, 6, WH + 4);
    g.lineStyle(1, 0x241408, 0.5);
    for (let sy = y; sy < y + WH; sy += 3) {
      g.lineBetween(x - 7, sy, x - 1, sy);
      g.lineBetween(x + WW + 1, sy, x + WW + 7, sy);
    }
  }

  // ─── Grafica: esterno palazzo Cece ───────────────────────────────────────────

  private drawBuildingExterior(): void {
    const g = this.add.graphics().setDepth(0);

    // ── Cielo notturno ──────────────────────────────────────────────────
    g.fillStyle(0x060a14, 1); g.fillRect(0, 0, W, H);

    // Luna crescente (specularmente opposta, a sinistra)
    g.fillStyle(0xf4e8b8, 1); g.fillCircle(34, 22, 14);
    g.fillStyle(0x060a14, 1); g.fillCircle(26, 18, 13);

    for (const [sx, sy, big] of [
      [20,8,0],[70,15,0],[130,6,1],[185,12,0],[270,8,0],[340,16,0],[410,10,0],[460,13,0],
      [50,28,0],[110,38,0],[240,25,1],[320,33,0],[440,42,0],[160,19,0],[300,36,0],
    ] as [number,number,number][]) {
      g.fillStyle(0xdde0ff, 1);
      if (big) g.fillRect(sx - 1, sy - 1, 2, 2);
      else     g.fillRect(sx, sy, 1, 1);
    }

    // ── Casa sinistra (contesto) ─────────────────────────────────────────
    g.fillStyle(0xa0b090, 1); g.fillRect(0, 96, 128, 99);
    g.fillStyle(0x82907a, 1); g.fillRect(0, 92, 130, 7);
    this.drawWin(g, 14, 112, true);
    this.drawWin(g, 70, 112, false);
    g.fillStyle(0x3a1e0a, 1); g.fillRect(48, 154, 24, 41);
    g.fillStyle(0x5c3010, 1); g.fillRect(50, 156, 20, 39);

    // ── Casa destra (contesto) ───────────────────────────────────────────
    g.fillStyle(0xc0a090, 1); g.fillRect(352, 106, 128, 89);
    g.fillStyle(0xa08070, 1); g.fillRect(350, 102, 130, 7);
    this.drawWin(g, 366, 122, false);
    this.drawWin(g, 424, 122, true);
    g.fillStyle(0x3a1e0a, 1); g.fillRect(396, 158, 22, 37);
    g.fillStyle(0x5c3010, 1); g.fillRect(398, 160, 18, 35);

    // ── Casa di Cece — 2 piani, centrata ────────────────────────────────
    // HX=142, HY=68, HW=196, HH=127  → bottom = 195 (livello strada)
    const HX = 142, HY = 68, HW = 196, HH = 127;
    g.fillStyle(0xd4b878, 1); g.fillRect(HX, HY, HW, HH);

    // Cornicione
    g.fillStyle(0xb89860, 1); g.fillRect(HX - 4, HY - 6, HW + 8, 9);
    g.fillStyle(0xc8a870, 1); g.fillRect(HX - 4, HY - 6, HW + 8, 4);

    // Marcapiano (divide piano terra / primo piano)
    const GY = HY + 62; // = 130
    g.fillStyle(0xb49050, 1); g.fillRect(HX, GY, HW, 5);

    // Primo piano — finestre laterali
    this.drawWin(g, HX + 14, HY + 10, true);
    this.drawWin(g, HX + HW - 34, HY + 10, false);
    // Portafinestra centrale
    this.drawWin(g, HX + HW / 2 - 11, HY + 14, true);
    // Balconcino
    g.fillStyle(0xc0a060, 1); g.fillRect(HX + HW / 2 - 26, GY - 2, 52, 6);
    g.fillStyle(0x886640, 1);
    g.fillRect(HX + HW / 2 - 26, GY - 5, 52, 3);        // corrimano
    g.fillRect(HX + HW / 2 - 26, GY - 4, 2, 10);         // palo sx
    g.fillRect(HX + HW / 2 + 24, GY - 4, 2, 10);         // palo dx
    for (let bx = HX + HW / 2 - 20; bx < HX + HW / 2 + 24; bx += 8) {
      g.fillRect(bx, GY - 4, 2, 8);                       // sbarre
    }

    // Piano terra — finestre laterali
    this.drawWin(g, HX + 14, GY + 10, false);
    this.drawWin(g, HX + HW - 34, GY + 10, true);

    // Portoncino — DL=221, DT=134, DW=38, DH=61  → DOOR_CX=240=W/2
    const DL = HX + Math.round(HW / 2) - 19; // = 221
    const DT = GY + 4;                         // = 134
    const DW = 38;
    const DH = (HY + HH) - DT;                // = 61
    g.fillStyle(0x3a1e0a, 1); g.fillRect(DL - 3, DT - 3, DW + 6, DH + 3);  // cornice
    g.fillStyle(0x8b5030, 1); g.fillRect(DL, DT, DW, DH);                   // porta chiusa
    g.fillStyle(0x7a4020, 1);
    g.fillRect(DL + 2, DT + 2, DW / 2 - 3, DH - 4);                        // anta sx
    g.fillRect(DL + DW / 2 + 1, DT + 2, DW / 2 - 3, DH - 4);               // anta dx
    g.fillStyle(0x5a3010, 1); g.fillRect(DL + DW / 2 - 1, DT, 2, DH);      // divisore
    g.fillStyle(0xffcc44, 1);
    g.fillRect(DL + DW / 2 - 6, DT + Math.round(DH / 2), 4, 3);            // maniglia sx
    g.fillRect(DL + DW / 2 + 2, DT + Math.round(DH / 2), 4, 3);            // maniglia dx
    g.fillStyle(0xffffff, 0.7); g.fillRect(DL - 12, DT + 12, 8, 10);       // civico
    g.fillStyle(0x444444, 1);   g.fillRect(DL - 11, DT + 13, 6, 8);

    // Luce sopra la porta
    const doorLight = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
    doorLight.fillStyle(0xffdd88, 1);
    doorLight.fillCircle(DL + DW / 2, DT - 4, 22);
    doorLight.setAlpha(0.18);
    this.tweens.add({ targets: doorLight, alpha: 0.28, duration: 1000, yoyo: true, repeat: -1 });

    // ── Marciapiede e strada ────────────────────────────────────────────
    g.fillStyle(0x1e2230, 1); g.fillRect(0, 195, W, 10);
    g.fillStyle(0x111520, 1); g.fillRect(0, 203, W, 67);
    g.fillStyle(0x2a2e40, 1);
    for (let lx = 0; lx < W; lx += 32) g.fillRect(lx, 218, 18, 3);

    // ── Lampione ─────────────────────────────────────────────────────────
    g.fillStyle(0x3a3e55, 1); g.fillRect(88, 126, 4, 69);
    g.fillStyle(0x4a4e68, 1); g.fillRect(76, 122, 24, 6);
    const lampGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    lampGlow.fillStyle(0xffee88, 1); lampGlow.fillCircle(90, 126, 26); lampGlow.setAlpha(0.12);
    this.tweens.add({ targets: lampGlow, alpha: 0.18, duration: 1800, yoyo: true, repeat: -1 });
  }

  // ─── Grafica: interno top-down (come in piazza) ────────────────────────────

  private drawInteriorTopDown(): void {
    const g = this.add.graphics().setDepth(0);

    // ── Pavimento parquet a doghe ────────────────────────────────────
    for (let ty = 0; ty < H / 16 + 1; ty++) {
      for (let tx = 0; tx < W / 24; tx++) {
        const v = (tx + ty * 3) % 3;
        g.fillStyle([0x3d2410, 0x361f0d, 0x2e1a08][v], 1);
        g.fillRect(tx * 24, ty * 16, 24, 16);
      }
    }
    // Linee doghe orizzontali (leggero dettaglio)
    g.lineStyle(1, 0x1e0e04, 0.35);
    for (let dy = 46; dy < H; dy += 16) g.lineBetween(14, dy, W - 14, dy);

    // ── Parete di fondo (carta da parati festiva) ─────────────────
    g.fillStyle(0x3a2e1e, 1); g.fillRect(0, 0, W, 40);
    // Motivo a strisce verticali sottili sulla parete
    g.lineStyle(1, 0x4e3e2a, 0.5);
    for (let wx = 28; wx < W - 14; wx += 16) g.lineBetween(wx, 0, wx, 38);
    g.fillStyle(0x5a4228, 1); g.fillRect(0, 37, W, 4);   // battiscopa

    // ── Pareti laterali ───────────────────────────────────────────
    g.fillStyle(0x2a2018, 1); g.fillRect(0, 0, 14, H);
    g.fillRect(W - 14, 0, 14, H);

    // ── Casse musicali — angoli parete di fondo ───────────────────
    const drawSpeaker = (sx: number): void => {
      const sy = 0;
      // Cabinet con arrotondamenti simulati
      g.fillStyle(0x0c0c0c, 1); g.fillRect(sx, sy, 30, 40);
      g.fillStyle(0x1e1e1e, 1); g.fillRect(sx + 2, sy + 2, 26, 36);
      // Woofer principale (basso)
      g.fillStyle(0x3a3a3a, 1); g.fillEllipse(sx + 13, sy + 24, 22, 22);
      g.fillStyle(0x151515, 1); g.fillEllipse(sx + 13, sy + 24, 15, 15);
      g.fillStyle(0x282828, 1); g.fillEllipse(sx + 13, sy + 24, 8, 8);
      g.fillStyle(0x6a6a6a, 1); g.fillEllipse(sx + 13, sy + 24, 3, 3);
      // Tweeter (alto)
      g.fillStyle(0x2e2e2e, 1); g.fillEllipse(sx + 13, sy + 9, 9, 9);
      g.fillStyle(0x484848, 1); g.fillEllipse(sx + 13, sy + 9, 5, 5);
      g.fillStyle(0x888888, 1); g.fillEllipse(sx + 13, sy + 9, 2, 2);
      // LED strip in fondo
      g.fillStyle(0x003366, 1); g.fillRect(sx + 4, sy + 35, 22, 3);
      g.fillStyle(0x0055bb, 1); g.fillRect(sx + 4, sy + 35, 7, 3);
      g.fillStyle(0x22aaff, 1); g.fillRect(sx + 5, sy + 35, 3, 3);
    };
    drawSpeaker(14);
    drawSpeaker(W - 44);

    // ── Tavolo principale (torta al centro) ───────────────────────
    // Tavolo largo per tutta la zona centrale
    const TX = 78, TY = 62, TW = 324, TH = 42;
    g.fillStyle(0x2a1a08, 1); g.fillRect(TX, TY, TW, TH);
    g.fillStyle(0x3e2410, 1); g.fillRect(TX, TY, TW, 5);   // bordo ant.
    g.fillStyle(0x1e1008, 1); g.fillRect(TX, TY + TH - 3, TW, 3); // bordo post.
    // Tovaglia a scacchi rosso/bianco
    for (let ci = 0; ci < 13; ci++) {
      for (let cj = 0; cj < 2; cj++) {
        g.fillStyle((ci + cj) % 2 === 0 ? 0xcc2222 : 0xffffff, 0.20);
        g.fillRect(TX + 2 + ci * 24, TY + 6 + cj * 17, 24, 17);
      }
    }
    // Piatti di antipasti a sx e dx del cake
    const snackPlate = (px: number, py: number): void => {
      g.fillStyle(0xece8de, 1); g.fillEllipse(px, py, 28, 15);
      g.fillStyle(0xf4a020, 1); g.fillEllipse(px - 7, py, 8, 5);    // bruschetta
      g.fillStyle(0xbb2200, 0.9); g.fillEllipse(px - 6, py - 1, 4, 3); // pomodoro
      g.fillStyle(0xf0e090, 1); g.fillRect(px + 2, py - 4, 9, 6);   // tramezzino
      g.fillStyle(0x77aa33, 0.9); g.fillRect(px + 3, py - 3, 7, 4); // lattuga
      g.fillStyle(0xee8844, 1); g.fillEllipse(px + 8, py + 2, 7, 5); // vol-au-vent
    };
    snackPlate(TX + 44, TY + 23);
    snackPlate(TX + TW - 44, TY + 23);
    // Bicchieri sparsi sul tavolo (area sx)
    const tGlass = (gx: number, gy: number, col: number): void => {
      g.fillStyle(col, 0.88); g.fillRect(gx, gy, 7, 11);
      g.fillStyle(0xffffff, 0.32); g.fillRect(gx + 1, gy + 1, 2, 8);
      g.fillStyle(0x333333, 0.2); g.fillRect(gx, gy + 10, 7, 1);
    };
    tGlass(TX + 82,  TY + 14, 0xaaddff);
    tGlass(TX + 93,  TY + 26, 0xffee88);
    tGlass(TX + TW - 90, TY + 16, 0xbbffcc);
    tGlass(TX + TW - 100, TY + 27, 0xff99aa);
    // Bottiglie sul tavolo
    const tBottle = (bx: number, by: number, col: number): void => {
      g.fillStyle(col, 1); g.fillRect(bx, by, 5, 20);
      g.fillStyle(0xffffff, 0.22); g.fillRect(bx + 1, by + 2, 2, 14);
      g.fillStyle(0xffffff, 0.55); g.fillRect(bx + 1, by, 3, 4);  // capsula
    };
    tBottle(TX + 118, TY + 8, 0x1e6622);
    tBottle(TX + TW - 123, TY + 8, 0x7a1a22);

    // ── Tavolino cibo SX ─────────────────────────────────────────
    const SLX = 14, SLY = 108, SLW = 78, SLH = 40;
    g.fillStyle(0x2a1a08, 1); g.fillRect(SLX, SLY, SLW, SLH);
    g.fillStyle(0x3e2410, 1); g.fillRect(SLX, SLY, SLW, 5);
    g.fillStyle(0xf6f0e2, 0.90); g.fillRect(SLX + 2, SLY + 5, SLW - 4, SLH - 7);
    // Arancini (fila in alto)
    for (let ai = 0; ai < 4; ai++) {
      g.fillStyle(0xce8010, 1); g.fillEllipse(SLX + 11 + ai * 16, SLY + 16, 13, 9);
      g.fillStyle(0xe8a828, 0.65); g.fillEllipse(SLX + 10 + ai * 16, SLY + 14, 6, 4);
    }
    // Tramezzini (a sx in basso)
    g.fillStyle(0xf0e0a0, 1); g.fillRect(SLX + 4, SLY + 27, 16, 10);
    g.fillStyle(0x77aa33, 0.85); g.fillRect(SLX + 5, SLY + 28, 14, 8);
    g.fillStyle(0xf0e0a0, 1); g.fillRect(SLX + 22, SLY + 27, 16, 10);
    g.fillStyle(0xee6644, 0.85); g.fillRect(SLX + 23, SLY + 28, 14, 8);
    // Dolcini (a dx in basso)
    g.fillStyle(0xcc80aa, 1); g.fillEllipse(SLX + 53, SLY + 30, 14, 9);   // panna cotta
    g.fillStyle(0xffddee, 0.7); g.fillEllipse(SLX + 52, SLY + 28, 6, 4);
    g.fillStyle(0x6b3318, 1); g.fillEllipse(SLX + 68, SLY + 30, 14, 9);   // pasticcino cioccolato
    g.fillStyle(0x996633, 0.55); g.fillEllipse(SLX + 67, SLY + 28, 6, 4);
    // Piccola fontanella di punch a dx alto
    g.fillStyle(0xcc2244, 0.88); g.fillEllipse(SLX + 62, SLY + 16, 14, 9);
    g.fillStyle(0xff5577, 0.5); g.fillEllipse(SLX + 62, SLY + 14, 7, 4);
    g.lineStyle(1, 0xaa1133, 0.7); g.strokeEllipse(SLX + 62, SLY + 16, 14, 9);

    // ── Tavolino drink DX ─────────────────────────────────────────
    const SRX = W - 92, SRY = 108, SRW = 78, SRH = 40;
    g.fillStyle(0x2a1a08, 1); g.fillRect(SRX, SRY, SRW, SRH);
    g.fillStyle(0x3e2410, 1); g.fillRect(SRX, SRY, SRW, 5);
    g.fillStyle(0xf6f0e2, 0.90); g.fillRect(SRX + 2, SRY + 5, SRW - 4, SRH - 7);
    // Secchiello del ghiaccio (centro-dx)
    const BCX = SRX + SRW - 28;
    g.fillStyle(0xb8c2cc, 1); g.fillRect(BCX, SRY + 7, 24, 28);
    g.fillStyle(0xa2abb4, 1); g.fillRect(BCX + 2, SRY + 9, 20, 24);
    // riflessione metallo
    g.fillStyle(0xdde4ea, 0.5); g.fillRect(BCX + 2, SRY + 9, 5, 22);
    // cubetti ghiaccio
    for (let ii = 0; ii < 4; ii++) {
      g.fillStyle(0xd8eeff, 0.82); g.fillRect(BCX + 4 + ii * 4, SRY + 10, 3, 3);
      g.fillStyle(0xf0f8ff, 0.5); g.fillRect(BCX + 4 + ii * 4, SRY + 10, 1, 1);
    }
    // bottiglia in secchiello
    g.fillStyle(0x1a5e22, 1); g.fillRect(BCX + 9, SRY + 4, 6, 26);
    g.fillStyle(0x3a8840, 0.45); g.fillRect(BCX + 10, SRY + 5, 2, 20);
    g.fillStyle(0xffd700, 1); g.fillRect(BCX + 9, SRY + 3, 6, 5); // capsula oro
    // Bicchieri a sx del secchiello
    const sGlass = (gx: number, gy: number, col: number): void => {
      g.fillStyle(col, 0.90); g.fillRect(gx, gy, 8, 13);
      g.fillStyle(0xffffff, 0.36); g.fillRect(gx + 1, gy + 1, 2, 10);
      g.fillStyle(0x444444, 0.2); g.fillRect(gx, gy + 12, 8, 1);
    };
    sGlass(SRX + 6,  SRY + 9,  0xaaddff);
    sGlass(SRX + 16, SRY + 22, 0xffee88);
    sGlass(SRX + 28, SRY + 11, 0xff88bb);
    sGlass(SRX + 6,  SRY + 24, 0xbbffcc);
    // Bottiglie a sx del secchiello
    tBottle(SRX + 40, SRY + 6, 0x7a1a22);
    tBottle(SRX + 48, SRY + 6, 0xf0c820);  // limoncello

    // ── Luci ambiente ─────────────────────────────────────────────
    const warm = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    warm.fillStyle(0xff9944, 1); warm.fillCircle(W / 2, 115, 160); warm.setAlpha(0.06);
    this.tweens.add({ targets: warm, alpha: 0.11, duration: 1600, yoyo: true, repeat: -1 });
    // Glow LED cassa sx
    const glL = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    glL.fillStyle(0x1166ff, 1); glL.fillCircle(29, 20, 26); glL.setAlpha(0.07);
    this.tweens.add({ targets: glL, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
    // Glow LED cassa dx
    const glR = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    glR.fillStyle(0x1166ff, 1); glR.fillCircle(W - 29, 20, 26); glR.setAlpha(0.07);
    this.tweens.add({ targets: glR, alpha: 0.15, duration: 700, delay: 350, yoyo: true, repeat: -1 });
  }

  // ─── Grafica: torta gigante con 18 ───────────────────────────────────────────

  private drawGiantCake(x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(80);

    // Piatto
    g.fillStyle(0xe8e0d0,1); g.fillEllipse(x,y+34,90,16);

    // Base torta — 3 strati
    g.fillStyle(0x8b4513,1); g.fillRect(x-36,y+16,72,18);
    g.fillStyle(0xa0522d,1); g.fillRect(x-36,y+16,72,5);

    g.fillStyle(0xffd700,1); g.fillRect(x-36,y-2,72,20);
    g.fillStyle(0xffe44a,1); g.fillRect(x-36,y-2,72,5);

    g.fillStyle(0x8b4513,1); g.fillRect(x-30,y-16,60,16);
    g.fillStyle(0xa0522d,1); g.fillRect(x-30,y-16,60,4);

    // Glassa
    g.fillStyle(0xffffff,1); g.fillRect(x-36,y-6,72,8);
    for (let i=0;i<7;i++) {
      g.fillStyle(0xffeedd,1); g.fillEllipse(x-27+i*9,y-4,8,6);
    }

    // Scritta "18" grossa al centro
    g.fillStyle(0xff2255,1);
    // 1
    g.fillRect(x-12,y+2,3,12);
    g.fillRect(x-14,y+2,3,3);
    // 8
    g.fillRect(x-3,y+2,10,3); g.fillRect(x-3,y+7,10,3); g.fillRect(x-3,y+12,10,3);
    g.fillRect(x-3,y+2,3,6); g.fillRect(x+4,y+2,3,6);
    g.fillRect(x-3,y+7,3,6); g.fillRect(x+4,y+7,3,6);

    // 8 candeline
    const cxArr=[-28,-19,-10,-1,8,17,26,35];
    const candleColors=[0xff6699,0x66aaff,0xffdd44,0x88ff88,0xcc88ff,0xff9933,0xff6699,0x66aaff];
    cxArr.forEach((cx,i)=>{
      g.fillStyle(candleColors[i],1); g.fillRect(x+cx-1,y-28,3,14);
      g.fillStyle(0xffee44,1); g.fillEllipse(x+cx,y-30,5,7);
      g.fillStyle(0xffffff,0.7); g.fillEllipse(x+cx,y-32,2,3);
    });

    // Glow candeline pulsante
    const cGlow=this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(79);
    cGlow.fillStyle(0xffee44,1); cGlow.fillCircle(x,y-26,50); cGlow.setAlpha(0.14);
    this.tweens.add({ targets: cGlow, alpha: 0.24, duration: 400, yoyo: true, repeat: -1 });
    return cGlow;
  }

  // ─── Grafica: bandierine già appese ──────────────────────────────────────────

  private drawStaticBanners(): void {
    const g = this.add.graphics().setDepth(90);
    const colors=[0xff3366,0x3399ff,0xffdd33,0x33ff88,0xcc44ff,0xff8833];

    g.lineStyle(1,0x888866,0.6);
    g.beginPath(); g.moveTo(0,14); g.lineTo(W,14); g.strokePath();
    g.lineStyle(1,0x777755,0.4);
    g.beginPath(); g.moveTo(20,24); g.lineTo(W-20,24); g.strokePath();

    for (let i=0;i<15;i++) {
      const bx=8+i*(W-16)/14;
      g.fillStyle(colors[i%colors.length],0.9);
      g.fillTriangle(bx-5,14,bx+5,14,bx,26);
    }
    for (let i=0;i<10;i++) {
      const bx=28+i*(W-56)/9;
      g.fillStyle(colors[(i+2)%colors.length],0.7);
      g.fillTriangle(bx-4,24,bx+4,24,bx,34);
    }

    // Palloncini angoli
    for (const [bx,by,col] of [[12,44,0xff3366],[W-12,44,0x3399ff],[W/2,38,0xffdd33]] as [number,number,number][]) {
      g.fillStyle(col,0.85); g.fillEllipse(bx,by,13,17);
      g.fillStyle(0xffffff,0.25); g.fillEllipse(bx-3,by-4,4,5);
      g.lineStyle(1,col,0.5); g.lineBetween(bx,by+8,bx+3,by+22);
    }
  }

  // ─── Coriandoli ──────────────────────────────────────────────────────────────

  private burstConfetti(): void {
    const colors=[0xff3366,0x3399ff,0xffdd33,0x33ff88,0xcc44ff,0xff8833,0xffffff];
    for (let c=0;c<40;c++) {
      const cx=Phaser.Math.Between(20,W-20);
      const cg=this.add.graphics().setDepth(120).setPosition(cx, Phaser.Math.Between(30,H/2));
      cg.fillStyle(colors[c%colors.length],1);
      if(c%3===0) cg.fillRect(-2,-3,4,6);
      else if(c%3===1) cg.fillRect(-3,-3,6,6);
      else cg.fillCircle(0,0,2);
      this.tweens.add({
        targets: cg,
        y: `+=${Phaser.Math.Between(50,130)}`,
        x: `+=${Phaser.Math.Between(-40,40)}`,
        angle: Phaser.Math.Between(-270,270),
        alpha: { from: 1, to: 0 },
        duration: Phaser.Math.Between(700,1500),
        ease: 'Quad.easeIn',
        delay: c*30,
        onComplete: ()=>cg.destroy(),
      });
    }
  }
}
