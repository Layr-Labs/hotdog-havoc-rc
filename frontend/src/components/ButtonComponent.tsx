import Phaser from 'phaser';

interface ButtonProps {
  x: number;
  y: number;
  fontSize: number;
  text: string;
  color: number; // hex
  padding?: number;
}

type ButtonCallback = () => void;

export class ButtonComponent {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private topRect: Phaser.GameObjects.Graphics;
  private sideRect: Phaser.GameObjects.Graphics;
  private textShadow: Phaser.GameObjects.Text;
  private textMain: Phaser.GameObjects.Text;
  private callback: ButtonCallback;
  private width: number;
  private height: number;
  private padding: number;
  private fontSize: number;
  private color: number;
  private darkColor: number;
  private text: string;
  private disabled: boolean;
  private originalColor: number;

  public get displayObject(): Phaser.GameObjects.Container {
    return this.container;
  }

  constructor(
    scene: Phaser.Scene,
    text: string,
    fontSize: number = 16,
    color: number = 0x27ae60,
    callback?: ButtonCallback,
    padding = 16,
    disabled: boolean = false
  ) {
    this.scene = scene;
    this.text = text;
    this.fontSize = fontSize;
    this.color = color;
    this.originalColor = color;
    this.callback = callback || (() => {});
    this.padding = padding;
    this.disabled = disabled;

    // Calculate dark color for the side
    const base = Phaser.Display.Color.IntegerToColor(color);
    const dark = Phaser.Display.Color.Interpolate.ColorWithColor(
      base,
      new Phaser.Display.Color(0, 0, 0),
      100,
      60 // percent darker
    );
    this.darkColor = Phaser.Display.Color.GetColor(dark.r, dark.g, dark.b);

    // Create text objects to measure size
    this.textShadow = new Phaser.GameObjects.Text(scene, 0, 0, text, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${fontSize}px`,
      color: Phaser.Display.Color.RGBToString(dark.r, dark.g, dark.b, 0, '#'),
      fontStyle: 'bold',
      align: 'center',
    });
    this.textShadow.setOrigin(0.5, 0.5);
    this.textMain = new Phaser.GameObjects.Text(scene, 0, 0, text, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${fontSize}px`,
      color: disabled ? '#bbb' : '#fff',
      fontStyle: 'bold',
      align: 'center',
    });
    this.textMain.setOrigin(0.5, 0.5);

    this.width = Math.max(this.textShadow.width, this.textMain.width) + this.padding * 2;
    this.height = Math.max(this.textShadow.height, this.textMain.height) + this.padding * 1.5;

    // Draw the side (bottom) rectangle
    this.sideRect = new Phaser.GameObjects.Graphics(scene);
    this.sideRect.fillStyle(disabled ? 0x333333 : this.darkColor, 1);
    this.sideRect.fillRoundedRect(-this.width/2, -this.height/2 + 4, this.width, this.height, 12);

    // Draw the top rectangle (main color), offset up by 4px
    this.topRect = new Phaser.GameObjects.Graphics(scene);
    this.topRect.fillStyle(disabled ? 0x888888 : this.originalColor, 1);
    this.topRect.fillRoundedRect(-this.width/2, -this.height/2, this.width, this.height, 12);
    this.topRect.lineStyle(2, 0xffffff, 0.12);
    this.topRect.strokeRoundedRect(-this.width/2, -this.height/2, this.width, this.height, 12);

    // Position text layers (centered in the button)
    this.textShadow.setPosition(0, -1); // 1px down for emboss
    this.textMain.setPosition(0, 0);

    // Compose container (side, top, text shadow, text main)
    this.container = new Phaser.GameObjects.Container(scene, 0, 0, [this.sideRect, this.topRect, this.textShadow, this.textMain]);
    this.container.setSize(this.width, this.height);
    // Set the interactive area to match the top rectangle (centered)
    this.container.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.width, this.height), Phaser.Geom.Rectangle.Contains);
    this.container.setScrollFactor(0);
    this.container.setAlpha(1);
    this.container.setVisible(false);

    // Always register pointer events, but check this.disabled before acting
    this.container.on('pointerover', () => {
      if (this.disabled) {
        this.scene.input.manager.canvas.style.cursor = 'default';
        return;
      }
      this.textMain.setColor('#ffe066');
      this.scene.input.manager.canvas.style.cursor = 'pointer';
    });
    this.container.on('pointerout', () => {
      if (this.disabled) {
        this.scene.input.manager.canvas.style.cursor = 'default';
        return;
      }
      this.textMain.setColor('#ffffff');
      this.topRect.y = 0;
      this.textShadow.y = -1;
      this.textMain.y = 0;
      this.scene.input.manager.canvas.style.cursor = 'default';
    });
    this.container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.disabled) return;
      this.topRect.y = 4;
      this.textShadow.y = 3;
      this.textMain.y = 4;
    });
    this.container.on('pointerup', () => {
      if (this.disabled) return;
      this.topRect.y = 0;
      this.textShadow.y = -1;
      this.textMain.y = 0;
      if (this.callback) this.callback();
    });
  }

  show(props: { x: number; y: number }) {
    this.container.setPosition(props.x, props.y);
    this.container.setVisible(true);
    this.container.setAlpha(1);
    this.container.setScrollFactor(0);
  }
  hide() {
    this.container.setVisible(false);
  }
  destroy() {
    this.container.destroy();
  }

  enable() {
    this.disabled = false;
    this.topRect.clear();
    this.topRect.fillStyle(this.originalColor, 1);
    this.topRect.fillRoundedRect(-this.width/2, -this.height/2, this.width, this.height, 12);
    this.topRect.lineStyle(2, 0xffffff, 0.12);
    this.topRect.strokeRoundedRect(-this.width/2, -this.height/2, this.width, this.height, 12);
    this.sideRect.clear();
    this.sideRect.fillStyle(this.darkColor, 1);
    this.sideRect.fillRoundedRect(-this.width/2, -this.height/2 + 4, this.width, this.height, 12);
    this.textMain.setColor('#fff');
  }

  disable() {
    this.disabled = true;
    this.topRect.clear();
    this.topRect.fillStyle(0x888888, 1);
    this.topRect.fillRoundedRect(-this.width/2, -this.height/2, this.width, this.height, 12);
    this.topRect.lineStyle(2, 0xffffff, 0.12);
    this.topRect.strokeRoundedRect(-this.width/2, -this.height/2, this.width, this.height, 12);
    this.sideRect.clear();
    this.sideRect.fillStyle(0x333333, 1);
    this.sideRect.fillRoundedRect(-this.width/2, -this.height/2 + 4, this.width, this.height, 12);
    this.textMain.setColor('#bbb');
  }

  public isDisabled() {
    return this.disabled;
  }
} 