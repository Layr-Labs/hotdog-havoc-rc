import Phaser from 'phaser';
import { BaseState } from './BaseState';
import { GameStateType } from './GameState';
import { GameEventEmitter, GameEventType } from './GameEvents';
import { createSkyGradient } from '../utils/gradientUtils';
import { Window } from '../components/Window';
import { InputField } from '../components/InputField';
import { LabelComponent } from '../components/LabelComponent';
import { ButtonComponent } from '../components/ButtonComponent';
import { createLevel, getOwnerLevels, getContract, getLevel, getLevelBlocks } from '../utils/contractUtils';
import { ScrollList } from '../components/ScrollList';
import { LevelPreview } from '../components/LevelPreview';
import { ethers } from 'ethers';

interface Block {
  x: number;
  y: number;
}

export class EditorState extends BaseState {
  private backButton: Phaser.GameObjects.Image | null = null;
  private floppyButton: Phaser.GameObjects.Image | null = null;
  private loadButton: Phaser.GameObjects.Image | null = null;
  private window: Window | null = null;
  private bgImage: Phaser.GameObjects.Image | null = null;
  private coordText: Phaser.GameObjects.Text | null = null;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private blocks: Set<string> = new Set(); // Using string keys like "x,y" for easy lookup
  private shouldIgnoreNextClick: boolean = true;
  private isDrawing: boolean = false;
  private blockGraphics: Phaser.GameObjects.Graphics | null = null;
  private soilTileSprite: Phaser.GameObjects.TileSprite | null = null;
  private grassTileSprite: Phaser.GameObjects.TileSprite | null = null;
  private maskRenderTexture: Phaser.GameObjects.RenderTexture | null = null;
  private grassRenderTexture: Phaser.GameObjects.RenderTexture | null = null;
  private cameraOffsetX: number = 0;
  private cameraOffsetY: number = 0;
  private readonly WORLD_WIDTH = 3200; // 200 blocks * 16px
  private readonly BLOCK_SIZE = 16;
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private readonly TILEMAP_HEIGHT = 100; // Adjust as needed
  private landTileIndex: number = 0;
  private worldMap: boolean[][] = [];
  private inputField: InputField | null = null;
  private scrollList: ScrollList | null = null;
  private restoreButton: ButtonComponent | null = null;
  private levelPreview: LevelPreview | null = null;
  private previewBlocks: { x: number; y: number }[] = [];

