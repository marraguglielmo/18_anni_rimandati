import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from '../config';
import { DialogueSystem, type DialogueLine } from '../systems/DialogueSystem';
import {
  addNameLabel,
  CHAR_CONFIGS,
  CHAR_SCALE,
  generateSpriteTexture,
  loadPortraits,
} from '../systems/CharacterSprite';
import { TransitionSystem, UI_OFF_X, UI_OFF_Y } from '../systems/TransitionSystem';
import { AudioManager } from '../systems/AudioManager';
import { QuestHUD } from '../systems/QuestHUD';
import { Juice } from '../systems/Juice';
import { showEmote } from '../systems/Emote';

// Luglio 2019: in bici a raccogliere i soldi per la festa da Ilaria.
// Trande è l'ultimo della fila, resta indietro... e parte il minigioco runner.
const FONT = '"Press Start 2P", monospace';
const ROAD_Y = 198; // quota delle ruote sull'asfalto

// In fila: davanti Ilaria, in fondo (ultimo) Trande
const RIDER_SETUP: [string, number][] = [
  ['ilaria', 395],
  ['cece', 340],
  ['guglielmo', 285],
  ['aniceto', 230],
  ['bubi', 175],
  ['trande', 95],
];

// ------- minigioco -------
const COINS_TO_WIN = 30;
const STAR_DURATION_S = 5; // durata Super Stella (invincibile + velocità 2x)
const SCROLL_SPEED_BASE = 155; // velocità iniziale (px/s)
const SCROLL_SPEED_MAX = 215;  // velocità massima (ridotta per giocabilità)
const GRAVITY = 720;
const JUMP_V = -268;
// ------- fisica avanzata -------
const COYOTE_S = 0.12;    // secondi di "coyote time" dopo aver lasciato un appoggio
const MAGNET_R = 34;      // raggio (px) entro cui le monete vengono attratte
                          // (34 < quota monete aeree: da terra NON si attirano, va saltato)
const MAGNET_PULL = 290;  // forza di attrazione (px/s alla distanza zero)
const COMBO_WINDOW_MS = 1400; // finestra per concatenare monete in combo
const TRANDE_X = 100;
const SPAWN_X = 540;

// Pensieri casuali di Trande durante il runner
const TRANDE_THOUGHTS = [
  'Aspettatemi!!',
  'Le gambe... oddio...',
  'A MANETTAAAA!',
  'AAAAARGH',
  'Non ce la facciooo!',
  'Ma dove sono andati?!',
  "Sto sudando l'anima...",
  'Pe la mamma maria',
  'Maledetta primavera!',
  'Pedalare pedalare pedalare—',
];

type CourseItem =
  | 'coin' | 'coinAir' | 'rock' | 'person' | 'car' | 'tree' | 'platform'
  | 'pigeon' | 'carFast' | 'hole' | 'gelato' | 'stella';
const COURSE: { gap: number; t: CourseItem }[] = [
  { gap: 220, t: 'coin' },
  { gap: 150, t: 'rock' },
  { gap: 160, t: 'coinAir' },
  { gap: 180, t: 'person' },
  { gap: 200, t: 'platform' },
  { gap: 300, t: 'car' },
  { gap: 150, t: 'coin' },
  { gap: 190, t: 'hole' },
  { gap: 200, t: 'gelato' },
  { gap: 150, t: 'tree' },
  { gap: 170, t: 'coinAir' },
  { gap: 200, t: 'pigeon' },
  { gap: 180, t: 'person' },
  { gap: 210, t: 'platform' },
  { gap: 300, t: 'rock' },
  { gap: 150, t: 'coin' },
  { gap: 240, t: 'carFast' },
  { gap: 180, t: 'car' },
  { gap: 140, t: 'coinAir' },
  { gap: 190, t: 'tree' },
  { gap: 170, t: 'stella' },
  { gap: 155, t: 'coin' },
  { gap: 175, t: 'rock' },
  { gap: 165, t: 'person' },
  { gap: 190, t: 'hole' },
  { gap: 145, t: 'coinAir' },
  { gap: 200, t: 'car' },
  { gap: 200, t: 'pigeon' },
  { gap: 160, t: 'coin' },
  { gap: 185, t: 'platform' },
  { gap: 300, t: 'rock' },
  { gap: 170, t: 'coinAir' },
  { gap: 240, t: 'carFast' },
  { gap: 160, t: 'tree' },
  { gap: 220, t: 'coin' },
  { gap: 155, t: 'car' },
];

const PEOPLE: { id: string; name: string; labelColor?: string }[] = [
  { id: 'cosimino',  name: 'COSIMINO' },
  { id: 'donbiagio', name: 'DON BIAGIO', labelColor: '#ddbbff' }, // viola chiaro — camicia nera illeggibile
  { id: 'christian', name: 'CHRISTIAN ANTONAZZO' },
];

const PLAN_LINES: DialogueLine[] = [
  { speaker: 'bubi', text: 'Allora... mancane sordi?' },
  { speaker: 'guglielmo', text: 'Si, dobbiamo ancora passare da Lerry e Stefano.' },
  { speaker: 'ilaria', text: 'Regà quando facciamo spesa?' },
  { speaker: 'aniceto', text: 'Andiamo a pomeriggio, alla lista ci pensa cece.' },
  { speaker: 'cece', text: 'Sisi tranquilli, il problema sono gli alcolici' },
  { speaker: 'ilaria', text: 'Vabe scialla ce li prende Lerry.' },
  { speaker: 'ilaria', text: 'Per la musica invece?' },
  { speaker: 'bubi', text: 'Playlist pronta da tre settimane.' },
  { speaker: 'trande', text: 'Stasera al beer pong vi distruggo tutti.' },
  { speaker: 'bubi', text: 'Ah sì? ULTIMO DA ILARIA È FROCIO!' },
];

const ALONE_LINES: DialogueLine[] = [
  { speaker: 'trande', text: 'Pe la Mamma Maria... ASPETTATEMI!' },
];

const HELP_LINES: DialogueLine[] = [
  { speaker: 'bubi', text: 'TRANDE PORCO DIO!! Tutto bene?!' },
  { speaker: 'trande', text: '...la schiena. Non sento la schiena.' },
  { speaker: 'guglielmo', text: '*trattiene le risate* Scusa, scusa... AHAHAH.' },
  { speaker: 'ilaria', text: 'Non ridete, idioti! ...ammazza che botta, eh.' },
  { speaker: 'trande', text: 'Mi sa che mi sono rotto una vertebra. Sul serio.' },
  { speaker: 'aniceto', text: 'Si nu pampasciune' },
  { speaker: 'cece', text: "AHAHAHAH ogni volta che vedo questa scena mi piscio de risi",},
  { speaker: 'trande', text: "Cece ma che cazzu dici? È la prima volta che succede...",},
  { speaker: 'cece', text: 'Sese... vabe andiamo avanti ca è meju...' },
];

const MOCK_LINES = [
  'AHAHAHAHAH',
  'Ma come cazzo hai fatto?!',
  'Che volo!',
  'Che cujune',
  'La bici sta bene?',
  'Mitico.',
];

const DOCTOR_ARRIVES_LINES: DialogueLine[] = [
  { speaker: 'soccorritore', text: 'Oh! Serve aiuto?! Sono un medico.' },
];

const DISMISS_DOCTOR_LINES: DialogueLine[] = [
  { speaker: 'bubi',         text: 'OH PORCODIO!! E TU CHI SEI?! LEVATI!' },
  { speaker: 'cece',         text: 'LASCIA IN PACE IL NOSTRO AMICO!' },
  { speaker: 'guglielmo',    text: 'CI PENSIAMO NOI! SPARISCI!' },
  { speaker: 'soccorritore', text: '...come preferite. Sta me ne vo...' },
];

interface Rider {
  id: string;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  bike: Phaser.GameObjects.Container; // container con telaio + ruote
  wheelTweens?: [Phaser.Tweens.Tween, Phaser.Tweens.Tween]; // [sinistra, destra]
  crank?: Phaser.GameObjects.Graphics;  // pedivella con pedali
  crankTween?: Phaser.Tweens.Tween;
  bob?: Phaser.Tweens.Tween;
  shadow?: Phaser.GameObjects.Ellipse;
}

interface Entity {
  kind: 'obstacle' | 'coin' | 'platform' | 'hole' | 'power';
  obj: Phaser.GameObjects.Container;
  halfW: number;
  halfH: number;
  centerY: number; // centro verticale dell'hitbox (mondo)
  topY?: number;   // solo piattaforme
  /** Tolleranza sul bordo SUPERIORE dell'hitbox (px): si può "sfiorare" senza morire. */
  topGrace?: number;
  /** Velocità orizzontale propria (px/s, in aggiunta allo scroll). */
  vx?: number;
  /** Velocità verticale propria (px/s) — es. piccione in picchiata. */
  vy?: number;
  /** Quota a cui il movimento verticale si ferma (piccione in planata). */
  targetY?: number;
  /** Tipo di power-up (solo kind 'power'). */
  powerType?: 'shield' | 'magnet';
  /** Near-miss: distanza minima registrata durante il sorpasso. */
  minClear?: number;
  /** Near-miss: l'ostacolo è già stato superato. */
  passed?: boolean;
  /** Buca: Trande l'ha già vista e commentata. */
  warned?: boolean;
}

