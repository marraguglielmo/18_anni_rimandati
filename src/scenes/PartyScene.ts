import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { DialogueSystem, type DialogueLine } from '../systems/DialogueSystem';
import {
  addNameLabel,
  addShadow,
  CHAR_CONFIGS,
  CHAR_SCALE,
  generateSpriteTexture,
  getPortraitKey,
  loadPortraits,
  makeFeetBody,
} from '../systems/CharacterSprite';
import { PlayerController } from '../systems/PlayerController';
import { TransitionSystem, UI_OFF_X, UI_OFF_Y } from '../systems/TransitionSystem';
import { AudioManager } from '../systems/AudioManager';
import { QuestHUD } from '../systems/QuestHUD';

// Festa di Ilaria — luglio 2019. Player = UMBERTO.
// I personaggi non sanno di aver viaggiato nel tempo: arrivano storditi
// e si comportano come se fosse una normale serata del 2019.
const WORLD_W = 600;
const WORLD_H = 270;
const FONT = '"Press Start 2P", monospace';
const ILARIA_POS = { x: 510, y: 145 };

// ─── Dance Floor ─────────────────────────────────────────────────────────────
// Posizione pista (world space 480×270)
const DF = { x: 30, y: 95, w: 92, h: 72 };
const DF_CX = DF.x + DF.w / 2; // ≈ 76
const DF_CY = DF.y + DF.h / 2; // ≈ 131

// Palla disco: posizione, raggio e palette (usate dall'animazione per frame)
const DISCO = { x: 240, y: 20, r: 11 };
const DISCO_RAY_COLS = [0xff3366, 0x3366ff, 0xffdd33, 0x33ff88, 0xcc44ff, 0xff8833];
const MIRROR_COLS = [0xffffff, 0xcfe0ff, 0x9fb8e0, 0xdfeaff, 0xbfd0f0];

// ↓ Cambia questo col BPM della tua canzone (usa un'app tipo BPMAnalyzer)
const DANCE_BPM = 130;
const DANCE_FALL_MS = 1700; // ms per cadere dall'alto alla hit zone

// ─── IMPOSTA QUI LA DURATA DELLA TUA CANZONE (in millisecondi) ───────────────
// Esempi: 180_000 = 3:00 min | 210_000 = 3:30 | 240_000 = 4:00
const DANCE_DURATION_MS = 90_000;   // 1 minuto e 30 secondi di danza
// ─────────────────────────────────────────────────────────────────────────────

// ─── OFFSET (ms) per allineare la beatmap al primo beat della canzone ─────────
// Se le frecce anticipano il beat → valore positivo (es. 200)
// Se le frecce arrivano in ritardo → valore negativo (es. -200)
// Calibrato via misurazione audio (prima kick a ~1130ms dal file, latenza ~50ms)
const DANCE_OFFSET_MS = 0;
// ─────────────────────────────────────────────────────────────────────────────

// Colori per direzione
const DIR_COL: Record<string, number> = {
  left: 0xff3388,
  down: 0x3399ff,
  up: 0x33ff88,
  right: 0xffcc33,
};

// X colonne in game space (centrate attorno a 240 nel minigame overlay)
const DANCE_COLS: Record<string, number> = {
  left: 155, down: 205, up: 255, right: 305,
};

const DANCE_DIRS = ['left', 'down', 'up', 'right'] as const;
type DanceDir = (typeof DANCE_DIRS)[number];

// (Il generatore procedurale LCG è stato rimosso: usa DANCE_BEATMAP_TIMBER qui sotto.
//  Per adattare un'altra canzone, aggiungi un analogo const MY_BEATMAP e sostituisci
//  il riferimento in playDanceMinigame → const beatmap = MY_BEATMAP.)

// ─── BEATMAP MANUALE: "Timber" — Pitbull ft. Ke$ha (130 BPM, 3:44) ──────────
// Struttura (stime a 130 BPM — regola DANCE_OFFSET_MS per l'allineamento):
//   intro      beats   0-15   (~0:00-0:07)
//   verse 1    beats  16-75   (~0:07-0:35)   ← half-note density
//   prechorus  beats  76-107  (~0:35-0:49)   ← quarter-note density
//   chorus 1   beats 108-171  (~0:49-1:19)   ← quarter + eighth
//   verse 2    beats 172-231  (~1:19-1:46)   ← half-note density
//   prechorus  beats 232-259  (~1:46-2:00)   ← quarter-note density
//   chorus 2   beats 260-327  (~2:00-2:31)   ← quarter + eighth
//   bridge     beats 328-383  (~2:31-2:57)   ← Ke$ha swing, quarter
//   final cho  beats 384-451  (~2:57-3:28)   ← leggermente più denso
//   outro      beats 452-485  (~3:28-3:44)   ← sparse
//
// ► CALIBRAZIONE OFFSET: guarda il dot bianco (●) in alto al centro.
//   Se il dot lampeggia PRIMA del beat → aumenta DANCE_OFFSET_MS (es. +200)
//   Se il dot lampeggia DOPO il beat  → diminuisci DANCE_OFFSET_MS (es. -200)
// ─────────────────────────────────────────────────────────────────────────────
const DANCE_BEATMAP_TIMBER: [number, DanceDir][] = [

  // ── INTRO (beats 0-15) — sparsissimo ─────────────────────────────────────
  [0,'right'],  [4,'up'],   [8,'left'],  [12,'down'],

  // ── VERSE 1 (beats 16-75) — 1 nota ogni 2 beat (mezza misura) ─────────────
  [16,'down'],  [18,'right'], [20,'up'],   [22,'left'],
  [24,'down'],  [26,'right'], [28,'up'],   [30,'left'],
  [32,'right'], [34,'down'],  [36,'left'], [38,'up'],
  [40,'down'],  [42,'right'], [44,'up'],   [46,'left'],
  [48,'left'],  [50,'down'],  [52,'right'], [54,'up'],
  [56,'right'], [58,'left'],  [60,'down'],  [62,'up'],
  [64,'up'],    [66,'left'],  [68,'down'],  [70,'right'],
  [72,'down'],  [74,'left'],

  // ── PRE-CHORUS 1 (beats 76-107) — 1 nota per beat ──────────────────────
  [76,'down'],  [77,'right'], [78,'up'],   [79,'left'],
  [80,'down'],  [81,'right'], [82,'up'],   [83,'left'],
  [84,'right'], [85,'down'],  [86,'left'], [87,'up'],
  [88,'right'], [89,'down'],  [90,'left'], [91,'up'],
  [92,'left'],  [93,'up'],   [94,'right'], [95,'down'],
  [96,'left'],  [97,'up'],   [98,'right'], [99,'down'],
  [100,'up'],   [101,'right'], [102,'down'], [103,'left'],
  [104,'up'],   [105,'right'], [106,'down'], [107,'left'],

  // ── CHORUS 1 × 2 (beats 108-171) — quarter + eighth sul terzo beat ───────
  // Ogni gruppo da 4 beat: 5 note (3-4 quarti + 1 ottavo sul 3)
  [108,'down'],  [109,'right'], [110,'up'],   [110.5,'left'], [111,'down'],
  [112,'right'], [113,'up'],    [114,'left'],  [114.5,'down'], [115,'right'],
  [116,'up'],    [117,'left'],  [118,'down'],  [118.5,'right'],[119,'up'],
  [120,'left'],  [121,'down'],  [122,'right'], [122.5,'up'],   [123,'left'],

  [124,'down'],  [125,'right'], [126,'up'],   [126.5,'left'], [127,'down'],
  [128,'right'], [129,'up'],    [130,'left'],  [130.5,'down'], [131,'right'],
  [132,'up'],    [133,'left'],  [134,'down'],  [134.5,'right'],[135,'up'],
  [136,'left'],  [137,'down'],  [138,'right'], [138.5,'up'],   [139,'left'],

  [140,'down'],  [141,'right'], [142,'up'],   [142.5,'left'], [143,'down'],
  [144,'right'], [145,'up'],    [146,'left'],  [146.5,'down'], [147,'right'],
  [148,'up'],    [149,'left'],  [150,'down'],  [150.5,'right'],[151,'up'],
  [152,'left'],  [153,'down'],  [154,'right'], [154.5,'up'],   [155,'left'],

  [156,'down'],  [157,'right'], [158,'up'],   [158.5,'left'], [159,'down'],
  [160,'right'], [161,'up'],    [162,'left'],  [162.5,'down'], [163,'right'],
  [164,'up'],    [165,'left'],  [166,'down'],  [166.5,'right'],[167,'up'],
  [168,'left'],  [169,'down'],  [170,'right'], [171,'up'],

  // ── VERSE 2 (beats 172-231) — identico a verse 1 ────────────────────────
  [172,'up'],   [174,'left'],  [176,'down'],  [178,'right'],
  [180,'up'],   [182,'left'],  [184,'down'],  [186,'right'],
  [188,'down'], [190,'up'],    [192,'right'], [194,'left'],
  [196,'up'],   [198,'down'],  [200,'left'],  [202,'right'],
  [204,'right'],[206,'up'],    [208,'down'],  [210,'left'],
  [212,'left'], [214,'right'], [216,'up'],    [218,'down'],
  [220,'down'], [222,'right'], [224,'up'],    [226,'left'],
  [228,'right'],[230,'down'],

  // ── PRE-CHORUS 2 (beats 232-259) ────────────────────────────────────────
  [232,'down'],  [233,'right'], [234,'up'],   [235,'left'],
  [236,'down'],  [237,'right'], [238,'up'],   [239,'left'],
  [240,'right'], [241,'down'],  [242,'left'], [243,'up'],
  [244,'right'], [245,'down'],  [246,'left'], [247,'up'],
  [248,'left'],  [249,'up'],   [250,'right'], [251,'down'],
  [252,'left'],  [253,'up'],   [254,'right'], [255,'down'],
  [256,'up'],    [257,'right'], [258,'down'],  [259,'left'],

  // ── CHORUS 2 × 2 (beats 260-327) ────────────────────────────────────────
  [260,'down'],  [261,'right'], [262,'up'],   [262.5,'left'], [263,'down'],
  [264,'right'], [265,'up'],    [266,'left'],  [266.5,'down'], [267,'right'],
  [268,'up'],    [269,'left'],  [270,'down'],  [270.5,'right'],[271,'up'],
  [272,'left'],  [273,'down'],  [274,'right'], [274.5,'up'],   [275,'left'],

  [276,'down'],  [277,'right'], [278,'up'],   [278.5,'left'], [279,'down'],
  [280,'right'], [281,'up'],    [282,'left'],  [282.5,'down'], [283,'right'],
  [284,'up'],    [285,'left'],  [286,'down'],  [286.5,'right'],[287,'up'],
  [288,'left'],  [289,'down'],  [290,'right'], [290.5,'up'],   [291,'left'],

  [292,'down'],  [293,'right'], [294,'up'],   [294.5,'left'], [295,'down'],
  [296,'right'], [297,'up'],    [298,'left'],  [298.5,'down'], [299,'right'],
  [300,'up'],    [301,'left'],  [302,'down'],  [302.5,'right'],[303,'up'],
  [304,'left'],  [305,'down'],  [306,'right'], [306.5,'up'],   [307,'left'],

  [308,'down'],  [309,'right'], [310,'up'],   [310.5,'left'], [311,'down'],
  [312,'right'], [313,'up'],    [314,'left'],  [314.5,'down'], [315,'right'],
  [316,'up'],    [317,'left'],  [318,'down'],  [319,'right'],
  [320,'up'],    [321,'left'],  [322,'down'],  [323,'right'],
  [324,'up'],    [325,'left'],  [326,'down'],  [327,'right'],

  // ── BRIDGE — Ke$ha "Swing your partner" (beats 328-383) ─────────────────
  // Country-swing: alternanza L↔R prevalente
  [328,'left'],  [330,'right'], [332,'left'],  [334,'right'],
  [336,'up'],    [337,'left'],  [338,'down'],  [339,'right'],
  [340,'up'],    [342,'left'],  [344,'down'],  [346,'right'],

  [348,'left'],  [350,'right'], [352,'left'],  [354,'right'],
  [356,'up'],    [357,'right'], [358,'down'],  [359,'left'],
  [360,'up'],    [362,'left'],  [364,'down'],  [366,'right'],

  [368,'left'],  [370,'right'], [372,'left'],  [374,'right'],
  [376,'up'],    [377,'left'],  [378,'down'],  [379,'right'],
  [380,'left'],  [381,'right'], [382,'left'],  [383,'right'],

  // ── FINAL CHORUS × 2 (beats 384-451) — più denso, non flood ─────────────
  [384,'down'],  [385,'right'], [386,'up'],   [386.5,'left'], [387,'down'],
  [388,'right'], [389,'up'],    [390,'left'],  [390.5,'down'], [391,'right'],
  [392,'up'],    [393,'left'],  [394,'down'],  [394.5,'right'],[395,'up'],
  [396,'left'],  [397,'down'],  [398,'right'], [398.5,'up'],   [399,'left'],

  [400,'down'],  [401,'right'], [402,'up'],   [402.5,'left'], [403,'down'],
  [404,'right'], [405,'up'],    [406,'left'],  [406.5,'down'], [407,'right'],
  [408,'up'],    [409,'left'],  [410,'down'],  [410.5,'right'],[411,'up'],
  [412,'left'],  [413,'down'],  [414,'right'], [414.5,'up'],   [415,'left'],

  [416,'down'],  [416.5,'right'],[417,'up'],  [417.5,'left'], [418,'down'],
  [418.5,'right'],[419,'up'],   [419.5,'left'],[420,'down'],  [420.5,'right'],
  [421,'up'],    [421.5,'left'], [422,'down'],  [422.5,'right'],[423,'up'],
  [423.5,'left'],

  [424,'down'],  [425,'right'], [426,'up'],   [426.5,'left'], [427,'down'],
  [428,'right'], [429,'up'],    [430,'left'],  [430.5,'down'], [431,'right'],
  [432,'up'],    [433,'left'],  [434,'down'],  [434.5,'right'],[435,'up'],
  [436,'left'],  [437,'down'],  [438,'right'], [438.5,'up'],   [439,'left'],

  [440,'down'],  [441,'right'], [442,'up'],   [443,'left'],
  [444,'down'],  [445,'right'], [446,'up'],   [447,'left'],
  [448,'down'],  [449,'right'], [450,'up'],   [451,'left'],

  // ── OUTRO (beats 452-485) — decrescendo ──────────────────────────────────
  [452,'down'],  [454,'up'],   [456,'right'],  [458,'left'],
  [460,'down'],  [462,'up'],   [464,'right'],  [466,'left'],
  [468,'down'],  [470,'up'],   [472,'right'],
  [476,'left'],  [480,'down'], [484,'up'],
];

