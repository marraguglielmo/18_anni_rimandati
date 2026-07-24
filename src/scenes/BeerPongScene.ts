import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from '../config';
import { DialogueSystem, SPEAKER_COLORS, type DialogueLine } from '../systems/DialogueSystem';
import {
  addNameLabel,
  CHAR_CONFIGS,
  CHAR_SCALE,
  generateBattleSprite,
  generateSpriteTexture,
  loadPortraits,
} from '../systems/CharacterSprite';
import { TransitionSystem } from '../systems/TransitionSystem';
import { AudioManager } from '../systems/AudioManager';

const FONT = '"Press Start 2P", monospace';

// Fisica del lancio a mano
const GRAV = 420; // px/s²
const ANCHOR = { x: 108, y: 150 }; // mano di Umberto: da qui parte la pallina
const MAX_DRAG = 130;   // ampio: si può mirare liberamente in altezza e lunghezza
const LAUNCH_K = 6.0;   // velocità = trazione * K
const MIN_DROP_V = 90;  // velocità di caduta minima per entrare nel bicchiere (arco alto)
const FLOOR_Y = 210;
const TABLE = { x1: 140, x2: 432, y: 196 }; // piano fisico del tavolo
const CUP_W = 13;
const CUP_H = 13;
const MAX_ROUNDS = 7; // sicurezza: il rigging chiude prima

const INTRO_LINES: DialogueLine[] = [
  { speaker: 'guglielmo', text: 'Ecco i perdenti. Un tiro a testa, si gioca finché c\'è da bere.' },
  { speaker: 'aniceto', text: 'Chi becca il bicchiere, l\'altro beve. Sciamu.' },
  { speaker: 'umberto', text: 'Comincio io *hihihihi*' },
];

const OUTRO_LINES: DialogueLine[] = [
  { speaker: 'guglielmo', text: 'Sucati cujuni.' },
  { speaker: 'guglielmo', text: 'Umberto t\'apposto?' },
  { speaker: 'umberto', text: 'STO BENISSIMO. *hic* Perché ci sono due Trande?' },
  { speaker: 'trande', text: 'Ok che figura di merda... si torna a casa. Appoggiati a me che te l\'appoggio.' },
  { speaker: 'aniceto', text: 'Festa bellissima porcaccio il dio' },
];

const SPECTATORS = ['riccardo', 'cece', 'stefano', 'ilaria', 'cosimino'];

const CROWD_LINES: Record<'hit' | 'miss' | 'drink', string[]> = {
  hit: ['EEEEEH!', 'Crazy', 'Dentro!', 'Pazzesco!', 'Giocone!', 'Olè!'],
  miss: ['Buuuu!', 'Mia nonna tira meglio!', 'Aria!', 'Che pippa!', 'Imbarazzante.', 'Porca puttana che merda'],
  drink: ['GIU! GIU! GIU!', 'Umbe\' vacci piano!', 'Un altro!', 'Alla goccia'],
};

interface Cup {
  x: number;
  top: number;
  alive: boolean;
  gfx: Phaser.GameObjects.Graphics;
  halfW: number; // metà larghezza reale per collision detection
}

type ThrowState = 'idle' | 'ready' | 'aiming' | 'flying';

