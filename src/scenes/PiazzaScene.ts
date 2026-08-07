import Phaser from 'phaser';
import { DialogueSystem, type DialogueLine } from '../systems/DialogueSystem';
import {
  addNameLabel,
  addShadow,
  CHAR_CONFIGS,
  CHAR_SCALE,
  FRAME_H,
  generateSpriteTexture,
  loadPortraits,
  makeFeetBody,
  SHADOW_OFFSET_Y,
} from '../systems/CharacterSprite';
import { PlayerController, type InteractableNpc } from '../systems/PlayerController';
import { TransitionSystem, UI_OFF_X, UI_OFF_Y } from '../systems/TransitionSystem';
import { AudioManager } from '../systems/AudioManager';

// 2026, Piazza Cappuccini, Tricase
const WORLD_W = 640;
const WORLD_H = 360;
const TILE = 16;
const FOUNTAIN = { x: 320, y: 190 };

// Gianfranco gira per la piazza in modo casuale: vagabonda verso punti a caso,
// ogni tanto si ferma, poi riparte a pedalare.
const BIKE_SPEED = 52; // px/s in pedalata
const BIKE_ROAM = { minX: 80, maxX: 560, minY: 226, maxY: 322 };
// Due parole balbettate (dette ogni tanto sopra la testa)
const GIANFRANCO_STUTTER = [
  'Sai che festa è osci??',
  'A festa di cujuni ahahahahah',
  'Oh scusa sai...',
];

const INTRO_LINES: DialogueLine[] = [
  {
    speaker: 'umberto',
    text: 'Porca puttana vagnoni, ma vi rendete conto? Siamo gli unici senza il video del 18esimo.',
  },
  { speaker: 'trande', text: 'Per la Mamma Maria, maledetto covid...' },
  { speaker: 'bubi', text: 'È un vuoto assurdo porco dio.' },
];

const CECE_LINES: DialogueLine[] = [
  { speaker: 'cece', text: 'Ou cujuni... se volete questo video ve lo genero io con l\'AI!' },
  { speaker: 'umberto', text: 'Cece?! Che cazzo dici?' },
  { speaker: 'cece', text: 'Voi mi sottovalutate. Ora vi faccio vedere io negri.' },
];

const NPC_DIALOGUES: Record<string, DialogueLine[]> = {
  umberto: [
    { speaker: 'umberto', text: 'Tutti hanno il loro video del 18esimo. Tutti tranne noi. Non se ne può più.' },
    { speaker: 'bubi',    text: 'Eppure ci eravamo pure organizzati...' },
    { speaker: 'umberto', text: 'Eh, poi è arrivato quel maledetto covid e ha mandato tutto a fanculo.' },
  ],
  trande: [
    { speaker: 'trande', text: 'Mamma Maria... ogni volta che ci penso mi sale il nervoso.' },
    { speaker: 'bubi',   text: 'Almeno tu non ci pensi spesso.' },
    { speaker: 'trande', text: 'Certo che no. Ma ogni volta che vedo un video degli altri, minchia.' },
  ],
  gnumma: [
    { speaker: 'gnumma', text: '...' },
    { speaker: 'gnumma', text: 'Rione Caprarica il resto è noia' },
    { speaker: 'gnumma', text: 'Me porti a casa?' },
  ],
};

