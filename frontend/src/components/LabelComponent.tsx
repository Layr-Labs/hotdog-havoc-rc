import Phaser from 'phaser';

export class LabelComponent {
  private text: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, label: string, fontSize: number) {
    this.text = scene.add.text(0, 0, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${fontSize}px`,
      color: '#fff',
      align: 'left'
    });
    this.text.setOrigin(0, 0.5);
    this.text.setVisible(false);
  }
  show(props: { x: number; y: number; scrollFactor?: number }) {
    if (!this.text) return;
    this.text.setScrollFactor(props.scrollFactor || 0);
    this.text.setVisible(true);
  }
  hide() {
    if (this.text) {
      this.text.setVisible(false);
    }
  }
  destroy() {
    if (this.text) {
      this.text.destroy();
    }
  }
  get displayObject() {
    return this.text;
  }
} 