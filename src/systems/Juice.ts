import Phaser from 'phaser';

/**
 * Juice — micro-effetti riusabili di "game feel".
 * Tutti statici, world-space (usano le coordinate della scena chiamante).
 *
 *   Juice.dust(scene, x, y)          → sbuffo di polvere (passi, atterraggi)
 *   Juice.burst(scene, x, y, colori) → esplosione di particelle
 *   Juice.popText(scene, x, y, 'x2') → testo fluttuante che sale e svanisce
 *   Juice.squash(scene, obj)         → squash & stretch da atterraggio
 *   Juice.hitStop(scene)             → micro-congelamento del tempo (impatti)
 *   Juice.toast(scene, 'msg')        → notifica retrò in alto a destra (globale)
 */
export class Juice {
  /** Texture 3x3 bianca condivisa per le particelle. */
  static ensurePx(scene: Phaser.Scene): void {
    if (scene.textures.exists('juice-px')) return;
    const g = scene.make.graphics();
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 3, 3);
    g.generateTexture('juice-px', 3, 3);
    g.destroy();
  }

  /** Sbuffo di polvere: piccoli cerchi che schizzano in fuori e svaniscono. */
  static dust(
    scene: Phaser.Scene,
    x: number,
    y: number,
    count = 4,
    color = 0xcfc4a8,
    depth = 900
  ): void {
    for (let i = 0; i < count; i++) {
      const r = Phaser.Math.Between(1, 2);
      const p = scene.add.circle(x, y, r, color, 0.7).setDepth(depth);
      scene.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-10, 10),
        y: y - Phaser.Math.Between(1, 7),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(220, 380),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Esplosione radiale di particelle colorate. */
  static burst(
    scene: Phaser.Scene,
    x: number,
    y: number,
    colors: number[] = [0xffdd44, 0xffffff],
    count = 14,
    depth = 950
  ): void {
    this.ensurePx(scene);
    const em = scene.add
      .particles(x, y, 'juice-px', {
        speed: { min: 40, max: 140 },
        lifespan: { min: 250, max: 550 },
        scale: { start: 1.2, end: 0 },
        gravityY: 120,
        tint: colors,
        emitting: false,
      })
      .setDepth(depth);
    em.explode(count);
    scene.time.delayedCall(700, () => em.destroy());
  }

  /** Testo che sale e svanisce (danni, combo, bonus...). */
  static popText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    color = '#ffdd44',
    fontSize = 8,
    depth = 980
  ): void {
    const t = scene.add
      .text(x, y, text, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${fontSize}px`,
        color,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(depth)
      .setScale(0.4);
    scene.tweens.add({
      targets: t,
      scale: 1,
      duration: 130,
      ease: 'Back.easeOut',
    });
    scene.tweens.add({
      targets: t,
      y: y - 20,
      alpha: 0,
      delay: 250,
      duration: 500,
      ease: 'Quad.easeIn',
      onComplete: () => t.destroy(),
    });
  }

  /** Squash & stretch da atterraggio su un oggetto scalabile. */
  static squash(
    scene: Phaser.Scene,
    obj: { scaleX: number; scaleY: number },
    amount = 0.12,
    duration = 80
  ): void {
    const sx = obj.scaleX;
    const sy = obj.scaleY;
    obj.scaleX = sx * (1 + amount);
    obj.scaleY = sy * (1 - amount);
    scene.tweens.add({
      targets: obj,
      scaleX: sx,
      scaleY: sy,
      duration,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Hit-stop: congela quasi tutto (tweens, timer, fisica) per pochi ms.
   * Dà "peso" agli impatti. Usare con parsimonia (60–100ms).
   */
  static hitStop(scene: Phaser.Scene, ms = 70): void {
    if (scene.time.timeScale < 1) return; // già in hit-stop
    scene.time.timeScale = 0.05;
    scene.tweens.timeScale = 0.05;
    if (scene.physics?.world) scene.physics.world.timeScale = 20; // arcade: >1 = più lento
    setTimeout(() => {
      scene.time.timeScale = 1;
      scene.tweens.timeScale = 1;
      if (scene.physics?.world) scene.physics.world.timeScale = 1;
    }, ms);
  }

  /** Notifica toast globale (renderizzata dalla SystemUIScene sopra a tutto). */
  static toast(scene: Phaser.Scene, text: string): void {
    scene.game.events.emit('fable18-toast', text);
  }

  /** Pioggia di coriandoli full-screen (gestita dalla SystemUIScene). */
  static confetti(scene: Phaser.Scene, count = 80): void {
    scene.game.events.emit('fable18-confetti', count);
  }
}
