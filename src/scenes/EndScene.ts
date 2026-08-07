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

    // La canzone della scena in casa (finale) sfuma con una dissolvenza
    // all'inizio dei titoli; poi entra melancholy per i credits.
    AudioManager.get().fadeOutFgMusic(1600, () =>
      AudioManager.get().playMusic(this, 'melancholy', 0.7)
    );

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
      .text(W / 2, H / 2, 'I 18 ANNI RIMANDATI', {
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
       'Cece', 'Pietro', 'Chiara',  'Ilaria', 'Stefano', 'Loretta Goggi', 'Don Biagio','Giacomo', 'Alessandra Marzo', 'Zenzola', 'Bea', 'Umberto', 'Bubi', 'Soccorritore in moto', 'Compagni di classe del liceo', 'Festaioli alla festa di Ilaria', 'Camilla', 'Fortiguerra', 'Le molise', 'Grest Sant\'Antonio'],
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
      ['Claude.AI\nSonnet 4.6 - Opus 4.8 - Fable 5', 'Anthropic'],
      '#222222', '#555555', T
    );
    await this.delay(T.blockBetweenGap);

    await this.showBlock(
      'UN GRAZIE SPECIALE A...',
      [
        'Loreta, per averci donato Cece',
        'Liceo G.Stampacchia e tutti i collaboratori scolastici',
        'Camilla per la sua saggezza',
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

    // Invito a cliccare (lampeggiante) — chiarisce che si torna al titolo col click
    const hint = this.add
      .text(W / 2, H / 2 + 20, '– clicca per tornare all\'inizio –', {
        fontFamily: FONT, fontSize: '6px', color: '#555555',
      })
      .setOrigin(0.5).setAlpha(0).setDepth(10);
    await this.fadeIn(hint, 500);
    const blink = this.tweens.add({
      targets: hint, alpha: 0.3, duration: 550, yoyo: true, repeat: -1,
    });

    await this.waitForClick(); // il gioco finisce qui: si prosegue solo col click
    blink.remove();

    // Ferma la FGM (melancholy); poi si torna alla schermata iniziale
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

    // ── Zone già occupate (colonna + header): lo scatter le deve evitare ──────
    // Usiamo bounding-box REALI: dove c'è già una scritta non ne compare un'altra.
    const occupied: { x1: number; y1: number; x2: number; y2: number }[] = [];
    occupied.push({
      x1: W / 2 - 150, y1: H / 2 - totalH / 2 - 12,
      x2: W / 2 + 150, y2: H / 2 - totalH / 2 + totalH + 14,
    });
    {
      const hb = hdr.getBounds();
      occupied.push({ x1: hb.left - 6, y1: hb.top - 6, x2: hb.right + 6, y2: hb.bottom + 6 });
    }

    // Righe in cascata
    for (let i = 0; i < lines.length; i++) {
      const scattered = scatterAfter !== undefined && i >= scatterAfter;

      const t = this.add
        .text(0, 0, lines[i], {
          fontFamily: FONT, fontSize: '5px', color: lineColor,
          align: 'center', lineSpacing: 4, // righe multiple centrate e distanziate
        })
        .setOrigin(0.5).setAlpha(0).setDepth(10);

      if (scattered) {
        // Misura il testo e trova un posto il cui riquadro non tocchi nulla di già piazzato.
        const hw = t.width / 2 + 6;
        const hh = t.height / 2 + 5;
        const spot = this.findFreeSpot(occupied, hw, hh);
        t.setPosition(spot.x, spot.y);
        occupied.push({ x1: spot.x - hw, y1: spot.y - hh, x2: spot.x + hw, y2: spot.y + hh });
      } else {
        t.setPosition(W / 2, startY);
        occupied.push({
          x1: W / 2 - t.width / 2 - 4, y1: startY - 7,
          x2: W / 2 + t.width / 2 + 4, y2: startY + 7,
        });
        // Righe su più righe (con \n) occupano più spazio verticale
        const rows = (lines[i].match(/\n/g)?.length ?? 0) + 1;
        startY += rows > 1 ? t.height + 4 : 11;
      }

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

  /**
   * Restituisce una posizione (centro) il cui riquadro (hw×hh di semi-dimensioni)
   * non si sovrappone a NESSUNA zona già occupata. Prima prova a caso (aspetto
   * sparpagliato), poi scansiona a griglia per garantire sempre un posto libero.
   */
  private findFreeSpot(
    occupied: { x1: number; y1: number; x2: number; y2: number }[],
    hw: number,
    hh: number,
  ): { x: number; y: number } {
    const fits = (x: number, y: number): boolean => {
      const rx1 = x - hw, ry1 = y - hh, rx2 = x + hw, ry2 = y + hh;
      return !occupied.some(o => !(rx2 < o.x1 || rx1 > o.x2 || ry2 < o.y1 || ry1 > o.y2));
    };
    const minX = Math.ceil(hw) + 6, maxX = Math.max(Math.ceil(hw) + 6, W - Math.ceil(hw) - 6);
    const minY = Math.ceil(hh) + 6, maxY = Math.max(Math.ceil(hh) + 6, H - Math.ceil(hh) - 6);

    for (let att = 0; att < 500; att++) {
      const x = Phaser.Math.Between(minX, maxX);
      const y = Phaser.Math.Between(minY, maxY);
      if (fits(x, y)) return { x, y };
    }
    for (let y = minY; y <= maxY; y += 6) {
      for (let x = minX; x <= maxX; x += 8) {
        if (fits(x, y)) return { x, y };
      }
    }
    return { x: minX, y: minY };
  }
}
