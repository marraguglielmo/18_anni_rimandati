import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import {
  CHAR_CONFIGS,
  CHAR_SCALE,
  generateBattleSprite,
  loadPortraits,
} from '../systems/CharacterSprite';
import { DialogueSystem } from '../systems/DialogueSystem';
import { TransitionSystem, UI_OFF_X, UI_OFF_Y } from '../systems/TransitionSystem';
import { AudioManager } from '../systems/AudioManager';

export interface BattleData {
  playerChar: string;
  enemyChar: string;
  onComplete: () => void;
}

interface BattleMove {
  name: string;
  damage: number;
  message: string;
  tag: string;
  effect: 'fire' | 'curse' | 'laugh' | 'rage';
}

const PLAYER_MOVES: BattleMove[] = [
  {
    name: 'SUPER BESTEMMIA',
    damage: 18,
    message: 'Non è molto efficace...',
    tag: 'POCO EFFICACE',
    effect: 'curse',
  },
  {
    name: 'CONTRACCOLPO',
    damage: 18,
    message: 'È SUPEREFFICACE!',
    tag: 'SUPEREFFICACE',
    effect: 'fire',
  },
];

const ENEMY_MOVES: BattleMove[] = [
  { name: 'RISATINA', damage: 20, message: 'È SUPEREFFICACE su BUBI!', tag: '', effect: 'laugh' },
  { name: 'RAGEBAIT', damage: 15, message: 'È SUPEREFFICACE su BUBI!', tag: '', effect: 'rage' },
];

const MAX_HP = 55;
const MAX_ROUNDS = 4;
const FONT = '"Press Start 2P", monospace';

// Pose da trainer 40x56 (mondo): nemico 2x (80x112), player 2.4x (96x134).
// CHAR_SCALE compensa la densità doppia delle texture.
const ENEMY_SCALE = 2 * CHAR_SCALE;
const PLAYER_SCALE = 2.4 * CHAR_SCALE;
const ENEMY_POS = { x: 372, y: 78 };
const PLAYER_POS = { x: 112, y: 132 };

const ENEMY_BOX = { x: 12, y: 14, w: 182, h: 44 };
const PLAYER_BOX = { x: 286, y: 146, w: 182, h: 52 };
const MSG_BOX = { x: 0, y: 206, w: GAME_WIDTH, h: GAME_HEIGHT - 206 };
const BAR_W = 140;

export class BattleScene extends Phaser.Scene {
  private battleData!: BattleData;
  private dialogue!: DialogueSystem;

  private enemySprite!: Phaser.GameObjects.Sprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private arena!: Phaser.GameObjects.Container;
  private enemyBox!: Phaser.GameObjects.Container;
  private playerBox!: Phaser.GameObjects.Container;
  private bottomBox!: Phaser.GameObjects.Container;
  private moveUI!: Phaser.GameObjects.Container;
  private enemyBar!: Phaser.GameObjects.Graphics;
  private playerBar!: Phaser.GameObjects.Graphics;
  private playerHpText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;

  private playerHp = MAX_HP;
  private enemyHp = MAX_HP;
  private enemyMoveIndex = 0;
  private moveResolve: ((m: BattleMove) => void) | null = null;
  private playerName = 'BUBI';
  private enemyName = 'UMBERTO';
  private battleDone = false;

  constructor() {
    super('BattleScene');
  }

  init(data: Partial<BattleData>): void {
    this.battleData = {
      playerChar: data.playerChar ?? 'bubi',
      enemyChar: data.enemyChar ?? 'umberto',
      onComplete:
        data.onComplete ??
        (() => {
          this.scene.start('GameScene');
        }),
    };
    this.playerHp = MAX_HP;
    this.enemyHp = MAX_HP;
    this.enemyMoveIndex = 0;
    this.moveResolve = null;
    this.battleDone = false;
    this.playerName = this.battleData.playerChar.toUpperCase();
    this.enemyName = this.battleData.enemyChar.toUpperCase();
  }

  preload(): void {
    loadPortraits(this, [this.battleData.playerChar, this.battleData.enemyChar, 'chiara']);
  }

