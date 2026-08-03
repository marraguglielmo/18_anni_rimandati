import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from '../config';
import { DialogueSystem, type DialogueLine } from '../systems/DialogueSystem';
import {
  addNameLabel,
  addShadow,
  CHAR_CONFIGS,
  CHAR_SCALE,
  generateSpriteTexture,
  loadPortraits,
  makeFeetBody,
  SHADOW_OFFSET_Y,
} from '../systems/CharacterSprite';
import { PlayerController, type InteractableNpc } from '../systems/PlayerController';
import { TransitionSystem, UI_OFF_X, UI_OFF_Y } from '../systems/TransitionSystem';
import { AudioManager } from '../systems/AudioManager';
import { QuestHUD } from '../systems/QuestHUD';

// Liceo Stampacchia, 2015 — aula, top-down
const WORLD_W = 480;
const WORLD_H = 320;
const FONT = '"Press Start 2P", monospace';

// Banchi: 4 righe x 8 colonne in due sezioni con corsìa centrale
const DESK_COLS_A = [70, 106, 142, 178];
const DESK_COLS_B = [302, 338, 374, 410];
const DESK_ROWS = [110, 150, 190, 230];

const STUDENT_POSITIONS: [number, number][] = [
  [120, 70],
  [330, 70],
  [420, 95],
  [60, 120],
  [215, 130],
  [430, 170],
  [60, 200],
  [265, 205],
  [120, 262],
  [330, 262],
  [60, 262],
  [420, 262],
];
const STUDENT_SHIRTS = [0x7788aa, 0xaa7766, 0x66aa88, 0xaaa055, 0x8866aa, 0x5599aa];

// ─── Dialoghi aula ───────────────────────────────────────────────────────────

const DAZED_LINES: DialogueLine[] = [
  { speaker: 'bubi', text: "Minchia che classe de merda..." },
  { speaker: 'umberto', text: "Uh c'è Zenzola, vado a salutarlo..." },
  { speaker: 'bubi', text: 'Ma dove porco dio vai...' },
  { speaker: 'bubi', text: 'Come cazzo è che frequenti certa gente' },
  { speaker: 'bubi', text: 'Piuttosto, che cazzo ci fa Trande li nell\'angolino?' },
  { speaker: 'umberto', text: 'Sicuramente è teso per l\'interrogazione della Apollonia' },
  { speaker: 'bubi', text: 'Ah porco dio... osci era l\'interrogazione?' },
  { speaker: 'bubi', text: 'E nu me avvisi li morti toi!' },
  { speaker: 'umberto', text: 'E ci sapia ieu *hihihi*' },
  { speaker: 'bubi', text: 'Se osci me chiama te cciu' },
  { speaker: 'bubi', text: 'Vabe adesso andiamo a vedere come sta messo Trande' },
];

const TRANDE_LINES: DialogueLine[] = [
  { speaker: 'bubi', text: 'Ou Trande... ci te cappa?' },
  { speaker: 'trande', text: '...ho solo un brutto presentimento per oggi.' },
  { speaker: 'umberto', text: 'Quale presentimento?' },
  { speaker: 'umberto', text: 'Tanto ci siamo noi, cosa potrà andare storto?' },
  { speaker: 'bubi', text: 'Mamma mamma, fa me rattu li cujuni' },
  { speaker: 'chiara', text: 'Dai ragazzi andiamo a sederci, sta arrivando il supplente' },
  { speaker: 'chiara', text: 'L\'Apollonia oggi è assente...' },
  { speaker: 'bubi', text: 'Godo porco dio... almeno una gioia...' },
];

const CECE_INTRO_LINES: DialogueLine[] = [
  { speaker: 'cece', text: 'Buongiorno ragazzi, oggi a voi ci penso io!' },
  { speaker: 'trande', text: 'Ma che cazz...' },
  { speaker: 'bubi', text: 'CECE?! Ma che cazzo fai qui?!' },
  { speaker: 'cece', text: 'Sono il vostro supplente! Sedetevi tutti!' },
];

// Chiacchiere brevi dei compagni di sfondo (nuvolette casuali).
const CLASS_CHATTER = [
  '...', 'oh raga', 'hai visto?', 'ma è vero??', 'cittu!', 'ahahah',
  'e mo?', 'che palle', 'occhio al prof', 'te na penna?',
];

const ZENZOLA_LINES: DialogueLine[] = [
  { speaker: 'zenzola', text: 'Oh umberto! Tieni le sigarette?' },
  { speaker: 'bubi', text: 'Zenzola, mo no... aggiu de sciare te lu prof.' },
];

const SANAPO_LINES: DialogueLine[] = [
  { speaker: 'sanapo', text: 'Gabriele! andiamo in bagno a fare un musically!' },
  { speaker: 'bubi', text: 'Si porcu diu, sciamu...' },
  { speaker: 'bubi', text: 'Chiamo Umberto.' },
];

const LESSON_LINES: DialogueLine[] = [
  { speaker: 'cece', text: 'Lezione di oggi: anatomia della donna' },
  { speaker: 'bubi', text: 'Ma ci ne sai cece... mancu mammata te vole' },
  { speaker: 'umberto', text: 'Stai zitto gabriele' },
  { speaker: 'bubi', text: 'Nah porco dio, mo te cciu' },
  { speaker: 'cece', text: 'BUBI! UMBERTO! Silenzio!' },
];

// ─── Chi Vuole Essere Milionario ─────────────────────────────────────────────

interface MgQuestion {
  q: string;
  // Le lettere A/B/C/D vengono aggiunte in fase di display — non nei dati
  opts: [string, string, string, string];
  correct: number; // indice 0-3
  prize: string;
  prizeValue: number; // valore numerico in euro (per il counter montepremi)
}

const MILLIONAIRE_QUESTIONS: MgQuestion[] = [
  {
    // Domanda stupidissima — livello 1
    q: 'Di che colore è il cielo in una giornata di sole?',
    opts: ['Verde pisello', 'Fucsia aniceto', 'Azzurro', 'Grigio topo'],
    correct: 2,
    prize: '€ 100',
    prizeValue: 100,
  },
  {
    q: "Quale organo del corpo umano produce l'insulina?",
    opts: ['Il fegato', 'Il rene', 'Il pancreas', 'Occhi'],
    correct: 2,
    prize: '€ 500',
    prizeValue: 500,
  },
  {
    q: 'In quale anno è caduto il Muro di Berlino?',
    opts: ['2020', '1987', '1989', '1993'],
    correct: 2,
    prize: '€ 1.000',
    prizeValue: 1000,
  },
  {
    q: 'Quante ossa conta il corpo umano adulto?',
    opts: ['106', 'Cece', '206', '306'],
    correct: 2,
    prize: '€ 5.000',
    prizeValue: 5000,
  },
  {
    q: 'Chi ha scritto la Divina Commedia?',
    opts: ['Francesco Petrarca', 'Tevez', 'Ludovico Ariosto', 'Dante Alighieri'],
    correct: 3,
    prize: '€ 20.000',
    prizeValue: 20000,
  },
  {
    q: "Qual è la capitale dell'Australia?",
    opts: ['Sydney', 'Melbourne', 'Canberra', 'Depressa'],
    correct: 2,
    prize: '€ 100.000',
    prizeValue: 100000,
  },
  {
    q: "Quanti atomi di idrogeno contiene una molecola d'acqua (H₂O)?",
    opts: ['1', '2', '3', '4'],
    correct: 1,
    prize: '€ 1.000.000',
    prizeValue: 1000000,
  },
];

const MG_INTRO_LINES: DialogueLine[] = [
  { speaker: 'cece', text: 'Visto che vi va tanto di parlare, interrogo...' },
  { speaker: 'cece', text: '...a modo mio' },
  { speaker: 'bubi', text: 'Vedi che cazzo combini Umberto? Sempre colpa tua' },
  { speaker: 'cece', text: 'Bubi, siediti di fronte a me.' },
  { speaker: 'cece', text: 'Benvenuti a... CHI VUOLE ESSERE MILIONARIO?' },
  { speaker: 'cece', text: 'Sono il vostro conduttore... CECE SCOTTI!' },
  { speaker: 'umberto', text: '...questo non sta bene.' },
  { speaker: 'trande', text: 'Glielo avevo detto io.' },
];

const MG_BEFORE_LINES: DialogueLine[][] = [
  [{ speaker: 'cece', text: 'Prima domanda!' }],
  [{ speaker: 'cece', text: 'Seconda domanda. Concentrazione!' }],
  [{ speaker: 'cece', text: 'Terza domanda!' }],
  [{ speaker: 'cece', text: 'Quarta domanda! Ci credi, Bubi?' }],
  [{ speaker: 'cece', text: 'Quinta domanda. Cultura generale!' }],
  [
    { speaker: 'cece', text: 'Sesta domanda. Centomila euro.' },
    { speaker: 'bubi', text: 'Aspetta, questa è seria.' },
  ],
  [{ speaker: 'cece', text: 'ULTIMA. UN. MILIONE. DI. EURO.' }],
];

const MG_CORRECT_LINES: DialogueLine[][] = [
  [
    { speaker: 'cece', text: 'ESATTO!! Non potevo aspettarmi di meno!' },
    { speaker: 'bubi', text: 'Era il cielo, Cece.' },
    { speaker: 'cece', text: 'E TU LO SAPEVI!!' },
  ],
  [{ speaker: 'cece', text: 'BRAVISSIMOOOO!! Il pancreas! Sei grande Bubi!' }],
  [
    { speaker: 'cece', text: 'Il 1989! Perfetto, lo sapevo!' },
    { speaker: 'bubi', text: 'Ho studiato stavolta.' },
  ],
  [
    { speaker: 'cece', text: '206!! Due-zero-sei!! Grande!' },
    { speaker: 'trande', text: 'Non ci credevo...' },
  ],
  [
    { speaker: 'cece', text: 'Dante!! CHE CLASSE! Che giocatore!' },
    { speaker: 'bubi', text: 'Grazie al liceo classico.' },
  ],
  [
    { speaker: 'cece', text: 'CANBERRA!! Non Sydney! CANBERRA!!' },
    { speaker: 'bubi', text: 'Che culo.' },
    { speaker: 'cece', text: 'E vale lo stesso!!' },
  ],
  [
    { speaker: 'cece', text: 'UN MILIONE DI EURO!!' },
    { speaker: 'cece', text: 'SEI MILIONARIOOOO BUBI!!' },
  ],
];