export class PiazzaScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;
  private player!: PlayerController;
  private npcs: InteractableNpc[] = [];
  private obstacles: Phaser.GameObjects.Rectangle[] = [];
  private waterFx!: Phaser.GameObjects.Graphics;
  private finaleQueued = false;
  private ceceTimerStarted = false;

  // ── Gianfranco, il ciclista che gira per la piazza (ambientale) ──
  private gianfranco?: Phaser.GameObjects.Container;
  private gianfrancoWheels: Phaser.GameObjects.Graphics[] = [];
  private gianfrancoLabel?: Phaser.GameObjects.Text; // nome sopra la testa (segue il ciclista)
  private gfRider?: Phaser.GameObjects.Sprite;       // sprite del ciclista (per idle/walk)
  private gfState: 'riding' | 'stopped' = 'riding';
  private gfTarget = { x: 0, y: 0 };
  private gfStopMs = 0;
  private gfFacingLeft = false;
  private gfBubble?: Phaser.GameObjects.Container;    // nuvoletta balbettata (segue la testa)
  private gfSpeechIdx = 0;                             // scorre GIANFRANCO_STUTTER in ordine

  constructor() {
    super('PiazzaScene');
  }

  preload(): void {
    loadPortraits(this, ['bubi', 'umberto', 'trande', 'cece', 'gnumma', 'gianfranco']);
  }

  create(): void {
    this.npcs = [];
    this.obstacles = [];
    this.finaleQueued = false;
    this.ceceTimerStarted = false;
    this.gianfranco = undefined;
    this.gianfrancoWheels = [];
    this.gianfrancoLabel = undefined;
    this.gfRider = undefined;
    this.gfState = 'riding';
    this.gfStopMs = 0;
    this.gfFacingLeft = false;
    this.gfBubble = undefined;
    this.gfSpeechIdx = 0;
    AudioManager.get().playBgMusic(this, 'bgm', 0.3);

    this.physics.world.setBounds(0, 90, WORLD_W, WORLD_H - 90); // y=90: sotto la facciata della chiesa
    this.drawMap();
    this.startFanciulloBubbles();

    for (const id of ['bubi', 'umberto', 'trande', 'cece', 'gnumma', 'gianfranco']) {
      generateSpriteTexture(this, id, CHAR_CONFIGS[id]);
    }

    this.dialogue = new DialogueSystem(this);

    // Gnumma – personaggio secondario vicino alla panchina sinistra
    const gnummaX = 148;
    const gnummaY = 237;
    addShadow(this, gnummaX, gnummaY);
    addNameLabel(this, gnummaX, gnummaY, 'gnumma');
    const gnummaSprite = this.add.sprite(gnummaX, gnummaY, 'char-gnumma', 1)
      .setScale(CHAR_SCALE).setDepth(gnummaY);
    gnummaSprite.play('gnumma-idle-right');
    makeFeetBody(this, gnummaSprite);
    this.npcs.push({ id: 'gnumma', sprite: gnummaSprite });

    // Gianfranco gira per la piazza in bicicletta (elemento d'ambiente)
    this.spawnGianfrancoCyclist();

    // Player (BUBI) parte in basso, bloccato durante il walk-in
    this.player = new PlayerController(this, 'bubi', 320, 350, this.dialogue);
    this.player.locked = true;

    // Solo collisioni ostacoli ora; quella con NPC aggiunta dopo il walk-in
    this.physics.add.collider(this.player.sprite, this.obstacles);

    // Camera: segue il player, limitata alla mappa
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    TransitionSystem.fadeFromBlack(this);
    TransitionSystem.announceArea(this, 'PIAZZA CAPPUCCINI – 2026');

    // Interazione con gli NPC: Spazio / Enter
    const kb = this.input.keyboard;
    if (kb) {
      const onInteract = (): void => this.tryInteract();
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', onInteract);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', onInteract);
    }

    // Touch: il tap interagisce con l'NPC vicino (oltre a Spazio/Enter)
    this.input.on('pointerdown', () => this.tryInteract());

    // Walk-in animation parte dopo il fade-in (600ms)
    this.time.delayedCall(600, () => this.startWalkInAnimation());
  }

  update(_time: number, delta: number): void {
    this.player.update(this.npcs);
    this.player.sprite.setDepth(this.player.sprite.y);
    this.animateWater();
    this.updateGianfranco(delta);
  }

  // ------------------------------------------------ Gianfranco (ciclista)

  /** Crea Gianfranco (sprite intero, con gambe) sulla bici; gira in updateGianfranco. */
  private spawnGianfrancoCyclist(): void {
    // Ruota centrata in (0,0), poi posizionata; ruota su se stessa (spin).
    const mkWheel = (): Phaser.GameObjects.Graphics => {
      const w = this.add.graphics();
      w.lineStyle(1.5, 0x1a1a1a); w.strokeCircle(0, 0, 4);      // copertone
      w.lineStyle(1, 0x888888);
      w.lineBetween(-4, 0, 4, 0); w.lineBetween(0, -4, 0, 4);   // raggi
      w.fillStyle(0x333333); w.fillCircle(0, 0, 1.2);           // mozzo
      return w;
    };
    const wheelL = mkWheel().setPosition(-9, 4);
    const wheelR = mkWheel().setPosition(9, 4);

    // Telaio + sella + manubrio + pedivella
    const frame = this.add.graphics();
    frame.lineStyle(2, 0xdd4455);
    frame.lineBetween(-9, 4, 2, -3);    // tubo obliquo
    frame.lineBetween(-9, 4, -2, -6);   // tubo sella
    frame.lineBetween(-2, -6, 5, -3);   // tubo orizzontale
    frame.lineBetween(5, -3, 9, 4);     // forcella anteriore
    frame.lineBetween(2, -3, -2, -6);   // reggisella
    frame.lineStyle(2, 0x333333);
    frame.lineBetween(5, -3, 6, -8);    // stelo manubrio
    frame.lineBetween(3, -8, 8, -8);    // manubrio
    frame.fillStyle(0x222222);
    frame.fillRect(-4, -7, 5, 2);       // sella
    frame.lineStyle(1.5, 0x444444);
    frame.lineBetween(-1, 4, -3, 6);    // pedivella

    // Ciclista: sprite intero (con gambe), in animazione di camminata.
    const rider = this.add.sprite(-1, -10, 'char-gianfranco', 1).setScale(CHAR_SCALE);
    rider.play('gianfranco-walk-right');

    // Ordine: ruote → telaio → ciclista (le gambe coprono il telaio).
    const c = this.add.container(500, 300, [wheelL, wheelR, frame, rider]);
    c.setDepth(300);

    // Nome sopra la testa — testo separato (non nel container) così NON si
    // specchia quando Gianfranco cambia verso; segue la sua posizione.
    const label = this.add.text(0, 0, 'GIANFRANCO', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px',
      color: '#e2596a',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);

    this.gianfranco = c;
    this.gianfrancoWheels = [wheelL, wheelR];
    this.gianfrancoLabel = label;
    this.gfRider = rider;
    this.gfState = 'riding';
    this.gfTarget = this.pickBikeTarget();
    this.gfFacingLeft = false;

    // Ogni tanto dice due parole balbettando
    this.startGianfrancoChatter();
  }

  private pickBikeTarget(): { x: number; y: number } {
    return {
      x: Phaser.Math.Between(BIKE_ROAM.minX, BIKE_ROAM.maxX),
      y: Phaser.Math.Between(BIKE_ROAM.minY, BIKE_ROAM.maxY),
    };
  }

  /**
   * Vagabondaggio casuale: pedala verso un target; arrivato, a volte si ferma
   * un po' e poi riparte, a volte punta subito un nuovo target. Nome e nuvoletta
   * lo seguono; le ruote girano e le gambe si animano solo mentre pedala.
   */
  private updateGianfranco(delta: number): void {
    const c = this.gianfranco;
    if (!c || !c.active) return;
    const dt = delta / 1000;

    let moving = false;
    if (this.gfState === 'stopped') {
      this.gfStopMs -= delta;
      if (this.gfStopMs <= 0) {
        this.gfTarget = this.pickBikeTarget();
        this.gfState = 'riding';
      }
    } else {
      const dx = this.gfTarget.x - c.x;
      const dy = this.gfTarget.y - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 5) {
        // Arrivato: 50% si ferma un attimo, 50% riparte verso un nuovo punto
        if (Math.random() < 0.5) {
          this.gfState = 'stopped';
          this.gfStopMs = Phaser.Math.Between(800, 2800);
        } else {
          this.gfTarget = this.pickBikeTarget();
        }
      } else {
        const step = Math.min(dist, BIKE_SPEED * dt);
        c.x += (dx / dist) * step;
        c.y += (dy / dist) * step;
        moving = true;
        if (Math.abs(dx) > 2) this.gfFacingLeft = dx < 0; // gira solo su moto orizz.
      }
    }

    c.setDepth(c.y);
    c.setScale(this.gfFacingLeft ? -1 : 1, 1);

    // Gambe: cammina mentre pedala, idle da fermo
    const rider = this.gfRider;
    if (rider) {
      const want = moving ? 'gianfranco-walk-right' : 'gianfranco-idle-right';
      if (rider.anims.currentAnim?.key !== want) rider.play(want);
    }

    // Ruote: girano solo mentre pedala
    if (moving) for (const w of this.gianfrancoWheels) w.rotation += 0.42;

    // Nome sopra la testa
    this.gianfrancoLabel?.setPosition(c.x, c.y - 30).setDepth(c.y + 40);
    // Nuvoletta (se attiva) sopra il nome
    this.gfBubble?.setPosition(c.x, c.y - 40).setDepth(c.y + 41);
  }

  /** Pianifica battute balbettate a intervalli casuali finché Gianfranco è attivo. */
  private startGianfrancoChatter(): void {
    const say = (): void => {
      if (this.gianfranco?.active) this.showGianfrancoSpeech();
      this.time.delayedCall(Phaser.Math.Between(5000, 9000), say);
    };
    this.time.delayedCall(Phaser.Math.Between(2500, 4500), say);
  }

  /** Nuvoletta con due parole balbettate sopra la testa (non si specchia). */
  private showGianfrancoSpeech(): void {
    const c = this.gianfranco;
    if (!c || this.gfBubble) return; // non accavallare due nuvolette
    // Frasi in ordine di scrittura (poi si riparte dalla prima)
    const phrase = GIANFRANCO_STUTTER[this.gfSpeechIdx % GIANFRANCO_STUTTER.length];
    this.gfSpeechIdx++;

    const PAD_X = 8, PAD_T = 6, PAD_B = 6, TIP = 7;
    const txt = this.add.text(0, -TIP - PAD_B, phrase, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px', color: '#111111', align: 'center',
    }).setOrigin(0.5, 1);

    const pw = Math.max(Math.ceil(txt.width) + PAD_X * 2, 34);
    const ph = Math.ceil(txt.height) + PAD_T + PAD_B;
    const bg = this.add.graphics();
    bg.fillStyle(0xfffef0, 0.97); bg.lineStyle(1, 0x444444, 1);
    bg.fillRoundedRect(-pw / 2, -TIP - ph, pw, ph, 4);
    bg.strokeRoundedRect(-pw / 2, -TIP - ph, pw, ph, 4);
    // Codina verso il basso (punta alla testa)
    bg.fillStyle(0xfffef0, 0.97); bg.fillTriangle(-4, -TIP, 4, -TIP, 0, 0);
    bg.lineStyle(1, 0x444444, 1);
    bg.beginPath(); bg.moveTo(-4, -TIP); bg.lineTo(0, 0); bg.lineTo(4, -TIP); bg.strokePath();

    const bubble = this.add.container(c.x, c.y - 40, [bg, txt])
      .setDepth(c.y + 41).setAlpha(0);
    this.gfBubble = bubble;

    this.tweens.add({
      targets: bubble, alpha: 1, duration: 150,
      onComplete: () => this.time.delayedCall(2200, () => {
        this.tweens.add({
          targets: bubble, alpha: 0, duration: 250,
          onComplete: () => {
            bubble.destroy();
            if (this.gfBubble === bubble) this.gfBubble = undefined;
          },
        });
      }),
    });
  }

  // ------------------------------------------------------------ eventi

  private startWalkInAnimation(): void {
    // Posizioni finali: cerchio attorno alla fontana (x=320, y=190, r=30)
    const finalT  = { x: FOUNTAIN.x - 42, y: FOUNTAIN.y + 30 }; // Trande  – sinistra
    const finalU  = { x: FOUNTAIN.x + 42, y: FOUNTAIN.y + 30 }; // Umberto – destra
    const finalB  = { x: FOUNTAIN.x,      y: FOUNTAIN.y + 58 }; // Bubi    – sotto

    // ── Trande ───────────────────────────────────────────────────────────
    const tShadow = addShadow(this, 210, 350);
    const tLabel  = addNameLabel(this, 210, 350, 'trande');
    const tSprite = this.add.sprite(210, 350, 'char-trande', 1).setScale(CHAR_SCALE).setDepth(350);
    tSprite.play('trande-walk-up');
    makeFeetBody(this, tSprite);
    this.npcs.push({ id: 'trande', sprite: tSprite });

    // ── Umberto ──────────────────────────────────────────────────────────
    const uShadow = addShadow(this, 430, 350);
    const uLabel  = addNameLabel(this, 430, 350, 'umberto');
    const uSprite = this.add.sprite(430, 350, 'char-umberto', 1).setScale(CHAR_SCALE).setDepth(350);
    uSprite.play('umberto-walk-up');
    makeFeetBody(this, uSprite);
    this.npcs.push({ id: 'umberto', sprite: uSprite });

    // ── Bubi (player) ────────────────────────────────────────────────────
    const bShadow = addShadow(this, this.player.sprite.x, this.player.sprite.y);
    this.player.cutsceneAnim = 'bubi-walk-up';

    // Quando tutti e tre arrivano → idle + dialogo
    let arrivals = 0;
    const onArrival = (): void => {
      if (++arrivals < 3) return;

      tSprite.play('trande-idle-down');
      uSprite.play('umberto-idle-down');
      // Breve idle-up (di spalle verso la fontana) fino all'inizio del dialogo
      this.player.cutsceneAnim = 'bubi-idle-up';

      // Aggiorna body statici solo degli NPC walk-in (tSprite/uSprite):
      // i loro StaticBody erano rimasti alla posizione di spawn durante il tween.
      // Gnumma NON va toccato: non si è mai mosso e il suo body è già corretto.
      for (const s of [tSprite, uSprite]) {
        const b = s.body as Phaser.Physics.Arcade.StaticBody;
        b.reset(s.x, s.y + 8);
      }

      // Aggiungi collisione player ↔ NPC ora che sono in posizione
      this.physics.add.collider(this.player.sprite, this.npcs.map((n) => n.sprite));

      // Shadow temporanea di Bubi rimossa (il player non l'ha durante il gioco)
      bShadow.destroy();

      this.time.delayedCall(400, () => this.startIntro());
    };

    // ── Tween Trande ─────────────────────────────────────────────────────
    this.tweens.add({
      targets: tSprite,
      x: finalT.x, y: finalT.y,
      duration: 2200, ease: 'Linear',
      onUpdate: () => {
        tSprite.setDepth(tSprite.y);
        tShadow.setPosition(tSprite.x, tSprite.y + SHADOW_OFFSET_Y).setDepth(tSprite.y - 1);
        tLabel.setPosition(tSprite.x, tSprite.y - 20).setDepth(tSprite.y + 1);
      },
      onComplete: () => onArrival(),
    });

    // ── Tween Umberto ────────────────────────────────────────────────────
    this.tweens.add({
      targets: uSprite,
      x: finalU.x, y: finalU.y,
      duration: 2200, ease: 'Linear',
      onUpdate: () => {
        uSprite.setDepth(uSprite.y);
        uShadow.setPosition(uSprite.x, uSprite.y + SHADOW_OFFSET_Y).setDepth(uSprite.y - 1);
        uLabel.setPosition(uSprite.x, uSprite.y - 20).setDepth(uSprite.y + 1);
      },
      onComplete: () => onArrival(),
    });

    // ── Tween Bubi (dynamic body → reset in onUpdate) ────────────────────
    this.tweens.add({
      targets: this.player.sprite,
      x: finalB.x, y: finalB.y,
      duration: 2200, ease: 'Linear',
      onUpdate: () => {
        const s = this.player.sprite;
        s.setDepth(s.y);
        bShadow.setPosition(s.x, s.y + SHADOW_OFFSET_Y).setDepth(s.y - 1);
        (s.body as Phaser.Physics.Arcade.Body).reset(s.x, s.y);
      },
      onComplete: () => onArrival(),
    });
  }

  private startIntro(): void {
    // Torna all'idle normale (faccia visibile) durante il dialogo
    this.player.cutsceneAnim = null;
    this.dialogue.start({
      lines: INTRO_LINES,
      onComplete: () => {
        this.player.locked = false;
        this.showMovementHint();
        // Cece entra 10s dopo che il player parla con Gnumma (vedi tryInteract)
      },
    });
  }

  private showMovementHint(): void {
    // Box fisso in alto al centro dello schermo (scrollFactor=0, coordinate zoom-compensate)
    const cx = 240 + UI_OFF_X;  // W/2 + UI_OFF_X = centro orizzontale schermo
    const ty = UI_OFF_Y + 18;   // 18px dal bordo superiore del viewport
    const FONT = '"Press Start 2P", monospace';

    const bg = this.add.rectangle(cx, ty, 296, 22, 0x000000, 0.78)
      .setStrokeStyle(1, 0xffe14d, 0.7)
      .setScrollFactor(0).setDepth(8000).setAlpha(0);
    const label = this.add.text(cx, ty, 'WASD / frecce  –  muovi Bubi', {
      fontFamily: FONT, fontSize: '6px', color: '#ffe14d',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(8001).setAlpha(0);

    this.tweens.add({ targets: [bg, label], alpha: 1, duration: 350 });
    this.time.delayedCall(4500, () => {
      this.tweens.add({
        targets: [bg, label], alpha: 0, duration: 600,
        onComplete: () => { bg.destroy(); label.destroy(); },
      });
    });
  }

  private ceceEnters(): void {
    // Da qui in poi niente nuove chiacchiere con gli NPC: il finale ha priorità
    this.finaleQueued = true;
    // Blocca il player e sposta la camera su Cece
    this.player.locked = true;
    this.cameras.main.stopFollow();
    this.cameras.main.pan(320, 250, 900, 'Sine.easeInOut');

    const cece = this.add
      .sprite(320, WORLD_H + FRAME_H / 2, 'char-cece', 1)
      .setScale(CHAR_SCALE);
    const shadow = addShadow(this, cece.x, cece.y);
    const label = addNameLabel(this, cece.x, cece.y, 'cece');
    cece.play('cece-walk-up');
    this.tweens.add({
      targets: cece,
      y: 250,
      duration: 1500, // ~90px/s
      onUpdate: () => {
        cece.setDepth(cece.y);
        shadow.setPosition(cece.x, cece.y + SHADOW_OFFSET_Y).setDepth(cece.y - 1);
        label.setPosition(cece.x, cece.y - 20).setDepth(cece.y + 1);
      },
      onComplete: () => {
        cece.play('cece-idle-down');
        this.npcs.push({ id: 'cece', sprite: cece });
        this.startFinale();
      },
    });
  }

  private startFinale(): void {
    this.player.locked = true;
    // Se il player sta ancora parlando con un NPC, il dialogo di Cece
    // parte FORZATO appena quello si chiude (altrimenti si bloccherebbe).
    if (this.dialogue.isActive) {
      this.events.once('dialogue-end', () => this.startFinale());
      return;
    }
    this.dialogue.start({
      lines: CECE_LINES,
      onComplete: () => void this.ceceTeleportsEveryone(),
    });
  }

  /** Cece teletrasporta tutti con la forza dell'AI → flashback 2015. */
  private async ceceTeleportsEveryone(): Promise<void> {
    this.player.locked = true;

    if (!this.textures.exists('battle-px')) {
      const g = this.make.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture('battle-px', 4, 4);
      g.destroy();
    }
    // Particelle "AI" su tutti i presenti
    const everyone = [this.player.sprite, ...this.npcs.map((n) => n.sprite)];
    for (const s of everyone) {
      const em = this.add
        .particles(s.x, s.y, 'battle-px', {
          speed: { min: 30, max: 110 },
          lifespan: 600,
          scale: { start: 1.4, end: 0 },
          tint: [0xaa55ff, 0xffffff, 0x8800ff],
          emitting: false,
        })
        .setDepth(1600);
      em.explode(30);
      this.tweens.add({ targets: s, alpha: 0, duration: 500 });
    }

    // Anche Gianfranco (il ciclista d'ambiente), il nome e la nuvoletta svaniscono
    if (this.gianfranco) {
      const targets: Phaser.GameObjects.GameObject[] = [this.gianfranco];
      if (this.gianfrancoLabel) targets.push(this.gianfrancoLabel);
      if (this.gfBubble) targets.push(this.gfBubble);
      this.tweens.add({ targets, alpha: 0, duration: 500 });
      this.gianfranco.setActive(false); // ferma updateGianfranco
    }

    await new Promise<void>((resolve) => this.time.delayedCall(450, resolve));
    await TransitionSystem.teleportToScene(this, 'StradaScene');
  }

  private tryInteract(): void {
    if (this.dialogue.isActive || this.player.locked || this.finaleQueued) return;
    const npc = this.player.nearbyNpc;
    if (!npc) return;
    const lines = NPC_DIALOGUES[npc.id];
    if (!lines) return;

    // Gnumma: al termine del dialogo parte il countdown da 10s per Cece
    if (npc.id === 'gnumma' && !this.ceceTimerStarted) {
      this.dialogue.start({
        lines,
        onComplete: () => {
          this.ceceTimerStarted = true;
          this.time.delayedCall(10000, () => this.ceceEnters());
        },
      });
    } else {
      this.dialogue.start({ lines });
    }
  }

  // ------------------------------------------------------------ setup

  private addObstacle(x: number, y: number, w: number, h: number): void {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(r, true);
    this.obstacles.push(r);
  }

  // ------------------------------------------------------------ mappa

  private drawMap(): void {
    const g = this.make.graphics();

    // Pavimento: basoli 16x16 con giunti
    g.fillStyle(0x9a917f); // colore dei giunti
    g.fillRect(0, 0, WORLD_W, WORLD_H);
    const stones = [0xd6cbb2, 0xc9bfa6, 0xbdb49d, 0xcfc6ae];
    for (let ty = 0; ty < WORLD_H / TILE; ty++) {
      for (let tx = 0; tx < WORLD_W / TILE; tx++) {
        g.fillStyle(stones[(tx * 7 + ty * 13) % stones.length]);
        g.fillRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
      }
    }

    this.drawChurch(g);
    this.drawCafe(g);
    this.drawFoodCart(g);
    this.drawFountain(g);

    // Alberi ai bordi
    const trees: [number, number][] = [
      // originali (angoli e bordi lontani)
      [60, 70], [140, 50], [500, 50], [580, 70],
      [60, 300], [580, 300], [620, 200], [20, 230],
      // lato sinistro (visibili nel frame)
      [115, 100], [115, 220], [115, 310],
      // lato destro (visibili nel frame)
      [525, 100], [525, 220], [525, 310],
      // affiancano la chiesa in alto
      [210, 96], [430, 96],
      // angoli in basso fuori dal percorso walk-in
      [148, 332], [492, 332],
    ];
    for (const [x, y] of trees) this.drawTree(g, x, y);

    // Lampioni
    const lamps: [number, number][] = [
      [180, 120],
      [460, 120],
      [180, 260],
      [460, 260],
    ];
    for (const [x, y] of lamps) this.drawLamp(g, x, y);

    // Panchine di pietra liscia ai lati della piazza
    const benches: [number, number][] = [
      [140, 215], [140, 295],  // lato sinistro
      [500, 215], [500, 295],  // lato destro
    ];
    for (const [x, y] of benches) this.drawBench(g, x, y);

    // Pre-render della mappa statica in texture (non ridisegnata ogni frame)
    if (!this.textures.exists('tex-map-piazza')) {
      g.generateTexture('tex-map-piazza', WORLD_W, WORLD_H);
    }
    g.destroy();
    this.add.image(0, 0, 'tex-map-piazza').setOrigin(0).setDepth(-10);

    // Graphics separato per l'acqua animata
    this.waterFx = this.add.graphics();
  }

  private drawFountain(g: Phaser.GameObjects.Graphics): void {
    const { x, y } = FOUNTAIN;
    g.fillStyle(0x8d8d96); // pietra
    g.fillCircle(x, y, 30);
    g.lineStyle(2, 0x6e6e78);
    g.strokeCircle(x, y, 30);
    g.fillStyle(0x3a6ed8); // acqua
    g.fillCircle(x, y, 23);
    g.lineStyle(1, 0xaaaab4);
    g.strokeCircle(x, y, 24);
    // zampillo centrale
    g.fillStyle(0x8d8d96);
    g.fillCircle(x, y, 5);
    this.addObstacle(x - 30, y - 26, 60, 52);
  }

  private animateWater(): void {
    const { x, y } = FOUNTAIN;
    const t = this.time.now / 700;
    this.waterFx.clear();
    // due cerchi concentrici che si espandono e svaniscono
    for (const offset of [0, 0.5]) {
      const p = (t + offset) % 1;
      this.waterFx.lineStyle(1, 0x9ec5ff, 0.8 * (1 - p));
      this.waterFx.strokeCircle(x, y, 6 + p * 15);
    }
  }

  // ---------------------------------------------------------- nuvolette Fanciullo

  private startFanciulloBubbles(): void {
    // Centro del carro (x=454+42=496, tetto a y=140)
    const CX = 496;
    const BY = 132; // fondo della bolla (appena sopra il tetto)

    const phrases = [
      'ci te mintu\nntru paninu??',
      'nci sta lu\nprosciuttu!',
      'bella giuvintù,\ncci vuliti?',
      'cipudda\no senza??',
    ];
    let idx = 0;

    const showBubble = (): void => {
      const label = phrases[idx];
      idx = (idx + 1) % phrases.length;

      const PAD_X = 10; // padding orizzontale su ciascun lato
      const PAD_T = 8;  // padding top
      const PAD_B = 7;  // padding bottom

      // Crea testo prima per misurarne le dimensioni reali
      const txt = this.add
        .text(CX, BY - PAD_B, label, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '5px',
          color: '#111111',
          align: 'center',
          lineSpacing: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(501)
        .setAlpha(0);

      // Larghezza minima 80px per sicurezza (font potrebbe non essere ancora caricato)
      const pw = Math.max(Math.ceil(txt.width) + PAD_X * 2, 80);
      const ph = Math.ceil(txt.height) + PAD_T + PAD_B;
      const px = CX - pw / 2;
      const py = BY - ph;

      const bg = this.add.graphics().setDepth(500).setAlpha(0);
      // Bolla bianca con bordo
      bg.fillStyle(0xfffef0, 0.97);
      bg.lineStyle(1, 0x444444, 1);
      bg.fillRoundedRect(px, py, pw, ph, 4);
      bg.strokeRoundedRect(px, py, pw, ph, 4);
      // Codina triangolare verso il basso (verso il bancone)
      const tx = CX;
      const ty = py + ph;
      bg.fillStyle(0xfffef0, 0.97);
      bg.fillTriangle(tx - 5, ty, tx + 5, ty, tx, ty + 7);
      // Bordo della codina (solo i due lati laterali)
      bg.lineStyle(1, 0x444444, 1);
      bg.beginPath();
      bg.moveTo(tx - 5, ty);
      bg.lineTo(tx, ty + 7);
      bg.lineTo(tx + 5, ty);
      bg.strokePath();

      this.tweens.add({
        targets: [bg, txt],
        alpha: 1,
        duration: 200,
        onComplete: () => {
          this.time.delayedCall(2600, () => {
            this.tweens.add({
              targets: [bg, txt],
              alpha: 0,
              duration: 300,
              onComplete: () => { bg.destroy(); txt.destroy(); },
            });
          });
        },
      });

      this.time.delayedCall(Phaser.Math.Between(5500, 8000), showBubble);
    };

    this.time.delayedCall(2500, showBubble);
  }

  private drawChurch(g: Phaser.GameObjects.Graphics): void {
    // Facciata semplice in alto al centro
    g.fillStyle(0xe9e1d1);
    g.fillRect(250, 14, 140, 76);
    g.fillStyle(0xded5c2); // timpano
    g.fillTriangle(244, 16, 396, 16, 320, -18);
    g.fillStyle(0xcbc2af); // cornicione
    g.fillRect(244, 14, 152, 4);
    // croce
    g.fillStyle(0x5a5046);
    g.fillRect(318, -34, 4, 14);
    g.fillRect(313, -30, 14, 4);
    // rosone — cornice in pietra
    g.fillStyle(0xd5ccb9);
    g.fillCircle(320, 40, 11);
    // vetro base azzurro
    g.fillStyle(0x8fb4d9);
    g.fillCircle(320, 40, 9);
    // 6 petali scuri attorno al centro (pattern rosone gotico)
    g.fillStyle(0x5d8ab0);
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      g.fillCircle(320 + Math.cos(ang) * 5, 40 + Math.sin(ang) * 5, 3);
    }
    // centro chiaro (occhio centrale)
    g.fillStyle(0xd0eaff);
    g.fillCircle(320, 40, 2);
    // raggi (spezie)
    g.lineStyle(1, 0x3a6080, 0.85);
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      g.lineBetween(320, 40, 320 + Math.cos(ang) * 9, 40 + Math.sin(ang) * 9);
    }
    // bordo esterno
    g.lineStyle(1, 0x5a7a9a, 1);
    g.strokeCircle(320, 40, 9);
    // portone ad arco
    g.fillStyle(0x6b4a2f);
    g.fillRect(305, 60, 30, 30);
    g.fillCircle(320, 60, 15);
    // lesene laterali
    g.fillStyle(0xd5ccb9);
    g.fillRect(252, 16, 6, 74);
    g.fillRect(382, 16, 6, 74);
    this.addObstacle(244, 0, 152, 92);
  }

  private drawCafe(g: Phaser.GameObjects.Graphics): void {
    // Edificio spostato verso il centro (da x=8 a x=90)
    g.fillStyle(0xdac9a5);
    g.fillRect(90, 130, 76, 56);
    g.lineStyle(1, 0xb3a382);
    g.strokeRect(90, 130, 76, 56);
    // porta e vetrina
    g.fillStyle(0x5d4530);
    g.fillRect(120, 158, 16, 28);
    g.fillStyle(0x9fc4d8);
    g.fillRect(96, 142, 18, 14);
    g.fillRect(142, 142, 18, 14);
    // tenda a strisce
    for (let i = 0; i < 7; i++) {
      g.fillStyle(i % 2 === 0 ? 0xb33a3a : 0xf0ead8);
      g.fillRect(88 + i * 12, 124, 12, 9);
    }
    this.add
      .text(128, 108, 'CAFFÈ\nCAPPUCCINI', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '6px',
        color: '#ffdd99',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1);
    this.addObstacle(88, 124, 80, 62);
  }

  private drawFoodCart(g: Phaser.GameObjects.Graphics): void {
    // ── FANCIULLO FAST FOOD – centro x=496, roof x=454-538 ──────────────

    // Ruote dettagliate
    for (const wx of [474, 518]) {
      g.fillStyle(0x1a1a1a);  g.fillCircle(wx, 188, 7);
      g.fillStyle(0x888888);  g.fillCircle(wx, 188, 4);
      g.fillStyle(0xdddddd);  g.fillCircle(wx, 188, 2);
      g.fillStyle(0x444444);  g.fillCircle(wx, 188, 1);
    }

    // Chassis inferiore
    g.fillStyle(0x2a2a2a);
    g.fillRect(462, 183, 68, 6);

    // Corpo bianco (unità refrigerata)
    g.fillStyle(0xf4f4f0);
    g.fillRect(462, 157, 68, 26);
    g.lineStyle(1, 0xd0d0c8);
    g.strokeRect(462, 157, 68, 26);
    // riflessione cromata verticale
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(463, 158, 3, 24);

    // Bancone servizio (verde scuro come la foto)
    g.fillStyle(0x1e3a1e);
    g.fillRect(464, 167, 64, 14);
    g.lineStyle(1, 0x2d5a2d);
    g.strokeRect(464, 167, 64, 14);
    // vetrinetta paninoteca: rettangoli food
    g.fillStyle(0xd4a060); g.fillRect(468, 170, 12, 7);  // panino sx
    g.fillStyle(0xcc4400); g.fillRect(470, 172, 8, 3);   // ripieno sx
    g.fillStyle(0xd4a060); g.fillRect(500, 170, 12, 7);  // panino dx
    g.fillStyle(0x33aa33); g.fillRect(502, 172, 8, 3);   // ripieno verde dx
    g.fillStyle(0xd4a060); g.fillRect(516, 170, 10, 7);  // terzo panino

    // Pannello sign giallo/arancio (ispirato alla foto reale)
    // Gradiente manuale: 3 strisce
    g.fillStyle(0xffcc00); g.fillRect(454, 140, 84, 6);   // giallo chiaro in cima
    g.fillStyle(0xffaa00); g.fillRect(454, 146, 84, 5);   // arancio medio
    g.fillStyle(0xff8800); g.fillRect(454, 151, 84, 6);   // arancio scuro in basso
    // Bordo blu del pannello sign (come nella foto)
    g.lineStyle(2, 0x1144bb);
    g.strokeRect(454, 140, 84, 17);

    // Cornicione arancio/rosso (awning sopra il pannello)
    g.fillStyle(0xff5500); g.fillRect(452, 136, 88, 5);
    g.fillStyle(0xdd3300); g.fillRect(452, 136, 88, 2);
    // Frangette dell'awning (triangolini)
    g.fillStyle(0xff5500);
    for (let i = 0; i < 8; i++) {
      const fx = 454 + i * 11;
      g.fillTriangle(fx, 141, fx + 5, 141, fx + 2, 145);
    }

    // Badge circolare "F" a sinistra del sign (come logo Fast Food)
    g.fillStyle(0x0033aa); g.fillCircle(465, 148, 6);
    g.fillStyle(0xffcc00); g.fillCircle(465, 148, 5);
    g.fillStyle(0x0033aa); g.fillCircle(465, 148, 4);
    // "F" stilizzata: due lineette orizzontali + verticale
    g.fillStyle(0xffcc00);
    g.fillRect(463, 144, 4, 1); // top
    g.fillRect(463, 146, 3, 1); // mid
    g.fillRect(463, 144, 1, 5); // vert

    // Hotdog/panino disegnato a destra del sign
    g.fillStyle(0xd4a060); g.fillEllipse(528, 147, 14, 6); // pane
    g.fillStyle(0xcc4400); g.fillRect(522, 147, 12, 3);    // salsiccia
    g.fillStyle(0x88cc44); g.fillRect(522, 146, 12, 1);    // senape/verde
    // riflesso pane
    g.fillStyle(0xf0c070, 0.6); g.fillEllipse(526, 145, 7, 2);

    // "FANCIULLO" in blu con stroke bianco sopra il sign
    this.add.text(492, 155, 'FANCIULLO', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#1144cc',
      stroke: '#ffffff',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(1);

    // Tagline minuscola
    this.add.text(492, 158, 'fast food dal 1969', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px',
      color: '#cc3300',
    }).setOrigin(0.5, 0).setDepth(1);

    this.addObstacle(454, 136, 84, 58);
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // ombra al suolo
    g.fillStyle(0x888070, 0.3); g.fillEllipse(x + 1, y + 2, 14, 4);
    // tronco con riflesso
    g.fillStyle(0x5a3010); g.fillRect(x - 3, y - 6, 6, 12);
    g.fillStyle(0x7a4820); g.fillRect(x - 3, y - 6, 2, 12);
    // chioma — ombra
    g.fillStyle(0x1a4808); g.fillCircle(x + 2, y - 16, 13);
    // chioma — base
    g.fillStyle(0x2e6b18); g.fillCircle(x, y - 18, 12);
    // chioma — midtone
    g.fillStyle(0x3a8022); g.fillCircle(x - 2, y - 22, 9);
    // chioma — highlight
    g.fillStyle(0x52a030); g.fillCircle(x - 5, y - 26, 5);
    this.addObstacle(x - 7, y - 6, 14, 12);
  }

  private drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // alone luminoso (più caldo + 2 livelli)
    g.fillStyle(0xffee88, 0.07); g.fillCircle(x, y - 28, 22);
    g.fillStyle(0xffdd66, 0.14); g.fillCircle(x, y - 28, 14);
    g.fillStyle(0xffcc44, 0.20); g.fillCircle(x, y - 28, 8);
    // base
    g.fillStyle(0x2a2a36); g.fillRect(x - 4, y - 1, 8, 3);
    // palo verticale
    g.fillStyle(0x3a3a48); g.fillRect(x - 1, y - 28, 3, 30);
    g.fillStyle(0x5050600, 0.3); g.fillRect(x - 1, y - 28, 1, 30);
    // braccio curvo
    g.fillStyle(0x3a3a48);
    g.fillRect(x, y - 28, 10, 2); // orizzontale
    g.fillRect(x + 8, y - 28, 2, 5); // verticale breve
    // lanterna
    g.fillStyle(0x444455); g.fillRect(x + 5, y - 24, 8, 8);
    g.fillStyle(0xffe14d); g.fillRect(x + 6, y - 23, 6, 6); // luce
    g.fillStyle(0x333344); g.fillRect(x + 4, y - 24, 10, 2); // cappello
    this.addObstacle(x - 2, y - 2, 6, 6);
  }

  private drawBench(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Ombra al suolo
    g.fillStyle(0x887860, 0.22); g.fillEllipse(x, y + 7, 28, 5);
    // Supporti laterali (gambe)
    g.fillStyle(0xa09088); g.fillRect(x - 9, y, 3, 6); g.fillRect(x + 6, y, 3, 6);
    // Piano seduta – lastra di pietra
    g.fillStyle(0xcec6ba); g.fillRect(x - 11, y - 3, 22, 5);
    // Bordo frontale (spessore lastra)
    g.fillStyle(0xa8a098); g.fillRect(x - 11, y + 2, 22, 2);
    // Riflesso chiaro in cima
    g.fillStyle(0xe0dcd4); g.fillRect(x - 10, y - 3, 20, 1);
    // Venatura nella pietra
    g.fillStyle(0xb8b0a4, 0.45); g.fillRect(x - 4, y - 1, 7, 1);
    this.addObstacle(x - 11, y - 3, 22, 9);
  }
}
