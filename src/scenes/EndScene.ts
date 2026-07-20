import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { TransitionSystem } from '../systems/TransitionSystem';
import { AudioManager } from '../systems/AudioManager';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const FONT = '"Press Start 2P", monospace';

/**
 * Finale: sfondo bianco stile Christopher Nolan.
 * Ogni sezione avanza con un click / Spazio / Enter.
 * Le righe di ogni blocco compaiono in cascata, una sotto l'altra.
 */
export class EndScene extends Phaser.Scene {
  constructor() {
    super('EndScene');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(2);
    cam.centerOn(W / 2, H / 2);

    // Sfondo bianco generoso: W×4 / H×4 copre qualsiasi offset camera
    this.add.rectangle(W / 2, H / 2, W * 4, H * 4, 0xffffff).setDepth(0);

    AudioManager.get().playMusic(this, 'melancholy', 0.7);

    void this.rollCredits();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  /** Aspetta il prossimo click, Spazio o Enter. */
  private waitForClick(): Promise<void> {
    return new Promise(resolve => {
      const done = () => {
        this.input.off('pointerdown', done);
        this.input.keyboard?.off('keydown-SPACE', done);
        this.input.keyboard?.off('keydown-ENTER', done);
        resolve();
      };
      this.input.once('pointerdown', done);
      this.input.keyboard?.once('keydown-SPACE', done);
      this.input.keyboard?.once('keydown-ENTER', done);
    });
  }

  private fadeIn(
    targets: Phaser.GameObjects.Text | Phaser.GameObjects.Text[],
    duration: number,
  ): Promise<void> {
    return new Promise(resolve =>
      this.tweens.add({ targets, alpha: 1, duration, ease: 'Sine.easeIn', onComplete: () => resolve() })
    );
  }

  private fadeOut(
    targets: Phaser.GameObjects.Text | Phaser.GameObjects.Text[],
    duration: number,
  ): Promise<void> {
    return new Promise(resolve =>
      this.tweens.add({ targets, alpha: 0, duration, ease: 'Sine.easeOut', onComplete: () => resolve() })
    );
  }

  // ─── Crediti ─────────────────────────────────────────────────────────────────

  private async rollCredits(): Promise<void> {
    // ─────────────────────────────────────────────────────────────────
    // TEMPISTICHE — modifica questi valori per regolare il ritmo
    // ─────────────────────────────────────────────────────────────────
    const T = {
      openingPause:     600,   // pausa iniziale prima che compaia il titolo

      titleFadeIn:     1400,   // ms per far apparire il titolo grande
      titleFadeOut:     700,

      subFadeIn:        900,
      subFadeOut:       600,
      subGap:           400,   // pausa dopo il sottotitolo sparisce

      blockFadeIn:      500,   // durata fade-in per ogni singola riga del blocco
      blockLinePause:   220,   // pausa tra l'inizio di una riga e la successiva
      blockFadeOut:     500,   // fade-out quando si clicca
      blockInternalGap: 250,   // breve pausa dopo il fade-out prima del blocco successivo
      blockBetweenGap:  150,   // pausa aggiuntiva tra blocchi

      copyrightFadeIn:  700,
      copyrightFadeOut: 600,

      finaleFadeIn:    1000,

      outroFade:       1400,   // dissolvenza finale → BootScene
    };
    // ─────────────────────────────────────────────────────────────────

    await this.delay(T.openingPause);

    // ── Titolo principale ─────────────────────────────────────────────
    const title = this.add
      .text(W / 2, H / 2 - 30, 'I 18 ANNI RIMANDATI', {
        fontFamily: FONT, fontSize: '13px', color: '#111111',
      })
      .setOrigin(0.5).setAlpha(0).setDepth(10);

    await this.fadeIn(title, T.titleFadeIn);
    await this.waitForClick();
    await this.fadeOut(title, T.titleFadeOut);

    // ── Sottotitolo ───────────────────────────────────────────────────
    const sub = this.add
      .text(W / 2, H / 2 - 10, 'Un sogno rinviato di sei anni.', {
        fontFamily: FONT, fontSize: '6px', color: '#444444',
      })
      .setOrigin(0.5).setAlpha(0).setDepth(10);

    await this.fadeIn(sub, T.subFadeIn);
    await this.waitForClick();
    await this.fadeOut(sub, T.subFadeOut);
    await this.delay(T.subGap);

    // ── Blocchi (ogni riga appare in cascata, click per avanzare) ─────
    await this.showBlock(
      'DEDICATO A',
      ['Umberto', 'Bubi', 'Trande', 'Cece'],
      '#222222', '#555555', T
    );
    await this.delay(T.blockBetweenGap);


    await this.showBlock(
      'CON LA PARTECIPAZIONE DI',
      ['Lerry', 'Cosimino', 'Guglielmo', 'Aniceto', 'Trande',
       'Cece', 'Chiara', 'Ilaria', 'Bea', 'Umberto', 'Bubi', 'Soccorritore in moto', 'Compagni di classe del liceo', 'Festaioli alla festa di Ilaria', 'Camilla', 'Fortiguerra', 'Le molise'],
      '#222222', '#555555', T,
      8   // prime 8 righe in colonna, le successive sparpagliate per lo schermo
    );
    await this.delay(T.blockBetweenGap);


    await this.showBlock(
      'UN GIOCO DI',
      ['Caprarica & Co'],
      '#222222', '#555555', T
    );
    await this.delay(T.blockBetweenGap);

    await this.showBlock(
      'ASSISTENZA TECNICA',
      ['Claude.AI - Sonnet 4.6', 'Anthropic'],
      '#222222', '#555555', T
    );
    await this.delay(T.blockBetweenGap);

    await this.showBlock(
      'UN GRAZIE SPECIALE A...',
      [
        'Loreta, per averci donato Cece',
        'Liceo G.Stampacchia e tutti i collaboratori scolastici',
        'Camilla per la sua compagnia',
        'Cosimino per le sue rrustute',
        'Ospedale Cardinale G. Panico per le degenze notturne',
        'Alessandra Marzo per i capelli',
        'Fortiguerra per la casa',
        '',
        'Al 2020... per non averci spezzati',
        'A voi, che ci siete ancora (Cece non centra niente)',
        'A chi questa serata se la meritava (Cece non se la meritava).',
      ],
      '#222222', '#555555', T
    );
    await this.delay(T.blockBetweenGap);

    await this.showBlock(
      'TUTTI I PERSONAGGI SONO ISPIRATI\nALLA LEGGENDA DI SE CAMPAMU',
      ['© 2026 — Tutti i diritti penso siano riservati'],
      '#222222', '#222222', T
    );
    await this.delay(T.blockBetweenGap);


    // ── Messaggio finale ──────────────────────────────────────────────
    const finale = this.add
      .text(W / 2, H / 2 - 6, 'GRAZIE PER AVER GIOCATO', {
        fontFamily: FONT, fontSize: '8px', color: '#111111',
      })
      .setOrigin(0.5).setAlpha(0).setDepth(10);

    await this.fadeIn(finale, T.finaleFadeIn);
    await this.waitForClick();

    // Ferma la FGM (melancholy) e ripristina BGM prima di tornare al titolo
    AudioManager.get().stopFgMusic(this, T.outroFade);
    TransitionSystem.fadeToScene(this, 'BootScene', undefined, T.outroFade);
  }

  // ─── Blocco con righe in cascata + click per avanzare ────────────────────────
  //
  // scatterAfter: le prime N righe appaiono in colonna centrata.
  //               Dalla riga N in poi appaiono in posizioni casuali nello schermo.
  //               Se omesso, tutte in colonna.

  private async showBlock(
    header: string,
    lines: string[],
    headerColor: string,
    lineColor: string,
    T: { blockFadeIn: number; blockLinePause: number; blockFadeOut: number; blockInternalGap: number },
    scatterAfter?: number,
  ): Promise<void> {
    // Calcola altezza solo per la parte in colonna
    const colCount     = scatterAfter !== undefined ? Math.min(lines.length, scatterAfter) : lines.length;
    const headerRows   = (header.match(/\n/g) ?? []).length + 1;  // righe effettive dell'header
    const headerH      = headerRows * 12;                          // 12px per riga (font 6px + interlinea)
    const totalH       = headerH + colCount * 11;
    let   startY       = H / 2 - totalH / 2;
    const objs: Phaser.GameObjects.Text[] = [];

    // Header
    const hdr = this.add
      .text(W / 2, startY, header, {
        fontFamily: FONT, fontSize: '6px', color: headerColor,
        lineSpacing: 7, align: 'center',
      })
      .setOrigin(0.5, 0).setAlpha(0).setDepth(10);
    objs.push(hdr);
    this.tweens.add({ targets: hdr, alpha: 1, duration: T.blockFadeIn, ease: 'Sine.easeIn' });
    await this.delay(T.blockLinePause);
    startY += headerH + 8;   // margine tra titolo e righe

    // Zona occupata dalla colonna (header + righe fisse) — le righe scatter la evitano
    // Margine orizzontale extra per coprire l'header che è più largo delle righe
    const colX1 = W / 2 - 145;
    const colX2 = W / 2 + 145;
    const colY1 = H / 2 - totalH / 2 - 10;
    const colY2 = H / 2 - totalH / 2 + totalH + 12;

    // ── Pre-genera gli slot scatter TUTTI prima dell'animazione ──────────────
    // Usa una verifica a "bounding box" approssimata: testi dello stesso range
    // di y devono avere almeno DX px di distanza orizzontale; verticalmente
    // DY py tra i centri. Con 400 tentativi trova sempre posto per ≤12 voci.
    const scatterCount = scatterAfter !== undefined
      ? Math.max(0, lines.length - scatterAfter) : 0;
    const scatterSlots: { x: number; y: number }[] = [];
    const DX = 120;  // separazione orizzontale minima (righe simili in y)
    const DY = 20;   // separazione verticale minima assoluta

    if (scatterCount > 0) {
      let att = 0;
      while (scatterSlots.length < scatterCount && att < 600) {
        att++;
        const tx2 = Phaser.Math.Between(75, W - 75);
        const ty2 = Phaser.Math.Between(24, H - 24);
        const inCol =
          tx2 > colX1 && tx2 < colX2 &&
          ty2 > colY1 && ty2 < colY2;
        const tooClose = scatterSlots.some(s => {
          const dvy = Math.abs(ty2 - s.y);
          const dvx = Math.abs(tx2 - s.x);
          return dvy < DY || (dvy < DY * 2.5 && dvx < DX);
        });
        if (!inCol && !tooClose) scatterSlots.push({ x: tx2, y: ty2 });
      }
    }
    let scatterIdx = 0;

    // Righe in cascata
    for (let i = 0; i < lines.length; i++) {
      const scattered = scatterAfter !== undefined && i >= scatterAfter;

      let tx: number, ty: number;
      if (scattered) {
        // Usa lo slot pre-generato (garantisce no-overlap)
        const slot = scatterSlots[scatterIdx++];
        tx = slot?.x ?? Phaser.Math.Between(75, W - 75);
        ty = slot?.y ?? Phaser.Math.Between(24, H - 24);
      } else {
        tx = W / 2;
        ty = startY;
        startY += 11;
      }

      const t = this.add
        .text(tx, ty, lines[i], { fontFamily: FONT, fontSize: '5px', color: lineColor })
        .setOrigin(0.5).setAlpha(0).setDepth(10);
      objs.push(t);
      this.tweens.add({ targets: t, alpha: 1, duration: T.blockFadeIn, ease: 'Sine.easeIn' });

      // Delay leggermente più lungo per le righe sparse (dà tempo di "vederle")
      await this.delay(scattered ? T.blockLinePause * 2 : T.blockLinePause);
    }

    // Aspetta che l'ultima riga sia completamente visibile, poi click
    await this.delay(T.blockFadeIn);
    await this.waitForClick();

    await this.fadeOut(objs, T.blockFadeOut);
    objs.forEach(o => o.destroy());
    await this.delay(T.blockInternalGap);
  }
}
