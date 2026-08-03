import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { CHAR_CONFIGS, generateSpriteTexture, loadPortraits, getPortraitKey } from '../systems/CharacterSprite';
import { TransitionSystem, UI_OFF_X, UI_OFF_Y } from '../systems/TransitionSystem';
import { Juice } from '../systems/Juice';
import { AudioManager } from '../systems/AudioManager';

const W = GAME_WIDTH;   // 480
const H = GAME_HEIGHT;  // 270
const FONT = '"Press Start 2P", monospace';

// ── Layout (world coords, camera: zoom×2 centrata su 240,135) ─────────────────
const GRASS_Y  = 190;   // linea superiore dell'erba
const PLAYER_Y = 232;   // asse vita Umberto (mezzo busto)

// Confini di volo (world space)
const TGT_XMIN = 20;
const TGT_XMAX = W - 20;
const TGT_YMIN = 18;

const GOAL = 20;  // punti per vincere

const FIRE_COOLDOWN = 550;    // ms minimi tra un colpo e l'altro (anti spam-click)
const TIME_RAMP_MS  = 75000;  // la difficoltà tende a 1 anche solo col tempo (~75s)

// ─────────────────────────────────────────────────────────────────────────────
type TargetKind = 'frog' | 'cricket' | 'butterfly' | 'mosquito' | 'bird' | 'fly' | 'cece';

/**
 * Definizione di un tipo di bersaglio.
 * Fisica Duck Hunt: tutti spawna dal basso al centro, volano in diagonale,
 * rimbalzano sui bordi, e al timeout "scappano" verso l'alto fuori schermo.
 */
interface TargetDef {
  kind:     TargetKind;
  points:   number;
  hitR:     number;     // raggio hitbox (px world)
  minDiff:  number;     // difficoltà minima per apparire (0–1)
  baseSpd:  number;     // px/s a difficoltà 0
  maxSpd:   number;     // px/s a difficoltà 1
  /** Angolo di lancio rispetto all'orizzontale (in gradi).
   *  Valori alti = più verticale (rana/grillo).
   *  Valori bassi = più orizzontale (uccello/mosca). */
  angleMin: number;
  angleMax: number;
  /** Se true: rovescia periodicamente vx (moschino, mosca). */
  erratic:  boolean;
  color:    number;
  color2:   number;
}

const DEFS: TargetDef[] = [
  { kind:'frog',      points:1,  hitR:14, minDiff:0.0, baseSpd:40,  maxSpd:70,  angleMin:55, angleMax:80, erratic:false, color:0x2dac2d, color2:0x6fe86f },
  { kind:'cricket',   points:1,  hitR:10, minDiff:0.0, baseSpd:35,  maxSpd:65,  angleMin:55, angleMax:80, erratic:false, color:0x7c5a1a, color2:0xd4a840 },
  { kind:'butterfly', points:2,  hitR:11, minDiff:0.1, baseSpd:55,  maxSpd:100, angleMin:35, angleMax:60, erratic:false, color:0xff8844, color2:0xffddaa },
  { kind:'mosquito',  points:2,  hitR: 8, minDiff:0.2, baseSpd:65,  maxSpd:120, angleMin:30, angleMax:55, erratic:true,  color:0x888888, color2:0xbbbbbb },
  { kind:'bird',      points:2,  hitR:14, minDiff:0.1, baseSpd:90,  maxSpd:155, angleMin:25, angleMax:45, erratic:false, color:0xffffff, color2:0x2d6622 },
  { kind:'fly',       points:3,  hitR: 6, minDiff:0.5, baseSpd:100, maxSpd:180, angleMin:20, angleMax:50, erratic:true,  color:0x333333, color2:0x666666 },
  { kind:'cece',      points:-1, hitR:20, minDiff:0.4, baseSpd:45,  maxSpd:80,  angleMin:40, angleMax:65, erratic:false, color:0x6ab0ff, color2:0xffffff },
];

type TargetPhase = 'rising' | 'visible' | 'flyaway' | 'hit';

interface Target {
  def:     TargetDef;
  gfx:     Phaser.GameObjects.Graphics;
  image?:  Phaser.GameObjects.Image;
  /** Sprite char-cece per l'allucinazione (pixel-art con face photo embedded). */
  sprite?: Phaser.GameObjects.Sprite;
  bubble?: Phaser.GameObjects.Text;
  x: number; y: number;
  vx: number; vy: number;
  phase:   TargetPhase;
  visibleUntil: number;
  angle:   number;  // per flutter/wobble animazione
  erraticTimer: number;
}

// ─────────────────────────────────────────────────────────────────────────────
export class PipScene extends Phaser.Scene {

  private score        = 0;
  private diff         = 0;
  private started      = false;
  private finished     = false;

  private targets:   Target[] = [];
  private spawnTimer = 0;
  private nextSpawn  = 2000;

  private lastShot   = 0;   // timestamp ultimo colpo (cooldown)
  private startTime  = 0;   // quando la partita è davvero iniziata (rampa tempo)

  // mirino (world coords, con lag ubriachezza)
  private crossX = W / 2;
  private crossY = 80;
  private rawX   = W / 2;
  private rawY   = 80;

  // ubriachezza
  private drunkWobble    = 0;
  private drunkIntensity = 0;
  private drunkFlash     = 0;
  private nextDrunkAt    = 5000;

  // allucinazione Cece
  private ceceActive = false;
  private nextCeceAt = 9000;

  // Graphics in world space (NO setScrollFactor)
  private crossGfx!:   Phaser.GameObjects.Graphics;
  private sprayGfx!:   Phaser.GameObjects.Graphics;
  private drunkGfx!:   Phaser.GameObjects.Graphics;
  private umGfx!:      Phaser.GameObjects.Graphics;
  private umArms!:     Phaser.GameObjects.Graphics;
  /** Erba in primo piano (depth 20): si sovrappone ai bersagli mentre salgono dall'erba. */
  private fgGrass!:    Phaser.GameObjects.Graphics;
  /** Pozzanghera ai piedi di Umberto: cresce col punteggio. */
  private puddleGfx!:  Phaser.GameObjects.Graphics;
  // HUD (setScrollFactor(0) + UI_OFF_X/Y come da convenzione del progetto)
  private scoreText!: Phaser.GameObjects.Text;
  /** Barra "vescica": urgenza che cala man mano che Umberto si libera. */
  private reliefGfx!: Phaser.GameObjects.Graphics;

  constructor() { super('PipScene'); }

  preload(): void {
    loadPortraits(this, ['umberto', 'cece']);
  }

