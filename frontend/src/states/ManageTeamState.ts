import Phaser from 'phaser';
import { BaseState } from './BaseState';
import { GameStateType } from './GameState';
import { GameEventEmitter, GameEventType } from './GameEvents';
import { createSkyGradient } from '../utils/gradientUtils';
import { InputField } from '../components/InputField';
import { LabelComponent } from '../components/LabelComponent';
import { ButtonComponent } from '../components/ButtonComponent';
import { getTeamNames as fetchTeamNames, setTeamNames as saveTeamNamesOnChain } from '../utils/contractUtils';
import WalletStore from '../utils/WalletStore';

export class ManageTeamState extends BaseState {
  private bgImage: Phaser.GameObjects.Image | null = null;
  private backButton: Phaser.GameObjects.Image | null = null;
  private hotdogImages: Phaser.GameObjects.Image[] = [];
  private nameInputs: InputField[] = [];
  private nameLabelTexts: Phaser.GameObjects.Text[] = [];
  private saveButton: ButtonComponent | null = null;

  protected async onCreate(): Promise<void> {
    // Sky gradient background
    this.bgImage = createSkyGradient(this.scene);
    if (this.bgImage) {
      this.addGameObject(this.bgImage);
    }

    // Show back button in upper right corner
    this.showBackButton();

    // Create team field
    this.createTeamField();

    // Load team names from contract and populate fields
    try {
      const address = WalletStore.getAddress();
      if (address) {
        const names = await fetchTeamNames(address);
        if (Array.isArray(names)) {
          for (let i = 0; i < Math.min(names.length, this.nameInputs.length); i++) {
            this.nameInputs[i].setValue(names[i] || '');
          }
          this.updateSaveButtonState();
        }
      }
    } catch (err) {
      console.error('Failed to load team names:', err);
    }
  }

  protected onUpdate(): void {
    // Update positions if needed
  }

  protected onDestroy(): void {
    // Clean up game objects
    if (this.bgImage) { this.bgImage.destroy(); this.bgImage = null; }
    if (this.backButton) { this.backButton.destroy(); this.backButton = null; }
    this.hotdogImages.forEach(img => img.destroy());
    this.hotdogImages = [];
    this.nameInputs.forEach(input => input.destroy());
    this.nameInputs = [];
    this.nameLabelTexts.forEach(label => label.destroy());
    this.nameLabelTexts = [];
    if (this.saveButton) { this.saveButton.displayObject.destroy(); this.saveButton = null; }
    this.gameObjects = [];
  }

  private createTeamField(): void {
    const centerX = this.scene.scale.width / 2;
    const numHotdogs = 4;
    const rowSpacing = 120;
    const imageScale = 0.12;
    const inputWidth = 300;
    const hotdogOffset = 60;
    const labelOffset = 32;
    const totalHeight = (numHotdogs - 1) * rowSpacing;
    const startY = this.scene.scale.height / 2 - totalHeight / 2;

    for (let i = 0; i < numHotdogs; i++) {
      const rowY = startY + i * rowSpacing;

      // Hotdog image
      const hotdogImage = this.scene.add.image(
        centerX - inputWidth / 2 - hotdogOffset,
        rowY,
        'hotdog-standing'
      );
      hotdogImage.setScale(imageScale);
      this.hotdogImages.push(hotdogImage);
      this.addGameObject(hotdogImage);

      // Input field
      const nameInput = new InputField(this.scene);
      nameInput.show({
        x: 0,
        y: 0,
        width: inputWidth,
        fontSize: 16,
        scrollFactor: 0
      });
      if (nameInput.displayObject) {
        nameInput.displayObject.setPosition(centerX, rowY);
        this.addGameObject(nameInput.displayObject);
      }
      this.nameInputs.push(nameInput);

      // Label above input
      const labelX = centerX - inputWidth / 2;
      const labelText = this.scene.add.text(labelX, rowY - labelOffset, `Hotdog #${i + 1}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '20px',
        color: '#fff',
        align: 'left',
      });
      labelText.setOrigin(0, 0.5);
      this.nameLabelTexts.push(labelText);
      this.addGameObject(labelText);
    }

    // Create Save button below all fields using ButtonComponent
    const buttonY = startY + numHotdogs * rowSpacing + 20;
    this.saveButton = new ButtonComponent(
      this.scene,
      'Save Team',
      20,
      0x27ae60,
      async () => {
        if (!this.isSaveButtonEnabled()) return;
        await this.saveTeamNames();
      },
      20,
      true
    );
    this.saveButton.show({ x: centerX, y: buttonY });
    this.scene.add.existing(this.saveButton.displayObject);
    this.addGameObject(this.saveButton.displayObject);
    this.saveButton.disable();

    // Listen for input changes to enable/disable button
    this.nameInputs.forEach(input => {
      input.onInputChange(() => this.updateSaveButtonState());
    });
  }

  private updateSaveButtonState(): void {
    if (!this.saveButton) return;
    const allFilled = this.nameInputs.every(input => input.getValue().trim() !== '');
    if (allFilled) {
      this.saveButton.enable();
    } else {
      this.saveButton.disable();
    }
  }

  private isSaveButtonEnabled(): boolean {
    return this.nameInputs.every(input => input.getValue().trim() !== '');
  }

  private async saveTeamNames() {
    const names = this.nameInputs.map(input => input.getValue());
    try {
      await saveTeamNamesOnChain(names);
      alert('Team Saved!');
    } catch (err) {
      alert('Failed to save team: ' + (err as any).message);
    }
  }

  private showBackButton(): void {
    this.backButton = this.scene.add.image(this.scene.scale.width - 32, 24, 'back');
    this.backButton.setOrigin(0.5, 0.5);
    this.backButton.setScale(0.5);
    this.backButton.setScrollFactor(0);
    this.backButton.setInteractive({ useHandCursor: true });

    this.backButton.on('pointerover', () => {
      if (this.backButton) {
        this.scene.tweens.add({
          targets: this.backButton,
          scale: 0.55,
          duration: 120,
          ease: 'Sine.easeOut'
        });
      }
    });

    this.backButton.on('pointerout', () => {
      if (this.backButton) {
        this.scene.tweens.add({
          targets: this.backButton,
          scale: 0.5,
          duration: 120,
          ease: 'Sine.easeIn'
        });
      }
    });

    this.backButton.on('pointerdown', () => {
      if (this.backButton) {
        this.scene.tweens.add({
          targets: this.backButton,
          scale: 0.45,
          duration: 80,
          yoyo: true,
          ease: 'Sine.easeInOut'
        });
      }
    });

    this.backButton.on('pointerup', () => {
      GameEventEmitter.emit({
        type: GameEventType.STATE_CHANGE,
        data: { state: GameStateType.MENU }
      });
    });

    this.addGameObject(this.backButton);
  }
} 