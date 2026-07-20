/**
 * MobileControlsScene — D-pad a croce + tasto Azione
 * ──────────────────────────────────────────────────────────────────────────────
 * Scena parallela permanente su dispositivi touch.
 * Dispatcha DOM KeyboardEvent su window → tutti i listener keyboard esistenti
 * funzionano senza modifiche.
 *
 * Canvas = 960×540 (GAME_WIDTH*2 × GAME_HEIGHT*2), nessuna camera zoom.
 */

import Phaser from 'phaser';

// ── KeyboardEvent helper ─────────────────────────────────────────────────────
const KC_MAP: Record<number, [string, string]> = {
  37: ['ArrowLeft',  'ArrowLeft'],
  38: ['ArrowUp',    'ArrowUp'],
  39: ['ArrowRight', 'ArrowRight'],
  40: ['ArrowDown',  'ArrowDown'],
  32: [' ',          'Space'],
};

function fireKey(type: 'keydown' | 'keyup', keyCode: number): void {
  const [key, code] = KC_MAP[keyCode] ?? [String.fromCharCode(keyCode), ''];
  window.dispatchEvent(
    new KeyboardEvent(type, { keyCode, which: keyCode, key, code, bubbles: true, cancelable: true }),
  );
}

// ── Definizione pulsante ─────────────────────────────────────────────────────
type DirId = 'up' | 'down' | 'left' | 'right' | 'action';

interface Btn {
  id: DirId;
  x: number;
  y: number;
  hw: number; // half-width  hit-box
  hh: number; // half-height hit-box
  keyCode: number;
}

export class MobileControlsScene extends Phaser.Scene {
  static readonly KEY = 'MobileControlsScene';

  private btns: Btn[] = [];
  private heldCount  = new Map<number, number>();   // keyCode → # dita
  private ptrToBtn   = new Map<number, Btn>();       // pointerId → btn

  private gBase!:    Phaser.GameObjects.Graphics;
  private gActive!:  Phaser.GameObjects.Graphics;

  constructor() { super({ key: MobileControlsScene.KEY }); }

  create(): void {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!hasTouch) return;

    this.input.addPointer(4);

    const W = this.scale.width;    // 960
    const H = this.scale.height;   // 540

    // ── D-pad: croce centrata in basso a sinistra ────────────────────────────
    const DX  = Math.round(W * 0.155);   // 149 — centro croce X
    const DY  = Math.round(H * 0.76);    // 411 — centro croce Y (30px più in alto)
    const SEG = Math.round(W * 0.065);   // 62  — dimensione segmento
    const PAD = 4;                        // gap tra segmenti (hit-box non si toccano)

    // ── Tasto Azione in basso a destra ──────────────────────────────────────
    const AX  = Math.round(W * 0.868);   // 833
    const AY  = DY;
    const AR  = Math.round(W * 0.058);   // 56 — raggio (più grande)

    this.btns = [
      { id: 'up',     x: DX,        y: DY - SEG,  hw: SEG - PAD, hh: SEG - PAD, keyCode: 38 },
      { id: 'down',   x: DX,        y: DY + SEG,  hw: SEG - PAD, hh: SEG - PAD, keyCode: 40 },
      { id: 'left',   x: DX - SEG,  y: DY,        hw: SEG - PAD, hh: SEG - PAD, keyCode: 37 },
      { id: 'right',  x: DX + SEG,  y: DY,        hw: SEG - PAD, hh: SEG - PAD, keyCode: 39 },
      { id: 'action', x: AX,        y: AY,        hw: AR,        hh: AR,        keyCode: 32 },
    ];

    this.gBase   = this.add.graphics().setDepth(9000);
    this.gActive = this.add.graphics().setDepth(9001);
    this.drawBase(SEG, AR, DX, DY);

