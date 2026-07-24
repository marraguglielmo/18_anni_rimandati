import Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H, RENDER_SCALE } from '../config';
import { AudioManager } from './AudioManager';

const FONT = '"Press Start 2P", monospace';

/**
 * Lo zoom della camera è ancorato al centro del CANVAS (960x540), quindi
 * gli oggetti con scrollFactor(0) vanno spostati di questo offset per
 * apparire alle coordinate logiche di mondo (480x270).
 */
export const UI_OFF_X = (W * (RENDER_SCALE - 1)) / 2;
export const UI_OFF_Y = (H * (RENDER_SCALE - 1)) / 2;

/**
 * Transizioni di scena (solo visive).
 * La musica è gestita da AudioManager: ogni scena dichiara la sua traccia
 * in create() e il crossfade avviene automaticamente al cambio.
 */
export class TransitionSystem {
  // ------------------------------------------------------------ fade base

  /**
   * Da chiamare all'inizio di ogni scena: schermo nero → fade-in.
   * Imposta anche lo zoom 2x della camera (canvas a risoluzione doppia,
   * mondo invariato: le foto guadagnano pixel reali).
   */
  static fadeFromBlack(scene: Phaser.Scene, duration = 500): void {
    const cam = scene.cameras.main;
    cam.setZoom(RENDER_SCALE);
    cam.centerOn(W / 2, H / 2); // le camere con follow si riagganciano da sole
    cam.fadeIn(duration, 0, 0, 0);
  }

