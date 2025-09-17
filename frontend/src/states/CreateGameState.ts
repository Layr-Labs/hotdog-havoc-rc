import Phaser from 'phaser';
import { BaseState } from './BaseState';
import { createSkyGradient } from '../utils/gradientUtils';
import { ScrollList } from '../components/ScrollList';
import { LevelPreview } from '../components/LevelPreview';
import { ethers } from 'ethers';
import * as contractUtils from '../utils/contractUtils';
import { ButtonComponent } from '../components/ButtonComponent';
import { GameEventEmitter, GameEventType } from './GameEvents';
import { GameStateType } from './GameState';
import { LabelComponent } from '../components/LabelComponent';
import { InputField } from '../components/InputField';
import { CheckboxComponent } from '../components/CheckboxComponent';

export class CreateGameState extends BaseState {
  private bgImage: Phaser.GameObjects.Image | null = null;
  private scrollList: ScrollList | null = null;
  private levelPreview: LevelPreview | null = null;
  private selectedLevelId: number | null = null;
  private createGameImage: Phaser.GameObjects.Image | null = null;
  private backButton: Phaser.GameObjects.Image | null = null;
  private chooseLevelText: Phaser.GameObjects.Text | null = null;
  private levelPreviewText: Phaser.GameObjects.Text | null = null;
  private wagerInput: any = null;
  private wagerLabel: Phaser.GameObjects.Text | null = null;
  private createButton: ButtonComponent | null = null;
  private ethIcon: Phaser.GameObjects.Image | null = null;
  private resizeHandler: (() => void) | null = null;
  private ethIconBaseY: number = 0;
  private ethIconFloatOffset: number = 0;
  private ethIconTween: Phaser.Tweens.Tween | null = null;
  private privateGameLabel: Phaser.GameObjects.Text | null = null;
  private privateGameCheckbox: CheckboxComponent | null = null;
  private opponentLabel: Phaser.GameObjects.Text | null = null;
  private opponentInput: InputField | null = null;

  protected async onCreate(): Promise<void> {
    // Sky gradient background
    this.bgImage = createSkyGradient(this.scene);
    if (this.bgImage) {
      this.addGameObject(this.bgImage);
    }

    // Show createGame image with bounce-in animation
    this.showCreateGameTitle();

    // Show back button in upper right corner
    this.showBackButton();

    // Create UI elements (but don't position yet)
    this.chooseLevelText = this.scene.add.text(0, 0, 'Choose Level', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#fff',
      align: 'left',
    });
    this.chooseLevelText.setOrigin(0, 0.5);
    this.scene.add.existing(this.chooseLevelText);
    this.addGameObject(this.chooseLevelText);

    this.scrollList = new ScrollList(this.scene, {
      width: 500,
      height: 220,
      items: [],
      fontSize: 16,
      itemHeight: 28
    });
    this.scene.add.existing(this.scrollList.displayObject);
    this.addGameObject(this.scrollList.displayObject);

    this.levelPreview = new LevelPreview(this.scene, {
      blocks: [],
      width: 400,
      height: 220
    });
    this.scene.add.existing(this.levelPreview.displayObject);
    this.addGameObject(this.levelPreview.displayObject);