const MG_WRONG_LINES: DialogueLine[][] = [
  [
    { speaker: 'cece', text: 'COME?! Bubi... è il cielo. IL CIELO.' },
    { speaker: 'bubi', text: 'Avevo dei dubbi.' },
    { speaker: 'cece', text: 'Dubbi sul cielo...' },
  ],
  [
    { speaker: 'cece', text: 'Ohhhh... porcodddddio. Era il pancreas!' },
    { speaker: 'bubi', text: 'Ma nu su medico ancora Cece porcodio.' },
  ],
  [
    { speaker: 'cece', text: "Ahimè... era il 1989!" },
    { speaker: 'bubi', text: "Non ho studiato bene quest'anno." },
  ],
  [
    { speaker: 'cece', text: '206!! Come cazzo fai a non saperlo?!' },
    { speaker: 'bubi', text: 'Nessuno lo sa a memoria.' },
    { speaker: 'cece', text: 'IO LO SO! DUECENTO-SEI!' },
  ],
  [
    { speaker: 'cece', text: "Era Dante! La Divina Commedia!" },
    { speaker: 'bubi', text: 'Mi sono confuso porcaccio il signore.' },
  ],
  [
    { speaker: 'cece', text: "La capitale è CANBERRA, Bubi!" },
    { speaker: 'bubi', text: "Ce sacciu ieu." },
    { speaker: 'cece', text: "Ci cascano tutti!" },
  ],
  [
    { speaker: 'cece', text: "H-DUE-O! Due atomi di idrogeno!" },
    { speaker: 'bubi', text: 'Non ricordavo la formula.' },
    { speaker: 'cece', text: "È acqua, Bubi. Acqua." },
  ],
];

const MG_OUTRO_LINES: DialogueLine[] = [
  { speaker: 'cece', text: 'E con questo... la lezione è conclusa!' },
  { speaker: 'bubi', text: 'Non ci hai insegnato niente.' },
  { speaker: 'cece', text: 'Ti sbagli. Ora sai un sacco di cose...' },
  { speaker: 'cece', text: 'Tranne una cosa che sto preparando per voi...' },
  { speaker: 'cece', text: "Adesso non è il momento di parlarne... andiamo avanti." },
  { speaker: 'bubi', text: 'Cece con chi cazzo stai parlando??' },
];

// ─── Classe ──────────────────────────────────────────────────────────────────