  /** Fade a nero, poi avvia la scena successiva. */
  static fadeToScene(
    scene: Phaser.Scene,
    nextKey: string,
    data?: object,
    duration = 500
  ): void {
    scene.cameras.main.fadeOut(duration, 0, 0, 0);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      scene.scene.start(nextKey, data);
    });
  }

  // ------------------------------------------------------- implosione bianca

  /**
   * Implosione su un punto (di solito Cece): particelle colorate dai bordi che
   * convergono, anelli colorati pulsanti, raggi rotanti, onde di glow, anelli
   * flash e infine un'onda d'urto bianca che riempie lo schermo (che RESTA
   * bianco). Il chiamante decide cosa fare dopo (scritta, cambio scena...).
   */
  static async implodeToWhite(scene: Phaser.Scene, cx: number, cy: number): Promise<void> {
    const delay = (ms: number): Promise<void> =>
      new Promise(r => scene.time.delayedCall(ms, () => r()));
    const COLORS = [0xff3366, 0x3399ff, 0xffdd33, 0x33ff88, 0xcc44ff, 0xff8833, 0xffcc00, 0x00ccff];
    const MARGIN = 16;
    const D = 9000;

    await delay(300);

    // ── Fase 0: scintille di anticipazione attorno al centro ──────────────
    for (let i = 0; i < 28; i++) {
      const g = scene.add.graphics().setDepth(D);
      const a = (i / 28) * Math.PI * 2;
      const dist = Phaser.Math.Between(8, 30);
      g.fillStyle(COLORS[i % COLORS.length], 1); g.fillRect(-1, -1, 3, 3);
      g.setPosition(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist);
      scene.tweens.add({
        targets: g, x: cx, y: cy, scaleX: 0.1, scaleY: 0.1, alpha: 0,
        duration: Phaser.Math.Between(260, 560), delay: i * 16,
        ease: 'Quad.easeIn', onComplete: () => g.destroy(),
      });
    }
    await delay(520);

    // ── Fase 1a: pixel colorati dai 4 bordi → centro ──────────────────────
    for (let i = 0; i < 220; i++) {
      const g = scene.add.graphics().setDepth(D + 2);
      const edge = i % 4;
      const sx = edge === 2 ? -MARGIN : edge === 3 ? W + MARGIN : Phaser.Math.Between(0, W);
      const sy = edge === 0 ? -MARGIN : edge === 1 ? H + MARGIN : Phaser.Math.Between(0, H);
      const sz = Phaser.Math.Between(3, 11);
      g.fillStyle(COLORS[i % COLORS.length], 1); g.fillRect(0, 0, sz, sz);
      g.setPosition(sx, sy);
      scene.tweens.add({
        targets: g, x: cx + Phaser.Math.Between(-5, 5), y: cy + Phaser.Math.Between(-5, 5),
        scaleX: 0.12, scaleY: 0.12, alpha: 0.9,
        duration: Phaser.Math.Between(950, 2000), delay: i * 9,
        ease: 'Quad.easeIn', onComplete: () => g.destroy(),
      });
    }
    // ── Fase 1b: particelle bianche da un anello attorno al centro ────────
    for (let i = 0; i < 90; i++) {
      const g = scene.add.graphics().setDepth(D + 1);
      const a = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(30, 110);
      const sz = Phaser.Math.Between(2, 6);
      g.fillStyle(0xffffff, 0.85); g.fillRect(0, 0, sz, sz);
      g.setPosition(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist);
      scene.tweens.add({
        targets: g, x: cx + Phaser.Math.Between(-4, 4), y: cy + Phaser.Math.Between(-4, 4),
        scaleX: 0.1, scaleY: 0.1, alpha: { from: 0, to: 0.8 },
        duration: Phaser.Math.Between(750, 1600), delay: i * 20 + 200,
        ease: 'Cubic.easeIn', onComplete: () => g.destroy(),
      });
    }
    // ── Fase 1c: raggi veloci dai 4 angoli ────────────────────────────────
    const corners: [number, number][] = [
      [-MARGIN, -MARGIN], [W + MARGIN, -MARGIN], [-MARGIN, H + MARGIN], [W + MARGIN, H + MARGIN],
    ];
    for (let i = 0; i < 44; i++) {
      const g = scene.add.graphics().setDepth(D + 3);
      const [sx, sy] = corners[i % 4];
      const sz = Phaser.Math.Between(4, 8);
      g.fillStyle(0xffffff, 1); g.fillRect(0, 0, sz, sz); g.setPosition(sx, sy);
      scene.tweens.add({
        targets: g, x: cx + Phaser.Math.Between(-8, 8), y: cy + Phaser.Math.Between(-8, 8),
        scaleX: 0.08, scaleY: 0.08, alpha: 0.95,
        duration: Phaser.Math.Between(520, 1150), delay: i * 26 + 100,
        ease: 'Expo.easeIn', onComplete: () => g.destroy(),
      });
    }

    // ── Fase 1.5 (dettaglio): anelli colorati che pulsano verso l'esterno ──
    for (let ring = 0; ring < 4; ring++) {
      scene.time.delayedCall(500 + ring * 560, () => {
        const rg = scene.add.graphics().setDepth(D + 1);
        const st = { r: 6, a: 0.6 };
        scene.tweens.add({
          targets: st, r: 62, a: 0, duration: 720, ease: 'Sine.easeOut',
          onUpdate: () => {
            rg.clear();
            rg.lineStyle(2, COLORS[(ring * 2) % COLORS.length], st.a);
            rg.strokeCircle(cx, cy, st.r);
          },
          onComplete: () => rg.destroy(),
        });
      });
    }

    // ── Fase 1.6 (dettaglio): raggi rotanti colorati che si accorciano ────
    const rays = scene.add.graphics().setDepth(D);
    const rayState = { t: 0 };
    scene.tweens.add({
      targets: rayState, t: 1, duration: 3200, ease: 'Sine.easeIn',
      onUpdate: () => {
        rays.clear();
        const ang0 = rayState.t * Math.PI * 4;
        const len = 95 * (1 - rayState.t);
        for (let k = 0; k < 8; k++) {
          const a = ang0 + (k / 8) * Math.PI * 2;
          rays.lineStyle(1, COLORS[k % COLORS.length], 0.35 * (1 - rayState.t));
          rays.lineBetween(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        }
      },
      onComplete: () => rays.destroy(),
    });

    await delay(3100);

    // ── Fase 2: 4 onde di glow pulsante al centro ─────────────────────────
    for (let wave = 0; wave < 4; wave++) {
      const glow = scene.add.graphics().setDepth(D + 5);
      const st = { r: 4, a: 0.95 };
      scene.tweens.add({
        targets: st, r: 26 + wave * 14, a: 0, duration: 380, ease: 'Sine.easeOut',
        onUpdate: () => { glow.clear(); glow.fillStyle(0xffffff, st.a); glow.fillCircle(cx, cy, st.r); },
        onComplete: () => glow.destroy(),
      });
      await delay(170);
    }
    await delay(150);

    // ── Fase 3: micro-shake + anelli flash rapidi ─────────────────────────
    scene.cameras.main.shake(260, 0.006);
    for (let r = 6; r <= 36; r += 6) {
      const ring = scene.add.graphics().setDepth(D + 6);
      ring.fillStyle(0xffffff, 1); ring.fillCircle(cx, cy, r);
      await delay(52);
      ring.destroy();
    }
    await delay(40);

    // ── Fase 4: onda d'urto bianca a schermo pieno (RESTA bianca) ─────────
    const shock = scene.add.graphics().setDepth(D + 7);
    await new Promise<void>(resolve => {
      const d = { r: 0 };
      scene.tweens.add({
        targets: d, r: 460, duration: 780, ease: 'Quad.easeIn',
        onUpdate: () => { shock.clear(); shock.fillStyle(0xffffff, 1); shock.fillCircle(cx, cy, d.r); },
        onComplete: () => {
          shock.clear(); shock.fillStyle(0xffffff, 1);
          shock.fillRect(-80, -80, W + 160, H + 160);
          resolve();
        },
      });
    });
  }

  // --------------------------------------------- varco spazio-temporale

  /**
   * Effetto "SCONTRO!" (da PiazzaScene → BattleScene):
   * shake crescente ~90 frame, scritta pulsante, flash intermittenti,
   * vignette nera che si chiude, flash bianco totale, cambio scena.
   */
  static async warpToScene(scene: Phaser.Scene, nextKey: string, data?: object): Promise<void> {
    const cam = scene.cameras.main;

    // Musica di battaglia: taglio netto, parte in sincronia con "SCONTRO!"
    AudioManager.get().playFgMusic(scene, 'battle', 0.85, 0);

    // Scritta "SCONTRO!" bianca pulsante con ombra arancione
    const label = scene.add
      .text(W / 2 + UI_OFF_X, H / 2 + UI_OFF_Y, 'SCONTRO!', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(5000);
    label.setShadow(3, 3, '#ff7700', 0, true, true);
    scene.tweens.add({ targets: label, scale: 1.25, duration: 180, yoyo: true, repeat: -1 });

    // Vignette nera che si stringe (disegnata in coordinate logiche)
    const vignette = scene.add
      .graphics({ x: UI_OFF_X, y: UI_OFF_Y })
      .setScrollFactor(0)
      .setDepth(4900);

    // ~2 secondi di build-up: 16 step da 125ms
    const steps = 16;
    const maxIntensity = 18 / W; // 18px sulla larghezza di 480
    for (let i = 1; i <= steps; i++) {
      cam.shake(150, (maxIntensity * i) / steps);
      if (i % 2 === 0) cam.flash(90, 255, 255, 255); // ogni ~15 frame
      const hole = 320 - (i * (320 - 80)) / steps; // raggio del buco: 320 → 80
      vignette.clear();
      vignette.lineStyle(420, 0x000000, 0.95);
      vignette.strokeCircle(W / 2, H / 2, hole + 210);
      await this.delay(scene, 125);
    }

    // Flash bianco totale
    const white = scene.add
      .rectangle(UI_OFF_X, UI_OFF_Y, W, H, 0xffffff)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(6000)
      .setAlpha(0);
    scene.tweens.add({ targets: white, alpha: 1, duration: 150 });
    await this.delay(scene, 350);

    scene.scene.start(nextKey, data);
  }

  // ------------------------------------------------------ teletrasporto

  /** Effetto teletrasporto + cambio scena. */
  static async teleportToScene(
    scene: Phaser.Scene,
    nextKey: string,
    data?: object
  ): Promise<void> {
    await this.teleportEffect(scene);
    scene.scene.start(nextKey, data);
  }

  /**
   * Solo l'effetto (per chi deve poi chiamare una callback invece di
   * cambiare scena, es. BattleScene → onComplete). Dura ~3.1s.
   *
   * Sequenza cinematografica in 6 fasi:
   * 1. CARICA      — il mondo si scurisce, energia risucchiata a spirale
   * 2. RISONANZA   — glitch cromatico, onde d'urto, archi elettrici
   * 3. CREPE       — lo schermo si crepa dal centro
   * 4. RISUCCHIO   — le schegge IMPLODONO nel punto di teletrasporto
   * 5. SINGOLARITÀ — un attimo di quiete: solo il nucleo che pulsa
   * 6. DETONAZIONE — triplo shockwave + esplosione di particelle + flash
   */
  static async teleportEffect(scene: Phaser.Scene): Promise<void> {
    AudioManager.get().playSFX(scene, 'teleport', 0.9);

    // coordinate logiche + offset UI per gli oggetti scrollFactor(0)
    const cx = W / 2 + UI_OFF_X;
    const cy = H / 2 + UI_OFF_Y;
    const cam = scene.cameras.main;
    const baseZoom = cam.zoom;
    this.ensureParticleTexture(scene);

    /** Onda d'urto: anello additivo che si espande e svanisce. */
    const shockwave = (delayMs: number, dur: number, color: number, maxScale: number): void => {
      scene.time.delayedCall(delayMs, () => {
        const ring = scene.add
          .circle(cx, cy, 14, 0x000000, 0)
          .setStrokeStyle(3, color, 0.95)
          .setScrollFactor(0)
          .setDepth(5940)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(0.15);
        scene.tweens.add({
          targets: ring,
          scale: maxScale,
          alpha: 0,
          duration: dur,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy(),
        });
      });
    };

    /** Orbe di energia che spiraleggiano verso il centro. */
    const spiralOrbs = (count: number, minDur: number, maxDur: number): void => {
      for (let i = 0; i < count; i++) {
        const a0 = Math.random() * Math.PI * 2;
        const r0 = Phaser.Math.Between(130, 230);
        const color = Phaser.Math.RND.pick([0x8800ff, 0xaa66ff, 0x66ffee, 0xffffff]);
        const orb = scene.add
          .circle(cx, cy, Phaser.Math.Between(1, 3), color)
          .setScrollFactor(0)
          .setDepth(5920)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0);
        const t = { p: 0 };
        scene.tweens.add({
          targets: t,
          p: 1,
          delay: Phaser.Math.Between(0, 240),
          duration: Phaser.Math.Between(minDur, maxDur),
          ease: 'Cubic.easeIn',
          onUpdate: () => {
            const r = r0 * (1 - t.p);
            const a = a0 + t.p * 4.5;
            orb.setPosition(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62);
            orb.setAlpha(Math.min(1, t.p * 2));
          },
          onComplete: () => orb.destroy(),
        });
      }
    };

    // ── 1. CARICA (750ms): veil scuro, zoom lento, energia a spirale ──────
    const veil = scene.add
      .rectangle(cx, cy, W, H, 0x0a0418)
      .setScrollFactor(0)
      .setDepth(5890)
      .setAlpha(0);
    scene.tweens.add({ targets: veil, alpha: 0.35, duration: 650 });
    cam.zoomTo(baseZoom * 1.06, 1100, 'Sine.easeIn');

    spiralOrbs(26, 480, 740);

    // Nucleo che si accende e pulsa
    const core = scene.add
      .circle(cx, cy, 2.5, 0xcc99ff)
      .setScrollFactor(0)
      .setDepth(5960)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    scene.tweens.add({ targets: core, alpha: 1, scale: 3, duration: 700, ease: 'Quad.easeIn' });

    // Archi elettrici che scattano attorno al nucleo (carica + risonanza)
    const arcs = scene.add
      .graphics({ x: UI_OFF_X, y: UI_OFF_Y })
      .setScrollFactor(0)
      .setDepth(5950)
      .setBlendMode(Phaser.BlendModes.ADD);
    const arcTimer = scene.time.addEvent({
      delay: 80,
      repeat: 15,
      callback: () => {
        arcs.clear();
        for (let b = 0; b < 3; b++) {
          const ang = Math.random() * Math.PI * 2;
          let r = 0;
          arcs.lineStyle(1.5, Math.random() < 0.5 ? 0x66ffee : 0xcc99ff, 0.9);
          arcs.beginPath();
          arcs.moveTo(W / 2, H / 2);
          while (r < 56) {
            r += Phaser.Math.Between(9, 16);
            const a2 = ang + Phaser.Math.FloatBetween(-0.5, 0.5);
            arcs.lineTo(W / 2 + Math.cos(a2) * r, H / 2 + Math.sin(a2) * r * 0.7);
          }
          arcs.strokePath();
        }
      },
    });
    await this.delay(scene, 750);

    // ── 2. RISONANZA (500ms): glitch cromatico + prime onde d'urto ────────
    const glitch = scene.add
      .graphics({ x: UI_OFF_X, y: UI_OFF_Y })
      .setScrollFactor(0)
      .setDepth(5900);
    scene.time.addEvent({
      delay: 55,
      repeat: 8,
      callback: () => {
        glitch.clear();
        for (let i = 0; i < 10; i++) {
          glitch.fillStyle(i % 2 === 0 ? 0x00ffee : 0xff00ff, 0.3);
          glitch.fillRect(
            Phaser.Math.Between(-24, 24),
            Phaser.Math.Between(0, H),
            W,
            Phaser.Math.Between(2, 6)
          );
        }
      },
    });
    cam.shake(500, 0.006);
    shockwave(0, 460, 0x8800ff, 8);
    shockwave(230, 460, 0x66ffee, 8);
    await this.delay(scene, 500);
    glitch.destroy();
    arcTimer.remove();
    arcs.destroy();

    // ── 3. CREPE (480ms): lo schermo si crepa dal centro ──────────────────
    const fcx = W / 2; // coordinate locali del graphics
    const fcy = H / 2;
    const crackPaths: { x: number; y: number }[][] = [];
    for (let i = 0; i < 10; i++) {
      const pts = [{ x: fcx, y: fcy }];
      let r = 0;
      let ang = (i / 10) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.25, 0.25);
      while (r < 350) {
        r += Phaser.Math.Between(20, 40);
        ang += Phaser.Math.FloatBetween(-0.35, 0.35);
        pts.push({ x: fcx + Math.cos(ang) * r, y: fcy + Math.sin(ang) * r * 0.7 });
      }
      crackPaths.push(pts);
    }
    const cracks = scene.add
      .graphics({ x: UI_OFF_X, y: UI_OFF_Y })
      .setScrollFactor(0)
      .setDepth(6050);
    const cp = { p: 0 };
    cam.shake(450, 0.009);
    scene.tweens.add({
      targets: cp,
      p: 1,
      duration: 450,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        cracks.clear();
        for (const pts of crackPaths) {
          const count = Math.max(2, Math.ceil(pts.length * cp.p));
          // alone ciano + linea bianca della crepa
          for (const [width, color, alpha] of [
            [4, 0x66ffee, 0.25],
            [2, 0xffffff, 0.95],
          ] as [number, number, number][]) {
            cracks.lineStyle(width, color, alpha);
            cracks.beginPath();
            cracks.moveTo(pts[0].x, pts[0].y);
            for (let k = 1; k < count; k++) cracks.lineTo(pts[k].x, pts[k].y);
            cracks.strokePath();
          }
        }
      },
    });
    await this.delay(scene, 480);

    // ── 4. RISUCCHIO (550ms): le schegge IMPLODONO nel nucleo ─────────────
    AudioManager.get().playSFX(scene, 'scontro', 0.5);
    cam.shake(450, 0.012);
    for (let i = 0; i < 18; i++) {
      const sx = Phaser.Math.Between(40, W - 40) + UI_OFF_X;
      const sy = Phaser.Math.Between(30, H - 30) + UI_OFF_Y;
      const size = Phaser.Math.Between(8, 24);
      const shard = scene.add.graphics({ x: sx, y: sy }).setScrollFactor(0).setDepth(6060);
      shard.fillStyle(Phaser.Math.RND.pick([0x8800ff, 0x66ffee, 0xffffff]), 0.45);
      shard.lineStyle(1, 0xffffff, 0.9);
      const a1 = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const a2 = a1 + Phaser.Math.FloatBetween(1.2, 2.4);
      const a3 = a2 + Phaser.Math.FloatBetween(1.2, 2.4);
      const tri: [number, number, number, number, number, number] = [
        Math.cos(a1) * size,
        Math.sin(a1) * size,
        Math.cos(a2) * size,
        Math.sin(a2) * size,
        Math.cos(a3) * size,
        Math.sin(a3) * size,
      ];
      shard.fillTriangle(...tri);
      shard.strokeTriangle(...tri);
      // risucchiate nel punto di teletrasporto, ruotando e rimpicciolendo
      scene.tweens.add({
        targets: shard,
        x: cx,
        y: cy,
        scale: 0,
        angle: Phaser.Math.Between(-540, 540),
        delay: Phaser.Math.Between(0, 140),
        duration: Phaser.Math.Between(340, 500),
        ease: 'Cubic.easeIn',
        onComplete: () => shard.destroy(),
      });
    }
    spiralOrbs(14, 300, 440); // seconda ondata di energia risucchiata
    // il nucleo ingoia tutto e cresce
    scene.tweens.add({ targets: core, scale: 6, duration: 520, ease: 'Quad.easeIn' });
    scene.tweens.add({ targets: veil, alpha: 0.55, duration: 520 });
    await this.delay(scene, 550);
    cracks.destroy();

    // ── 5. SINGOLARITÀ (300ms): quiete, solo il nucleo che vibra ──────────
    const haloRing = scene.add
      .circle(cx, cy, 16, 0x000000, 0)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setScrollFactor(0)
      .setDepth(6010)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: haloRing,
      scale: { from: 0.8, to: 1.15 },
      duration: 90,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: core,
      scale: 4.2,
      duration: 280,
      ease: 'Sine.easeInOut',
    });
    await this.delay(scene, 300);
    haloRing.destroy();

    // ── 6. DETONAZIONE: triplo shockwave + esplosione + flash ─────────────
    AudioManager.get().playSFX(scene, 'hit', 0.6);
    cam.shake(320, 0.014);
    cam.zoomTo(baseZoom, 240, 'Quad.easeOut');
    shockwave(0, 520, 0xffffff, 15);
    shockwave(70, 520, 0xaa66ff, 12);
    shockwave(140, 520, 0x66ffee, 10);
    const burst = scene.add
      .particles(cx, cy, 'fx-px', {
        speed: { min: 120, max: 420 },
        lifespan: { min: 300, max: 800 },
        scale: { start: 1.8, end: 0 },
        tint: [0x8800ff, 0xaa66ff, 0x66ffee, 0xffffff],
        emitting: false,
      })
      .setScrollFactor(0)
      .setDepth(6055);
    burst.explode(180);
    burst.explode(50, cx - 130, cy - 50);
    burst.explode(50, cx + 130, cy + 50);

    // Nucleo viola che esplode a coprire lo schermo
    const boom = scene.add
      .circle(cx, cy, 10, 0x8800ff)
      .setScrollFactor(0)
      .setDepth(6000)
      .setAlpha(0.95)
      .setScale(0);
    const halo = scene.add
      .circle(cx, cy, 10, 0xcc88ff)
      .setScrollFactor(0)
      .setDepth(5990)
      .setAlpha(0.5)
      .setScale(0);
    scene.tweens.add({ targets: halo, scale: 34, duration: 480, ease: 'Expo.easeIn' });
    await this.tweenP(scene, {
      targets: boom,
      scale: 30, // raggio finale 300px: copre i 480x270
      duration: 480,
      ease: 'Expo.easeIn',
    });

    // Flash bianco finale
    const white = scene.add
      .rectangle(UI_OFF_X, UI_OFF_Y, W, H, 0xffffff)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(6100)
      .setAlpha(0);
    await this.tweenP(scene, { targets: white, alpha: 1, duration: 280 });
    cam.setZoom(baseZoom); // ripristino esplicito per chi resta nella scena
  }

  /** Texture 4x4 bianca per le particelle delle transizioni. */
  private static ensureParticleTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('fx-px')) return;
    const g = scene.make.graphics();
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('fx-px', 4, 4);
    g.destroy();
  }

  // -------------------------------------------------- notifica area

  /**
   * Nome del luogo in alto al centro: fade-in 0.3s, 1.5s, fade-out 0.3s.
   * Es: "PIAZZA CAPPUCCINI – 2026"
   */
  static announceArea(scene: Phaser.Scene, text: string, holdDuration = 5000): void {
    const cx   = W / 2 + UI_OFF_X;
    const ty   = 14 + UI_OFF_Y;
    const PAD  = { x: 8, y: 4 };
    const DEPTH = 2500;

    // Testo (misuriamo le dimensioni prima di disegnare il box)
    const t = scene.add
      .text(cx, ty + PAD.y, text, {
        fontFamily: FONT,
        fontSize: '7px',
        color: '#f0e6c8',      // avorio caldo
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1)
      .setAlpha(0);

    // Box di sfondo (larghezza calcolata dal testo)
    const bw = t.width  + PAD.x * 2;
    const bh = t.height + PAD.y * 2;
    const bx = cx - bw / 2;

    const box = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setAlpha(0);
    // Sfondo scuro semi-trasparente
    box.fillStyle(0x0a0a14, 0.82);
    box.fillRect(bx, ty, bw, bh);
    // Bordo sottile oro/avorio
    box.lineStyle(1, 0xc8a86e, 0.9);
    box.strokeRect(bx, ty, bw, bh);
    // Lineetta decorativa sinistra e destra
    box.lineStyle(1, 0xc8a86e, 0.5);
    box.lineBetween(bx - 6, ty + bh / 2, bx - 2, ty + bh / 2);
    box.lineBetween(bx + bw + 2, ty + bh / 2, bx + bw + 6, ty + bh / 2);

    const targets = [box, t];
    scene.tweens.add({
      targets,
      alpha: 1,
      duration: 350,
      onComplete: () => {
        scene.time.delayedCall(holdDuration, () => {
          scene.tweens.add({
            targets,
            alpha: 0,
            duration: 350,
            onComplete: () => { t.destroy(); box.destroy(); },
          });
        });
      },
    });
  }

  // ------------------------------------------------------- stordimento

  /**
   * Stelline che girano sopra la testa + barcollamento: i personaggi sono
   * storditi dal salto temporale (senza rendersene conto).
   */
  static async dazedEffect(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.Sprite,
    duration = 1600
  ): Promise<void> {
    const orbit = scene.add.container(target.x, target.y - 16).setDepth(3000);
    const stars: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 3; i++) {
      const star = scene.add.circle(0, 0, 1.5, 0xffe14d);
      orbit.add(star);
      stars.push(star);
    }
    const counter = { a: 0 };
    scene.tweens.add({
      targets: counter,
      a: Math.PI * 4,
      duration,
      onUpdate: () => {
        stars.forEach((s, i) => {
          const ang = counter.a + (i * Math.PI * 2) / 3;
          s.setPosition(Math.cos(ang) * 8, Math.sin(ang) * 3);
        });
        orbit.setPosition(target.x, target.y - 16);
      },
    });
    // barcollamento
    scene.tweens.add({
      targets: target,
      angle: { from: -6, to: 6 },
      duration: 160,
      yoyo: true,
      repeat: Math.floor(duration / 320),
    });
    await this.delay(scene, duration);
    target.setAngle(0);
    scene.tweens.add({
      targets: orbit,
      alpha: 0,
      duration: 200,
      onComplete: () => orbit.destroy(),
    });
  }

  // ------------------------------------------------------------ util

  private static delay(scene: Phaser.Scene, ms: number): Promise<void> {
    return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
  }

  private static tweenP(
    scene: Phaser.Scene,
    config: Phaser.Types.Tweens.TweenBuilderConfig
  ): Promise<void> {
    return new Promise((resolve) => {
      scene.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}
