import Phaser from 'phaser';
import { BaseState } from './BaseState';
import { GameStateType } from './GameState';
import { GameEventEmitter, GameEventType } from './GameEvents';
import { createSkyGradient } from '../utils/gradientUtils';
import WalletStore from '../utils/WalletStore';
import { ButtonComponent } from '../components/ButtonComponent';
import { Window } from '../components/Window';
import { ScrollList } from '../components/ScrollList';
import { ethers } from 'ethers';
import * as contractUtils from '../utils/contractUtils';

export class MenuState extends BaseState {
  private mainMenuImage: Phaser.GameObjects.Image | null = null;
  private menuOptionTexts: Phaser.GameObjects.Text[] = [];
  private walletText: Phaser.GameObjects.Text | null = null;
  private disconnectButton: ButtonComponent | null = null;
  private bgImage: Phaser.GameObjects.Image | null = null;
  private createGameWindow: Window | null = null;
  private createGameScrollList: ScrollList | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  protected onCreate(): void {
    this.setupBackground();
    this.showMainMenuTitle();
    this.setupWalletDisplay();
    this.scene.scale.on('resize', this.handleResize, this);
  }

  protected onUpdate(): void {
    // Update positions if needed
  }

  protected onDestroy(): void {
    // Clean up game objects
    if (this.bgImage) { this.bgImage.destroy(); this.bgImage = null; }
    if (this.mainMenuImage) { this.mainMenuImage.destroy(); this.mainMenuImage = null; }
    this.menuOptionTexts.forEach(text => text.destroy());
    this.menuOptionTexts = [];
    if (this.walletText) { this.walletText.destroy(); this.walletText = null; }
    if (this.disconnectButton) {
      this.disconnectButton.displayObject.destroy();
      this.disconnectButton = null;
    }
    if (this.createGameWindow) {
      this.createGameWindow.destroy();
      this.createGameWindow = null;
    }
    if (this.createGameScrollList) {
      this.createGameScrollList.destroy();
      this.createGameScrollList = null;
    }
    this.scene.scale.off('resize', this.handleResize, this);
    this.gameObjects = [];
  }

  private handleResize(): void {
    // Kill all tweens and clear all pending timers/events
    this.scene.tweens.killAll();
    this.scene.time.removeAllEvents();

    // Destroy and null out all dynamic objects
    if (this.bgImage) { this.bgImage.destroy(); this.bgImage = null; }
    if (this.mainMenuImage) { this.mainMenuImage.destroy(); this.mainMenuImage = null; }
    this.menuOptionTexts.forEach(text => text.destroy());
    this.menuOptionTexts = [];
    if (this.walletText) { this.walletText.destroy(); this.walletText = null; }
    if (this.disconnectButton) {
      this.disconnectButton.displayObject.destroy();
      this.disconnectButton = null;
    }
    if (this.createGameWindow) {
      this.createGameWindow.destroy();
      this.createGameWindow = null;
    }
    if (this.createGameScrollList) {
      this.createGameScrollList.destroy();
      this.createGameScrollList = null;
    }

    // Clear the gameObjects array to prevent duplicates
    this.gameObjects = [];

    // Re-setup everything
    this.setupBackground();
    this.showMainMenuTitle();
    this.setupWalletDisplay();
  }

  private setupBackground(): void {
    this.bgImage = createSkyGradient(this.scene);
    if (this.bgImage) {
      this.addGameObject(this.bgImage);
    }
  }

  private showMainMenuTitle(): void {
    // Place at 0px from the top
    const yFinal = 0;
    this.mainMenuImage = this.scene.add.image(this.scene.scale.width / 2, -200, 'mainMenu');
    this.addGameObject(this.mainMenuImage);
    this.mainMenuImage.setOrigin(0.5, 0);

    // Make smaller: max width 20% of screen
    const maxWidth = this.scene.scale.width * 0.20;
    let scale = 1;
    if (this.mainMenuImage.width > maxWidth) {
      scale = maxWidth / this.mainMenuImage.width;
      this.mainMenuImage.setScale(scale);
    }

    // Bounce in from above
    this.scene.tweens.add({
      targets: this.mainMenuImage,
      y: yFinal,
      ease: 'Bounce.easeOut',
      duration: 900,
      onComplete: () => {
        // Start floating and pulsing after bounce
        this.scene.tweens.add({
          targets: this.mainMenuImage,
          y: `+=20`,
          scale: scale * 1.08,
          duration: 1400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1
        });
      }
    });

    // Start menu options animation immediately
    this.addMenuOptions(yFinal, scale);
  }

