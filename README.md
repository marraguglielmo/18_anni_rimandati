# Fable 18 — Il Gioco

> Un RPG pixel-art narrativo ambientato a Tricase, tra il 2015 e il 2019.

**🎮 [Gioca online](https://marraguglielmo.github.io/18-anni-rimandati/)**

---

## Storia

Bubi e i suoi amici si ritrovano catapultati tra due momenti della loro adolescenza senza capire bene come. Si affrontano in battaglie assurde per i corridoi del liceo, sopravvivono a interrogazioni al Milionario davanti all'intera classe, pedalano disperatamente per raccogliere soldi per la festa, e finiscono la serata a ballare e a perdere a beer pong. Tutto con la regia (spesso indesiderata) di Cece.

---

## Stack tecnico

| Tecnologia | Versione | Uso |
|---|---|---|
| [Phaser 3](https://phaser.io/) | ^3.90 | Engine di gioco |
| TypeScript | ^5.6 | Linguaggio |
| Vite | ^6.0 | Build tool / dev server |
| GitHub Actions | — | CI/CD deploy automatico |
| GitHub Pages | — | Hosting |

**Risoluzione:** 480×270 (game world) su canvas 960×540 (zoom ×2, pixel-art crisp)

---

## Struttura del progetto

```
fable_18_game/
├── public/
│   └── assets/
│       ├── audio/          # BGM, FGM e SFX (.mp3 / .wav)
│       └── sprites/        # Portrait dei personaggi (.png)
├── src/
│   ├── config.ts           # Costanti globali (GAME_WIDTH, RENDER_SCALE…)
│   ├── main.ts             # Entry point Phaser, lista scene
│   ├── scenes/             # Una classe per scena di gioco
│   └── systems/            # Sistemi riusabili (dialogue, audio, HUD…)
├── .github/workflows/
│   └── deploy.yml          # Build + deploy automatico su Pages
├── vite.config.ts
└── tsconfig.json
```

---

## Scene di gioco

Il gioco scorre in sequenza lineare attraverso le seguenti scene:

| Scena | Anno | Descrizione |
|---|---|---|
| **PiazzaScene** | 2015 | Arrivo stordito in piazza. Prima esplorazione, dialoghi con i passanti. |
| **StradaScene** | 2015 | Bubi trova Umberto e Chiara per strada. Tensione, confronto verbale. |
| **BattleScene** | 2015 | Scontro uno contro uno Bubi vs Umberto (turn-based arcade). ESC per saltare. |
| **AulaScene** | 2015 | Arrivo al Liceo Stampacchia. Cutscene esterna con entrata nella scuola, interrogazione al **Chi Vuole Essere Milionario** gestita da Trande. |
| **BiciScene** | 2019 | Minigame runner: Trande in bici raccoglie 20 monete mentre gli altri lo lasciano indietro. |
| **PartyScene** | 2019 | Festa da Ilaria. Trova Ilaria, sfida al beer pong, pista da ballo con Just Dance. |
| **BeerPongScene** | 2019 | Minigame beer pong a squadre. Guglielmo e Aniceto vincono sempre (è truccato). |
| **CeceScene** | 2019 | Cutscene cinematica: Cece rivela tutto e rompe la quarta parete. |
| **EndScene** | — | Titoli di coda su sfondo bianco. |

---

## Sistemi principali (`src/systems/`)

### `DialogueSystem`
Gestisce le linee di dialogo con ritratto del personaggio, testo animato lettera per lettera e avanzamento con Spazio / Enter / tap.

### `PlayerController`
Movimento WASD/frecce con rilevamento NPC vicini e logica di interazione.

### `AudioManager`
Due canali audio indipendenti:
- **BGM** — musica di sottofondo globale, persiste tra le scene
- **FGM** — musica in primo piano per i minigiochi (si ferma al termine)

### `TransitionSystem`
- `fadeFromBlack` / `fadeToBlack` — transizioni di scena
- `announceArea` — banner nome area in stile JRPG
- `dazedEffect` — effetto stordimento del personaggio
- `teleportToScene` / `warpToScene` — warp con effetti visivi
- Esporta `UI_OFF_X` / `UI_OFF_Y` per il sistema di coordinate HUD

### `QuestHUD`
Pannello **"O B I E T T I V O"** condiviso tra tutte le scene. Stile unificato: sfondo scuro, bordo giallo, testo pulsante. Supporta il marcatore `▼` world-space per indicare NPC/oggetti. Usato in AulaScene, PartyScene e BiciScene.

### `CharacterSprite`
Generazione procedurale dei sprite dei personaggi (corpo, maglietta, testa, capelli) da configurazione colore. Gestisce animazioni idle/walk nelle 4 direzioni, shadow, name label.

### `Emote`
Balloon procedurali sopra la testa dei personaggi (`!`, `?`, cuore, goccia di sudore, Zzz, nota, vena manga) con pop elastico, galleggiamento e fade automatico. Possono seguire uno sprite in movimento.

### `Juice`
Micro-effetti di "game feel" riusabili: sbuffi di polvere, esplosioni di particelle, testi fluttuanti, squash & stretch, hit-stop (micro-congelamento sugli impatti), toast e coriandoli globali.

### `Settings`
Impostazioni persistenti in `localStorage`: audio muto, segreti sbloccati.

### `SystemUIScene` (layer di sistema)
Scena parallela permanente sopra al gioco:
- **P** — pausa universale (menu con opzioni)
- **M** — audio on/off (persistente)
- Toast retrò e coriandoli full-screen via eventi globali (`fable18-toast`, `fable18-confetti`)
- Easter egg nascosti (Konami code, parole segrete digitate, e qualcos'altro sulla schermata titolo...)

---

## Fisica del minigioco bici

Il runner di Trande usa fisiche da platformer moderno:
- **Coyote time** (120 ms): si può saltare per un attimo anche dopo aver lasciato l'appoggio
- **Salto ad altezza variabile**: rilasciando presto il tasto, il salto si accorcia
- **Magnetismo monete**: le monete vicine vengono risucchiate verso il giocatore
- **Combo**: monete raccolte in rapida successione mostrano il moltiplicatore
- **Squash & stretch + polvere** su stacco e atterraggio, **hit-stop** sulle cadute

---

## Personaggi

| ID | Nome | Ruolo |
|---|---|---|
| `bubi` | Bubi | Protagonista |
| `umberto` | Umberto | Amico/rivale |
| `chiara` | Chiara | Amica del gruppo |
| `trande` | Trande | Professore improvvisato, conduttore del Milionario |
| `cece` | Cece | Il jolly caotico. Sa più cose di quanto lasci intuire. |
| `ilaria` | Ilaria | Organizzatrice della festa |
| `guglielmo` | Guglielmo | Beer pong imbattibile |
| `aniceto` | Aniceto | Spalla di Guglielmo |

---

## Sviluppo locale

```bash
# Installa le dipendenze
npm install

# Avvia il dev server (http://localhost:5173)
npm run dev

# Type check
npx tsc --noEmit

# Build di produzione
npm run build
```

---

## Deploy

Il deploy su GitHub Pages avviene automaticamente ad ogni push su `main` tramite GitHub Actions (`.github/workflows/deploy.yml`).

Il workflow:
1. Installa le dipendenze con `npm ci`
2. Compila TypeScript e builda con Vite (`npm run build`)
3. Carica la cartella `dist/` su GitHub Pages

URL live: **https://marraguglielmo.github.io/18-anni-rimandati/**

---

## Audio

I file audio non sono inclusi nel repository per ragioni di dimensione e copyright. La cartella `public/assets/audio/` deve contenere:

| File | Uso |
|---|---|
| `bgm.mp3` | Musica di sottofondo principale |
| `melancholy.mp3` | BGM scena malinconica |
| `battle.mp3` | Musica battaglia |
| `bike-run.mp3` | Musica minigame bici |
| `dance.mp3` | Musica pista da ballo (Just Dance) |
| `scontro.wav` | SFX warp/scontro |
| `teleport.wav` | SFX teletrasporto |

---

*Fatto con Phaser 3, TypeScript, tanta nostalgia e pochissimo sonno.*
