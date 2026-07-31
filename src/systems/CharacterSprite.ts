import Phaser from 'phaser';

export interface CharConfig {
  /** Colore della maglia. */
  shirtColor: number;
  jacketColor?: number;
  pantsColor?: number;
  skinColor?: number;
  hairColor?: number;
  /** Capelli corti: rimuove le ciocche laterali e riduce la frangia. */
  shortHair?: boolean;
  /** Testa completamente calva: nessun capello disegnato. */
  bald?: boolean;
  /**
   * Se true, camminando/guardando verso l'ALTO mostra la nuca scura (di spalle)
   * invece del volto frontale. Utile per entrate "di schiena" (es. Cece).
   */
  backHead?: boolean;
  /** Fisico rotondetto: busto e gambe più larghi, pancione visibile. */
  chubby?: boolean;
  /** Zoom sul volto della foto (1 = crop quadrato pieno, 1.4 = stretto sul viso). */
  faceZoom?: number;
  /** Spostamento orizzontale del crop, in frazione del lato (-0.5..0.5). */
  faceOffsetX?: number;
  /** Spostamento verticale del crop, in frazione del lato (-0.5..0.5). */
  faceOffsetY?: number;
}

/**
 * Config dei personaggi (maglia = colore identità dal design).
 * Per le foto: regolare faceZoom/faceOffsetX/faceOffsetY finché il viso
 * non riempie bene la testa dello sprite (vedi umberto come esempio).
 */
export const CHAR_CONFIGS: Record<string, CharConfig> = {
  umberto: { shirtColor: 0x6ab0ff, faceZoom: 1.0 },
  bubi: { shirtColor: 0x88dd66 },
  cece: { shirtColor: 0xffdd44, backHead: true },
  chiara: { shirtColor: 0xff88cc },
  trande: { shirtColor: 0xffaa55 },
  ilaria: { shirtColor: 0xcc88ff },
  guglielmo: { shirtColor: 0x44ccaa },
  aniceto: { shirtColor: 0xdd6655 },
  riccardo: { shirtColor: 0x7799ee },
  stefano: { shirtColor: 0xcccccc },
  pietro: { shirtColor: 0x557799 },
  zenzola: { shirtColor: 0xd08a3a, shortHair: true },
  sanapo: { shirtColor: 0x3aa0a0 },
  // personaggi secondari
  gnumma:   { shirtColor: 0x994422, skinColor: 0x5c3210, hairColor: 0x1a0e04, shortHair: true },
  alessandra: { shirtColor: 0xff99cc, bald: true, chubby: true },
  // ostacoli umani del minigioco in bici
  cosimino: { shirtColor: 0xb0b070 },
  donbiagio: { shirtColor: 0x303030 },
  christian: { shirtColor: 0x66aacc },
  lerry:    { shirtColor: 0xff6633 },
  beatrice: { shirtColor: 0xee77bb },
};

// Overworld stile Gen 1/2 "perler": chibi, testa enorme, contorno scuro
export const FRAME_W = 24;
export const FRAME_H = 34;
/**
 * Densità interna delle texture: 2 texel per pixel-mondo. La pixel art
 * disegnata resta identica, ma le FOTO dei volti hanno il doppio dei
 * dettagli reali. Gli sprite vanno creati con `setScale(CHAR_SCALE)`.
 */
const TEXEL = 2;
export const CHAR_SCALE = 1 / TEXEL;
/** Offset verticale dell'ombra rispetto al centro dello sprite. */
export const SHADOW_OFFSET_Y = 15;
/** Colore del contorno (outline) attorno alla silhouette. */
const OUTLINE_RGB: [number, number, number] = [18, 18, 28];

const SKIN_DEFAULT = 0xefd0b1;
const JACKET_DEFAULT = 0x2e3848;
const PANTS_DEFAULT = 0x3b5277;
const HAIR_DEFAULT = 0x4a3526;
const SHOE_DEFAULT = 0xd8d8d8;

const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** 3 frame camminata + 1 frame respiro per direzione. */
const FRAMES_PER_DIR = 4;

/**
 * Ombra a ellisse semi-trasparente da posizionare sotto un personaggio.
 * Per sprite statici basta chiamarla una volta; per sprite in movimento
 * va riposizionata (x, y + SHADOW_OFFSET_Y) e ri-depth-ata (y - 1).
 */