const ARRIVAL_LINES: DialogueLine[] = [
  { speaker: 'umberto', text: 'Porco giuda, come ci sono arrivato qua?' },
  { speaker: 'bubi', text: 'Anche io non capisco, è tutto cosi strano' },
  { speaker: 'umberto', text: 'Ah ma siamo a casa di Ilaria, andiamo a salutarla' },
  { speaker: 'bubi', text: 'Col cazzo porco dio, ma ci te ne futti' },
  { speaker: 'bubi', text: 'Sei proprio ricchione' },
  { speaker: 'umberto', text: '*hihihihi*' },
];

const ILARIA_LINES: DialogueLine[] = [
  { speaker: 'ilaria', text: 'Umberto! finalmente sei arrivato!' },
  { speaker: 'ilaria', text: 'In tempo in tempo per il torneo di beer pong' },
  { speaker: 'ilaria', text: 'Daje, ci sono Guglielmo e Daniele che ti stanno aspettando' },
  { speaker: 'bubi', text: '*soffoca una risata*' },
  { speaker: 'bubi', text: 'Voiu propriu visciu ci cummini cujune' },
  { speaker: 'umberto', text: '...Mo te fazzu vidire. Trande, con me' },
];

const CHALLENGE_LINES: DialogueLine[] = [
  { speaker: 'guglielmo', text: 'Ma varda ci è rivatu' },
  { speaker: 'aniceto', text: 'Vabe easy' },
  { speaker: 'aniceto', text: 'Umberto con quelle mani sudate la palla vola via' },
  { speaker: 'trande', text: 'Ma io ragazzi non posso bere, sto sotto antibiotici per la vertebra' },
  { speaker: 'umberto', text: 'Vabe bevo tutto io tranquillo...' },
  { speaker: 'umberto', text: 'Guglielmo, Aniceto: preparatevi a perdere' },
  { speaker: 'bubi', text: 'Ma se nu bali nu cazzu...' },
];

const UMBERTO_DANCE_LINES: DialogueLine[] = [
  { speaker: 'umberto', text: 'Bubi... ho voglia di ballare' },
  { speaker: 'bubi', text: 'Ballare? TU? Porco dio va ccidite' },
  { speaker: 'umberto', text: 'No aspetta, guarda — sono capace, giuro' },
  { speaker: 'bubi', text: 'Ok. Vai. Ti guardo. Vediamo che cazzo combini' },
];

// Umberto & Cece sulla schermata Just Dance, un attimo prima che parta la musica
const DANCE_PREGAME_LINES: DialogueLine[] = [
  { speaker: 'cece', text: 'Umberto. Sei sicuro? Questa roba finisce nel video del 18esimo' },
  { speaker: 'umberto', text: 'Cece, metti la canzone. Stasera spacco la pista' },
  { speaker: 'cece', text: 'Va bene... ma poi non dire che non ti avevo avvisato' },
  { speaker: 'umberto', text: 'Zitto e parti col pezzo. Guardami' },
];


const RETURN_FROM_PONG_LINES: DialogueLine[] = [
  { speaker: 'umberto', text: '...ok. Abbiamo perso. Ma sto benissimo. *hic*' },
  { speaker: 'bubi', text: 'Umberto. Hai bevuto un litro di birra in venti minuti' },
  { speaker: 'umberto', text: 'Esatto. E sono ancora in piedi. Sono un atleta' },
  { speaker: 'bubi', text: 'Stefano che cazzo fa alla consolle?' },
  { speaker: 'umberto', text: '...sta minte la musica' },
  { speaker: 'bubi', text: 'E chira musica la chiami??' },
  { speaker: 'stefano', text: 'Oh babbi... come cazzo funziona sta merda??' },
  { speaker: 'bubi', text: 'Vidimu se la faci cu te movi... a pista sta ddai' },
  { speaker: 'umberto', text: 'Io? Ballare? Bubi, io BALLO BENISSIMO' },
  { speaker: 'bubi', text: 'Sciamu pampasciune' },
];

// Umberto crolla dopo 1:30 di danza
const DANCE_TIRED_LINES: DialogueLine[] = [
  { speaker: 'umberto', text: 'Raga... mi fermo. Non ce la faccio' },
  { speaker: 'bubi',    text: 'Menomale mi veniva da sboccare solo a guardarti...' },
];

const CECE_ARRIVES_LINES: DialogueLine[] = [
  { speaker: 'cece', text: 'RAGAZZI! Finalmente ci siamo!!' },
  { speaker: 'cece', text: 'Tutto pronto...' },
  { speaker: 'umberto', text: 'In che senso??' },
  { speaker: 'cece', text: 'Non fate domande. Venite con me' },
  { speaker: 'bubi', text: 'Vadimu ci face moi' },
  { speaker: 'bubi', text: 'Sciamu...' },
];

const PONG_TABLE = { x: 334, y: 232 }; // centro del tavolo beer pong (x=300+68/2)

const GUEST_POSITIONS: [number, number][] = [
  [120, 100],
  [200, 80],
  [260, 130],
  [160, 180],
  [205, 115],
  [300, 90],
  [380, 200],
  [70, 150],
];
const GUEST_SHIRTS = [0xcc5577, 0x55cc99, 0x9955cc, 0xcccc55, 0x5599cc, 0xcc8855];

export class PartyScene extends Phaser.Scene {
  private dialogue!: DialogueSystem;
  private player!: PlayerController;
  private ilaria!: Phaser.GameObjects.Sprite;
  private ilariaHalo!: Phaser.GameObjects.Graphics;
  private speakerEq!: Phaser.GameObjects.Graphics;
  private danceFloorFx!: Phaser.GameObjects.Graphics;
  private discoFx!: Phaser.GameObjects.Graphics;
  private discBallFx!: Phaser.GameObjects.Graphics;
  private discRaysFx!: Phaser.GameObjects.Graphics;
  private obstacles: Phaser.GameObjects.Rectangle[] = [];
  private questHUD!: QuestHUD;
  private metIlaria = false;
  private arrivalDone = false;
  private pongReady = false;
  private pongStarted = false;
  private danceStarted = false;
  private danceUnlocked = false; // si sblocca solo dopo il beer pong
  private danceMgActive = false;
  private danceArrows: Array<{
    gfx: Phaser.GameObjects.Graphics;
    dir: DanceDir;
    hitTime: number;
    scored: boolean;
  }> = [];
  private brokenMusicMode = false;
  private postPongDanceResolve: (() => void) | null = null;
  private drunkT = 0;
  private drunkCamTimer: Phaser.Time.TimerEvent | null = null;
  private drunkMusicTimer: Phaser.Time.TimerEvent | null = null;
  private vomitTimer: Phaser.Time.TimerEvent | null = null;
  private stefanoSprite!: Phaser.GameObjects.Sprite;
  private danceStartTime = 0;
  private danceProgressCb: ((elapsed: number) => void) | null = null;

  constructor() {
    super('PartyScene');
  }

  preload(): void {
    loadPortraits(this, [
      'umberto', 'bubi', 'ilaria', 'trande', 'guglielmo', 'aniceto', 'cece',
      'riccardo', 'stefano', 'lerry', 'cosimino', 'beatrice', 'pietro',
    ]);
    // Metti la tua canzone in  public/assets/audio/dance.mp3
    // (o .ogg) poi setta DANCE_BPM sopra col BPM corretto
    this.load.audio('dance-music', [
      'assets/audio/dance.mp3',
      'assets/audio/dance.ogg',
    ]);
  }

  create(): void {
    this.obstacles = [];
    this.obstaclesSprites = [];
    this.metIlaria = false;
    this.arrivalDone = false;
    this.pongReady = false;
    this.pongStarted = false;
    this.danceStarted = false;
    this.danceUnlocked = false;
    this.danceMgActive = false;
    this.danceArrows = [];
    this.brokenMusicMode = false;
    AudioManager.get().setFgMusicRate(1);   // sicurezza: nessun pitch ubriaco residuo
    this.postPongDanceResolve = null;
    this.drunkT = 0;
    this.drunkCamTimer = null;
    this.drunkMusicTimer = null;
    this.vomitTimer = null;

    // Musica festa — se party.mp3 non è presente, il BGM continua senza interruzioni
    if (this.cache.audio.exists('party')) {
      AudioManager.get().playFgMusic(this, 'party', 0.75);
    }

    this.drawMap();

    for (const id of [
      'umberto', 'bubi', 'ilaria', 'trande', 'guglielmo', 'aniceto', 'cece',
      'riccardo', 'stefano', 'lerry', 'cosimino', 'beatrice', 'pietro',
    ]) {
      generateSpriteTexture(this, id, CHAR_CONFIGS[id]);
    }
    GUEST_SHIRTS.forEach((color, i) => {
      generateSpriteTexture(this, `ospite${i}`, { shirtColor: color });
    });

    // Ospiti che "ballano" (oscillazione sinusoidale lenta)
    GUEST_POSITIONS.forEach(([x, y], i) => {
      const id = `ospite${i % GUEST_SHIRTS.length}`;
      addShadow(this, x, y); // resta a terra anche quando l'ospite "balla"
      const s = this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE);
      s.play(`${id}-idle-down`);
      s.setDepth(y);
      makeFeetBody(this, s);
      this.tweens.add({
        targets: s,
        y: y - 3,
        duration: Phaser.Math.Between(380, 650),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 120,
      });
      this.obstaclesSprites.push(s);
    });

    // ILARIA con alone pulsante viola
    this.ilariaHalo = this.add.graphics().setDepth(ILARIA_POS.y - 1);
    this.ilariaHalo.fillStyle(0xaa55ff, 1);
    this.ilariaHalo.fillCircle(ILARIA_POS.x, ILARIA_POS.y + 10, 17);
    this.ilariaHalo.setAlpha(0.2);
    this.tweens.add({
      targets: this.ilariaHalo,
      alpha: 0.5,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    addShadow(this, ILARIA_POS.x, ILARIA_POS.y);
    addNameLabel(this, ILARIA_POS.x, ILARIA_POS.y, 'ilaria');
    this.ilaria = this.add
      .sprite(ILARIA_POS.x, ILARIA_POS.y, 'char-ilaria', 1)
      .setScale(CHAR_SCALE);
    this.ilaria.play('ilaria-idle-down');
    this.ilaria.setDepth(ILARIA_POS.y);
    makeFeetBody(this, this.ilaria);

    // BUBI accanto al player
    addShadow(this, 110, 210);
    addNameLabel(this, 110, 210, 'bubi');
    const bubi = this.add.sprite(110, 210, 'char-bubi', 1).setScale(CHAR_SCALE);
    bubi.play('bubi-idle-right');
    bubi.setDepth(210);

    // Il team del beer pong attorno al tavolo (centro-destra della mappa)
    this.spawnPongNpc('guglielmo', 308, 256, 'up');
    this.spawnPongNpc('aniceto', 352, 256, 'up');
    this.spawnPongNpc('trande', 394, 232, 'left');

    // Personaggi nominati che sono alla festa (ballano/bivaccano)
    this.spawnPartyGuest('riccardo',  505,  90, 'left');
    this.stefanoSprite = this.spawnPartyGuest('stefano', 564, 118, 'left');
    this.spawnPartyGuest('lerry',     185,  68, 'down');
    this.spawnPartyGuest('cosimino',  390, 155, 'left');
    this.spawnPartyGuest('beatrice',  148, 235, 'right');
    this.spawnPartyGuest('pietro',    300, 150, 'down');   // in mezzo alla festa
    this.spawnDog('camilla', 165, 242);

    this.dialogue = new DialogueSystem(this);
    this.player = new PlayerController(this, 'umberto', 80, 200, this.dialogue);
    this.player.locked = true;

    this.physics.world.setBounds(14, 36, WORLD_W - 28, WORLD_H - 48);
    this.physics.add.collider(this.player.sprite, this.obstacles);
    this.physics.add.collider(this.player.sprite, this.obstaclesSprites);
    this.physics.add.collider(this.player.sprite, this.ilaria);

    // Camera scrollante (mappa più larga di 1 viewport)
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);

    TransitionSystem.fadeFromBlack(this, 800);
    // BGM globale già in corso
    this.questHUD = new QuestHUD(this, GAME_WIDTH / 2 + UI_OFF_X, 50 + UI_OFF_Y).addMarker();

    const initData = this.scene.settings.data as { pongDone?: boolean } | undefined;
    const pongDone = !!initData?.pongDone;

    if (pongDone) {
      // Rientra dalla festa dopo il beer pong — salta arrival, vai dritto alla danza
      this.metIlaria = true;
      this.pongReady = true;
      this.pongStarted = true;
      this.arrivalDone = true;
      this.danceStarted = true;   // gestito manualmente da postPongFlow
      this.danceUnlocked = true;
      // Umberto parte dalla destra del tavolo beer pong — deve raggiungere
      // la pista con i tasti invertiti, navigando tra gli ostacoli
      this.player.sprite.setPosition(376, 232);
      this.player.locked = true;
      TransitionSystem.announceArea(this, 'CASA DI ILARIA – LUGLIO 2019');
      this.time.delayedCall(700, () => void this.postPongFlow());
    } else {
      TransitionSystem.announceArea(this, 'CASA DI ILARIA – LUGLIO 2019');
      // Arrivo stordito dal salto, poi dialogo automatico
      this.time.delayedCall(900, () => void this.arrivalDaze());
    }
  }

