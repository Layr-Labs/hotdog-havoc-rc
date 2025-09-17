import Phaser from 'phaser';

interface WindowProps {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollFactor?: number;
}

export class Window {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private closeButton: Phaser.GameObjects.Text | null = null;
  private visible: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private windowWidth: number = 0;
  private windowHeight: number = 0;
  private children: { x: number; y: number; component: any; props?: any }[] = [];
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.container = scene.add.container(0, 0);
    this.container.setAlpha(0);
    this.container.setScale(0.8);
    this.container.setVisible(false);
    this.container.add(this.graphics);
  }

  show(props: WindowProps) {
    const { x, y, width, height, scrollFactor = 0 } = props;
    
    // Calculate the top-left corner based on center position
    this.startX = x - (width / 2);
    this.startY = y - (height / 2);
    this.windowWidth = width;
    this.windowHeight = height;

    // Position the container at the window center
    this.container.setPosition(x, y);
    this.container.setDepth(1000);
    this.container.setVisible(true);

    // Draw semi-transparent black background
    this.graphics.clear();
    this.graphics.fillStyle(0x000000, 0.5);
    this.graphics.fillRect(-width/2, -height/2, width, height);
    
    // Draw white border
    this.graphics.lineStyle(1, 0xffffff, 1);
    this.graphics.strokeRect(-width/2, -height/2, width, height);
    
    this.visible = true;

    // Create close button
    if (this.closeButton) {
      this.closeButton.destroy();
    }
    const padding = 16; // Equal padding for top and right
    this.closeButton = this.scene.add.text(width/2 - padding, -height/2 + padding, 'X', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#ffffff',
      align: 'center'
    });
    this.closeButton.setOrigin(0.5, 0.5);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.setScrollFactor(scrollFactor);
    this.container.add(this.closeButton);

    // Add hover effects
    this.closeButton.on('pointerover', () => {
      if (this.closeButton) {
        this.closeButton.setColor('#ffe066');
        this.scene.tweens.add({
          targets: this.closeButton,
          scale: 1.2,
          duration: 120,
          ease: 'Sine.easeOut'
        });
      }
    });

    this.closeButton.on('pointerout', () => {
      if (this.closeButton) {
        this.closeButton.setColor('#ffffff');
        this.scene.tweens.add({
          targets: this.closeButton,
          scale: 1,
          duration: 120,
          ease: 'Sine.easeIn'
        });
      }
    });

    this.closeButton.on('pointerdown', () => {
      if (this.closeButton) {
        this.scene.tweens.add({
          targets: this.closeButton,
          scale: 0.9,
          duration: 80,
          yoyo: true,
          ease: 'Sine.easeInOut'
        });
      }
      // Wait one tick before hiding the window to ensure click event is fully processed
      this.scene.time.delayedCall(0, () => {
        this.hide();
      });
    });

    // Show all child components
    this.children.forEach(child => {
      if (child.component) {
        child.component.show({
          ...(child.props || {}),
          x: -this.windowWidth/2 + child.x,
          y: -this.windowHeight/2 +child.y,
        });
        // Add the display object to the container at the correct offset
        if (child.component.displayObject) {
          child.component.displayObject.setPosition(child.x, child.y);
          this.container.add(child.component.displayObject);
        }
      }
    });

    // Animate fade+scale in
    this.container.setAlpha(0);
    this.container.setScale(0.8);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.Out'
    });
  }

  addChild(x: number, y: number, component: any, props?: any) {
    this.children.push({ x, y, component, props });
    // No need to show or add to container here; handled in show()
  }

  hide() {
    // Animate fade+scale out
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.8,
      duration: 200,
      ease: 'Back.In',
      onComplete: () => {
        this.container.setVisible(false);
        this.graphics.clear();
        if (this.closeButton) {
          this.closeButton.destroy();
          this.closeButton = null;
        }
        // Hide all child components
        this.children.forEach(child => {
          if (child.component) {
            child.component.hide();
          }
        });
        this.visible = false;
        this.children = [];
      }
    });
  }

  isVisible(): boolean {
    return this.visible;
  }

  isClickOnCloseButton(x: number, y: number): boolean {
    if (!this.closeButton || !this.visible) return false;
    return this.closeButton.getBounds().contains(x, y);
  }

  getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.startX,
      this.startY,
      this.windowWidth,
      this.windowHeight
    );
  }

  destroy() {
    this.hide();
    this.children.forEach(child => {
      child.component.destroy();
    });
    this.children = [];
  }

  getWidth(): number {
    return this.windowWidth;
  }

  getHeight(): number {
    return this.windowHeight;
  }

  setDimensions(width: number, height: number) {
    this.windowWidth = width;
    this.windowHeight = height;
  }
} 