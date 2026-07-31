import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from '../config';
import { TransitionSystem } from '../systems/TransitionSystem';
import {
  addShadow,
  CHAR_CONFIGS,
  CHAR_SCALE,
  generateSpriteTexture,
  loadPortraits,
} from '../systems/CharacterSprite';
import { AudioManager } from '../systems/AudioManager';
import { SPEAKER_COLORS } from '../systems/DialogueSystem';
import { Juice } from '../systems/Juice';
import { Settings } from '../systems/Settings';

const FONT = '"Press Start 2P", monospace';

// ── DEBUG ────────────────────────────────────────────────────────────────────
// Metti false per saltare il loader e andare subito alla schermata titolo
const SHOW_LOADER = false;
// ─────────────────────────────────────────────────────────────────────────────

// File audio (l'utente li carica in public/assets/audio/; se mancano: silenzio)
const AUDIO_FILES: [string, string][] = [
  // ── BGM (sottofondo persistente — tutto il gioco) ──
  ['bgm',        'assets/audio/bgm.mp3'],
  // ── FGM situazionali ──
  ['battle',     'assets/audio/battle.mp3'],
  ['melancholy', 'assets/audio/melancholy.mp3'],
  ['bike-run',   'assets/audio/bike-run.mp3'],   // minigioco runner BiciScene
  ['tension',    'assets/audio/tension.mp3'],     // quiz milionario AulaScene
  ['beerpong',   'assets/audio/beerpong.mp3'],    // minigioco beer pong
  ['dance',      'assets/audio/dance.mp3'],       // sequenza danza PartyScene
  ['party',      'assets/audio/party.mp3'],       // atmosfera festa PartyScene
  // ── SFX ──
  ['confirm',   'assets/audio/confirm.wav'],
  ['text',      'assets/audio/text.wav'],
  ['coin',     'assets/audio/coin.mp3'],
  ['hit',      'assets/audio/hit.wav'],
  ['step',     'assets/audio/step.wav'],
  ['teleport', 'assets/audio/teleport.wav'],
  ['warp',     'assets/audio/warp.wav'],
  ['scontro',  'assets/audio/scontro.wav'],
  ['fanfare',  'assets/audio/fanfare.mp3'],
];
// I principali protagonisti, mostrati nella schermata titolo
const CHAR_IDS = ['cece', 'bubi', 'trande', 'umberto'];

// ── Timing sequenza intro ────────────────────────────────────────────────────
const TITLE_SLAM_MS  = 380;
// "PREMI INVIO" appare subito dopo lo slam del titolo (~920ms)
const PRESS_START_MS = TITLE_SLAM_MS + 480 + 60;

// Colore burst all'impatto = colore maglia di ogni personaggio
const BURST_COLORS: Record<string, number> = {
  cece:    0xffdd44,
  bubi:    0x88dd66,
  trande:  0xffaa55,
  umberto: 0x6ab0ff,
};

// Due righe di testo sotto al nome — da personalizzare
const CHAR_SUBTITLES: Record<string, [string, string]> = {
  cece:    ['GRANDI MINNE', 'GRANDI RESPONSABILITÀ'],
  bubi:    ['PORCODIDDIO', 'UMBERTO TI AMMAZZO'],
  trande:  ['IL FILOSOFO', 'PARLA TROPPO'],
  umberto: ["IL RAGE BAITER", 'MIGLIORE AMICO DI BUBI'],
};

// Prologo (testi placeholder a tema: sostituibili con quelli originali)
const PROLOGUE_LINES = [
  '2020...\nIl mondo si fermò\nE con esso i nostri sogni più piccoli',
  'Le luci delle feste si spensero prima di accendersi',
  'Siamo diventati adulti nel silenzio delle nostre stanze\nsenza un rullino che ne conservasse traccia',
  'Niente feste.\nNiente video.\nNiente ricordi...',
  'Sei anni dopo,\nsiamo ancora qui a Tricase.\nUomini con un vuoto nel petto',
    'Cercando quel video del 18esimo che non è mai stato girato.\n\n Il pezzo mancante della nostra storia...',
];

export class BootScene extends Phaser.Scene {
  private startText!: Phaser.GameObjects.Text;
  private started = false;
  private startBlinkTimer: Phaser.Time.TimerEvent | null = null;
  // Riferimenti ai personaggi atterrati — usati dalla selezione personaggio
  private charRowSprites: Phaser.GameObjects.Sprite[] = [];
  private charRowLabels:  Phaser.GameObjects.Text[]   = [];
  // Easter egg: il sole di Tricase
  private sunsetImg?: Phaser.GameObjects.Image;
  private sunClicks = 0;
  private discoActive = false;

  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Schermata nera durante il vero caricamento delle risorse.
    // Su connessioni veloci dura pochi istanti; la cinematica vera è in create().
    const CW = this.scale.width;
    const CH = this.scale.height;

    const loadBg = this.add.rectangle(CW / 2, CH / 2, CW, CH, 0x000000).setDepth(9999);
    this.load.on('complete', () => { loadBg.destroy(); });