  private async arrivalDaze(): Promise<void> {
    await TransitionSystem.dazedEffect(this, this.player.sprite);
    this.dialogue.start({
      lines: ARRIVAL_LINES,
      onComplete: () => {
        this.player.locked = false;
        this.arrivalDone = true;
        this.questHUD.show('Trova Ilaria!');
        this.questHUD.moveMarker(ILARIA_POS.x, ILARIA_POS.y);
      },
    });
  }

  private async postPongFlow(): Promise<void> {
    // Stefano ubriaco alla consolle con musica rotta
    this.activateBrokenMusic();

    await new Promise<void>(resolve =>
      this.dialogue.start({ lines: RETURN_FROM_PONG_LINES, onComplete: resolve })
    );

    // Sblocca il player con controlli invertiti (Umberto è ubriaco)
    // e aspetta che raggiunga la pista da ballo
    this.danceUnlocked = true;
    this.danceStarted = false; // riabilita il proximity trigger
    this.player.invertControls = true;
    this.player.locked = false;
    this.startDrunkEffects();
    this.scheduleVomit();
    this.questHUD.show('Vai sulla pista da ballo!');
    this.questHUD.moveMarker(DF_CX, DF_CY);

    // Aspetta che il player raggiunga la pista (risolto da triggerDanceSequence)
    await new Promise<void>(resolve => { this.postPongDanceResolve = resolve; });

    // Danza (player già locked da triggerDanceSequence)
    await this.playDanceMinigame(false);

    // Cece arriva — la canzone danza continua in sottofondo durante il dialogo
    await new Promise<void>(resolve =>
      this.dialogue.start({ lines: CECE_ARRIVES_LINES, onComplete: resolve })
    );
    // Fade out sincronizzato con la transizione scena
    AudioManager.get().stopFgMusic(this, 1200);
    TransitionSystem.fadeToScene(this, 'CeceScene', undefined, 1200);
  }

  private obstaclesSprites: Phaser.GameObjects.Sprite[] = [];

  update(): void {
    this.player.update([]);
    this.player.sprite.setDepth(this.player.sprite.y);
    this.animateSpeakers();
    this.animateDanceFloor();
    this.animateDisco();

    // Il player raggiunge Ilaria
    if (this.arrivalDone && !this.metIlaria && !this.dialogue.isActive) {
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        this.ilaria.x,
        this.ilaria.y
      );
      if (d < 28) this.meetIlaria();
    }