  create(): void {
    // reset stato
    this.score = 0; this.diff = 0;
    this.started = false; this.finished = false;
    this.targets = []; this.spawnTimer = 0; this.nextSpawn = 2000;
    this.lastShot = 0; this.startTime = 0;
    this.crossX = W / 2; this.crossY = 80;
    this.rawX   = W / 2; this.rawY   = 80;
    this.drunkWobble = 0; this.drunkIntensity = 0;
    this.drunkFlash  = 0; this.nextDrunkAt = 5000;
    this.ceceActive  = false; this.nextCeceAt = 9000;

    generateSpriteTexture(this, 'umberto', CHAR_CONFIGS['umberto']);
    generateSpriteTexture(this, 'cece',    CHAR_CONFIGS['cece']);

    // ── Sfondo Duck Hunt ────────────────────────────────────────────────────
    this.buildBackground();

    // Erba in primo piano (depth 20): oscura i bersagli nella fase di "rising"
    this.fgGrass = this.add.graphics().setDepth(20);
    this.drawForegroundGrass();

    // Pozzanghera ai piedi (depth 33: sopra le gambe di Umberto → sembra davanti a lui)
    this.puddleGfx = this.add.graphics().setDepth(33);
    this.renderPuddle();

    // ── Umberto mezzo busto ─────────────────────────────────────────────────
    this.umGfx  = this.add.graphics().setDepth(30);
    this.umArms = this.add.graphics().setDepth(31);
    this.drawUmberto();

    // Faccia di Umberto: usa portrait-umberto-png (chiave corretta da loadPortraits)
    const cx = W / 2, by = PLAYER_Y;
    const umKey = getPortraitKey(this, 'umberto');
    if (umKey) {
      // Testa grande (stile cartoon) su corpo compatto
      this.add.image(cx, by - 62, umKey)
        .setDisplaySize(42, 48)
        .setDepth(32);
    }

    // ── Graphics gioco ──────────────────────────────────────────────────────
    this.sprayGfx = this.add.graphics().setDepth(40);
    this.drunkGfx = this.add.graphics().setDepth(50);
    this.crossGfx = this.add.graphics().setDepth(60);

    // ── HUD ─────────────────────────────────────────────────────────────────
    this.scoreText = this.add.text(8 + UI_OFF_X, 8 + UI_OFF_Y, 'PUNTI: 0', {
      fontFamily: FONT, fontSize: '7px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(200);

    this.add.text(W - 8 + UI_OFF_X, 8 + UI_OFF_Y, `OBJ: ${GOAL}`, {
      fontFamily: FONT, fontSize: '7px', color: '#ffdd44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(200);

    // ── Barra "vescica": urgenza che cala col punteggio ──────────────────────
    this.add.text(W / 2 + UI_OFF_X, 6 + UI_OFF_Y, 'PIPÌ', {
      fontFamily: FONT, fontSize: '6px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);
    this.reliefGfx = this.add.graphics().setScrollFactor(0).setDepth(199);
    this.renderReliefBar();

    // ── Input ───────────────────────────────────────────────────────────────
    this.input.setDefaultCursor('none');

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.rawX = Phaser.Math.Clamp(wp.x, TGT_XMIN, TGT_XMAX);
      this.rawY = Phaser.Math.Clamp(wp.y, TGT_YMIN, GRASS_Y + 10);
    });

    this.input.on('pointerdown', () => {
      if (!this.started || this.finished) return;
      this.shoot();
    });

    // ESC per saltare il minigioco
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .on('down', () => {
        if (this.finished) return;
        this.finished = true;
        this.input.setDefaultCursor('default');
        this.cameras.main.setRotation(0);
        TransitionSystem.fadeToScene(this, 'CeceScene', { phase: 'after-pip' }, 600);
      });

    TransitionSystem.fadeFromBlack(this, 800);
    this.showIntro();
  }

  // ── INTRO ─────────────────────────────────────────────────────────────────

  private showIntro(): void {
    const cx = W / 2, cy = H / 2;
    const els: Phaser.GameObjects.GameObject[] = [];

    const veil = this.add.rectangle(cx, cy, W, H, 0x000000, 0.55).setDepth(99);
    els.push(veil);

    // Pannello
    const PW = 306, PH = 150;
    const x0 = cx - PW / 2, y0 = cy - PH / 2;
    const panel = this.add.graphics().setDepth(100);
    panel.fillStyle(0x14110a, 0.97); panel.fillRoundedRect(x0, y0, PW, PH, 10);
    panel.lineStyle(3, 0xffdd44, 1);  panel.strokeRoundedRect(x0, y0, PW, PH, 10);
    // Fascia rossa "emergenza" in cima
    panel.fillStyle(0xcc2222, 1); panel.fillRoundedRect(x0, y0, PW, 24, 10);
    panel.fillRect(x0, y0 + 14, PW, 10);
    panel.fillStyle(0x8a1414, 1); panel.fillRect(x0, y0 + 24, PW, 2);
    els.push(panel);

    // Titolo sulla fascia
    els.push(this.add.text(cx, y0 + 12, '!!  EMERGENZA PIPÌ  !!', {
      fontFamily: FONT, fontSize: '9px', color: '#ffffff',
      stroke: '#4a0000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102));

    // Goccia gialla (icona) a sinistra
    const dx = x0 + 40, dy = cy + 14;
    const drop = this.add.graphics().setDepth(101);
    drop.fillStyle(0xffdd44, 1);
    drop.fillCircle(dx, dy, 16);
    drop.fillTriangle(dx - 11, dy - 4, dx + 11, dy - 4, dx, dy - 32);
    drop.fillStyle(0xffeffa, 0.55); drop.fillEllipse(dx - 5, dy - 2, 5, 9);   // riflesso
    drop.fillStyle(0xd4a017, 0.6);  drop.fillEllipse(dx + 6, dy + 6, 5, 4);   // ombra
    els.push(drop);

    // Testo
    const tx = dx + 26;
    const rows = [
      { y: -34, txt: 'Umberto ha una necessità', col: '#ffffff', sz: '6px' },
      { y: -24, txt: 'URGENTISSIMA!',            col: '#ff6666', sz: '6px' },
      { y:  -6, txt: 'Punta il mirino e clicca', col: '#ffffff', sz: '6px' },
      { y:   4, txt: 'per sparare la pipì.',      col: '#ffdd44', sz: '6px' },
      { y:  22, txt: `Riempi la barra: ${GOAL} centri!`, col: '#66ff99', sz: '6px' },
    ];
    for (const r of rows) {
      els.push(this.add.text(tx, cy + r.y, r.txt, {
        fontFamily: FONT, fontSize: r.sz, color: r.col,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0, 0.5).setDepth(101));
    }

    const prompt = this.add.text(cx, y0 + PH - 12, '– CLICCA PER PISCIARE –', {
      fontFamily: FONT, fontSize: '7px', color: '#ffdd44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(101);
    els.push(prompt);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const startGame = (): void => {
      this.input.off('pointerdown', startGame);
      els.forEach(o => o.destroy());
      this.started   = true;
      this.startTime = this.time.now;
      AudioManager.get().playSFX(this, 'confirm', 0.6);
    };
    this.input.on('pointerdown', startGame);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    this.updateCrosshair(delta);

    if (!this.started || this.finished) {
      this.renderCrosshair();
      return;
    }

    // ── Spawn bersagli ──────────────────────────────────────────────────────
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.nextSpawn && this.targets.length < 5) {
      this.spawnTimer = 0;
      this.nextSpawn  = Phaser.Math.Between(
        Math.max(700,  2000 - Math.floor(this.diff * 1200)),
        Math.max(1200, 3000 - Math.floor(this.diff * 1800)),
      );
      this.spawnTarget(time);
    }

    // ── Allucinazione Cece ──────────────────────────────────────────────────
    if (time > this.nextCeceAt && !this.ceceActive && this.diff > 0.3) {
      this.spawnCece(time);
    }

    // ── Effetto ubriaco ─────────────────────────────────────────────────────
    if (time > this.nextDrunkAt) this.doDrunk(time);
    if (this.drunkIntensity > 0) {
      this.drunkIntensity -= delta / 6000;
      if (this.drunkIntensity < 0) this.drunkIntensity = 0;
      this.drunkWobble += delta * 0.003 * (1 + this.drunkIntensity * 3);
    }
    this.drunkFlash = Math.max(0, this.drunkFlash - delta / 600);

    // ── Aggiorna bersagli e grafica ─────────────────────────────────────────
    this.updateTargets(delta, time);

    // Difficoltà: blend punteggio + tempo → rampa più morbida (non solo a punti)
    const scoreDiff = this.score / GOAL;
    const timeDiff  = this.startTime ? Math.min(1, (time - this.startTime) / TIME_RAMP_MS) : 0;
    this.diff = Math.min(1, 0.62 * scoreDiff + 0.45 * timeDiff);

    // Rotazione camera "ubriaca" (0 quando sobrio)
    this.cameras.main.setRotation(
      this.drunkIntensity > 0 ? Math.sin(time / 500) * 0.03 * this.drunkIntensity : 0,
    );

    this.renderDrunkFx();
    this.renderCrosshair();
    this.animateUmberto(time);
  }

  private updateCrosshair(delta: number): void {
    const lag = Math.max(0.03, 0.14 - this.drunkIntensity * 0.11);
    const t   = 1 - Math.pow(1 - lag, delta / 16);
    this.crossX += (this.rawX - this.crossX) * t;
    this.crossY += (this.rawY - this.crossY) * t;
  }

  // ── DRUNK ─────────────────────────────────────────────────────────────────

  private doDrunk(time: number): void {
    this.drunkIntensity = 1;
    this.drunkFlash     = 0.6;
    this.nextDrunkAt    = time + Phaser.Math.Between(4000, 7000);
    AudioManager.get().playSFX(this, 'teleport', 0.3);

    const t = this.add.text(W / 2, H / 2 - 22, '...gira tutto...', {
      fontFamily: FONT, fontSize: '8px', color: '#ff88cc',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(55);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0,
      duration: 1500, delay: 300, onComplete: () => t.destroy() });
  }

  // ── SPAWN ─────────────────────────────────────────────────────────────────

  /**
   * Fisica Duck Hunt:
   * - Spawn dal centro basso dell'erba (centro 60% della larghezza)
   * - Velocità diagonale verso l'alto con componente orizzontale randomica
   * - Angolo variabile per creature (rane più verticali, uccelli più orizzontali)
   */
  private spawnTarget(_time: number): void {
    const pool = DEFS.filter(d => d.kind !== 'cece' && d.minDiff <= this.diff);
    const def  = pool[Math.floor(Math.random() * pool.length)];
    const dir  = Math.random() < 0.5 ? 1 : -1;

    // Spawn dalla zona centrale dell'erba (come Duck Hunt originale)
    const x = W * 0.2 + Math.random() * W * 0.6;

    // Velocità scalata con la difficoltà
    const spd = def.baseSpd + (def.maxSpd - def.baseSpd) * this.diff;
    const ang = ((def.angleMin + Math.random() * (def.angleMax - def.angleMin)) * Math.PI) / 180;
    const vx  = spd * Math.cos(ang) * dir;
    const vy  = -spd * Math.sin(ang);  // negativo = verso l'alto

    const gfx = this.add.graphics().setDepth(10);
    const t: Target = {
      def, gfx,
      x, y: GRASS_Y + 25,  // sotto la copertura terra (depth 20)
      vx, vy,
      phase: 'rising',
      visibleUntil: 0,
      angle: Math.random() * Math.PI * 2,
      erraticTimer: Phaser.Math.Between(400, 900),
    };
    this.targets.push(t);
  }

  /**
   * Allucinazione Cece: usa portrait-cece image, emerge dall'erba con
   * fisica diagonale identica agli altri bersagli.
   */
  private spawnCece(now: number): void {
    this.ceceActive = true;
    this.nextCeceAt = now + Phaser.Math.Between(12000, 20000);
    AudioManager.get().playSFX(this, 'teleport', 0.35);

    const def = DEFS.find(d => d.kind === 'cece')!;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x   = W * 0.25 + Math.random() * W * 0.5;

    const spd = def.baseSpd + (def.maxSpd - def.baseSpd) * this.diff;
    const ang = ((def.angleMin + Math.random() * (def.angleMax - def.angleMin)) * Math.PI) / 180;
    const vx  = spd * Math.cos(ang) * dir;
    const vy  = -spd * Math.sin(ang);

    // Cece: usa lo stesso sprite char-cece delle altre scene (chibi con foto incorporata).
    // CHAR_SCALE=0.5 → frame 24×34 px. Scale 2.5 → 60×85 display px, leggibile.
    // Spawna a GRASS_Y+42 così il top dello sprite (GRASS_Y+42-42=GRASS_Y) è
    // coperto dalla copertura terra (depth 20 > depth 15) e emerge gradualmente.
    const gfx = this.add.graphics().setDepth(14);  // non disegna nulla per Cece

    // Scale 1.0 → 48×68 world px (texture è 48×68 texel con TEXEL=2).
    // La faccia è embedded a 44×38 world px — leggibile. Scale > 1 la pixela.
    const sprite = this.add.sprite(x, GRASS_Y + 35, 'char-cece')
      .setScale(1.0)
      .setDepth(15)
      .setFlipX(dir < 0);
    sprite.play('cece-walk-down');  // 'up' = di spalle (testa nera), 'down' = faccia verso il giocatore

    const bubble = this.add.text(x, GRASS_Y - 40,
      'ciao umberto!\nnon pisciarmi\ndavanti casa!', {
        fontFamily: FONT, fontSize: '5px', color: '#ffffff',
        stroke: '#0000aa', strokeThickness: 3,
        backgroundColor: '#2233aa',
        padding: { x: 4, y: 3 }, align: 'center',
      }
    ).setOrigin(0.5, 1).setDepth(17).setAlpha(0);

    const t: Target = {
      def, gfx, sprite, bubble,
      x, y: GRASS_Y + 35,  // sottoterra, nascosta dalla copertura (depth 20)
      vx, vy,
      phase: 'rising',
      visibleUntil: 0,
      angle: 0,
      erraticTimer: 0,
    };
    this.targets.push(t);
  }

  // ── UPDATE TARGETS ────────────────────────────────────────────────────────

  private updateTargets(delta: number, time: number): void {
    const dt = delta / 1000;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];

      // ── Colpito: distruggi il frame dopo ──────────────────────────────────
      if (t.phase === 'hit') {
        this.destroyTarget(t);
        this.targets.splice(i, 1);
        continue;
      }

      // ── Flyaway: vola dritto verso l'alto (Duck Hunt "FLY AWAY") ─────────
      if (t.phase === 'flyaway') {
        t.vy  = Math.min(t.vy - 80 * dt, -180);
        t.y  += t.vy * dt;
        t.x  += t.vx * dt;
        if (t.y < -60) {
          if (t.def.kind === 'cece') this.ceceActive = false;
          this.destroyTarget(t);
          this.targets.splice(i, 1);
          continue;
        }
        this.renderTarget(t);
        continue;
      }

      // ── Fisica: rising + visible ──────────────────────────────────────────
      t.y  += t.vy * dt;
      t.x  += t.vx * dt;
      t.angle += dt * (t.def.kind === 'fly' ? 8 : t.def.kind === 'butterfly' ? 5 : 3);

      // Farfalla: ondulazione sinusoidale della componente verticale
      if (t.def.kind === 'butterfly' && t.phase === 'visible') {
        t.vy += Math.sin(t.angle * 1.8) * 80 * dt;
        t.vy  = Phaser.Math.Clamp(t.vy, -140, -10);
      }

      // Moschino/mosca: inversione erratica di vx
      if (t.def.erratic && t.phase === 'visible') {
        t.erraticTimer -= delta;
        if (t.erraticTimer <= 0) {
          t.vx *= -1;
          if (Math.random() < 0.3) t.vy = -Math.abs(t.vy) * (0.7 + Math.random() * 0.6);
          t.erraticTimer = Phaser.Math.Between(300, 800);
        }
      }

      // ── Rimbalzo sui bordi (come Duck Hunt) ───────────────────────────────
      if (t.x < TGT_XMIN) { t.x = TGT_XMIN; t.vx =  Math.abs(t.vx); }
      if (t.x > TGT_XMAX) { t.x = TGT_XMAX; t.vx = -Math.abs(t.vx); }
      if (t.y < TGT_YMIN && t.vy < 0) { t.y = TGT_YMIN; t.vy = Math.abs(t.vy) * 0.65; }

      // ── Transizione rising → visible (uscita dall'erba) ───────────────────
      if (t.phase === 'rising' && t.y < GRASS_Y - 5) {
        t.phase = 'visible';
        t.visibleUntil = time + this.visibleDuration();
        if (t.def.kind === 'cece') {
          this.tweens.add({ targets: t.bubble, alpha: 1, duration: 250 });
        }
      }

      // ── Timeout → flyaway (Duck Hunt: la bestia "scappa" verso l'alto) ────
      if (t.phase === 'visible' && time > t.visibleUntil) {
        t.phase = 'flyaway';
        t.vy    = -150;
        if (t.def.kind === 'cece') {
          this.tweens.add({ targets: t.bubble, alpha: 0, duration: 200 });
        } else {
          Juice.popText(this, t.x, Math.max(24, t.y - 14), 'FLY AWAY!', '#ffffff', 6);
        }
      }

      this.renderTarget(t);
    }
  }

  /** Durata della fase visible, decresce con la difficoltà. */
  private visibleDuration(): number {
    return Phaser.Math.Between(
      Math.max(800,  2500 - Math.floor(this.diff * 1500)),
      Math.max(1300, 3500 - Math.floor(this.diff * 2000)),
    );
  }

  /** Aggiorna posizione grafica del bersaglio ogni frame. */
  private renderTarget(t: Target): void {
    if (t.def.kind === 'cece') {
      // Sprite char-cece (stesso delle altre scene) — aggiorna posizione ogni frame.
      // La bubble va sopra la testa: sprite alto 85px, testa ≈ top 20px → -42px
      t.sprite?.setPosition(t.x, t.y);
      t.bubble?.setPosition(t.x, t.y - 40);  // 34px (metà sprite) + 6px sopra
      t.gfx.clear();  // gfx non usato per Cece
    } else {
      t.gfx.clear();
      t.gfx.setPosition(t.x, t.y);
      this.drawShape(t.gfx, t.def, t.angle, t.vx);
    }
  }

  private destroyTarget(t: Target): void {
    t.gfx.destroy();
    t.image?.destroy();
    t.sprite?.destroy();
    t.bubble?.destroy();
  }

  // ── SHOOT ─────────────────────────────────────────────────────────────────

  private shoot(): void {
    // Cooldown: niente spam-click, ogni colpo deve contare
    if (this.time.now - this.lastShot < FIRE_COOLDOWN) return;
    this.lastShot = this.time.now;

    const wobR = this.drunkIntensity * 12;
    const aimX = this.crossX + Math.sin(this.drunkWobble) * wobR;
    const aimY = this.crossY + Math.cos(this.drunkWobble * 0.7) * wobR * 0.6;

    this.showSpray(aimX, aimY);
    AudioManager.get().playSFX(this, 'pee', 0.45);   // "psss" ad ogni colpo di pipì

    let hit: Target | null = null;
    let best = Infinity;
    for (const t of this.targets) {
      if (t.phase !== 'visible') continue;
      const dx = t.x - aimX, dy = t.y - aimY;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d <= t.def.hitR + 6 && d < best) { best = d; hit = t; }
    }

    if (hit) {
      this.doHit(hit, aimX, aimY);
    } else {
      // Schizzo di pipì: goccia centrale + anello di increspatura che si allarga
      const sp = this.add.graphics().setDepth(45).setPosition(aimX, aimY);
      sp.fillStyle(0xffdd44, 0.7);
      sp.fillCircle(0, 0, 5);
      this.tweens.add({ targets: sp, alpha: 0, scaleX: 2.2, scaleY: 2.2,
        duration: 360, onComplete: () => sp.destroy() });

      const ring = this.add.graphics().setDepth(44).setPosition(aimX, aimY);
      ring.lineStyle(1.5, 0xffe680, 0.85);
      ring.strokeEllipse(0, 0, 9, 5);
      this.tweens.add({ targets: ring, alpha: 0, scaleX: 3.2, scaleY: 3.2,
        duration: 440, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
  }

  private doHit(t: Target, aimX: number, aimY: number): void {
    if (t.def.kind === 'cece') {
      this.score = Math.max(0, this.score - 1);
      this.ceceActive = false;
      // Cece: distruzione immediata (non aspettiamo il loop)
      this.destroyTarget(t);
      this.targets.splice(this.targets.indexOf(t), 1);

      // Penalità "che sbaglio!": SFX stonato + scossone rosso + hit-stop
      AudioManager.get().playSFX(this, 'scontro', 0.5);
      Juice.hitStop(this, 80);
      this.cameras.main.shake(180, 0.009);
      Juice.burst(this, aimX, aimY, [0xff4444, 0x6ab0ff], 12);

      const msg = this.add.text(aimX, aimY - 8, 'CECE!\n-1', {
        fontFamily: FONT, fontSize: '9px', color: '#ff4444',
        stroke: '#000000', strokeThickness: 4, align: 'center',
      }).setOrigin(0.5).setDepth(60);
      this.tweens.add({ targets: msg, y: msg.y - 25, alpha: 0,
        duration: 1000, onComplete: () => msg.destroy() });
      this.renderReliefBar();
      this.renderPuddle();
    } else {
      this.score += t.def.points;
      t.phase = 'hit';  // il loop distrugge il frame successivo

      // Posiziona il Graphics sul bersaglio, disegna le particelle a (0,0) locale
      // così il tween scaleX/scaleY le espande correttamente attorno al punto d'impatto
      const b = this.add.graphics().setDepth(45).setPosition(t.x, t.y);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.fillStyle(t.def.color, 0.9);
        b.fillCircle(Math.cos(a) * 10, Math.sin(a) * 10, 3);
      }
      this.tweens.add({ targets: b, alpha: 0, scaleX: 1.8, scaleY: 1.8,
        duration: 320, onComplete: () => b.destroy() });

      // Juice: peso all'impatto (particelle a tema, hit-stop breve, micro-shake)
      Juice.burst(this, t.x, t.y, [t.def.color, t.def.color2], 10);
      if (t.def.kind === 'bird') Juice.burst(this, t.x, t.y, [0xffffff, 0xdddddd], 8);
      Juice.hitStop(this, 45);
      this.cameras.main.shake(70, 0.0035);

      // SFX: tintinnio positivo del punto guadagnato
      AudioManager.get().playSFX(this, 'coin', 0.5);

      const pts = this.add.text(t.x, t.y - 8, `+${t.def.points}`, {
        fontFamily: FONT, fontSize: '10px', color: '#ffdd44',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(60);
      this.tweens.add({ targets: pts, y: pts.y - 26, alpha: 0,
        duration: 850, onComplete: () => pts.destroy() });

      this.splashPuddle();
      this.renderReliefBar();
    }

    this.scoreText.setText(`PUNTI: ${this.score}`);
    if (this.score >= GOAL && !this.finished) this.win();
  }

  private showSpray(tx: number, ty: number): void {
    const sx = W / 2, sy = PLAYER_Y - 18;   // cavallo di Umberto
    this.sprayGfx.clear();

    // Getto ad ARCO (Bézier quadratica: base → punto di controllo in alto → bersaglio),
    // più spesso alla base, con gocce laterali sparse.
    const mx = (sx + tx) / 2;
    const my = Math.min(sy, ty) - 22;       // apice dell'arco sopra i due estremi
    const N = 18;
    for (let i = 0; i <= N; i++) {
      const p = i / N, q = 1 - p;
      const px = q * q * sx + 2 * q * p * mx + p * p * tx;
      const py = q * q * sy + 2 * q * p * my + p * p * ty;
      this.sprayGfx.fillStyle(0xffe25a, 0.95 - p * 0.35);
      this.sprayGfx.fillCircle(px, py, Math.max(0.7, 3.3 - p * 2.4));
      if (i % 3 === 0) {                     // schizzi laterali
        this.sprayGfx.fillStyle(0xffd23a, 0.5);
        this.sprayGfx.fillCircle(px + Phaser.Math.Between(-3, 3), py + Phaser.Math.Between(-2, 2), 1);
      }
    }
    // Splash sul punto d'impatto
    this.sprayGfx.fillStyle(0xffe25a, 0.85);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      this.sprayGfx.fillCircle(tx + Math.cos(a) * 4, ty + Math.sin(a) * 4, 1.4);
    }

    this.tweens.add({
      targets: this.sprayGfx, alpha: 0, duration: 300,
      onComplete: () => { this.sprayGfx.clear(); this.sprayGfx.setAlpha(1); },
    });
  }

  // ── VITTORIA ──────────────────────────────────────────────────────────────

  private win(): void {
    this.finished = true;
    this.input.setDefaultCursor('default');
    this.cameras.main.setRotation(0);
    AudioManager.get().playSFX(this, 'fanfare', 0.6);
    Juice.confetti(this, 70);

    const cx = W / 2, cy = H / 2;
    const els: Phaser.GameObjects.GameObject[] = [];

    const veil = this.add.rectangle(cx, cy, W, H, 0x000000, 0.5).setDepth(99);
    els.push(veil);

    const PW = 300, PH = 118;
    const x0 = cx - PW / 2, y0 = cy - PH / 2;
    const panel = this.add.graphics().setDepth(100);
    panel.fillStyle(0x0d140c, 0.97); panel.fillRoundedRect(x0, y0, PW, PH, 10);
    panel.lineStyle(3, 0x66ff99, 1);  panel.strokeRoundedRect(x0, y0, PW, PH, 10);
    panel.fillStyle(0x1f8a3a, 1); panel.fillRoundedRect(x0, y0, PW, 24, 10); panel.fillRect(x0, y0 + 14, PW, 10);
    panel.fillStyle(0x0f5a24, 1); panel.fillRect(x0, y0 + 24, PW, 2);
    els.push(panel);

    els.push(this.add.text(cx, y0 + 12, 'SOLLIEVO TOTALE', {
      fontFamily: FONT, fontSize: '8px', color: '#ffffff', stroke: '#08320f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102));

    // Goccia felice (sollevata) a sinistra
    const dx = x0 + 40, dy = cy + 12;
    const drop = this.add.graphics().setDepth(101);
    drop.fillStyle(0xffe25a, 1); drop.fillCircle(dx, dy, 15);
    drop.fillTriangle(dx - 10, dy - 3, dx + 10, dy - 3, dx, dy - 28);
    drop.fillStyle(0xfff2a8, 0.5); drop.fillEllipse(dx - 5, dy - 2, 4, 8);
    drop.fillStyle(0x2a1e00, 1);
    drop.fillRect(dx - 6, dy - 1, 3, 1); drop.fillRect(dx + 3, dy - 1, 3, 1);   // occhi chiusi ^^
    drop.fillRect(dx - 4, dy + 4, 2, 1); drop.fillRect(dx + 2, dy + 4, 2, 1);
    drop.fillRect(dx - 2, dy + 5, 4, 1);                                          // sorriso
    els.push(drop);

    const tx = dx + 26;
    els.push(this.add.text(tx, cy - 8, 'PISCIATA EFFETTUATA!', {
      fontFamily: FONT, fontSize: '7px', color: '#66ff99', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(101));
    els.push(this.add.text(tx, cy + 6, 'Umberto si sente un altro.', {
      fontFamily: FONT, fontSize: '6px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(101));
    els.push(this.add.text(tx, cy + 18, `Centri: ${this.score}`, {
      fontFamily: FONT, fontSize: '6px', color: '#ffdd44', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(101));

    els.forEach(o => (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0));
    this.tweens.add({ targets: els, alpha: 1, duration: 500, delay: 200 });
    this.time.delayedCall(2800, () =>
      TransitionSystem.fadeToScene(this, 'CeceScene', { phase: 'after-pip' }, 1000)
    );
  }

  // ── SFONDO DUCK HUNT (NES-accurate + muretto) ────────────────────────────
  // Palette NES: sky=0x5c94fc, grass bright=0x54fc54, grass mid=0x00a800,
  // earth=0x7b5000, cloud=0xfcfcfc, trunk=0x6b3100

  private buildBackground(): void {
    const KEY = 'tex-pip-bg-v6';
    if (this.textures.exists(KEY)) {
      this.add.image(0, 0, KEY).setOrigin(0).setDepth(-20);
      return;
    }

    const g = this.make.graphics();

    // ── Cielo NES blu ─────────────────────────────────────────────────────
    g.fillStyle(0x5c94fc);
    g.fillRect(0, 0, W, H);

    // ── Nuvole blocky NES (bianco pieno, forma a "fungo" con 3 livelli) ───
    const drawCloud = (ncx: number, cy: number, cw: number, ch: number): void => {
      g.fillStyle(0xfcfcfc);
      g.fillRect(ncx - cw / 2,     cy,             cw,       ch);        // base piatta
      g.fillRect(ncx - cw * 0.33,  cy - ch * 0.8,  cw * 0.66, ch * 0.9); // gobba centrale
      g.fillRect(ncx - cw * 0.12,  cy - ch * 1.5,  cw * 0.3,  ch * 0.6); // cupola
      // Ombra sotto la nuvola (grigio NES)
      g.fillStyle(0xbcbcbc);
      g.fillRect(ncx - cw / 2 + 2, cy + ch - 2, cw - 4, 3);
    };
    drawCloud(72,  26, 72, 20);
    drawCloud(212, 15, 90, 18);
    drawCloud(332, 30, 60, 16);
    drawCloud(428, 18, 70, 19);

    // ── Muretto in mattoni — larghezza totale, dietro albero e cespuglio ──
    const WX = 0, WY = 135, WW = W, WH = GRASS_Y - WY + 6;
    // Sfondo malta (mortaio caldo)
    g.fillStyle(0x9b7e5a);
    g.fillRect(WX, WY, WW, WH);
    // Mattoni a correre (pattern alternato 2 colori)
    const B_ROW = 11, B_W = 17, B_H = 9, B_COL = 19;
    const BRICK_COLORS = [0xcc6e38, 0xb85828, 0xd07844, 0xaa5020] as const;
    for (let row = 0; row * B_ROW < WH + B_ROW; row++) {
      const ry = WY + row * B_ROW;
      if (ry + B_H > WY + WH) break;
      const off = row % 2 === 0 ? 0 : Math.floor(B_W / 2) + 1;
      for (let col = -1; col * B_COL + off < WW + B_COL; col++) {
        const bx  = WX + col * B_COL + off;
        const bxA = Math.max(bx, WX);
        const bxB = Math.min(bx + B_W, WX + WW);
        if (bxB <= bxA) continue;
        const bw    = bxB - bxA;
        const baseC = BRICK_COLORS[((row + col + 4) % BRICK_COLORS.length)];
        g.fillStyle(baseC);
        g.fillRect(bxA, ry, bw, B_H);
        g.fillStyle(0xe08858);
        g.fillRect(bxA, ry, bw, 2);                    // highlight top
        g.fillStyle(0x7a3a10);
        g.fillRect(bxA,     ry + B_H - 2, bw, 2);     // ombra basso
        g.fillRect(bxB - 2, ry + 2,        2, B_H - 4); // ombra destra
      }
    }
    // Cornicione superiore del muro (linea continua piena larghezza)
    g.fillStyle(0x6a4020);
    g.fillRect(WX, WY - 5, WW, 7);
    g.fillStyle(0x8a5828);
    g.fillRect(WX, WY - 5, WW, 3);   // highlight cornicione

    // ── Albero sinistro grande (stile Duck Hunt) ───────────────────────────
    const TX = 76, TY_TOP = 110;
    // Tronco con dettaglio corteccia
    g.fillStyle(0x6b3100);
    g.fillRect(TX - 10, TY_TOP, 20, GRASS_Y - TY_TOP);
    g.fillStyle(0x422100);
    g.fillRect(TX + 5,  TY_TOP, 5,  GRASS_Y - TY_TOP); // ombra dx
    g.fillStyle(0x8b4a18);
    g.fillRect(TX - 10, TY_TOP, 4,  GRASS_Y - TY_TOP); // riflesso sx
    // Radici allargate
    g.fillStyle(0x422100);
    g.fillRect(TX - 18, GRASS_Y - 12, 36, 14);
    g.fillStyle(0x6b3100);
    g.fillRect(TX - 14, GRASS_Y - 12, 28, 10);

    // Chioma: 3 sfere con 3 livelli di colore ciascuna (ombra→mid→highlight)
    const drawFoliage = (fx: number, fy: number, r: number): void => {
      g.fillStyle(0x015200); g.fillCircle(fx + 2, fy + 2, r);       // ombra
      g.fillStyle(0x027300); g.fillCircle(fx + 1, fy + 1, r);       // bordo scuro
      g.fillStyle(0x00a800); g.fillCircle(fx, fy, r - 2);           // verde base
      g.fillStyle(0x54fc54); g.fillCircle(fx - 4, fy - 4, r - 10); // highlight
    };
    drawFoliage(TX + 1,  TY_TOP + 8,  50);
    drawFoliage(TX - 8,  TY_TOP - 14, 42);
    drawFoliage(TX + 3,  TY_TOP - 36, 30);

    // ── Cespuglio destra con più definizione ──────────────────────────────
    const drawBush = (bx: number, by2: number, r: number): void => {
      g.fillStyle(0x015200); g.fillCircle(bx + 2, by2 + 2, r);
      g.fillStyle(0x027300); g.fillCircle(bx + 1, by2 + 1, r);
      g.fillStyle(0x00a800); g.fillCircle(bx, by2, r - 2);
      g.fillStyle(0x54fc54); g.fillCircle(bx - 3, by2 - 4, r - 8);
    };
    const GY2 = GRASS_Y - 2;
    drawBush(422, GY2 - 16, 38);
    drawBush(450, GY2 - 10, 26);
    drawBush(396, GY2 - 8,  22);

    // ── Terra marrone sotto l'erba ────────────────────────────────────────
    g.fillStyle(0x7b5000);
    g.fillRect(0, GRASS_Y + 6, W, H - GRASS_Y - 6);
    // Texture terreno: piccole pietre
    g.fillStyle(0x9a6820);
    for (let px = 14; px < W; px += 28) {
      g.fillEllipse(px + ((px * 7) % 14), GRASS_Y + 14, 8, 4);
      g.fillEllipse(px + 12 + ((px * 3) % 10), GRASS_Y + 28, 6, 3);
    }
    // Linea separazione erba/terra (scura)
    g.fillStyle(0x422100);
    g.fillRect(0, GRASS_Y + 4, W, 4);

    // ── Banda erba base ───────────────────────────────────────────────────
    g.fillStyle(0x00a800);
    g.fillRect(0, GRASS_Y - 2, W, 12);
    g.fillStyle(0x54fc54);
    g.fillRect(0, GRASS_Y - 2, W, 4);

    g.generateTexture(KEY, W, H);
    g.destroy();
    this.add.image(0, 0, KEY).setOrigin(0).setDepth(-20);
  }

  /**
   * Erba in primo piano (depth 20) — si sovrappone ai bersagli durante la fase
   * 'rising', creando l'effetto Duck Hunt in cui le creature emergono dall'erba.
   * Usa 3 strati di lame triangolari di diverse altezze e sfumature.
   */
  /**
   * Erba in primo piano stile Duck Hunt: lame spesse e alte che oscurano
   * i bersagli nella fase "rising". 4 strati per profondità e definizione.
   */
  private drawForegroundGrass(): void {
    const g = this.fgGrass;
    g.clear();
    const GR = GRASS_Y;

    // ── Copertura terra: nasconde i bersagli mentre sono sottoterra ──────────
    // depth 20 > depth 10 (bersagli), ma < depth 30 (Umberto) → Umberto visibile
    g.fillStyle(0x422100);  // separatore erba/terra (come background)
    g.fillRect(0, GR + 4, W, 4);
    g.fillStyle(0x7b5000);  // terra (colore identico al background)
    g.fillRect(0, GR + 8, W, H - GR - 8);

    // ── Strato 0 – lame altissime posteriori (verde scurissimo, dietro tutto) ──
    g.fillStyle(0x014d00);
    for (let x = 0; x < W; x += 9) {
      const h  = ((x * 17 + 11) % 22) + 22;  // 22–44px – i più alti
      const bx = x + ((x * 5) % 7) - 3;
      g.fillTriangle(bx - 4, GR + 10, bx + 4, GR + 10, bx, GR + 10 - h);
    }

    // ── Strato 1 – lame alte scure ────────────────────────────────────────
    g.fillStyle(0x027300);
    for (let x = 2; x < W; x += 6) {
      const h  = ((x * 13 + 7) % 18) + 16;   // 16–34px
      const bx = x + ((x * 3) % 5) - 2;
      g.fillTriangle(bx - 4, GR + 9, bx + 4, GR + 9, bx, GR + 9 - h);
    }

    // ── Strato 2 – lame medie (verde NES principale) ──────────────────────
    g.fillStyle(0x00a800);
    for (let x = 1; x < W; x += 5) {
      const h  = ((x * 19 + 3) % 16) + 10;   // 10–26px
      const bx = x + ((x * 11) % 5) - 2;
      g.fillTriangle(bx - 3, GR + 8, bx + 3, GR + 8, bx, GR + 8 - h);
    }

    // ── Strato 3 – lame corte brillanti in primo piano ────────────────────
    g.fillStyle(0x54fc54);
    for (let x = 3; x < W; x += 7) {
      const h  = ((x * 11 + 9) % 12) + 7;    // 7–19px
      const bx = x + ((x * 7) % 6) - 3;
      g.fillTriangle(bx - 3, GR + 7, bx + 3, GR + 7, bx, GR + 7 - h);
    }

    // ── Banda base solida (copre le radici delle lame, colore compatto) ───
    g.fillStyle(0x027300);
    g.fillRect(0, GR + 4, W, 8);
    g.fillStyle(0x00a800);
    g.fillRect(0, GR + 4, W, 5);
    g.fillStyle(0x54fc54);
    g.fillRect(0, GR + 4, W, 2);
  }

  // ── UMBERTO MEZZO BUSTO ───────────────────────────────────────────────────
  // Corpo procedurale; la FACCIA viene aggiunta come portrait-umberto in create().

  private drawUmberto(): void {
    const cx = W / 2, by = PLAYER_Y;
    const HAIR = 0x221100, SHIRT = 0xcc4400, PANTS = 0x1a3355;

    this.umGfx.clear();
    const g = this.umGfx;

    // ── Gambe / pantalone (corpo compatto) ──────────────────────────────────
    g.fillStyle(PANTS);
    g.fillRect(cx - 13, by - 2, 26, H - by + 4);
    // Separazione gambe
    g.fillStyle(0x122035);
    g.fillRect(cx - 1, by - 2, 2, H - by + 4);

    // Cintura sottile
    g.fillStyle(0x331100);
    g.fillRect(cx - 15, by - 7, 30, 6);
    g.fillStyle(0x885500);
    g.fillRect(cx - 4, by - 7, 8, 6);  // fibbia

    // Torso (compatto, 28px spalla — si estende fino sotto la testa, no collo)
    g.fillStyle(SHIRT);
    g.fillRect(cx - 14, by - 42, 28, 38);
    // Ombra laterale torso
    g.fillStyle(0x991f00, 0.45);
    g.fillRect(cx + 11, by - 42, 3, 38);
    g.fillRect(cx - 14, by - 42, 3, 38);

    // Capelli (banda sopra il portrait, larghezza ~42px come la testa)
    g.fillStyle(HAIR);
    g.fillRect(cx - 21, by - 89, 42, 8);   // banda superiore capelli
    g.fillRect(cx - 22, by - 83, 5, 10);   // basetta sx
    g.fillRect(cx + 17, by - 83, 5, 10);   // basetta dx

    // Ombra a terra
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(cx, H - 2, 44, 7);
  }

  private animateUmberto(time: number): void {
    const cx = W / 2, by = PLAYER_Y;
    const sw  = Math.sin(time / 700) * 5;
    const SHIRT = 0xcc4400, SKIN = 0xffcc99;

    this.umArms.clear();
    // Braccio sinistro (attaccato al torso a cx-14)
    this.umArms.fillStyle(SHIRT);
    this.umArms.fillRect(cx - 25, by - 34 + sw, 12, 22);
    this.umArms.fillStyle(SKIN);
    this.umArms.fillRect(cx - 25, by - 12 + sw, 12, 9);
    // Braccio destro (attaccato a cx+14)
    this.umArms.fillStyle(SHIRT);
    this.umArms.fillRect(cx + 13, by - 34 - sw, 12, 22);
    this.umArms.fillStyle(SKIN);
    this.umArms.fillRect(cx + 13, by - 12 - sw, 12, 9);
  }

  // ── FORME BERSAGLI (pixel-art procedurale) ────────────────────────────────

  private drawShape(g: Phaser.GameObjects.Graphics, def: TargetDef, angle: number, vx: number): void {
    const c1 = def.color, c2 = def.color2;

    switch (def.kind) {

      case 'frog':
        g.fillStyle(c1);   g.fillEllipse(0,  0, 20, 14);
        g.fillStyle(c2);   g.fillEllipse(0, -3, 12,  7);
        g.fillStyle(0xffffff); g.fillCircle(-5, -5, 3); g.fillCircle(5, -5, 3);
        g.fillStyle(0x000000); g.fillCircle(-5, -5, 2); g.fillCircle(5, -5, 2);
        g.fillStyle(c1); g.fillRect(-12, 4, 7, 4); g.fillRect(5, 4, 7, 4);
        break;

      case 'cricket':
        g.fillStyle(c1); g.fillEllipse(0, 0, 14, 9);
        g.fillStyle(c2); g.fillRect(-3, -7, 6, 7);
        g.lineStyle(1, c2, 0.9);
        g.lineBetween(-2, -8, -7, -15); g.lineBetween(2, -8, 7, -15);
        g.lineStyle(1, c1, 1);
        g.lineBetween(-7, 2, -12, 8); g.lineBetween(7, 2, 12, 8);
        break;

      case 'butterfly': {
        const flap = Math.abs(Math.cos(angle * 4)) * 10;
        g.fillStyle(c1, 0.85);
        g.fillTriangle(-2, 0, -16 - flap, -12, -12, 4);
        g.fillTriangle( 2, 0,  16 + flap, -12,  12, 4);
        g.fillStyle(c2, 0.6);
        g.fillTriangle(-2, 0, -10, -7, -7, 5);
        g.fillTriangle( 2, 0,  10, -7,  7, 5);
        g.fillStyle(0x443322); g.fillEllipse(0, 0, 4, 10);
        break;
      }

      case 'mosquito':
        g.fillStyle(c1); g.fillEllipse(0, 0, 5, 12);
        g.fillStyle(0xaaaacc, 0.5);
        g.fillEllipse(-6, -3, 11, 5); g.fillEllipse(6, -3, 11, 5);
        g.lineStyle(1, 0x555555); g.lineBetween(0, 6, 0, 13);
        g.lineStyle(1, c2, 0.8);
        for (let j = -1; j <= 1; j++) {
          g.lineBetween(-2, j * 3, -9, j * 3 + 3);
          g.lineBetween( 2, j * 3,  9, j * 3 + 3);
        }
        break;

      case 'bird': {
        const fl = vx >= 0 ? 1 : -1;
        g.fillStyle(0xffffff); g.fillEllipse(-4 * fl, -1, 18, 11);
        g.fillStyle(c2); g.fillCircle(-11 * fl, -4, 6);
        g.fillStyle(0xffaa00);
        g.fillTriangle(-14 * fl, -4, -11 * fl, -2, -11 * fl, -6);
        g.fillStyle(0xdddddd);
        g.fillTriangle(2 * fl, -1, 18 * fl, -14, 18 * fl, 2);
        g.fillStyle(0x222244);
        g.fillTriangle(14 * fl, -10, 18 * fl, -14, 18 * fl, -4);
        g.fillStyle(0xff3300); g.fillCircle(-12 * fl, -5, 2);
        g.fillStyle(0x000000); g.fillCircle(-12 * fl, -5, 1);
        break;
      }

      case 'fly':
        g.fillStyle(c1); g.fillEllipse(0, 0, 9, 7);
        g.fillStyle(0x111111); g.fillCircle(0, -3, 3);
        g.fillStyle(0xbbbbdd, 0.6);
        g.fillEllipse(-6, -1, 9, 4); g.fillEllipse(6, -1, 9, 4);
        g.fillStyle(0xff2200, 0.8); g.fillCircle(-1, -4, 1.5); g.fillCircle(1, -4, 1.5);
        break;

      default:
        g.fillStyle(0xff00ff); g.fillCircle(0, 0, 8);
    }
  }

  // ── HUD BARRA VESCICA + POZZANGHERA ───────────────────────────────────────

  /** Barra "urgenza pipì": piena e rossa a inizio, si svuota e diventa verde. */
  private renderReliefBar(): void {
    const g = this.reliefGfx;
    g.clear();
    const BARW = 108, BARH = 8;
    const x0 = Math.round(W / 2 - BARW / 2) + UI_OFF_X;
    const y0 = 15 + UI_OFF_Y;
    const frac = Phaser.Math.Clamp(1 - this.score / GOAL, 0, 1);  // 1 = urgenza max

    g.fillStyle(0x000000, 0.6); g.fillRect(x0 - 2, y0 - 2, BARW + 4, BARH + 4);
    g.fillStyle(0x1c1a12, 1);   g.fillRect(x0, y0, BARW, BARH);

    // colore rosso (urgente) → verde (sollievo)
    const r  = Math.round(0x44 + (0xff - 0x44) * frac);
    const gr = Math.round(0xdd - (0xdd - 0x44) * frac);
    const col = (r << 16) | (gr << 8) | 0x44;
    const fw  = Math.max(0, Math.round(BARW * frac));
    g.fillStyle(col, 1);        g.fillRect(x0, y0, fw, BARH);
    g.fillStyle(0xffffff, 0.28); g.fillRect(x0, y0, fw, 2);  // luce superiore
  }

  /** Pozzanghera ai piedi di Umberto: raggio proporzionale al punteggio. */
  private renderPuddle(): void {
    const g = this.puddleGfx;
    g.clear();
    const frac = Phaser.Math.Clamp(this.score / GOAL, 0, 1);
    const rw = 10 + frac * 64;
    const rh = 4  + frac * 8;
    const cx = W / 2, cy = H - 3;
    g.fillStyle(0xb8860b, 0.55); g.fillEllipse(cx, cy, rw + 5, rh + 3);
    g.fillStyle(0xf2c53d, 0.7);  g.fillEllipse(cx, cy, rw, rh);
    g.fillStyle(0xfff2a8, 0.6);  g.fillEllipse(cx - rw * 0.22, cy - 1, rw * 0.4, rh * 0.4);
  }

  /** Ridisegna la pozzanghera + increspatura animata a ogni colpo a segno. */
  private splashPuddle(): void {
    this.renderPuddle();
    const ring = this.add.graphics().setDepth(34).setPosition(W / 2, H - 3);
    ring.lineStyle(1, 0xfff2a8, 0.8);
    ring.strokeEllipse(0, 0, 12, 5);
    this.tweens.add({ targets: ring, scaleX: 2.6, scaleY: 2.6, alpha: 0,
      duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  // ── MIRINO DUCK HUNT (quadrato) ───────────────────────────────────────────

  private renderCrosshair(): void {
    const wobR = this.drunkIntensity * 12;
    const cx   = this.crossX + Math.sin(this.drunkWobble) * wobR;
    const cy   = this.crossY + Math.cos(this.drunkWobble * 0.7) * wobR * 0.6;
    // Pulsazione viva del mirino + colore che vira al rosa quando ubriaco
    const pulse = 1 + Math.sin(this.time.now / 170) * 0.07;
    const S    = 14 * pulse;
    const GAP  = 3;
    const MAIN = this.drunkIntensity > 0.35 ? 0xff88cc : 0x44eeff;

    this.crossGfx.clear();

    // Ghost trail quando ubriaco
    if (this.drunkIntensity > 0.2) {
      const tr = Math.sin(this.drunkWobble) * 10 * this.drunkIntensity;
      this.crossGfx.lineStyle(1, 0xff88cc, this.drunkIntensity * 0.3);
      this.crossGfx.strokeRect(cx + tr - S, cy - S, S * 2, S * 2);
    }

    // Quadrato principale — stile Duck Hunt: bordo cyan (colore originale NES)
    this.crossGfx.lineStyle(2, MAIN, 0.95);
    this.crossGfx.strokeRect(cx - S, cy - S, S * 2, S * 2);

    // Angoli rinforzati (cyan pieno)
    const cs = 5;
    this.crossGfx.lineStyle(3, 0x44eeff, 1);
    this.crossGfx.lineBetween(cx - S, cy - S, cx - S + cs, cy - S);
    this.crossGfx.lineBetween(cx - S, cy - S, cx - S, cy - S + cs);
    this.crossGfx.lineBetween(cx + S - cs, cy - S, cx + S, cy - S);
    this.crossGfx.lineBetween(cx + S, cy - S, cx + S, cy - S + cs);
    this.crossGfx.lineBetween(cx - S, cy + S - cs, cx - S, cy + S);
    this.crossGfx.lineBetween(cx - S, cy + S, cx - S + cs, cy + S);
    this.crossGfx.lineBetween(cx + S, cy + S - cs, cx + S, cy + S);
    this.crossGfx.lineBetween(cx + S - cs, cy + S, cx + S, cy + S);

    // Linee incrociate con gap centrale (cyan semitrasparente)
    this.crossGfx.lineStyle(1.5, 0x44eeff, 0.8);
    this.crossGfx.lineBetween(cx - S + 2, cy,         cx - GAP, cy);
    this.crossGfx.lineBetween(cx + GAP,   cy,         cx + S - 2, cy);
    this.crossGfx.lineBetween(cx,         cy - S + 2, cx, cy - GAP);
    this.crossGfx.lineBetween(cx,         cy + GAP,   cx, cy + S - 2);
  }

  // ── DRUNK OVERLAY ─────────────────────────────────────────────────────────

  private renderDrunkFx(): void {
    this.drunkGfx.clear();
    const i = this.drunkIntensity;
    if (i <= 0 && this.drunkFlash <= 0) return;

    // 1. Flash bianco all'inizio della botta
    if (this.drunkFlash > 0) {
      this.drunkGfx.fillStyle(0xffffff, this.drunkFlash * 0.75);
      this.drunkGfx.fillRect(0, 0, W, H);
    }

    if (i <= 0) return;

    // 2. Overlay colorato rosa/viola che copre tutto lo schermo
    this.drunkGfx.fillStyle(0xdd44aa, i * 0.44);
    this.drunkGfx.fillRect(0, 0, W, H);

    // 2b. Bande orizzontali di "doppia visione" che scorrono lentamente
    const t2 = this.time.now / 600;
    for (let bnd = 0; bnd < 3; bnd++) {
      const by = ((t2 + bnd * 0.4) % 1) * H;
      this.drunkGfx.fillStyle(0xffaadd, i * 0.05);
      this.drunkGfx.fillRect(0, by - 10, W, 20);
    }

    // 3. Vignette scura pulsante ai bordi (simula visione tubulare ubriaca)
    const pulse = Math.sin(this.time.now / 220) * 0.5 + 0.5;  // 0–1
    const vAlpha = i * (0.55 + pulse * 0.20);
    // 4 strati di rettangoli sovrapposti per gradiente simulato
    for (let step = 0; step < 4; step++) {
      const margin = (4 - step) * 12;  // 48, 36, 24, 12
      const a = vAlpha * ((step + 1) / 4);
      this.drunkGfx.fillStyle(0x000000, a);
      this.drunkGfx.fillRect(0,          0,      W, margin);
      this.drunkGfx.fillRect(0,          H - margin, W, margin);
      this.drunkGfx.fillRect(0,          0,      margin, H);
      this.drunkGfx.fillRect(W - margin, 0,      margin, H);
    }

    // 4. Striscia orizzontale "doppia visione" (ondulazione lenta)
    const waveY = H * 0.5 + Math.sin(this.time.now / 400) * H * 0.12;
    this.drunkGfx.fillStyle(0xffffff, i * 0.06);
    this.drunkGfx.fillRect(0, waveY - 2, W, 5);
  }
}