export function addShadow(
  scene: Phaser.Scene,
  x: number,
  y: number
): Phaser.GameObjects.Ellipse {
  return scene.add.ellipse(x, y + SHADOW_OFFSET_Y, 12, 4, 0x000000, 0.3).setDepth(y - 1);
}

/**
 * Genera la spritesheet overworld (16 frame) stile trainer Pokémon Gen 4
 * e registra le animazioni `<charId>-walk-<dir>` e `<charId>-idle-<dir>`.
 *
 * Se esiste la texture `portrait-<charId>` (foto, da caricare in preload)
 * il volto riempie la faccia (pixelato, con frangia di capelli sopra).
 *
 * @returns la chiave della texture, usabile con scene.add.sprite()
 */
export function generateSpriteTexture(
  scene: Phaser.Scene,
  charId: string,
  config: CharConfig
): string {
  const key = `char-${charId}`;
  if (scene.textures.exists(key)) return key;

  const totalFrames = FRAMES_PER_DIR * DIRECTIONS.length;
  const canvas = scene.textures.createCanvas(
    key,
    FRAME_W * TEXEL * totalFrames,
    FRAME_H * TEXEL
  );
  if (!canvas) throw new Error(`Impossibile creare la texture ${key}`);
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.scale(TEXEL, TEXEL); // il disegno resta in coordinate logiche

  const faceImg = getFaceImage(scene, charId);

  DIRECTIONS.forEach((dir, d) => {
    [-1, 0, 1].forEach((phase, i) => {
      drawOverworldFrame(ctx, (d * FRAMES_PER_DIR + i) * FRAME_W, dir, phase, 0, faceImg, config);
    });
    // frame respiro: gambe ferme, busto alzato di 1px
    drawOverworldFrame(ctx, (d * FRAMES_PER_DIR + 3) * FRAME_W, dir, 0, -1, faceImg, config);
  });
  ctx.restore();

  // Contorno scuro stile Gen 1/2 (doppio passaggio: 2 texel = 1px mondo)
  applyOutline(ctx, FRAME_W * TEXEL * totalFrames, FRAME_H * TEXEL);
  applyOutline(ctx, FRAME_W * TEXEL * totalFrames, FRAME_H * TEXEL);

  canvas.refresh();
  for (let f = 0; f < totalFrames; f++) {
    canvas.add(f, 0, f * FRAME_W * TEXEL, 0, FRAME_W * TEXEL, FRAME_H * TEXEL);
  }

  registerAnimations(scene, key, charId);
  return key;
}

export type BattlePose = 'idle' | 'attack' | 'hit';

/**
 * Genera lo sprite "posa da trainer" usato in battaglia. Frame 40x56.
 * Tre pose disponibili:
 * - 'idle'   → braccio alzato (posa classica), chiave `battle-<charId>`
 * - 'attack' → braccio proteso in avanti,      chiave `battle-<charId>-attack`
 * - 'hit'    → colpito, all'indietro,           chiave `battle-<charId>-hit`
 *
 * @returns la chiave della texture
 */
export function generateBattleSprite(
  scene: Phaser.Scene,
  charId: string,
  config: CharConfig,
  pose: BattlePose = 'idle'
): string {
  const key = pose === 'idle' ? `battle-${charId}` : `battle-${charId}-${pose}`;
  if (scene.textures.exists(key)) return key;

  const canvas = scene.textures.createCanvas(key, 40 * TEXEL, 56 * TEXEL);
  if (!canvas) throw new Error(`Impossibile creare la texture ${key}`);
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.scale(TEXEL, TEXEL);
  drawBattlePose(ctx, getFaceImage(scene, charId), config, pose);
  ctx.restore();
  applyOutline(ctx, 40 * TEXEL, 56 * TEXEL);
  applyOutline(ctx, 40 * TEXEL, 56 * TEXEL);
  canvas.refresh();
  return key;
}

/**
 * Contorno automatico: ogni pixel trasparente adiacente alla silhouette
 * diventa outline scuro (lo stile "perler" dei vecchi Pokémon).
 */