    // Il player raggiunge la pista da ballo (solo dopo il beer pong)
    if (this.danceUnlocked && this.arrivalDone && !this.danceStarted && !this.dialogue.isActive) {
      const dd = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, DF_CX, DF_CY
      );
      if (dd < 36) this.triggerDanceSequence();
    }

    // Aggiorna frecce del minigame danza
    if (this.danceMgActive) this.updateDanceArrows();

    // Il player raggiunge il tavolo del beer pong
    if (this.pongReady && !this.pongStarted && !this.dialogue.isActive) {
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        PONG_TABLE.x,
        PONG_TABLE.y
      );
      if (d < 44) this.startPongChallenge();
    }
  }

  private meetIlaria(): void {
    this.metIlaria = true;
    this.questHUD.clear();
    this.questHUD.hideMarker();
    this.dialogue.start({
      lines: ILARIA_LINES,
      onComplete: () => {
        // si sblocca la sfida al tavolo
        this.pongReady = true;
        this.questHUD.show('Vai al tavolo del beer pong!');
        this.questHUD.moveMarker(PONG_TABLE.x, PONG_TABLE.y);
      },
    });
  }

  private startPongChallenge(): void {
    this.pongStarted = true;
    this.questHUD.clear();
    this.questHUD.hideMarker();
    this.player.locked = true;
    this.dialogue.start({
      lines: CHALLENGE_LINES,
      onComplete: () => void TransitionSystem.warpToScene(this, 'BeerPongScene'),
    });
  }

  private spawnPongNpc(id: string, x: number, y: number, facing: string): void {
    addShadow(this, x, y);
    addNameLabel(this, x, y, id);
    const s = this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE);
    s.play(`${id}-idle-${facing}`);
    s.setDepth(y);
    makeFeetBody(this, s);
    this.obstaclesSprites.push(s);
  }

  /** Cane pixel-art con coda che scodinzola. cx/cy = centro del corpo in world space. */
  private spawnDog(name: string, cx: number, cy: number): void {
    const BROWN      = 0x8b4513;
    const DARK_BROWN = 0x5c2e0a;

    // Corpo, testa, orecchie, zampe — tutto in un unico Graphics fisso
    const body = this.add.graphics();
    body.setDepth(cy + 1);

    // Zampe (sotto il corpo → disegnate per prime)
    body.fillStyle(BROWN);
    body.fillRect(cx - 4, cy + 3, 2, 4);
    body.fillRect(cx - 1, cy + 3, 2, 4);
    body.fillRect(cx + 3, cy + 3, 2, 4);
    body.fillRect(cx + 6, cy + 3, 2, 4);

    // Corpo
    body.fillRect(cx - 6, cy - 3, 12, 6);

    // Testa (frontale → destra)
    body.fillRect(cx + 6, cy - 5, 6, 6);

    // Orecchio
    body.fillStyle(DARK_BROWN);
    body.fillRect(cx + 10, cy - 8, 3, 4);

    // Occhio e naso
    body.fillStyle(0x110000);
    body.fillRect(cx + 11, cy - 3, 1, 1); // occhio
    body.fillRect(cx + 13, cy,     1, 1); // naso

    // Coda: Graphics separato posizionato alla base della coda (sinistro)
    // così possiamo ruotarlo attorno a quel pivot
    const tail = this.add.graphics();
    tail.setPosition(cx - 6, cy - 1);
    tail.setDepth(cy);
    tail.fillStyle(BROWN);
    tail.fillRect(-1, -5, 2, 5); // segmento verticale: si estende verso l'alto

    // Scodinzolio
    this.tweens.add({
      targets: tail,
      angle: { from: -35, to: 20 },
      duration: 290,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Etichetta nome (piccola, sopra il cane)
    this.add.text(cx + 3, cy - 14, name, {
      fontFamily: FONT,
      fontSize: '4px',
      color: '#cc8844',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(cy + 2);
  }

  /** Come spawnPongNpc ma con animazione bob (dondolio da festa) */
  private spawnPartyGuest(id: string, x: number, y: number, facing: string): Phaser.GameObjects.Sprite {
    addShadow(this, x, y);
    addNameLabel(this, x, y, id);
    const s = this.add.sprite(x, y, `char-${id}`, 1).setScale(CHAR_SCALE);
    s.play(`${id}-idle-${facing}`);
    s.setDepth(y);
    makeFeetBody(this, s);
    this.tweens.add({
      targets: s,
      y: y - 3,
      duration: Phaser.Math.Between(400, 680),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Phaser.Math.Between(0, 350),
    });
    this.obstaclesSprites.push(s);
    return s;
  }

  // ------------------------------------------------------------ mappa

  private drawMap(): void {
    const g = this.make.graphics();

    // ── Consolle DJ (orientamento verticale/ritratto, rotata 90°) ────────────
    const CON_X = 530, CON_Y = 106, CON_W = 22, CON_H = 36;
    // Centri dei due piatti vinile (stacked verticalmente)
    const DISC_L: [number, number] = [CON_X + 11, CON_Y + 9];   // piatto superiore
    const DISC_R: [number, number] = [CON_X + 11, CON_Y + 27];  // piatto inferiore

    // Pavimento scuro
    for (let ty = 0; ty < WORLD_H / 16; ty++) {
      for (let tx = 0; tx < WORLD_W / 16; tx++) {
        const v = (tx * 5 + ty * 11) % 3;
        g.fillStyle([0x2a2330, 0x2e2736, 0x261f2c][v]);
        g.fillRect(tx * 16, ty * 16, 16, 16);
      }
    }

    // Muri
    g.fillStyle(0x3c3344);
    g.fillRect(0, 0, WORLD_W, 36);
    g.fillRect(0, 0, 14, WORLD_H);
    g.fillRect(WORLD_W - 14, 0, 14, WORLD_H);
    g.fillRect(0, WORLD_H - 12, WORLD_W, 12);

    // Luci colorate pulsanti (spot con blend additivo)
    const spots: [number, number, number, number][] = [
      [120, 80,  0xff3344, 900],
      [460, 80,  0x3366ff, 1200],
      [160, 200, 0xaa44ff, 1050],
      [430, 200, 0xffdd33, 800],
    ];
    for (const [x, y, color, dur] of spots) {
      const light = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
      light.fillStyle(color, 1);
      light.fillCircle(x, y, 70);
      light.setAlpha(0.1);
      this.tweens.add({
        targets: light,
        alpha: 0.28,
        duration: dur,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Divano
    g.fillStyle(0x7a4a5a);
    g.fillRect(30, 56, 70, 26);
    g.fillStyle(0x8d5a6c);
    g.fillRect(30, 50, 70, 10); // schienale
    g.fillRect(26, 52, 8, 30);
    g.fillRect(96, 52, 8, 30);
    this.addObstacle(26, 50, 78, 32);

    // Tavolino con drink, bottiglia e posacenere
    g.fillStyle(0x4a3620, 1); g.fillRect(140, 150, 36, 20);            // piano
    g.fillStyle(0x6e5232, 1); g.fillRect(140, 150, 36, 3);            // bordo alto
    g.fillStyle(0x2a1e12, 1); g.fillRect(140, 168, 36, 2);           // ombra frontale
    g.fillStyle(0x2a7a3a, 0.9); g.fillRect(144, 143, 4, 9); g.fillRect(145, 140, 2, 4); // bottiglia
    for (const [dx, dc] of [[154, 0xff5555], [162, 0x55ddff], [170, 0xaaff55]] as [number, number][]) {
      g.fillStyle(0xdddddd, 0.9); g.fillRect(dx, 152, 4, 7);         // bicchiere
      g.fillStyle(dc, 0.85);      g.fillRect(dx, 155, 4, 4);         // drink
    }
    g.fillStyle(0x888888, 1); g.fillEllipse(150, 163, 8, 4);         // posacenere
    g.fillStyle(0x3a3a3a, 1); g.fillEllipse(150, 163, 5, 2);
    g.fillStyle(0xeeeecc, 1); g.fillRect(149, 162, 3, 1);            // mozzicone
    this.addObstacle(140, 150, 36, 20);

    // Buffet a nord — tovaglia rossa, piatti, torta con candelina, punch
    g.fillStyle(0x9a3a4a, 1); g.fillRect(178, 36, 124, 22);          // tovaglia
    g.fillStyle(0xb84a5a, 1); g.fillRect(178, 36, 124, 3);          // piega
    g.fillStyle(0x7a2a3a, 1); g.fillRect(178, 55, 124, 3);          // ombra
    for (let fx = 180; fx < 300; fx += 8) { g.fillStyle(0x7a2a3a, 1); g.fillRect(fx, 58, 4, 2); } // frange
    for (let i = 0; i < 5; i++) {                                    // piatti con cibo
      const px = 190 + i * 22;
      g.fillStyle(0xdddddd, 1); g.fillEllipse(px, 47, 9, 5);
      g.fillStyle([0xffcc66, 0xff8866, 0xddff88, 0xcc7744, 0xffddaa][i], 1);
      g.fillEllipse(px, 46, 6, 3);
    }
    g.fillStyle(0xf0e0c0, 1); g.fillRect(232, 41, 16, 10);          // torta
    g.fillStyle(0xd8a0b0, 1); g.fillRect(232, 41, 16, 3);          // glassa
    g.fillStyle(0xff4466, 1); g.fillRect(239, 37, 2, 4);          // candelina
    g.fillStyle(0xffdd66, 1); g.fillRect(239, 36, 2, 1);          // fiamma
    g.fillStyle(0x8899aa, 1); g.fillEllipse(285, 47, 14, 7);       // ciotola punch
    g.fillStyle(0xcc4488, 0.9); g.fillEllipse(285, 46, 11, 4);
    this.addObstacle(178, 36, 124, 22);

    // Pianta in vaso (angolo, accanto al divano)
    g.fillStyle(0x2f7a34, 1); g.fillCircle(116, 74, 8);
    g.fillStyle(0x3fa049, 1); g.fillCircle(113, 71, 5);
    g.fillStyle(0x58c063, 1); g.fillCircle(119, 72, 4);
    g.fillStyle(0x8a5a2a, 1); g.fillRect(111, 80, 10, 8);
    g.fillStyle(0x6a4420, 1); g.fillRect(111, 80, 10, 2);

    // Poster musicali sui muri (parete alta)
    g.fillStyle(0x14142a, 1); g.fillRect(60, 12, 22, 18);
    g.fillStyle(0xff4488, 1); g.fillRect(63, 15, 16, 6);
    g.fillStyle(0xffdd44, 1); g.fillRect(63, 22, 16, 5);
    g.fillStyle(0x14142a, 1); g.fillRect(500, 12, 22, 18);
    g.fillStyle(0x44aaff, 1); g.fillCircle(511, 21, 6);
    g.fillStyle(0xffffff, 0.8); g.fillCircle(509, 19, 2);

    // Casse con EQ animato (spostate sul lato destro espanso)
    for (const sy of [60, 180]) {
      g.fillStyle(0x111111);
      g.fillRect(532, sy, 26, 42);
      g.lineStyle(1, 0x333333);
      g.strokeRect(532, sy, 26, 42);
      this.addObstacle(532, sy, 26, 42);
    }
    // ── Consolle DJ (orientamento verticale — piatti stacked, mixer orizzontale) ─
    // Piano in legno scuro
    g.fillStyle(0x2c1a0c);
    g.fillRect(CON_X, CON_Y, CON_W, CON_H);
    g.lineStyle(1, 0x5a3a1a);
    g.strokeRect(CON_X, CON_Y, CON_W, CON_H);
    // Ombra frontale (spessore prospettico)
    g.fillStyle(0x150a02);
    g.fillRect(CON_X, CON_Y + CON_H - 3, CON_W, 3);
    // Incavi piatti (stacked verticalmente)
    g.fillStyle(0x0d0d0d);
    g.fillCircle(DISC_L[0], DISC_L[1], 7);
    g.fillCircle(DISC_R[0], DISC_R[1], 7);
    // Mixer panel centrale (striscia orizzontale tra i due piatti)
    g.fillStyle(0x0a0a14);
    g.fillRect(CON_X + 2, CON_Y + 17, CON_W - 4, 6);
    // LED colorati sul mixer (orizzontali)
    g.fillStyle(0x00ff44); g.fillRect(CON_X + 4,  CON_Y + 19, 2, 2); // verde
    g.fillStyle(0xff4400); g.fillRect(CON_X + 10, CON_Y + 19, 2, 2); // rosso
    g.fillStyle(0x0066ff); g.fillRect(CON_X + 16, CON_Y + 19, 2, 2); // blu
    // Crossfader verticale
    g.fillStyle(0x2a2a2a);
    g.fillRect(CON_X + 10, CON_Y + 17, 1, 6); // traccia
    g.fillStyle(0xcccccc);
    g.fillRect(CON_X + 9, CON_Y + 19, 3, 2);  // pomolo
    this.addObstacle(CON_X, CON_Y, CON_W, CON_H);

    this.speakerEq = this.add.graphics().setDepth(6);
    // Pista da ballo animata (tile che ciclano colore) + riflessi del globo
    this.danceFloorFx = this.add.graphics().setDepth(4);
    this.discoFx = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(6);

    // Palloncini che oscillano
    const balloons: [number, number, number][] = [
      [60,  30, 0xff5566],
      [150, 26, 0x55aaff],
      [250, 30, 0xffdd55],
      [330, 24, 0xaa66ff],
      [420, 28, 0x66dd88],
      [530, 26, 0xff88dd],
    ];
    for (const [x, y, color] of balloons) {
      const b = this.add.graphics().setDepth(8);
      b.lineStyle(1, 0xcccccc, 0.7);
      b.lineBetween(0, 10, 0, 26);
      b.fillStyle(color);
      b.fillEllipse(0, 0, 14, 18);
      b.setPosition(x, y);
      this.tweens.add({
        targets: b,
        x: x + 5,
        angle: 6,
        duration: Phaser.Math.Between(1400, 2200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Tavolo beer pong (centro-destra): piano verde con bicchieri rossi
    g.fillStyle(0x6e4a2a);
    g.fillRect(300, 217, 68, 30);
    g.fillStyle(0x2e7a4a); // panno verde
    g.fillRect(302, 219, 64, 26);
    g.lineStyle(1, 0x1d5232);
    g.strokeRect(302, 219, 64, 26);
    for (const side of [308, 352]) {
      for (let i = 0; i < 3; i++) {
        g.fillStyle(0xcc3333);
        g.fillCircle(side + (i % 2) * 8, 225 + i * 7, 3);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(side + (i % 2) * 8, 225 + i * 7, 1);
      }
    }
    this.addObstacle(300, 217, 68, 30);

    // ── Ostacoli percorso ubriaco (pong → pista da ballo) ───────────────────
    // Tavolo con bottiglie vuote — centro (tra pong e pista)
    g.fillStyle(0x5a3a1a);
    g.fillRect(232, 172, 36, 18);
    g.fillStyle(0x7a5a2a);
    g.fillRect(233, 173, 34, 16);
    for (const [bx, bc] of [[237, 0xff5533], [245, 0x55ccff], [253, 0xddff44]] as [number, number][]) {
      g.fillStyle(bc, 0.85); g.fillRect(bx, 167, 5, 8);
      g.fillStyle(0x888888, 0.6); g.fillRect(bx + 1, 165, 3, 3);
    }
    this.addObstacle(232, 165, 36, 25);

    // Secchio del ghiaccio — centro-sinistra
    g.fillStyle(0x556677);
    g.fillEllipse(183, 198, 18, 10);
    g.fillStyle(0x7799bb, 0.8);
    g.fillEllipse(183, 196, 16, 8);
    g.fillStyle(0xffffff, 0.7); g.fillRect(181, 188, 3, 10);
    g.fillStyle(0xddddff, 0.5); g.fillRect(185, 190, 3, 8);
    this.addObstacle(174, 188, 18, 18);

    // Sedie abbandonate accatastate — vicino alla pista
    g.fillStyle(0x7a4a4a);
    g.fillRect(148, 162, 10, 14);
    g.fillRect(162, 158, 10, 14);
    g.fillStyle(0x8a5a5a);
    g.fillRect(148, 154, 10, 8);
    g.fillRect(162, 150, 10, 8);
    g.fillStyle(0x6a3a3a);
    g.fillRect(156, 160, 4, 3);
    this.addObstacle(146, 150, 28, 28);

    // Pista da ballo — tiles colorate (baked nel texture)
    const DTILE = 9;
    // palette saturata: il pattern deve essere leggibile anche senza le luci disco
    const dfPalette = [0x5516aa, 0x2a0e66, 0x6a20bb, 0x1a1080];
    for (let ty = 0; ty < Math.ceil(DF.h / DTILE); ty++) {
      for (let tx = 0; tx < Math.ceil(DF.w / DTILE); tx++) {
        const ci = ((tx + ty) % 2 === 0) ? ((tx * 3 + ty * 5) % 3) : 3;
        g.fillStyle(dfPalette[ci]);
        g.fillRect(DF.x + tx * DTILE, DF.y + ty * DTILE,
          Math.min(DTILE, DF.w - tx * DTILE), Math.min(DTILE, DF.h - ty * DTILE));
      }
    }
    // Linee griglia pista
    g.lineStyle(1, 0x660088, 0.6);
    for (let tx = 0; tx <= Math.ceil(DF.w / DTILE); tx++)
      g.lineBetween(DF.x + tx * DTILE, DF.y, DF.x + tx * DTILE, DF.y + DF.h);
    for (let ty = 0; ty <= Math.ceil(DF.h / DTILE); ty++)
      g.lineBetween(DF.x, DF.y + ty * DTILE, DF.x + DF.w, DF.y + ty * DTILE);
    // Bordo pista — doppio neon con angoli luminosi
    g.lineStyle(3, 0x8a1acc, 0.55);
    g.strokeRect(DF.x - 1, DF.y - 1, DF.w + 2, DF.h + 2);
    g.lineStyle(2, 0xff66ff, 1);
    g.strokeRect(DF.x, DF.y, DF.w, DF.h);
    g.fillStyle(0xffffff, 0.9);
    for (const [cx, cy] of [
      [DF.x, DF.y], [DF.x + DF.w, DF.y], [DF.x, DF.y + DF.h], [DF.x + DF.w, DF.y + DF.h],
    ] as [number, number][]) g.fillRect(cx - 1, cy - 1, 2, 2);

    // Palla disco (parte statica nel texture — corpo + filo)
    const DB_X = 240, DB_Y = 20;
    g.lineStyle(1, 0x888899, 0.85);
    g.lineBetween(DB_X, 0, DB_X, DB_Y - 9); // filo
    g.fillStyle(0x6677aa);
    g.fillCircle(DB_X, DB_Y, 9);
    const mirrorCols = [0xbbccdd, 0x8899bb, 0xddeeff, 0x7788aa, 0xccddf0];
    for (let mi = 0; mi < 18; mi++) {
      const ang = (mi / 18) * Math.PI * 2;
      g.fillStyle(mirrorCols[mi % 5]);
      g.fillRect(
        Math.round(DB_X + Math.cos(ang) * 6) - 2,
        Math.round(DB_Y + Math.sin(ang) * 6) - 1,
        3, 2,
      );
    }
    g.fillStyle(0xeeeeff, 0.9);
    g.fillRect(DB_X - 3, DB_Y - 6, 3, 2); // highlight

    // ── FESTA DEVASTATA: bicchieri, bottiglie, pozze, coriandoli a terra ────
    // Pozze di versato (sotto tutto il resto della sporcizia)
    const puddle = (x: number, y: number, col: number): void => {
      g.fillStyle(col, 0.38); g.fillEllipse(x, y, 16, 7);
      g.fillStyle(col, 0.24); g.fillEllipse(x + 8, y + 2, 9, 4);
      g.fillStyle(0xffffff, 0.10); g.fillEllipse(x - 3, y - 1, 5, 2);
    };
    for (const [x, y, c] of [
      [118, 246, 0x88151a], [300, 234, 0x5a4a1a], [446, 202, 0x224466], [212, 250, 0x88151a],
    ] as [number, number, number][]) puddle(x, y, c);

    // Bottiglie vuote sdraiate
    const bottle = (x: number, y: number, col: number): void => {
      g.fillStyle(col, 0.85); g.fillRect(x - 6, y - 2, 10, 4);
      g.fillStyle(col, 0.85); g.fillRect(x + 4, y - 1, 4, 2);
      g.fillStyle(0x1a1a1a, 1);  g.fillRect(x + 8, y - 1, 1, 2);
      g.fillStyle(0xffffff, 0.25); g.fillRect(x - 6, y - 2, 10, 1);
    };
    for (const [x, y, c] of [
      [92, 214, 0x2a7a3a], [402, 214, 0x6a4a1a], [162, 240, 0x5a2a6a],
    ] as [number, number, number][]) bottle(x, y, c);

    // Bicchieri rossi (solo cup) — in piedi o rovesciati con versamento
    const cup = (x: number, y: number, knocked: boolean): void => {
      if (knocked) {
        g.fillStyle(0x88151a, 0.45); g.fillEllipse(x + 4, y + 1, 12, 4);   // liquido
        g.fillStyle(0xcc3333, 1);    g.fillEllipse(x, y, 9, 5);            // coppa di lato
        g.fillStyle(0x9a2222, 1);    g.fillEllipse(x - 3, y, 3, 3);        // bocca (buio)
        g.fillStyle(0xe05555, 1);    g.fillRect(x + 3, y - 2, 3, 4);       // fondo
      } else {
        g.fillStyle(0x9a2222, 1); g.fillRect(x - 3, y - 5, 6, 9);          // corpo
        g.fillStyle(0xcc3333, 1); g.fillRect(x - 3, y - 5, 5, 9);          // luce
        g.fillStyle(0xe05555, 1); g.fillRect(x - 3, y - 5, 6, 1);          // bordo
        g.fillStyle(0xffcc44, 0.6); g.fillRect(x - 2, y - 4, 4, 1);        // drink
      }
    };
    for (const [x, y, k] of [
      [70, 242, 1], [132, 236, 0], [210, 246, 1], [282, 240, 0], [360, 238, 1],
      [432, 246, 0], [500, 240, 1], [540, 208, 0], [190, 208, 1], [332, 190, 0],
      [472, 178, 1], [108, 182, 0], [258, 208, 1], [408, 232, 0],
    ] as [number, number, number][]) cup(x, y, k === 1);

    // Coriandoli e stelle filanti a terra
    const confCols = [0xff5566, 0xffdd55, 0x55ddff, 0x66dd88, 0xaa66ff, 0xff88dd];
    for (let i = 0; i < 70; i++) {
      const cx = Phaser.Math.Between(20, WORLD_W - 20);
      const cy = Phaser.Math.Between(42, WORLD_H - 16);
      g.fillStyle(confCols[i % confCols.length], 0.85);
      g.fillRect(cx, cy, Phaser.Math.Between(1, 2), 1);
    }
    // qualche stella filante (nastro) a terra
    for (const [sx, sy, col] of [[150, 220, 0xff88dd], [380, 200, 0x55ddff], [90, 250, 0xffdd55]] as [number, number, number][]) {
      g.lineStyle(1, col, 0.7);
      g.beginPath();
      g.moveTo(sx, sy);
      for (let k = 1; k <= 6; k++) g.lineTo(sx + k * 6, sy + Math.sin(k) * 4);
      g.strokePath();
    }

    // ── Festone di lucine lungo la parete alta ──────────────────────────────
    const bulbCols = [0xff5566, 0xffdd55, 0x55ddff, 0x66dd88, 0xaa66ff, 0xff88dd];
    g.lineStyle(1, 0x181220, 0.9);
    let px = 16, py = 9;
    for (let x = 36, i = 1; x <= WORLD_W - 16; x += 20, i++) {
      const yy = 7 + (i % 2) * 7;
      g.lineBetween(px, py, x, yy);
      px = x; py = yy;
    }
    for (let x = 16, i = 0; x <= WORLD_W - 16; x += 20, i++) {
      const yy = 7 + (i % 2) * 7;
      g.fillStyle(bulbCols[i % bulbCols.length], 1);
      g.fillCircle(x, yy + 2, 2);
      g.fillStyle(0xffffff, 0.6);
      g.fillRect(x - 1, yy + 1, 1, 1);
    }

    // Pre-render della parte statica (pavimento, muri, arredi) in texture
    if (!this.textures.exists('tex-map-party')) {
      g.generateTexture('tex-map-party', WORLD_W, WORLD_H);
    }
    g.destroy();
    this.add.image(0, 0, 'tex-map-party').setOrigin(0).setDepth(-10);

    // Bordo frontale consolle (effetto 3D prospettico del bancone)
    const conFront = this.add.graphics().setDepth(CON_Y + CON_H);
    conFront.fillStyle(0x150a02);
    conFront.fillRect(CON_X, CON_Y + CON_H - 4, CON_W, 4);
    conFront.lineStyle(1, 0x5a3a1a);
    conFront.lineBetween(CON_X, CON_Y + CON_H, CON_X + CON_W, CON_Y + CON_H);

    // Raggi disco + palla: ridisegnati ogni frame in animateDisco (sincronizzati).
    this.discRaysFx = this.add.graphics().setDepth(11).setBlendMode(Phaser.BlendModes.ADD);

    // Alone luminoso pulsante dietro la palla (additivo)
    const discGlow = this.add.graphics().setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    discGlow.fillStyle(0xaad0ff, 1); discGlow.fillCircle(DB_X, DB_Y, 20); discGlow.setAlpha(0.10);
    this.tweens.add({ targets: discGlow, alpha: 0.22, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Aggancio metallico + asta al soffitto
    const discMount = this.add.graphics().setDepth(12);
    discMount.fillStyle(0x333333, 1); discMount.fillRect(DB_X - 1, 0, 2, DB_Y - 11);   // asta
    discMount.fillStyle(0x777788, 1); discMount.fillRect(DB_X - 3, DB_Y - 12, 6, 3);    // attacco

    this.discBallFx = this.add.graphics().setDepth(13);   // palla animata

    // Luci disco animate sulla pista (additive blend, separate dal texture)
    const dfLights: [number, number, number][] = [
      [DF.x + DF.w * 0.25, DF.y + DF.h * 0.35, 0xff2266],
      [DF.x + DF.w * 0.75, DF.y + DF.h * 0.35, 0x2255ff],
      [DF.x + DF.w * 0.25, DF.y + DF.h * 0.70, 0xffdd00],
      [DF.x + DF.w * 0.75, DF.y + DF.h * 0.70, 0x44ff88],
    ];
    dfLights.forEach(([lx, ly, col], i) => {
      const lg = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
      lg.fillStyle(col, 1);
      lg.fillCircle(lx, ly, 20);
      lg.setAlpha(0.1);
      this.tweens.add({
        targets: lg,
        alpha: 0.5,
        duration: Phaser.Math.Between(320, 620),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 180,
      });
    });

    // ── Dischi vinile rotanti sulla consolle ─────────────────────────────────
    const DISC_LABEL_COL = [0xff3366, 0x3388ff];
    const discPositions: [number, number][] = [DISC_L, DISC_R];

    for (let ri = 0; ri < 2; ri++) {
      const [dx, dy] = discPositions[ri];
      const disc = this.add.graphics().setPosition(dx, dy).setDepth(111);
      // Corpo vinile nero
      disc.fillStyle(0x111111);
      disc.fillCircle(0, 0, 6);
      // Solchi concentrici
      disc.lineStyle(0.5, 0x252525, 1); disc.strokeCircle(0, 0, 5);
      disc.lineStyle(0.5, 0x1e1e1e, 1); disc.strokeCircle(0, 0, 4);
      disc.lineStyle(0.5, 0x252525, 1); disc.strokeCircle(0, 0, 3);
      // Etichetta colorata al centro
      disc.fillStyle(DISC_LABEL_COL[ri]);
      disc.fillCircle(0, 0, 2);
      // Punto bianco sul bordo (rivela la rotazione)
      disc.fillStyle(0xffffff, 0.85);
      disc.fillRect(4, -1, 2, 2);

      this.tweens.add({
        targets: disc,
        angle: 360,
        duration: ri === 0 ? 2000 : 2300,
        repeat: -1,
        ease: 'Linear',
      });
    }

    // ── Note musicali flottanti dai dischi ───────────────────────────────────
    const NOTE_CHARS = ['♪', '♫', '♩', '♬'];
    const NOTE_COLS  = ['#ff3366', '#3388ff', '#ffdd33', '#44ff88', '#cc44ff'];
    let noteAlt = 0;
    this.time.addEvent({
      delay: 950,
      repeat: -1,
      callback: () => {
        const [nx, ny] = discPositions[noteAlt % 2];
        noteAlt++;
        const ch  = NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
        const col = NOTE_COLS [Math.floor(Math.random() * NOTE_COLS.length)];
        const note = this.add
          .text(nx + Phaser.Math.Between(-5, 5), ny - 8, ch, {
            fontFamily: FONT, fontSize: '5px',
            color: col, stroke: '#000000', strokeThickness: 2,
          })
          .setDepth(250)
          .setOrigin(0.5, 1);
        this.tweens.add({
          targets: note,
          y: note.y - 18,
          alpha: 0,
          duration: 1100,
          ease: 'Quad.easeOut',
          onComplete: () => note.destroy(),
        });
      },
    });
  }

  /** Pista da ballo viva: tile che ciclano colore + riflessi mobili del globo. */
  private animateDanceFloor(): void {
    const t = this.time.now / 1000;
    const D = 9;
    const g = this.danceFloorFx;
    g.clear();
    for (let ty = 0; ty * D < DF.h; ty++) {
      for (let tx = 0; tx * D < DF.w; tx++) {
        const hue = ((tx * 26 + ty * 40) + t * 85) % 360;
        const val = 0.5 + 0.4 * Math.sin(t * 3 + (tx + ty) * 0.55);
        const col = (Phaser.Display.Color.HSVToRGB(hue / 360, 0.9, Phaser.Math.Clamp(val, 0.2, 1)) as Phaser.Display.Color).color;
        g.fillStyle(col, 0.92);
        g.fillRect(
          DF.x + tx * D, DF.y + ty * D,
          Math.min(D, DF.w - tx * D) - 1, Math.min(D, DF.h - ty * D) - 1,
        );
      }
    }

  }

  /** Palla disco che GIRA: raggi, facce specchiate e riflessi tutti in sync. */
  private animateDisco(): void {
    const rot = (this.time.now / 1000) * 1.4;   // rotazione condivisa (rad/s)
    const BX = DISCO.x, BY = DISCO.y, R = DISCO.r;

    // ── Raggi che ruotano con la palla (con leggero sfarfallio) ──
    const rays = this.discRaysFx;
    rays.clear();
    for (let ri = 0; ri < 6; ri++) {
      const a = (ri / 6) * Math.PI * 2 + rot;
      const flick = 0.26 + 0.16 * Math.sin(rot * 3 + ri);
      rays.lineStyle(2, DISCO_RAY_COLS[ri], flick);
      rays.lineBetween(BX, BY, BX + Math.cos(a) * 150, BY + Math.sin(a) * 120);
      rays.lineStyle(1, DISCO_RAY_COLS[(ri + 3) % 6], flick * 0.5);
      const a2 = a + 0.3;
      rays.lineBetween(BX, BY, BX + Math.cos(a2) * 105, BY + Math.sin(a2) * 85);
    }

    // ── Palla specchiata che gira: facce scorrono, gli hotspot si muovono ──
    const g = this.discBallFx;
    g.clear();
    g.fillStyle(0x243050, 1); g.fillCircle(BX, BY, R);   // sfera base
    const rows = 8, cols = 14;
    for (let iy = 0; iy < rows; iy++) {
      const lat = (iy / (rows - 1) - 0.5) * Math.PI * 0.92;
      const sy = BY + Math.sin(lat) * R;
      const ringR = Math.cos(lat) * R;
      for (let ix = 0; ix < cols; ix++) {
        const lon = (ix / cols) * Math.PI * 2 + rot;
        const cosL = Math.cos(lon);
        if (cosL <= 0.03) continue;                       // faccia dietro: non visibile
        const sx = BX + Math.sin(lon) * ringR;
        // illuminazione: normale della faccia · direzione luce (alto-sx-fronte)
        const nx = Math.sin(lon) * Math.cos(lat);
        const ny = Math.sin(lat);
        const nz = cosL * Math.cos(lat);
        const dot = nx * -0.5 + ny * -0.55 + nz * 0.67;
        const b = Phaser.Math.Clamp(0.28 + dot * 1.15, 0.1, 1);
        const tint = MIRROR_COLS[(ix * 3 + iy) % MIRROR_COLS.length];
        g.fillStyle(b > 0.82 ? 0xffffff : tint, 0.5 + b * 0.5);
        g.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2);
      }
    }
    g.fillStyle(0xffffff, 0.95); g.fillRect(BX - 4, BY - 6, 3, 2);   // hotspot speculare

    // ── Riflessi sul pavimento (pista) sincronizzati alla stessa rotazione ──
    const d = this.discoFx;
    d.clear();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2;
      const sx = DF_CX + Math.cos(a) * DF.w * 0.42;
      const sy = DF_CY + Math.sin(a) * DF.h * 0.4;
      d.fillStyle(DISCO_RAY_COLS[i % DISCO_RAY_COLS.length], 0.5);
      d.fillCircle(sx, sy, 7);
      d.fillStyle(0xffffff, 0.22);
      d.fillCircle(sx, sy, 3);
    }
  }

  private animateSpeakers(): void {
    const t = this.time.now / 90;
    this.speakerEq.clear();

    if (this.brokenMusicMode) {
      // Musica rotta: EQ glitch con salti, skip e colori di errore
      for (const sy of [60, 180]) {
        for (let i = 0; i < 4; i++) {
          const slot = Math.floor(this.time.now / 160 + i * 3.7 + sy * 0.05) % 11;
          const skip = slot < 2; // ~18% del tempo silenzio (disco che salta)
          const h = skip ? 1 : (((slot * 7 + i * 3) % 9) + 2) * 2;
          const glitch = slot === 3 || slot === 8; // flash rosso errore
          this.speakerEq.fillStyle(glitch ? 0xff2222 : (skip ? 0x441111 : 0xaa3311));
          this.speakerEq.fillRect(536 + i * 5, sy + 36 - h, 3, h);
        }
      }
      return;
    }

    for (const sy of [60, 180]) {
      for (let i = 0; i < 4; i++) {
        const h = 6 + Math.abs(Math.sin(t / 2 + i * 1.3 + sy)) * 14;
        const ratio = h / 20;
        this.speakerEq.fillStyle(ratio > 0.7 ? 0xffdd33 : 0x44dd66);
        this.speakerEq.fillRect(536 + i * 5, sy + 36 - h, 3, h);
      }
    }
  }

  /** Avvia gli effetti visivi/audio dell'ubriacatura di Umberto. */
  private startDrunkEffects(): void {
    const cam = this.cameras.main;
    const BASE_ZOOM = 2;

    // Camera che barcolla: rotazione + followOffset + zoom pulse
    this.drunkCamTimer = this.time.addEvent({
      delay: 25,
      loop: true,
      callback: () => {
        this.drunkT += 0.05;
        // Rotazione lenta (±2.5°)
        cam.setRotation(Math.sin(this.drunkT * 0.55) * 0.044);
        // Oscillazione dell'inquadratura (±22px X, ±10px Y in world space)
        cam.setFollowOffset(
          Math.sin(this.drunkT) * 22,
          Math.sin(this.drunkT * 0.7) * 10,
        );
        // Zoom che pulsa leggermente (±3%)
        cam.setZoom(BASE_ZOOM + Math.sin(this.drunkT * 1.3) * 0.06);
      },
    });

    // Distorsione audio: il pitch della musica IN CORSO (FGM party/dance,
    // quella che si sente davvero) ondeggia ±2.5%.
    this.drunkMusicTimer = this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        AudioManager.get().setFgMusicRate(1 + Math.sin(this.drunkT * 0.9) * 0.025);
      },
    });
  }

  /** Ferma gli effetti ubriachi e ripristina camera + audio. */
  private stopDrunkEffects(): void {
    this.drunkCamTimer?.remove();
    this.drunkCamTimer = null;
    this.drunkMusicTimer?.remove();
    this.drunkMusicTimer = null;
    this.vomitTimer?.remove();
    this.vomitTimer = null;
    const cam = this.cameras.main;
    cam.setFollowOffset(0, 0);
    cam.setRotation(0);
    cam.setZoom(2);
    AudioManager.get().setFgMusicRate(1);   // ripristina il pitch normale della musica
  }

  /** Schedula il prossimo episodio di vomito (ogni 4-7 s, mentre è ubriaco). */
  private scheduleVomit(): void {
    const delay = 4000 + Math.random() * 3000;
    this.vomitTimer = this.time.delayedCall(delay, () => {
      if (this.danceStarted) return; // già in pista, stop
      this.doVomit();
      this.scheduleVomit(); // prossimo round
    });
  }

  /** Animazione vomito + pozzanghera permanente sul pavimento. */
  private doVomit(): void {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    // ── POZZANGHERA PERMANENTE ──────────────────────────────────────────
    const puddle = this.add.graphics().setDepth(py - 1);
    // Blob principale
    puddle.fillStyle(0x7aaa18, 0.88);
    puddle.fillEllipse(px, py + 9, 26, 11);
    // Riflesso lucido
    puddle.fillStyle(0xa8cc33, 0.55);
    puddle.fillEllipse(px - 4, py + 7, 12, 5);
    // Gocce attorno
    puddle.fillStyle(0x557a0e, 0.7);
    puddle.fillCircle(px + 10, py + 12, 3);
    puddle.fillCircle(px - 9,  py + 8,  2.5);
    puddle.fillCircle(px + 4,  py + 14, 2);

    // ── PARTICELLE SPRAY ────────────────────────────────────────────────
    const NUM = 10;
    const parts: { x: number; y: number; vx: number; vy: number; r: number; life: number }[] =
      Array.from({ length: NUM }, () => ({
        x: px,
        y: py - 6,
        vx: (Math.random() - 0.4) * 3.5,
        vy: -1.5 - Math.random() * 2.5,
        r: 1.5 + Math.random() * 1.5,
        life: 1.0,
      }));

    const gfx = this.add.graphics().setDepth(py + 20);
    const ptimer = this.time.addEvent({
      delay: 25,
      loop: true,
      callback: () => {
        gfx.clear();
        let any = false;
        for (const p of parts) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.22;
          p.life -= 0.055;
          if (p.life <= 0) continue;
          any = true;
          gfx.fillStyle(0x8ec420, p.life * 0.9);
          gfx.fillCircle(p.x, p.y, p.r);
        }
        if (!any) { ptimer.remove(); gfx.destroy(); }
      },
    });

    // ── PAUSA BREVE (Umberto si ferma) ──────────────────────────────────
    this.player.locked = true;
    this.time.delayedCall(700, () => {
      if (!this.danceMgActive) this.player.locked = false;
    });

    // ── REAZIONI DEI VICINI ──────────────────────────────────────────────
    this.showVomitReactions(px, py);
  }

  /** Mostra nuvolette di disgusto dagli NPC vicini al punto del vomito. */
  private showVomitReactions(px: number, py: number): void {
    const INSULTS = [
      'BLEAH!!', 'Che schifo!', 'OMMAMMA!', 'Ma che cazzo fai?!',
      'Porcoddue', 'Vattene!', 'NO NO NO!', 'Vergogna!',
      'Ubriacone!', 'Aiuto!!', 'Mamma mia...', '*fetore*',
      'Porcodio!', 'Stai bene?!', 'CAZZO FAI OH!!',
    ];

    const nearby = [...this.obstaclesSprites]
      .filter(s => Phaser.Math.Distance.Between(s.x, s.y, px, py) < 150)
      .sort((a, b) =>
        Phaser.Math.Distance.Between(a.x, a.y, px, py) -
        Phaser.Math.Distance.Between(b.x, b.y, px, py)
      )
      .slice(0, 3);

    nearby.forEach((sprite, i) => {
      const txt = Phaser.Math.RND.pick(INSULTS);
      this.time.delayedCall(i * 220, () => {
        const bx = sprite.x;
        const by = sprite.y - 20;
        const PAD = 4;
        const DEP = 900;

        const label = this.add
          .text(bx, by, txt, {
            fontFamily: FONT,
            fontSize: '5px',
            color: '#111111',
          })
          .setOrigin(0.5, 1)
          .setDepth(DEP + 1);

        const tw = label.width;
        const th = label.height;
        const bLeft  = bx - tw / 2 - PAD;
        const bTop   = by - th - PAD;
        const bW     = tw + PAD * 2;
        const bH     = th + PAD * 2;

        const bg = this.add.graphics().setDepth(DEP);
        bg.fillStyle(0xffffff, 0.95);
        bg.fillRoundedRect(bLeft, bTop, bW, bH, 3);
        bg.lineStyle(1, 0x333333, 0.85);
        bg.strokeRoundedRect(bLeft, bTop, bW, bH, 3);
        // Coda fumetto
        bg.fillStyle(0xffffff, 0.95);
        bg.fillTriangle(bx - 3, by, bx + 3, by, bx, by + 6);

        [bg, label].forEach(o => o.setAlpha(0));
        this.tweens.add({ targets: [bg, label], alpha: 1, duration: 130 });
        this.time.delayedCall(2400, () => {
          this.tweens.add({
            targets: [bg, label],
            alpha: 0,
            duration: 300,
            onComplete: () => { bg.destroy(); label.destroy(); },
          });
        });
      });
    });
  }

  /** Attiva la modalità "musica rotta": Stefano ubriaco alla consolle */
  private activateBrokenMusic(): void {
    this.brokenMusicMode = true;
    this.tweens.killTweensOf(this.stefanoSprite);
    // Sposta Stefano a destra della consolle (faccia visibile, rivolto verso di essa)
    this.tweens.add({
      targets: this.stefanoSprite,
      x: 564,
      y: 118,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.stefanoSprite.play('stefano-idle-left'); // faccia visibile, guarda la consolle
        this.stefanoSprite.setDepth(118);
        // Dondolio ubriaco
        this.tweens.add({
          targets: this.stefanoSprite,
          angle: { from: -10, to: 10 },
          duration: 450,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  private addObstacle(x: number, y: number, w: number, h: number): void {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(r, true);
    this.obstacles.push(r);
  }

  // ─── Dance: trigger ────────────────────────────────────────────────────────

  private triggerDanceSequence(): void {
    this.danceStarted = true;
    this.questHUD.clear();
    this.questHUD.hideMarker();
    this.player.locked = true;
    this.player.invertControls = false; // ripristina controlli normali
    this.stopDrunkEffects();

    if (this.postPongDanceResolve) {
      // Percorso post-pong: il dialogo di sfida è già stato mostrato, vai dritto
      const resolve = this.postPongDanceResolve;
      this.postPongDanceResolve = null;
      resolve();
    } else {
      // Percorso esplorazione libera (pre-pong non dovrebbe mai arrivarci)
      this.dialogue.start({
        lines: UMBERTO_DANCE_LINES,
        onComplete: () => void this.playDanceMinigame(),
      });
    }
  }

  // ─── Dance: update frecce (chiamato ogni frame mentre danceMgActive) ───────

  private updateDanceArrows(): void {
    const now = this.time.now;
    const SPAWN_Y = 26;
    const HIT_Y = 214;
    const OY = UI_OFF_Y;

    // Aggiorna barra progresso
    if (this.danceStartTime > 0 && this.danceProgressCb) {
      this.danceProgressCb(now - this.danceStartTime);
    }

    for (const arrow of this.danceArrows) {
      if (arrow.scored) continue;
      const elapsed = now - (arrow.hitTime - DANCE_FALL_MS);
      const progress = Phaser.Math.Clamp(elapsed / DANCE_FALL_MS, 0, 1.25);
      arrow.gfx.y = SPAWN_Y + (HIT_Y - SPAWN_Y) * progress + OY;

      // Auto-miss se l'arrow è passata oltre la finestra OK
      if (now > arrow.hitTime + 170) {
        arrow.scored = true;
        this.tweens.add({ targets: arrow.gfx, alpha: 0, duration: 140 });
      }
    }
  }

  // ─── Dance: minigame principale ────────────────────────────────────────────

  private async playDanceMinigame(unlockAfter = true): Promise<void> {
    const OX = UI_OFF_X;
    const OY = UI_OFF_Y;
    const W = WORLD_W;
    const H = WORLD_H;
    const BEAT_MS = 60000 / DANCE_BPM;

    const SPAWN_Y = 26;
    const HIT_Y = 214;
    const ARROW_SZ = 26;

    // Finestre di timing (ms dall'hitTime perfetto)
    const W_PERFECT = 48;
    const W_GOOD = 95;
    const W_OK = 160;

    // Raccolta elementi da distruggere alla fine
    const els: Phaser.GameObjects.GameObject[] = [];
    const el = <T extends Phaser.GameObjects.GameObject>(o: T): T => { els.push(o); return o; };

    // Overlay scuro
    el(this.add.rectangle(OX, OY, W, H, 0x000000, 0.87)
      .setOrigin(0).setScrollFactor(0).setDepth(2000));

    // Titolo
    el(this.add.text(W / 2 + OX, 9 + OY, '★  J U S T  D A N C E  ★', {
      fontFamily: FONT, fontSize: '10px', color: '#ff88ff',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001));

    // Colonne (lane) + target ghost
    DANCE_DIRS.forEach((dir, i) => {
      const cx = DANCE_COLS[dir] + OX;

      // Sfondo corsia
      const lane = el(this.add.graphics().setScrollFactor(0).setDepth(2001));
      lane.fillStyle(DIR_COL[dir], 0.07);
      lane.fillRect(cx - ARROW_SZ / 2 - 2, SPAWN_Y + OY, ARROW_SZ + 4, HIT_Y - SPAWN_Y);

      // Barra timing: tre zone colorate attorno alla hit zone
      const hw = el(this.add.graphics().setScrollFactor(0).setDepth(2001));
      hw.fillStyle(0xffffff, 0.035);
      hw.fillRect(cx - ARROW_SZ / 2 - 3, HIT_Y - W_OK + OY, ARROW_SZ + 6, W_OK * 2);
      hw.fillStyle(0xffdd44, 0.06);
      hw.fillRect(cx - ARROW_SZ / 2 - 2, HIT_Y - W_GOOD + OY, ARROW_SZ + 4, W_GOOD * 2);
      hw.fillStyle(0x44ff88, 0.12);
      hw.fillRect(cx - ARROW_SZ / 2 - 1, HIT_Y - W_PERFECT + OY, ARROW_SZ + 2, W_PERFECT * 2);

      // Ghost target
      const ghost = el(this.add.graphics().setScrollFactor(0).setDepth(2002));
      ghost.setPosition(cx, HIT_Y + OY);
      this.drawDanceArrow(ghost, dir, DIR_COL[dir], ARROW_SZ, true);

      // Label tasto
      const labels = ['←', '↓', '↑', '→'];
      el(this.add.text(cx, HIT_Y + ARROW_SZ + 2 + OY, labels[i], {
        fontFamily: FONT, fontSize: '9px',
        color: '#' + DIR_COL[dir].toString(16).padStart(6, '0'),
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002));
    });

    // Score e combo
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let nPerfect = 0, nGood = 0, nOk = 0, nMiss = 0;

    // Fine ballo legata alla barra: si risolve quando la barra tocca il 100%
    let danceTimeUp = false;
    let danceEndResolve: (() => void) | null = null;

    const scoreText = el(this.add.text(W - 8 + OX, 9 + OY, 'SCORE: 0', {
      fontFamily: FONT, fontSize: '7px', color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(2003)) as Phaser.GameObjects.Text;

    const comboText = el(this.add.text(W - 8 + OX, 20 + OY, '', {
      fontFamily: FONT, fontSize: '7px', color: '#ffdd44',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(2003)) as Phaser.GameObjects.Text;

    // Progress bar (in basso, full width)
    const PBAR_Y = H - 6 + OY;
    const PBAR_W = W - 24;
    const PBAR_X = 12 + OX;
    const pbarBg = el(this.add.graphics().setScrollFactor(0).setDepth(2003));
    pbarBg.fillStyle(0x222222, 0.8); pbarBg.fillRect(PBAR_X, PBAR_Y, PBAR_W, 4);
    const pbarFill = el(this.add.graphics().setScrollFactor(0).setDepth(2003));
    // aggiornata ogni frame tramite updateProgressBar
    const updateProgressBar = (elapsed: number): void => {
      const pct = Phaser.Math.Clamp(elapsed / DANCE_DURATION_MS, 0, 1);
      pbarFill.clear();
      pbarFill.fillStyle(0xcc44ff, 1);
      pbarFill.fillRect(PBAR_X, PBAR_Y, Math.round(PBAR_W * pct), 4);
      // Barra piena → interrompi il ballo (non deve andare oltre)
      if (pct >= 1 && !danceTimeUp) { danceTimeUp = true; danceEndResolve?.(); }
    };

    // Feedback testo (PERFECT / GOOD / OK / MISS)
    const fbText = el(this.add.text(W / 2 + OX, 52 + OY, '', {
      fontFamily: FONT, fontSize: '13px', color: '#44ff88',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2004)) as Phaser.GameObjects.Text;

    const showFeedback = (text: string, color: string, size = 13) => {
      fbText.setText(text).setColor(color).setFontSize(size);
      fbText.setAlpha(1).setScale(1.2);
      this.tweens.killTweensOf(fbText);
      this.tweens.add({ targets: fbText, alpha: 0, scale: 1, duration: 650, delay: 180 });
    };

    // ─── Beat indicator ● — lampeggia ogni beat per calibrare DANCE_OFFSET_MS ─
    // Se arriva PRIMA del beat audio → aumenta DANCE_OFFSET_MS
    // Se arriva DOPO  il beat audio  → diminuisci DANCE_OFFSET_MS
    const beatDot = this.add.circle(W / 2 + OX, 17 + OY, 4, 0xffffff, 1)
      .setScrollFactor(0).setDepth(2005).setAlpha(0);
    el(beatDot);

    // ─── Ballerino Umberto pixel-art con arti mobili (lato destro) ──────────
    // Centro in game space: x=390 (a destra delle lane), y=222
    const DDX = 390;
    const DDY = 222;
    const dbX = DDX + OX; // screen-space base X (immutabile — usato per reset)
    const dbY = DDY + OY; // screen-space base Y

    // Container unico per il ballerino: scala 1.7× senza toccare le coordinate.
    // Tutti i figli usano coordinate LOCALI (offset dal centro del container).
    const dancerContainer = el(
      this.add.container(dbX, dbY)
        .setScrollFactor(0).setDepth(2005).setScale(1.7)
    );

    // Crea un Graphics in spazio locale del container e lo aggiunge a els[]
    const dg = (ox: number, oy: number): Phaser.GameObjects.Graphics => {
      const g = el(this.add.graphics().setPosition(ox, oy));
      dancerContainer.add(g);
      return g;
    };

    // ── Spotlight: luce CALDA che cade dall'alto sul ballerino ───────────────
    // Elementi in spazio schermo (non nel container, così scendono dal bordo
    // alto). Depth < 2005 → dietro al ballerino. Tutti in els → svaniscono a fine.
    const spotX  = dbX;
    const topY   = OY + 6;        // sorgente vicino al bordo superiore
    const floorY = dbY + 30;      // dove la luce tocca il pavimento
    const WARM   = 0xfff2cc;

    // Accenti disco laterali (magenta/ciano): richiamo alla festa, molto tenui
    const acc = el(this.add.graphics().setScrollFactor(0).setDepth(2002));
    acc.fillStyle(0xff44cc, 0.05);
    acc.fillTriangle(spotX - 30, topY, spotX - 40, floorY, spotX + 14, floorY);
    acc.fillStyle(0x44ddff, 0.05);
    acc.fillTriangle(spotX + 30, topY, spotX + 40, floorY, spotX - 14, floorY);

    // Cono di luce a strati (dal faretto in alto si allarga verso terra)
    const cone = el(this.add.graphics().setScrollFactor(0).setDepth(2003));
    const coneLayer = (halfW: number, alpha: number): void => {
      cone.fillStyle(WARM, alpha);
      cone.fillTriangle(spotX, topY, spotX - halfW, floorY, spotX + halfW, floorY);
    };
    coneLayer(56, 0.045);
    coneLayer(38, 0.06);
    coneLayer(22, 0.085);

    // Pozza di luce sul pavimento
    const pool = el(this.add.graphics().setScrollFactor(0).setDepth(2003));
    pool.fillStyle(WARM, 0.14);     pool.fillEllipse(spotX, floorY, 84, 16);
    pool.fillStyle(WARM, 0.20);     pool.fillEllipse(spotX, floorY, 50, 11);
    pool.fillStyle(0xffffff, 0.12); pool.fillEllipse(spotX, floorY, 26, 6);

    // Faretto sorgente in alto
    const src = el(this.add.graphics().setScrollFactor(0).setDepth(2004));
    src.fillStyle(WARM, 0.22);   src.fillCircle(spotX, topY, 11);
    src.fillStyle(0xffffff, 0.9); src.fillCircle(spotX, topY, 3.5);

    // Pulsazione lenta della luce (viva ma discreta) — resta tra gli els
    const spotPulse = this.tweens.add({
      targets: [cone, pool], alpha: { from: 0.82, to: 1 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Ombra a terra (dentro la pozza di luce) ──────────────────────────────
    const dShadow = dg(0, 16);
    dShadow.fillStyle(0x000000, 0.34);
    dShadow.fillEllipse(0, 0, 30, 5);

    // ── Colori Umberto ────────────────────────────────────────────────────
    const D_SKIN  = 0xffcc99;
    // const D_HAIR = 0x221100;  // non usato: testa sostituita dal portrait
    const D_SHIRT = 0xcc4400;  // arancione
    const D_PANTS = 0x1a3355;
    const D_SHOES = 0x110800;

    // ── Corpo —————— ogni Graphics è al PIVOT del proprio arto ───────────
    // Le coordinate locali (0,0) di ogni Graphics = punto di rotazione
    // Le misure seguono la griglia pixel del gioco (×2 su schermo)

    // Gambe (sotto il torso → depth più basso)
    const dLLeg = dg(-3,  2);
    dLLeg.fillStyle(D_PANTS, 1); dLLeg.fillRect(-2,  0, 4, 11);
    dLLeg.fillStyle(D_SHOES, 1); dLLeg.fillRect(-3, 11, 5,  3);

    const dRLeg = dg( 3,  2);
    dRLeg.fillStyle(D_PANTS, 1); dRLeg.fillRect(-2,  0, 4, 11);
    dRLeg.fillStyle(D_SHOES, 1); dRLeg.fillRect(-2, 11, 5,  3);

    // Torso (sopra le gambe)
    const dTorso = dg(0, -12);
    dTorso.fillStyle(D_SHIRT, 1);         dTorso.fillRect(-5, 0, 10, 14);
    dTorso.fillStyle(0xff6633, 0.55);     dTorso.fillRect(-4, 0,  8,  4); // colletto

    // Braccia — pivot = spalla; il braccio si estende verso il basso da (0,0)
    const dLArm = dg(-6, -11);
    dLArm.fillStyle(D_SHIRT, 1); dLArm.fillRect(-2, 0, 4,  7); // manica
    dLArm.fillStyle(D_SKIN,  1); dLArm.fillRect(-2, 7, 4,  5); // avambraccio

    const dRArm = dg( 6, -11);
    dRArm.fillStyle(D_SHIRT, 1); dRArm.fillRect(-2, 0, 4,  7);
    dRArm.fillStyle(D_SKIN,  1); dRArm.fillRect(-2, 7, 4,  5);

    // Testa — contenitore vuoto (il portrait Image viene aggiunto sotto)
    const dHead = dg(0, -21); // Graphics vuoto, solo per il sistema di animazione

    // Portrait di Umberto sopra la testa — in spazio locale del container
    const umKey = getPortraitKey(this, 'umberto');
    const dPortrait = umKey
      ? el(this.add.image(0, -21, umKey).setDisplaySize(26, 30))
      : null;
    if (dPortrait) dancerContainer.add(dPortrait);

    // Offset locali di ogni parte (rispetto a dbX/dbY) — usati per il reset
    const D_LP: [number, number][] = [
      [0, -21], [0, -12], [-6, -11], [6, -11], [-3, 2], [3, 2],
    //  head     torso     lArm       rArm      lLeg     rLeg
      ...(dPortrait ? [[0, -21] as [number, number]] : []),
    //  portrait (stessa posizione della testa)
    ];
    const dAllParts: Phaser.GameObjects.GameObject[] = [
      dHead, dTorso, dLArm, dRArm, dLLeg, dRLeg,
      ...(dPortrait ? [dPortrait] : []),
    ];

    // ── Idle: dondolio braccia alternate ─────────────────────────────────
    let dIdleTimer: Phaser.Time.TimerEvent | null = null;

    const startDancerIdle = (): void => {
      this.tweens.add({
        targets: dLArm, angle: { from: -8, to: 8 },
        duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: dRArm, angle: { from: 8, to: -8 },
        duration: 520, yoyo: true, repeat: -1, delay: 260, ease: 'Sine.easeInOut',
      });
    };
    const stopDancerIdle = (): void => {
      this.tweens.killTweensOf([dLArm, dRArm]);
      dLArm.setAngle(0); dRArm.setAngle(0);
    };
    startDancerIdle();

    // ── Mossa per direzione ───────────────────────────────────────────────
    const danceMove = (dir: DanceDir): void => {
      stopDancerIdle();
      dIdleTimer?.remove();

      // Reset completo: kill tweens, angoli a 0, posizioni base
      this.tweens.killTweensOf(dAllParts);
      dLArm.setAngle(0); dRArm.setAngle(0);
      dLLeg.setAngle(0); dRLeg.setAngle(0);
      // reset alle posizioni LOCALI (il container gestisce la posizione assoluta)
      dAllParts.forEach((p, i) =>
        (p as Phaser.GameObjects.Graphics).setPosition(D_LP[i][0], D_LP[i][1]));

      switch (dir) {
        case 'left':
          // Braccio sx spinge a sinistra, gamba sx calcio laterale
          this.tweens.add({ targets: dLArm, angle: -84, duration: 115, yoyo: true, ease: 'Back.easeOut' });
          this.tweens.add({ targets: dLLeg, angle: -32, duration: 125, yoyo: true, ease: 'Quad.easeOut' });
          this.tweens.add({ targets: dRLeg, angle:  14, duration: 110, yoyo: true });
          // Corpo si sposta a sinistra
          this.tweens.add({ targets: dAllParts, x: '-=11', duration: 90, yoyo: true, ease: 'Quad.easeOut' });
          break;

        case 'right':
          this.tweens.add({ targets: dRArm, angle:  84, duration: 115, yoyo: true, ease: 'Back.easeOut' });
          this.tweens.add({ targets: dRLeg, angle:  32, duration: 125, yoyo: true, ease: 'Quad.easeOut' });
          this.tweens.add({ targets: dLLeg, angle: -14, duration: 110, yoyo: true });
          this.tweens.add({ targets: dAllParts, x: '+=11', duration: 90, yoyo: true, ease: 'Quad.easeOut' });
          break;

        case 'up':
          // Salto: entrambe le braccia verso l'alto, corpo che si alza
          this.tweens.add({ targets: dLArm, angle: -140, duration: 130, yoyo: true, ease: 'Back.easeOut' });
          this.tweens.add({ targets: dRArm, angle:  140, duration: 130, yoyo: true, ease: 'Back.easeOut' });
          this.tweens.add({ targets: dAllParts, y: '-=20', duration: 128, yoyo: true, ease: 'Quad.easeOut' });
          break;

        case 'down':
          // Squat: braccia aperte ai lati, gambe piegate verso l'esterno, corpo giù
          this.tweens.add({ targets: dLArm, angle:  50, duration: 95, yoyo: true, ease: 'Quad.easeOut' });
          this.tweens.add({ targets: dRArm, angle: -50, duration: 95, yoyo: true, ease: 'Quad.easeOut' });
          this.tweens.add({ targets: dLLeg, angle:  24, duration: 95, yoyo: true });
          this.tweens.add({ targets: dRLeg, angle: -24, duration: 95, yoyo: true });
          this.tweens.add({ targets: dAllParts, y: '+=9', duration: 88, yoyo: true, ease: 'Quad.easeOut' });
          break;
      }

      // Riavvia idle dopo che la mossa è finita
      dIdleTimer = this.time.delayedCall(320, startDancerIdle);
    };

    // Flash colonna al colpo
    const flashCol = (dir: DanceDir) => {
      const cx = DANCE_COLS[dir] + OX;
      const fl = this.add.graphics().setScrollFactor(0).setDepth(2007);
      fl.fillStyle(DIR_COL[dir], 0.38);
      fl.fillRect(cx - ARROW_SZ / 2 - 3, SPAWN_Y + OY, ARROW_SZ + 6, HIT_Y - SPAWN_Y + ARROW_SZ);
      this.tweens.add({ targets: fl, alpha: 0, duration: 230,
        onComplete: () => fl.destroy() });
    };

    // ── Dialoghi Umberto & Cece prima della musica ──────────────────────────
    // La schermata Just Dance è già a video; alziamo il box dialoghi sopra
    // l'overlay (depth 2000+) e attendiamo che l'utente li faccia scorrere.
    const dlgUi = this.dialogue.uiContainer;
    const prevDlgDepth = dlgUi.depth;
    dlgUi.setDepth(2050);
    await new Promise<void>(resolve => {
      this.dialogue.start({ lines: DANCE_PREGAME_LINES, onComplete: resolve });
    });
    dlgUi.setDepth(prevDlgDepth);

    // ── Countdown 3-2-1-GO ──────────────────────────────────────────────────
    for (const label of ['3', '2', '1', 'GO!']) {
      const ct = this.add.text(W / 2 + OX, H / 2 + OY - 12, label, {
        fontFamily: FONT, fontSize: '34px',
        color: label === 'GO!' ? '#ffdd44' : '#ffffff',
        stroke: '#000', strokeThickness: 9,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2010);
      await this.delay(label === 'GO!' ? 380 : 680);
      ct.destroy();
    }

    // ── Musica ──────────────────────────────────────────────────────────────
    // fadeIn=0 → parte subito a volume pieno (no 900ms muto che sfasa la percezione)
    AudioManager.get().playFgMusic(this, 'dance', 0.78, 0);

    const gameStart = this.time.now;
    this.danceStartTime = gameStart;
    this.danceProgressCb = updateProgressBar;
    this.danceArrows = [];
    const liveArrows = this.danceArrows;

    // ── Debug timing: misura drift audio vs game ogni 2s ─────────────────────
    // Leggi via console: window.__danceDebug__
    (window as any).__danceDebug__ = { gameStart, samples: [] };
    const _dbgTimer = this.time.addEvent({ delay: 2000, loop: true, callback: () => {
      if (!this.danceMgActive) { _dbgTimer.remove(); return; }
      const fgm = (AudioManager.get() as any).fgMusic;
      const seekMs = fgm?.seek != null ? (fgm.seek as number) * 1000 : null;
      const gameElapsed = this.time.now - gameStart;
      (window as any).__danceDebug__.samples.push({ gameElapsed: Math.round(gameElapsed), seekMs: seekMs != null ? Math.round(seekMs) : null, drift: seekMs != null ? Math.round(seekMs - gameElapsed) : null });
    }});

    // ── Beat indicator: lampeggia ogni beat per la calibrazione dell'offset ──
    const flashBeat = () => {
      if (!this.danceMgActive) return;  // inerte dopo la fine del minigioco
      beatDot.setAlpha(1);
      this.tweens.killTweensOf(beatDot);
      this.tweens.add({ targets: beatDot, alpha: 0, duration: 90 });
    };
    // FIX: per offset negativi, Math.max(0, offset) sbagliato.
    // Calcola il ritardo fino al PROSSIMO beat dopo t=0 (modulo BEAT_MS).
    const firstBeatDelay = ((DANCE_OFFSET_MS % BEAT_MS) + BEAT_MS) % BEAT_MS;
    this.time.delayedCall(firstBeatDelay, () => {
      flashBeat();
      this.time.addEvent({ delay: BEAT_MS, repeat: -1, callback: flashBeat });
    });

    // ── Beatmap manuale "Timber" ─────────────────────────────────────────────
    // Per usare il generatore procedurale con un'altra canzone, sostituisci con:
    //   const beatmap = generateDanceBeatmap(DANCE_DURATION_MS, BEAT_MS);
    const beatmap = DANCE_BEATMAP_TIMBER;

    // ── Spawn frecce in base al beatmap ─────────────────────────────────────
    let spawnActive = true; // false = stop nuovi spawn (input già bloccato)
    for (const [beat, dir] of beatmap) {
      const hitTime = gameStart + DANCE_OFFSET_MS + beat * BEAT_MS;
      const spawnDelay = hitTime - DANCE_FALL_MS - this.time.now;
      if (spawnDelay < 0) continue;

      this.time.delayedCall(spawnDelay, () => {
        if (!this.danceMgActive || !spawnActive) return; // minigioco finito o input bloccato
        const gfx = this.add.graphics().setScrollFactor(0).setDepth(2006);
        const cx = DANCE_COLS[dir] + OX;
        gfx.setPosition(cx, SPAWN_Y + OY);
        this.drawDanceArrow(gfx, dir, DIR_COL[dir], ARROW_SZ, false);
        els.push(gfx);
        liveArrows.push({ gfx, dir, hitTime, scored: false });
      });
    }

    // ── Gestione input (cursor keys) ─────────────────────────────────────────
    this.danceMgActive = true;
    const ck = this.input.keyboard!.createCursorKeys();

    const handlePress = (dir: DanceDir) => {
      if (!this.danceMgActive) return;
      const now = this.time.now;

      const candidates = liveArrows
        .filter(a => !a.scored && a.dir === dir)
        .sort((a, b) => a.hitTime - b.hitTime);

      // Ignora press troppo anticipati (>W_OK+100 prima dell'hitTime)
      if (candidates.length === 0 || now < candidates[0].hitTime - W_OK - 100) {
        showFeedback('MISS', '#ff4444', 11);
        combo = 0;
        comboText.setText('');
        return;
      }

      const arrow = candidates[0];
      const delta = Math.abs(now - arrow.hitTime);
      arrow.scored = true;
      this.tweens.add({
        targets: arrow.gfx, alpha: 0, scaleX: 1.7, scaleY: 1.7, duration: 190,
      });

      if (delta <= W_PERFECT) {
        score += 100; combo++; nPerfect++;
        showFeedback('PERFECT!', '#44ff88', 14);
        flashCol(dir);
      } else if (delta <= W_GOOD) {
        score += 60; combo++; nGood++;
        showFeedback('GOOD', '#ffdd44', 13);
        flashCol(dir);
      } else if (delta <= W_OK) {
        score += 30; combo++; nOk++;
        showFeedback('OK', '#ffffff', 11);
      } else {
        showFeedback('MISS', '#ff4444', 11);
        combo = 0; nMiss++;
      }

      if (combo > maxCombo) maxCombo = combo;
      scoreText.setText(`SCORE: ${score}`);
      comboText.setText(combo >= 3 ? `${combo}× COMBO!` : '');
      danceMove(dir);
    };

    const onL = () => handlePress('left');
    const onD = () => handlePress('down');
    const onU = () => handlePress('up');
    const onR = () => handlePress('right');
    ck.left.on('down', onL);
    ck.down.on('down', onD);
    ck.up.on('down', onU);
    ck.right.on('down', onR);

    // ── Attendi la BARRA piena ───────────────────────────────────────────────
    // Il ballo finisce esattamente quando la barra tocca la fine (non oltre).
    const danceEndPromise = new Promise<void>(r => { danceEndResolve = r; });
    await Promise.race([
      danceEndPromise,
      this.delay(DANCE_DURATION_MS + 600), // salvagente se l'update si ferma
    ]);

    // Blocca input: rimuovi listener frecce, stop nuovi spawn
    ck.left.off('down', onL);
    ck.down.off('down', onD);
    ck.up.off('down', onU);
    ck.right.off('down', onR);
    spawnActive = false; // nessuna nuova freccia; quelle in volo continuano
    this.danceProgressCb = null;
    this.danceStartTime = 0;

    // ── Fine normale: la barra è piena, il ballo si ferma qui ────────────────
    this.danceMgActive = false; // frecce congelate: niente prosegue oltre la barra
    spotPulse.remove();         // stop pulsazione luce (evita conflitti col fade)

    // ── Pannello PUNTEGGIO (si prosegue SOLO col click) ──────────────────────
    const scoreEls: Phaser.GameObjects.GameObject[] = [];
    // Centro SCHERMO: GAME_WIDTH/2 (non WORLD_W, che sposterebbe il box a destra)
    const scx = GAME_WIDTH / 2 + OX;
    const scy = H / 2 + OY;
    const PW = 176, PH = 152;

    // Velo scuro che copre il campo congelato
    scoreEls.push(this.add.rectangle(OX, OY, W, H, 0x000000, 0.8)
      .setOrigin(0).setScrollFactor(0).setDepth(2099));

    // Riquadro centrato
    const panel = this.add.graphics().setScrollFactor(0).setDepth(2100);
    panel.fillStyle(0x140018, 0.94);
    panel.fillRoundedRect(scx - PW / 2, scy - PH / 2, PW, PH, 6);
    panel.lineStyle(2, 0xcc44ff, 1);
    panel.strokeRoundedRect(scx - PW / 2, scy - PH / 2, PW, PH, 6);
    scoreEls.push(panel);

    // Testo centrato (titolo, punteggio)
    const addC = (dy: number, txt: string, size: string, color: string): void => {
      scoreEls.push(this.add.text(scx, scy + dy, txt, {
        fontFamily: FONT, fontSize: size, color, align: 'center',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2101));
    };
    addC(-63, '★  JUST DANCE!  ★', '9px', '#ff88ff');
    addC(-44, `${score}`, '15px', '#ffffff');
    addC(-30, 'PUNTI', '5px', '#9a88b0');

    // Statistiche INCOLONNATE: etichetta a sinistra, valore allineato a destra
    const rows: [string, number, string][] = [
      ['PERFECT',   nPerfect, '#66ffcc'],
      ['GOOD',      nGood,    '#9be08a'],
      ['OK',        nOk,      '#ffffff'],
      ['MISS',      nMiss,    '#ff7b7b'],
      ['COMBO MAX', maxCombo, '#ffdd44'],
    ];
    const LX = scx - 66, RX = scx + 66;
    let ry = scy - 12;
    for (const [label, val, col] of rows) {
      scoreEls.push(this.add.text(LX, ry, label, {
        fontFamily: FONT, fontSize: '6px', color: col, stroke: '#000', strokeThickness: 3,
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2101));
      scoreEls.push(this.add.text(RX, ry, `${val}`, {
        fontFamily: FONT, fontSize: '6px', color: col, stroke: '#000', strokeThickness: 3,
      }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(2101));
      ry += 13;
    }

    const prompt = this.add.text(scx, scy + PH / 2 - 12, '– premi per continuare –', {
      fontFamily: FONT, fontSize: '6px', color: '#dddddd',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2101);
    scoreEls.push(prompt);
    const blink = this.tweens.add({ targets: prompt, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });

    // Comparsa del pannello
    for (const o of scoreEls) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    await new Promise<void>(resolve =>
      this.tweens.add({ targets: scoreEls, alpha: 1, duration: 300, onComplete: () => resolve() })
    );

    // Attendi il click (o Spazio/Invio) — nessun avanzamento automatico
    await new Promise<void>(resolve => {
      const spK = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      const enK = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      const finish = (): void => {
        this.input.off('pointerdown', finish);
        spK.off('down', finish); enK.off('down', finish);
        resolve();
      };
      this.input.on('pointerdown', finish);
      spK.on('down', finish); enK.on('down', finish);
    });
    blink.remove();

    // Chiudi il minigioco: dissolvi tutto (campo + pannello)
    await new Promise<void>(resolve =>
      this.tweens.add({
        targets: [...els, ...scoreEls], alpha: 0, duration: 700,
        onComplete: () => resolve(),
      })
    );
    for (const e of els) { if ((e as Phaser.GameObjects.GameObject).active) e.destroy(); }
    for (const a of liveArrows) { if (a.gfx.active) a.gfx.destroy(); }
    for (const o of scoreEls) { if ((o as Phaser.GameObjects.GameObject).active) o.destroy(); }

    // Ora il dialogo è in primo piano senza concorrenza di depth
    await new Promise<void>(resolve =>
      this.dialogue.start({ lines: DANCE_TIRED_LINES, onComplete: resolve })
    );

    // La musica danza continua in sottofondo fino alla fine della scena
    if (unlockAfter) this.player.locked = false;
  }

  // ─── Dance: disegna una freccia pixel-art ─────────────────────────────────
  // Il Graphics è già posizionato al centro freccia; si disegna attorno all'origine (0,0)

  private drawDanceArrow(
    g: Phaser.GameObjects.Graphics,
    dir: DanceDir,
    color: number,
    sz: number,
    ghost: boolean,
  ): void {
    const a = ghost ? 0.32 : 1;
    const h = sz / 2;      // metà altezza
    const s = sz * 0.40;   // mezzo gambo

    // Forma CANONICA: freccia verso l'alto. Le altre direzioni sono la STESSA
    // forma ruotata → tutte e 4 le frecce sono identiche (niente asimmetrie).
    g.fillStyle(color, a);
    g.lineStyle(ghost ? 1 : 2, ghost ? color : 0xffffff, ghost ? 0.25 : 0.65);
    g.fillTriangle(-h, h * 0.2, h, h * 0.2, 0, -h);
    g.fillRect(-s, h * 0.2, s * 2, h * 0.85);
    g.strokeTriangle(-h, h * 0.2, h, h * 0.2, 0, -h);

    const ROT: Record<DanceDir, number> = {
      up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2,
    };
    g.setRotation(ROT[dir]);
  }

  // ─── Util ──────────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }
}