  private addMenuOptions(yFinal: number, scale: number): void {
    const options = ['Join Game', 'Create Game', 'Level Editor', 'Manage Team'];
    const startY = yFinal + (this.mainMenuImage?.displayHeight || 0) + 40;
    const spacing = 48;

    options.forEach((label, i) => {
      const initialY = this.scene.scale.height + 100;
      const opt = this.scene.add.text(this.scene.scale.width / 2, initialY, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '20px',
        color: '#fff',
        align: 'center',
      });
      this.addGameObject(opt);
      opt.setOrigin(0.5, 0);
      opt.setInteractive({ useHandCursor: true });

      this.scene.tweens.add({
        targets: opt,
        y: startY + i * spacing,
        ease: 'Bounce.easeOut',
        duration: 700,
        delay: 200 + i * 100
      });

      // Hover effect
      opt.on('pointerover', () => {
        if (this.createGameWindow && this.createGameWindow.isVisible()) return;
        this.scene.tweens.add({
          targets: opt,
          scale: 1.12,
          duration: 120,
          ease: 'Sine.easeOut',
        });
        opt.setColor('#ffe066');
      });

      opt.on('pointerout', () => {
        if (this.createGameWindow && this.createGameWindow.isVisible()) return;
        this.scene.tweens.add({
          targets: opt,
          scale: 1,
          duration: 120,
          ease: 'Sine.easeIn',
        });
        opt.setColor('#fff');
      });

      opt.on('pointerdown', () => {
        if (this.createGameWindow && this.createGameWindow.isVisible()) return;
        this.scene.tweens.add({
          targets: opt,
          scale: 0.95,
          duration: 80,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });

        if (label === 'Create Game') {
          GameEventEmitter.emit({
            type: GameEventType.STATE_CHANGE,
            data: { state: GameStateType.CREATE_GAME }
          });
        }

        if (label === 'Level Editor') {
          GameEventEmitter.emit({
            type: GameEventType.STATE_CHANGE,
            data: { state: GameStateType.EDITOR }
          });
        }

        if (label === 'Manage Team') {
          GameEventEmitter.emit({
            type: GameEventType.STATE_CHANGE,
            data: { state: GameStateType.MANAGE_TEAM }
          });
        }
      });

      this.menuOptionTexts.push(opt);
    });
  }

  private setupWalletDisplay(): void {
    // Get the wallet address from the global store
    const address = WalletStore.getAddress();
    const formattedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

    // Wallet address display
    this.walletText = this.scene.add.text(this.scene.scale.width / 2, 24, formattedAddress, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#fff',
      align: 'center',
    });
    this.addGameObject(this.walletText);
    this.walletText.setOrigin(0.5, 0);
    this.walletText.setDepth(10);

    // Disconnect button as a red ButtonComponent
    this.disconnectButton = new ButtonComponent(
      this.scene,
      'Disconnect',
      16,
      0xe53935, // red
      () => {
        // Emit wallet disconnected event
        GameEventEmitter.emit({
          type: GameEventType.WALLET_DISCONNECTED
        });
        // Emit state change event to return to title
        GameEventEmitter.emit({
          type: GameEventType.STATE_CHANGE,
          data: { state: GameStateType.TITLE }
        });
      }
    );
    const btnWidth = this.disconnectButton.displayObject.width;
    this.disconnectButton.show({ x: this.scene.scale.width - btnWidth/2 - 16, y: 32 });
    this.scene.add.existing(this.disconnectButton.displayObject);
    this.disconnectButton.displayObject.setDepth(10);
  }
} 