import Phaser from 'phaser';
import { DialogueSystem, type DialogueLine } from '../systems/DialogueSystem';
import {
  addNameLabel,
  addShadow,
  CHAR_CONFIGS,
  CHAR_SCALE,
  generateSpriteTexture,
  loadPortraits,
  makeFeetBody,
} from '../systems/CharacterSprite';
import { PlayerController, type InteractableNpc } from '../systems/PlayerController';
import { TransitionSystem } from '../systems/TransitionSystem';
import { AudioManager } from '../systems/AudioManager';

// Flashback: Tricase, 2015. Vista laterale, si cammina verso destra.
const WORLD_W = 960;
const WORLD_H = 270;
const FONT = '"Press Start 2P", monospace';

// Stordito dal salto temporale, ma per lui è una normale mattina del 2015
const DAZED_LINES: DialogueLine[] = [
  { speaker: 'bubi', text: '...Porca madonna! Sta me gira a capu...' },
  { speaker: 'bubi', text: '...vabe tocca me movu' },
  {
    speaker: 'bubi',
    text: 'Tocca vo alla scola',
  },
];

const CONFRONT_LINES: DialogueLine[] = [
  { speaker: 'chiara', text: 'Uh quanto sei spiritoso Umberto ahahahahah... mi fai morire' },
  { speaker: 'umberto', text: 'Anche tu sei molto pucciosa *hihihi*' },
  { speaker: 'bubi', text: 'Ou ma che cazzu sta faci cu la vagnona mia... te scannu!' },
  { speaker: 'umberto', text: 'Gabrielino ma addu vai' },
  { speaker: 'bubi', text: 'Nahh porco dio... mo te cciu' },
  { speaker: 'bubi', text: 'Ve cu mie ve...' },
];

// Alessandra blocca Bubi a metà strada
const ALESSANDRA_LINES: DialogueLine[] = [
  { speaker: 'alessandra marzo', text: 'Ciao gabri, cosa fai questa sera?' },
  { speaker: 'bubi', text: 'Ma levate mannaggia alla madonna' },
];