    // Label solo sul tasto azione
    this.add.text(AX, AY, 'A', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(9002).setAlpha(0.9);

    // Label ▲ e ▼ (piccole, nel segmento su/giù)
    this.add.text(DX, DY - SEG, '▲', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(9002).setAlpha(0.7);
    this.add.text(DX, DY + SEG, '▼', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(9002).setAlpha(0.7);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup',   this.onUp,   this);
    this.input.on('pointerout',  this.onUp,   this);
  }

  // ─── Grafica base ────────────────────────────────────────────────────────
  private drawBase(SEG: number, AR: number, DX: number, DY: number): void {
    const g = this.gBase;
    g.clear();

    const ALPHA_BG   = 0.30;
    const ALPHA_LINE = 0.50;
    const R = 10; // corner radius

    // ── Croce D-pad (forma a + con angoli arrotondati) ───────────────────
    g.fillStyle(0xffffff, ALPHA_BG);

    // Barra orizzontale
    g.fillRoundedRect(DX - SEG * 1.5, DY - SEG * 0.5, SEG * 3, SEG, R);
    // Barra verticale (sovrapposta al centro → forma la croce)
    g.fillRoundedRect(DX - SEG * 0.5, DY - SEG * 1.5, SEG, SEG * 3, R);

    // Bordo croce
    g.lineStyle(2, 0xffffff, ALPHA_LINE);
    g.strokeRoundedRect(DX - SEG * 1.5, DY - SEG * 0.5, SEG * 3, SEG, R);
    g.strokeRoundedRect(DX - SEG * 0.5, DY - SEG * 1.5, SEG, SEG * 3, R);

    // ── Tasto Azione ─────────────────────────────────────────────────────
    const [ax, ay] = [this.btns[4].x, this.btns[4].y];
    g.fillStyle(0x44ff88, 0.22);
    g.fillCircle(ax, ay, AR);
    g.lineStyle(2.5, 0x44ff88, ALPHA_LINE);
    g.strokeCircle(ax, ay, AR);
  }

  // ─── Grafica stato premuto ───────────────────────────────────────────────
  private drawActive(): void {
    const g = this.gActive;
    g.clear();

    const SEG = this.btns[0].hw + 4; // ricava SEG dalla hit-box

    for (const btn of this.btns) {
      if ((this.heldCount.get(btn.keyCode) ?? 0) === 0) continue;

      if (btn.id === 'action') {
        g.fillStyle(0x44ff88, 0.45);
        g.fillCircle(btn.x, btn.y, btn.hw);
      } else {
        // Evidenzia solo il segmento premuto della croce
        const R = 10;
        g.fillStyle(0xffffff, 0.40);
        if (btn.id === 'up' || btn.id === 'down') {
          g.fillRoundedRect(btn.x - SEG * 0.5, btn.y - SEG * 0.5, SEG, SEG, R);
        } else {
          g.fillRoundedRect(btn.x - SEG * 0.5, btn.y - SEG * 0.5, SEG, SEG, R);
        }
      }
    }
  }

  // ─── Hit-test ─────────────────────────────────────────────────────────────
  private hitTest(px: number, py: number): Btn | null {
    for (const btn of this.btns) {
      if (btn.id === 'action') {
        // Cerchio
        const dx = px - btn.x, dy = py - btn.y;
        if (dx * dx + dy * dy <= btn.hw * btn.hw) return btn;
      } else {
        // Rettangolo
        if (
          px >= btn.x - btn.hw && px <= btn.x + btn.hw &&
          py >= btn.y - btn.hh && py <= btn.y + btn.hh
        ) return btn;
      }
    }
    return null;
  }

  // ─── Press / Release ─────────────────────────────────────────────────────
  private pressBtn(ptr: Phaser.Input.Pointer, btn: Btn): void {
    this.ptrToBtn.set(ptr.id, btn);
    const prev = this.heldCount.get(btn.keyCode) ?? 0;
    this.heldCount.set(btn.keyCode, prev + 1);
    if (prev === 0) fireKey('keydown', btn.keyCode);
    this.drawActive();
  }

  private releasePtr(ptr: Phaser.Input.Pointer): void {
    const btn = this.ptrToBtn.get(ptr.id);
    if (!btn) return;
    this.ptrToBtn.delete(ptr.id);
    const n = Math.max(0, (this.heldCount.get(btn.keyCode) ?? 1) - 1);
    this.heldCount.set(btn.keyCode, n);
    if (n === 0) fireKey('keyup', btn.keyCode);
    this.drawActive();
  }

  // ─── Handler ─────────────────────────────────────────────────────────────
  private onDown(ptr: Phaser.Input.Pointer): void {
    const btn = this.hitTest(ptr.x, ptr.y);
    if (btn) this.pressBtn(ptr, btn);
  }

  private onMove(ptr: Phaser.Input.Pointer): void {
    if (!ptr.isDown) return;
    const prev = this.ptrToBtn.get(ptr.id);
    const next = this.hitTest(ptr.x, ptr.y);
    if (prev === next) return;
    if (prev) this.releasePtr(ptr);
    if (next) this.pressBtn(ptr, next);
  }

  private onUp(ptr: Phaser.Input.Pointer): void {
    this.releasePtr(ptr);
  }
}