function applyOutline(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  const [or, og, ob] = OUTLINE_RGB;
  const idx = (x: number, y: number): number => (y * w + x) * 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (src[i + 3] > 40) continue; // già pieno
      const touching =
        (x > 0 && src[idx(x - 1, y) + 3] > 40) ||
        (x < w - 1 && src[idx(x + 1, y) + 3] > 40) ||
        (y > 0 && src[idx(x, y - 1) + 3] > 40) ||
        (y < h - 1 && src[idx(x, y + 1) + 3] > 40);
      if (touching) {
        out[i] = or;
        out[i + 1] = og;
        out[i + 2] = ob;
        out[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}

/**
 * Hitbox statica "sui piedi" per un NPC (12x7 px mondo), indipendente
 * dalla scala dello sprite: posizionata in modo esplicito.
 */
export function makeFeetBody(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite
): void {
  scene.physics.add.existing(sprite, true);
  const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(12, 7); // centrata sul centro dello sprite
  body.position.y = sprite.y + 8; // spostata sui piedi
  body.updateCenter();
}

/**
 * Etichetta col nome (nel colore identità) da mostrare sopra la testa.
 * Per sprite in movimento va riposizionata (x, y - 20) e ri-depth-ata.
 */
export function addNameLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  id: string
): Phaser.GameObjects.Text {
  const color = CHAR_CONFIGS[id] ? hex(CHAR_CONFIGS[id].shirtColor) : '#ffffff';
  return scene.add
    .text(x, y - 20, id.toUpperCase(), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px',
      color,
      stroke: '#000000',
      strokeThickness: 2,
    })
    .setOrigin(0.5, 1)
    .setDepth(y + 1);
}

/**
 * Mette in coda il caricamento delle foto dei personaggi: prova sia
 * .png (ritagli con trasparenza) che .jpg. I file mancanti vengono
 * ignorati (404 in console, nessun crash). Da chiamare in preload().
 */
export function loadPortraits(scene: Phaser.Scene, ids: string[]): void {
  for (const id of ids) {
    for (const ext of ['png', 'jpg']) {
      const key = `portrait-${id}-${ext}`;
      if (!scene.textures.exists(key)) {
        scene.load.image(key, `assets/sprites/${id}.${ext}`);
      }
    }
  }
}

/** Chiave della texture foto di un personaggio (png ha priorità), o null. */
export function getPortraitKey(scene: Phaser.Scene, id: string): string | null {
  for (const ext of ['png', 'jpg']) {
    const key = `portrait-${id}-${ext}`;
    if (scene.textures.exists(key)) return key;
  }
  return null;
}

function getFaceImage(scene: Phaser.Scene, charId: string): HTMLImageElement | null {
  const key = getPortraitKey(scene, charId);
  return key ? (scene.textures.get(key).getSourceImage() as HTMLImageElement) : null;
}

function registerAnimations(scene: Phaser.Scene, key: string, charId: string): void {
  DIRECTIONS.forEach((dir, d) => {
    const base = d * FRAMES_PER_DIR;

    const walkKey = `${charId}-walk-${dir}`;
    if (!scene.anims.exists(walkKey)) {
      scene.anims.create({
        key: walkKey,
        frames: [base, base + 1, base + 2, base + 1].map((frame) => ({ key, frame })),
        frameRate: 8,
        repeat: -1,
      });
    }

    const idleKey = `${charId}-idle-${dir}`;
    if (!scene.anims.exists(idleKey)) {
      scene.anims.create({
        key: idleKey,
        frames: [base + 1, base + 3].map((frame) => ({ key, frame })),
        frameRate: 1000 / 800, // respiro: su/giù di 1px ogni 800ms
        repeat: -1,
      });
    }
  });
}

