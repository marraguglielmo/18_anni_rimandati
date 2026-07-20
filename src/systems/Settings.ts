/**
 * Impostazioni persistenti (localStorage).
 * Sopravvivono a refresh e sessioni: audio muto, segreti sbloccati.
 */
export interface SettingsData {
  muted: boolean;
  gnummaUnlocked: boolean;
  sunFound: boolean;
  ceceFound: boolean;
}

const DEFAULTS: SettingsData = {
  muted: false,
  gnummaUnlocked: false,
  sunFound: false,
  ceceFound: false,
};

const STORAGE_KEY = 'fable18-settings';

export class Settings {
  static data: SettingsData = Settings.load();

  private static load(): SettingsData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<SettingsData>) : {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  static save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage non disponibile (es. private mode): ignora */
    }
  }
}
