import Phaser from 'phaser';

/**
 * Gestione audio globale (singleton) — sistema a DUE CANALI.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  CANALE 0 – BGM (sottofondo persistente)                            │
 * │  Avviato UNA VOLTA in BootScene con playBgMusic().                  │
 * │  Suona per tutta la durata del gioco a volume basso (0.3).          │
 * │  Viene automaticamente "duckato" a 0 mentre il canale FGM           │
 * │  è attivo, poi torna al volume pieno.                               │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  CANALE 1 – FGM (primo piano situazionale)                          │
 * │  Usato per minigiochi, scene speciali, titoli di coda.              │
 * │  playFgMusic()  →  avvia + ducka BGM                               │
 * │  stopFgMusic()  →  fade out + ripristina BGM                        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * I fade del volume usano setInterval nativo invece di Phaser tweens,
 * così sopravvivono ai cambi di scena senza essere cancellati.
 */
export class AudioManager {
  private static instance: AudioManager | null = null;

  static get(): AudioManager {
    if (!this.instance) this.instance = new AudioManager();
    return this.instance;
  }

  // ── Canale 0: BGM ────────────────────────────────────────────────────
  private bgMusic: Phaser.Sound.BaseSound | null = null;
  private bgMusicKey = '';
  private bgTargetVol = 0.3;

  // ── Canale 1: FGM ────────────────────────────────────────────────────
  private fgMusic: Phaser.Sound.BaseSound | null = null;
  private fgMusicKey = '';

  // ID degli intervalli di fade attivi — vengono cancellati prima di aprirne nuovi
  private bgFadeId: ReturnType<typeof setInterval> | null = null;
  private fgFadeId: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  // ══════════════════════════════════════════════════════════════════════
  //  Fade nativo — non dipende dalla scena Phaser
  // ══════════════════════════════════════════════════════════════════════

  private setVol(sound: Phaser.Sound.BaseSound, v: number): void {
    // Phaser.Sound.WebAudioSound e HTML5AudioSound espongono entrambi `volume`
    // come proprietà scrivibile; il cast a `any` evita il type-check su BaseSound.
    (sound as any).volume = Math.max(0, Math.min(1, v));
  }

  private getVol(sound: Phaser.Sound.BaseSound): number {
    return (sound as any).volume ?? 0;
  }

