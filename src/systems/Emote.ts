import Phaser from 'phaser';

/**
 * Emote — balloon procedurali sopra la testa dei personaggi.
 *
 *   showEmote(scene, x, y, 'alert')                  → ! rosso
 *   showEmote(scene, x, y, 'sweat', { follow: spr }) → goccia che segue lo sprite
 *
 * Tipi: 'alert' (!), 'question' (?), 'heart', 'sweat', 'zzz', 'note' (♪), 'angry'
 * Pop elastico in entrata, leggero galleggiamento, fade automatico.
 */
export type EmoteType = 'alert' | 'question' | 'heart' | 'sweat' | 'zzz' | 'note' | 'angry';

export interface EmoteOptions {
  /** Durata totale in ms prima del fade (default 1000). */
  duration?: number;
  depth?: number;
  /** Oggetto da seguire (lo sprite del personaggio). */
  follow?: { x: number; y: number };
  /** Offset verticale dal punto/oggetto seguito (default -24). */
  offsetY?: number;
}

const FONT = '"Press Start 2P", monospace';

const SYMBOL_TEXT: Partial<Record<EmoteType, { char: string; color: string; size: number }>> = {
  alert:    { char: '!',  color: '#e03030', size: 9 },
  question: { char: '?',  color: '#3070e0', size: 9 },
  note:     { char: '♪',  color: '#40b060', size: 9 },
  zzz:      { char: 'Z',  color: '#7070c0', size: 8 },
};

export function showEmote(
  scene: Phaser.Scene,
  x: number,
  y: number,
  type: EmoteType,
  opts: EmoteOptions = {}
): Phaser.GameObjects.Container {
  const duration = opts.duration ?? 1000;
  const depth = opts.depth ?? 2000;
  const offsetY = opts.offsetY ?? -24;

  // ── Balloon: rounded rect bianco con codina ────────────────────────────
  const B = 13; // lato balloon
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.96);
  g.lineStyle(1, 0x222230, 1);
  g.fillRoundedRect(-B / 2, -B / 2, B, B, 3);
  g.strokeRoundedRect(-B / 2, -B / 2, B, B, 3);
  g.fillTriangle(-2, B / 2, 3, B / 2, 0, B / 2 + 4);

  const children: Phaser.GameObjects.GameObject[] = [g];

  // ── Simbolo ────────────────────────────────────────────────────────────
  const textDef = SYMBOL_TEXT[type];
  if (textDef) {
    const t = scene.add
      .text(0, 0.5, textDef.char, {
        fontFamily: FONT,
        fontSize: `${textDef.size}px`,
        color: textDef.color,
      })
      .setOrigin(0.5);
    children.push(t);
    if (type === 'zzz') {
      // Z piccola in alto a destra
      const z2 = scene.add
        .text(4, -4, 'z', {
          fontFamily: FONT,
          fontSize: '5px',
          color: textDef.color,
        })
        .setOrigin(0.5);
      children.push(z2);
    }
  } else if (type === 'heart') {
    const h = scene.add.graphics();
    h.fillStyle(0xee4466, 1);
    h.fillCircle(-2, -1.5, 2.4);
    h.fillCircle(2, -1.5, 2.4);
    h.fillTriangle(-4.2, -0.4, 4.2, -0.4, 0, 4.5);
    children.push(h);
  } else if (type === 'sweat') {
    const s = scene.add.graphics();
    s.fillStyle(0x55aaee, 1);
    s.fillTriangle(-2.6, 0, 2.6, 0, 0, -5);
    s.fillCircle(0, 1.2, 2.7);
    s.fillStyle(0xbbddff, 1);
    s.fillCircle(-1, 1, 1);
    children.push(s);
  } else if (type === 'angry') {
    // Simbolo "vena" da manga: 4 archetti rossi a croce
    const a = scene.add.graphics();
    a.lineStyle(1.5, 0xe03030, 1);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      a.beginPath();
      a.arc(sx * 2.6, sy * 2.6, 2.2, sx < 0 ? Math.PI : -Math.PI / 2, sx < 0 ? Math.PI * 1.5 : 0);
      a.strokePath();
    }
    children.push(a);
  }

  const cont = scene.add
    .container(x, y + offsetY, children)
    .setDepth(depth)
    .setScale(0);

  // Segue lo sprite (se richiesto)
  if (opts.follow) {
    const f = opts.follow;
    const track = (): void => {
      cont.setPosition(f.x, f.y + offsetY);
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, track);
    cont.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, track);
    });
  }

  // Pop in → galleggiamento → fade out
  scene.tweens.add({
    targets: cont,
    scale: 1,
    duration: 180,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: cont,
        y: '-=2',
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    },
  });
  scene.time.delayedCall(duration, () => {
    scene.tweens.killTweensOf(cont);
    scene.tweens.add({
      targets: cont,
      alpha: 0,
      scale: 0.6,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => cont.destroy(),
    });
  });

  return cont;
}
