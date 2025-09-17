import Phaser from 'phaser';

interface LevelPreviewProps {
  blocks: { x: number; y: number }[];
  width?: number;
  height?: number;
  mapWidth?: number;
  mapHeight?: number;
}

export class LevelPreview {
  public displayObject: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;
  private mapWidth: number;
  private mapHeight: number;
  private blocks: { x: number; y: number }[];

  constructor(scene: Phaser.Scene, props: LevelPreviewProps) {
    this.scene = scene;
    this.width = props.width || 200;
    this.height = props.height || 100;
    this.blocks = props.blocks;
    this.displayObject = scene.add.container(0, 0);
    this.graphics = scene.add.graphics();
    this.displayObject.add(this.graphics);
    this.displayObject.setScrollFactor(0);
    this.mapWidth = props.mapWidth || 200;
    this.mapHeight = props.mapHeight || 100;
    this.renderPreview();
  }

  private renderPreview() {
    this.graphics.clear();
    // Draw each block
    this.graphics.fillStyle(0x27ae60, 1);
    for (const block of this.blocks) {
      const x = block.x * (this.width/this.mapWidth); //(block.x - minX) * blockW * scale;
      const y = (this.mapHeight - block.y - 1) * (this.height/this.mapHeight);
      this.graphics.fillRect(x, y, this.width/this.mapWidth, this.height/this.mapHeight);
    }
    // Draw border for the full map
    this.graphics.lineStyle(1, 0xffffff, 0.5);
    this.graphics.strokeRect(0, 0, this.width, this.height);
  }

  updateBlocks(blocks: { x: number; y: number }[]) {
    this.blocks = blocks;
    this.renderPreview();
  }

  show(props: { x: number; y: number }) {
    this.displayObject.setPosition(props.x, props.y);
    this.displayObject.setVisible(true);
  }

  hide() {
    this.displayObject.setVisible(false);
  }

  destroy() {
    this.displayObject.destroy();
  }
} 