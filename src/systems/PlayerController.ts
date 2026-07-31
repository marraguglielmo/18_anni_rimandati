import Phaser from 'phaser';
import { DialogueSystem } from './DialogueSystem';
import { AudioManager } from './AudioManager';
import { addNameLabel, CHAR_SCALE, SHADOW_OFFSET_Y, type Direction } from './CharacterSprite';
import { Juice } from './Juice';
import { showEmote } from './Emote';

export interface InteractableNpc {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
}

const SPEED = 90; // px/s camminata
const RUN_SPEED = 145; // px/s con Shift premuto
const ACCEL = 16; // reattività in accelerazione (1/s)
const DECEL = 12; // dolcezza in frenata (1/s)
const STEP_DISTANCE = 11; // px percorsi tra un suono di passo e l'altro
const INTERACT_RANGE = 14; // px davanti al player
const INTERACT_HIT_RADIUS = 16; // tolleranza attorno al punto davanti

const DIR_VECTORS: Record<Direction, [number, number]> = {
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
};

type MoveKeys = Record<
  'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SHIFT',
  Phaser.Input.Keyboard.Key
>;

/**
 * Controller del player: WASD + frecce, 8 direzioni (diagonali incluse,
 * es. W+D = diagonale alto-destra) con velocità normalizzata.
 * Fisica "moderna": accelerazione e frenata smooth (esponenziale),
 * Shift per correre, animazione che scala con la velocità reale,
 * passi sonori basati sulla distanza percorsa.
 * Fermo se `locked` (cutscene) o se il DialogueSystem è attivo.
 * Chiamare `update(npcs)` ogni frame dalla scena.
 */
export class PlayerController {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  /** Ombra sotto i piedi, sincronizzata a ogni update. */
  readonly shadow: Phaser.GameObjects.Ellipse;
  /** Nome sopra la testa, sincronizzato a ogni update. */
  readonly nameLabel: Phaser.GameObjects.Text;
  /** Blocco esterno (es. durante l'intro). */
  locked = false;
  /** Se true, i controlli di movimento sono invertiti (Umberto ubriaco). */
  invertControls = false;
  /** 0..1: quanto il player è "sollevato" (rampe/scale) — riduce l'ombra. */
  elevation = 0;
  /** NPC interagibile in questo frame (null se nessuno). */
  nearbyNpc: InteractableNpc | null = null;
  /** Animazione custom da mantenere durante una cutscene (null = idle normale). */
  cutsceneAnim: string | null = null;

  private readonly charId: string;
  private readonly dialogue: DialogueSystem;
  private readonly keys: MoveKeys;
  private readonly indicator: Phaser.GameObjects.Text;
  private indicatorTarget: InteractableNpc | null = null;
  private facing: Direction = 'down';
  private stepDistance = 0;
  private idleTime = 0;
  private lastZzzAt = 0;
  private trailAcc = 0;

  constructor(
    scene: Phaser.Scene,
    charId: string,
    x: number,
    y: number,
    dialogue: DialogueSystem
  ) {
    this.charId = charId;
    this.dialogue = dialogue;

    this.sprite = scene.physics.add.sprite(x, y, `char-${charId}`, 1);
    this.sprite.setScale(CHAR_SCALE); // texture a densità doppia
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 14); // hitbox solo sui piedi (in texel: 12x7 nel mondo)
    body.setOffset(12, 50);
    body.setCollideWorldBounds(true);
    this.sprite.play(`${charId}-idle-down`);

    this.shadow = scene.add.ellipse(x, y + SHADOW_OFFSET_Y, 12, 4, 0x000000, 0.3);
    this.nameLabel = addNameLabel(scene, x, y, charId);

    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard plugin non disponibile');
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as MoveKeys;

    // Indicatore "INVIO" lampeggiante sopra l'NPC interagibile
    this.indicator = scene.add
      .text(0, 0, 'INVIO', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '6px',
        color: '#ffe14d',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(1500)
      .setVisible(false);
    scene.tweens.add({
      targets: this.indicator,
      alpha: 0.2,
      duration: 350,
      yoyo: true,
      repeat: -1,
    });
  }