export class BiciScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;
  private riders: Rider[] = [];
  private trande!: Rider;
  private scrollSpeed = 28; // pedalata tranquilla dell'intro
  private caseTile!: Phaser.GameObjects.TileSprite;
  private roadTile!: Phaser.GameObjects.TileSprite;
  private cloudsTile!: Phaser.GameObjects.TileSprite;
  private speedLinesTile?: Phaser.GameObjects.TileSprite;
  private thoughtTimer?: Phaser.Time.TimerEvent;
  private mockTimer?: Phaser.Time.TimerEvent;

  // stato minigioco
  private mgActive = false;
  private mgVy = 0;
  private mgGrounded = true;
  private mgCoyote = 0;
  private mgCombo = 0;
  private mgLastCoinMs = 0;
  private mgShield = false;
  private shieldBubble: Phaser.GameObjects.Arc | null = null;
  private mgStarT = 0;
  private mgSupport: Entity | null = null;
  /** Offset verticale del busto di Trande (sospensione/inerzia nei salti). */
  private riderDy = 0;
  /** Disattivata durante crash/cutscene finali (la bici si stacca dal container). */
  private ridePhysicsOn = true;
  private mgCoins = 0;
  private mgDefeats = 0;
  private mgCooldown = false;
  private courseIdx = 0;
  private spawnDist = 0;
  private nextGap = 200;
  private entities: Entity[] = [];
  private personIdx = 0;
  private coinsText!: Phaser.GameObjects.Text;
  private defeatsText!: Phaser.GameObjects.Text;
  private questHUD!: QuestHUD;
  private mgResolve: (() => void) | null = null;

  constructor() {
    super('BiciScene');
  }

  preload(): void {
    loadPortraits(this, [...RIDER_SETUP.map(([id]) => id), ...PEOPLE.map((p) => p.id)]);
  }

  create(): void {
    this.riders = [];
    this.entities = [];
    this.scrollSpeed = 28;
    this.mgActive = false;
    this.mgCoins = 0;
    this.mgDefeats = 0;
    this.riderDy = 0;
    this.ridePhysicsOn = true;

    TransitionSystem.fadeFromBlack(this, 600);
    // BGM globale già in corso

    this.drawBackground();
    this.createCoinTexture();
    this.createSpeedLinesTexture();
    this.spawnRiders();
    for (const p of PEOPLE) generateSpriteTexture(this, p.id, CHAR_CONFIGS[p.id]);

    this.dialogue = new DialogueSystem(this);
    this.questHUD = new QuestHUD(this, GAME_WIDTH / 2 + UI_OFF_X, 40 + UI_OFF_Y);
    TransitionSystem.announceArea(this, 'TRICASE, PERIFERIA – LUGLIO 2019');

    // salto: Spazio / W / Su / tap
    const kb = this.input.keyboard;
    const jump = (): void => this.tryJump();
    // Salto ad altezza variabile: rilasciando presto il tasto, il salto si accorcia
    const jumpCut = (): void => {
      if (this.mgActive && !this.mgGrounded && this.mgVy < -80) this.mgVy *= 0.5;
    };
    if (kb) {
      for (const code of [
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.W,
      ]) {
        const key = kb.addKey(code);
        key.on('down', jump);
        key.on('up', jumpCut);
      }
      // ESC per saltare il minigioco monete
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).once('down', () => {
        if (this.mgActive) this.winMinigame();
      });
    }
    this.input.on('pointerdown', jump);
    this.input.on('pointerup', jumpCut);

    void this.run();
  }

  update(): void {
    const dt = this.game.loop.delta / 1000;
    // Super Stella: tutto il mondo scorre al doppio della velocità
    const sp = this.mgStarT > 0 ? this.scrollSpeed * 2 : this.scrollSpeed;
    // parallasse: case lente, strada a velocità piena
    this.caseTile.tilePositionX += sp * 0.35 * dt;
    this.roadTile.tilePositionX += sp * dt;
    // nuvole: molto lente (quasi ferme)
    this.cloudsTile.tilePositionX += sp * 0.12 * dt;
    // speed lines: leggermente più veloci della strada per enfasi
    if (this.speedLinesTile) {
      this.speedLinesTile.tilePositionX += sp * 0.9 * dt;
    }

    // Fisica ruote: velocità di rotazione proporzionale alla velocità di scorrimento
    // timeScale=0 → ruote ferme; timeScale=1 → velocità nominale a SCROLL_SPEED_BASE
    const wheelTs = sp / SCROLL_SPEED_BASE;
    const tSec = this.time.now / 1000;
    this.riders.forEach((r, i) => {
      if (r.wheelTweens) {
        r.wheelTweens[0].timeScale = wheelTs;
        r.wheelTweens[1].timeScale = wheelTs;
      }
      if (r.crankTween) r.crankTween.timeScale = wheelTs;

      if (!this.ridePhysicsOn) return;

      // Vibrazione dell'asfalto sulla bici (scala con la velocità, ferma da fermi)
      const vibAmp = 0.45 * Math.min(1, wheelTs);
      r.bike.y = Math.sin(tSec * 19 + i * 1.7) * vibAmp;

      // Il busto è GUIDATO dalla pedivella: due spinte per giro di pedali
      const crankA = r.crank ? Phaser.Math.DegToRad(r.crank.angle) : 0;
      let dy = Math.sin(crankA * 2) * 0.9 * Math.min(1, 0.3 + wheelTs);

      // Lean aerodinamico: più veloce → più piegato in avanti
      let lean = Phaser.Math.Clamp((sp - 28) / 60, 0, 1) * 6;

      if (r.id === 'trande') {
        dy += this.riderDy; // sospensione/inerzia nei salti
        if (this.mgActive && !this.mgGrounded) lean *= 0.4; // in volo si raddrizza
      }
      r.sprite.y = -12 + dy;
      r.sprite.angle = lean;
    });

    if (this.mgActive) this.updateMinigame(dt);
  }

  // ------------------------------------------------------------ flusso

  private async run(): Promise<void> {
    await this.delay(1200);
    await this.runDialogue(PLAN_LINES); // si parla pedalando
    await this.othersSpeedAway();
    await this.runDialogue(ALONE_LINES);
    await this.playMinigame(); // si risolve a 10 monete
    await this.delay(400);
    await this.crash();
    await this.doctorIntervention();
    await this.gatherAroundTrande();

    // Sfottò di sottofondo (nuvolette) mentre lo "aiutano"
    this.mockTimer = this.time.addEvent({
      delay: 1100,
      loop: true,
      callback: () => {
        const others = this.riders.filter((r) => r.id !== 'trande');
        const r = Phaser.Math.RND.pick(others);
        this.showBubble(r, Phaser.Math.RND.pick(MOCK_LINES));
      },
    });

    await this.runDialogue(HELP_LINES);
    this.mockTimer?.remove();

    // Cece teletrasporta tutti alla festa
    this.spawnTeleportParticles();
    await this.delay(450);
    await TransitionSystem.teleportToScene(this, 'PartyScene');
  }

  /** Gli altri sgasano e Trande resta indietro da solo. */
  private async othersSpeedAway(): Promise<void> {
    const moves: Promise<void>[] = [];
    for (const r of this.riders) {
      if (r.id === 'trande') continue;
      r.sprite.anims.timeScale = 2.2;
      moves.push(
        this.tweenP({
          targets: r.container,
          x: r.container.x + 560,
          duration: 1500,
          ease: 'Quad.easeIn',
          delay: Phaser.Math.Between(0, 250),
        })
      );
    }
    this.scrollSpeed = 70;
    await Promise.all(moves);
    // Distruggi le ombre statiche dei ciclisti che sono andati via
    for (const r of this.riders) {
      if (r.id !== 'trande') r.shadow?.destroy();
    }
  }

  // -------------------------------------------------------- minigioco

  private playMinigame(): Promise<void> {
    // zoom leggero per il senso d'azione
    this.cameras.main.zoomTo(RENDER_SCALE * 1.15, 600, 'Sine.easeInOut');
    this.trande.bob?.remove();
    this.trande.sprite.anims.timeScale = 1.6;

    // trande si porta in posizione runner
    this.tweens.add({ targets: this.trande.container, x: TRANDE_X, duration: 500 });

    // Speed lines overlay (fade in all'avvio)
    this.speedLinesTile = this.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'tex-speed')
      .setOrigin(0)
      .setDepth(50)
      .setAlpha(0);
    this.tweens.add({ targets: this.speedLinesTile, alpha: 1, duration: 700 });

    // UI
    this.coinsText = this.add
      .text(64, 38, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(950);
    this.defeatsText = this.add
      .text(GAME_WIDTH - 64, 38, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ff7777',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(950);
    this.updateMgUi();
    // Mostra il QuestHUD dopo che lo zoom è completato (650ms).
    // La camera resta a RENDER_SCALE·1.15: compensiamo così il box non si
    // ingrandisce né si sposta rispetto alle altre scene.
    this.time.delayedCall(650, () => {
      this.questHUD.compensateCameraZoom(
        RENDER_SCALE * 1.15, RENDER_SCALE,
        (GAME_WIDTH * RENDER_SCALE) / 2, (GAME_HEIGHT * RENDER_SCALE) / 2,
      );
      this.questHUD.show(`Raccogli ${COINS_TO_WIN} monete`);
    });
    this.popText('SPAZIO o TAP per saltare', 1800);

    // Pensieri casuali di Trande ogni ~3s
    this.thoughtTimer = this.time.addEvent({
      delay: 2800,
      loop: true,
      callback: () => {
        if (this.mgActive && !this.mgCooldown) {
          this.showBubble(this.trande, Phaser.Math.RND.pick(TRANDE_THOUGHTS));
        }
      },
    });

    AudioManager.get().playFgMusic(this, 'bike-run', 0.8); // FGM minigioco
    showEmote(this, this.trande.container.x, this.trande.container.y - 4, 'alert', {
      duration: 900,
      depth: 700,
    });
    this.resetCourse();
    this.scrollSpeed = SCROLL_SPEED_BASE;
    this.mgActive = true;

    return new Promise((resolve) => {
      this.mgResolve = resolve;
    });
  }

  private resetCourse(): void {
    for (const e of this.entities) e.obj.destroy();
    this.entities = [];
    this.courseIdx = 0;
    this.spawnDist = 0;
    this.nextGap = COURSE[0].gap;
    this.mgCoins = 0;
    this.mgVy = 0;
    this.mgGrounded = true;
    this.mgCoyote = 0;
    this.mgCombo = 0;
    this.mgLastCoinMs = 0;
    this.mgShield = false;
    this.mgStarT = 0;
    this.riderDy = 0;
    this.trande.sprite.clearTint();
    if (this.shieldBubble) {
      this.shieldBubble.destroy();
      this.shieldBubble = null;
    }
    this.mgSupport = null;
    this.personIdx = 0;
    this.trande.container.y = ROAD_Y - 8;
    this.trande.container.angle = 0;
  }

  private tryJump(): void {
    if (!this.mgActive || this.mgCooldown) return;
    // coyote time: si può saltare per un attimo anche appena caduti da un appoggio
    if (!this.mgGrounded && this.mgCoyote <= 0) return;
    this.mgVy = JUMP_V;
    this.mgGrounded = false;
    this.mgSupport = null;
    this.mgCoyote = 0;
    AudioManager.get().playSFX(this, 'confirm', 0.4);
    // sbuffo di stacco sotto le ruote
    const c = this.trande.container;
    Juice.dust(this, c.x - 4, c.y + 12, 4, 0xbbb49c, 640);
  }

  private updateMinigame(dt: number): void {
    const c = this.trande.container;

    // coyote time: finestra di grazia dopo aver lasciato un appoggio
    if (this.mgGrounded) this.mgCoyote = COYOTE_S;
    else this.mgCoyote -= dt;

    // Sospensione: il busto reagisce con inerzia al salto
    // (si abbassa allo stacco, "galleggia" in caduta, affonda all'atterraggio)
    const targetDy = this.mgGrounded
      ? 0
      : Phaser.Math.Clamp(-this.mgVy * 0.008, -2.4, 2.4);
    this.riderDy += (targetDy - this.riderDy) * (1 - Math.exp(-10 * dt));

    // ombra reattiva: si restringe e sbiadisce quando Trande è in volo
    const sh = this.trande.shadow;
    if (sh) {
      const height = Math.max(0, ROAD_Y - 8 - c.y);
      const k = Math.max(0.35, 1 - height / 90);
      sh.setPosition(c.x, ROAD_Y + 4).setScale(k, k).setAlpha(0.05 + 0.28 * k);
    }

    // fisica del salto
    if (!this.mgGrounded) {
      this.mgVy += GRAVITY * dt;
      const prevBottom = c.y + 11;
      c.y += this.mgVy * dt;
      const newBottom = c.y + 11;
      c.angle = Phaser.Math.Clamp(-this.mgVy * 0.035, -10, 14);

      // atterraggio su piattaforma (solo in discesa)
      if (this.mgVy > 0) {
        for (const e of this.entities) {
          if (e.kind !== 'platform' || e.topY === undefined) continue;
          if (Math.abs(c.x - e.obj.x) > e.halfW + 6) continue;
          if (prevBottom <= e.topY + 2 && newBottom >= e.topY) {
            const impact = this.mgVy;
            c.y = e.topY - 11;
            this.mgVy = 0;
            this.mgGrounded = true;
            this.mgSupport = e;
            c.angle = 0;
            this.landFx(c, impact);
            break;
          }
        }
      }
      // atterraggio a terra
      if (!this.mgGrounded && c.y >= ROAD_Y - 8) {
        const impact = this.mgVy;
        c.y = ROAD_Y - 8;
        this.mgVy = 0;
        this.mgGrounded = true;
        c.angle = 0;
        this.landFx(c, impact);
      }
    } else if (this.mgSupport) {
      // la piattaforma scorre via sotto le ruote
      if (Math.abs(c.x - this.mgSupport.obj.x) > this.mgSupport.halfW + 6) {
        this.mgGrounded = false;
        this.mgSupport = null;
        this.mgVy = 0;
      }
    }

    // scorrimento e collisioni — usa scrollSpeed dinamico
    const trandeTop = c.y - 22;
    const trandeBottom = c.y + 11;
    // Super Stella: countdown, tinta arcobaleno stile Mario, scintille
    const starActive = this.mgStarT > 0;
    if (starActive) {
      this.mgStarT -= dt;
      const hue = (this.time.now / 70) % 360;
      this.trande.sprite.setTint(
        (Phaser.Display.Color.HSVToRGB(hue / 360, 0.65, 1) as Phaser.Display.Color).color
      );
      if (Math.random() < dt * 16) {
        this.sparkle(
          c.x + Phaser.Math.Between(-14, 4),
          c.y - Phaser.Math.Between(0, 20),
          (Phaser.Display.Color.HSVToRGB(Math.random(), 0.75, 1) as Phaser.Display.Color).color
        );
      }
      if (this.mgStarT <= 0) this.trande.sprite.clearTint();
    }
    // Velocità effettiva (2x con la stella) + magnete potenziato
    const sp = starActive ? this.scrollSpeed * 2 : this.scrollSpeed;
    const magnetR = starActive ? MAGNET_R * 2.6 : MAGNET_R;
    const magnetPull = starActive ? MAGNET_PULL * 2.2 : MAGNET_PULL;

    // Bolla scudo: segue Trande
    this.shieldBubble?.setPosition(c.x, c.y - 6);

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.obj.x -= sp * dt;
      // movimento proprio (piccione, auto contromano)
      if (e.vx) e.obj.x += e.vx * dt;
      if (e.vy) {
        e.obj.y += e.vy * dt;
        if (e.targetY !== undefined && e.obj.y >= e.targetY) {
          e.obj.y = e.targetY;
          e.vy = 0;
        }
        e.centerY = e.obj.y;
      }
      if (e.obj.x < -70) {
        e.obj.destroy();
        this.entities.splice(i, 1);
        continue;
      }

      // Buca: pericolosa solo con le ruote a terra sull'asfalto (mai con la stella)
      if (e.kind === 'hole') {
        // Trande la vede arrivare e la commenta (una volta sola, solo se è davanti)
        if (!e.warned && e.obj.x > c.x && e.obj.x - c.x < 230) {
          e.warned = true;
          if (!this.mgCooldown) this.showBubble(this.trande, 'Porca paletta una buca!');
        }
        if (
          !starActive && this.mgGrounded && !this.mgSupport && !this.mgCooldown &&
          c.y >= ROAD_Y - 10 && Math.abs(c.x - e.obj.x) < e.halfW - 2
        ) {
          this.failRun();
          return;
        }
        continue;
      }

      // magnetismo monete: entro magnetR vengono risucchiate verso Trande
      if (e.kind === 'coin') {
        const mdx = c.x - e.obj.x;
        const mdy = c.y - 6 - e.centerY;
        const md = Math.hypot(mdx, mdy);
        if (md > 1 && md < magnetR) {
          const pull = magnetPull * (1 - md / magnetR) * dt;
          e.obj.x += (mdx / md) * pull;
          e.obj.y += (mdy / md) * pull;
          e.centerY += (mdy / md) * pull;
        }
      }

      // Monete e power-up generosi (+9), ostacoli più permissivi (+5)
      const xMargin = e.kind === 'coin' || e.kind === 'power' ? 9 : 5;
      const overlapX = Math.abs(c.x - e.obj.x) < e.halfW + xMargin;

      // Near-miss: l'ostacolo è appena stato superato → premio se era questione di px
      if (e.kind === 'obstacle' && !e.passed && e.obj.x < c.x - e.halfW - 12) {
        e.passed = true;
        if ((e.minClear ?? 99) <= 7) {
          Juice.popText(this, c.x, c.y - 42, 'SFIORATO!', '#66ffee', 7);
          this.sparkle(c.x + 8, c.y - 10, 0x66ffee);
          AudioManager.get().playSFX(this, 'confirm', 0.35);
        }
      }

      if (!overlapX) continue;
      // Grace sul bordo alto: si può passare qualche px "sopra" l'ostacolo
      const topEdge = e.centerY - e.halfH + (e.kind === 'obstacle' ? (e.topGrace ?? 2) : 0);
      const overlapY = trandeBottom > topEdge && trandeTop < e.centerY + e.halfH;

      if (e.kind === 'coin' && overlapY) {
        AudioManager.get().playSFX(this, 'coin', 0.7);
        this.sparkle(e.obj.x, e.centerY, 0xffdd44);
        this.showCoinPop(e.obj.x, e.centerY - 10); // popup +1
        e.obj.destroy();
        this.entities.splice(i, 1);
        this.mgCoins++;
        // combo: monete raccolte in rapida successione
        const now = this.time.now;
        this.mgCombo = now - this.mgLastCoinMs < COMBO_WINDOW_MS ? this.mgCombo + 1 : 1;
        this.mgLastCoinMs = now;
        if (this.mgCombo >= 3) {
          Juice.popText(this, c.x, c.y - 34, `COMBO x${this.mgCombo}`, '#66ffee', 7);
        }
        this.updateMgUi();
        // bounce del contatore monete
        this.tweens.add({
          targets: this.coinsText,
          scaleX: 1.4,
          scaleY: 1.4,
          duration: 70,
          yoyo: true,
          ease: 'Quad.easeOut',
        });
        // difficoltà progressiva: +15 px/s ogni 2 monete
        this.scrollSpeed = Math.min(
          SCROLL_SPEED_BASE + Math.floor(this.mgCoins / 3) * 9,
          SCROLL_SPEED_MAX
        );
        if (this.mgCoins >= COINS_TO_WIN) this.winMinigame();
        return;
      }
      // Power-up: raccolta
      if (e.kind === 'power' && overlapY) {
        AudioManager.get().playSFX(this, 'coin', 0.9);
        this.sparkle(e.obj.x, e.centerY, 0xffffff);
        const type = e.powerType;
        e.obj.destroy();
        this.entities.splice(i, 1);
        if (type === 'shield') this.activateShield();
        else this.activateStar();
        return;
      }

      if (e.kind === 'obstacle') {
        if (overlapY && !this.mgCooldown) {
          if (starActive) {
            this.smashObstacle(e, i);
            return;
          }
          if (this.mgShield) {
            this.consumeShield(e, i);
            return;
          }
          this.failRun();
          return;
        }
        // Near-miss: registra di quanti px lo si sta scavalcando/sottopassando
        if (!overlapY) {
          const clearAbove = topEdge - trandeBottom;
          const clearBelow = trandeTop - (e.centerY + e.halfH);
          const clear = Math.min(clearAbove >= 0 ? clearAbove : 99, clearBelow >= 0 ? clearBelow : 99);
          e.minClear = Math.min(e.minClear ?? 99, clear);
        }
      }
    }

    // spawn del percorso — usa la velocità effettiva
    this.spawnDist += sp * dt;
    if (this.spawnDist >= this.nextGap) {
      this.spawnDist = 0;
      const item = COURSE[this.courseIdx % COURSE.length];
      this.courseIdx++;
      this.nextGap = COURSE[this.courseIdx % COURSE.length].gap;
      this.spawnItem(item.t);
    }
  }

  // ------------------------------------------------------- power-up

  private activateShield(): void {
    this.mgShield = true;
    const c = this.trande.container;
    Juice.popText(this, c.x, c.y - 38, 'SCUDO!', '#88ddff', 7);
    this.shieldBubble?.destroy();
    this.shieldBubble = this.add
      .circle(c.x, c.y - 6, 21, 0x88ddff, 0.16)
      .setStrokeStyle(1, 0xbbeeff, 0.9)
      .setDepth(650);
    this.tweens.add({
      targets: this.shieldBubble,
      alpha: 0.55,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Super Stella stile Mario: 5s invincibile, velocità 2x, sfonda gli ostacoli. */
  private activateStar(): void {
    this.mgStarT = STAR_DURATION_S;
    const c = this.trande.container;
    Juice.popText(this, c.x, c.y - 38, 'SUPER STELLA!', '#ffdd44', 7);
    AudioManager.get().playSFX(this, 'fanfare', 0.55);
    Juice.burst(this, c.x, c.y - 10, [0xffdd44, 0xff6655, 0x66ffee, 0xaa66ff], 22, 660);
    this.cameras.main.flash(160, 255, 235, 120);
  }

  /** Con la stella attiva gli ostacoli vengono spazzati via al contatto. */
  private smashObstacle(e: Entity, index: number): void {
    AudioManager.get().playSFX(this, 'hit', 0.4);
    this.cameras.main.shake(120, 0.005);
    Juice.burst(this, e.obj.x, e.centerY, [0xffdd44, 0xff6655, 0xffffff], 20, 660);
    Juice.popText(this, e.obj.x, e.centerY - 16, 'SMASH!', '#ffdd44', 7);
    e.obj.destroy();
    this.entities.splice(index, 1);
  }

  /** Lo scudo assorbe un colpo: l'ostacolo esplode e si continua a correre. */
  private consumeShield(e: Entity, index: number): void {
    this.mgShield = false;
    const c = this.trande.container;
    AudioManager.get().playSFX(this, 'hit', 0.45);
    Juice.hitStop(this, 60);
    this.cameras.main.shake(140, 0.006);
    Juice.burst(this, e.obj.x, e.centerY, [0x88ddff, 0xffffff], 18, 660);
    Juice.popText(this, c.x, c.y - 38, 'SCUDO ROTTO!', '#88ddff', 7);
    e.obj.destroy();
    this.entities.splice(index, 1);
    // pop della bolla
    if (this.shieldBubble) {
      const b = this.shieldBubble;
      this.shieldBubble = null;
      this.tweens.killTweensOf(b);
      this.tweens.add({
        targets: b,
        scale: 1.7,
        alpha: 0,
        duration: 200,
        ease: 'Quad.easeOut',
        onComplete: () => b.destroy(),
      });
    }
    // breve invulnerabilità per evitare doppi colpi ravvicinati
    this.mgCooldown = true;
    this.time.delayedCall(450, () => {
      this.mgCooldown = false;
    });
  }

  /** Effetti di atterraggio: polvere + squash proporzionali all'impatto. */
  private landFx(c: Phaser.GameObjects.Container, impactVy: number): void {
    if (impactVy < 150) return;
    Juice.dust(this, c.x, c.y + 12, impactVy > 260 ? 6 : 4, 0xbbb49c, 640);
    Juice.squash(this, c, Phaser.Math.Clamp(impactVy / 2600, 0.06, 0.14), 90);
    // la sospensione affonda all'impatto, poi torna su da sola (molla smorzata)
    this.riderDy = Math.min(3, this.riderDy + impactVy * 0.008);
  }

  private failRun(): void {
    this.mgDefeats++;
    this.mgCooldown = true;
    this.mgCombo = 0;
    AudioManager.get().playSFX(this, 'hit');
    Juice.hitStop(this, 80);
    showEmote(this, this.trande.container.x, this.trande.container.y - 4, 'sweat', {
      duration: 1100,
      depth: 700,
    });
    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(200, 255, 60, 60);
    this.tweens.add({ targets: this.trande.sprite, alpha: 0.2, duration: 80, yoyo: true, repeat: 4 });
    this.popText(`AHIA! Si riparte da capo...\nCadute: ${this.mgDefeats}`, 1300);
    this.resetCourse();
    this.scrollSpeed = SCROLL_SPEED_BASE; // reset velocità alla caduta
    this.updateMgUi();
    this.time.delayedCall(900, () => {
      this.mgCooldown = false;
    });
  }

  private winMinigame(): void {
    this.mgActive = false;
    this.mgStarT = 0;
    this.trande.sprite.clearTint();
    if (this.shieldBubble) {
      this.shieldBubble.destroy();
      this.shieldBubble = null;
    }

    // Ferma i pensieri di Trande
    this.thoughtTimer?.remove();
    this.thoughtTimer = undefined;

    // Fade out speed lines
    if (this.speedLinesTile) {
      this.tweens.add({
        targets: this.speedLinesTile,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.speedLinesTile?.destroy();
          this.speedLinesTile = undefined;
        },
      });
    }

    for (const e of this.entities) {
      this.tweens.add({ targets: e.obj, alpha: 0, duration: 300, onComplete: () => e.obj.destroy() });
    }
    this.entities = [];
    this.coinsText.destroy();
    this.defeatsText.destroy();
    this.questHUD.clear();
    AudioManager.get().stopFgMusic(this); // fine runner → BGM torna su
    this.cameras.main.zoomTo(RENDER_SCALE, 500, 'Sine.easeInOut');
    this.scrollSpeed = 40;
    this.trande.sprite.anims.timeScale = 1;
    this.popText(`${COINS_TO_WIN} MONETE! CE L'HAI FAT—`, 1200);
    const resolve = this.mgResolve;
    this.mgResolve = null;
    this.time.delayedCall(1200, () => resolve?.());
  }

  private updateMgUi(): void {
    this.coinsText?.setText(`MONETE ${this.mgCoins}/${COINS_TO_WIN}`);
    this.defeatsText?.setText(`CADUTE ${this.mgDefeats}`);
  }

  /** Popup +1 che sale e svanisce sopra la moneta raccolta. */
  private showCoinPop(x: number, y: number): void {
    const t = this.add
      .text(x, y, '+1', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(700);
    this.tweens.add({
      targets: t,
      y: y - 22,
      alpha: 0,
      duration: 550,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // ---------------------------------------------------- spawn ostacoli

  private spawnItem(t: CourseItem): void {
    switch (t) {
      case 'coin':
        this.spawnCoin(SPAWN_X, ROAD_Y - 16);
        break;
      case 'coinAir':
        this.spawnCoin(SPAWN_X, ROAD_Y - 52);
        break;
      case 'rock': {
        const g = this.add.graphics();
        g.fillStyle(0x8a8a92);
        g.fillCircle(0, -5, 8);
        g.fillCircle(-6, -2, 6);
        g.fillCircle(6, -2, 6);
        g.fillStyle(0x6e6e78);
        g.fillCircle(2, -7, 4);
        this.addEntity('obstacle', [g], ROAD_Y, 9, 7, ROAD_Y - 6);
        break;
      }
      case 'tree': {
        const g = this.add.graphics();
        g.fillStyle(0x6b4a2f);
        g.fillRect(-3, -26, 6, 26);
        g.fillStyle(0x2e6b2e);
        g.fillCircle(0, -32, 13);
        g.fillStyle(0x357a35);
        g.fillCircle(0, -40, 9);
        this.addEntity('obstacle', [g], ROAD_Y, 6, 17, ROAD_Y - 17, 4);
        break;
      }
      case 'car': {
        const g = this.add.graphics();
        const color = Phaser.Math.RND.pick([0xcc4444, 0x4466cc, 0xccaa33, 0x55aa77]);
        g.fillStyle(color);
        g.fillRoundedRect(-22, -14, 44, 11, 3);
        g.fillRoundedRect(-12, -22, 22, 9, 3); // abitacolo
        g.fillStyle(0xaaddee);
        g.fillRect(-9, -20, 8, 6);
        g.fillStyle(0x222222);
        g.fillCircle(-13, -2, 4);
        g.fillCircle(13, -2, 4);
        // topGrace 6: si può sfrecciare raso-tetto senza morire
        this.addEntity('obstacle', [g], ROAD_Y, 20, 11, ROAD_Y - 12, 6);
        break;
      }
      case 'person': {
        const p = PEOPLE[this.personIdx % PEOPLE.length];
        this.personIdx++;
        const s = this.add.sprite(0, -17, `char-${p.id}`, 5).setScale(CHAR_SCALE);
        s.play(`${p.id}-idle-left`);
        // Colore nome: labelColor esplicito, poi shirtColor, poi bianco
        const labelColor = p.labelColor
          ?? (CHAR_CONFIGS[p.id]
            ? `#${CHAR_CONFIGS[p.id].shirtColor.toString(16).padStart(6, '0')}`
            : '#ffffff');
        const label = this.add
          .text(0, -38, p.name, {
            fontFamily: FONT,
            fontSize: '5px',
            color: labelColor,
            stroke: '#000000',
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1);
        // Container manuale — serve il riferimento per i tweens comportamentali
        const pCont = this.add.container(SPAWN_X, ROAD_Y, [s, label]).setDepth(140);
        this.entities.push({ kind: 'obstacle', obj: pCont, halfW: 7, halfH: 14, centerY: ROAD_Y - 14, topGrace: 3 });

        // ── Comportamenti unici per personaggio ─────────────────────────────
        switch (p.id) {
          case 'cosimino':
            // Tremore da spavento: micro-jitter laterale + oscillazione
            s.setX(-2);
            this.tweens.add({ targets: s, x: 2, duration: 55, yoyo: true, repeat: -1 });
            s.setAngle(-5);
            this.tweens.add({ targets: s, angle: 5, duration: 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            break;
          case 'donbiagio':
            // Benedizione solenne: su/giù + inclina a destra e sinistra
            this.tweens.add({ targets: pCont, y: ROAD_Y - 13, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            s.setAngle(-6);
            this.tweens.add({ targets: s, angle: 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            break;
          case 'christian':
            // Panico totale: rotazione 360° continua + saltello
            this.tweens.add({ targets: s, angle: 360, duration: 450, repeat: -1, ease: 'Linear' });
            this.tweens.add({ targets: s, y: -30, duration: 200, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
            break;
        }
        break;
      }
      case 'pigeon': {
        // Piccione in picchiata: plana ad altezza testa → NON bisogna saltare
        const g = this.add.graphics();
        g.fillStyle(0x9aa4b2);
        g.fillEllipse(0, 0, 12, 7);
        g.fillStyle(0x7f8896);
        g.fillCircle(-6, -2, 3); // testa (guarda a sinistra, verso Trande)
        g.fillStyle(0xffaa33);
        g.fillTriangle(-9, -2, -12, -1, -9, 0); // becco
        g.fillStyle(0x222222);
        g.fillCircle(-7, -3, 0.8); // occhio
        const wing = this.add.graphics();
        wing.fillStyle(0xb8c0cc);
        wing.fillTriangle(0, -1, 7, -8, 4, 0);
        const cont = this.add.container(SPAWN_X + 30, ROAD_Y - 80, [g, wing]).setDepth(145);
        this.tweens.add({ targets: wing, scaleY: -0.7, duration: 140, yoyo: true, repeat: -1 });
        this.entities.push({
          kind: 'obstacle', obj: cont, halfW: 6, halfH: 4, centerY: ROAD_Y - 80,
          topGrace: 0, vx: -60, vy: 36, targetY: ROAD_Y - 40,
        });
        showEmote(this, GAME_WIDTH - 16, ROAD_Y - 66, 'alert', { duration: 800, depth: 700 });
        break;
      }
      case 'carFast': {
        // Auto contromano: corre VERSO Trande più veloce dello scroll
        const g = this.add.graphics();
        const color = Phaser.Math.RND.pick([0x883333, 0x334477, 0x555555]);
        g.fillStyle(color);
        g.fillRoundedRect(-22, -14, 44, 11, 3);
        g.fillRoundedRect(-10, -22, 22, 9, 3); // abitacolo (specchiato)
        g.fillStyle(0xaaddee);
        g.fillRect(1, -20, 8, 6);
        g.fillStyle(0x222222);
        g.fillCircle(-13, -2, 4);
        g.fillCircle(13, -2, 4);
        g.fillStyle(0xffee88); // fari accesi
        g.fillRect(-23, -12, 2, 3);
        const cont = this.add.container(SPAWN_X + 40, ROAD_Y, [g]).setDepth(140);
        this.entities.push({
          kind: 'obstacle', obj: cont, halfW: 20, halfH: 11, centerY: ROAD_Y - 12,
          topGrace: 6, vx: -85,
        });
        Juice.popText(this, GAME_WIDTH - 34, ROAD_Y - 44, 'BEEP BEEP!', '#ff6655', 6);
        break;
      }
      case 'hole': {
        // Buca nell'asfalto: uccide solo se ci passi sopra con le ruote a terra
        const g = this.add.graphics();
        g.fillStyle(0x14161a);
        g.fillEllipse(0, 4, 32, 9);
        g.fillStyle(0x000000);
        g.fillEllipse(0, 4, 25, 6);
        g.lineStyle(1, 0x3a3f48); // crepe ai bordi
        g.lineBetween(-18, 3, -23, 1);
        g.lineBetween(17, 4, 22, 6);
        g.lineBetween(-14, 6, -18, 8);
        const cont = this.add.container(SPAWN_X, ROAD_Y, [g]).setDepth(105);
        this.entities.push({ kind: 'hole', obj: cont, halfW: 13, halfH: 4, centerY: ROAD_Y + 4 });
        break;
      }
      case 'gelato': {
        // Power-up scudo: un colpo gratis
        const g = this.add.graphics();
        g.fillStyle(0xd9a066);
        g.fillTriangle(-4, 2, 4, 2, 0, 11); // cono
        g.lineStyle(1, 0xb8834f);
        g.lineBetween(-2, 5, 2, 5);
        g.fillStyle(0xff88aa);
        g.fillCircle(-2, -2, 4); // fragola
        g.fillStyle(0xfff2cc);
        g.fillCircle(3, -2, 4);  // crema
        const cont = this.add.container(SPAWN_X, ROAD_Y - 30, [g]).setDepth(130);
        this.tweens.add({ targets: g, y: -3, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.entities.push({
          kind: 'power', obj: cont, halfW: 8, halfH: 11, centerY: ROAD_Y - 30, powerType: 'shield',
        });
        break;
      }
      case 'stella': {
        // Power-up super-magnete: 4 secondi di risucchio potenziato
        const g = this.add.graphics();
        const pts: Phaser.Math.Vector2[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? 8 : 3.5;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
        }
        g.fillStyle(0xffdd44);
        g.fillPoints(pts, true);
        g.fillStyle(0xfff2a0);
        g.fillCircle(0, 0, 2.5);
        const cont = this.add.container(SPAWN_X, ROAD_Y - 44, [g]).setDepth(130);
        this.tweens.add({ targets: g, angle: 360, duration: 2200, repeat: -1 });
        this.entities.push({
          kind: 'power', obj: cont, halfW: 9, halfH: 10, centerY: ROAD_Y - 44, powerType: 'magnet',
        });
        break;
      }
      case 'platform': {
        const w = 110;
        const g = this.add.graphics();
        g.fillStyle(0x9a6a3a);
        g.fillRect(-w / 2, 0, w, 10);
        g.lineStyle(1, 0x6e4a26);
        g.strokeRect(-w / 2, 0, w, 10);
        // tavole di legno ogni 22px
        g.lineBetween(-w / 2 + 22, 0, -w / 2 + 22, 10);
        g.lineBetween(-w / 2 + 44, 0, -w / 2 + 44, 10);
        g.lineBetween(-w / 2 + 66, 0, -w / 2 + 66, 10);
        g.lineBetween(-w / 2 + 88, 0, -w / 2 + 88, 10);
        const topY = ROAD_Y - 32;
        const cont = this.add.container(SPAWN_X, topY, [g]).setDepth(120);
        this.entities.push({
          kind: 'platform',
          obj: cont,
          halfW: w / 2,
          halfH: 5,
          centerY: topY + 5,
          topY,
        });
        // tre monete sopra la piattaforma
        this.spawnCoin(SPAWN_X - 30, topY - 14);
        this.spawnCoin(SPAWN_X,      topY - 14);
        this.spawnCoin(SPAWN_X + 30, topY - 14);
        break;
      }
    }
  }

  private spawnCoin(x: number, y: number): void {
    const img = this.add.sprite(0, 0, 'tex-coin-0');
    img.play({ key: 'coin-spin', startFrame: Phaser.Math.Between(0, 5) });
    const cont = this.add.container(x, y, [img]).setDepth(130);
    this.tweens.add({ targets: img, y: -3, duration: 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.entities.push({ kind: 'coin', obj: cont, halfW: 8, halfH: 10, centerY: y });
  }

  private addEntity(
    kind: 'obstacle',
    children: Phaser.GameObjects.GameObject[],
    baseY: number,
    halfW: number,
    halfH: number,
    centerY: number,
    topGrace = 2
  ): void {
    const cont = this.add.container(SPAWN_X, baseY, children).setDepth(140);
    this.entities.push({ kind, obj: cont, halfW, halfH, centerY, topGrace });
  }

  private sparkle(x: number, y: number, tint: number): void {
    this.ensureFxTexture();
    const em = this.add
      .particles(x, y, 'fx-px', {
        speed: { min: 30, max: 90 },
        lifespan: 300,
        scale: { start: 1, end: 0 },
        tint,
        emitting: false,
      })
      .setDepth(600);
    em.explode(10);
    this.time.delayedCall(350, () => em.destroy());
  }

  private popText(text: string, holdMs: number): void {
    const t = this.add
      .text(GAME_WIDTH / 2, 90, text, {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(960)
      .setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.time.delayedCall(holdMs, () => {
      this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() });
    });
  }

  // ------------------------------------------------- caduta e soccorso

  /**
   * Caduta realistica:
   * 1. la bici scivola avanti per inerzia e si ribalta lateralmente
   * 2. Trande descrive una parabola vera (container sale poi scende fino a ROAD_Y)
   * 3. Impatto a terra con CRACK + dust
   * 4. Piedi per aria (oscillazione)
   */
  private async crash(): Promise<void> {
    this.scrollSpeed = 0;
    // Da qui in poi la cutscene ha il controllo totale: niente più fisica rider
    this.ridePhysicsOn = false;
    const trande = this.trande;
    this.riders.forEach((r) => {
      r.bob?.remove();
      r.sprite.setAngle(0);
      r.bike.y = 0;
    });

    // Salva posizione world del container prima del distacco della bici
    const cx = trande.container.x; // ~100
    const cy = trande.container.y; // ROAD_Y - 8 = 190

    // Distacca la bici dal container: d'ora in poi è indipendente
    // Dopo la rimozione il container contiene solo [sprite(0), label(1)]
    trande.container.remove(trande.bike, false);
    trande.bike.setPosition(cx, cy).setDepth(ROAD_Y + 3);

    // Nasconde il label durante la caduta
    (trande.container.getAt(1) as Phaser.GameObjects.Text)?.setAlpha(0);

    AudioManager.get().playSFX(this, 'hit');
    this.cameras.main.shake(350, 0.012);

    // ── BICI ── scivolata per inerzia → inclinazione → caduta laterale
    this.tweens.add({
      targets: trande.bike,
      x: cx + 90,
      duration: 750,
      ease: 'Quad.easeOut',
    });
    this.time.delayedCall(320, () => {
      this.tweens.add({
        targets: trande.bike,
        angle: 90,       // completamente piatta a terra
        y: ROAD_Y + 4,   // centro del container sotto la strada: appare coricata
        duration: 420,
        ease: 'Quad.easeIn',
      });
    });

    // ── TRANDE ── fase 1: lancio verso l'alto (parabola ascendente)
    await Promise.all([
      this.tweenP({
        targets: trande.container,
        x: cx + 16,
        y: cy - 28,       // sale dal suolo
        duration: 240,
        ease: 'Quad.easeOut',
      }),
      this.tweenP({
        targets: trande.sprite,
        angle: 85,        // si inclina in volo
        duration: 240,
        ease: 'Quad.easeOut',
      }),
    ]);

    // ── fase 2: caduta a terra (gravità — il container scende fino a ROAD_Y)
    await Promise.all([
      this.tweenP({
        targets: trande.container,
        x: trande.container.x + 35,
        y: ROAD_Y,        // il container tocca la strada
        duration: 310,
        ease: 'Quad.easeIn', // accelera come la gravità
      }),
      this.tweenP({
        targets: trande.sprite,
        angle: 180,       // capovolto
        y: -6,            // leggermente sopra il centro del container
        duration: 310,
        ease: 'Quad.easeIn',
      }),
    ]);

    // ── Impatto ──
    this.cameras.main.shake(280, 0.015);
    this.cameras.main.flash(180, 255, 60, 60);

    const crack = this.add
      .text(trande.container.x, ROAD_Y - 32, 'CRACK!', {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#ff4444',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(900)
      .setScale(0);
    this.tweens.add({ targets: crack, scale: 1.2, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: crack,
      alpha: 0,
      delay: 1100,
      duration: 300,
      onComplete: () => crack.destroy(),
    });

    this.ensureFxTexture();
    const dust = this.add
      .particles(trande.container.x, ROAD_Y + 2, 'fx-px', {
        speed: { min: 20, max: 80 },
        lifespan: 500,
        scale: { start: 1.3, end: 0 },
        tint: [0xbbaa88, 0xddccaa],
        emitting: false,
      })
      .setDepth(600);
    dust.explode(32);

    // ── piedi per aria: oscillano lentamente ──
    this.tweens.add({
      targets: trande.sprite,
      angle: { from: 174, to: 186 },
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    await this.delay(700);
  }

  /** Gli altri tornano indietro e si radunano intorno a Trande. */
  private async gatherAroundTrande(): Promise<void> {
    const tx = this.trande.container.x; // ~100
    const spots: Record<string, number> = {
      aniceto: tx - 70,
      ilaria: tx - 48,
      bubi: tx - 26,
      cece: tx + 42,
      guglielmo: tx + 62,
    };
    const moves: Promise<void>[] = [];
    let stagger = 0;
    for (const r of this.riders) {
      const dest = spots[r.id];
      if (dest === undefined) continue;
      // Se il rider è ancora fuori schermo (era scappato a destra), lo
      // piazziamo in fila di rientro; se è già on-screen (è rimasto dal
      // dottore), lo lasciamo dov'è e lo tweeniamo direttamente alla spot.
      if (r.container.x >= GAME_WIDTH) {
        r.container.x = 540 + stagger * 35;
      }
      stagger++;
      r.sprite.anims.timeScale = 1.4;
      r.sprite.anims.play(`${r.id}-walk-left`, true);
      moves.push(
        this.tweenP({
          targets: r.container,
          x: dest,
          duration: 1400 + stagger * 120,
          ease: 'Sine.easeOut',
        }).then(() => {
          r.sprite.anims.timeScale = 1;
          r.sprite.anims.play(`${r.id}-idle-${dest < tx ? 'right' : 'left'}`, true);
        })
      );
    }
    await Promise.all(moves);
  }

  // ---------------------------------------- dottore in moto (intermezzo)

  /**
   * Disegna il dottore in moto in scala NPC (simile ai ciclisti).
   * Container a ROAD_Y-8 come tutti i rider; estensione verticale ~35px totali.
   */
  private createDoctorMoto(): Phaser.GameObjects.Container {
    const g = this.add.graphics();

    // ── Ruote (radius 6 — leggermente più grandi della bici, radius 5) ──
    for (const wx of [-14, 14]) {
      g.lineStyle(2, 0x222222);
      g.strokeCircle(wx, 3, 6);
      g.fillStyle(0x333333);
      g.fillCircle(wx, 3, 3);
      // raggi a croce
      g.lineStyle(1, 0x555555);
      g.lineBetween(wx - 5, 3, wx + 5, 3);
      g.lineBetween(wx, -3, wx, 9);
    }

    // ── Telaio moto ──────────────────────────────────────────────────
    g.lineStyle(2, 0x445566);
    g.lineBetween(-14, 3,  2, -3);   // tubo inferiore posteriore
    g.lineBetween(2, -3, 14, 3);     // forcella anteriore
    g.lineBetween(1, -3,  -2, -9);   // canotto sella
    // sella (più larga della bici per dare idea di moto)
    g.lineStyle(2, 0x222222);
    g.lineBetween(-6, -9, 4, -9);
    // serbatoio (blocco colorato tra i tubi)
    g.fillStyle(0x3355aa);
    g.fillRect(-4, -8, 9, 5);
    // motore (blocco grigio sotto il serbatoio)
    g.fillStyle(0x556677);
    g.fillRect(-6, -3, 12, 5);
    // manubrio anteriore
    g.lineStyle(2, 0x778899);
    g.lineBetween(14, 3, 15, -4);    // stelo forcella
    g.lineBetween(11, -4, 19, -4);   // manubrio orizzontale
    // scarico (tubo sul lato destro)
    g.lineStyle(1, 0x888888);
    g.lineBetween(6, 1, 18, 2);

    // ── Rider (scala identica ai ciclisti) ───────────────────────────
    // corpo / giacca scura (inclinato sul manubrio)
    g.fillStyle(0x334455);
    g.fillRect(-4, -20, 9, 12);
    // braccio teso verso il manubrio
    g.fillStyle(0x445566);
    g.fillRect(2, -16, 12, 3);
    // testa
    g.fillStyle(0xf2c8a0);
    g.fillCircle(0, -24, 4);
    // barba bianca (striscia bianca nella metà inferiore del viso)
    g.fillStyle(0xeeeeee);
    g.fillRect(-3, -24, 6, 4);
    // casco integrale (copre tutta la testa + visiera)
    g.fillStyle(0x3366bb);
    g.fillRect(-4, -29, 9, 7);
    g.lineStyle(1, 0x2255aa);
    g.strokeRect(-4, -29, 9, 7);
    // visiera scura
    g.fillStyle(0x223344, 0.8);
    g.fillRect(-3, -27, 7, 3);

    const cont = this.add.container(GAME_WIDTH + 60, ROAD_Y - 8, [g]);
    cont.setDepth(ROAD_Y + 5);
    return cont;
  }

  /** Uomo con barba bianca in moto: arriva, chiede aiuto, viene cacciato, se ne va. */
  private async doctorIntervention(): Promise<void> {
    await this.delay(700);

    // ── Il dottore entra da destra ───────────────────────────────────
    const moto = this.createDoctorMoto();
    const stopX = this.trande.container.x + 110;

    await this.tweenP({ targets: moto, x: stopX, duration: 1300, ease: 'Quad.easeOut' });
    await this.delay(350);
    await this.runDialogue(DOCTOR_ARRIVES_LINES);
    await this.delay(250);

    // ── Tre amici arrivano di corsa da destra ────────────────────────
    const rushIds = ['bubi', 'cece', 'guglielmo'];
    const rushers = rushIds
      .map(id => this.riders.find(r => r.id === id)!)
      .filter(Boolean);

    // Posizionali appena fuori schermo, poi corrono verso Trande
    rushers.forEach((r, i) => {
      r.container.x = GAME_WIDTH + 40 + i * 28;
      r.sprite.anims.timeScale = 2.5;
      r.sprite.play(`${r.id}-walk-left`, true);
    });

    await Promise.all(
      rushers.map((r, i) =>
        this.tweenP({
          targets: r.container,
          x: this.trande.container.x + 50 + i * 24,
          duration: 750,
          ease: 'Quad.easeOut',
          delay: i * 55,
        }).then(() => {
          r.sprite.anims.timeScale = 1;
          r.sprite.play(`${r.id}-idle-left`, true);
        })
      )
    );

    await this.delay(150);
    await this.runDialogue(DISMISS_DOCTOR_LINES);
    await this.delay(200);

    // ── Il dottore rimette in moto e se ne va a destra ───────────────
    await this.tweenP({ targets: moto, x: GAME_WIDTH + 120, duration: 1000, ease: 'Quad.easeIn' });
    moto.destroy();
    await this.delay(300);
    // I rushers rimangono dov'erano: gatherAroundTrande li troverà già on-screen
    // e li tweenerà direttamente alla loro posizione definitiva.
  }

  // ----------------------------------------------------------- helpers

  private runDialogue(lines: DialogueLine[]): Promise<void> {
    return new Promise((resolve) => this.dialogue.start({ lines, onComplete: resolve }));
  }

  /** Nuvoletta fumetto sopra un personaggio. */
  private showBubble(rider: Rider, text: string): void {
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

    const c = this.add
      .container(rider.container.x, rider.container.y - 38 - h / 2, [g, t])
      .setDepth(950)
      .setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.time.delayedCall(1500, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
    });
  }

  private ensureFxTexture(): void {
    if (this.textures.exists('fx-px')) return;
    const g = this.make.graphics();
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('fx-px', 4, 4);
    g.destroy();
  }

  private spawnTeleportParticles(): void {
    this.ensureFxTexture();
    for (const r of this.riders) {
      const em = this.add
        .particles(r.container.x, r.container.y - 10, 'fx-px', {
          speed: { min: 30, max: 110 },
          lifespan: 600,
          scale: { start: 1.4, end: 0 },
          tint: [0x66ffee, 0xffffff, 0x8800ff],
          emitting: false,
        })
        .setDepth(1600);
      em.explode(24);
      this.tweens.add({ targets: r.container, alpha: 0, duration: 500 });
    }
  }

  // ------------------------------------------------------------ setup

  private createCoinTexture(): void {
    if (!this.textures.exists('tex-coin')) {
      const g = this.make.graphics();
      g.fillStyle(0xcc9911);
      g.fillCircle(8, 8, 7);
      g.fillStyle(0xffdd44);
      g.fillCircle(8, 8, 6);
      g.fillStyle(0xfff2a0);
      g.fillCircle(6, 6, 2);
      g.lineStyle(1, 0xcc9911);
      g.strokeCircle(8, 8, 4);
      g.generateTexture('tex-coin', 16, 16);
      g.destroy();
    }

    // Frame di rotazione: la moneta si schiaccia orizzontalmente (flip 3D)
    const widths = [1, 0.72, 0.34, 0.1, 0.34, 0.72]; // fattori di larghezza
    widths.forEach((f, i) => {
      const key = `tex-coin-${i}`;
      if (this.textures.exists(key)) return;
      const g = this.make.graphics();
      const w = Math.max(1.6, 14 * f);
      if (f < 0.2) {
        // moneta di taglio: solo il bordo
        g.fillStyle(0xcc9911);
        g.fillEllipse(8, 8, w + 1, 14);
        g.fillStyle(0xfff2a0);
        g.fillEllipse(8, 5, w, 3);
      } else {
        g.fillStyle(0xcc9911);
        g.fillEllipse(8, 8, w + 2, 14);
        g.fillStyle(0xffdd44);
        g.fillEllipse(8, 8, w, 12);
        g.fillStyle(0xfff2a0);
        g.fillEllipse(8 - w * 0.14, 6, Math.max(1.4, w * 0.28), 3.5);
        g.lineStyle(1, 0xcc9911);
        g.strokeEllipse(8, 8, w * 0.56, 8);
      }
      g.generateTexture(key, 16, 16);
      g.destroy();
    });

    if (!this.anims.exists('coin-spin')) {
      this.anims.create({
        key: 'coin-spin',
        frames: widths.map((_f, i) => ({ key: `tex-coin-${i}`, frame: '__BASE' })),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  /** Texture per le speed lines: linee orizzontali bianche semitrasparenti. */
  private createSpeedLinesTexture(): void {
    if (this.textures.exists('tex-speed')) return;
    const g = this.make.graphics();
    // [x, y, lunghezza] — distribuite su tutta l'altezza
    const lines: [number, number, number][] = [
      [0,   12,  55],
      [30,  28,  90],
      [10,  44,  40],
      [0,   60, 110],
      [20,  76,  35],
      [50,  92,  70],
      [0,  108,  50],
      [15, 124,  85],
      [35, 140,  45],
      [0,  158, 100],
      [25, 174,  60],
      [10, 190,  80],
      [40, 210,  45],
      [0,  228,  90],
      [20, 246,  55],
      [5,  262,  70],
    ];
    for (const [x, y, len] of lines) {
      g.lineStyle(1, 0xffffff, 0.18);
      g.lineBetween(x, y, x + len, y);
    }
    g.generateTexture('tex-speed', GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
  }

  private spawnRiders(): void {
    RIDER_SETUP.forEach(([id, x], i) => {
      generateSpriteTexture(this, id, CHAR_CONFIGS[id]);

      // Telaio (senza ruote)
      const frame = this.add.graphics();
      this.drawBikeFrame(frame);

      // Ruota sinistra (posteriore) — posizionata nel container bici
      const wheelL = this.add.graphics();
      this.drawBikeWheel(wheelL);
      wheelL.setPosition(-9, 6);

      // Ruota destra (anteriore)
      const wheelR = this.add.graphics();
      this.drawBikeWheel(wheelR);
      wheelR.setPosition(9, 6);

      // Pedivella con pedali: ruota attorno al movimento centrale (0, 1)
      const crank = this.add.graphics();
      crank.lineStyle(1.5, 0x333333, 1);
      crank.lineBetween(0, -4, 0, 4);
      crank.fillStyle(0x222831);
      crank.fillRect(-2.5, -5.5, 5, 2); // pedale alto
      crank.fillRect(-2.5, 3.5, 5, 2);  // pedale basso
      crank.setPosition(0, 1);

      // Container bici: ruote + pedivella + telaio (il telaio copre il mozzo)
      const bike = this.add.container(0, 0, [wheelL, wheelR, crank, frame]);

      // Tween di rotazione continua di ruote e pedivella (timeScale in update)
      const tweenWL = this.tweens.add({ targets: wheelL, angle: 360, duration: 680, repeat: -1, ease: 'Linear' });
      const tweenWR = this.tweens.add({ targets: wheelR, angle: 360, duration: 680, repeat: -1, ease: 'Linear' });
      // cadenza di pedalata più lenta della rotazione ruote (rapporto ~1:1.6)
      const crankTween = this.tweens.add({ targets: crank, angle: 360, duration: 1100, repeat: -1, ease: 'Linear' });

      // ciclista seduto sulla bici, rivolto a destra
      const sprite = this.add.sprite(0, -12, `char-${id}`, 9).setScale(CHAR_SCALE);
      sprite.play(`${id}-walk-right`); // le gambe "pedalano"
      sprite.anims.timeScale = 1.3;

      const label = addNameLabel(this, 0, 0, id).setPosition(0, -28);

      const container = this.add
        .container(x, ROAD_Y - 8, [bike, sprite, label])
        .setDepth(ROAD_Y + i);
      const shadow = this.add.ellipse(x, ROAD_Y + 4, 26, 4, 0x000000, 0.3).setDepth(10);

      // (niente bob rigido del container: il movimento del corpo è guidato
      // dalla pedalata e dalla sospensione, per-frame in update())
      const rider: Rider = {
        id, container, sprite, bike,
        wheelTweens: [tweenWL, tweenWR], crank, crankTween, shadow,
      };
      this.riders.push(rider);
      if (id === 'trande') this.trande = rider;
    });
  }

  /** Solo il telaio (senza ruote, che sono Graphics separati). */
  private drawBikeFrame(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(2, 0xcc4444, 1); // telaio rosso
    g.lineBetween(-9, 6, 0, 0);  // catena/tubo inferiore
    g.lineBetween(0, 0, 9, 6);   // forcella anteriore
    g.lineBetween(-1, 0, -3, -5); // canotto sella
    g.lineBetween(-6, -5, 0, -5); // sella
    g.lineBetween(9, 6, 10, -3);  // stelo forcella
    g.lineBetween(7, -3, 13, -3); // manubrio
  }

  /** Ruota con 4 raggi a croce diagonale — ruota intorno al proprio centro (0,0). */
  private drawBikeWheel(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(2, 0x222831, 1);
    g.strokeCircle(0, 0, 5);
    // raggi (due coppie a X per sembrare che girino)
    g.lineStyle(1, 0x444444, 1);
    g.lineBetween(-5, 0, 5, 0);
    g.lineBetween(0, -5, 0, 5);
    g.lineBetween(-3, -4, 3, 4);
    g.lineBetween(3, -4, -3, 4);
  }

  private drawBackground(): void {
    // Cielo estivo (statico)
    const sky = this.make.graphics();
    const top = Phaser.Display.Color.ValueToColor(0x7ec3ef);
    const bottom = Phaser.Display.Color.ValueToColor(0xd9eef8);
    // Riempi tutta l'altezza della scena con il colore di fondo del cielo (0xd9eef8),
    // così non rimane una fascia nera sotto la sfumatura (dietro le case).
    sky.fillStyle(0xd9eef8);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Sfumatura nelle prime 10 bande (140 px)
    for (let i = 0; i < 10; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 9, i);
      sky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      sky.fillRect(0, i * 14, GAME_WIDTH, 15);
    }
    sky.fillStyle(0xfff2b0, 0.5);
    sky.fillCircle(404, 38, 24);
    sky.fillStyle(0xfff7cc);
    sky.fillCircle(404, 38, 15);
    if (!this.textures.exists('tex-bici-sky')) {
      sky.generateTexture('tex-bici-sky', GAME_WIDTH, GAME_HEIGHT);
    }
    sky.destroy();
    this.add.image(0, 0, 'tex-bici-sky').setOrigin(0).setDepth(-30);

    // Nuvole pixel-art (TileSprite scorrevole lento)
    if (!this.textures.exists('tex-bici-clouds')) {
      const cg = this.make.graphics();
      // nuvola grande (sinistra)
      cg.fillStyle(0xffffff, 0.85);
      cg.fillCircle(40, 18, 10);
      cg.fillCircle(55, 14, 13);
      cg.fillCircle(70, 18, 10);
      cg.fillRect(40, 18, 30, 10);
      // nuvola media (centro)
      cg.fillStyle(0xffffff, 0.7);
      cg.fillCircle(200, 28, 7);
      cg.fillCircle(212, 24, 9);
      cg.fillCircle(224, 28, 7);
      cg.fillRect(200, 28, 24, 7);
      // nuvola piccola (destra)
      cg.fillStyle(0xffffff, 0.75);
      cg.fillCircle(340, 12, 8);
      cg.fillCircle(352, 8, 11);
      cg.fillCircle(365, 12, 8);
      cg.fillRect(340, 12, 25, 8);
      cg.generateTexture('tex-bici-clouds', GAME_WIDTH, 50);
      cg.destroy();
    }
    this.cloudsTile = this.add
      .tileSprite(0, 20, GAME_WIDTH, 50, 'tex-bici-clouds')
      .setOrigin(0)
      .setDepth(-25);

    // Striscia di case e alberi — 4 varianti distinte (pattern tileabile 480px)
    const strip = this.make.graphics();
    // [wall, roof, roofApex, door, win] — apice tetto relativo al top della casa (y=36)
    const houseVariants: [number, number, number, number, number][] = [
      [0xe8d8b0, 0x9c4a3a, 16, 0x6b4a2f, 0xa8d0e0],  // sabbia / mattone rosso
      [0xd4c4a0, 0x6a3020, 22, 0x5a3828, 0x88bcd4],  // beige scuro / tetto bordeaux alto
      [0xd8e0c8, 0x5a7040, 13, 0x3a5030, 0xb8d4c0],  // verde chiaro / tetto verde oliva
      [0xe0cfc0, 0x886644, 19, 0x5c3c22, 0xb0c8d8],  // grigio caldo / tetto marrone
    ];
    for (let i = 0; i < 4; i++) {
      const hx = 10 + i * 120;
      const [wall, roof, apex, door, win] = houseVariants[i];
      strip.fillStyle(wall);
      strip.fillRect(hx, 36, 56, 54);
      // cornicione
      strip.fillStyle(Phaser.Display.Color.ValueToColor(wall).darken(15).color);
      strip.fillRect(hx - 2, 36, 60, 3);
      // tetto
      strip.fillStyle(roof);
      strip.fillTriangle(hx - 6, 38, hx + 62, 38, hx + 28, 36 - apex);
      // porta
      strip.fillStyle(door);
      strip.fillRect(hx + 22, 66, 12, 24);
      // finestre
      strip.fillStyle(win);
      strip.fillRect(hx + 7, 45, 13, 12);
      strip.fillRect(hx + 36, 45, 13, 12);
      // telaio finestra (croce)
      strip.fillStyle(Phaser.Display.Color.ValueToColor(win).darken(25).color);
      strip.fillRect(hx + 13, 45, 1, 12);
      strip.fillRect(hx + 7,  51, 13, 1);
      strip.fillRect(hx + 42, 45, 1, 12);
      strip.fillRect(hx + 36, 51, 13, 1);
      // albero tra le case (alternato tra due specie)
      const tx = hx + 90;
      strip.fillStyle(0x6b4a2f);
      strip.fillRect(tx - 3, 64, 6, 26);
      if (i % 2 === 0) {
        // chioma tonda
        strip.fillStyle(0x2e6b2e);
        strip.fillCircle(tx, 56, 16);
        strip.fillStyle(0x357a35);
        strip.fillCircle(tx - 4, 48, 10);
        strip.fillStyle(0x3d8a3d);
        strip.fillCircle(tx + 5, 50, 8);
      } else {
        // chioma più triangolare (cipresso-ish)
        strip.fillStyle(0x2a5a28);
        strip.fillTriangle(tx - 14, 64, tx + 14, 64, tx, 36);
        strip.fillStyle(0x347030);
        strip.fillTriangle(tx - 10, 58, tx + 10, 58, tx, 36);
      }
    }
    if (!this.textures.exists('tex-bici-case')) {
      strip.generateTexture('tex-bici-case', GAME_WIDTH, 92);
    }
    strip.destroy();
    this.caseTile = this.add
      .tileSprite(0, 98, GAME_WIDTH, 92, 'tex-bici-case')
      .setOrigin(0)
      .setDepth(-20);

    // Strada con marcatura completa (pattern tileabile)
    const road = this.make.graphics();
    // asfalto base
    road.fillStyle(0x3c3c44);
    road.fillRect(0, 0, GAME_WIDTH, 80);
    // sottile variazione tono per evitare piattezza
    road.fillStyle(0x363640);
    road.fillRect(0, 20, GAME_WIDTH, 2);
    road.fillRect(0, 56, GAME_WIDTH, 2);
    // marciapiede in alto
    road.fillStyle(0x9a9aa2);
    road.fillRect(0, 0, GAME_WIDTH, 10);
    // linea di bordo marciapiede/strada
    road.fillStyle(0xbcbcb4);
    road.fillRect(0, 9, GAME_WIDTH, 2);
    // riga centrale tratteggiata (mezzeria)
    road.fillStyle(0xe8e8d8);
    for (let x = 8; x < GAME_WIDTH; x += 48) road.fillRect(x, 38, 22, 3);
    // linea di spalla destra (bordo inferiore carreggiata)
    road.fillStyle(0xd8d8c8);
    road.fillRect(0, 72, GAME_WIDTH, 2);
    // cunetta/scarico in fondo alla strada
    road.fillStyle(0x2e2e36);
    road.fillRect(0, 74, GAME_WIDTH, 6);
    if (!this.textures.exists('tex-bici-road')) {
      road.generateTexture('tex-bici-road', GAME_WIDTH, 80);
    }
    road.destroy();
    this.roadTile = this.add
      .tileSprite(0, GAME_HEIGHT - 80, GAME_WIDTH, 80, 'tex-bici-road')
      .setOrigin(0)
      .setDepth(-10);
  }

  // ------------------------------------------------------------ util

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tweenP(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}