export class StradaScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;
  private player!: PlayerController;
  private npcs: InteractableNpc[] = [];
  private confronted = false;
  private alessandraTriggered = false;
  private clouds: Array<{ g: Phaser.GameObjects.Graphics; speed: number }> = [];

  constructor() {
    super('StradaScene');
  }

  preload(): void {
    loadPortraits(this, ['bubi', 'umberto', 'chiara', 'alessandra']);
    // Foto reale di Alessandra come avatar del dialogo (speaker 'alessandra marzo').
    // Caricata sotto la chiave cercata dalla DialogueSystem: così il volto
    // procedurale sotto (fallback) viene saltato dal guard `!textures.exists`.
    this.load.image('portrait-alessandra marzo-png', 'assets/sprites/alessandra.png');
  }

  create(): void {
    this.npcs = [];
    this.confronted = false;
    this.alessandraTriggered = false;
    this.clouds = [];

    this.drawMap();
    this.spawnAnimatedClouds();

    for (const id of ['bubi', 'umberto', 'chiara', 'alessandra']) {
      generateSpriteTexture(this, id, CHAR_CONFIGS[id]);
    }

    // Striscia percorribile: marciapiede + strada (y=195 = inizio asfalto)
    this.physics.world.setBounds(0, 192, WORLD_W, WORLD_H - 192);

    // Umberto e Chiara a 2/3 della mappa, uno di fronte all'altra
    this.spawnNpc('umberto', 630, 215, 'right');
    this.spawnNpc('chiara', 668, 212, 'left');

    // Ritratto procedurale di Alessandra Marzo (calva, rotondetta)
    // Generato una volta sola — viene usato dalla DialogueSystem come portrait
    if (!this.textures.exists('portrait-alessandra marzo-png')) {
      const S = 80;
      const ct = this.textures.createCanvas('portrait-alessandra marzo-png', S, S);
      if (!ct) throw new Error('createCanvas failed');
      const c = ct.getContext();
      c.imageSmoothingEnabled = false;
      // Sfondo identità (camicia rosa)
      c.fillStyle = '#ff99cc';
      c.fillRect(0, 0, S, S);
      // Testa calva grande, leggermente larga per viso cicciotto
      c.fillStyle = '#e8b88a';
      c.beginPath();
      c.arc(40, 38, 26, 0, Math.PI * 2);
      c.fill();
      // Guance sporgenti ai lati
      c.fillStyle = '#daa87a';
      c.beginPath();
      c.ellipse(15, 46, 9, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(65, 46, 9, 7, 0, 0, Math.PI * 2);
      c.fill();
      // Lucentezza sulla testa calva
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.ellipse(29, 22, 8, 5, -0.5, 0, Math.PI * 2);
      c.fill();
      // Sopracciglia
      c.fillStyle = '#5a3010';
      c.fillRect(22, 30, 14, 3);
      c.fillRect(44, 30, 14, 3);
      // Occhi (bianco sclerale)
      c.fillStyle = '#ffffff';
      c.fillRect(22, 34, 12, 10);
      c.fillRect(46, 34, 12, 10);
      // Iride scura
      c.fillStyle = '#3a1800';
      c.fillRect(24, 35, 8, 8);
      c.fillRect(48, 35, 8, 8);
      // Lucina pupilla
      c.fillStyle = '#ffffff';
      c.fillRect(29, 36, 2, 2);
      c.fillRect(53, 36, 2, 2);
      // Naso
      c.fillStyle = '#c99060';
      c.fillRect(38, 46, 4, 2);
      // Bocca sorridente (U pixel art)
      c.fillStyle = '#8a3028';
      c.fillRect(30, 54, 20, 3);
      c.fillRect(28, 51, 4, 4);
      c.fillRect(48, 51, 4, 4);
      // Blush guance
      c.fillStyle = 'rgba(255,110,130,0.55)';
      c.beginPath();
      c.ellipse(16, 48, 7, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(64, 48, 7, 5, 0, 0, Math.PI * 2);
      c.fill();
      // Colletto visibile in fondo
      c.fillStyle = '#ff99cc';
      c.fillRect(0, 65, S, 15);
      c.fillStyle = '#ffffff';
      c.fillRect(28, 65, 24, 15);
      ct.refresh();
    }

    // Alessandra Marzo — blocca Bubi a metà strada (auto-trigger via update)
    const aleX = 385, aleY = 216;
    addShadow(this, aleX, aleY);
    // Nome label con cognome
    this.add.text(aleX, aleY - 20, 'ALESSANDRA MARZO', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px',
      color: '#ff99cc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(aleY + 1);
    const aleSprite = this.add.sprite(aleX, aleY, 'char-alessandra', 1)
      .setScale(CHAR_SCALE).setDepth(aleY);
    aleSprite.play('alessandra-idle-left');
    makeFeetBody(this, aleSprite);

    this.dialogue = new DialogueSystem(this);
    this.player = new PlayerController(this, 'bubi', 60, 220, this.dialogue);

    this.physics.add.collider(
      this.player.sprite,
      this.npcs.map((n) => n.sprite)
    );
    this.physics.add.collider(this.player.sprite, aleSprite);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    TransitionSystem.fadeFromBlack(this, 600);
    // BGM globale già in corso — nessuna chiamata necessaria

    const kb = this.input.keyboard;
    if (kb) {
      const onInteract = (): void => this.tryInteract();
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', onInteract);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', onInteract);
    }

    TransitionSystem.announceArea(this, 'TRICASE, ZONA DRAGHI – 2017', 4500);

    // Touch: il tap interagisce con l'NPC vicino
    this.input.on('pointerdown', () => this.tryInteract());

    // Arrivo stordito dal salto temporale (senza saperlo)
    this.player.locked = true;
    this.time.delayedCall(700, () => void this.arrivalDaze());
  }

  private async arrivalDaze(): Promise<void> {
    await TransitionSystem.dazedEffect(this, this.player.sprite);
    this.dialogue.start({
      lines: DAZED_LINES,
      onComplete: () => {
        this.player.locked = false;
      },
    });
  }

  update(): void {
    this.player.update(this.confronted ? [] : this.npcs);
    this.player.sprite.setDepth(this.player.sprite.y);

    // Auto-trigger Alessandra quando Bubi si avvicina (a metà mappa)
    if (!this.alessandraTriggered && !this.player.locked && this.player.sprite.x >= 340) {
      this.alessandraTriggered = true;
      this.player.locked = true;
      this.dialogue.start({
        lines: ALESSANDRA_LINES,
        onComplete: () => { this.player.locked = false; },
      });
    }

    const dt = this.game.loop.delta / 1000;
    for (const cloud of this.clouds) {
      cloud.g.x -= cloud.speed * dt;
      // Wrap: quando esce dal bordo sinistro rientra da destra
      if (cloud.g.x < -120) cloud.g.x = WORLD_W + 120;
    }
  }

  private tryInteract(): void {
    if (this.dialogue.isActive || this.player.locked || this.confronted) return;
    const npc = this.player.nearbyNpc;
    if (!npc) return;
    // Entrambi gli NPC innescano il confronto
    this.confronted = true;
    this.dialogue.start({
      lines: CONFRONT_LINES,
      onComplete: () => {
        this.player.locked = true;
        // Varco "SCONTRO!" per la battle Bubi vs Umberto
        void TransitionSystem.warpToScene(this, 'BattleScene', {
          playerChar: 'bubi',
          enemyChar: 'umberto',
          onComplete: () => {
            AudioManager.get().stopFgMusic(this); // fine battle → BGM torna su
            this.scene.start('AulaScene');
          },
        });
      },
    });
  }

  private spawnNpc(id: string, x: number, y: number, facing: string): void {
    addShadow(this, x, y);
    addNameLabel(this, x, y, id);
    const sprite = this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE);
    sprite.play(`${id}-idle-${facing}`);
    sprite.setDepth(y);
    makeFeetBody(this, sprite);
    this.npcs.push({ id, sprite });
  }

  // ------------------------------------------------------------ nuvole

  private spawnAnimatedClouds(): void {
    const defs: Array<{ x: number; y: number; w: number; h: number; alpha: number; speed: number; bobAmp: number; bobMs: number }> = [
      { x: 120,  y: 34, w: 84,  h: 28, alpha: 0.88, speed: 6,  bobAmp: 4, bobMs: 3200 },
      { x: 340,  y: 20, w: 58,  h: 20, alpha: 0.72, speed: 10, bobAmp: 5, bobMs: 2600 },
      { x: 510,  y: 42, w: 96,  h: 32, alpha: 0.82, speed: 5,  bobAmp: 3, bobMs: 3800 },
      { x: 660,  y: 25, w: 50,  h: 17, alpha: 0.65, speed: 13, bobAmp: 6, bobMs: 2200 },
      { x: 790,  y: 38, w: 74,  h: 25, alpha: 0.78, speed: 7,  bobAmp: 4, bobMs: 2900 },
      { x: 920,  y: 16, w: 42,  h: 14, alpha: 0.58, speed: 15, bobAmp: 5, bobMs: 2000 },
    ];
    for (const d of defs) {
      const g = this.add.graphics().setDepth(-5);
      this.drawPuffyCloud(g, d.w, d.h, d.alpha);
      g.setPosition(d.x, d.y);
      this.clouds.push({ g, speed: d.speed });
      // Bob verticale sinusoidale indipendente per ogni nuvola
      this.tweens.add({
        targets: g, y: d.y + d.bobAmp,
        duration: d.bobMs, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      });
    }
  }

  private drawPuffyCloud(g: Phaser.GameObjects.Graphics, w: number, h: number, alpha: number): void {
    // Ventre più scuro (ombra)
    g.fillStyle(0xd8e8f8, alpha * 0.45);
    g.fillEllipse(0, h * 0.25, w * 0.85, h * 0.55);
    // Corpo principale
    g.fillStyle(0xffffff, alpha);
    g.fillEllipse(0, 0, w, h);
    // Dosso sinistro
    g.fillStyle(0xffffff, alpha * 0.92);
    g.fillEllipse(-w * 0.26, -h * 0.38, w * 0.52, h * 0.78);
    // Dosso destro
    g.fillStyle(0xffffff, alpha * 0.88);
    g.fillEllipse(w * 0.22, -h * 0.32, w * 0.46, h * 0.68);
    // Spruzzo in cima (lucentezza)
    g.fillStyle(0xffffff, alpha * 0.6);
    g.fillEllipse(-w * 0.08, -h * 0.58, w * 0.28, h * 0.32);
  }

  // ------------------------------------------------------------ mappa

  private drawMap(): void {
    const g = this.make.graphics();

    // Cielo azzurro mattutino (gradiente a fasce)
    const top = Phaser.Display.Color.ValueToColor(0x8ec8ec);
    const bottom = Phaser.Display.Color.ValueToColor(0xd9eef8);
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(0, (195 / steps) * i, WORLD_W, 195 / steps + 1);
    }

    // Sole del mattino
    g.fillStyle(0xfff2b0, 0.35);
    g.fillCircle(820, 48, 26);
    g.fillStyle(0xfff7cc);
    g.fillCircle(820, 48, 16);

    // Marciapiede
    g.fillStyle(0x9a9aa2);
    g.fillRect(0, 195, WORLD_W, 16);
    g.lineStyle(1, 0x7d7d86);
    for (let x = 0; x < WORLD_W; x += 24) g.lineBetween(x, 195, x, 211);
    g.lineBetween(0, 195, WORLD_W, 195);

    // Strada con linea centrale tratteggiata
    g.fillStyle(0x3c3c44);
    g.fillRect(0, 211, WORLD_W, WORLD_H - 211);
    g.fillStyle(0xe8e8d8);
    for (let x = 8; x < WORLD_W; x += 48) g.fillRect(x, 238, 22, 3);

    this.drawCasaBubi(g);
    this.drawCaserma(g);
    this.drawLiceo(g);
    this.drawTrees(g);
    this.drawLampposts(g);

    // Pre-render della mappa statica in texture
    if (!this.textures.exists('tex-map-strada')) {
      g.generateTexture('tex-map-strada', WORLD_W, WORLD_H);
    }
    g.destroy();
    this.add.image(0, 0, 'tex-map-strada').setOrigin(0).setDepth(-10);
  }

  private drawCasaBubi(g: Phaser.GameObjects.Graphics): void {
    // Casa di Bubi (sinistra)
    g.fillStyle(0xe8d8b0);
    g.fillRect(40, 105, 130, 90);
    g.lineStyle(1, 0xbfae84);
    g.strokeRect(40, 105, 130, 90);
    // tetto
    g.fillStyle(0x9c4a3a);
    g.fillTriangle(30, 107, 180, 107, 105, 70);
    // porta e finestre
    g.fillStyle(0x6b4a2f);
    g.fillRect(90, 160, 24, 35);
    g.fillStyle(0xa8d0e0);
    g.fillRect(55, 125, 22, 20);
    g.fillRect(133, 125, 22, 20);
    g.lineStyle(1, 0x5d4530);
    g.strokeRect(55, 125, 22, 20);
    g.strokeRect(133, 125, 22, 20);
    // Recinzione con pilastri e cancelletto
    g.fillStyle(0xc8b890);
    g.fillRect(32, 191, 140, 3); // muretto basso
    g.fillStyle(0xd8c8a0);
    g.fillRect(32, 188, 140, 3); // highlight top
    for (let px = 32; px <= 172; px += 20) {
      g.fillStyle(0xb8a878); g.fillRect(px - 3, 185, 6, 10); // pilastro scuro
      g.fillStyle(0xd4c490); g.fillRect(px - 2, 185, 4, 9);  // pilastro luce
    }
    // cancelletto
    g.fillStyle(0x7a6040);
    g.fillRect(89, 185, 3, 10);
    g.fillRect(110, 185, 3, 10);
    g.fillRect(90, 187, 21, 2);
    g.fillRect(90, 192, 21, 2);
    // piccolo giardino (cespuglio verde sinistra porta)
    g.fillStyle(0x3a7822); g.fillCircle(76, 191, 6);
    g.fillStyle(0x52a030); g.fillCircle(74, 188, 5);
    this.addLabel(105, 62, 'CASA DI BUBI');
  }

  private drawCaserma(g: Phaser.GameObjects.Graphics): void {
    // Caserma dei Vigili del Fuoco con portoni rossi
    g.fillStyle(0xd8d0c0);
    g.fillRect(350, 90, 230, 105);
    g.lineStyle(1, 0xab9f88);
    g.strokeRect(350, 90, 230, 105);
    g.fillStyle(0xb8b0a0); // cornicione
    g.fillRect(346, 84, 238, 10);
    // 3 portoni rossi
    for (let i = 0; i < 3; i++) {
      const px = 366 + i * 70;
      g.fillStyle(0xc23030);
      g.fillRect(px, 130, 50, 65);
      g.lineStyle(1, 0x8a1f1f);
      for (let yy = 138; yy < 195; yy += 9) g.lineBetween(px, yy, px + 50, yy);
      g.strokeRect(px, 130, 50, 65);
    }
    this.addLabel(465, 76, 'CASERMA VVF');
  }

  private drawLiceo(g: Phaser.GameObjects.Graphics): void {
    // Liceo Stampacchia in fondo a destra — stessa facciata della cutscene
    const BX = 740, BW = 220, GND = 195;
    const WHITE = 0xf4f4ef, LIT = 0xffffff, SHAD = 0xd6d8d3;
    const STONE = 0xe4d5b6, STONE2 = 0xcfbc95, GLASS = 0x7aa6c2;

    // Corpo bianco
    g.fillStyle(WHITE); g.fillRect(BX, 94, BW, GND - 94);
    g.fillStyle(LIT);   g.fillRect(BX, 94, BW, 3);

    // Attico rialzato centrale con vetrata e pilastrini in pietra
    const AX = BX + 60, AW = 100, ATY = 72, ATH = 22;
    g.fillStyle(WHITE); g.fillRect(AX, ATY, AW, ATH);
    g.fillStyle(LIT);   g.fillRect(AX, ATY, AW, 3);
    g.fillStyle(0x2c4a5c); g.fillRect(AX + 8, ATY + 8, AW - 16, 11);
    g.fillStyle(STONE);
    for (let px = AX + 18; px < AX + AW - 10; px += 20) g.fillRect(px, ATY + 6, 4, 15);

    // Parete di fondo del portico (in ombra)
    g.fillStyle(0xe9eae6); g.fillRect(BX, 113, BW, GND - 113);
    g.fillStyle(0x2a3a46, 0.14); g.fillRect(BX, 113, BW, 6);

    // Piloni in pietra ai lati + accenni di murales
    const pier = (x: number, w: number): void => {
      g.fillStyle(STONE); g.fillRect(x, 113, w, GND - 113);
      g.fillStyle(STONE2);
      for (let sy = 116; sy < GND; sy += 8)
        for (let sx = x + 2 + ((sy / 8 | 0) % 2) * 7; sx < x + w - 2; sx += 14) g.fillRect(sx, sy, 11, 6);
    };
    pier(BX, 30); pier(BX + BW - 30, 30);
    g.fillStyle(0x2b6fb0); g.fillRect(BX + 4, 150, 22, 43);
    g.fillStyle(0xe23b3b); g.fillRect(BX + 8, 158, 7, 9);
    g.fillStyle(0x39b54a); g.fillRect(BX + 15, 166, 8, 16);
    g.fillStyle(0x7a1f1f); g.fillRect(BX + BW - 26, 150, 22, 43);
    g.fillStyle(0xb03a2e); g.fillRect(BX + BW - 22, 158, 14, 14);

    // Vetrate del portico + porta a vetri centrale
    g.fillStyle(GLASS);   g.fillRect(BX + 34, 126, BW - 68, GND - 126);
    g.fillStyle(0xa9cfe4); g.fillRect(BX + 34, 126, BW - 68, 2);
    g.fillStyle(0x5f8aa6); g.fillRect(BX + 92, 138, 36, GND - 138);
    g.fillStyle(0xcfe2ee); g.fillRect(BX + 109, 140, 2, GND - 142);

    // Colonne bianche che incorniciano l'ingresso
    const col = (x: number): void => {
      g.fillStyle(LIT);  g.fillRect(x, 112, 10, GND - 112);
      g.fillStyle(SHAD); g.fillRect(x + 7, 112, 3, GND - 112);
    };
    col(BX + 66); col(BX + BW - 76);

    // Tettoia orizzontale (aggetto) + ombra
    g.fillStyle(LIT);  g.fillRect(BX - 8, 103, BW + 16, 9);
    g.fillStyle(SHAD); g.fillRect(BX - 8, 112, BW + 16, 2);

    // Insegna: pannello bianco con stemma + fascia rossa
    g.fillStyle(0xffffff); g.fillRect(BX + 62, 114, 96, 8);
    g.fillStyle(0xcf2030); g.fillCircle(BX + 110, 118, 4);
    g.fillStyle(0x1b3f8f); g.fillCircle(BX + 110, 118, 2);
    g.fillStyle(0x123a8a); g.fillRect(BX + 70, 116, 8, 5);
    g.fillStyle(0x33384a); g.fillRect(BX + 134, 116, 8, 5);
    g.fillStyle(0xd12030); g.fillRect(BX + 58, 122, 104, 9);
    g.fillStyle(0xa8121f); g.fillRect(BX + 58, 129, 104, 2);

    // Bandiere: tricolore + UE, a destra dell'insegna
    g.fillStyle(0x888888); g.fillRect(BX + 168, 96, 2, 20); g.fillRect(BX + 186, 98, 2, 18);
    g.fillStyle(0x009246); g.fillRect(BX + 170, 96, 6, 8);
    g.fillStyle(0xffffff); g.fillRect(BX + 176, 96, 6, 8);
    g.fillStyle(0xce2b37); g.fillRect(BX + 182, 96, 6, 8);
    g.fillStyle(0x1b3f8f); g.fillRect(BX + 188, 98, 15, 10);
    g.fillStyle(0xffd21e);
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      g.fillRect(BX + 195 + Math.round(Math.cos(a) * 4), 103 + Math.round(Math.sin(a) * 3), 1, 1);
    }

    // Scritta sulla fascia rossa + nome edificio
    this.add.text(BX + 110, 126, 'LICEO CLASSICO', {
      fontFamily: FONT, fontSize: '4px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.addLabel(850, 64, 'LICEO STAMPACCHIA');
  }

  private drawTrees(g: Phaser.GameObjects.Graphics): void {
    // Alberi tra gli edifici lungo il marciapiede
    // Posizioni: gap Bubi→Caserma (x=200–340), gap Caserma→Liceo (x=600–720)
    const trees: [number, boolean][] = [
      [220, false], [300, true],  // gap sinistro
      [605, true],  [695, false], // gap destro
    ];
    for (const [x, tall] of trees) {
      const trunkH = tall ? 58 : 42;
      const r      = tall ? 20 : 15;
      const topY   = 195 - trunkH - r;
      // ombra sul marciapiede
      g.fillStyle(0x808088, 0.35); g.fillEllipse(x + 1, 194, 16, 4);
      // tronco
      g.fillStyle(0x5a3010); g.fillRect(x - 3, 195 - trunkH, 6, trunkH);
      g.fillStyle(0x7a4820); g.fillRect(x - 3, 195 - trunkH, 2, trunkH); // riflesso
      // chioma — strato ombra
      g.fillStyle(0x1a4a08); g.fillCircle(x + 2, topY + 4, r);
      // chioma — verde base
      g.fillStyle(0x2e7a18); g.fillCircle(x, topY + 2, r);
      // chioma — highlight
      g.fillStyle(0x48a02a); g.fillCircle(x - 5, topY - 3, r - 5);
    }
  }

  private drawLampposts(g: Phaser.GameObjects.Graphics): void {
    // Lampioni vintage a braccio singolo — stile italiano
    const posts: number[] = [185, 545, 735];
    for (const x of posts) {
      // base quadrata
      g.fillStyle(0x3a3a44); g.fillRect(x - 3, 190, 6, 5);
      // palo verticale
      g.fillStyle(0x4a4a58); g.fillRect(x - 1, 155, 3, 36);
      g.fillStyle(0x6060720, 0.5); g.fillRect(x - 1, 155, 1, 36); // riflesso
      // braccio curvo (2 segmenti)
      g.fillStyle(0x4a4a58);
      g.fillRect(x, 155, 14, 2); // braccio orizzontale
      g.fillRect(x + 12, 155, 2, 6); // scendente
      // lanterna
      g.fillStyle(0x555566); g.fillRect(x + 9, 161, 8, 9);  // corpo
      g.fillStyle(0xffffcc, 0.9); g.fillRect(x + 10, 162, 6, 7); // luce
      g.fillStyle(0x555566); g.fillRect(x + 8, 161, 10, 2);  // cappello
    }
  }

  private addLabel(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: '6px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1);
  }
}