  protected onCreate(): void {
    this.shouldIgnoreNextClick = true;
    // Set camera to bottom of world
    const maxOffsetY = Math.max(0, (this.TILEMAP_HEIGHT * this.BLOCK_SIZE) - this.scene.scale.height);
    this.cameraOffsetX = 0;
    this.cameraOffsetY = maxOffsetY;
    this.scene.cameras.main.scrollY = this.cameraOffsetY;
    this.setupBackground();
    this.drawGrid();
    this.setupBackButton();
    this.setupFloppyButton();
    this.setupLoadButton();
    this.setupCoordDisplay();
    this.setupTilemap();
    this.window = new Window(this.scene);
    this.inputField = new InputField(this.scene);
    this.scene.input.on('pointermove', this.updateCoordDisplay, this);
    this.scene.input.on('pointerdown', this.handleBlockPointerDown, this);
    this.scene.input.on('pointermove', this.handleBlockPointerMove, this);
    this.scene.input.on('pointerup', this.handleBlockPointerUp, this);
    this.scene.scale.on('resize', this.handleResize, this);
    // Mouse wheel scroll
    if (this.scene.game.canvas) {
      this.scene.game.canvas.addEventListener('wheel', this.handleWheelScroll, { passive: false });
    }

    // Set up camera bounds
    const height = this.TILEMAP_HEIGHT * this.BLOCK_SIZE;
    this.scene.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, height);
    this.scene.cameras.main.scrollX = this.cameraOffsetX;
    this.scene.cameras.main.scrollY = this.cameraOffsetY;
  }

  protected onUpdate(): void {
    // No need to update here, handled by events
  }

  protected onDestroy(): void {
    if (this.bgImage) this.bgImage.destroy();
    if (this.backButton) this.backButton.destroy();
    if (this.floppyButton) this.floppyButton.destroy();
    if (this.loadButton) this.loadButton.destroy();
    if (this.window) this.window.destroy();
    if (this.coordText) this.coordText.destroy();
    if (this.gridGraphics) this.gridGraphics.destroy();
    if (this.blockGraphics) this.blockGraphics.destroy();
    if (this.soilTileSprite) this.soilTileSprite.destroy();
    if (this.maskRenderTexture) this.maskRenderTexture.destroy();
    if (this.grassRenderTexture) this.grassRenderTexture.destroy();
    if (this.inputField) this.inputField.destroy();
    
    // Clean up tilemap and layer
    if (this.layer) {
      this.layer.destroy();
      this.layer = null;
    }
    if (this.tilemap) {
      this.tilemap.destroy();
      this.tilemap = null;
    }
    
    // Reset camera
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.scene.cameras.main.scrollX = 0;
    this.scene.cameras.main.scrollY = 0;
    this.scene.cameras.main.setBounds(0, 0, this.scene.scale.width, this.scene.scale.height);
    
    // Remove event listeners
    this.scene.input.off('pointermove', this.updateCoordDisplay, this);
    this.scene.input.off('pointerdown', this.handleBlockPointerDown, this);
    this.scene.input.off('pointermove', this.handleBlockPointerMove, this);
    this.scene.input.off('pointerup', this.handleBlockPointerUp, this);
    this.scene.scale.off('resize', this.handleResize, this);
    
    // Clear world map
    this.blocks.clear();
    this.worldMap = [];
    
    // Remove mouse wheel scroll
    if (this.scene.game.canvas) {
      this.scene.game.canvas.removeEventListener('wheel', this.handleWheelScroll as EventListener);
    }

    if (this.restoreButton) {
      this.restoreButton.destroy();
      this.restoreButton = null;
    }

    if (this.levelPreview) {
      this.levelPreview.destroy();
      this.levelPreview = null;
    }
  }

  private handleBlockPointerDown(pointer: Phaser.Input.Pointer): void {
    // If window is visible, don't allow any block placement
    if (this.window && this.window.isVisible()) {
      return;
    }

    if (this.shouldIgnoreNextClick) {
      this.shouldIgnoreNextClick = false;
      return;
    }

    // Check if we clicked on the floppy button or load button
    if ((this.floppyButton && this.floppyButton.getBounds().contains(pointer.x, pointer.y)) ||
        (this.loadButton && this.loadButton.getBounds().contains(pointer.x, pointer.y))) {
      return;
    }

    this.isDrawing = true;
    const deleteMode = pointer.event.shiftKey;
    this.addBlockAtPointer(pointer, deleteMode);
  }

  private handleBlockPointerMove(pointer: Phaser.Input.Pointer): void {
    // If window is visible, don't allow any block placement
    if (this.window && this.window.isVisible()) {
      return;
    }

    if (this.isDrawing) {
      // Check if we're over the floppy button or load button
      if ((this.floppyButton && this.floppyButton.getBounds().contains(pointer.x, pointer.y)) ||
          (this.loadButton && this.loadButton.getBounds().contains(pointer.x, pointer.y))) {
        return;
      }

      const deleteMode = pointer.event.shiftKey;
      this.addBlockAtPointer(pointer, deleteMode);
    }
  }

  private handleBlockPointerUp(pointer: Phaser.Input.Pointer): void {
    this.isDrawing = false;
  }

  private getSoilTileIndex(x: number, y: number): number {
    // Soil tiles start at index 16 (after the 16 grass tiles)
    // Flip Y so world Y=0 (bottom) uses bottom row of soil tileset
    const flippedY = 15 - (y % 16);
    return 16 + (flippedY * 16 + (x % 16));
  }

  private getGrassTileIndex(x: number): number {
    // Grass tiles are the first 16 tiles (0-15)
    return x % 16;
  }

  private initializeWorldMap() {
    // 200x100 (width x height) world
    const width = this.WORLD_WIDTH / this.BLOCK_SIZE;
    this.worldMap = [];
    for (let x = 0; x < width; x++) {
      this.worldMap[x] = [];
      for (let y = 0; y < this.TILEMAP_HEIGHT; y++) {
        this.worldMap[x][y] = false;
      }
    }
  }

  // Convert screen (pixel) coordinates to world (block) coordinates
  private screenToWorldSpace(screenX: number, screenY: number): { x: number, y: number } {
    const x = Math.floor((screenX + this.cameraOffsetX) / this.BLOCK_SIZE);
    const y = this.TILEMAP_HEIGHT - 1 - Math.floor((screenY + this.cameraOffsetY - (this.layer ? this.layer.y : 0)) / this.BLOCK_SIZE);
    return { x, y };
  }

  // Convert world (block) coordinates to screen (pixel) coordinates (top-left of block)
  private worldToScreenSpace(worldX: number, worldY: number): { x: number, y: number } {
    const x = worldX * this.BLOCK_SIZE - this.cameraOffsetX;
    const y = (this.TILEMAP_HEIGHT - 1 - worldY) * this.BLOCK_SIZE - this.cameraOffsetY + (this.layer ? this.layer.y : 0);
    return { x, y };
  }

  private addBlockAtPointer(pointer: Phaser.Input.Pointer, deleteMode = false): void {
    if (!this.tilemap || !this.layer) return;
    const { x: blockX, y: worldY } = this.screenToWorldSpace(pointer.x, pointer.y);
    if (blockX < 0 || blockX >= this.worldMap.length || worldY < 0 || worldY >= this.TILEMAP_HEIGHT) return;
    if (deleteMode) {
      this.worldMap[blockX][worldY] = false;
    } else {
      this.worldMap[blockX][worldY] = true;
    }
    this.redrawWorldTiles();
  }

  private redrawWorldTiles(): void {
    if (!this.layer) return;
    this.layer.fill(-1); // Clear all tiles
    for (let x = 0; x < this.worldMap.length; x++) {
      for (let worldY = 0; worldY < this.TILEMAP_HEIGHT; worldY++) {
        if (this.worldMap[x][worldY]) {
          // Map worldY (0=bottom) to tilemapY (0=top)
          const tilemapY = this.TILEMAP_HEIGHT - 1 - worldY;
          // Place soil
          this.layer.putTileAt(this.getSoilTileIndex(x, worldY), x, tilemapY);
          // If there is no soil above, place grass
          if (worldY < this.TILEMAP_HEIGHT - 1 && !this.worldMap[x][worldY + 1]) {
            this.layer.putTileAt(this.getGrassTileIndex(x), x, tilemapY - 1);
          }
        }
      }
    }
  }

  private setupBackground(): void {
    if (this.bgImage) this.bgImage.destroy();
    this.bgImage = createSkyGradient(this.scene);
    if (this.bgImage) {
      this.bgImage.setScrollFactor(0);
      this.bgImage.setDepth(-100);
      this.addGameObject(this.bgImage);
    }
  }

  private drawGrid(): void {
    if (this.gridGraphics) this.gridGraphics.destroy();
    const width = this.WORLD_WIDTH;
    const height = this.TILEMAP_HEIGHT * this.BLOCK_SIZE;
    const grid = this.scene.add.graphics();
    grid.setDepth(-50);
    grid.lineStyle(1, 0x9b59b6, 0.25);
    // Vertical lines for the whole world
    for (let x = 0; x <= width; x += this.BLOCK_SIZE) {
      grid.beginPath();
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
      grid.strokePath();
    }
    // Horizontal lines (bottom = worldY 0)
    for (let y = 0; y <= this.TILEMAP_HEIGHT; y++) {
      const screenY = height - y * this.BLOCK_SIZE;
      grid.beginPath();
      grid.moveTo(0, screenY);
      grid.lineTo(width, screenY);
      grid.strokePath();
    }
    this.gridGraphics = grid;
    this.addGameObject(grid);
  }

  private handleResize(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // Recreate background gradient
    if (this.bgImage) {
      this.bgImage.destroy();
    }
    this.bgImage = createSkyGradient(this.scene);
    if (this.bgImage) {
      this.bgImage.setScrollFactor(0);
      this.bgImage.setDepth(-100);
      this.addGameObject(this.bgImage);
    }

    // Re-setup tilemap
    this.setupTilemap();
    // No need to anchor layer to bottom after resize; keep at y=0

    // Redraw grid first
    this.drawGrid();

    // Update button positions
    if (this.backButton) {
      this.backButton.setX(width - 32);
    }
    if (this.floppyButton) {
      this.floppyButton.setX(width - 64);
    }
    if (this.loadButton) {
      this.loadButton.setX(width - 96);
    }
  }

  private setupBackButton(): void {
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

  private setupFloppyButton(): void {
    this.floppyButton = this.scene.add.image(this.scene.scale.width - 64, 24, 'save');
    this.floppyButton.setOrigin(0.5, 0.5);
    this.floppyButton.setScale(0.5);
    this.floppyButton.setScrollFactor(0);
    this.floppyButton.setInteractive({ useHandCursor: true });
    
    this.floppyButton.on('pointerover', () => {
      if (this.floppyButton) {
        this.scene.tweens.add({ 
          targets: this.floppyButton, 
          scale: 0.55, 
          duration: 120, 
          ease: 'Sine.easeOut' 
        });
      }
    });

    this.floppyButton.on('pointerout', () => {
      if (this.floppyButton) {
        this.scene.tweens.add({ 
          targets: this.floppyButton, 
          scale: 0.5, 
          duration: 120, 
          ease: 'Sine.easeIn' 
        });
      }
    });

    this.floppyButton.on('pointerdown', () => {
      if (this.floppyButton) {
        this.scene.tweens.add({ 
          targets: this.floppyButton, 
          scale: 0.45, 
          duration: 80, 
          yoyo: true, 
          ease: 'Sine.easeInOut' 
        });
      }
      
      if (this.window) {
        if (this.window.isVisible()) {
          if (this.inputField) {
            this.inputField.destroy();
            this.inputField = null;
          }
          this.window.hide();
        } else {
          // Create and show the input field
          this.inputField = new InputField(this.scene);
          // Add label above the input field, left-aligned
          const label = new LabelComponent(this.scene, 'Level Name', 12);
          this.window.addChild(-200, -40, label);
          this.window.addChild(0, -10, this.inputField, { width: 400, fontSize: 12 });
          // Add Save button below input field, centered
          const saveButton = new ButtonComponent(this.scene, 'Save', 16, 0x27ae60, async () => {
            const levelName = this.inputField?.getValue().trim();
            if (!levelName) {
              alert('Please enter a level name');
              return;
            }

            // Convert worldMap to blocks array
            const blocks: Block[] = [];
            for (let x = 0; x < this.worldMap.length; x++) {
              for (let y = 0; y < this.TILEMAP_HEIGHT; y++) {
                if (this.worldMap[x][y]) {
                  blocks.push({ x, y });
                }
              }
            }

            if (blocks.length === 0) {
              alert('Please place at least one block');
              return;
            }

            try {
              const result = await createLevel(levelName, blocks);
              console.log('Level created:', result);
              alert(`Level created successfully! ID: ${result.levelId}`);
              
              // Clear the editor
              this.blocks.clear();
              this.redrawWorldTiles();
              if (this.inputField) {
                this.inputField.setValue('');
              }
              
              // Hide the window
              if (this.window) {
                this.window.hide();
              }
              
              // Return to menu
              GameEventEmitter.emit({
                type: GameEventType.STATE_CHANGE,
                data: { state: GameStateType.MENU }
              });
            } catch (error) {
              console.error('Error creating level:', error);
              alert('Failed to create level. See console for details.');
            }
          });
          this.window.addChild(0,40, saveButton);
          this.window.show({
            x: this.scene.scale.width / 2,
            y: this.scene.scale.height / 2,
            width: 500,
            height: 180
          });
        }
      }
    });

    this.addGameObject(this.floppyButton);
  }

  private setupLoadButton(): void {
    this.loadButton = this.scene.add.image(this.scene.scale.width - 96, 24, 'load');
    this.loadButton.setOrigin(0.5, 0.5);
    this.loadButton.setScale(0.5);
    this.loadButton.setScrollFactor(0);
    this.loadButton.setInteractive({ useHandCursor: true });
    
    this.loadButton.on('pointerover', () => {
      if (this.loadButton) {
        this.scene.tweens.add({ 
          targets: this.loadButton, 
          scale: 0.55, 
          duration: 120, 
          ease: 'Sine.easeOut' 
        });
      }
    });

    this.loadButton.on('pointerout', () => {
      if (this.loadButton) {
        this.scene.tweens.add({ 
          targets: this.loadButton, 
          scale: 0.5, 
          duration: 120, 
          ease: 'Sine.easeIn' 
        });
      }
    });

    this.loadButton.on('pointerdown', () => {
      if (this.loadButton) {
        this.scene.tweens.add({ 
          targets: this.loadButton, 
          scale: 0.45, 
          duration: 80, 
          yoyo: true, 
          ease: 'Sine.easeInOut' 
        });
      }
      
      if (this.window) {
        if (this.window.isVisible()) {
          this.window.hide();
          if (this.scrollList) {
            this.scrollList.destroy();
            this.scrollList = null;
          }
          if (this.restoreButton) {
            this.restoreButton.destroy();
            this.restoreButton = null;
          }
        } else {
          // New vertical layout dimensions
          const previewWidth = 600;
          const previewHeight = 300;
          const buttonHeight = 50;
          const margin = 25;
          const windowHeight = 700;
          const scrollListHeight = windowHeight - previewHeight - buttonHeight - margin - 16;
          const windowWidth = previewWidth;

          // Set window dimensions for pre-layout
          this.window.setDimensions(windowWidth, windowHeight);

          // Always create a new level preview
          if (this.levelPreview) {
            this.levelPreview.destroy();
            this.levelPreview = null;
          }
          this.previewBlocks = [];
          this.levelPreview = new LevelPreview(this.scene, {
            blocks: this.previewBlocks,
            width: previewWidth,
            height: previewHeight
          });
          this.window.addChild(-windowWidth/2, -windowHeight/2 + margin, this.levelPreview);

          // Always create a new scroll list
          if (this.scrollList) {
            this.scrollList.destroy();
            this.scrollList = null;
          }
          this.scrollList = new ScrollList(this.scene, {
            width: previewWidth,
            height: scrollListHeight,
            items: [], // Will be populated below
            fontSize: 16,
            itemHeight: 24
          });
          this.window.addChild(-windowWidth/2, -windowHeight/2 + margin + previewHeight, this.scrollList);

          // Always create a new restore button
          if (this.restoreButton) {
            this.restoreButton.destroy();
            this.restoreButton = null;
          }
          this.restoreButton = new ButtonComponent(
            this.scene,
            'Load',
            16,
            0x27ae60,  // green
            () => {
              if (this.restoreButton && !this.restoreButton['disabled']) {
                // Load the previewed level into the editor
                this.initializeWorldMap();
                for (const block of this.previewBlocks) {
                  if (
                    typeof block.x === 'number' &&
                    typeof block.y === 'number' &&
                    block.x >= 0 && block.x < this.worldMap.length &&
                    block.y >= 0 && block.y < this.TILEMAP_HEIGHT
                  ) {
                    this.worldMap[block.x][block.y] = true;
                  }
                }
                this.redrawWorldTiles();
                if (this.window) this.window.hide();
              }
            },
            16,        // padding
            true       // disabled
          );
          this.populateScrollList()
          this.window.addChild(0, windowHeight/2 - buttonHeight/2, this.restoreButton);

          // Show window last, after all children are added
          this.window.show({
            x: this.scene.scale.width / 2,
            y: this.scene.scale.height / 2,
            width: windowWidth,
            height: windowHeight
          });
        }
      }
    });

    this.addGameObject(this.loadButton);
  }

  private async populateScrollList(): Promise<void> {
    if (!this.scrollList) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const levelIds = await getOwnerLevels(address);
      // Fetch all level names in parallel
      const levelData = await Promise.all(levelIds.map(async id => {
        const level = await getLevel(id);
        return { id, name: level.name };
      }));
      const items = levelData.map(({ id, name }) => ({
        text: name ? `${name} (ID: ${id})` : `Level ${id}`,
        callback: async () => {
          // Fetch level data for preview
          const blocks = await getLevelBlocks(id);
          this.previewBlocks = blocks;
          if (this.levelPreview) {
            this.levelPreview.updateBlocks(blocks);
          }
          // Enable the restore button
          if (this.restoreButton) {
            this.restoreButton.enable();
          }
        }
      }));

      // Update the items of the existing scroll list and re-render
      if (this.scrollList) {
        (this.scrollList as any).items = items;
        (this.scrollList as any).createItems();
      }
    } catch (error) {
      console.error('Error loading owned levels:', error);
    }
  }

  private setupCoordDisplay(): void {
    this.coordText = this.scene.add.text(16, 16, '(0, 0)', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#fff',
      align: 'left',
      backgroundColor: 'rgba(0,0,0,0.3)'
    });
    this.coordText.setOrigin(0, 0);
    this.coordText.setDepth(20);
    this.coordText.setScrollFactor(0);
    this.addGameObject(this.coordText);
  }

  private updateCoordDisplay(pointer: Phaser.Input.Pointer): void {
    if (!this.coordText || !this.layer) return;
    const { x: blockX, y: worldY } = this.screenToWorldSpace(pointer.x, pointer.y);
    this.coordText.setText(`(${blockX}, ${worldY})`);
  }

  private setupTilemap(): void {
    // Save worldMap if it exists
    let prevWorldMap = this.worldMap;
    // Remove old tilemap/layer if any
    if (this.layer) this.layer.destroy();
    if (this.tilemap) this.tilemap.destroy();
    // Create a blank tilemap
    this.tilemap = this.scene.make.tilemap({
      tileWidth: this.BLOCK_SIZE,
      tileHeight: this.BLOCK_SIZE,
      width: this.WORLD_WIDTH / this.BLOCK_SIZE,
      height: this.TILEMAP_HEIGHT,
    });
    // Add the combined land tileset
    const landTileset = this.tilemap.addTilesetImage('land', undefined, this.BLOCK_SIZE, this.BLOCK_SIZE, 0, 0);
    if (!landTileset) return;
    // Create a blank layer with the land tileset
    this.layer = this.tilemap.createBlankLayer('layer1', [landTileset], 0, 0);
    if (this.layer) {
      this.layer.setDepth(-20);
      // Anchor the tilemap to the top of the screen
      this.layer.y = 0;
    }
    // Set tile index for land tileset
    this.landTileIndex = landTileset.firstgid;
    // Restore or initialize worldMap
    if (prevWorldMap && prevWorldMap.length) {
      this.worldMap = prevWorldMap;
    } else {
      this.initializeWorldMap();
    }
    this.redrawWorldTiles();
  }

  private handleWheelScroll = (event: WheelEvent) => {
    if (this.window && this.window.isVisible()) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const deltaX = event.deltaX;
    const deltaY = event.deltaY;
    if (deltaX !== 0) {
      const maxOffsetX = this.WORLD_WIDTH - this.scene.scale.width;
      this.cameraOffsetX = Phaser.Math.Clamp(this.cameraOffsetX + deltaX, 0, Math.max(0, maxOffsetX));
      this.scene.cameras.main.scrollX = this.cameraOffsetX;
    }
    if (deltaY !== 0) {
      const maxOffsetY = Math.max(0, (this.TILEMAP_HEIGHT * this.BLOCK_SIZE) - this.scene.scale.height);
      // Standard: wheel up (negative deltaY) scrolls up, wheel down (positive deltaY) scrolls down
      this.cameraOffsetY = Phaser.Math.Clamp(this.cameraOffsetY + deltaY, 0, maxOffsetY);
      this.scene.cameras.main.scrollY = this.cameraOffsetY;
    }
  }

  private updateTileSpriteOffsets(): void {
    if (this.soilTileSprite) {
      this.soilTileSprite.tilePositionY = -this.scene.scale.height % 256;
    }
  }
}