// ---------------------------------------------------------------- utils

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function shade(color: number, factor: number): string {
  const c = Phaser.Display.Color.ValueToColor(color);
  return hex(
    Phaser.Display.Color.GetColor(
      Math.round(c.red * factor),
      Math.round(c.green * factor),
      Math.round(c.blue * factor)
    )
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Bounding box dei pixel non trasparenti (per i PNG ritagliati).
 * Ritorna null se l'immagine è piena (foto senza trasparenza).
 */
const boundsCache = new Map<HTMLImageElement, { x: number; y: number; w: number; h: number } | null>();
function alphaBounds(
  img: HTMLImageElement
): { x: number; y: number; w: number; h: number } | null {
  if (boundsCache.has(img)) return boundsCache.get(img) ?? null;
  const S = 96;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const cx = c.getContext('2d');
  if (!cx) return null;
  cx.drawImage(img, 0, 0, S, S);
  const d = cx.getImageData(0, 0, S, S).data;
  let minX = S;
  let minY = S;
  let maxX = -1;
  let maxY = -1;
  let hasTransparent = false;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (d[(y * S + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        hasTransparent = true;
      }
    }
  }
  const result =
    maxX < 0 || !hasTransparent
      ? null // immagine piena: nessun ritaglio
      : {
          x: (minX / S) * img.width,
          y: (minY / S) * img.height,
          w: ((maxX - minX + 1) / S) * img.width,
          h: ((maxY - minY + 1) / S) * img.height,
        };
  boundsCache.set(img, result);
  return result;
}

/**
 * Prepara la foto per la testa dello sprite ALLA QUALITÀ ORIGINALE:
 * nessuna posterizzazione, downscale con smoothing di alta qualità,
 * canvas a densità TEXEL (il doppio dei pixel del riquadro logico).
 *
 * - PNG ritagliato (testa su sfondo trasparente): la testa intera viene
 *   adattata nel riquadro SENZA deformazioni né tagli (contain).
 * - Foto piena: crop centrale con l'aspect ratio del riquadro (cover),
 *   regolabile con faceZoom / faceOffsetX / faceOffsetY.
 */
function pixelizeFace(
  faceImg: HTMLImageElement,
  dir: Direction,
  w: number,
  h: number,
  cfg: CharConfig
): HTMLCanvasElement {
  const zoom = cfg.faceZoom ?? 1;
  const offX = cfg.faceOffsetX ?? 0;
  const offY = cfg.faceOffsetY ?? 0;

  const c = document.createElement('canvas');
  c.width = w * TEXEL;
  c.height = h * TEXEL;
  const cx = c.getContext('2d');
  if (!cx) return c;
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.scale(TEXEL, TEXEL);

  const cutout = alphaBounds(faceImg);
  if (cutout) {
    // PNG ritagliato: tutta la testa nel riquadro, proporzioni intatte
    const scale = Math.min(w / cutout.w, h / cutout.h) * zoom;
    const dw = cutout.w * scale;
    const dh = cutout.h * scale;
    const dxShift = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    cx.drawImage(
      faceImg,
      cutout.x,
      cutout.y,
      cutout.w,
      cutout.h,
      (w - dw) / 2 + offX * w + dxShift,
      h - dh + offY * h, // ancorata in basso: il mento tocca il collo
      dw,
      dh
    );
  } else {
    // Foto piena: crop con l'aspect ratio del riquadro (niente schiacciamenti)
    const aspect = w / h;
    const sH = Math.min(faceImg.height, faceImg.width / aspect) / zoom;
    const sW = sH * aspect;
    let sx = (faceImg.width - sW) / 2 + offX * sW;
    let sy = (faceImg.height - sH) / 2 + offY * sH;
    if (dir === 'left') sx -= sW * 0.08;
    if (dir === 'right') sx += sW * 0.08;
    sx = Phaser.Math.Clamp(sx, 0, faceImg.width - sW);
    sy = Phaser.Math.Clamp(sy, 0, faceImg.height - sH);
    cx.drawImage(faceImg, sx, sy, sW, sH, 0, 0, w, h);
  }
  return c;
}

function drawPhotoFace(
  ctx: CanvasRenderingContext2D,
  faceImg: HTMLImageElement,
  dir: Direction,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  cfg: CharConfig,
  darken = 0
): void {
  const face = pixelizeFace(faceImg, dir, w, h, cfg);
  if (darken > 0) {
    // scurisce solo i pixel pieni (rispetta la trasparenza dei png)
    const fctx = face.getContext('2d');
    if (fctx) {
      fctx.globalCompositeOperation = 'source-atop';
      fctx.fillStyle = `rgba(14, 11, 20, ${darken})`;
      fctx.fillRect(0, 0, w, h);
    }
  }
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  // il canvas della faccia è a densità TEXEL: mappa 1:1 sui texel finali
  ctx.drawImage(face, x, y, w, h);
  ctx.restore();
}

// ------------------------------------------------------ frame overworld

function drawOverworldFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  dir: Direction,
  legPhase: number,
  lift: number,
  faceImg: HTMLImageElement | null,
  cfg: CharConfig
): void {
  const skin = hex(cfg.skinColor ?? SKIN_DEFAULT);
  const shirt = hex(cfg.shirtColor);
  const jacket = hex(cfg.jacketColor ?? JACKET_DEFAULT);
  const pants = hex(cfg.pantsColor ?? PANTS_DEFAULT);
  const hair = hex(cfg.hairColor ?? HAIR_DEFAULT);
  const hairDark = shade(cfg.hairColor ?? HAIR_DEFAULT, 0.7);
  const shoe = hex(SHOE_DEFAULT);
  // Tonalità scure per lo shading (luce da alto-sinistra)
  const shirtDark = shade(cfg.shirtColor, 0.76);
  const jacketDark = shade(cfg.jacketColor ?? JACKET_DEFAULT, 0.72);
  const pantsDark = shade(cfg.pantsColor ?? PANTS_DEFAULT, 0.74);

  ctx.save();
  // +2 verticale: lascia spazio all'outline sopra i capelli (anche col respiro)
  ctx.translate(ox, 2);

  // Bob della camminata: nei frame di contatto (gamba avanti/indietro) il
  // corpo si comprime di 1px sulle gambe — il classico bounce Pokémon.
  lift += legPhase !== 0 ? 1 : 0;

  // Gambe alternate (1px) + scarpe
  const s = Math.sin((legPhase * Math.PI) / 2); // -1, 0, +1
  const leftUp = Math.round(Math.max(0, -s));
  const rightUp = Math.round(Math.max(0, s));

  // Braccia: oscillano in controfase con le gambe
  const leftArmDy = rightUp;
  const rightArmDy = leftUp;

  if (cfg.chubby) {
    // Fisico rotondetto: gambe più larghe, busto più ampio, pancione, braccia tozze
    ctx.fillStyle = pants;
    ctx.fillRect(6, 25 + lift, 12, 2);       // bacino largo
    ctx.fillRect(6, 27 - leftUp, 5, 3);      // gamba sx
    ctx.fillRect(13, 27 - rightUp, 5, 3);    // gamba dx
    ctx.fillStyle = shoe;
    ctx.fillRect(5, 30 - leftUp, 7, 2);
    ctx.fillRect(12, 30 - rightUp, 7, 2);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(5, 31 - leftUp, 7, 1);
    ctx.fillRect(12, 31 - rightUp, 7, 1);
    // Busto largo
    ctx.fillStyle = jacket;
    ctx.fillRect(4, 16 + lift, 16, 9);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(6, 16 + lift, 1, 9);
    ctx.fillRect(17, 16 + lift, 1, 9);
    ctx.fillStyle = shirt;
    ctx.fillRect(7, 16 + lift, 10, 9);
    // Pancione che sbuca sotto la giacca
    ctx.fillRect(7, 25 + lift, 10, 2);
    // Braccia tozze spinte fuori
    ctx.fillStyle = jacket;
    ctx.fillRect(1, 16 + lift + leftArmDy, 3, 8);
    ctx.fillRect(20, 16 + lift + rightArmDy, 3, 8);
    ctx.fillStyle = skin;
    ctx.fillRect(1, 23 + lift + leftArmDy, 3, 2);
    ctx.fillRect(20, 23 + lift + rightArmDy, 3, 2);
    // Shading (luce da alto-sinistra): ombre 1px su lato destro e in basso
    ctx.fillStyle = pantsDark;
    ctx.fillRect(10, 27 - leftUp, 1, 3);   // gamba sx
    ctx.fillRect(17, 27 - rightUp, 1, 3);  // gamba dx
    ctx.fillStyle = jacketDark;
    ctx.fillRect(19, 16 + lift, 1, 9);                 // fianco destro giacca
    ctx.fillRect(22, 16 + lift + rightArmDy, 1, 7);    // manica destra
    ctx.fillStyle = shirtDark;
    ctx.fillRect(16, 16 + lift, 1, 9);     // lato destro maglia
    ctx.fillRect(7, 26 + lift, 10, 1);     // sotto-pancia
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(4, 16 + lift, 1, 9);      // highlight spalla sinistra
  } else {
    ctx.fillStyle = pants;
    ctx.fillRect(7, 24 + lift, 10, 2); // bacino
    ctx.fillRect(7, 26 - leftUp, 4, 3); // gamba sx
    ctx.fillRect(13, 26 - rightUp, 4, 3); // gamba dx
    ctx.fillStyle = shoe;
    ctx.fillRect(6, 29 - leftUp, 6, 2);
    ctx.fillRect(12, 29 - rightUp, 6, 2);
    ctx.fillStyle = '#3a3a3a'; // suola
    ctx.fillRect(6, 30 - leftUp, 6, 1);
    ctx.fillRect(12, 30 - rightUp, 6, 1);
    // Busto: giacca aperta con striscia chiara, maglia al centro
    ctx.fillStyle = jacket;
    ctx.fillRect(6, 16 + lift, 12, 8);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(8, 16 + lift, 1, 8);
    ctx.fillRect(15, 16 + lift, 1, 8);
    ctx.fillStyle = shirt;
    ctx.fillRect(9, 16 + lift, 6, 8);
    // Braccia (maniche giacca) + mani
    ctx.fillStyle = jacket;
    ctx.fillRect(3, 16 + lift + leftArmDy, 3, 7);
    ctx.fillRect(18, 16 + lift + rightArmDy, 3, 7);
    ctx.fillStyle = skin;
    ctx.fillRect(3, 22 + lift + leftArmDy, 3, 2);
    ctx.fillRect(18, 22 + lift + rightArmDy, 3, 2);
    // Shading (luce da alto-sinistra): ombre 1px su lato destro e in basso
    ctx.fillStyle = pantsDark;
    ctx.fillRect(10, 26 - leftUp, 1, 3);   // gamba sx
    ctx.fillRect(16, 26 - rightUp, 1, 3);  // gamba dx
    ctx.fillRect(7, 25 + lift, 10, 1);     // bacino, riga bassa
    ctx.fillStyle = jacketDark;
    ctx.fillRect(17, 16 + lift, 1, 8);                 // fianco destro giacca
    ctx.fillRect(20, 16 + lift + rightArmDy, 1, 6);    // manica destra
    ctx.fillStyle = shirtDark;
    ctx.fillRect(14, 16 + lift, 1, 8);     // lato destro maglia
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(6, 16 + lift, 1, 8);      // highlight spalla sinistra
  }

  // Collo
  ctx.fillStyle = skin;
  ctx.fillRect(10, 14 + lift, 4, 2);

  // Testa: capelli voluminosi + volto
  drawOverworldHead(ctx, dir, lift, faceImg, skin, hair, hairDark, cfg);

  ctx.restore();
}

function drawOverworldHead(
  ctx: CanvasRenderingContext2D,
  dir: Direction,
  lift: number,
  faceImg: HTMLImageElement | null,
  skin: string,
  hair: string,
  hairDark: string,
  cfg: CharConfig
): void {
  const y = lift;

  // CON FOTO: niente capelli disegnati, la testa è TUTTA foto
  // (i capelli veri sono già nella foto). Leggermente più in basso,
  // sovrapposta al colletto: non "appoggiata" sul collo.
  if (faceImg && faceImg.width > 0) {
    // Di norma il volto resta SEMPRE frontale, anche salendo (scelta di stile).
    // Se però backHead è attivo (es. Cece), verso l'alto si vede la NUCA scura
    // (di spalle) — poi girandosi verso il basso torna il volto.
    if (cfg.backHead && dir === 'up') {
      drawPhotoFace(ctx, faceImg, 'down', 1, y, 22, 19, 5, cfg, 1); // silhouette scura
      return;
    }
    drawPhotoFace(ctx, faceImg, dir === 'up' ? 'down' : dir, 1, y, 22, 19, 5, cfg);
    return;
  }

  // SENZA FOTO: faccia chibi disegnata con capelli (o calva)
  if (cfg.bald) {
    // Testa calva: nessun capello, solo pelle
    roundRect(ctx, 3, y, 18, 13, 5);
    ctx.fillStyle = skin;
    ctx.fill();
    // Lieve lucentezza sulla volta cranica
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(7, y + 2, 5, 2);
  } else if (cfg.shortHair) {
    // Capelli corti: calotta compatta senza ciocche laterali pendenti
    roundRect(ctx, 3, y, 18, 12, 5);
    ctx.fillStyle = hair;
    ctx.fill();
    ctx.fillStyle = hairDark;
    ctx.fillRect(5, y + 1, 14, 2);
  } else {
    roundRect(ctx, 3, y, 18, 14, 5);
    ctx.fillStyle = hair;
    ctx.fill();
    ctx.fillRect(3, y + 10, 3, 5);   // ciocche laterali
    ctx.fillRect(18, y + 10, 3, 5);
    ctx.fillStyle = hairDark;
    ctx.fillRect(5, y + 1, 14, 2);
  }

  // Il volto resta SEMPRE frontale, anche camminando verso l'alto
  // (niente retro-testa: scelta di stile).
  roundRect(ctx, 5, y + 3, 14, 11, 2);
  ctx.fillStyle = skin;
  ctx.fill();
  const shift = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  // occhioni 3x4 con pupilla 2x2
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7 + shift, y + 6, 3, 4);
  ctx.fillRect(14 + shift, y + 6, 3, 4);
  ctx.fillStyle = '#000000';
  const px = dir === 'left' ? 0 : dir === 'right' ? 1 : 0;
  ctx.fillRect(7 + shift + px, y + 7, 2, 2);
  ctx.fillRect(14 + shift + px, y + 7, 2, 2);
  // bocca + blush
  ctx.fillStyle = '#7a4a3a';
  ctx.fillRect(11 + shift, y + 12, 2, 1);
  ctx.fillStyle = 'rgba(255, 130, 140, 0.8)';
  ctx.fillRect(5 + shift, y + 11, 2, 1);
  ctx.fillRect(17 + shift, y + 11, 2, 1);

  // Capelli sopra il volto (solo se non calva)
  if (!cfg.bald) {
    ctx.fillStyle = hair;
    if (cfg.shortHair) {
      // Frangia minima: un solo pixel rasente alla fronte
      ctx.fillRect(5, y + 3, 14, 1);
    } else {
      ctx.fillRect(5, y + 3, 14, 2);
      ctx.fillRect(5, y + 5, 2, 2);
      ctx.fillRect(17, y + 5, 2, 2);
    }
  }
}