export class BeerPongScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;
  private ball!: Phaser.GameObjects.Arc;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private dots: Phaser.GameObjects.Arc[] = [];
  private messageText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private drunkTexts = new Map<string, Phaser.GameObjects.Text>();
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private spectators = new Map<string, Phaser.GameObjects.Sprite>();
  private swayTweens = new Map<string, Phaser.Tweens.Tween>();

  private playerCups: Cup[] = []; // bicchieri del team Umberto (bersagli avversari)
  private enemyCups: Cup[] = []; // bicchieri di Guglielmo/Aniceto (bersagli del player)
  private drinks = new Map<string, number>();

  private state: ThrowState = 'idle';
  private vx = 0;
  private vy = 0;
  private bounces = 0;
  private activeTargets: Cup[] = [];
  private throwResolve: ((hit: Cup | null) => void) | null = null;
  private enemyDrinkToggle = 0;
  private anicetoMissed = false;  // manca solo al primo tiro, poi sempre a segno

  constructor() {
    super('BeerPongScene');
  }

  preload(): void {
    loadPortraits(this, ['umberto', 'trande', 'guglielmo', 'aniceto', ...SPECTATORS]);
  }

  create(): void {
    this.resetState();
    TransitionSystem.fadeFromBlack(this, 400);
    AudioManager.get().playFgMusic(this, 'beerpong', 0.75, 0);

    this.drawRoom();
    this.drawTable();   // depth=30: copre le gambe degli spettatori (depth=20)
    this.addPartyEffects();
    this.spawnCharacters();
    this.createCups();
    this.createBall();
    this.createUi();
    this.bindInput();

    this.dialogue = new DialogueSystem(this);
    TransitionSystem.announceArea(this, 'BEER PONG — 2 VS 2');

    // ESC per saltare il minigioco
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .once('down', () => {
        AudioManager.get().stopFgMusic(this);
        TransitionSystem.fadeToScene(this, 'PartyScene', { pongDone: true }, 600);
      });

    void this.run();
  }

  private resetState(): void {
    this.dots = [];
    this.playerCups = [];
    this.enemyCups = [];
    this.drinks = new Map([
      ['umberto', 0],
      ['trande', 0],
      ['guglielmo', 0],
      ['aniceto', 0],
    ]);
    this.drunkTexts = new Map();
    this.sprites = new Map();
    this.spectators = new Map();
    this.swayTweens = new Map();
    this.state = 'idle';
    this.throwResolve = null;
    this.enemyDrinkToggle = 0;
    this.anicetoMissed = false;
  }

  // ------------------------------------------------------------ flusso

  private async run(): Promise<void> {
    await this.runDialogue(INTRO_LINES);

    // La partita dura finché Guglielmo e Aniceto non centrano TUTTI i
    // bicchieri di Umberto/Trande. Gli esiti sono riggati:
    //   • Guglielmo: sempre a segno
    //   • Aniceto: manca solo il primo tiro (per compassione), poi sempre a segno
    //   • Trande: sempre sbaglia
    let round = 1;
    while (this.cupsAlive(this.playerCups) > 0 && round <= MAX_ROUNDS) {
      this.turnText.setText(`ROUND ${round}`);

      // 1. UMBERTO (interattivo) — il più ubriaco apre sempre
      if (this.cupsAlive(this.enemyCups) > 0) {
        await this.showMessage('Tira UMBERTO! Trascina dal suo braccio e rilascia.');
        this.zoomToUmberto();
        const hit = await this.playerThrow();
        this.resetZoom();
        await this.resolveThrow('umberto', hit, 'enemy');
      } else {
        await this.showMessage('Niente più bersagli per UMBERTO... che beve in attesa.');
        this.addDrink('umberto');
        this.crowdReact('drink');
      }

      // 2. GUGLIELMO: sempre a segno
      await this.autoThrow('guglielmo', this.playerCups, true, 'player');
      if (this.cupsAlive(this.playerCups) === 0) break;

      // 3. TRANDE: sempre sbaglia
      await this.autoThrow('trande', this.enemyCups, false, 'enemy');

      // 4. ANICETO: manca solo il primo tiro, poi sempre a segno
      const aniHit = this.anicetoMissed;
      if (!this.anicetoMissed) this.anicetoMissed = true;
      await this.autoThrow('aniceto', this.playerCups, aniHit, 'player');
      round++;
    }

    await this.finale();
  }

  private cupsAlive(list: Cup[]): number {
    return list.filter((c) => c.alive).length;
  }

  private async finale(): Promise<void> {
    this.burstConfetti();
    await this.showMessage('GUGLIELMO e ANICETO vincono la sfida!');
    this.crowdReact('hit');
    await this.showMessage('UMBERTO, per ripicca, svuota anche i bicchieri rimasti sul tavolo.');
    // i bicchieri superstiti svaniscono... dentro Umberto
    for (const cup of [...this.playerCups, ...this.enemyCups]) {
      if (!cup.alive) continue;
      cup.alive = false;
      this.tweens.add({ targets: cup.gfx, alpha: 0, y: '+=6', duration: 400 });
    }
    this.addDrink('umberto');
    this.crowdReact('drink');
    await this.showMessage('*glu glu glu*');
    this.addDrink('umberto');
    await this.showMessage('...Ecco. Ora è ufficialmente il più ubriaco della storia.');
    await this.runDialogue(OUTRO_LINES);
    AudioManager.get().stopFgMusic(this); // fine beerpong → BGM torna su
    TransitionSystem.fadeToScene(this, 'PartyScene', { pongDone: true }, 1500);
  }

  private runDialogue(lines: DialogueLine[]): Promise<void> {
    return new Promise((resolve) => this.dialogue.start({ lines, onComplete: resolve }));
  }

  // ------------------------------------------------------------ tiri

  private playerThrow(): Promise<Cup | null> {
    this.activeTargets = this.enemyCups;
    this.ball.setPosition(ANCHOR.x, ANCHOR.y).setVisible(true);
    this.state = 'ready';
    return new Promise((resolve) => {
      this.throwResolve = resolve;
    });
  }

  private autoThrow(
    id: string,
    targets: Cup[],
    shouldHit: boolean,
    side: 'player' | 'enemy'
  ): Promise<void> {
    const alive = targets.filter((c) => c.alive);
    const fromRight = side === 'player'; // gli avversari tirano da destra
    return (async (): Promise<void> => {
      await this.showMessage(`Tira ${id.toUpperCase()}...`);
      if (alive.length === 0) {
        await this.showMessage('...ma non ci sono più bicchieri. Tiro a vuoto!');
        return;
      }
      const cup = Phaser.Math.RND.pick(alive);
      const startX = fromRight ? 436 : 104;
      const startY = 130;
      // se deve mancare, mira con un offset
      const aimX = cup.x + (shouldHit ? 0 : Phaser.Math.RND.pick([-26, 26]));
      const flight = 0.85;
      this.vx = (aimX - startX) / flight;
      this.vy = (cup.top - startY - 0.5 * GRAV * flight * flight) / flight;
      this.ball.setPosition(startX, startY).setVisible(true);
      this.bounces = 0;
      this.activeTargets = shouldHit ? targets : [];
      this.state = 'flying';
      const hit = await new Promise<Cup | null>((resolve) => {
        this.throwResolve = resolve;
      });
      await this.resolveThrow(id, hit, side);
    })();
  }

  private async resolveThrow(
    throwerId: string,
    hit: Cup | null,
    side: 'player' | 'enemy'
  ): Promise<void> {
    if (!hit) {
      AudioManager.get().playSFX(this, 'scontro', 0.4);   // suono "negativo" sul miss
      this.crowdReact('miss');
      await this.showMessage(
        Phaser.Math.RND.pick(['Mancato!', 'Fuori di poco!', 'La palla rotola via...'])
      );
      return;
    }

    // splash + bicchiere eliminato — suono "positivo" sul centro
    AudioManager.get().playSFX(this, 'coin', 0.5);
    this.splash(hit.x, hit.top);
    hit.alive = false;
    this.tweens.add({
      targets: hit.gfx,
      alpha: 0,
      y: '+=6',
      duration: 300,
      onComplete: () => hit.gfx.destroy(),
    });
    this.crowdReact('hit');
    await this.showMessage(`${throwerId.toUpperCase()} centra il bicchiere!`);

    if (side === 'enemy') {
      // il player ha colpito: beve un avversario... e Umberto brinda comunque
      const drinker = this.enemyDrinkToggle++ % 2 === 0 ? 'guglielmo' : 'aniceto';
      this.addDrink(drinker);
      await this.showMessage(`${drinker.toUpperCase()} beve!`);
      this.addDrink('umberto');
      this.crowdReact('drink');
      await this.showMessage('UMBERTO: "Alla salute!" *beve pure lui*');
    } else {
      // hanno colpito il team di Umberto: beve sempre lui
      this.addDrink('umberto');
      this.crowdReact('drink');
      await this.showMessage('UMBERTO: "Tranquillo Trande, bevo io." *glu glu*');
    }
  }

  private addDrink(id: string): void {
    const n = (this.drinks.get(id) ?? 0) + 1;
    this.drinks.set(id, n);
    this.drunkTexts.get(id)?.setText(`${id.toUpperCase()} ${'■'.repeat(n)}`);

    // barcollamento crescente
    const sprite = this.sprites.get(id);
    if (!sprite) return;
    this.swayTweens.get(id)?.remove();
    this.swayTweens.set(
      id,
      this.tweens.add({
        targets: sprite,
        angle: { from: -2 * n, to: 2 * n },
        duration: Math.max(220, 500 - n * 60),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    );
  }

  // ----------------------------------------------------------- pubblico

  /** Nuvoletta di commento sopra uno spettatore (sottofondo, non chat). */
  private showBubble(id: string, text: string): void {
    const s = this.spectators.get(id);
    if (!s) return;
    const t = this.add
      .text(0, 0, text, {
        fontFamily: FONT,
        fontSize: '5px',
        color: '#222222',
        align: 'center',
        wordWrap: { width: 78 },
      })
      .setOrigin(0.5);
    const w = t.width + 10;
    const h = t.height + 8;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95);
    g.lineStyle(1, 0x222222, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 3);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 3);
    g.fillTriangle(-3, h / 2, 4, h / 2, 0, h / 2 + 5);
    g.lineBetween(-3, h / 2, 0, h / 2 + 5);
    g.lineBetween(4, h / 2, 0, h / 2 + 5);

    const c = this.add
      .container(s.x, s.y - 24 - h / 2, [g, t])
      .setDepth(950)
      .setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.time.delayedCall(1700, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
    });
  }

  private crowdReact(type: 'hit' | 'miss' | 'drink'): void {
    const id = Phaser.Math.RND.pick(SPECTATORS);
    this.showBubble(id, Phaser.Math.RND.pick(CROWD_LINES[type]));
  }

  // ------------------------------------------------------------ input

  private bindInput(): void {
    this.input.on('pointerdown', () => {
      if (this.state === 'ready') this.state = 'aiming';
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.state !== 'aiming') return;
      this.updateAim(p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.state !== 'aiming') return;
      const drag = this.clampDrag(p);
      if (drag.length() < 8) {
        // trazione troppo corta: torna in attesa
        this.state = 'ready';
        this.ball.setPosition(ANCHOR.x, ANCHOR.y);
        this.hideDots();
        return;
      }
      // lancio! (mira libera in altezza e lunghezza)
      this.vx = -drag.x * LAUNCH_K;
      this.vy = -drag.y * LAUNCH_K;
      this.bounces = 0;
      this.state = 'flying';
      this.hideDots();
      this.throwUmberto();
      AudioManager.get().playSFX(this, 'confirm', 0.5);
    });
  }

  private clampDrag(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const v = new Phaser.Math.Vector2(p.worldX - ANCHOR.x, p.worldY - ANCHOR.y);
    if (v.length() > MAX_DRAG) v.setLength(MAX_DRAG);
    return v;
  }

  private updateAim(p: Phaser.Input.Pointer): void {
    const drag = this.clampDrag(p);
    const bx = ANCHOR.x + drag.x;
    const by = ANCHOR.y + drag.y;
    this.ball.setPosition(bx, by);

    // anteprima traiettoria: mostra l'intera parabola (altezza e lunghezza
    // libere) finché resta a schermo, così si calcola il tiro a piacere.
    const vx = -drag.x * LAUNCH_K;
    const vy = -drag.y * LAUNCH_K;
    const aiming = drag.length() >= 8;
    this.dots.forEach((dot, i) => {
      const t = 0.05 * (i + 1);
      const px = bx + vx * t;
      const py = by + vy * t + 0.5 * GRAV * t * t;
      const onScreen = px > -10 && px < GAME_WIDTH + 10 && py < GAME_HEIGHT + 10;
      dot.setPosition(px, py).setVisible(aiming && onScreen);
    });
  }

  /**
   * Zoom leggero verso Umberto: segnala che tocca a lui.
   * Va SEMPRE verso valori fissi noti (zoom base = RENDER_SCALE, centro 240,135
   * impostati da fadeFromBlack) così lo zoom non si può mai accumulare.
   */
  private zoomToUmberto(): void {
    const cam = this.cameras.main;
    cam.zoomTo(RENDER_SCALE * 1.13, 340, 'Sine.easeInOut');
    cam.pan(210, 150, 340, 'Sine.easeInOut');   // leggermente verso Umberto (sx)
  }

  /** Ripristina l'inquadratura base (identica a inizio scena). */
  private resetZoom(): void {
    const cam = this.cameras.main;
    cam.zoomTo(RENDER_SCALE, 300, 'Sine.easeInOut');
    cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 300, 'Sine.easeInOut');
  }

  /** Braccio di Umberto: rapido affondo in avanti che simula il lancio. */
  private throwUmberto(): void {
    const s = this.sprites.get('umberto');
    if (!s) return;
    const x0 = s.x, y0 = s.y;
    this.tweens.add({
      targets: s, x: x0 + 7, y: y0 - 3,
      duration: 90, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  private hideDots(): void {
    this.dots.forEach((d) => d.setVisible(false));
  }

  // ------------------------------------------------------------ fisica

  update(): void {
    if (this.state !== 'flying') {
      this.ballShadow.setVisible(false);
      return;
    }
    const dt = this.game.loop.delta / 1000;

    this.vy += GRAV * dt;
    const nx = this.ball.x + this.vx * dt;
    const ny = this.ball.y + this.vy * dt;
    this.ball.setPosition(nx, ny);

    // ombra della palla sul tavolo (immersione)
    const overTable = nx > TABLE.x1 && nx < TABLE.x2;
    this.ballShadow
      .setVisible(overTable && ny < TABLE.y)
      .setPosition(nx, TABLE.y + 2)
      .setAlpha(Phaser.Math.Clamp(0.45 - (TABLE.y - ny) / 250, 0.08, 0.45));

    // Canestro realistico: la palla deve arrivare ALTA e cadere dritta dentro
    // il bicchiere — niente centri dopo rimbalzi o con traiettorie basse.
    //   • bounces === 0  → nessun rimbalzo sul tavolo prima
    //   • vy > MIN_DROP_V → sta cadendo con un arco vero (non piatta)
    //   • margine orizzontale stretto (halfW), ingresso dall'alto sul bordo
    if (this.vy > MIN_DROP_V && this.bounces === 0) {
      for (const cup of this.activeTargets) {
        if (!cup.alive) continue;
        if (Math.abs(nx - cup.x) < cup.halfW && ny > cup.top - 3 && ny < cup.top + 8) {
          this.finishBall(cup);
          return;
        }
      }
    }

    // rimbalzo sul tavolo
    if (ny >= TABLE.y - 3 && this.vy > 0 && overTable) {
      this.bounces++;
      if (this.bounces > 2 || Math.abs(this.vy) < 40) {
        this.finishBall(null);
        return;
      }
      this.vy *= -0.5;
      this.vx *= 0.85;
      this.ball.setY(TABLE.y - 3);
      AudioManager.get().playSFX(this, 'text', 0.3);
    }

    // fuori schermo
    if (ny > GAME_HEIGHT + 20 || nx < -20 || nx > GAME_WIDTH + 20) {
      this.finishBall(null);
    }
  }

  private finishBall(hit: Cup | null): void {
    this.state = 'idle';
    // Emote nel punto d'atterraggio: verde CENTRO sul bicchiere, rosso MISS dove cade
    if (hit) this.landingLabel(hit.x, hit.top - 3, 'CENTRO', '#39d353');
    else this.landingLabel(this.ball.x, Math.min(this.ball.y, TABLE.y), 'MISS', '#ff5555');
    this.ball.setVisible(false);
    this.ballShadow.setVisible(false);
    const resolve = this.throwResolve;
    this.throwResolve = null;
    resolve?.(hit);
  }

  /** Testo che spunta e sale dal punto d'atterraggio della palla. */
  private landingLabel(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT, fontSize: '8px', color,
        stroke: '#000000', strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(970)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t, y: y - 16, alpha: 0,
      delay: 360, duration: 560, ease: 'Quad.easeIn',
      onComplete: () => t.destroy(),
    });
  }

  private splash(x: number, y: number): void {
    if (!this.textures.exists('fx-px')) {
      const g = this.make.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture('fx-px', 4, 4);
      g.destroy();
    }
    const em = this.add
      .particles(x, y, 'fx-px', {
        speed: { min: 40, max: 140 },
        lifespan: 450,
        scale: { start: 1.2, end: 0 },
        tint: [0xffbb33, 0xcc3333, 0xffffff], // birra + bicchiere
        emitting: false,
      })
      .setDepth(600);
    em.explode(26);
    this.time.delayedCall(500, () => em.destroy());
  }

  // ------------------------------------------------------------ setup

  /** Tavolo separato dalla texture cached: depth=30 copre le gambe degli spettatori (20). */
  private drawTable(): void {
    const g = this.add.graphics().setDepth(30);
    // Piano trapezoidale (più largo davanti, prospettiva)
    g.fillStyle(0x256a3f);
    g.fillPoints([
      new Phaser.Geom.Point(160, 186),
      new Phaser.Geom.Point(412, 186),
      new Phaser.Geom.Point(TABLE.x2, TABLE.y + 6),
      new Phaser.Geom.Point(TABLE.x1, TABLE.y + 6),
    ], true);
    g.fillStyle(0x2e7a4a);
    g.fillPoints([
      new Phaser.Geom.Point(150, 192),
      new Phaser.Geom.Point(422, 192),
      new Phaser.Geom.Point(TABLE.x2, TABLE.y + 6),
      new Phaser.Geom.Point(TABLE.x1, TABLE.y + 6),
    ], true);
    // Linea di metà campo
    g.lineStyle(1, 0xffffff, 0.5);
    g.lineBetween(286, 186, 286, TABLE.y + 6);
    // Bordo frontale in legno + gambe
    g.fillStyle(0x6e4a2a);
    g.fillRect(TABLE.x1, TABLE.y + 6, TABLE.x2 - TABLE.x1, 5);
    g.fillStyle(0x5a3a20);
    g.fillRect(TABLE.x1 + 12, TABLE.y + 11, 7, 44);
    g.fillRect(TABLE.x2 - 19, TABLE.y + 11, 7, 44);
    g.fillStyle(0x4a3019);
    g.fillRect(180, TABLE.y + 9, 5, 26);
    g.fillRect(396, TABLE.y + 9, 5, 26);
  }

  private drawRoom(): void {
    const g = this.make.graphics();

    // ── PARETE: gradiente scuro viola-indaco ────────────────────────────
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const r = Math.round(Phaser.Math.Linear(0x1a, 0x2e, t));
      const gv = Math.round(Phaser.Math.Linear(0x12, 0x22, t));
      const b = Math.round(Phaser.Math.Linear(0x28, 0x42, t));
      g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b));
      g.fillRect(0, i * 11, GAME_WIDTH, 12);
    }

    // Vignetta sui lati (ombre angolari)
    g.fillStyle(0x000000, 0.28);
    g.fillRect(0, 0, 22, FLOOR_Y);
    g.fillRect(GAME_WIDTH - 22, 0, 22, FLOOR_Y);

    // Cornice soffitto decorativa
    g.fillStyle(0x4a3a60, 1);
    g.fillRect(0, 0, GAME_WIDTH, 5);
    g.fillStyle(0x3a2d50, 1);
    g.fillRect(0, 5, GAME_WIDTH, 2);

    // ── POSTER SINISTRO (viola) ─────────────────────────────────────────
    g.fillStyle(0x7a1a99, 0.75);
    g.fillRect(30, 52, 56, 72);
    g.fillStyle(0xcc44ff, 0.9);
    g.fillRect(32, 54, 52, 9);       // header colorato
    g.fillStyle(0x000000, 0.25);
    for (let row = 0; row < 5; row++) g.fillRect(34, 67 + row * 11, 48, 7);
    g.fillStyle(0xff88ff, 0.55);
    g.fillRect(34, 67, 48, 7);
    g.fillStyle(0xddaaff, 0.35);
    for (let row = 1; row < 5; row++) g.fillRect(34, 67 + row * 11, 48, 7);

    // ── POSTER DESTRO (blu) ─────────────────────────────────────────────
    g.fillStyle(0x0e2e88, 0.75);
    g.fillRect(GAME_WIDTH - 86, 58, 56, 64);
    g.fillStyle(0x44aaff, 0.9);
    g.fillRect(GAME_WIDTH - 84, 60, 52, 9);
    g.fillStyle(0x000000, 0.25);
    for (let row = 0; row < 4; row++) g.fillRect(GAME_WIDTH - 82, 73 + row * 11, 48, 7);
    g.fillStyle(0x88ddff, 0.55);
    g.fillRect(GAME_WIDTH - 82, 73, 48, 7);
    g.fillStyle(0x66ccff, 0.35);
    for (let row = 1; row < 4; row++) g.fillRect(GAME_WIDTH - 82, 73 + row * 11, 48, 7);

    // Le bandierine sono disegnate in addPartyEffects() come elemento animato.

    // ── FILO LUCINE ─────────────────────────────────────────────────────
    g.lineStyle(1, 0x666666, 0.7);
    g.beginPath();
    g.moveTo(0, 34);
    for (let x = 0; x <= GAME_WIDTH; x += 8) {
      g.lineTo(x, 34 + Math.sin(x / 40) * 8);
    }
    g.strokePath();
    const bulbColors = [0xff5566, 0xffdd55, 0x55aaff, 0x66dd88, 0xaa66ff, 0xff9922];
    for (let x = 14; x < GAME_WIDTH; x += 24) {
      const cy = 37 + Math.sin(x / 40) * 8;
      g.fillStyle(bulbColors[Math.floor(x / 24) % bulbColors.length], 0.95);
      g.fillCircle(x, cy, 2.8);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(x - 0.8, cy - 0.8, 1.1);
    }

    // ── PAVIMENTO ────────────────────────────────────────────────────────
    g.fillStyle(0x1e1828, 1);
    g.fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
    // Riflesso centrale sul pavimento
    g.fillStyle(0x3a2e50, 0.45);
    g.fillEllipse(GAME_WIDTH / 2, FLOOR_Y + 4, 210, 14);
    // Linee prospettiche verticali
    g.lineStyle(1, 0x2c2438, 0.8);
    for (let i = 0; i < 9; i++) {
      const xTop = 40 + i * 50;
      const xBot = (xTop - GAME_WIDTH / 2) * 1.6 + GAME_WIDTH / 2;
      g.lineBetween(xTop, FLOOR_Y, xBot, GAME_HEIGHT);
    }
    // Linee orizzontali (griglia)
    g.lineStyle(1, 0x2c2438, 0.45);
    for (let j = 1; j <= 3; j++) {
      g.lineBetween(0, FLOOR_Y + (GAME_HEIGHT - FLOOR_Y) * (j / 4), GAME_WIDTH, FLOOR_Y + (GAME_HEIGHT - FLOOR_Y) * (j / 4));
    }
    // Separatore parete/pavimento
    g.lineStyle(1, 0x4a3a60, 0.9);
    g.lineBetween(0, FLOOR_Y, GAME_WIDTH, FLOOR_Y);

    // Il tavolo è disegnato separatamente in drawTable() a depth=30.
    if (!this.textures.exists('tex-pong-v2')) {
      g.generateTexture('tex-pong-v2', GAME_WIDTH, GAME_HEIGHT);
    }
    g.destroy();
    this.add.image(0, 0, 'tex-pong-v2').setOrigin(0).setDepth(-10);

    // ── LUCI PULSANTI (dinamiche) ────────────────────────────────────────
    const spots: [number, number, number, number, number][] = [
      [55,  75, 0xff3344, 80, 950],
      [425, 70, 0x3366ff, 80, 1150],
      [240, 45, 0xaa44ff, 70, 1000],
      [145, 125, 0xff9900, 55, 1300],
      [335, 110, 0x00dd88, 55, 820],
    ];
    for (const [x, y, color, r, dur] of spots) {
      const light = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(-5);
      light.fillStyle(color, 1);
      light.fillCircle(x, y, r);
      light.setAlpha(0.08);
      this.tweens.add({
        targets: light,
        alpha: 0.22,
        duration: dur,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private burstConfetti(): void {
    const colors = [0xff5566, 0xffdd55, 0x55aaff, 0x66dd88, 0xaa66ff, 0xff9922, 0xff88cc, 0x44ffcc];
    interface Piece { x: number; y: number; vx: number; vy: number; w: number; h: number; color: number; life: number; }

    // Due ondate: una da destra (Guglielmo/Aniceto) e una centrale verso l'alto
    const pieces: Piece[] = Array.from({ length: 70 }, (_, i) => {
      const fromRight = i < 45;
      return {
        x: fromRight ? GAME_WIDTH - 30 + Math.random() * 40 : 160 + Math.random() * 160,
        y: fromRight ? FLOOR_Y - 30 - Math.random() * 40 : FLOOR_Y - 10 - Math.random() * 20,
        vx: fromRight ? -(2.5 + Math.random() * 5) : (Math.random() - 0.5) * 5,
        vy: -(3 + Math.random() * 5),
        w: 2 + Math.random() * 2.5,
        h: 1 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
      };
    });

    const gfx = this.add.graphics().setDepth(200);
    const timer = this.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        gfx.clear();
        let anyAlive = false;
        for (const p of pieces) {
          p.x  += p.vx;
          p.y  += p.vy;
          p.vy += 0.18; // gravità
          p.life -= 0.008;
          if (p.life <= 0) continue;
          anyAlive = true;
          gfx.fillStyle(p.color, Math.min(p.life, 0.95));
          gfx.fillRect(p.x, p.y, p.w, p.h);
        }
        if (!anyAlive) { timer.remove(); gfx.destroy(); }
      },
    });
  }

  private addPartyEffects(): void {
    // ── BANDIERINE ANIMATE (filo + flutter) ──────────────────────────────
    const buntingColors = [0xff4455, 0xffee44, 0x44aaff, 0x66ee88, 0xcc55ff, 0xff9922, 0xff88cc];
    const buntingGfx = this.add.graphics().setDepth(-3);
    let bTime = 0;

    const drawBunting = () => {
      buntingGfx.clear();

      // Filo che ondeggia leggermente
      buntingGfx.lineStyle(1, 0x999999, 0.85);
      buntingGfx.beginPath();
      buntingGfx.moveTo(0, 16);
      for (let x = 0; x <= GAME_WIDTH; x += 4) {
        const wireY = 16 + Math.sin(x / 38) * 5 + Math.sin(bTime * 0.4 + x / 90) * 1.2;
        buntingGfx.lineTo(x, wireY);
      }
      buntingGfx.strokePath();

      // Bandierine: ogni flag fluttua con fase sfasata
      for (let i = 0, x = 18; x < GAME_WIDTH; x += 24, i++) {
        const wireY = 16 + Math.sin(x / 38) * 5 + Math.sin(bTime * 0.4 + x / 90) * 1.2;
        // flutter: simula la bandierina che gira sul suo asse verticale
        const flutter = 0.5 + 0.5 * Math.sin(bTime * 1.3 + i * 0.85);
        const halfW = 7 * flutter;
        const color = buntingColors[i % buntingColors.length];
        buntingGfx.fillStyle(color, 0.88);
        buntingGfx.fillTriangle(
          x - halfW, wireY,
          x + halfW, wireY,
          x,          wireY + 13,
        );
      }

      bTime += 0.055;
    };

    drawBunting(); // frame iniziale subito
    this.time.addEvent({ delay: 45, loop: true, callback: drawBunting });

    // ── PALLA DISCO ──────────────────────────────────────────────────────
    const ballX = GAME_WIDTH / 2;
    const ballY = 14;
    const ballR = 7;

    const ball = this.add.graphics().setDepth(-4);
    // Filo dal soffitto
    ball.lineStyle(1, 0x444444, 0.8);
    ball.lineBetween(ballX, 0, ballX, ballY - ballR);
    // Corpo metallico
    ball.fillStyle(0x8888aa, 1);
    ball.fillCircle(ballX, ballY, ballR);
    // Specchietti simulati
    const faceC = [0xbbbbcc, 0x9999bb, 0xccccdd, 0x7777aa];
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        if (col * col + row * row > 5) continue;
        ball.fillStyle(faceC[Math.abs(row + col) % faceC.length], 1);
        ball.fillRect(ballX + col * 2.8 - 1, ballY + row * 2.8 - 1, 2, 2);
      }
    }
    // Shine
    ball.fillStyle(0xffffff, 0.85);
    ball.fillCircle(ballX - 3, ballY - 3, 1.8);

    // Riflessi rotanti
    const reflColors = [0xff5566, 0xffdd55, 0x55aaff, 0x66dd88, 0xaa66ff, 0xff9922, 0xffaacc, 0x44ffcc];
    const NUM_REFL = 16;
    const reflData = Array.from({ length: NUM_REFL }, (_, i) => ({
      phase:  (i / NUM_REFL) * Math.PI * 2,
      radius: 55 + (i % 4) * 40,
      yAmp:   35 + (i % 5) * 18,
      size:   1.4 + (i % 3) * 0.5,
      color:  reflColors[i % reflColors.length],
    }));
    const reflGfx = this.add.graphics().setDepth(-4).setBlendMode(Phaser.BlendModes.ADD);
    let reflAngle = 0;
    this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        reflAngle += 0.045;
        reflGfx.clear();
        for (const r of reflData) {
          const a = reflAngle + r.phase;
          const rx = Phaser.Math.Clamp(ballX + Math.cos(a) * r.radius, 4, GAME_WIDTH - 4);
          const ry = Phaser.Math.Clamp(ballY + 20 + Math.sin(a * 0.45) * r.yAmp + r.yAmp, 4, FLOOR_Y - 4);
          const alpha = 0.3 + Math.sin(reflAngle * 2 + r.phase) * 0.22;
          reflGfx.fillStyle(r.color, alpha);
          reflGfx.fillRect(rx - r.size, ry - r.size * 0.5, r.size * 2, r.size);
        }
      },
    });

    // ── SPOTLIGHT BEAM ────────────────────────────────────────────────────
    const beamColors = [0xff2233, 0x2255ee, 0xaa33ff];
    const beamSrcs: [number, number][] = [[18, 8], [GAME_WIDTH - 18, 8], [GAME_WIDTH / 2, 0]];
    const beamPhases = [0, Math.PI * 0.66, Math.PI * 1.33];
    const beamGfxList = beamSrcs.map(() =>
      this.add.graphics().setDepth(-6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.11)
    );
    let beamAngle = 0;
    this.time.addEvent({
      delay: 35,
      loop: true,
      callback: () => {
        beamAngle += 0.02;
        beamGfxList.forEach((bg, i) => {
          bg.clear();
          const sweep = Math.sin(beamAngle + beamPhases[i]) * 0.65;
          const [sx, sy] = beamSrcs[i];
          bg.fillStyle(beamColors[i], 1);
          bg.fillTriangle(
            sx, sy,
            sx + Math.sin(sweep - 0.18) * 280, FLOOR_Y,
            sx + Math.sin(sweep + 0.18) * 280, FLOOR_Y,
          );
        });
      },
    });

    // ── CORIANDOLI ──────────────────────────────────────────────────────
    const confColors = [0xff5566, 0xffdd55, 0x55aaff, 0x66dd88, 0xaa66ff, 0xff9922, 0xff88cc, 0x44ffcc];
    interface Piece { x: number; y: number; vx: number; vy: number; w: number; h: number; color: number; }
    const pieces: Piece[] = Array.from({ length: 30 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * (FLOOR_Y - 5),
      vx: (Math.random() - 0.5) * 0.55,
      vy: 0.4 + Math.random() * 0.65,
      w: 2 + Math.random() * 2,
      h: 1 + Math.random() * 1.5,
      color: confColors[Math.floor(Math.random() * confColors.length)],
    }));
    const confGfx = this.add.graphics().setDepth(95);
    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        confGfx.clear();
        for (const p of pieces) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > FLOOR_Y) { p.y = -2; p.x = Math.random() * GAME_WIDTH; }
          if (p.x < 0) p.x = GAME_WIDTH;
          if (p.x > GAME_WIDTH) p.x = 0;
          confGfx.fillStyle(p.color, 0.88);
          confGfx.fillRect(p.x, p.y, p.w, p.h);
        }
      },
    });
  }

  private spawnCharacters(): void {
    // Giocatori in piedi SUL pavimento (piedi a FLOOR_Y).
    // Squadra sinistra: vicino al bordo sinistro del tavolo (x1=140).
    // Squadra destra: subito oltre il bordo destro del tavolo (x2=432).
    // Aniceto era a 416 (dentro il tavolo) — corretto a 448.
    const players: [string, number, number, boolean][] = [
      ['umberto', 90, 0, false],   // bordo sinistro tavolo
      ['trande',  52, 4, false],   // leggermente dietro umberto
      ['guglielmo', 462, 0, true], // bordo destro tavolo
      ['aniceto',   446, 4, true], // leggermente davanti a guglielmo
    ];
    const scale = 1.35;
    const h = 56 * scale;
    for (const [id, x, behind, flip] of players) {
      generateBattleSprite(this, id, CHAR_CONFIGS[id]);
      // origin (0.5, 53/56): ancora il punto-piede della texture a FLOOR_Y
      const y = FLOOR_Y + (behind as number);
      const s = this.add
        .sprite(x, y, `battle-${id}`)
        .setScale(scale * CHAR_SCALE)
        .setFlipX(flip)
        .setDepth(50);
      s.setOrigin(0.5, 53 / 56);
      this.sprites.set(id, s);
      this.add.ellipse(x, FLOOR_Y + 2, 30, 6, 0x000000, 0.35).setDepth(49);
      addNameLabel(this, x, y - h + 16, id).setDepth(60);
    }

    // Pubblico dietro il tavolo: scala ridotta (prospettiva) e
    // più vicini al tavolo (y più alto = meno distante).
    // 5 spettatori equidistanti lungo la larghezza del tavolo.
    // depth=20: sotto il tavolo (depth=30) → gambe coperte dal bordo del tavolo.
    // y≈182 → busto e testa sopra la linea del tavolo (y=186), gambe nascoste.
    const SPEC_SCALE = 1.60;
    const specs: [string, number, number][] = [
      ['cosimino', 172, 174],
      ['riccardo', 222, 174],
      ['cece',     268, 173],
      ['stefano',  318, 174],
      ['ilaria',   364, 174],
    ];
    for (const [id, x, y] of specs) {
      generateSpriteTexture(this, id, CHAR_CONFIGS[id]);
      this.add.ellipse(x, y + 12, 9, 2, 0x000000, 0.28).setDepth(19);
      const s = this.add
        .sprite(x, y, `char-${id}`, 1)
        .setScale(SPEC_SCALE * CHAR_SCALE)
        .setDepth(20);
      s.play(`${id}-idle-down`);
      addNameLabel(this, x, y - 2, id).setDepth(21);
      this.spectators.set(id, s);
    }
  }

  private createCups(): void {
    /**
     * Piramide 3-2-1 in prospettiva.
     *
     * baseY  = y della base del bicchiere sul piano del tavolo.
     * scaleF = fattore di scala visiva (1.0 frontale, ~0.72 fondo).
     *
     * Layout (lato sinistro, centro x=182, spaziatura 22 px):
     *   back row  (3)  baseY=187  scaleF=0.72    x: 160 | 182 | 204
     *   mid  row  (2)  baseY=191  scaleF=0.86    x: 171 | 193
     *   front row (1)  baseY=195  scaleF=1.00    x: 182
     *
     * Lato destro: specchio attorno a x=286 (572 − x).
     */
    interface CupDef { x: number; baseY: number; scaleF: number; }

    const makePyramid = (defs: CupDef[], list: Cup[]): void => {
      for (const { x, baseY, scaleF } of defs) {
        const cw   = Math.round(CUP_W * scaleF);
        const ch   = Math.round(CUP_H * scaleF);
        const top  = baseY - ch;
        // Profondità: front row sopra mid sopra back (valori 38-42, sotto i player a 50)
        const depth = 38 + Math.round((baseY - 187) * 0.5);
        const taper = Math.max(1, Math.round(2 * scaleF));

        const gfx = this.add.graphics({ x, y: top }).setDepth(depth);

        // — ombra ellittica sul panno —
        gfx.fillStyle(0x1a4a2a, 0.5);
        gfx.fillEllipse(0, ch + 1, cw + 2, Math.max(2, Math.round(3 * scaleF)));

        // — corpo (trapezio rosso) —
        gfx.fillStyle(0xcc3333);
        gfx.beginPath();
        gfx.moveTo(-cw / 2,          0);
        gfx.lineTo( cw / 2,          0);
        gfx.lineTo( cw / 2 - taper,  ch);
        gfx.lineTo(-cw / 2 + taper,  ch);
        gfx.closePath();
        gfx.fillPath();

        // — highlight laterale sinistro (riflesso luce) —
        gfx.fillStyle(0xff6666, 0.4);
        gfx.fillRect(-cw / 2, 1, Math.max(1, taper - 1), ch - 2);

        // — ombreggiatura laterale destra —
        gfx.fillStyle(0x771111, 0.8);
        gfx.fillRect(cw / 2 - taper, 1, taper, ch - 2);

        // — rim (bordo superiore bianco) —
        const rimH = Math.max(1, Math.round(2 * scaleF));
        gfx.fillStyle(0xeeeeee, 1);
        gfx.fillRect(-cw / 2, -rimH, cw, rimH);

        // — birra (striscia ambra dentro il bicchiere) —
        const beerH = Math.max(1, Math.round(2 * scaleF));
        gfx.fillStyle(0xffbb33, 0.88);
        gfx.fillRect(-cw / 2 + taper, rimH, cw - taper * 2, beerH);

        list.push({ x, top, alive: true, gfx, halfW: cw / 2 });
      }
    };

    // ── Lato SINISTRO: Umberto/Trande (playerCups), punta verso destra ───────
    const leftCups: CupDef[] = [
      { x: 160, baseY: 187, scaleF: 0.72 },   // back-row  (3)
      { x: 182, baseY: 187, scaleF: 0.72 },
      { x: 204, baseY: 187, scaleF: 0.72 },
      { x: 171, baseY: 191, scaleF: 0.86 },   // mid-row   (2) — formazione 3-2
      { x: 193, baseY: 191, scaleF: 0.86 },
    ];

    // ── Lato DESTRO: Guglielmo/Aniceto (enemyCups) — specchio a x=286 ────────
    const rightCups: CupDef[] = [
      { x: 412, baseY: 187, scaleF: 0.72 },   // back-row  (3)
      { x: 390, baseY: 187, scaleF: 0.72 },
      { x: 368, baseY: 187, scaleF: 0.72 },
      { x: 401, baseY: 191, scaleF: 0.86 },   // mid-row   (2) — formazione 3-2
      { x: 379, baseY: 191, scaleF: 0.86 },
    ];

    makePyramid(leftCups, this.playerCups);
    makePyramid(rightCups, this.enemyCups);
  }

  private createBall(): void {
    // Nessuna fionda: la pallina parte dalla mano di Umberto.
    this.ball = this.add.circle(ANCHOR.x, ANCHOR.y, 3, 0xffffff).setDepth(55).setVisible(false);
    this.ballShadow = this.add
      .ellipse(0, 0, 8, 3, 0x000000, 0.4)
      .setDepth(41)
      .setVisible(false);
    for (let i = 0; i < 30; i++) {
      this.dots.push(
        this.add.circle(0, 0, 1.5, 0xffffff, 0.5).setDepth(54).setVisible(false)
      );
    }
  }

  private createUi(): void {
    this.turnText = this.add
      .text(GAME_WIDTH / 2, 6, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(900);

    // contatori sbronza
    const order = ['umberto', 'trande', 'guglielmo', 'aniceto'];
    order.forEach((id, i) => {
      const t = this.add
        .text(8 + (i % 2) * 122, 22 + Math.floor(i / 2) * 12, `${id.toUpperCase()} `, {
          fontFamily: FONT,
          fontSize: '6px',
          color: SPEAKER_COLORS[id] ?? '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setDepth(900);
      this.drunkTexts.set(id, t);
    });

    // barra messaggi in basso
    const bg = this.add.graphics().setDepth(890);
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 232, GAME_WIDTH, GAME_HEIGHT - 232);
    bg.lineStyle(2, 0xffffff);
    bg.strokeRect(1, 233, GAME_WIDTH - 2, GAME_HEIGHT - 234);
    this.messageText = this.add
      .text(12, 242, '', {
        fontFamily: FONT,
        fontSize: '7px',
        color: '#ffffff',
        lineSpacing: 5,
        wordWrap: { width: GAME_WIDTH - 24 },
      })
      .setDepth(891);
  }

  private showMessage(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.messageText.setText('');
      let i = 0;
      this.time.addEvent({
        delay: 11,
        repeat: text.length - 1,
        callback: () => {
          i++;
          this.messageText.setText(text.slice(0, i));
          if (i % 3 === 0) AudioManager.get().playSFX(this, 'text', 0.15);
          if (i >= text.length) this.time.delayedCall(1500, resolve);
        },
      });
    });
  }
}