export class AulaScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;
  private player!: PlayerController;
  private interactables: InteractableNpc[] = [];
  private umberto!: Phaser.GameObjects.Sprite;
  private chiara!: Phaser.GameObjects.Sprite;
  private trande!: Phaser.GameObjects.Sprite;
  private cece!: Phaser.GameObjects.Sprite; // riferimento globale per il minigioco
  private students: { sprite: Phaser.GameObjects.Sprite; id: string }[] = [];
  private followers: { sprite: Phaser.GameObjects.Sprite; id: string; facing: string }[] = [];
  private trandeTalked = false;
  private zenzola!: Phaser.GameObjects.Sprite;
  private sanapo!: Phaser.GameObjects.Sprite;
  private zenzolaDone = false;
  private sanapoDone = false;
  private classTimers: Phaser.Time.TimerEvent[] = [];
  private classActive = false;   // i compagni si muovono solo quando il player ha il controllo
  private classStopped = false;  // stop definitivo (lezione iniziata)
  private cutscene = false;

  // Quest HUD
  private questHUD!: QuestHUD;

  // Scena esterna (blackout che copre l'aula durante il cutscene esterno)
  private exteriorBlackout: Phaser.GameObjects.Graphics | null = null;

  // Elementi UI milionario (per cleanup)
  private mgElements: Phaser.GameObjects.GameObject[] = [];
  private mgQElements: Phaser.GameObjects.GameObject[] = [];
  private mgBtnBgs: Phaser.GameObjects.Graphics[] = [];
  private mgLadderEls: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('AulaScene');
  }

  preload(): void {
    loadPortraits(this, ['bubi', 'umberto', 'chiara', 'trande', 'cece']);
  }

  create(): void {
    this.interactables = [];
    this.trandeTalked = false;
    this.zenzolaDone = false;
    this.sanapoDone = false;
    this.classTimers = [];
    this.classActive = false;
    this.classStopped = false;
    this.pendingObstacles = [];
    this.staticSprites = [];
    this.students = [];
    this.followers = [];
    this.cutscene = false;
    this.shadows = new Map();
    this.nameLabels = new Map();
    this.mgElements = [];
    this.mgQElements = [];
    this.mgBtnBgs = [];
    this.mgLadderEls = [];

    this.drawMap();

    for (const id of ['bubi', 'umberto', 'chiara', 'trande', 'cece', 'zenzola', 'sanapo']) {
      generateSpriteTexture(this, id, CHAR_CONFIGS[id]);
    }
    STUDENT_SHIRTS.forEach((color, i) => {
      generateSpriteTexture(this, `studente${i}`, {
        shirtColor: color,
        hairColor: i % 2 === 0 ? 0x4a3526 : 0x2b2018,
      });
    });

    const facings = ['down', 'left', 'right'];
    STUDENT_POSITIONS.forEach(([x, y], i) => {
      const id = `studente${i % STUDENT_SHIRTS.length}`;
      const s = this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE);
      s.play(`${id}-idle-${facings[(x + y + i) % facings.length]}`);
      s.setDepth(y);
      this.makeStatic(s);
      this.students.push({ sprite: s, id });
      this.startStudentLife(s, id, x, y);
    });

    this.umberto = this.spawnFollower('umberto', 200, 270, 'right');
    this.chiara = this.spawnFollower('chiara', 280, 270, 'left');

    this.trande = this.spawnNamed('trande', 440, 290, 'left');
    this.interactables.push({ id: 'trande', sprite: this.trande });
    this.questHUD = new QuestHUD(this, WORLD_W / 2 + UI_OFF_X, 50 + UI_OFF_Y).addMarker();

    // Due compagni lungo il tragitto verso Trande: fermano Bubi con un dialogo
    // automatico. Prima Zenzola, poco dopo Emanuele Sanapo.
    this.zenzola = this.spawnNamed('zenzola', 300, 246, 'left');
    this.sanapo = this.spawnNamed('sanapo', 380, 262, 'left');

    this.dialogue = new DialogueSystem(this);
    this.player = new PlayerController(this, 'bubi', 240, 290, this.dialogue);

    this.physics.world.setBounds(16, 44, WORLD_W - 32, WORLD_H - 56);
    this.physics.add.collider(this.player.sprite, this.pendingObstacles);
    this.physics.add.collider(this.player.sprite, this.staticSprites);

    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE);
    cam.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    // BGM globale già in corso

    // Blackout iniziale: copre l'aula finché enterBuilding() non fa il reveal esterno
    this.exteriorBlackout = this.add.graphics({ x: UI_OFF_X, y: UI_OFF_Y })
      .setScrollFactor(0).setDepth(9500);
    this.exteriorBlackout.fillStyle(0x000000);
    this.exteriorBlackout.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const kb = this.input.keyboard;
    if (kb) {
      const onInteract = (): void => this.tryInteract();
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', onInteract);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', onInteract);
    }
    this.input.on('pointerdown', () => this.tryInteract());

    this.player.locked = true;
    this.time.delayedCall(300, () => void this.arrivalDaze());
  }

  private async arrivalDaze(): Promise<void> {
    // ── 1) Cutscene fuori dalla scuola ──
    await this.enterBuilding();

    // ── 2) Posiziona i personaggi già dentro l'aula (schermo ancora nero) ──
    // Nessuna animazione d'entrata in classe: l'abbiamo già vista fuori.
    // Distanziati nell'area d'ingresso (davanti ai banchi) così restano tutti
    // e tre visibili e le targhette col nome non si accavallano.
    // NB: durante il quadretto d'arrivo blocchiamo il "seguimi" dei follower
    // (Umberto insegue Bubi, Chiara insegue Umberto) o si riammassano subito.
    this.cutscene = true;
    this.player.sprite.setPosition(240, 246);
    this.umberto.setPosition(174, 250);
    this.chiara.setPosition(306, 252);
    this.player.sprite.play('bubi-idle-down');
    this.umberto.play('umberto-idle-down');
    this.chiara.play('chiara-idle-down');
    // Riallinea ombre, targhette e profondità alle nuove posizioni
    this.player.sprite.setDepth(this.player.sprite.y);
    for (const s of [this.umberto, this.chiara]) {
      s.setDepth(s.y);
      this.shadows.get(s)?.setPosition(s.x, s.y + SHADOW_OFFSET_Y).setDepth(s.y - 1);
      this.nameLabels.get(s)?.setPosition(s.x, s.y - 20).setDepth(s.y + 1);
    }

    // ── 3) Fade in dell'aula ──
    if (this.exteriorBlackout) {
      await new Promise<void>(r =>
        this.tweens.add({
          targets: this.exteriorBlackout!,
          alpha: 0,
          duration: 600,
          onComplete: () => r(),
        })
      );
      this.exteriorBlackout.destroy();
      this.exteriorBlackout = null;
    }

    TransitionSystem.announceArea(this, 'LICEO STAMPACCHIA – 2015');

    // ── 4) Dialogo entrata ──
    this.dialogue.start({
      lines: DAZED_LINES,
      onComplete: () => {
        this.cutscene = false;          // i follower riprendono a seguire Bubi
        this.player.locked = false;
        this.classActive = true;        // ora i compagni prendono vita
        this.questHUD.show('Parla con Trande');
        this.questHUD.moveMarker(this.trande.x, this.trande.y);
      },
    });
  }

  // ─── Cutscene esterna: close-up sulla porta della scuola ────────────────────

  private async enterBuilding(): Promise<void> {
    const OX = UI_OFF_X;
    const OY = UI_OFF_Y;
    const W  = GAME_WIDTH;
    const H  = GAME_HEIGHT;
    const DEPTH = 3000;

    const els: Phaser.GameObjects.GameObject[] = [];
    const el = <T extends Phaser.GameObjects.GameObject>(o: T): T => { els.push(o); return o; };

    // ── Sfondo: cielo + facciata scuola + marciapiede ───────────────────
    const bg = el(this.add.graphics({ x: OX, y: OY }).setScrollFactor(0).setDepth(DEPTH));

    const BX = 30, BY = 18, BW = 420, BH = 170;
    const GND = BY + BH;                 // = 188, quota pavimentazione
    const WHITE = 0xf6f6f2, LIT = 0xffffff, SHAD = 0xd7d9d4;
    const STONE = 0xe4d5b6, STONE2 = 0xcfbc95, GLASS = 0x6fa2c2, GLASS2 = 0xa9cfe4;

    // ── Cielo azzurro intenso ────────────────────────────────────────────
    bg.fillStyle(0x1f7ad0, 1); bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x3f93de, 1); bg.fillRect(0, 46, W, 20);

    // ── Muro superiore bianco (dietro attico e tettoia) ──────────────────
    bg.fillStyle(WHITE); bg.fillRect(BX, 28, BW, 52);
    bg.fillStyle(LIT);   bg.fillRect(BX, 28, BW, 3);

    // ── Attico rialzato centrale con vetrata e pilastrini in pietra ──────
    const AX = 150, AW = 180, ATY = 4, ATH = 44;
    bg.fillStyle(WHITE); bg.fillRect(AX, ATY, AW, ATH);
    bg.fillStyle(LIT);   bg.fillRect(AX, ATY, AW, 3);
    bg.fillStyle(SHAD);  bg.fillRect(AX, ATY + ATH - 2, AW, 2);
    const gwy = ATY + 16, gwh = 20;
    bg.fillStyle(0x2c4a5c); bg.fillRect(AX + 12, gwy, AW - 24, gwh);
    bg.fillStyle(0x49708a);
    for (let gx = AX + 15; gx < AX + AW - 14; gx += 18) bg.fillRect(gx, gwy + 1, 8, gwh - 2);
    bg.fillStyle(STONE);
    for (let px = AX + 28; px < AX + AW - 12; px += 30) bg.fillRect(px, gwy - 2, 5, gwh + 4);

    // ── Aste e bandiere (tricolore + UE, a destra dell'insegna) ──────────
    bg.lineStyle(2, 0x4a4a4a);
    bg.lineBetween(300, 78, 332, 38);
    bg.lineBetween(300, 78, 348, 48);
    bg.fillStyle(0x2a9d3f); bg.fillRect(322, 38, 6, 13);      // tricolore
    bg.fillStyle(0xffffff); bg.fillRect(328, 38, 6, 13);
    bg.fillStyle(0xd12030); bg.fillRect(334, 38, 6, 13);
    bg.fillStyle(0x1b3f8f); bg.fillRect(338, 48, 17, 12);     // bandiera UE
    bg.fillStyle(0xffd21e);
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      bg.fillRect(346 + Math.round(Math.cos(a) * 5) - 1, 54 + Math.round(Math.sin(a) * 4) - 1, 1, 1);
    }

    // ── Tettoia orizzontale bianca (aggetto) + ombra sul portico ─────────
    bg.fillStyle(LIT);  bg.fillRect(18, 60, W - 36, 18);
    bg.fillStyle(SHAD); bg.fillRect(18, 76, W - 36, 3);

    // ── Parete di fondo del portico (bianca, leggermente in ombra) ───────
    bg.fillStyle(0xe9eae6); bg.fillRect(BX, 79, BW, GND - 79);
    bg.fillStyle(0x2a3a46, 0.15); bg.fillRect(BX, 79, BW, 11);

    // ── Piloni esterni rivestiti in pietra + murales laterali ────────────
    const stonePier = (x: number, w: number): void => {
      bg.fillStyle(STONE); bg.fillRect(x, 79, w, GND - 79);
      bg.fillStyle(STONE2);
      for (let sy = 82; sy < GND; sy += 10)
        for (let sx = x + 2 + ((sy / 10 | 0) % 2) * 8; sx < x + w - 2; sx += 16)
          bg.fillRect(sx, sy, 13, 8);
    };
    stonePier(BX, 44);
    stonePier(BX + BW - 44, 44);
    // murale sinistro (colori vivaci) / destro (rossi scuri)
    bg.fillStyle(0x2b6fb0); bg.fillRect(BX + 6, 122, 34, 58);
    bg.fillStyle(0xe23b3b); bg.fillRect(BX + 10, 130, 10, 14);
    bg.fillStyle(0x39b54a); bg.fillRect(BX + 22, 140, 12, 22);
    bg.fillStyle(0xf5c518); bg.fillRect(BX + 10, 156, 14, 12);
    bg.fillStyle(0x7a1f1f); bg.fillRect(BX + BW - 40, 122, 34, 58);
    bg.fillStyle(0xb03a2e); bg.fillRect(BX + BW - 34, 130, 22, 22);
    bg.fillStyle(0x2c2c3a); bg.fillRect(BX + BW - 36, 156, 26, 22);

    // ── Vetrate del portico (tra le colonne) ─────────────────────────────
    const glass = (x1: number, x2: number): void => {
      bg.fillStyle(GLASS);  bg.fillRect(x1, 104, x2 - x1, GND - 104);
      bg.fillStyle(GLASS2); bg.fillRect(x1, 104, x2 - x1, 3);
      bg.fillStyle(0xbfe0f0, 0.5); bg.fillRect(x1 + 4, 108, 3, GND - 114);
    };
    glass(112, 150); glass(166, 204); glass(276, 330); glass(346, 382);
    glass(202, 278);   // sopravporta (transom): coperto dai pannelli sotto y136

    // ── Colonne bianche del portico ──────────────────────────────────────
    const column = (x: number): void => {
      bg.fillStyle(LIT);  bg.fillRect(x, 80, 16, GND - 80);
      bg.fillStyle(SHAD); bg.fillRect(x + 12, 80, 4, GND - 80);
      bg.fillStyle(0xffffff); bg.fillRect(x, 80, 3, GND - 80);
    };
    [96, 150, 330, 384].forEach(column);

    // ── Insegna: pannello bianco con loghi + fascia rossa ────────────────
    const SGX = 192, SGY = 82, SGW = 96, SGH = 15;
    bg.fillStyle(0xffffff); bg.fillRect(SGX, SGY, SGW, SGH);
    bg.fillStyle(0xcfd2d0); bg.fillRect(SGX, SGY + SGH - 1, SGW, 1);
    bg.fillStyle(0x123a8a); bg.fillRect(SGX + 8, SGY + 4, 10, 7);       // logo UE
    bg.fillStyle(0xffd21e); bg.fillRect(SGX + 11, SGY + 6, 3, 3);
    bg.fillStyle(0xcf2030); bg.fillCircle(SGX + SGW / 2, SGY + 7, 6);   // stemma LS
    bg.fillStyle(0x1b3f8f); bg.fillCircle(SGX + SGW / 2, SGY + 7, 3);
    bg.fillStyle(0x33384a); bg.fillRect(SGX + SGW - 18, SGY + 4, 10, 7); // logo MIUR
    bg.fillStyle(0xd12030); bg.fillRect(SGX - 6, SGY + SGH, SGW + 12, 12); // fascia rossa
    bg.fillStyle(0xa8121f); bg.fillRect(SGX - 6, SGY + SGH + 10, SGW + 12, 2);

    // ── Pavimentazione a masselli ────────────────────────────────────────
    bg.fillStyle(0xcbb48c); bg.fillRect(0, GND, W, H - GND);
    bg.fillStyle(0xbba576);
    for (let py = GND + 4; py < H; py += 8)
      for (let px = ((py / 8 | 0) % 2) * 8; px < W; px += 16) bg.fillRect(px, py, 14, 6);
    bg.fillStyle(0xa8916a); bg.fillRect(0, GND, W, 2);

    // ── Porta doppia centrale ────────────────────────────────────────────
    const DW = 32, DH = 52;
    const DX = W / 2 - DW;    // = 208 (pannello sinistro)
    const DY = BY + BH - DH;   // = 136

    const doorGfx = el(this.add.graphics({ x: OX, y: OY }).setScrollFactor(0).setDepth(DEPTH + 1));

    // Interno intravisto oltre le porte a vetri (si scopre all'apertura)
    doorGfx.fillStyle(0x243441);
    doorGfx.fillRect(DX, DY, DW * 2, DH);

    // Telaio metallico chiaro della vetrata d'ingresso
    doorGfx.lineStyle(2, 0xc6cace);
    doorGfx.strokeRect(DX - 4, DY - 10, DW * 2 + 8, DH + 10);
    // Soglia a filo pavimento
    doorGfx.fillStyle(0x9a8a6a);
    doorGfx.fillRect(DX - 6, DY + DH, DW * 2 + 12, 2);

    // Ante a vetro come Rectangle (tweenabili per apertura/chiusura).
    // Cardini sui MONTANTI ESTERNI (come la porta della scena finale): aprendosi
    // le ante si ritraggono verso i lati, non collassano al centro.
    const LEFT_X  = OX + DX;            // montante sinistro
    const RIGHT_X = OX + DX + DW * 2;   // montante destro
    const PIVOT_Y = OY + DY + DH / 2;

    const panelL = el(
      this.add.rectangle(LEFT_X, PIVOT_Y, DW, DH, 0x8fb6cc)
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH + 2)
    );
    const panelR = el(
      this.add.rectangle(RIGHT_X, PIVOT_Y, DW, DH, 0xa4c6da)
        .setOrigin(1, 0.5).setScrollFactor(0).setDepth(DEPTH + 2)
    );

    // Maniglioni verticali in metallo vicino alla mezzeria (nascosti all'apertura)
    const handleGfx = el(this.add.graphics({ x: OX, y: OY }).setScrollFactor(0).setDepth(DEPTH + 3));
    handleGfx.fillStyle(0xdfe4e6);
    handleGfx.fillRect(DX + DW - 5, DY + 12, 2, DH - 24);
    handleGfx.fillRect(DX + DW + 3, DY + 12, 2, DH - 24);

    // Insegna: scritta "LICEO CLASSICO" sulla fascia rossa
    el(this.add.text(OX + W / 2, OY + 103, 'LICEO CLASSICO', {
      fontFamily: FONT, fontSize: '5px',
      color: '#ffffff', stroke: '#7a0f18', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 2));

    // ── Personaggi davanti alla scuola (distanziati orizzontalmente) ─────
    const CHAR_Y        = 232;
    const DOOR_TARGET_X = W / 2;
    const DOOR_TARGET_Y = DY + DH + 2;   // = 190 (soglia porta)

    const charInfo = [
      { id: 'bubi',    x: 160 },
      { id: 'umberto', x: 240 },
      { id: 'chiara',  x: 320 },
    ];

    const extSprites: Phaser.GameObjects.Sprite[] = charInfo.map(({ id, x }, i) =>
      el(
        this.add.sprite(OX + x, OY + CHAR_Y, `char-${id}`, 1)
          .setScale(CHAR_SCALE)
          .setScrollFactor(0)
          .setDepth(DEPTH + 12 - i),   // bubi in primo piano
      ).play(`${id}-idle-up`)
    );

    // ── Reveal ────────────────────────────────────────────────────────────
    if (this.exteriorBlackout) {
      await new Promise<void>(r =>
        this.tweens.add({ targets: this.exteriorBlackout!, alpha: 0, duration: 700, onComplete: () => r() })
      );
    }

    // ── Battuta di Umberto: nuvoletta (fumetto) sopra la sua testa ────────
    await new Promise<void>(r => this.time.delayedCall(350, r));

    const ux   = OX + 240;              // Umberto è al centro (x=240)
    const tipY = OY + CHAR_Y - 18;      // punta della codina, appena sopra la testa

    const say = el(
      this.add.text(ux, 0, 'Vabe... dai\npe sta fiata.', {
        fontFamily: FONT, fontSize: '5px', color: '#20140a', align: 'center',
      })
        .setLineSpacing(2)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH + 22)
        .setAlpha(0),
    );

    const PAD = 5;
    const bw = Math.ceil(say.width)  + PAD * 2;
    const bh = Math.ceil(say.height) + PAD * 2;
    const bx = ux - bw / 2;
    const by = tipY - 7 - bh;           // la nuvola sta sopra la codina
    say.setY(by + bh / 2);

    const balloon = el(this.add.graphics().setScrollFactor(0).setDepth(DEPTH + 21).setAlpha(0));
    // Contorno scuro (1px più grande) → stacca il fumetto dallo sfondo chiaro
    balloon.fillStyle(0x20140a, 1);
    balloon.fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 5);
    balloon.fillTriangle(ux - 6, by + bh - 1, ux + 6, by + bh - 1, ux, tipY + 1);
    // Corpo bianco + codina
    balloon.fillStyle(0xffffff, 1);
    balloon.fillRoundedRect(bx, by, bw, bh, 4);
    balloon.fillTriangle(ux - 5, by + bh - 1, ux + 5, by + bh, ux, tipY);

    await new Promise<void>(r =>
      this.tweens.add({ targets: [balloon, say], alpha: 1, duration: 260, ease: 'Quad.easeOut', onComplete: () => r() })
    );
    await new Promise<void>(r => this.time.delayedCall(1700, r));
    this.tweens.add({ targets: [balloon, say], alpha: 0, duration: 300 });

    // ── Entrata nella scuola uno alla volta ───────────────────────────────
    for (let i = 0; i < extSprites.length; i++) {
      const sp = extSprites[i];
      const { id, x } = charInfo[i];
      sp.play(`${id}-walk-up`);

      // Apri le porte quando il primo personaggio inizia a camminare
      if (i === 0) {
        handleGfx.setAlpha(0);
        this.tweens.add({ targets: panelL, scaleX: 0, duration: 320, ease: 'Quad.easeIn' });
        this.tweens.add({ targets: panelR, scaleX: 0, duration: 320, ease: 'Quad.easeIn' });
      }

      const dist = Math.hypot(DOOR_TARGET_X - x, DOOR_TARGET_Y - CHAR_Y);
      const walkDuration = Math.max(650, dist * 9);

      // 1. cammina fino alla soglia
      await new Promise<void>(r =>
        this.tweens.add({
          targets: sp,
          x: OX + DOOR_TARGET_X,
          y: OY + DOOR_TARGET_Y,
          duration: walkDuration,
          ease: 'Linear',
          onComplete: () => r(),
        })
      );
      // 2. sale nel vano, rimpicciolisce e svanisce dentro (come le altre porte)
      await new Promise<void>(r =>
        this.tweens.add({
          targets: sp,
          y: OY + DY + 8,
          scaleX: CHAR_SCALE * 0.7, scaleY: CHAR_SCALE * 0.7,
          alpha: 0,
          duration: 320, ease: 'Quad.easeIn',
          onComplete: () => r(),
        })
      );
      if (i < extSprites.length - 1) {
        await new Promise<void>(r => this.time.delayedCall(120, r));
      }
    }

    // Chiudi le porte dopo che tutti sono entrati
    this.tweens.add({ targets: panelL, scaleX: 1, duration: 350, ease: 'Quad.easeOut' });
    await new Promise<void>(r =>
      this.tweens.add({ targets: panelR, scaleX: 1, duration: 350, ease: 'Quad.easeOut', onComplete: () => r() })
    );
    await new Promise<void>(r => this.time.delayedCall(200, r));

    // ── Fade a nero ───────────────────────────────────────────────────────
    if (this.exteriorBlackout) {
      await new Promise<void>(r =>
        this.tweens.add({ targets: this.exteriorBlackout!, alpha: 1, duration: 450, onComplete: () => r() })
      );
    }

    els.forEach(e => e.destroy());
  }


  update(): void {
    this.player.update(this.trandeTalked ? [] : this.interactables);
    this.player.sprite.setDepth(this.player.sprite.y);
    if (!this.cutscene) this.updateFollowers();
    this.checkNpcTriggers();
  }

  /** Zenzola e poi Sanapo fermano Bubi al passaggio: dialogo automatico. */
  private checkNpcTriggers(): void {
    if (this.cutscene || this.player.locked || this.dialogue.isActive || this.trandeTalked) return;
    const p = this.player.sprite;
    if (!this.zenzolaDone &&
        Phaser.Math.Distance.Between(p.x, p.y, this.zenzola.x, this.zenzola.y) < 30) {
      this.zenzolaDone = true;
      this.startNpcTalk(ZENZOLA_LINES);
    } else if (this.zenzolaDone && !this.sanapoDone &&
        Phaser.Math.Distance.Between(p.x, p.y, this.sanapo.x, this.sanapo.y) < 30) {
      this.sanapoDone = true;
      this.startNpcTalk(SANAPO_LINES);
    }
  }

  private startNpcTalk(lines: DialogueLine[]): void {
    this.player.locked = true;
    this.dialogue.start({
      lines,
      onComplete: () => { this.player.locked = false; },
    });
  }

  /** Ferma il movimento dei compagni (quando la lezione inizia). */
  private stopClassAnimation(): void {
    this.classStopped = true;
    this.classActive = false;
    for (const t of this.classTimers) t.remove();
    this.classTimers = [];
    for (const st of this.students) this.tweens.killTweensOf(st.sprite);
  }

  /** Compagno di sfondo che "vive": si avvicina ai vicini, si gira, chiacchiera. */
  private startStudentLife(s: Phaser.GameObjects.Sprite, id: string, hx: number, hy: number): void {
    const dirOf = (dx: number, dy: number): string =>
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');

    const schedule = (): void => {
      this.classTimers.push(this.time.delayedCall(Phaser.Math.Between(1400, 3200), act));
    };

    const shadow = this.shadows.get(s);
    const act = (): void => {
      if (this.classStopped || !s.active) return;     // lezione iniziata: stop definitivo
      if (!this.classActive) { schedule(); return; }  // arrivo/cutscene: in pausa, riprova dopo
      const roll = Math.random();
      const other = this.nearestStudentTo(s);

      if (roll < 0.45) {
        // Si avvicina un po' a un compagno (o gironzola vicino al posto)
        let tx: number, ty: number;
        if (other) {
          const dx = other.x - s.x, dy = other.y - s.y;
          const d = Math.hypot(dx, dy) || 1;
          const step = Math.max(0, Math.min(d - 16, 14));   // fermati a ~16px dal vicino
          tx = s.x + (dx / d) * step;
          ty = s.y + (dy / d) * step;
        } else {
          tx = hx + Phaser.Math.Between(-12, 12);
          ty = hy + Phaser.Math.Between(-6, 6);
        }
        tx = Phaser.Math.Clamp(tx, hx - 22, hx + 22);
        ty = Phaser.Math.Clamp(ty, hy - 12, hy + 12);
        const dir = dirOf(tx - s.x, ty - s.y);
        s.play(`${id}-walk-${dir}`, true);
        this.tweens.add({
          targets: s, x: tx, y: ty,
          duration: Phaser.Math.Between(500, 950), ease: 'Sine.easeInOut',
          onUpdate: () => {
            s.setDepth(s.y);
            shadow?.setPosition(s.x, s.y + SHADOW_OFFSET_Y).setDepth(s.y - 1);  // l'ombra segue
          },
          onComplete: () => { s.play(`${id}-idle-${dir}`, true); schedule(); },
        });
        return;   // il reschedule avviene a fine camminata
      }

      if (roll < 0.78 && other) {
        // Si gira verso il vicino e chiacchiera
        s.play(`${id}-idle-${dirOf(other.x - s.x, other.y - s.y)}`, true);
        this.studentBubble(s);
      } else {
        s.play(`${id}-idle-${Phaser.Utils.Array.GetRandom(['down', 'left', 'right', 'up'])}`, true);
      }
      schedule();
    };

    schedule();
  }

  /** Sprite del compagno più vicino (diverso da s), o null. */
  private nearestStudentTo(s: Phaser.GameObjects.Sprite): Phaser.GameObjects.Sprite | null {
    let best: Phaser.GameObjects.Sprite | null = null;
    let bestD = Infinity;
    for (const st of this.students) {
      if (st.sprite === s || !st.sprite.active) continue;
      const d = Phaser.Math.Distance.Between(s.x, s.y, st.sprite.x, st.sprite.y);
      if (d < bestD) { bestD = d; best = st.sprite; }
    }
    return best;
  }

  /** Nuvoletta di chiacchiera sopra un compagno. */
  private studentBubble(s: Phaser.GameObjects.Sprite): void {
    const t = this.add.text(s.x, s.y - 15, Phaser.Utils.Array.GetRandom(CLASS_CHATTER), {
      fontFamily: FONT, fontSize: '4px', color: '#222222', align: 'center',
      backgroundColor: '#ffffff', padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setDepth(s.y + 400).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 150 });
    this.time.delayedCall(1200, () =>
      this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() }),
    );
  }

  private updateFollowers(): void {
    const dt = this.game.loop.delta / 1000;
    const targets = [this.player.sprite, this.umberto];
    this.followers.forEach((f, i) => {
      const t = targets[i];
      const dx = t.x - f.sprite.x;
      const dy = t.y - f.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 22) {
        const speed = Math.min(130, 90 + (dist - 22) * 2);
        f.sprite.x += (dx / dist) * speed * dt;
        f.sprite.y += (dy / dist) * speed * dt;
        f.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        f.sprite.anims.play(`${f.id}-walk-${f.facing}`, true);
      } else {
        f.sprite.anims.play(`${f.id}-idle-${f.facing}`, true);
      }
      f.sprite.setDepth(f.sprite.y);
      this.shadows.get(f.sprite)?.setPosition(f.sprite.x, f.sprite.y + SHADOW_OFFSET_Y).setDepth(f.sprite.y - 1);
      this.nameLabels.get(f.sprite)?.setPosition(f.sprite.x, f.sprite.y - 20).setDepth(f.sprite.y + 1);
    });
  }

  private spawnFollower(id: string, x: number, y: number, facing: string): Phaser.GameObjects.Sprite {
    const sprite = this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE);
    sprite.play(`${id}-idle-${facing}`);
    sprite.setDepth(y);
    this.shadows.set(sprite, addShadow(this, x, y));
    this.nameLabels.set(sprite, addNameLabel(this, x, y, id));
    this.followers.push({ sprite, id, facing });
    return sprite;
  }

  private tryInteract(): void {
    if (this.dialogue.isActive || this.player.locked || this.trandeTalked) return;
    const npc = this.player.nearbyNpc;
    if (!npc || npc.id !== 'trande') return;
    this.trandeTalked = true;
    this.questHUD.clear();
    this.questHUD.hideMarker();
    this.dialogue.start({
      lines: TRANDE_LINES,
      onComplete: () => void this.runCeceSequence(),
    });
  }

  // ─── Sequenza Cece ────────────────────────────────────────────────────────

  private async runCeceSequence(): Promise<void> {
    this.player.locked = true;
    this.cutscene = true;
    this.stopClassAnimation();   // i compagni smettono di muoversi (vanno ai banchi)

    // Cece entra dalla porta sud e raggiunge la cattedra
    this.cece = this.add.sprite(240, WORLD_H + 24, 'char-cece', 1).setScale(CHAR_SCALE);
    const ceceShadow = addShadow(this, this.cece.x, this.cece.y);
    const ceceLabel = addNameLabel(this, this.cece.x, this.cece.y, 'cece');
    this.cece.play('cece-walk-up');
    await this.tweenP({
      targets: this.cece,
      y: 94,
      duration: 2400,
      onUpdate: () => {
        this.cece.setDepth(this.cece.y);
        ceceShadow.setPosition(this.cece.x, this.cece.y + SHADOW_OFFSET_Y).setDepth(this.cece.y - 1);
        ceceLabel.setPosition(this.cece.x, this.cece.y - 20).setDepth(this.cece.y + 1);
      },
    });
    this.cece.play('cece-idle-down');

    await this.runDialogue(CECE_INTRO_LINES);

    // Tutti ai banchi
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    playerBody.enable = false;
    const moves: Promise<void>[] = [
      this.walkTo(this.player.sprite, 'bubi', 106, 168),
      this.walkTo(this.umberto, 'umberto', 142, 168),
      this.walkTo(this.chiara, 'chiara', 302, 168),
    ];
    const seats = this.freeSeats();
    [...this.students, { sprite: this.trande, id: 'trande' }].forEach((s, i) => {
      const [sx, sy] = seats[i];
      moves.push(this.delay(i * 110).then(() => this.walkTo(s.sprite, s.id, sx, sy)));
    });
    await Promise.all(moves);

    await this.runDialogue(LESSON_LINES);

    // ── Minigioco milionario ──
    await this.playMillionaireGame();

    // Teletrasporto alla festa
    this.spawnTeleportParticles();
    await this.delay(450);
    await TransitionSystem.teleportToScene(this, 'BiciScene');
  }

  // ─── Chi Vuole Essere Milionario ──────────────────────────────────────────

  private async playMillionaireGame(): Promise<void> {
    // Intro fino a "Bubi, siediti di fronte a me."
    await this.runDialogue(MG_INTRO_LINES.slice(0, 4));
    // Bubi si alza dal banco e va davanti a Cece (alla cattedra)
    await this.walkTo(this.player.sprite, 'bubi', 240, this.cece.y + 34);
    // Resto dell'intro ("Benvenuti a CHI VUOLE ESSERE MILIONARIO?")
    await this.runDialogue(MG_INTRO_LINES.slice(4));

    // Blocca la camera sul centro (così l'UI in screen-space funziona bene)
    this.cameras.main.stopFollow();

    // Fade in dello sfondo milionario
    this.buildMgBackground();

    // ── Counter montepremi ─────────────────────────────────────────────────
    const OX = UI_OFF_X;
    const OY = UI_OFF_Y;
    const D_CTR = 515;
    let totalEarned = 0;
    const formatPrize = (n: number) =>
      '€ ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const ctrBg = this.mgEl(this.add.graphics().setScrollFactor(0).setDepth(D_CTR));
    ctrBg.fillStyle(0x00001c, 0.93);
    ctrBg.fillRoundedRect(4 + OX, 250 + OY, 134, 16, 3);
    ctrBg.lineStyle(1, 0x2244bb, 0.65);
    ctrBg.strokeRoundedRect(4 + OX, 250 + OY, 134, 16, 3);

    this.mgEl(this.add.text(9 + OX, 258 + OY, 'MONTEPREMI', {
      fontFamily: FONT, fontSize: '4px', color: '#4466aa',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D_CTR + 1));

    const ctrValue = this.mgEl(this.add.text(136 + OX, 258 + OY, '€ 0', {
      fontFamily: FONT, fontSize: '4px', color: '#ffd700',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(D_CTR + 1));
    // ───────────────────────────────────────────────────────────────────────

    // Tutti gli elementi partono trasparenti, poi fade in
    this.mgElements.forEach(e => {
      if ('setAlpha' in e) (e as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    });
    this.mgLadderEls.forEach(e => {
      if ('setAlpha' in e) (e as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    });
    await new Promise<void>(resolve =>
      this.tweens.add({
        targets: [...this.mgElements, ...this.mgLadderEls],
        alpha: 1,
        duration: 700,
        ease: 'Sine.easeIn',
        onComplete: () => resolve(),
      })
    );
    await this.delay(200);
    AudioManager.get().playFgMusic(this, 'tension', 0.72);

    for (let i = 0; i < MILLIONAIRE_QUESTIONS.length; i++) {
      const qData = MILLIONAIRE_QUESTIONS[i];

      // Dialogo di introduzione domanda
      await this.runDialogue(MG_BEFORE_LINES[i]);

      // Mostra la domanda e aspetta la risposta del giocatore
      const selected = await this.showMgQuestion(qData, i);

      // ESC premuto → esci dal loop
      if (selected === -1) { this.clearMgQuestion(); break; }

      // Rivela esito
      await this.revealMgAnswer(qData, selected);
      await this.delay(400);

      // Dialogo reazione
      const isCorrect = selected === qData.correct;

      // ── Aggiorna counter se risposta corretta ──
      if (isCorrect) {
        totalEarned += qData.prizeValue;
        ctrValue.setText(formatPrize(totalEarned));

        // Testo flotante "+€X"
        const floatTxt = this.add.text(
          71 + OX, 248 + OY,
          '+' + qData.prize,
          { fontFamily: FONT, fontSize: '5px', color: '#00ff88', stroke: '#000000', strokeThickness: 2 }
        ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(D_CTR + 2);
        this.tweens.add({
          targets: floatTxt,
          y: floatTxt.y - 24,
          alpha: 0,
          duration: 1300,
          ease: 'Cubic.easeOut',
          onComplete: () => floatTxt.destroy(),
        });
      }
      // ──────────────────────────────────────────

      await this.runDialogue(isCorrect ? MG_CORRECT_LINES[i] : MG_WRONG_LINES[i]);

      // Pulisci elementi domanda per la prossima
      this.clearMgQuestion();
    }

    // Fade out UI milionario + musica
    AudioManager.get().stopFgMusic(this);
    const allEls = [...this.mgElements, ...this.mgLadderEls];
    this.tweens.add({ targets: allEls, alpha: 0, duration: 600 });
    await this.delay(700);
    for (const e of this.mgElements) e.destroy();
    this.mgElements = [];
    for (const e of this.mgLadderEls) e.destroy();
    this.mgLadderEls = [];

    // ── Outro dinamico con montepremi ──────────────────────────────────────
    const prizeLines: DialogueLine[] =
      totalEarned >= 1_000_000
        ? [
            { speaker: 'cece', text: '...e Bubi porta a casa UN MILIONE DI EURO!!' },
            { speaker: 'bubi', text: 'Non lo vedo però.' },
            { speaker: 'cece', text: '...no. Ma che soddisfazione, eh?!' },
          ]
        : totalEarned > 0
        ? [
            { speaker: 'cece', text: `...e Bubi porta a casa ${formatPrize(totalEarned)}!!` },
            { speaker: 'bubi', text: 'Bello. Peccato che non li prendo.' },
            { speaker: 'cece', text: '...no. Ma che soddisfazione, eh?!' },
          ]
        : [
            { speaker: 'cece', text: '...ma purtroppo Bubi porta a casa zero euro.' },
            { speaker: 'bubi', text: 'Non mi stupisce.' },
          ];

    // Due fili tenuti SEPARATI per non accavallarli:
    //   1) chiusura da game-show con l'annuncio del montepremi
    //   2) chiusura della lezione + gancio al teletrasporto (frase continua)
    await this.runDialogue([
      ...prizeLines,        // "...e Bubi porta a casa X!" → reazione di Bubi
      ...MG_OUTRO_LINES,    // "la lezione è conclusa" ... "ora sai un sacco di cose... tranne una cosa..." ... "con chi stai parlando?"
    ]);
  }

  /** Costruisce lo sfondo stile milionario (fisso alla camera). */
  private buildMgBackground(): void {
    const D  = 500;
    const OX = UI_OFF_X; // 240
    const OY = UI_OFF_Y; // 135
    const W  = GAME_WIDTH;  // 480
    const H  = GAME_HEIGHT; // 270

    // ── Overlay nero ────────────────────────────────────────────────────────
    this.mgEl(
      this.add.rectangle(OX, OY, W, H, 0x000000, 1)
        .setOrigin(0).setScrollFactor(0).setDepth(D)
    );

    // ── Sfondo viola/blu — gradiente radiale liscio (10 ellissi, outer→inner) ──
    const bg = this.add.graphics({ x: OX, y: OY }).setScrollFactor(0).setDepth(D + 1);
    const GRAD_STEPS = 10;
    for (let i = 0; i < GRAD_STEPS; i++) {
      const t   = i / (GRAD_STEPS - 1);                              // 0=bordo, 1=centro
      const r   = Math.round(2  + t * 38);                           // 2 → 40
      const b   = Math.round(16 + t * 120);                          // 16 → 136
      const col = Phaser.Display.Color.GetColor(r, 0, b);
      const sc  = 1.1 - t * 0.9;                                     // 1.1 → 0.2
      bg.fillStyle(col, 1);
      bg.fillEllipse(W / 2, H / 2, W * sc, H * sc);
    }
    // Alone angoli per spezzare la simmetria
    bg.fillStyle(0x2a0060, 0.22);
    bg.fillCircle(W * 0.05, H * 0.05, 160);
    bg.fillStyle(0x000880, 0.18);
    bg.fillCircle(W * 0.95, H * 0.95, 140);
    this.mgEl(bg);

    // ── Stelle sparse — 3 colori + alpha variabile ───────────────────────────
    const STAR_COLS = [0xffffff, 0xdde8ff, 0xffeecc];
    const stars = this.add.graphics({ x: OX, y: OY }).setScrollFactor(0).setDepth(D + 2);
    for (let i = 0; i < 70; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, H);
      const sz = Math.random() < 0.82 ? 1 : 2;
      stars.fillStyle(STAR_COLS[i % 3], Phaser.Math.FloatBetween(0.5, 1.0));
      stars.fillRect(sx, sy, sz, sz);
    }
    this.mgEl(stars);

    // ── Striscia titolo (pill) ───────────────────────────────────────────────
    const titlePill = this.add.graphics({ x: OX, y: OY }).setScrollFactor(0).setDepth(D + 10);
    titlePill.fillStyle(0x08003a, 0.97);
    titlePill.fillRoundedRect(6, 2, W - 12, 17, 6);
    // Bordo esterno metallico (silver)
    titlePill.lineStyle(2, 0x9999bb, 0.85);
    titlePill.strokeRoundedRect(6, 2, W - 12, 17, 6);
    // Bordo interno dorato tenue
    titlePill.lineStyle(1, 0xffaa00, 0.4);
    titlePill.strokeRoundedRect(8, 4, W - 16, 13, 5);
    this.mgEl(titlePill);

    this.mgEl(
      this.add.text(W / 2 + OX, 10 + OY, '★  CHI VUOLE ESSERE MILIONARIO?  ★', {
        fontFamily: FONT, fontSize: '6px',
        color: '#ffd700', stroke: '#220800', strokeThickness: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 11)
    );
  }

  /**
   * Mostra una domanda con le 4 risposte (effetto ACCENDIAMO) e aspetta la scelta.
   *
   * Flusso a 2 click:
   *   1° click  → selezione evidenziata + overlay "SCOSSA!"
   *   2° click  → conferma → resolve(i)
   * Cliccando una risposta diversa in fase di conferma si cambia selezione.
   */
  private showMgQuestion(qData: MgQuestion, idx: number): Promise<number> {
    return new Promise((resolve) => {
      // ESC — salta la domanda (resolve(-1) → for loop rompe il ciclo)
      const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      // done() garantisce che removeKey venga chiamato su OGNI percorso di uscita,
      // non solo su ESC — così non si accumulano listener tra una domanda e l'altra.
      const done = (result: number): void => {
        this.input.keyboard!.removeKey(escKey);
        resolve(result);
      };
      escKey.once('down', () => done(-1));
      const D     = 510;
      const BTN_W = 163;
      const BTN_H = 31;
      const OX    = UI_OFF_X;
      const OY    = UI_OFF_Y;
      const N     = MILLIONAIRE_QUESTIONS.length;
      const LETTERS = ['A', 'B', 'C', 'D'];

      // ── Monte premi aggiornato ──────────────────────────────────────────────
      this.drawPrizeLadder(idx);

      // ── Badge DOMANDA X / N ─────────────────────────────────────────────────
      const badge = this.add.graphics({ x: OX, y: OY }).setScrollFactor(0).setDepth(D);
      badge.fillStyle(0xffaa00, 1);
      badge.fillRoundedRect(95, 14, 158, 11, 3);
      this.mgQEl(badge);

      this.mgQEl(
        this.add.text(174 + OX, 20 + OY, `DOMANDA  ${idx + 1}  /  ${N}`, {
          fontFamily: FONT, fontSize: '4px', color: '#000000',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1)
      );

      // ── Box domanda (pill metallica) ────────────────────────────────────────
      const qPill = this.add.graphics({ x: OX, y: OY }).setScrollFactor(0).setDepth(D);
      qPill.fillStyle(0x04042c, 0.97);
      qPill.fillRoundedRect(6, 27, 342, 52, 9);
      qPill.lineStyle(2, 0x8899cc, 0.88);
      qPill.strokeRoundedRect(6, 27, 342, 52, 9);
      qPill.lineStyle(1, 0x334488, 0.45);
      qPill.strokeRoundedRect(8, 29, 338, 48, 8);
      qPill.lineStyle(1, 0xffaa00, 0.35);
      qPill.lineBetween(16, 27, 334, 27);
      this.mgQEl(qPill);

      this.mgQEl(
        this.add.text(175 + OX, 53 + OY, qData.q, {
          fontFamily: FONT, fontSize: '5px', color: '#e8eeff',
          align: 'center', wordWrap: { width: 328 }, lineSpacing: 3,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1)
      );

      // ── Bottoni 2×2 (A/B sopra, C/D sotto) ─────────────────────────────────
      // Ogni bottone: BTN_W=163, BTN_H=31, gap=8
      // A: x=8,y=85   B: x=179,y=85
      // C: x=8,y=122  D: x=179,y=122
      const positions: [number, number][] = [
        [8,   85], [179,  85],
        [8,  122], [179, 122],
      ];

      this.mgBtnBgs = [];
      let phase: 'select' | 'confirm' | 'locked' = 'select';
      let selectedIdx = -1;

      // ── SCOSSA! overlay (appare dopo 1° click) ──────────────────────────────
      const scossaBg = this.add.graphics().setScrollFactor(0).setDepth(D + 8).setAlpha(0);
      scossaBg.fillStyle(0x000024, 0.97);
      scossaBg.fillRoundedRect(8 + OX, 162 + OY, 338, 46, 5);
      scossaBg.lineStyle(2, 0xffaa00, 1);
      scossaBg.strokeRoundedRect(8 + OX, 162 + OY, 338, 46, 5);
      this.mgQEl(scossaBg);

      const confirmWord = idx % 2 === 0 ? 'S C O S S A !' : 'A C C E N D I A M O !';
      const scossaMain = this.add.text(175 + OX, 177 + OY, confirmWord, {
        fontFamily: FONT, fontSize: '11px', color: '#ffdd44',
        stroke: '#110000', strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 9).setAlpha(0);
      this.mgQEl(scossaMain);

      const scossaHint = this.add.text(175 + OX, 197 + OY, '◆  clicca ancora per confermare  ◆', {
        fontFamily: FONT, fontSize: '4px', color: '#8899bb',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 9).setAlpha(0);
      this.mgQEl(scossaHint);

      const showScossa = () => {
        this.tweens.killTweensOf(scossaMain);
        scossaBg.setAlpha(1);
        scossaMain.setAlpha(1).setScale(1);
        scossaHint.setAlpha(1);
        this.tweens.add({
          targets: scossaMain,
          scaleX: 1.06, scaleY: 1.06,
          duration: 380,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      };
      const hideScossa = () => {
        this.tweens.killTweensOf(scossaMain);
        scossaBg.setAlpha(0);
        scossaMain.setAlpha(0).setScale(1);
        scossaHint.setAlpha(0);
      };

      // ── Crea i 4 bottoni ────────────────────────────────────────────────────
      positions.forEach(([bx, by], i) => {
        const bg = this.add.graphics()
          .setScrollFactor(0).setDepth(D + 2).setAlpha(0);
        bg.setPosition(bx + OX, by + OY);
        this.drawMgBtn(bg, BTN_W, BTN_H, 'normal');
        this.mgQEl(bg);
        this.mgBtnBgs.push(bg);

        // Lettera in oro (A: B: C: D:)
        const letterEl = this.add.text(
          bx + 14 + OX, by + BTN_H / 2 + OY,
          LETTERS[i] + ':',
          { fontFamily: FONT, fontSize: '5px', color: '#ffcc44' }
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 3).setAlpha(0);
        this.mgQEl(letterEl);

        // Testo risposta (senza prefisso lettera)
        const ansText = this.add.text(
          bx + 28 + OX, by + BTN_H / 2 + OY,
          qData.opts[i],
          { fontFamily: FONT, fontSize: '5px', color: '#aaddff',
            wordWrap: { width: BTN_W - 34 } }
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 3).setAlpha(0);
        this.mgQEl(ansText);

        // Zona click (più larga per coprire l'intera area bottone)
        const zone = this.add.zone(
          bx + BTN_W / 2 + OX, by + BTN_H / 2 + OY,
          BTN_W, BTN_H
        ).setScrollFactor(0).setDepth(D + 4);
        this.mgQEl(zone);

        // Effetto ACCENDIAMO: stagger 200ms per ogni risposta
        this.time.delayedCall(i * 200, () => {
          this.cameras.main.flash(50, 255, 220, 80, true);
          this.tweens.add({
            targets: [bg, letterEl, ansText],
            alpha: 1,
            duration: 150,
            ease: 'Back.easeOut',
            onComplete: () => {
              zone.setInteractive();

              zone.on('pointerover', () => {
                if (phase === 'locked') return;
                if (selectedIdx !== i) {
                  bg.clear();
                  this.drawMgBtn(bg, BTN_W, BTN_H, 'hover');
                }
              });
              zone.on('pointerout', () => {
                if (phase === 'locked') return;
                if (selectedIdx !== i) {
                  bg.clear();
                  this.drawMgBtn(bg, BTN_W, BTN_H, 'normal');
                }
              });

              zone.on('pointerdown', () => {
                if (phase === 'locked') return;

                // ── 2° click sulla stessa risposta → CONFERMA ────────────────
                if (phase === 'confirm' && selectedIdx === i) {
                  phase = 'locked';
                  hideScossa();
                  AudioManager.get().playSFX(this, 'confirm', 0.6);
                  this.time.delayedCall(220, () => done(i));
                  return;
                }

                // ── 1° click (o cambio selezione) → mostra SCOSSA! ──────────
                if (selectedIdx >= 0 && selectedIdx !== i) {
                  // Deseleziona la scelta precedente
                  const prev = this.mgBtnBgs[selectedIdx];
                  prev.clear();
                  this.drawMgBtn(prev, BTN_W, BTN_H, 'normal');
                }
                selectedIdx = i;
                phase = 'confirm';
                bg.clear();
                this.drawMgBtn(bg, BTN_W, BTN_H, 'selected');
                AudioManager.get().playSFX(this, 'confirm', 0.4);
                hideScossa();
                showScossa();
              });
            },
          });
        });
      });
    });
  }

  /** Rivela la risposta giusta (verde) e quella sbagliata se diversa (rossa). */
  private async revealMgAnswer(qData: MgQuestion, selected: number): Promise<void> {
    const BTN_W = 163;
    const BTN_H = 31;
    const positions: [number, number][] = [
      [8, 85], [179, 85], [8, 122], [179, 122],
    ];

    // Tamburo rullo (attesa drammatica)
    await this.delay(600);

    for (let i = 0; i < 4; i++) {
      const bg = this.mgBtnBgs[i];
      if (!bg) continue;
      bg.clear();
      if (i === qData.correct) {
        this.drawMgBtn(bg, BTN_W, BTN_H, 'correct');
        // Suono positivo solo se il giocatore ha davvero indovinato
        // (simmetrico al suono negativo della risposta sbagliata).
        if (selected === qData.correct) AudioManager.get().playSFX(this, 'coin', 0.6);
        // Particelle sul bottone corretto (posizione canvas = logica + offset)
        this.ensureFxTexture();
        const [px, py] = positions[i];
        const em = this.add.particles(px + BTN_W / 2 + UI_OFF_X, py + BTN_H / 2 + UI_OFF_Y, 'mg-fx', {
          speed: { min: 20, max: 70 },
          lifespan: 500,
          scale: { start: 1, end: 0 },
          tint: [0x00ff88, 0xffd700, 0xffffff],
          emitting: false,
        }).setScrollFactor(0).setDepth(590);
        em.explode(18);
        this.time.delayedCall(600, () => em.destroy());
      } else if (i === selected && selected !== qData.correct) {
        this.drawMgBtn(bg, BTN_W, BTN_H, 'wrong');
        this.cameras.main.shake(200, 0.008);
        AudioManager.get().playSFX(this, 'hit', 0.55);
        // Flash rosso a schermo intero
        const flash = this.add
          .rectangle(UI_OFF_X, UI_OFF_Y, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.45)
          .setScrollFactor(0).setDepth(600).setOrigin(0);
        this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Sine.easeOut',
          onComplete: () => flash.destroy() });
      } else {
        this.drawMgBtn(bg, BTN_W, BTN_H, 'dimmed');
      }
    }
    await this.delay(900);
  }

  /**
   * Ridisegna un bottone pill metallico stile Milionario.
   * Il Graphics è già posizionato in screen-space; si disegna attorno a (0,0).
   */
  private drawMgBtn(
    g: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    style: 'normal' | 'hover' | 'selected' | 'correct' | 'wrong' | 'dimmed'
  ): void {
    const r = h / 2; // pill radius

    const fills: Record<string, [number, number]> = {
      normal:   [0x05052e, 0.95],
      hover:    [0x0c0c50, 1],
      selected: [0x1a0c00, 1],
      correct:  [0x001608, 1],
      wrong:    [0x180000, 1],
      dimmed:   [0x030318, 0.55],
    };
    const outerBorder: Record<string, [number, number]> = {
      normal:   [0x8899cc, 0.88],
      hover:    [0xbbccff, 1],
      selected: [0xffbb00, 1],
      correct:  [0x00dd44, 1],
      wrong:    [0xdd0000, 1],
      dimmed:   [0x1a2244, 0.4],
    };
    const innerBorder: Record<string, [number, number]> = {
      normal:   [0x223366, 0.4],
      hover:    [0x445588, 0.5],
      selected: [0xaa7700, 0.45],
      correct:  [0x006622, 0.45],
      wrong:    [0x660000, 0.45],
      dimmed:   [0x0a0a22, 0.25],
    };

    const [fc, fa]   = fills[style];
    const [oc, oa]   = outerBorder[style];
    const [ic, ia]   = innerBorder[style] ?? [0x223366, 0.4];

    // 1. Fill pill
    g.fillStyle(fc, fa);
    g.fillRoundedRect(0, 0, w, h, r);

    // 2. Top-highlight (sheen metallico nella metà superiore)
    if (style !== 'dimmed') {
      g.fillStyle(0xffffff, 0.07);
      g.fillRoundedRect(1, 1, w - 2, h * 0.52, r - 1);
    }

    // 3. Bordo interno (inset)
    g.lineStyle(1, ic, ia);
    g.strokeRoundedRect(2, 2, w - 4, h - 4, r - 2);

    // 4. Bordo esterno metallico
    g.lineStyle(2, oc, oa);
    g.strokeRoundedRect(0, 0, w, h, r);

    // 5. Diamante ◆ che sbuca dal lato sinistro del pill
    if (style !== 'dimmed') {
      const ds = 4;
      const cy = h / 2;
      g.fillStyle(oc, oa * 0.9);
      g.fillPoints([
        { x: -ds,      y: cy      },
        { x: 0,        y: cy - ds * 0.55 },
        { x: ds * 0.5, y: cy      },
        { x: 0,        y: cy + ds * 0.55 },
      ], true);
    }
  }

  /** Disegna il monte premi laterale, evidenziando la domanda corrente. */
  private drawPrizeLadder(currentIdx: number): void {
    for (const e of this.mgLadderEls) e.destroy();
    this.mgLadderEls = [];
    const mEl = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.mgLadderEls.push(o);
      return o;
    };

    const OX = UI_OFF_X;
    const OY = UI_OFF_Y;
    const LX = 354;          // left edge in game-space
    const LW = 120;           // width
    const ROW_H = 30;
    const START_Y = 21;
    const N = MILLIONAIRE_QUESTIONS.length; // 7
    const D = 512;

    // Pannello di sfondo
    const panelBg = mEl(this.add.graphics().setScrollFactor(0).setDepth(D));
    panelBg.fillStyle(0x00001c, 0.93);
    panelBg.fillRoundedRect(LX + OX, START_Y + OY, LW, ROW_H * N + 8, 4);
    panelBg.lineStyle(1, 0x2244bb, 0.65);
    panelBg.strokeRoundedRect(LX + OX, START_Y + OY, LW, ROW_H * N + 8, 4);

    // Righe — dal più alto (in cima) al più basso (in fondo)
    for (let i = N - 1; i >= 0; i--) {
      const rowI = N - 1 - i;
      const ry = START_Y + 4 + rowI * ROW_H + OY;
      const rx = LX + 3 + OX;
      const rw = LW - 6;
      const rh = ROW_H - 3;

      const isCurrent = i === currentIdx;
      const isPast    = i < currentIdx;

      if (isCurrent) {
        const hl = mEl(this.add.graphics().setScrollFactor(0).setDepth(D + 1));
        hl.fillStyle(0x2a1000, 0.95);
        hl.fillRoundedRect(rx, ry, rw, rh, 2);
        hl.lineStyle(1, 0xffaa00, 0.9);
        hl.strokeRoundedRect(rx, ry, rw, rh, 2);
      } else if (isPast) {
        const hl = mEl(this.add.graphics().setScrollFactor(0).setDepth(D + 1));
        hl.fillStyle(0x001a00, 0.6);
        hl.fillRoundedRect(rx, ry, rw, rh, 2);
      }

      const numColor   = isCurrent ? '#ffdd44' : isPast ? '#44aa44' : '#4466aa';
      const prizeColor = isCurrent ? '#ffd700' : isPast ? '#33aa33' : '#334466';

      mEl(this.add.text(
        rx + 5, ry + rh / 2 + 1,
        String(i + 1),
        { fontFamily: FONT, fontSize: '4px', color: numColor }
      ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 2));

      mEl(this.add.text(
        rx + rw - 2, ry + rh / 2 + 1,
        MILLIONAIRE_QUESTIONS[i].prize,
        { fontFamily: FONT, fontSize: '4px', color: prizeColor }
      ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(D + 2));

      // Separatore
      if (rowI < N - 1) {
        const sep = mEl(this.add.graphics().setScrollFactor(0).setDepth(D));
        sep.lineStyle(1, 0x0033aa, 0.25);
        sep.lineBetween(rx, ry + rh + 1, rx + rw, ry + rh + 1);
      }
    }
  }

  private clearMgQuestion(): void {
    for (const e of this.mgQElements) e.destroy();
    this.mgQElements = [];
    this.mgBtnBgs = [];
  }

  // Helpers per raccogliere elementi in liste di cleanup
  private mgEl<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.mgElements.push(obj);
    return obj;
  }
  private mgQEl<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.mgQElements.push(obj);
    return obj;
  }

  private ensureFxTexture(): void {
    if (!this.textures.exists('mg-fx')) {
      const g = this.make.graphics();
      g.fillStyle(0xffffff).fillRect(0, 0, 4, 4);
      g.generateTexture('mg-fx', 4, 4);
      g.destroy();
    }
  }

  // ─── Helpers comuni ───────────────────────────────────────────────────────

  private runDialogue(lines: DialogueLine[]): Promise<void> {
    return new Promise((resolve) => this.dialogue.start({ lines, onComplete: resolve }));
  }

  private freeSeats(): [number, number][] {
    const reserved = new Set(['106,168', '142,168', '302,168']);
    const seats: [number, number][] = [];
    for (const row of DESK_ROWS) {
      for (const col of [...DESK_COLS_A, ...DESK_COLS_B]) {
        if (!reserved.has(`${col},${row + 18}`)) seats.push([col, row + 18]);
      }
    }
    return seats;
  }

  private walkTo(sprite: Phaser.GameObjects.Sprite, charId: string, x: number, y: number): Promise<void> {
    const dx = x - sprite.x;
    const dy = y - sprite.y;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    sprite.play(`${charId}-walk-${dir}`);
    const duration = (Phaser.Math.Distance.Between(sprite.x, sprite.y, x, y) / 90) * 1000;
    const shadow = this.shadows.get(sprite);
    const label = this.nameLabels.get(sprite);
    return this.tweenP({
      targets: sprite,
      x,
      y,
      duration: Math.max(200, duration),
      onUpdate: () => {
        sprite.setDepth(sprite.y);
        shadow?.setPosition(sprite.x, sprite.y + SHADOW_OFFSET_Y).setDepth(sprite.y - 1);
        label?.setPosition(sprite.x, sprite.y - 20).setDepth(sprite.y + 1);
      },
    }).then(() => {
      sprite.play(`${charId}-idle-up`);
    });
  }

  private spawnTeleportParticles(): void {
    if (!this.textures.exists('battle-px')) {
      const g = this.make.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture('battle-px', 4, 4);
      g.destroy();
    }
    for (const s of [this.player.sprite, this.umberto, this.chiara]) {
      const em = this.add
        .particles(s.x, s.y, 'battle-px', {
          speed: { min: 30, max: 110 },
          lifespan: 600,
          scale: { start: 1.4, end: 0 },
          tint: [0x66ffee, 0xffffff, 0x88aaff],
          emitting: false,
        })
        .setDepth(1600);
      em.explode(30);
      const extras: Phaser.GameObjects.GameObject[] = [s];
      const shadow = s === this.player.sprite ? this.player.shadow : this.shadows.get(s);
      const label = s === this.player.sprite ? this.player.nameLabel : this.nameLabels.get(s);
      if (shadow) extras.push(shadow);
      if (label) extras.push(label);
      this.tweens.add({ targets: extras, alpha: 0, duration: 500 });
    }
  }

  // ─── Mappa ────────────────────────────────────────────────────────────────

  private drawMap(): void {
    const g = this.make.graphics();

    for (let ty = 0; ty < WORLD_H / 16; ty++) {
      g.fillStyle(ty % 2 === 0 ? 0xc8a878 : 0xbc9c6c);
      g.fillRect(0, ty * 16, WORLD_W, 16);
    }
    g.lineStyle(1, 0xa3845a, 0.5);
    for (let x = 0; x < WORLD_W; x += 48) g.lineBetween(x, 0, x, WORLD_H);

    g.fillStyle(0xd8d4c8);
    g.fillRect(0, 0, WORLD_W, 44);
    g.fillRect(0, 0, 16, WORLD_H);
    g.fillRect(WORLD_W - 16, 0, 16, WORLD_H);
    g.fillRect(0, WORLD_H - 12, WORLD_W, 12);
    g.fillStyle(0x8a6a42);
    g.fillRect(220, WORLD_H - 12, 40, 12);

    g.fillStyle(0x7a5c34);
    g.fillRect(136, 4, 208, 36);
    g.fillStyle(0x2e6b4f);
    g.fillRect(140, 8, 200, 26);
    // Scritte a gesso sulla lavagna — y = mx + q e schema cartesiano
    g.fillStyle(0xffffff, 0.55);
    // Riga 1: "y = mx + q" (segmenti stilizzati)
    g.fillRect(150, 13, 5, 2);  // y
    g.fillRect(157, 13, 4, 2);  // =
    g.fillRect(163, 13, 10, 2); // mx
    g.fillRect(175, 13, 4, 2);  // +
    g.fillRect(181, 13, 5, 2);  // q
    // Riga 2: frase scritta (3 parole)
    g.fillRect(150, 19, 28, 2);
    g.fillRect(180, 19, 16, 2);
    g.fillRect(198, 19, 22, 2);
    // Mini asse cartesiano con retta
    g.lineStyle(1, 0xffffff, 0.38);
    g.lineBetween(264, 10, 264, 30); // asse y
    g.lineBetween(257, 28, 308, 28); // asse x
    g.lineBetween(258, 24, 306, 12); // retta y=mx+q
    // Annotazioni a destra
    g.fillStyle(0xffffff, 0.32);
    g.fillRect(316, 13, 14, 2);
    g.fillRect(316, 19, 9,  2);
    g.fillRect(316, 25, 13, 2);
    g.fillStyle(0xc9b896);
    g.fillRect(140, 34, 200, 4);

    g.fillStyle(0x6e5232);
    g.fillRect(206, 50, 8, 26);
    g.fillRect(266, 50, 8, 26);
    g.fillStyle(0x8a6a42);
    g.fillRect(200, 56, 80, 22);
    g.lineStyle(1, 0x5d4530);
    g.strokeRect(200, 56, 80, 22);
    this.addObstacle(200, 50, 80, 28);

    g.fillStyle(0x9fc4d8);
    for (let i = 0; i < 4; i++) g.fillRect(WORLD_W - 14, 60 + i * 62, 12, 34);

    g.fillStyle(0x7a5c34);
    g.fillRect(2, 100, 14, 70);
    g.lineStyle(1, 0x5d4530);
    g.strokeRect(2, 100, 14, 70);
    g.lineBetween(9, 100, 9, 170);

    for (const row of DESK_ROWS) {
      for (const col of [...DESK_COLS_A, ...DESK_COLS_B]) {
        g.fillStyle(0x9a7448);
        g.fillRect(col - 12, row - 7, 24, 14);
        g.fillStyle(0xb08a58);
        g.fillRect(col - 12, row - 7, 24, 3);
        this.addObstacle(col - 12, row - 7, 24, 14);
      }
    }

    // ── Dettagli area d'ingresso (dove arrivano i ragazzi) ──────────────────
    // Bacheca avvisi con fogli appuntati sulla parete destra
    g.fillStyle(0x7a5c34); g.fillRect(WORLD_W - 16, 200, 14, 44);
    g.fillStyle(0xc9a86a); g.fillRect(WORLD_W - 15, 202, 12, 40);
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(WORLD_W - 13, 206, 5, 6);
    g.fillRect(WORLD_W - 8,  216, 4, 7);
    g.fillRect(WORLD_W - 13, 228, 6, 5);

    if (!this.textures.exists('tex-map-aula')) {
      g.generateTexture('tex-map-aula', WORLD_W, WORLD_H);
    }
    g.destroy();
    this.add.image(0, 0, 'tex-map-aula').setOrigin(0).setDepth(-10);
  }

  private addObstacle(x: number, y: number, w: number, h: number): void {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(r, true);
    this.pendingObstacles.push(r);
  }

  private pendingObstacles: Phaser.GameObjects.Rectangle[] = [];

  private makeStatic(sprite: Phaser.GameObjects.Sprite): void {
    makeFeetBody(this, sprite);
    this.staticSprites.push(sprite);
    this.shadows.set(sprite, addShadow(this, sprite.x, sprite.y));
  }

  private staticSprites: Phaser.GameObjects.Sprite[] = [];
  private shadows = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Ellipse>();
  private nameLabels = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Text>();

  private spawnNamed(id: string, x: number, y: number, facing: string): Phaser.GameObjects.Sprite {
    const sprite = this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE);
    sprite.play(`${id}-idle-${facing}`);
    sprite.setDepth(y);
    this.makeStatic(sprite);
    this.nameLabels.set(sprite, addNameLabel(this, x, y, id));
    return sprite;
  }

  // ─── Util ─────────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tweenP(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}