// ------------------------------------------------------- posa battaglia

function drawBattlePose(
  ctx: CanvasRenderingContext2D,
  faceImg: HTMLImageElement | null,
  cfg: CharConfig,
  pose: BattlePose = 'idle'
): void {
  const skin = hex(cfg.skinColor ?? SKIN_DEFAULT);
  const shirt = hex(cfg.shirtColor);
  const jacket = hex(cfg.jacketColor ?? JACKET_DEFAULT);
  const pants = hex(cfg.pantsColor ?? PANTS_DEFAULT);
  const hair = hex(cfg.hairColor ?? HAIR_DEFAULT);
  const hairDark = shade(cfg.hairColor ?? HAIR_DEFAULT, 0.7);
  const shoe = hex(SHOE_DEFAULT);

  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(0, 1); // spazio per l'outline sopra i capelli

  // Gambe divaricate (stance da trainer)
  ctx.fillStyle = pants;
  ctx.fillRect(13, 36, 14, 3); // bacino
  ctx.fillRect(12, 38, 5, 12); // gamba sx
  ctx.fillRect(23, 38, 5, 12); // gamba dx
  ctx.fillStyle = shoe;
  ctx.fillRect(10, 50, 8, 3);
  ctx.fillRect(22, 50, 8, 3);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(10, 52, 8, 1);
  ctx.fillRect(22, 52, 8, 1);

  // Busto con giacca aperta (spalle leggermente strette)
  ctx.fillStyle = jacket;
  ctx.fillRect(13, 20, 14, 16);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(15, 20, 1, 16);
  ctx.fillRect(24, 20, 1, 16);
  ctx.fillStyle = shirt;
  ctx.fillRect(16, 20, 8, 16);

  if (pose === 'attack') {
    // Braccio sinistro piegato indietro (carica)
    ctx.fillStyle = jacket;
    ctx.fillRect(9, 21, 4, 6);
    ctx.fillRect(8, 26, 4, 5);
    ctx.fillStyle = skin;
    ctx.fillRect(8, 30, 3, 3);
    // Braccio destro PROTESO in avanti (pugno orizzontale)
    ctx.fillStyle = jacket;
    ctx.fillRect(27, 20, 4, 4);
    ctx.fillRect(31, 19, 4, 4);
    ctx.fillStyle = skin;
    ctx.fillRect(35, 18, 3, 4);
  } else if (pose === 'hit') {
    // Colpito: entrambe le braccia in basso-indietro, sbilanciato
    ctx.fillStyle = jacket;
    ctx.fillRect(9, 22, 4, 6);
    ctx.fillRect(7, 27, 4, 6);
    ctx.fillStyle = skin;
    ctx.fillRect(6, 32, 3, 3);
    ctx.fillStyle = jacket;
    ctx.fillRect(27, 22, 4, 6);
    ctx.fillRect(28, 27, 4, 6);
    ctx.fillStyle = skin;
    ctx.fillRect(29, 32, 3, 3);
  } else {
    // Braccio sinistro disteso in basso-fuori
    ctx.fillStyle = jacket;
    ctx.fillRect(9, 21, 4, 6);
    ctx.fillRect(7, 26, 4, 6);
    ctx.fillStyle = skin;
    ctx.fillRect(6, 31, 3, 3);
    // Braccio destro alzato in diagonale (posa "vittoria")
    ctx.fillStyle = jacket;
    ctx.fillRect(27, 18, 4, 5);
    ctx.fillRect(30, 13, 4, 6);
    ctx.fillStyle = skin;
    ctx.fillRect(32, 9, 3, 4);
  }

  // Shading (luce da alto-sinistra): ombre 1px su lato destro e in basso
  ctx.fillStyle = shade(cfg.pantsColor ?? PANTS_DEFAULT, 0.74);
  ctx.fillRect(16, 38, 1, 12);   // gamba sx
  ctx.fillRect(27, 38, 1, 12);   // gamba dx
  ctx.fillRect(13, 38, 14, 1);   // bacino, riga bassa
  ctx.fillStyle = shade(cfg.jacketColor ?? JACKET_DEFAULT, 0.72);
  ctx.fillRect(26, 20, 1, 16);   // fianco destro giacca
  if (pose === 'idle') ctx.fillRect(33, 13, 1, 6);       // braccio alzato
  if (pose === 'attack') ctx.fillRect(31, 22, 4, 1);     // sotto il braccio proteso
  ctx.fillRect(10, 26, 1, 6);    // avambraccio sinistro
  ctx.fillStyle = shade(cfg.shirtColor, 0.76);
  ctx.fillRect(23, 20, 1, 16);   // lato destro maglia
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(13, 20, 1, 16);   // highlight spalla sinistra

  // Collo
  ctx.fillStyle = skin;
  ctx.fillRect(18, 17, 4, 3);

  // Testa grande
  if (faceImg && faceImg.width > 0) {
    // CON FOTO: la testa è tutta foto, grande e sovrapposta al busto
    drawPhotoFace(ctx, faceImg, 'down', 7, 0, 26, 23, 6, cfg);
  } else {
    // SENZA FOTO: capelli + faccia chibi
    roundRect(ctx, 9, 0, 22, 18, 5);
    ctx.fillStyle = hair;
    ctx.fill();
    ctx.fillRect(9, 12, 4, 7);
    ctx.fillRect(27, 12, 4, 7);
    ctx.fillStyle = hairDark;
    ctx.fillRect(11, 1, 18, 3);

    roundRect(ctx, 12, 4, 16, 13, 3);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 9, 3, 4);
    ctx.fillRect(22, 9, 3, 4);
    ctx.fillStyle = '#000000';
    ctx.fillRect(16, 10, 1, 2);
    ctx.fillRect(23, 10, 1, 2);
    ctx.fillStyle = '#7a4a3a';
    ctx.fillRect(18, 14, 4, 1);

    // Frangia
    ctx.fillStyle = hair;
    ctx.fillRect(12, 4, 16, 3);
    ctx.fillRect(12, 7, 3, 2);
    ctx.fillRect(25, 7, 3, 2);
  }

  ctx.restore();
}