    // ── Asset ────────────────────────────────────────────────────────────────
    loadPortraits(this, CHAR_IDS);
    for (const [key, path] of AUDIO_FILES) {
      if (!this.cache.audio.exists(key)) this.load.audio(key, path);
    }
    this.load.on('loaderror', (file: { key: string; url: string }) => {
      console.warn(`[BootScene] asset non caricato: ${file.key} → ${file.url}`);
    });
  }

  create(): void {
    this.started = false;

    // Zoom e centratura camera
    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE);
    cam.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Lancia i layer di sistema una volta sola (scene parallele permanenti)
    if (!this.scene.isActive('SystemUIScene')) {
      this.scene.launch('SystemUIScene');
      this.scene.bringToTop('SystemUIScene');
    }
    if (!this.scene.isActive('MobileControlsScene')) {
      this.scene.launch('MobileControlsScene');
      this.scene.bringToTop('MobileControlsScene');
    }

    if (SHOW_LOADER) {
      this.runCinematicIntro(() => this.buildTitleScreen());
    } else {
      this.buildTitleScreen();
    }
  }

  /** Costruisce la schermata titolo — chiamata dal callback di runCinematicIntro(). */
  private buildTitleScreen(): void {
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.drawSunsetPiazza();
    this.setupSunEasterEgg();

    // Hint comandi di sistema (in alto a destra, discreto)
    this.add
      .text(GAME_WIDTH - 4, 4, 'P PAUSA · M AUDIO', {
        fontFamily: FONT,
        fontSize: '5px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setAlpha(0.55)
      .setDepth(210);

    // Titolo — slam, poi galleggia
    const title = this.add
      .text(GAME_WIDTH / 2, 48, 'I 18 ANNI\nRIMANDATI', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(1.6)
      .setDepth(200);
    title.setShadow(3, 3, '#ff7700', 0, true, true);

    this.time.delayedCall(TITLE_SLAM_MS, () => {
      this.tweens.add({
        targets: title,
        y: 72, alpha: 1, scale: 1,
        duration: 460,
        ease: 'Back.easeOut',
        easeParams: [2.8],
        onComplete: () => {
          this.tweens.add({
            targets: title,
            y: 76,
            duration: 1600, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
          });
        },
      });
    });

    // "PREMI INVIO"
    this.startText = this.add
      .text(GAME_WIDTH / 2, 136, 'PREMI INVIO PER INIZIARE', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffe14d',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(200);

    this.time.delayedCall(PRESS_START_MS, () => {
      this.tweens.add({
        targets: this.startText,
        alpha: 1,
        duration: 350,
        onComplete: () => {
          this.startBlinkTimer = this.time.addEvent({
            delay: 800,
            loop: true,
            callback: () => this.startText.setVisible(!this.startText.visible),
          });
        },
      });
    });

    // ── TEMP DEBUG: salti rapidi alle scene (F1–F9, in ordine di gioco) ──
    const debugJumps: [string, string, number, Record<string, unknown>?][] = [
      ['[F1] PIAZ',  'PiazzaScene', Phaser.Input.Keyboard.KeyCodes.F1],
      ['[F2] STR',   'StradaScene', Phaser.Input.Keyboard.KeyCodes.F2],
      ['[F3] AULA',  'AulaScene',   Phaser.Input.Keyboard.KeyCodes.F3],
      ['[F4] BICI',  'BiciScene',   Phaser.Input.Keyboard.KeyCodes.F4],
      ['[F5] FEST',  'PartyScene',  Phaser.Input.Keyboard.KeyCodes.F5],
      ['[F6] END',   'PartyScene',  Phaser.Input.Keyboard.KeyCodes.F6, { skipToEnd: true }],
      ['[F7] CECE',  'CeceScene',   Phaser.Input.Keyboard.KeyCodes.F7, { skipToCamera: true }],
      ['[F8] DANCE', 'PartyScene',  Phaser.Input.Keyboard.KeyCodes.F8, { skipToDance: true }],
      ['[F9] POSTPIP','CeceScene',  Phaser.Input.Keyboard.KeyCodes.F9, { phase: 'after-pip' }],
    ];
    debugJumps.forEach(([label, sceneKey, keyCode, data], i) => {
      const jump = (): void => {
        this.started = true;
        AudioManager.get().playBgMusic(this, 'bgm', 0.3);
        TransitionSystem.fadeToScene(this, sceneKey, data);
      };
      const btn = this.add
        .text(4 + i * 66, GAME_HEIGHT - 4, label, {
          fontFamily: FONT,
          fontSize: '6px',
          color: '#66ff99',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0, 1)
        .setDepth(5000)
        .setInteractive({ useHandCursor: true });
      btn.on(
        'pointerdown',
        (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation();
          jump();
        }
      );
      this.input.keyboard?.addKey(keyCode).once('down', jump);
    });
    // ─────────────────────────────────────────────────────────────────────

    // Primo click/tasto → musica + personaggi entrano
    const begin = (): void => this.triggerEntrance();
    this.input.once('pointerdown', begin);
    const kb = this.input.keyboard;
    if (kb) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).once('down', begin);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).once('down', begin);
    }

    // Font Google potrebbe arrivare dopo il primo render
    document.fonts.ready.then(() => {
      this.children.list.forEach((c) => {
        if (c instanceof Phaser.GameObjects.Text) c.updateText();
      });
    });
  }

  // ─────────────────────────────────── easter egg: il sole di Tricase

  /**
   * Cliccando 3 volte il sole al tramonto parte il "disco mode":
   * cielo psichedelico, coriandoli e fanfara. Segreto persistente.
   */
  private setupSunEasterEgg(): void {
    const zone = this.add
      .zone(240, 186, 64, 64)
      .setOrigin(0.5)
      .setDepth(150)
      .setInteractive({ useHandCursor: false });

    zone.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        if (this.started) return; // dopo l'avvio il click serve al gioco
        e.stopPropagation();
        this.sunClicks++;
        AudioManager.get().playSFX(this, 'coin', 0.5);
        // feedback: piccolo burst sul sole a ogni click
        Juice.burst(this, 240, 186, [0xffd27a, 0xffe9b0], 8, 160);
        if (this.sunClicks >= 3 && !this.discoActive) this.startDiscoSun();
      }
    );
  }

  private startDiscoSun(): void {
    this.discoActive = true;
    const first = !Settings.data.sunFound;
    Settings.data.sunFound = true;
    Settings.save();

    AudioManager.get().playSFX(this, 'fanfare', 0.7);
    Juice.confetti(this, 140);
    Juice.toast(this, first ? 'SEGRETO SBLOCCATO: IL SOLE DI TRICASE' : 'IL SOLE BALLA ANCORA');
    this.cameras.main.shake(220, 0.004);

    // Cielo psichedelico: tinta che cicla per ~6 secondi, poi torna normale
    const hue = { t: 0 };
    this.tweens.add({
      targets: hue,
      t: 1,
      duration: 6000,
      onUpdate: () => {
        const c = Phaser.Display.Color.HSVToRGB((hue.t * 4) % 1, 0.45, 1) as Phaser.Display.Color;
        this.sunsetImg?.setTint(c.color);
      },
      onComplete: () => {
        this.sunsetImg?.clearTint();
        this.discoActive = false;
        this.sunClicks = 0;
      },
    });
  }

  // ──────────────────────────────────── intro cinematica di 10 secondi

  /**
   * Overlay nero che copre il titolo per TOTAL_MS ms.
   * La barra si riempie in base al tempo trascorso (non al vero caricamento).
   * Messaggi narrativi compaiono alle soglie percentuali, poi la % riprende.
   * Alla fine: fade di 2 s → titolo rivelato.
   * L'input è disabilitato per tutta la durata.
   */
  private runCinematicIntro(onDone: () => void): void {
    const TOTAL_MS = 17_000;
    const FADE_MS  =  2_000;
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const D = 90_000; // sopra tutto il titolo

    // Sfondo nero
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(D);

    // Barra di progresso
    const BAR_W = Math.round(W * 0.5);
    const barBg = this.add
      .rectangle(W / 2, H / 2 + 4, BAR_W, 3, 0x222222)
      .setDepth(D + 1);
    const bar = this.add
      .rectangle(W / 2 - BAR_W / 2, H / 2 + 4, 0, 3, 0xffdd44)
      .setOrigin(0, 0.5)
      .setDepth(D + 2);

    // Testo percentuale / messaggio — più distante dalla barra
    const txt = this.add
      .text(W / 2, H / 2 + 30, '0%', {
        fontFamily: FONT,
        fontSize: '6px',
        color: '#666666',
        align: 'center',
        lineSpacing: 5,
      })
      .setOrigin(0.5)
      .setDepth(D + 1);

    // Messaggi schedulati a tempi assoluti (ms dall'inizio).
    // Ogni % è visibile ≥ 1500 ms prima/dopo ogni messaggio.
    // Struttura: [startMs, testo]  — ogni messaggio dura MSG_DUR ms.
    const MSG_DUR = 1_600;
    const MSG_SCHEDULE: [number, string][] = [
      [ 3_000, 'Carico la mappa di Tricase...'],
      [ 7_700, 'Carico il sorrisetto di cece...'],
      [12_400, 'Carico la pandemia...'],
    ];
    //     0  –  3000 ms  →  %  0–18%   (3000 ms visibili)
    //  3000  –  4600 ms  →  messaggio 1
    //  4600  –  7700 ms  →  % 27–45%   (3100 ms visibili)
    //  7700  –  9300 ms  →  messaggio 2
    //  9300  – 12400 ms  →  % 55–73%   (3100 ms visibili)
    // 12400  – 14000 ms  →  messaggio 3
    // 14000  – 17000 ms  →  % 82–100%  (3000 ms visibili)

    // Blocca input per tutta la cinematica
    this.input.enabled = false;

    let showingMsg = false;
    const startMs  = Date.now();

    // Pianifica i messaggi con delayedCall assoluti
    MSG_SCHEDULE.forEach(([atMs, text]) => {
      this.time.delayedCall(atMs, () => {
        showingMsg = true;
        txt.setText(text).setColor('#dddddd');
      });
      // Reimposta la % dopo MSG_DUR ms (tranne per l'ultimo che sfuma con l'overlay)
      if (atMs + MSG_DUR < TOTAL_MS) {
        this.time.delayedCall(atMs + MSG_DUR, () => {
          showingMsg = false;
        });
      }
    });

    const tick = this.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        const v = Math.min((Date.now() - startMs) / TOTAL_MS, 1);
        bar.width = Math.round(BAR_W * v);
        if (!showingMsg) {
          txt.setText(`${Math.round(v * 100)}%`).setColor('#ffffff');
        }
      },
    });

    this.time.delayedCall(TOTAL_MS, () => {
      tick.remove();
      bar.width = BAR_W; // assicura 100% visivo

      // 1 secondo di pausa al 100%, poi compare il prompt con lampeggio lento
      this.time.delayedCall(1_000, () => {
        txt.setAlpha(0).setText('Clicca per continuare').setColor('#dddddd');
        this.tweens.add({
          targets: txt,
          alpha: 1,
          duration: 700,
          onComplete: () => {
            this.tweens.add({
              targets: txt,
              alpha: 0.1,
              duration: 900,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
          },
        });

        // Riabilita input e aspetta click / space / invio
        this.input.enabled = true;
        const proceed = (): void => {
          this.input.enabled = false;
          spaceKey.removeAllListeners();
          enterKey.removeAllListeners();
          AudioManager.get().playBgMusic(this, 'bgm', 0.3);
          const targets = [bg, barBg, bar, txt];
          this.tweens.add({
            targets,
            alpha: 0,
            duration: FADE_MS,
            onComplete: () => {
              targets.forEach(t => t.destroy());
              this.input.enabled = true;
              onDone();
            },
          });
        };
        const kb = this.input.keyboard;
        const spaceKey = kb!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        const enterKey = kb!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        spaceKey.once('down', proceed);
        enterKey.once('down', proceed);
        this.input.once('pointerdown', proceed);
      });
    });
  }

  // ──────────────────────────────────────── primo click: musica + personaggi

  private triggerEntrance(): void {
    if (this.started) return;
    this.started = true;
    this.startBlinkTimer?.remove();
    this.startBlinkTimer = null;
    this.startText.setAlpha(0).setVisible(true);
    AudioManager.get().playBgMusic(this, 'bgm', 0.3);
    this.showIntroCards();
  }

  // ─────────────────────────────────────── card cinematiche stile Pokemon/DBZ

  private showIntroCards(): void {
    const CARD_MS  = 3500;   // durata per personaggio (+2s rispetto al default)
    const GAP_MS   = 0;      // pausa tra card (le card si sovrappongono di 150ms di fade)
    const START_MS = 200;

    // Pre-genera tutte le texture
    CHAR_IDS.forEach(id => generateSpriteTexture(this, id, CHAR_CONFIGS[id]));

    // Velo scuro che copre il titolo durante la sequenza
    const veil = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0).setDepth(399).setAlpha(0);
    this.tweens.add({ targets: veil, alpha: 1, duration: 220 });

    // Mostra le card in sequenza
    CHAR_IDS.forEach((id, i) => {
      this.showOneCard(id, START_MS + i * (CARD_MS + GAP_MS), CARD_MS);
    });

    // Dopo tutte le card: personaggi nella riga + velo via + click 2
    const afterAll = START_MS + CHAR_IDS.length * (CARD_MS + GAP_MS) + 250;
    this.time.delayedCall(afterAll, () => {
      // Il velo svanisce subito; i personaggi atterrano a partire da 400ms
      this.tweens.add({
        targets: veil, alpha: 0, duration: 380,
        onComplete: () => veil.destroy(),
      });
      this.placeCharactersRow(400);  // Dragon Ball landing, 500ms gap tra personaggi

      // Dopo che tutti i personaggi sono atterrati → selezione personaggio
      // 4 chars × 500ms gap + 350ms drop + ~400ms effetti ≈ 2700ms
      this.time.delayedCall(2700, () => this.startCharacterSelection());
    });
  }

  /** Una singola card di presentazione personaggio. */
  private showOneCard(id: string, delay: number, duration: number): void {
    const color = BURST_COLORS[id] ?? 0xffffff;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const D   = 400; // base depth

    this.time.delayedCall(delay, () => {
      // ── SFX: fanfare di presentazione ────────────────────────────────────
      if (this.cache.audio.exists('fanfare')) {
        this.sound.play('fanfare', { volume: 0.5 });
      } else {
        this.sound.play('scontro', { volume: 0.4 });
      }

      // ── Sfondo colorato ──────────────────────────────────────────────────
      const bg = this.add
        .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, color)
        .setOrigin(0.5).setDepth(D).setAlpha(0);
      this.tweens.add({ targets: bg, alpha: 0.92, duration: 90 });

      // ── Raggi rotanti (sunburst) ──────────────────────────────────────────
      const rays = this.add.graphics().setDepth(D + 1).setAlpha(0);
      this.drawRays(rays, cx, cy, color);
      this.tweens.add({ targets: rays, alpha: 1, duration: 120 });
      this.tweens.add({
        targets: rays, angle: 360,
        duration: 7000, repeat: -1, ease: 'Linear',
      });

      // ── Sprite grande (entra da destra) ───────────────────────────────────
      const sprite = this.add
        .sprite(cx + GAME_WIDTH, cy + 14, `char-${id}`, 1)
        .setScale(CHAR_SCALE * 6).setDepth(D + 3);
      sprite.play(`${id}-idle-down`);
      this.time.delayedCall(70, () => {
        this.tweens.add({
          targets: sprite,
          x: cx + 44,
          duration: 260,
          ease: 'Back.easeOut',
          easeParams: [2.5],
        });
      });

      // ── Nome (entra da sinistra) ───────────────────────────────────────────
      const nameText = this.add
        .text(-120, cy - 22, id.toUpperCase(), {
          fontFamily: FONT,
          fontSize: '18px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 7,
        })
        .setOrigin(0, 0.5).setDepth(D + 3);
      this.time.delayedCall(90, () => {
        this.tweens.add({
          targets: nameText,
          x: 14,
          duration: 240,
          ease: 'Back.easeOut',
          easeParams: [2.5],
        });
      });

      // ── Flash bianco all'impatto ──────────────────────────────────────────
      const flash = this.add
        .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0xffffff)
        .setOrigin(0.5).setDepth(D + 4).setAlpha(0);
      this.time.delayedCall(200, () => {
        this.tweens.add({
          targets: flash, alpha: 0.7,
          duration: 45, yoyo: true, ease: 'Quad.easeOut',
          onComplete: () => flash.destroy(),
        });
      });

      // ── Sottotitoli (2 righe, ultima animazione) ──────────────────────────
      const [sub1Text, sub2Text] = CHAR_SUBTITLES[id] ?? ['', ''];
      const sub1 = this.add
        .text(-100, cy + 2, sub1Text, {
          fontFamily: FONT,
          fontSize: '8px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 5,
        })
        .setOrigin(0, 0.5).setDepth(D + 3).setAlpha(0);
      const sub2 = this.add
        .text(-100, cy + 14, sub2Text, {
          fontFamily: FONT,
          fontSize: '7px',
          color: '#ffffffbb',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0, 0.5).setDepth(D + 3).setAlpha(0);

      // Riga 1 entra a 420ms
      this.time.delayedCall(420, () => {
        sub1.setAlpha(1);
        this.tweens.add({
          targets: sub1, x: 14,
          duration: 200, ease: 'Back.easeOut', easeParams: [2.5],
        });
      });
      // Riga 2 entra a 560ms
      this.time.delayedCall(560, () => {
        sub2.setAlpha(1);
        this.tweens.add({
          targets: sub2, x: 14,
          duration: 200, ease: 'Back.easeOut', easeParams: [2.5],
        });
      });

      // ── Cleanup (fade out alla fine della card) ───────────────────────────
      this.time.delayedCall(duration - 160, () => {
        [bg, rays, sprite, nameText, sub1, sub2].forEach(obj =>
          this.tweens.add({
            targets: obj, alpha: 0, duration: 140,
            onComplete: () => obj.destroy(),
          })
        );
      });
    });
  }

  /** Sunburst di raggi triangolari alternati (chiaro/scuro). */
  private drawRays(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    color: number
  ): void {
    const N = 16;
    const R = 220;
    const c = Phaser.Display.Color.ValueToColor(color);
    const lighter = Phaser.Display.Color.GetColor(
      Math.min(255, c.red + 70),
      Math.min(255, c.green + 70),
      Math.min(255, c.blue + 70)
    );
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const spread = Math.PI / N;
      g.fillStyle(i % 2 === 0 ? 0xffffff : lighter, i % 2 === 0 ? 0.22 : 0.38);
      g.fillTriangle(
        cx, cy,
        cx + Math.cos(a - spread) * R, cy + Math.sin(a - spread) * R,
        cx + Math.cos(a + spread) * R, cy + Math.sin(a + spread) * R
      );
    }
  }

  /**
   * Posiziona i personaggi nella riga del titolo con animazione Dragon Ball:
   * ogni personaggio cade dall'alto, atterra con impatto colorato, uno dopo l'altro.
   * @param startDelay ms di attesa prima di iniziare la sequenza (default 0)
   */
  private placeCharactersRow(startDelay = 0): void {
    const step    = GAME_WIDTH / (CHAR_IDS.length + 1);
    const FINAL_Y = 216;
    const GAP     = 500; // ms tra un personaggio e il prossimo

    // Reset array per evitare residui da chiamate precedenti
    this.charRowSprites = [];
    this.charRowLabels  = [];

    CHAR_IDS.forEach((id, i) => {
      const x     = Math.round(step * (i + 1));
      const color = BURST_COLORS[id] ?? 0xffffff;

      this.time.delayedCall(startDelay + i * GAP, () => {
        // ── Ombra (inizialmente invisibile) ──────────────────────────────────
        const shadow = addShadow(this, x, FINAL_Y).setAlpha(0);

        // ── Sprite parte da sopra lo schermo ─────────────────────────────────
        const sprite = this.add
          .sprite(x, -50, `char-${id}`, 1)
          .setScale(CHAR_SCALE)
          .setDepth(FINAL_Y);
        sprite.play(`${id}-idle-down`);
        this.charRowSprites[i] = sprite; // ← salvato per la selezione

        // ── Label (compare all'impatto) ───────────────────────────────────────
        const label = this.add
          .text(x, FINAL_Y + 19, id.toUpperCase(), {
            fontFamily: FONT,
            fontSize: '6px',
            color: SPEAKER_COLORS[id] ?? '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
          })
          .setOrigin(0.5, 0)
          .setAlpha(0)
          .setDepth(FINAL_Y + 2);

        // ── Caduta rapida (stile DBZ) ─────────────────────────────────────────
        this.tweens.add({
          targets: sprite,
          y: FINAL_Y,
          duration: 350,
          ease: 'Quad.easeIn',
          onComplete: () => {
            // SFX: impatto atterraggio
            this.sound.play('hit', { volume: 0.55 });
            // Camera shake
            this.cameras.main.shake(110, 0.003);

            // Ombra appare
            this.tweens.add({ targets: shadow, alpha: 0.3, duration: 130 });

            // Flash colorato full-screen
            const flash = this.add
              .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color)
              .setOrigin(0.5)
              .setDepth(500)
              .setAlpha(0.32);
            this.tweens.add({
              targets: flash, alpha: 0,
              duration: 210, ease: 'Quad.easeOut',
              onComplete: () => flash.destroy(),
            });

            // Anello d'impatto orizzontale
            const ring = this.add.graphics().setDepth(400);
            ring.lineStyle(2, color, 1);
            ring.strokeEllipse(0, 0, 8, 4);
            ring.setPosition(x, FINAL_Y + 12);
            this.tweens.add({
              targets: ring,
              scaleX: 7, scaleY: 3.5,
              alpha: 0,
              duration: 300, ease: 'Quad.easeOut',
              onComplete: () => ring.destroy(),
            });

            // Polvere — 6 particelle che volano lateralmente
            for (let p = 0; p < 6; p++) {
              const dust = this.add.graphics().setDepth(399);
              dust.fillStyle(color, 0.85);
              dust.fillCircle(0, 0, Phaser.Math.Between(2, 4));
              dust.setPosition(x, FINAL_Y + 12);
              const side = p % 2 === 0 ? 1 : -1;
              const tx   = x + side * Phaser.Math.Between(16, 34) + Phaser.Math.Between(-6, 6);
              const ty   = FINAL_Y + Phaser.Math.Between(4, 16);
              this.tweens.add({
                targets: dust,
                x: tx, y: ty,
                alpha: 0,
                scaleX: 0.2, scaleY: 0.2,
                duration: 250 + p * 30,
                ease: 'Quad.easeOut',
                onComplete: () => dust.destroy(),
              });
            }

            // Label compare dopo 80ms
            this.charRowLabels[i] = label; // ← salvato per la selezione
            this.time.delayedCall(80, () => {
              this.tweens.add({ targets: label, alpha: 1, duration: 200 });
            });
          },
        });
      });
    });
  }

  // ──────────────────────────────────────────────── selezione personaggio (gag)

  /**
   * Mostra "SELEZIONA IL TUO PERSONAGGIO" con navigazione frecce.
   * A prescindere da chi viene scelto, porta alla schermata fake-choice.
   */
  private startCharacterSelection(): void {
    const FINAL_Y = 216;
    const step    = GAME_WIDTH / (CHAR_IDS.length + 1);
    let selIdx    = 0;

    // Prompt in basso
    this.startText
      .setText('< SELEZIONA IL TUO PERSONAGGIO >')
      .setFontSize('6px')
      .setPosition(GAME_WIDTH / 2, FINAL_Y + 42)
      .setAlpha(0)
      .setVisible(true);
    this.tweens.add({ targets: this.startText, alpha: 1, duration: 350 });

    // Sfera sfumata sotto il personaggio selezionato
    const glow = this.add.graphics().setDepth(190);
    let glowTween:  Phaser.Tweens.Tween | null = null;
    let riseTween:  Phaser.Tweens.Tween | null = null;
    let floatTween: Phaser.Tweens.Tween | null = null;

    const getX = (idx: number): number => Math.round(step * (idx + 1));

    const drawGlow = (idx: number): void => {
      const color = BURST_COLORS[CHAR_IDS[idx]] ?? 0xffffff;
      const gx = getX(idx);
      const gy = FINAL_Y + 12;
      glow.clear();
      glow.fillStyle(color, 0.10); glow.fillEllipse(gx, gy, 56, 18);
      glow.fillStyle(color, 0.30); glow.fillEllipse(gx, gy, 34, 11);
      glow.fillStyle(color, 0.60); glow.fillEllipse(gx, gy, 18,  7);
    };

    const applySelection = (newIdx: number, prevIdx: number): void => {
      // Riporta il precedente a FINAL_Y e interrompe animazioni
      if (newIdx !== prevIdx) {
        const prevSpr = this.charRowSprites[prevIdx];
        const prevLbl = this.charRowLabels[prevIdx];
        if (floatTween) { floatTween.remove(); floatTween = null; }
        if (riseTween)  { riseTween.remove();  riseTween  = null; }
        if (prevSpr) this.tweens.add({ targets: [prevSpr, prevLbl], y: (t: Phaser.GameObjects.GameObject) =>
          t === prevSpr ? FINAL_Y : FINAL_Y + 19, duration: 180, ease: 'Quad.easeOut' });
        if (glowTween)  { glowTween.remove();  glowTween  = null; }
      }

      // Alza il nuovo personaggio + fluttuazione
      const spr = this.charRowSprites[newIdx];
      const lbl = this.charRowLabels[newIdx];
      if (spr) {
        riseTween = this.tweens.add({
          targets: spr, y: FINAL_Y - 10, duration: 220, ease: 'Quad.easeOut',
          onComplete: () => {
            floatTween = this.tweens.add({
              targets: spr, y: FINAL_Y - 14,
              duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
          },
        });
      }
      if (lbl) {
        this.tweens.add({ targets: lbl, y: FINAL_Y + 9, duration: 220, ease: 'Quad.easeOut' });
      }

      // Aggiorna e pulsa la sfera
      drawGlow(newIdx);
      glowTween = this.tweens.add({
        targets: glow, alpha: 0.45,
        duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    };

    // Selezione iniziale (indice 0)
    applySelection(0, 0);

    // Listener tastiera
    const kb = this.input.keyboard;
    if (!kb) return;

    const leftKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const rightKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    const enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    const onLeft = (): void => {
      const prev = selIdx;
      selIdx = (selIdx - 1 + CHAR_IDS.length) % CHAR_IDS.length;
      applySelection(selIdx, prev);
    };
    const onRight = (): void => {
      const prev = selIdx;
      selIdx = (selIdx + 1) % CHAR_IDS.length;
      applySelection(selIdx, prev);
    };
    const onEnter = (): void => {
      leftKey.off('down', onLeft);
      rightKey.off('down', onRight);
      if (floatTween) { floatTween.remove(); }
      if (riseTween)  { riseTween.remove();  }
      if (glowTween)  { glowTween.remove();  }
      glow.destroy();
      this.startText.setVisible(false);
      this.showFakeChoiceScreen();
    };

    leftKey.on('down', onLeft);
    rightKey.on('down', onRight);
    enterKey.once('down', onEnter);
  }

  /** Schermata nera con il punchline, poi avvia il prologo. */
  private showFakeChoiceScreen(): void {
    const overlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0).setDepth(5000).setAlpha(0);

    this.tweens.add({
      targets: overlay, alpha: 1, duration: 600,
      onComplete: () => {
        const txt = this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'non scegli tu\ncon chi iniziare.', {
            fontFamily: FONT, fontSize: '8px', color: '#dddddd',
            align: 'center', lineSpacing: 8,
          })
          .setOrigin(0.5).setDepth(5001).setAlpha(0);

        this.tweens.add({
          targets: txt, alpha: 1, duration: 500,
          onComplete: () => {
            this.time.delayedCall(4_000, () => {
              // Fade-out solo il testo; l'overlay resta nero così non si vede la title screen
              this.tweens.add({
                targets: txt, alpha: 0, duration: 400,
                onComplete: () => {
                  txt.destroy();
                  AudioManager.get().playBgMusic(this, 'melancholy', 0.35);
                  this.beginPrologue();
                  // Distrugge l'overlay fake-choice dopo che il prologue ha alzato il suo
                  this.time.delayedCall(700, () => overlay.destroy());
                },
              });
            });
          },
        });
      },
    });
  }

  // ──────────────────────────────────────────────────────────────── prologo

  private beginPrologue(): void {
    this.startText.setText('');

    // Overlay nero sopra il titolo
    const overlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0)
      .setDepth(3000)
      .setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 600 });

    const text = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#dddddd',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5)
      .setDepth(3001);
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 22, 'click per continuare', {
        fontFamily: FONT,
        fontSize: '6px',
        color: '#555555',
      })
      .setOrigin(0.5)
      .setDepth(3001)
      .setVisible(false);

    let lineIndex = 0;
    let charIndex = 0;
    let typing = false;
    let timer: Phaser.Time.TimerEvent | undefined;

    const typeLine = (): void => {
      const line = PROLOGUE_LINES[lineIndex];
      charIndex = 0;
      typing = true;
      hint.setVisible(false);
      text.setText('');
      timer?.remove();
      timer = this.time.addEvent({
        delay: 35,
        repeat: line.length - 1,
        callback: () => {
          charIndex++;
          text.setText(line.slice(0, charIndex));
          if (charIndex >= line.length) {
            typing = false;
            hint.setVisible(true);
          }
        },
      });
    };

    const advance = (): void => {
      if (typing) {
        // completa subito la riga
        timer?.remove();
        typing = false;
        text.setText(PROLOGUE_LINES[lineIndex]);
        hint.setVisible(true);
        return;
      }
      lineIndex++;
      if (lineIndex < PROLOGUE_LINES.length) {
        typeLine();
      } else {
        // Rimuovi tutti i listener di input per evitare avanzamenti extra
        this.input.off('pointerdown', advance);
        const kbEnd = this.input.keyboard;
        if (kbEnd) {
          kbEnd.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).removeAllListeners('down');
          kbEnd.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).removeAllListeners('down');
        }
        // Sfuma testo verso il nero in 700ms, poi 3s di nero, poi PiazzaScene
        hint.setVisible(false);
        this.tweens.add({
          targets: text, alpha: 0, duration: 700,
          onComplete: () => {
            AudioManager.get().playBgMusic(this, 'melancholy', 0);
            this.time.delayedCall(3000, () => {
              this.scene.start('PiazzaScene');
            });
          },
        });
      }
    };

    // attende il fade (600ms) + 2s di nero prima di iniziare a scrivere
    this.time.delayedCall(2600, () => {
      typeLine();
      this.input.on('pointerdown', advance);
      const kb = this.input.keyboard;
      if (kb) {
        kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', advance);
        kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', advance);
      }
    });
  }

  // ------------------------------------------------------------ sfondo

  private drawSunsetPiazza(): void {
    const g = this.make.graphics();
    const HORIZON = 192;

    // Cielo al tramonto: viola → rosa → arancio caldo (36 step = no banding)
    const stops = [0x3a2354, 0xc45a6e, 0xf2a04a];
    const steps = 36;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const seg = t < 0.5 ? 0 : 1;
      const local = (t - seg * 0.5) * 2;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(stops[seg]),
        Phaser.Display.Color.ValueToColor(stops[seg + 1]),
        100,
        Math.round(local * 100)
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(0, (HORIZON / steps) * i, GAME_WIDTH, HORIZON / steps + 1);
    }

    // Sole basso all'orizzonte
    g.fillStyle(0xffe9b0, 0.4);
    g.fillCircle(240, 186, 42);
    g.fillStyle(0xffd27a, 0.95);
    g.fillCircle(240, 186, 28);

    // Raggi solari crepuscolari (8 fasci triangolari, coperti dalla silhouette in basso)
    g.fillStyle(0xffcc55, 0.20);
    for (let a = 0; a < 8; a++) {
      const mid  = (a / 8) * Math.PI * 2;
      const half = Math.PI / 20;
      const r1 = 31, r2 = 60, cx = 240, cy = 186;
      g.fillTriangle(
        cx + Math.cos(mid - half) * r1, cy + Math.sin(mid - half) * r1,
        cx + Math.cos(mid + half) * r1, cy + Math.sin(mid + half) * r1,
        cx + Math.cos(mid) * r2,        cy + Math.sin(mid) * r2,
      );
    }

    // Silhouette della piazza (color prugna scuro)
    const SIL = 0x241430;
    g.fillStyle(SIL);
    // terra
    g.fillRect(0, HORIZON, GAME_WIDTH, GAME_HEIGHT - HORIZON);
    // skyline di case ai lati
    g.fillRect(0, 150, 56, 42);
    g.fillRect(20, 138, 60, 54);
    g.fillRect(404, 144, 76, 48);
    g.fillRect(436, 132, 44, 60);
    // chiesa al centro (facciata + timpano + croce)
    g.fillRect(204, 116, 72, 76);
    g.fillTriangle(198, 120, 282, 120, 240, 92);
    g.fillRect(238, 76, 4, 14);
    g.fillRect(233, 80, 14, 4);
    // alberi
    for (const tx of [120, 360]) {
      g.fillRect(tx - 3, 174, 6, 18);
      g.fillCircle(tx, 168, 13);
      g.fillCircle(tx, 158, 9);
    }
    // lampioni
    for (const lx of [165, 315]) {
      g.fillRect(lx - 1, 162, 3, 30);
      g.fillCircle(lx, 161, 3);
    }
    // finestrelle accese sulle case
    g.fillStyle(0xffc966, 0.85);
    for (const [wx, wy] of [
      [12, 158],
      [38, 150],
      [60, 162],
      [420, 156],
      [452, 144],
      [464, 168],
    ]) {
      g.fillRect(wx, wy, 5, 6);
    }

    // pre-render in texture: lo sfondo statico non viene ridisegnato ogni frame
    if (!this.textures.exists('tex-boot-sunset')) {
      g.generateTexture('tex-boot-sunset', GAME_WIDTH, GAME_HEIGHT);
    }
    g.destroy();
    this.sunsetImg = this.add.image(0, 0, 'tex-boot-sunset').setOrigin(0).setDepth(-10);

    // Coriandoli che cadono (la festa che non c'è mai stata)
    const confettiColors = [0xff5566, 0x55aaff, 0xffdd55, 0xaa66ff, 0x66dd88, 0xff88cc];
    for (let i = 0; i < 22; i++) {
      const piece = this.add.rectangle(
        Phaser.Math.Between(4, GAME_WIDTH - 4),
        Phaser.Math.Between(-260, -8),
        2,
        3,
        confettiColors[i % confettiColors.length]
      );
      piece.setDepth(-5).setAngle(Phaser.Math.Between(0, 90));
      this.tweens.add({
        targets: piece,
        y: GAME_HEIGHT + 10,
        x: piece.x + Phaser.Math.Between(-25, 25),
        angle: piece.angle + Phaser.Math.Between(180, 540),
        duration: Phaser.Math.Between(7000, 12000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 5000),
      });
    }

    // Palloncini che salgono lenti
    const balloonColors = [0xff5566, 0xffdd55, 0x55aaff, 0xaa66ff];
    balloonColors.forEach((color, i) => {
      const b = this.add.graphics().setDepth(-4);
      b.lineStyle(1, 0xeeeeee, 0.6);
      b.lineBetween(0, 8, 0, 22);
      b.fillStyle(color, 0.95);
      b.fillEllipse(0, 0, 12, 15);
      b.setPosition(60 + i * 120 + Phaser.Math.Between(-20, 20), GAME_HEIGHT + 30);
      this.tweens.add({
        targets: b,
        y: -40,
        x: b.x + Phaser.Math.Between(-30, 30),
        duration: Phaser.Math.Between(9000, 14000),
        repeat: -1,
        delay: i * 2600,
      });
      this.tweens.add({
        targets: b,
        angle: 7,
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

}

