import Phaser from 'phaser';

export class CheckboxComponent {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private box: Phaser.GameObjects.Rectangle;
  private checkmark: Phaser.GameObjects.Text;
  private checked: boolean;
  private size: number;
  private onChangeCallback: ((checked: boolean) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, size: number = 24, checked: boolean = false) {
    this.scene = scene;
    this.size = size;
    this.checked = checked;

    this.container = scene.add.container(x, y);
    this.container.setSize(size, size);

    this.box = new Phaser.GameObjects.Rectangle(scene, 0, 0, size, size, 0xffffff, 1)
      .setStrokeStyle(2, 0x888888)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.checkmark = new Phaser.GameObjects.Text(scene, 0, 0, '✓', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.floor(size * 0.8)}px`,
      color: '#27ae60'
    }).setOrigin(0.5, 0.5);

    this.container.add([this.box, this.checkmark]);

    this.updateVisual();

    this.box.on('pointerdown', () => {
      this.setChecked(!this.checked);
    });
  }

  private updateVisual() {
    this.checkmark.setVisible(this.checked);
    this.box.setFillStyle(this.checked ? 0xe0ffe0 : 0xffffff, 1);
    this.box.setStrokeStyle(2, this.checked ? 0x27ae60 : 0x888888);
  }

  public onChange(cb: (checked: boolean) => void) {
    this.onChangeCallback = cb;
  }

  public isChecked(): boolean {
    return this.checked;
  }

  public setChecked(checked: boolean) {
    if (this.checked !== checked) {
      this.checked = checked;
      this.updateVisual();
      if (this.onChangeCallback) this.onChangeCallback(this.checked);
    }
  }

  public get displayObject() {
    return this.container;
  }

  public destroy() {
    this.box.destroy();
    this.checkmark.destroy();
    this.container.destroy();
  }
} 