    this.levelPreviewText = this.scene.add.text(0, 0, 'Level Preview', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#fff',
      align: 'left',
    });
    this.levelPreviewText.setOrigin(0, 0.5);
    this.scene.add.existing(this.levelPreviewText);
    this.addGameObject(this.levelPreviewText);

    this.wagerLabel = this.scene.add.text(0, 0, 'Wager Amount:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#fff',
      align: 'left',
    });
    this.wagerLabel.setOrigin(0, 0.5);
    this.scene.add.existing(this.wagerLabel);
    this.addGameObject(this.wagerLabel);

    this.privateGameLabel = this.scene.add.text(0, 0, 'Private Game:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#fff',
      align: 'left',
    });
    this.privateGameLabel.setOrigin(0, 0.5);
    this.scene.add.existing(this.privateGameLabel);
    this.addGameObject(this.privateGameLabel);

    this.privateGameCheckbox = new CheckboxComponent(this.scene, 0, 0, 24, false);
    this.scene.add.existing(this.privateGameCheckbox.displayObject);
    this.addGameObject(this.privateGameCheckbox.displayObject);

    this.opponentLabel = this.scene.add.text(0, 0, 'Opponent:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#fff',
      align: 'left',
    });
    this.opponentLabel.setOrigin(0, 0.5);
    this.opponentLabel.setVisible(false);
    this.scene.add.existing(this.opponentLabel);
    this.addGameObject(this.opponentLabel);

    this.opponentInput = new InputField(this.scene);
    this.opponentInput.show({ x: 0, y: 0, width: 485, fontSize: 10, scrollFactor: 0 });
    if (this.opponentInput.displayObject) this.opponentInput.displayObject.setVisible(false);
    if (this.opponentInput && this.opponentInput.displayObject) {
      // No setOrigin for Container; Container origin is always (0,0) and cannot be changed.
    }

    if (this.privateGameCheckbox) {
      this.privateGameCheckbox.onChange((checked) => {
        if (this.opponentLabel) this.opponentLabel.setVisible(checked);
        if (this.opponentInput && this.opponentInput.displayObject) this.opponentInput.displayObject.setVisible(checked);
        updateCreateButtonState();
      });
    }

    this.wagerInput = new InputField(this.scene);
    this.wagerInput.show({ width: 120, fontSize: 16, scrollFactor: 0 });
    this.addGameObject(this.wagerInput.displayObject);

    this.wagerInput.onInputChange((nextValue: string) => {
      updateCreateButtonState();
      // existing validation logic for wager input
      if (!nextValue) return true; // allow empty for deletion
      const num = Number(nextValue);
      if (isNaN(num) || num <= 0) return false;
      if (!/^\d*\.?\d*$/.test(nextValue)) return false;
      return true;
    });

    this.ethIcon = this.scene.add.image(0, 0, 'ethereum');
    this.ethIcon.setOrigin(0, 0.5);
    this.ethIcon.setScale(0.60);
    this.scene.add.existing(this.ethIcon);
    this.addGameObject(this.ethIcon);
    this.ethIconBaseY = 0;
    this.ethIconFloatOffset = 0;
    this.ethIconTween = this.scene.tweens.add({
      targets: this,
      ethIconFloatOffset: 10,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        if (this.ethIcon) {
          this.ethIcon.y = this.ethIconBaseY + this.ethIconFloatOffset;
        }
      }
    });

    this.createButton = new ButtonComponent(
      this.scene,
      'Create',
      16,
      0x27ae60,
      async () => {
        if (!this.createButton || this.createButton.isDisabled()) return;
        
        try {
          // Disable button during transaction
          this.createButton.disable();
          
          // Get form data
          const levelId = this.selectedLevelId;
          const wagerAmount = this.wagerInput.getValue();
          const isPrivate = this.privateGameCheckbox?.isChecked() || false;
          const opponentAddress = this.opponentInput?.getValue() || '';
          
          if (levelId === null) {
            alert('Please select a level first');
            this.createButton.enable();
            return;
          }
          
          // Convert wager amount to wei
          const wagerInWei = ethers.parseEther(wagerAmount);
          
          // Prepare players array
          let players: string[] = [];
          if (isPrivate && opponentAddress.trim()) {
            // Validate opponent address
            if (!ethers.isAddress(opponentAddress.trim())) {
              alert('Please enter a valid opponent address');
              this.createButton.enable();
              return;
            }
            players = [opponentAddress.trim()];
          }
          
          console.log('Creating game with:', {
            levelId,
            wagerAmount: wagerAmount,
            wagerInWei: wagerInWei.toString(),
            isPrivate,
            players
          });
          
          // Create the game
          const result = await contractUtils.createGame(levelId, wagerInWei, players);
          
          // Show success alert with game ID
          alert(`Game created successfully! Game ID: ${result.gameId.toString()}`);
          
          console.log('Game created:', result);
          
        } catch (error: any) {
          console.error('Error creating game:', error);
          alert(`Failed to create game: ${error.message}`);
        } finally {
          // Re-enable button
          this.createButton.enable();
        }
      },
      16,
      true
    );
    this.scene.add.existing(this.createButton.displayObject);
    this.addGameObject(this.createButton.displayObject);

    // Enable/disable button logic
    const updateCreateButtonState = () => {
      if (!this.createButton || !this.wagerInput) return;
      const wager = this.wagerInput.getValue();
      const wagerNum = Number(wager);
      const privateChecked = this.privateGameCheckbox?.isChecked();
      const opponent = this.opponentInput?.getValue() || '';
      const opponentValid = !privateChecked || (opponent && ethers.isAddress(opponent.trim()));

      if (
        this.selectedLevelId !== null &&
        wager &&
        wager.trim() !== '' &&
        !isNaN(wagerNum) &&
        wagerNum > 0 &&
        opponentValid
      ) {
        this.createButton.enable();
      } else {
        this.createButton.disable();
      }
    };
    // Listen for input changes
    this.wagerInput.setValue(''); // ensure empty
    this.scene.input.keyboard?.on('keydown', updateCreateButtonState);
    // Listen for level selection
    if ((this.scrollList as any).items) {
      (this.scrollList as any).items.forEach((item: any) => {
        const userCallback = item.callback;
        item.callback = async () => {
          await userCallback();
          updateCreateButtonState();
        };
      });
    }

    // Layout all UI elements
    this.layoutUI();

    // Listen for window resize
    this.resizeHandler = () => this.layoutUI();
    this.scene.scale.on('resize', this.resizeHandler);

    // Load all levels (no layout changes needed)
    try {
      if (!window.ethereum) {
        console.error('No Ethereum provider found.');
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const levelCount = Number(await contractUtils.getLevelCount());
      const levelData = await Promise.all(
        Array.from({ length: levelCount }, (_, i) => i).map(async (id: number) => {
          const level = await contractUtils.getLevel(id);
          return { id, name: level.name };
        })
      );
      const items = levelData.map(({ id, name }: any, idx: number) => ({
        text: name ? `${name} (ID: ${id})` : `Level ${id}`,
        callback: async () => {
          // Fetch blocks and update preview
          const blocks = await contractUtils.getLevelBlocks(id);
          this.selectedLevelId = id;
          if (this.levelPreview) {
            this.levelPreview.updateBlocks(blocks);
          }
          // Set selected index in scroll list
          if (this.scrollList && typeof this.scrollList.setSelectedIndex === 'function') {
            this.scrollList.setSelectedIndex(idx);
          }
        }
      }));
      (this.scrollList as any).items = items;
      (this.scrollList as any).createItems();
      // Wrap each item's callback to call updateCreateButtonState
      if ((this.scrollList as any).items) {
        (this.scrollList as any).items.forEach((item: any) => {
          const userCallback = item.callback;
          item.callback = async () => {
            await userCallback();
            updateCreateButtonState();
          };
        });
      }
    } catch (error) {
      console.error('Error loading all levels:', error);
    }

    if (this.opponentInput) {
      this.opponentInput.onInputChange(() => true); // allow any input
      this.opponentInput.onAfterUpdate(() => {
        updateCreateButtonState();
      });
    }
  }

  private layoutUI(): void {
    const scrollListWidth = 500;
    const scrollListHeight = 220;
    const previewWidth = 400;
    const previewHeight = 220;
    const gap = 40;
    const totalWidth = scrollListWidth + gap + previewWidth;
    const centerX = this.scene.scale.width / 2;
    const centerY = this.scene.scale.height / 2;

    // Back button (upper right)
    if (this.backButton) {
      this.backButton.setPosition(this.scene.scale.width - 32, 24);
    }

    // CreateGame title (centered at top)
    if (this.createGameImage) {
      this.createGameImage.setPosition(this.scene.scale.width / 2, 0);
    }

    // Choose Level label
    if (this.chooseLevelText) {
      this.chooseLevelText.setPosition(centerX - totalWidth / 2, centerY - scrollListHeight / 2 - 20);
    }

    // ScrollList
    if (this.scrollList) {
      this.scrollList.displayObject.setPosition(centerX - totalWidth / 2, centerY - scrollListHeight / 2);
    }

    // LevelPreview
    if (this.levelPreview) {
      this.levelPreview.displayObject.setPosition(centerX - totalWidth / 2 + scrollListWidth + gap, centerY - scrollListHeight / 2);
    }

    // Level Preview label
    if (this.levelPreviewText) {
      this.levelPreviewText.setPosition(centerX - totalWidth / 2 + scrollListWidth + gap, centerY - scrollListHeight / 2 - 20);
    }

    // Wager row (below scroll list)
    const scrollListX = centerX - totalWidth / 2;
    const scrollListY = centerY - scrollListHeight / 2;
    const wagerRowY = scrollListY + scrollListHeight + 32;
    const wagerLabelX = scrollListX;
    const inputWidth = 120;
    const inputFontSize = 16;
    const inputX = wagerLabelX + 275;
    if (this.wagerLabel) {
      this.wagerLabel.setPosition(wagerLabelX, wagerRowY);
    }
    if (this.wagerInput && this.wagerInput.displayObject) {
      this.wagerInput.displayObject.setPosition(inputX, wagerRowY);
    }
    const ethGap = 8;
    if (this.wagerInput && this.wagerInput.displayObject) {
      const iconX = this.wagerInput.displayObject.x + inputWidth / 2 + ethGap;
      const iconBaseY = wagerRowY - 5;
      this.ethIconBaseY = iconBaseY;
      if (this.ethIcon) {
        this.ethIcon.setPosition(iconX, this.ethIconBaseY + this.ethIconFloatOffset);
      }
    }
    // Create button right-aligned with LevelPreview
    const levelPreviewRight = scrollListX + scrollListWidth + gap + previewWidth;
    if (this.createButton) {
      const buttonX = levelPreviewRight - this.createButton.displayObject.width / 2;
      this.createButton.show({ x: buttonX, y: wagerRowY });
    }

    // Private Game label
    if (this.privateGameLabel) {
      this.privateGameLabel.setPosition(wagerLabelX, wagerRowY + 36);
    }

    if (this.privateGameCheckbox && this.privateGameLabel) {
      const checkboxX = this.privateGameLabel.x + this.privateGameLabel.width + 16;
      const checkboxY = this.privateGameLabel.y;
      this.privateGameCheckbox.displayObject.setPosition(checkboxX, checkboxY);
    }

    if (
      this.opponentLabel && this.opponentInput &&
      this.privateGameLabel && this.privateGameCheckbox && this.privateGameCheckbox.displayObject
    ) {
      const opponentY = this.privateGameLabel.y + 36;
      const opponentLabelX = this.privateGameLabel.x;
      const opponentInputX = this.privateGameCheckbox.displayObject.x;
      this.opponentLabel.setPosition(opponentLabelX, opponentY);
      if (this.opponentInput.displayObject) {
        this.opponentInput.displayObject.setPosition(opponentInputX + 232, opponentY);
      }
    }

    // Redraw sky gradient background on resize
    if (this.bgImage) {
      this.bgImage.destroy();
    }
    this.bgImage = createSkyGradient(this.scene);
    if (this.bgImage) {
      this.scene.add.existing(this.bgImage);
      this.bgImage.setDepth(-1000); // Ensure it's at the back
    }
  }

  protected onUpdate(): void {}

  protected onDestroy(): void {
    if (this.bgImage) this.bgImage.destroy();
    if (this.scrollList) this.scrollList.displayObject.destroy();
    if (this.levelPreview) this.levelPreview.displayObject.destroy();
    if (this.createGameImage) this.createGameImage.destroy();
    if (this.backButton) this.backButton.destroy();
    if (this.chooseLevelText) this.chooseLevelText.destroy();
    if (this.levelPreviewText) this.levelPreviewText.destroy();
    if (this.wagerLabel) this.wagerLabel.destroy();
    if (this.wagerInput) this.wagerInput.destroy();
    if (this.createButton) this.createButton.destroy();
    if (this.ethIcon) this.ethIcon.destroy();
    if (this.privateGameLabel) this.privateGameLabel.destroy();
    if (this.privateGameCheckbox) this.privateGameCheckbox.destroy();
    if (this.opponentLabel) this.opponentLabel.destroy();
    if (this.opponentInput && this.opponentInput.displayObject) this.opponentInput.displayObject.destroy();
    if (this.resizeHandler) {
      this.scene.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.ethIconTween) {
      this.ethIconTween.stop();
      this.ethIconTween = null;
    }
  }

  private showCreateGameTitle(): void {
    const yFinal = 0;
    this.createGameImage = this.scene.add.image(this.scene.scale.width / 2, -200, 'createGame');
    this.addGameObject(this.createGameImage);
    this.createGameImage.setOrigin(0.5, 0);

    const maxWidth = this.scene.scale.width * 0.20;
    let scale = 1;
    if (this.createGameImage.width > maxWidth) {
      scale = maxWidth / this.createGameImage.width;
      this.createGameImage.setScale(scale);
    }

    this.scene.tweens.add({
      targets: this.createGameImage,
      y: yFinal,
      ease: 'Bounce.easeOut',
      duration: 900,
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.createGameImage,
          y: `+=20`,
          scale: scale * 1.08,
          duration: 1400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1
        });
      }
    });
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