  update(npcs: InteractableNpc[] = []): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Ombra e nome: seguono sempre il player (anche nelle cutscene in tween)
    this.shadow
      .setPosition(this.sprite.x, this.sprite.y + SHADOW_OFFSET_Y)
      .setDepth(this.sprite.y - 1)
      .setScale(1 - 0.25 * this.elevation);
    this.nameLabel
      .setPosition(this.sprite.x, this.sprite.y - 20)
      .setDepth(this.sprite.y + 1);

    if (this.locked || this.dialogue.isActive) {
      body.setVelocity(0, 0);
      this.sprite.anims.timeScale = 1;
      const lockedAnim = this.cutsceneAnim ?? `${this.charId}-idle-${this.facing}`;
      this.sprite.anims.play(lockedAnim, true);
      this.nearbyNpc = null;
      this.indicator.setVisible(false);
      this.stepDistance = 0;
      this.idleTime = 0;
      this.lastZzzAt = 0;
      return;
    }

    const dt = this.sprite.scene.game.loop.delta / 1000;

    // Vettore di input a 8 direzioni (invertito se Umberto è ubriaco)
    const rawIx =
      (this.keys.RIGHT.isDown || this.keys.D.isDown ? 1 : 0) -
      (this.keys.LEFT.isDown || this.keys.A.isDown ? 1 : 0);
    const rawIy =
      (this.keys.DOWN.isDown || this.keys.S.isDown ? 1 : 0) -
      (this.keys.UP.isDown || this.keys.W.isDown ? 1 : 0);
    const ix = this.invertControls ? -rawIx : rawIx;
    const iy = this.invertControls ? -rawIy : rawIy;
    const hasInput = ix !== 0 || iy !== 0;

    // Velocità target normalizzata (le diagonali non sono più veloci)
    const maxSpeed = this.keys.SHIFT.isDown ? RUN_SPEED : SPEED;
    let tx = 0;
    let ty = 0;
    if (hasInput) {
      const len = Math.hypot(ix, iy);
      tx = (ix / len) * maxSpeed;
      ty = (iy / len) * maxSpeed;
    }

    // Smoothing esponenziale: accelerazione reattiva, frenata morbida
    const a = 1 - Math.exp(-(hasInput ? ACCEL : DECEL) * dt);
    let vx = body.velocity.x + (tx - body.velocity.x) * a;
    let vy = body.velocity.y + (ty - body.velocity.y) * a;
    const speed = Math.hypot(vx, vy);
    if (!hasInput && speed < 4) {
      vx = 0;
      vy = 0;
    }
    body.setVelocity(vx, vy);

    // Facing: nelle diagonali resta sull'asse corrente se ancora attivo,
    // altrimenti preferisce l'orizzontale
    if (hasInput) {
      const active: Direction[] = [];
      if (ix < 0) active.push('left');
      if (ix > 0) active.push('right');
      if (iy < 0) active.push('up');
      if (iy > 0) active.push('down');
      if (!active.includes(this.facing)) {
        this.facing = active.find((d) => d === 'left' || d === 'right') ?? active[0];
      }
    }

    // Animazione: walk se in movimento, con passo scalato sulla velocità reale
    const moving = hasInput || speed > 5;

    // Fidget idle: dopo ~5s fermo si guarda intorno; dopo ~14s sonnecchia
    if (moving) {
      this.idleTime = 0;
      this.lastZzzAt = 0;
    } else {
      this.idleTime += dt;
    }
    let animDir = this.facing;
    if (!moving) {
      const t = this.idleTime % 9;
      if (t >= 5 && t < 5.7) animDir = 'left';
      else if (t >= 5.7 && t < 6.4) animDir = 'right';
      if (this.idleTime > 14 && this.idleTime - this.lastZzzAt > 3) {
        this.lastZzzAt = this.idleTime;
        showEmote(this.sprite.scene, this.sprite.x + 9, this.sprite.y - 8, 'zzz', {
          duration: 1700,
          depth: this.sprite.y + 40,
        });
      }
    }

