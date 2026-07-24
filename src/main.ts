import Phaser from 'phaser';
import { gameConfig } from './config';

// Tutti i testi renderizzano a resolution:2 per essere nitidi con camera zoom=2
{
  const _orig = Phaser.GameObjects.GameObjectFactory.prototype.text;
  Phaser.GameObjects.GameObjectFactory.prototype.text = function (
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    return _orig.call(this, x, y, text, { resolution: 2, ...(style ?? {}) });
  };
}
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { TestScene } from './scenes/TestScene';
import { PreviewScene } from './scenes/PreviewScene';
import { PiazzaScene } from './scenes/PiazzaScene';
import { BattleScene } from './scenes/BattleScene';
import { StradaScene } from './scenes/StradaScene';
import { AulaScene } from './scenes/AulaScene';
import { BiciScene } from './scenes/BiciScene';
import { PartyScene } from './scenes/PartyScene';
import { BeerPongScene } from './scenes/BeerPongScene';
import { PipScene } from './scenes/PipScene';
import { CeceScene } from './scenes/CeceScene';
import { EndScene } from './scenes/EndScene';
import { PostCreditsScene } from './scenes/PostCreditsScene';
import { MobileControlsScene } from './scenes/MobileControlsScene';
import { SystemUIScene } from './scenes/SystemUIScene';

new Phaser.Game({
  ...gameConfig,
  scene: [
    BootScene,
    PiazzaScene,
    BattleScene,
    StradaScene,
    AulaScene,
    BiciScene,
    PartyScene,
    BeerPongScene,
    PipScene,
    CeceScene,
    EndScene,
    PostCreditsScene,
    PreviewScene,
    TestScene,
    GameScene,
    SystemUIScene,       // layer di sistema: pausa, toast, easter egg
    MobileControlsScene, // sempre in coda → si renderizza sopra a tutto
  ],
});
