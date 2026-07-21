import Phaser from 'phaser';

const FONT = '"Press Start 2P", monospace';
const BW = 200;
const BH = 30;

/**
 * Pannello OBIETTIVO condiviso tra le scene.
 *
 * Uso RPG (AulaScene / PartyScene):
 *   const hud = new QuestHUD(this, WORLD_W / 2 + UI_OFF_X, 15 + UI_OFF_Y).addMarker();
 *   hud.show('Parla con Trande');
 *   hud.moveMarker(npc.x, npc.y);
 *   hud.clear(); hud.hideMarker();
 *
 * Uso runner (BiciScene) — nessun marker world-space:
 *   const hud = new QuestHUD(this, GAME_WIDTH / 2, 20, 1);
 *   hud.show('Raccogli 20 monete');
 *   hud.clear();
 */
export class QuestHUD {
  private readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Text;
  private readonly brackets: Phaser.GameObjects.Graphics;
  private by: number;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private autoHideTimer: Phaser.Time.TimerEvent | null = null;
  private marker: Phaser.GameObjects.Text | null = null;
  private markerTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    _cx: number,
    by: number,
    scrollFactor = 0,
  ) {
    this.by = by;

    this.container = scene.add
      .container(_cx, by)
      .setScrollFactor(scrollFactor)
      .setDepth(800)
      .setAlpha(0);

    const ACCENT = 0xffdd44;
    const L = -BW / 2, R = BW / 2, T = -BH / 2, B = BH / 2;

    // Pannello scuro (niente cornice piena: la definiscono le staffe angolari)
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0a14, 0.9);
    bg.fillRoundedRect(L, T, BW, BH, 3);

    // Parentesi angolari stile menù JRPG (4 staffe a "L")
    const AL = 9;    // lunghezza braccio
    const TH = 2.5;  // spessore
    const brackets = scene.add.graphics();
    brackets.fillStyle(ACCENT, 1);
    brackets.fillRect(L, T, AL, TH);            brackets.fillRect(L, T, TH, AL);            // ↖
    brackets.fillRect(R - AL, T, AL, TH);       brackets.fillRect(R - TH, T, TH, AL);       // ↗
    brackets.fillRect(L, B - TH, AL, TH);       brackets.fillRect(L, B - AL, TH, AL);       // ↙
    brackets.fillRect(R - AL, B - TH, AL, TH);  brackets.fillRect(R - TH, B - AL, TH, AL);  // ↘
    this.brackets = brackets;

    const title = scene.add
      .text(0, -8, 'O B I E T T I V O', {
        fontFamily: FONT, fontSize: '5px', color: '#ffdd44',
        stroke: '#000000', strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5);

    this.body = scene.add
      .text(0, 6, '', {
        fontFamily: FONT, fontSize: '7px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 3, align: 'center',
      })
      .setOrigin(0.5, 0.5);

    this.container.add([bg, brackets, title, this.body]);
  }

  /** Container UI del pannello — usato per escluderlo dallo zoom della camera. */
  get uiContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Compensa uno zoom della camera diverso dallo zoom base del gioco
   * (RENDER_SCALE), così il box resta della STESSA dimensione e posizione a
   * schermo anche quando la camera zooma (es. il minigioco della bici).
   *
   * Con scrollFactor 0: screen = zoom·pos − mid·(zoom−1). Riproiettiamo
   * l'ancora e scaliamo il container di baseZoom/cameraZoom per annullare
   * l'ingrandimento dovuto allo zoom.
   *
   * @param midX metà larghezza del canvas (GAME_WIDTH·RENDER_SCALE / 2)
   * @param midY metà altezza del canvas (GAME_HEIGHT·RENDER_SCALE / 2)
   */
  compensateCameraZoom(cameraZoom: number, baseZoom: number, midX: number, midY: number): void {
    const bx = this.container.x;
    this.container
      .setScale(baseZoom / cameraZoom)
      .setPosition(
        (baseZoom * bx + midX * (cameraZoom - baseZoom)) / cameraZoom,
        (baseZoom * this.by + midY * (cameraZoom - baseZoom)) / cameraZoom,
      );
    this.by = this.container.y;   // show()/clear() usano la nuova ancora
  }

  /** Aggiunge il marcatore ▼ world-space (solo per scene RPG con NPC). */
  addMarker(): this {
    this.marker = this.scene.add
      .text(0, 0, '▼', {
        fontFamily: FONT, fontSize: '7px', color: '#ffdd44',
        stroke: '#000000', strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(1200)
      .setAlpha(0);
    return this;
  }

  /** Il box si nasconde da solo dopo questo tempo (ms). */
  private static readonly AUTO_HIDE_MS = 7000;

  show(text: string): void {
    this.body.setText(text);
    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }
    if (this.autoHideTimer) { this.autoHideTimer.remove(); this.autoHideTimer = null; }
    this.brackets.setAlpha(1);
    this.container.setAlpha(0).setY(this.by - 14);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: this.by,
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Lampeggio discreto delle sole staffe: segnala "attivo" senza toccare il testo
        this.pulseTween = this.scene.tweens.add({
          targets: this.brackets,
          alpha: 0.45,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
    // Sparisce da solo dopo qualche secondo (resta comunque il marcatore ▼)
    this.autoHideTimer = this.scene.time.delayedCall(QuestHUD.AUTO_HIDE_MS, () => this.clear());
  }

  clear(delayMs = 0): void {
    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }
    if (this.autoHideTimer) { this.autoHideTimer.remove(); this.autoHideTimer = null; }
    this.brackets.setAlpha(1);
    this.scene.time.delayedCall(delayMs, () => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        y: this.by - 10,
        duration: 320,
        ease: 'Quad.easeIn',
      });
    });
  }

  moveMarker(wx: number, wy: number): void {
    if (!this.marker) return;
    if (this.markerTween) { this.markerTween.stop(); this.markerTween = null; }
    this.marker.setPosition(wx, wy - 18).setAlpha(1);
    this.markerTween = this.scene.tweens.add({
      targets: this.marker,
      y: wy - 24,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  hideMarker(): void {
    if (!this.marker) return;
    if (this.markerTween) { this.markerTween.stop(); this.markerTween = null; }
    this.scene.tweens.add({ targets: this.marker, alpha: 0, duration: 200 });
  }
}
