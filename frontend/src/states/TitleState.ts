import Phaser from 'phaser';
import { BaseState } from './BaseState';
import { GameStateType } from './GameState';
import { GameEventEmitter, GameEventType } from './GameEvents';
import { createSkyGradient } from '../utils/gradientUtils';
import WalletStore from '../utils/WalletStore';
import { ButtonComponent } from '../components/ButtonComponent';

export class TitleState extends BaseState {
  private titleImage: Phaser.GameObjects.Image | null = null;
  private hotdogLeft: Phaser.GameObjects.Image | null = null;
  private hotdogRight: Phaser.GameObjects.Image | null = null;
  private bgImage: Phaser.GameObjects.Image | null = null;
  private connectButton: ButtonComponent | null = null;

  protected onCreate(): void {
    this.handleResize(); // Run setup immediately
    // we wait some time to prevent double resize
    this.scene.time.delayedCall(450, () => {
    this.scene.scale.on('resize', this.handleResize, this);
    });
  }

  protected onUpdate(): void {
    // Update positions if needed
  }

  protected onDestroy(): void {
    // Clean up game objects
    if (this.bgImage) { this.bgImage.destroy(); this.bgImage = null; }
    if (this.titleImage) { this.titleImage.destroy(); this.titleImage = null; }
    if (this.hotdogLeft) { this.hotdogLeft.destroy(); this.hotdogLeft = null; }
    if (this.hotdogRight) { this.hotdogRight.destroy(); this.hotdogRight = null; }
    if (this.connectButton) {
      this.connectButton.displayObject.destroy();
      this.connectButton = null;
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
    if (this.titleImage) { this.titleImage.destroy(); this.titleImage = null; }
    if (this.hotdogLeft) { this.hotdogLeft.destroy(); this.hotdogLeft = null; }
    if (this.hotdogRight) { this.hotdogRight.destroy(); this.hotdogRight = null; }
    if (this.connectButton) { this.connectButton.displayObject.destroy(); this.connectButton = null; }

    // Clear the gameObjects array to prevent duplicates
    this.gameObjects = [];

    // Re-setup everything
    this.setupBackground();
    this.showTitleScreen();
  }

  private setupBackground(): void {
    this.bgImage = createSkyGradient(this.scene);
    if (this.bgImage) {
      this.addGameObject(this.bgImage);
    }
  }

  private showTitleScreen(): void {
    // Show the title image a bit lower (25% from the top)
    const titleFinalY = this.scene.scale.height * 0.25;
    this.titleImage = this.scene.add.image(this.scene.scale.width / 2, -200, 'title');
    this.addGameObject(this.titleImage);
    this.titleImage.setOrigin(0.5, 0.5);

    // Scale down if too large (bigger than before)
    const maxWidth = this.scene.scale.width * 0.9;
    const maxHeight = this.scene.scale.height * 0.5;
    let scale = 1;
    if (this.titleImage.width > maxWidth) {
      scale = maxWidth / this.titleImage.width;
      this.titleImage.setScale(scale);
    }
    if (this.titleImage.height * this.titleImage.scaleY > maxHeight) {
      scale = maxHeight / this.titleImage.height * this.titleImage.scaleX;
      this.titleImage.setScale(scale);
    }

    // Bounce down from top
    this.scene.tweens.add({
      targets: this.titleImage,
      y: titleFinalY,
      ease: 'Bounce.easeOut',
      duration: 900,
      onComplete: () => {
        // Start floating and pulsing after bounce
        this.scene.tweens.add({
          targets: this.titleImage,
          y: `+=30`,
          scale: scale * 1.08,
          duration: 1400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1
        });
      }
    });

    // Start the rest of the animations immediately
    this.showTitleScreenRest(scale);
  }

  private showTitleScreenRest(scale: number): void {
    // Add connect wallet button
    // Responsive font size: clamp between 16px and 24px based on width (1.5%)
    const titleFinalY = this.scene.scale.height * 0.25;
    const textY = titleFinalY + (this.titleImage!.displayHeight / 2) + 40;
    const fontSize = Math.max(16, Math.min(24, Math.floor(this.scene.scale.width * 0.015)));
    this.connectButton = new ButtonComponent(
      this.scene,
      'Connect Wallet',
      fontSize,
      0x1976d2, // darker blue
      async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts.length > 0) {
            WalletStore.setAddress(accounts[0]);
              this.scene.time.delayedCall(100, () => {
            GameEventEmitter.emit({
              type: GameEventType.WALLET_CONNECTED,
              data: { address: accounts[0] }
            });
              GameEventEmitter.emit({
                type: GameEventType.STATE_CHANGE,
                data: { state: GameStateType.MENU }
              });
            });
          }
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      } else {
        alert('Please install MetaMask to use this feature');
      }
      }
    );
    // Start off-screen, animate in
    this.connectButton.show({x:this.scene.scale.width / 2,y:this.scene.scale.height + 200});
    this.scene.add.existing(this.connectButton.displayObject);
    this.connectButton.displayObject.setDepth(10000);
    this.scene.tweens.add({
      targets: this.connectButton.displayObject,
      y: textY,
      ease: 'Bounce.easeOut',
      duration: 900,
      delay: 200
    });

    // Add hotdog images
    this.addHotdogImages();
  }

  private addHotdogImages(): void {
    const y = this.scene.scale.height / 2 + (this.titleImage?.displayHeight || 0) / 2 + 80;
    // Responsive hotdog scale: max 60% of height or 35% of width
    const hotdogImg = this.scene.textures.get('hotdog-title-left').getSourceImage();
    const maxHotdogHeight = this.scene.scale.height * 0.6;
    const maxHotdogWidth = this.scene.scale.width * 0.35;
    let hotdogScale = 1;
    if (hotdogImg.height > 0 && hotdogImg.width > 0) {
      hotdogScale = Math.min(
        maxHotdogHeight / hotdogImg.height,
        maxHotdogWidth / hotdogImg.width,
        1
      );
    }

    // Left hotdog
    this.hotdogLeft = this.scene.add.image(0, y, 'hotdog-title-left');
    this.addGameObject(this.hotdogLeft);
    this.hotdogLeft.setOrigin(0, 0.5);
    this.hotdogLeft.setScale(hotdogScale);
    this.hotdogLeft.x = -this.hotdogLeft.displayWidth;
    this.hotdogLeft.setVisible(true);

    // Right hotdog
    this.hotdogRight = this.scene.add.image(this.scene.scale.width, y, 'hotdog-title-right');
    this.addGameObject(this.hotdogRight);
    this.hotdogRight.setOrigin(0, 0.5);
    this.hotdogRight.setScale(hotdogScale);
    this.hotdogRight.setVisible(true);

    // Animate hotdogs
    this.scene.time.delayedCall(50, () => {
      if (!this.hotdogLeft || !this.hotdogRight) return;
      this.hotdogLeft.x = -this.hotdogLeft.displayWidth;
      const leftTargetX = 0;
      const rightTargetX = this.scene.scale.width - this.hotdogRight.displayWidth;

      this.scene.tweens.add({
        targets: this.hotdogLeft,
        x: leftTargetX,
        ease: 'Bounce.easeOut',
        duration: 900,
        delay: 200
      });

      this.scene.tweens.add({
        targets: this.hotdogRight,
        x: rightTargetX,
        ease: 'Bounce.easeOut',
        duration: 900,
        delay: 200
      });
    });
  }
} 