    this.sprite.anims.play(`${this.charId}-${moving ? 'walk' : 'idle'}-${moving ? this.facing : animDir}`, true);
    this.sprite.anims.timeScale = moving
      ? Phaser.Math.Clamp(Math.max(speed, maxSpeed * 0.4) / SPEED, 0.6, 1.7)
      : 1;

    // Ombra reattiva: pulsa leggermente a ritmo dei passi
    const elevScale = 1 - 0.25 * this.elevation;
    const stepPulse = moving
      ? 1 + 0.08 * Math.sin((this.stepDistance / STEP_DISTANCE) * Math.PI * 2)
      : 1;
    this.shadow.setScale(elevScale * stepPulse, elevScale);

    // Scia "afterimage" durante la corsa
    if (moving && this.keys.SHIFT.isDown && speed > SPEED) {
      this.trailAcc += dt;
      if (this.trailAcc >= 0.09) {
        this.trailAcc = 0;
        const ghost = this.sprite.scene.add
          .image(this.sprite.x, this.sprite.y, this.sprite.texture.key, this.sprite.frame.name)
          .setScale(this.sprite.scaleX, this.sprite.scaleY)
          .setFlipX(this.sprite.flipX)
          .setAlpha(0.28)
          .setTint(0xaaccff)
          .setDepth(this.sprite.y - 2);
        this.sprite.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 240,
          ease: 'Quad.easeOut',
          onComplete: () => ghost.destroy(),
        });
      }
    } else {
      this.trailAcc = 0.09; // il primo ghost parte subito
    }

    // Suono passo basato sulla distanza percorsa (coerente anche in corsa)
    if (moving && speed > 10) {
      this.stepDistance += speed * dt;
      if (this.stepDistance >= STEP_DISTANCE) {
        this.stepDistance = 0;
        AudioManager.get().playSFX(this.sprite.scene, 'step', 0.4);
        // Sbuffo di polvere dietro i piedi quando si corre
        if (this.keys.SHIFT.isDown) {
          Juice.dust(
            this.sprite.scene,
            this.sprite.x - Math.sign(vx) * 4,
            this.sprite.y + SHADOW_OFFSET_Y - 1,
            3,
            0xcfc4a8,
            this.sprite.y - 2
          );
        }
      }
    } else {
      this.stepDistance = 0;
    }

    this.checkInteraction(npcs);
  }

  /**
   * Cerca un NPC entro 20px davanti al player; se trovato mostra
   * l'indicatore "INVIO" lampeggiante sopra di lui.
   */
  checkInteraction(npcs: InteractableNpc[]): InteractableNpc | null {
    const [dx, dy] = DIR_VECTORS[this.facing];
    const fx = this.sprite.x + dx * INTERACT_RANGE;
    const fy = this.sprite.y + dy * INTERACT_RANGE;

    let found: InteractableNpc | null = null;
    for (const npc of npcs) {
      const dist = Phaser.Math.Distance.Between(fx, fy, npc.sprite.x, npc.sprite.y);
      if (dist <= INTERACT_HIT_RADIUS) {
        found = npc;
        break;
      }
    }

    this.nearbyNpc = found;
    if (found) {
      const isNew = this.indicatorTarget !== found || !this.indicator.visible;
      this.indicatorTarget = found;
      this.indicator.setPosition(found.sprite.x, found.sprite.y - 30).setVisible(true);
      if (isNew) {
        // fade-in veloce (pop) quando appare su un nuovo NPC
        this.indicator.setScale(0);
        this.sprite.scene.tweens.add({
          targets: this.indicator,
          scale: 1,
          duration: 130,
          ease: 'Back.easeOut',
        });
      }
    } else {
      this.indicatorTarget = null;
      this.indicator.setVisible(false);
    }
    return found;
  }

  destroy(): void {
    this.indicator.destroy();
    this.shadow.destroy();
    this.nameLabel.destroy();
    this.sprite.destroy();
  }
}