  /**
   * Anima il volume di un suono da quello attuale a `targetVol` in `durationMs` ms.
   * Usa setInterval nativo → sopravvive allo stop della scena Phaser.
   * @param fadeIdSlot 'bg' | 'fg' — slot per cancellare l'intervallo precedente
   */
  private fadeTo(
    sound: Phaser.Sound.BaseSound,
    targetVol: number,
    durationMs: number,
    fadeSlot: 'bg' | 'fg',
    onDone?: () => void,
  ): void {
    // Cancella eventuale fade precedente sullo stesso slot
    if (fadeSlot === 'bg' && this.bgFadeId !== null) {
      clearInterval(this.bgFadeId); this.bgFadeId = null;
    }
    if (fadeSlot === 'fg' && this.fgFadeId !== null) {
      clearInterval(this.fgFadeId); this.fgFadeId = null;
    }

    if (durationMs <= 0) {
      this.setVol(sound, targetVol);
      onDone?.();
      return;
    }

    const startVol  = this.getVol(sound);
    const startTime = Date.now();

    const id = setInterval(() => {
      // Suono distrutto nel frattempo
      if (!sound || !(sound as any).manager) { clearInterval(id); onDone?.(); return; }

      const t = Math.min((Date.now() - startTime) / durationMs, 1);
      this.setVol(sound, startVol + (targetVol - startVol) * t);

      if (t >= 1) {
        clearInterval(id);
        if (fadeSlot === 'bg') this.bgFadeId = null;
        if (fadeSlot === 'fg') this.fgFadeId = null;
        onDone?.();
      }
    }, 16);

    if (fadeSlot === 'bg') this.bgFadeId = id;
    if (fadeSlot === 'fg') this.fgFadeId = id;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  BGM — sottofondo persistente
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Avvia la traccia di sottofondo globale (chiamare una sola volta in BootScene).
   * Se la stessa chiave è già in riproduzione ma il volume è sbagliato
   * (es. era stata duckato), lo ripristina senza riavviare la traccia.
   */
  playBgMusic(scene: Phaser.Scene, key: string, volume = 0.3): void {
    this.bgTargetVol = volume;

    if (this.bgMusic && this.bgMusicKey === key) {
      // Stessa traccia: ripristina il volume se necessario
      const cur = this.getVol(this.bgMusic);
      if (Math.abs(cur - volume) > 0.01) {
        this.fadeTo(this.bgMusic, volume, 800, 'bg');
      }
      return;
    }

    // Nuova traccia
    if (this.bgFadeId !== null) { clearInterval(this.bgFadeId); this.bgFadeId = null; }
    this.bgMusic?.stop();
    (this.bgMusic as any)?.destroy?.();
    this.bgMusic = null;

    if (!scene.cache.audio.exists(key)) return;
    const m = scene.sound.add(key, { loop: true, volume: 0 });

    // iOS Safari: AudioContext parte sospeso e va ripreso esplicitamente
    // prima che qualsiasi suono possa partire.
    const ctx = (scene.sound as any).context as AudioContext | undefined;
    const startPlay = () => {
      m.play();
      this.bgMusic    = m;
      this.bgMusicKey = key;
      this.fadeTo(m, volume, 1200, 'bg');
    };
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(startPlay).catch(startPlay);
    } else {
      startPlay();
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  FGM — primo piano situazionale
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Avvia una traccia in sovraimpressione.
   * - Ducka il BGM a 0.
   * - Se c'era già un'altra FGM, la fa crossfade.
   * - Se la stessa traccia è già in corso, aggiusta solo il volume.
   * @param fadeIn ms di fade-in (0 = taglio netto)
   */
  playFgMusic(scene: Phaser.Scene, key: string, volume = 0.75, fadeIn = 900): void {
    const instant = fadeIn <= 0;

    // Stessa traccia → solo volume
    if (this.fgMusic && this.fgMusicKey === key && (this.fgMusic as any).isPlaying) {
      this.fadeTo(this.fgMusic, volume, instant ? 50 : 800, 'fg');
      return;
    }

    // Ducka BGM
    if (this.bgMusic) {
      this.fadeTo(this.bgMusic, 0, instant ? 50 : 700, 'bg');
    }

    // Fade out FGM precedente
    const old = this.fgMusic;
    this.fgMusic    = null;
    this.fgMusicKey = '';
    if (old) {
      this.fadeTo(old, 0, 650, 'fg', () => {
        (old as any).stop?.();
        (old as any).destroy?.();
      });
    }

    if (!scene.cache.audio.exists(key)) return;

    const m = scene.sound.add(key, { loop: true, volume: instant ? volume : 0 });
    const ctx = (scene.sound as any).context as AudioContext | undefined;
    const startFg = () => {
      m.play();
      if (!instant) this.fadeTo(m, volume, fadeIn, 'fg');
      this.fgMusic    = m;
      this.fgMusicKey = key;
    };
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(startFg).catch(startFg);
    } else {
      startFg();
    }
  }

  /**
   * Ferma la FGM e ripristina il volume pieno del BGM.
   * Funziona anche se chiamato da una scena già stoppata (usa setInterval nativo).
   * @param fadeDuration ms del fade-out della FGM (default 800)
   */
  stopFgMusic(_scene: Phaser.Scene, fadeDuration = 800): void {
    const old = this.fgMusic;
    this.fgMusic    = null;
    this.fgMusicKey = '';

    if (old) {
      this.fadeTo(old, 0, fadeDuration, 'fg', () => {
        (old as any).stop?.();
        (old as any).destroy?.();
      });
    }

    // Ripristina BGM con un leggero ritardo
    if (this.bgMusic) {
      const bgSnap = this.bgMusic;
      const target = this.bgTargetVol;
      setTimeout(() => {
        if (bgSnap && bgSnap === this.bgMusic) {
          this.fadeTo(bgSnap, target, fadeDuration + 400, 'bg');
        }
      }, 200);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  API legacy (compatibilità con scene non ancora migrate)
  // ══════════════════════════════════════════════════════════════════════

  /** @deprecated Usa playFgMusic() per musica situazionale. */
  playMusic(scene: Phaser.Scene, key: string, volume = 0.6): void {
    this.playFgMusic(scene, key, volume);
  }

  /** @deprecated Usa stopFgMusic(). */
  stopMusic(scene: Phaser.Scene, fadeDuration = 800): void {
    this.stopFgMusic(scene, fadeDuration);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SFX
  // ══════════════════════════════════════════════════════════════════════

  playSFX(scene: Phaser.Scene, key: string, volume = 1): void {
    if (!scene.cache.audio.exists(key)) return;
    scene.sound.play(key, { volume });
  }
}