  create(): void {
    const { playerChar, enemyChar } = this.battleData;
    for (const pose of ['idle', 'attack', 'hit'] as const) {
      generateBattleSprite(this, playerChar, CHAR_CONFIGS[playerChar], pose);
      generateBattleSprite(this, enemyChar, CHAR_CONFIGS[enemyChar], pose);
    }
    this.createParticleTexture();

    this.drawArena();

    // Pose da trainer: partono fuori schermo, entrano in tween.
    // Il nemico è specchiato per guardare verso il player.
    this.enemySprite = this.add
      .sprite(GAME_WIDTH + 90, ENEMY_POS.y, `battle-${enemyChar}`)
      .setFlipX(true)
      .setScale(ENEMY_SCALE)
      .setDepth(10);
    this.playerSprite = this.add
      .sprite(-100, PLAYER_POS.y, `battle-${playerChar}`)
      .setScale(PLAYER_SCALE)
      .setDepth(10);

    this.createHpBoxes();
    this.createBottomBox();
    this.createMoveUI();

    this.dialogue = new DialogueSystem(this);

    // Tasti 1/2 per le mosse
    const kb = this.input.keyboard;
    if (kb) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE).on('down', () => this.selectMove(0));
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO).on('down', () => this.selectMove(1));

      // ── Debug: ESC salta la battaglia ──
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).once('down', () => this.skipBattle());
    }

    // Label debug "[ESC] SALTA"
    const FONT = '"Press Start 2P", monospace';
    this.add
      .text(UI_OFF_X + 4, UI_OFF_Y + GAME_HEIGHT - 4, '[ESC] SALTA', {
        fontFamily: FONT, fontSize: '6px',
        color: '#66ff99', stroke: '#000000', strokeThickness: 2,
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(5000);

    void this.runIntro();
  }

  // ------------------------------------------------------- transizione

  private async runIntro(): Promise<void> {
    const cam = this.cameras.main;
    this.arena.setAlpha(0);
    TransitionSystem.fadeFromBlack(this, 300); // mai partire a schermo visibile
    AudioManager.get().playMusic(this, 'battle'); // sostituisce overworld

    // 1. screen shake crescente (1.5s totali)
    for (const intensity of [0.002, 0.005, 0.01]) {
      cam.shake(500, intensity);
      await this.delay(500);
    }
    // 2. flash bianco
    cam.flash(400, 255, 255, 255);
    await this.delay(400);
    // 3. fade-in arena
    await this.tweenP({ targets: this.arena, alpha: 1, duration: 350 });

    // Entrata sprite da fuori schermo
    await Promise.all([
      this.tweenP({ targets: this.enemySprite, x: ENEMY_POS.x, duration: 500, ease: 'Cubic.easeOut' }),
      this.tweenP({ targets: this.playerSprite, x: PLAYER_POS.x, duration: 500, ease: 'Cubic.easeOut' }),
    ]);
    await this.tweenP({
      targets: [this.enemyBox, this.playerBox, this.bottomBox],
      alpha: 1,
      duration: 250,
    });

    await this.runBattle();
  }

  // ------------------------------------------------------- flusso turni

  private async runBattle(): Promise<void> {
    await this.showMessage(`${this.enemyName} ti sfida!`);

    for (let round = 0; round < MAX_ROUNDS; round++) {
      // 1. Il nemico attacca per primo, mosse alternate
      await this.enemyTurn();
      if (this.bothAtOne()) break;
      // 2. Il player sceglie
      const move = await this.chooseMove();
      await this.playerTurn(move);
      if (this.bothAtOne()) break;
    }

    // Garantisce che entrambi finiscano a 1 HP
    if (this.playerHp > 1) await this.applyDamage('player', this.playerHp - 1);
    if (this.enemyHp > 1) await this.applyDamage('enemy', this.enemyHp - 1);

    await this.finale();
  }

  private bothAtOne(): boolean {
    return this.playerHp === 1 && this.enemyHp === 1;
  }

  private async enemyTurn(): Promise<void> {
    const move = ENEMY_MOVES[this.enemyMoveIndex % ENEMY_MOVES.length];
    this.enemyMoveIndex++;
    await this.showMessage(`${this.enemyName} usa ${move.name}!`);
    this.strikePose('enemy');
    await this.playEffect(move.effect);
    await this.applyDamage('player', move.damage);
    this.restorePose('enemy');
    await this.showMessage(move.message);
  }

  private async playerTurn(move: BattleMove): Promise<void> {
    await this.showMessage(`${this.playerName} usa ${move.name}!`);
    this.strikePose('player');
    await this.playEffect(move.effect);
    await this.applyDamage('enemy', move.damage);
    this.restorePose('player');
    await this.showMessage(move.message);
  }

  /** Posa d'attacco + affondo verso l'avversario. */
  private strikePose(who: 'player' | 'enemy'): void {
    const id = who === 'player' ? this.battleData.playerChar : this.battleData.enemyChar;
    const spr = who === 'player' ? this.playerSprite : this.enemySprite;
    spr.setTexture(`battle-${id}-attack`);
    const dx = who === 'player' ? 14 : -14;
    this.tweens.add({
      targets: spr,
      x: spr.x + dx,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private restorePose(who: 'player' | 'enemy'): void {
    const id = who === 'player' ? this.battleData.playerChar : this.battleData.enemyChar;
    const spr = who === 'player' ? this.playerSprite : this.enemySprite;
    spr.setTexture(`battle-${id}`);
  }

  private chooseMove(): Promise<BattleMove> {
    this.messageText.setText(`Cosa farà ${this.playerName}?`);
    this.moveUI.setVisible(true);
    return new Promise((resolve) => {
      this.moveResolve = resolve;
    });
  }

  private selectMove(index: number): void {
    if (!this.moveResolve) return; // disabilitato durante animazioni/messaggi
    AudioManager.get().playSFX(this, 'confirm', 0.55);
    const resolve = this.moveResolve;
    this.moveResolve = null;
    this.moveUI.setVisible(false);
    resolve(PLAYER_MOVES[index]);
  }

  private skipBattle(): void {
    if (this.battleDone) return;
    this.battleDone = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      AudioManager.get().stopFgMusic(this);
      this.battleData.onComplete();
    });
  }

  private async finale(): Promise<void> {
    if (this.battleDone) return;
    this.battleDone = true;
    await this.delay(400);
    await new Promise<void>((resolve) => {
      this.dialogue.start({
        lines: [{ speaker: 'chiara', text: 'MA FINITELA! Entriamo in classe!' }],
        onComplete: resolve,
      });
    });
    // Fade a nero → la scena esterna farà il reveal
    await new Promise<void>(r => {
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, r);
      this.cameras.main.fadeOut(600, 0, 0, 0);
    });
    AudioManager.get().stopFgMusic(this);
    this.battleData.onComplete();
  }

  // ------------------------------------------------------- danni e HP

  private applyDamage(target: 'player' | 'enemy', dmg: number): Promise<void> {
    const isPlayer = target === 'player';
    const from = isPlayer ? this.playerHp : this.enemyHp;
    const to = Math.max(1, from - dmg); // mai sotto 1 HP
    if (isPlayer) this.playerHp = to;
    else this.enemyHp = to;

    // posa "colpito" + contraccolpo + lampeggio + suono danno
    AudioManager.get().playSFX(this, 'hit', 0.5);
    const sprite = isPlayer ? this.playerSprite : this.enemySprite;
    const hitId = isPlayer ? this.battleData.playerChar : this.battleData.enemyChar;
    sprite.setTexture(`battle-${hitId}-hit`);
    this.time.delayedCall(520, () => sprite.setTexture(`battle-${hitId}`));
    this.tweens.add({
      targets: sprite,
      x: sprite.x + (isPlayer ? -7 : 7),
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({ targets: sprite, alpha: 0.2, duration: 70, yoyo: true, repeat: 3 });

    // barra che si svuota progressivamente (mai un salto al valore finale)
    const counter = { v: from };
    return new Promise((resolve) => {
      this.tweens.add({
        targets: counter,
        v: to,
        duration: 600,
        ease: 'Linear',
        onUpdate: () => this.updateHpUi(target, counter.v),
        onComplete: () => {
          this.updateHpUi(target, to);
          // tremble del box quando si scende sotto il 20%
          if (to / MAX_HP <= 0.2) {
            const box = isPlayer ? this.playerBox : this.enemyBox;
            this.tweens.add({ targets: box, x: 2, duration: 40, yoyo: true, repeat: 5 });
          }
          resolve();
        },
      });
    });
  }

  private updateHpUi(target: 'player' | 'enemy', value: number): void {
    const ratio = value / MAX_HP;
    if (target === 'enemy') {
      this.drawHpBar(this.enemyBar, ENEMY_BOX.x + 8, ENEMY_BOX.y + 28, ratio);
    } else {
      this.drawHpBar(this.playerBar, PLAYER_BOX.x + 8, PLAYER_BOX.y + 28, ratio);
      this.playerHpText.setText(`${Math.ceil(value)}/${MAX_HP}`);
    }
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, ratio: number): void {
    g.clear();
    g.fillStyle(0x303030);
    g.fillRect(x - 1, y - 1, BAR_W + 2, 8);
    g.fillStyle(0x585858);
    g.fillRect(x, y, BAR_W, 6);
    const color = ratio > 0.5 ? 0x40c040 : ratio > 0.2 ? 0xf0c020 : 0xe04030;
    g.fillStyle(color);
    g.fillRect(x, y, Math.max(1, Math.round(BAR_W * ratio)), 6);
  }

  // ------------------------------------------------------- effetti mosse

  private async playEffect(effect: BattleMove['effect']): Promise<void> {
    switch (effect) {
      case 'fire': {
        // particelle arancioni/rosse che esplodono sul nemico
        const em = this.add
          .particles(ENEMY_POS.x, ENEMY_POS.y, 'battle-px', {
            speed: { min: 60, max: 200 },
            lifespan: 500,
            scale: { start: 1.8, end: 0 },
            tint: [0xff2200, 0xff7700, 0xffbb00],
            emitting: false,
          })
          .setDepth(500);
        em.explode(40);
        this.cameras.main.shake(180, 0.01);
        await this.delay(600);
        em.destroy();
        break;
      }
      case 'curse': {
        // lampi blu che irraggiano dal nemico
        const em = this.add
          .particles(ENEMY_POS.x, ENEMY_POS.y, 'battle-px', {
            speed: { min: 180, max: 260 },
            lifespan: 350,
            scale: { start: 1.4, end: 0 },
            tint: [0x66bbff, 0x2255ff, 0xaaddff],
            emitting: false,
          })
          .setDepth(500);
        em.explode(28);
        this.cameras.main.flash(150, 120, 170, 255);
        await this.delay(450);
        em.destroy();
        break;
      }
      case 'laugh': {
        // "HA" gialli dal nemico verso il player
        for (let i = 0; i < 6; i++) {
          const t = this.add
            .text(
              ENEMY_POS.x + Phaser.Math.Between(-25, 25),
              ENEMY_POS.y + Phaser.Math.Between(-15, 15),
              'HA',
              { fontFamily: FONT, fontSize: '8px', color: '#ffe14d', stroke: '#000000', strokeThickness: 3 }
            )
            .setOrigin(0.5)
            .setDepth(600);
          this.tweens.add({
            targets: t,
            x: PLAYER_POS.x + Phaser.Math.Between(-30, 30),
            y: PLAYER_POS.y + Phaser.Math.Between(-25, 5),
            alpha: 0,
            duration: 700,
            delay: i * 90,
            ease: 'Sine.easeIn',
            onComplete: () => t.destroy(),
          });
        }
        await this.delay(700 + 6 * 90);
        break;
      }
      case 'rage': {
        // "!" rossi intorno al player + flash rosso
        this.cameras.main.flash(250, 255, 40, 40);
        const marks: Phaser.GameObjects.Text[] = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const t = this.add
            .text(
              PLAYER_POS.x + Math.cos(angle) * Phaser.Math.Between(40, 60),
              PLAYER_POS.y + Math.sin(angle) * Phaser.Math.Between(30, 50),
              '!',
              { fontFamily: FONT, fontSize: '12px', color: '#ff3333', stroke: '#000000', strokeThickness: 3 }
            )
            .setOrigin(0.5)
            .setScale(0)
            .setDepth(600);
          marks.push(t);
          this.tweens.add({
            targets: t,
            scale: 1.3,
            duration: 180,
            delay: i * 70,
            ease: 'Back.easeOut',
          });
        }
        await this.delay(800);
        for (const m of marks) {
          this.tweens.add({ targets: m, alpha: 0, duration: 150, onComplete: () => m.destroy() });
        }
        await this.delay(160);
        break;
      }
    }
  }

  // ------------------------------------------------------- UI

  private showMessage(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.messageText.setText('');
      let i = 0;
      this.time.addEvent({
        delay: 18,
        repeat: text.length - 1,
        callback: () => {
          i++;
          this.messageText.setText(text.slice(0, i));
          if (i % 3 === 0) AudioManager.get().playSFX(this, 'text', 0.2);
          if (i >= text.length) this.time.delayedCall(800, resolve);
        },
      });
    });
  }

  private createHpBoxes(): void {
    const make = (
      box: { x: number; y: number; w: number; h: number },
      name: string,
      withNumbers: boolean
    ): { container: Phaser.GameObjects.Container; bar: Phaser.GameObjects.Graphics } => {
      const bg = this.add.graphics();
      bg.fillStyle(0xf8f8e0, 0.95);
      bg.fillRoundedRect(box.x, box.y, box.w, box.h, 4);
      bg.lineStyle(2, 0x303030);
      bg.strokeRoundedRect(box.x, box.y, box.w, box.h, 4);

      const nameT = this.add.text(box.x + 8, box.y + 7, name, {
        fontFamily: FONT,
        fontSize: '7px',
        color: '#303030',
      });
      const lvT = this.add
        .text(box.x + box.w - 8, box.y + 7, 'Lv.16', {
          fontFamily: FONT,
          fontSize: '6px',
          color: '#303030',
        })
        .setOrigin(1, 0);

      const bar = this.add.graphics();
      // Label "HP" in verde stile Pokémon
      const hpLabel = this.add.text(box.x + 8, box.y + 24, 'HP', {
        fontFamily: FONT,
        fontSize: '5px',
        color: '#229933',
      });
      const children: Phaser.GameObjects.GameObject[] = [bg, nameT, lvT, hpLabel, bar];

      if (withNumbers) {
        this.playerHpText = this.add
          .text(box.x + box.w - 8, box.y + 38, `${MAX_HP}/${MAX_HP}`, {
            fontFamily: FONT,
            fontSize: '6px',
            color: '#303030',
          })
          .setOrigin(1, 0);
        children.push(this.playerHpText);
      }

      const container = this.add.container(0, 0, children).setDepth(800).setAlpha(0);
      return { container, bar };
    };

    const enemy = make(ENEMY_BOX, this.enemyName, false);
    this.enemyBox = enemy.container;
    this.enemyBar = enemy.bar;
    const player = make(PLAYER_BOX, this.playerName, true);
    this.playerBox = player.container;
    this.playerBar = player.bar;

    this.updateHpUi('enemy', MAX_HP);
    this.updateHpUi('player', MAX_HP);
  }

  private createBottomBox(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(MSG_BOX.x, MSG_BOX.y, MSG_BOX.w, MSG_BOX.h);
    bg.lineStyle(2, 0xffffff);
    bg.strokeRect(MSG_BOX.x + 1, MSG_BOX.y + 1, MSG_BOX.w - 2, MSG_BOX.h - 2);

    this.messageText = this.add.text(MSG_BOX.x + 14, MSG_BOX.y + 14, '', {
      fontFamily: FONT,
      fontSize: '7px',
      color: '#ffffff',
      lineSpacing: 5,
      wordWrap: { width: 215 },
    });

    this.bottomBox = this.add.container(0, 0, [bg, this.messageText]).setDepth(900).setAlpha(0);
  }

  private createMoveUI(): void {
    const children: Phaser.GameObjects.GameObject[] = [];
    PLAYER_MOVES.forEach((move, i) => {
      const bx = 248;
      const by = MSG_BOX.y + 6 + i * 28;
      const bw = 224;
      const bh = 25;

      const btn = this.add
        .rectangle(bx, by, bw, bh, 0x202020)
        .setOrigin(0)
        .setStrokeStyle(1, 0xffffff)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setFillStyle(0x3a3a3a));
      btn.on('pointerout', () => btn.setFillStyle(0x202020));
      btn.on('pointerdown', () => this.selectMove(i));

      const nameT = this.add.text(bx + 6, by + 4, `${i + 1}. ${move.name}`, {
        fontFamily: FONT,
        fontSize: '6px',
        color: '#ffffff',
      });
      const tagT = this.add.text(bx + 6, by + 14, move.tag, {
        fontFamily: FONT,
        fontSize: '6px',
        color: i === 1 ? '#ff9955' : '#999999',
      });
      children.push(btn, nameT, tagT);
    });

    this.moveUI = this.add.container(0, 0, children).setDepth(950).setVisible(false);
  }

  // ------------------------------------------------------- arena

  private drawArena(): void {
    const g = this.make.graphics();
    const skyH = 135;

    // Cielo
    g.fillStyle(0x4890d8);
    g.fillRect(0, 0, GAME_WIDTH, skyH);
    // Righe diagonali più chiare (confinate al cielo per costruzione)
    g.lineStyle(8, 0x5ba0e0, 0.35);
    for (let x = -skyH; x < GAME_WIDTH; x += 28) {
      g.lineBetween(x, 0, x + skyH, skyH);
    }

    // Terreno: gradiente verde a fasce orizzontali
    const top = Phaser.Display.Color.ValueToColor(0x78c030);
    const bottom = Phaser.Display.Color.ValueToColor(0x3a5012);
    const steps = 12;
    const groundH = GAME_HEIGHT - skyH;
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(0, skyH + (groundH / steps) * i, GAME_WIDTH, groundH / steps + 1);
    }

    // Nuvole NES-style (bianco puro, blocchi rettangolari)
    g.fillStyle(0xfcfcfc);
    const cloudDefs: [number, number, number][] = [[62, 22, 36], [210, 14, 30], [360, 30, 28]];
    for (const [cx, cy, cw] of cloudDefs) {
      g.fillRect(cx - cw / 2,        cy + 4,       cw,           10); // base
      g.fillRect(cx - cw * 0.35,     cy - 2,       cw * 0.70,    9);  // gobba
      g.fillRect(cx - cw * 0.14,     cy - 8,       cw * 0.32,    7);  // cima
    }

    // Fascia verde orizzonte
    g.fillStyle(0x68b030);
    g.fillRect(0, skyH - 6, GAME_WIDTH, 12);

    // Piattaforma nemica (alto destra)
    g.fillStyle(0x9ad858, 0.9);
    g.fillEllipse(ENEMY_POS.x, 128, 132, 26);
    g.lineStyle(2, 0x6fae3c, 0.8);
    g.strokeEllipse(ENEMY_POS.x, 128, 132, 26);

    // Piattaforma player (basso sinistra, più grande)
    g.fillStyle(0x9ad858, 0.9);
    g.fillEllipse(PLAYER_POS.x, 212, 180, 34);
    g.lineStyle(2, 0x6fae3c, 0.8);
    g.strokeEllipse(PLAYER_POS.x, 212, 180, 34);

    // Pre-render dell'arena statica in texture
    if (!this.textures.exists('tex-battle-arena')) {
      g.generateTexture('tex-battle-arena', GAME_WIDTH, GAME_HEIGHT);
    }
    g.destroy();
    const img = this.add.image(0, 0, 'tex-battle-arena').setOrigin(0);
    this.arena = this.add.container(0, 0, [img]).setDepth(0);
  }

  private createParticleTexture(): void {
    if (this.textures.exists('battle-px')) return;
    const g = this.make.graphics();
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('battle-px', 4, 4);
    g.destroy();
  }

  // ------------------------------------------------------- util

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tweenP(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}
