import Phaser from 'phaser';

interface ScrollListProps {
  width: number;
  height: number;
  items: { text: string; callback: () => void }[];
  fontSize?: number;
  itemHeight?: number;
}

export class ScrollList {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private outline: Phaser.GameObjects.Graphics;
  private textItems: Phaser.GameObjects.Text[];
  private scrollUpButton: Phaser.GameObjects.Text;
  private scrollDownButton: Phaser.GameObjects.Text;
  private scrollY: number = 0;
  private readonly itemHeight: number;
  private readonly fontSize: number;
  private readonly width: number;
  private readonly height: number;
  private readonly items: { text: string; callback: () => void }[];
  private itemsContainer: Phaser.GameObjects.Container;
  private maskGraphics: Phaser.GameObjects.RenderTexture | undefined = undefined;
  private mask: Phaser.Display.Masks.BitmapMask | undefined = undefined;
  private scrollBar: Phaser.GameObjects.Graphics;
  private isDraggingScrollBar: boolean = false;
  private dragOffsetY: number = 0;
  private selectedIndex: number | null = null;

  public get displayObject(): Phaser.GameObjects.Container {
    return this.container;
  }

  constructor(scene: Phaser.Scene, props: ScrollListProps) {
    this.scene = scene;
    this.width = props.width;
    this.height = props.height;
    this.items = props.items;
    this.fontSize = props.fontSize || 16;
    this.itemHeight = props.itemHeight || 24;
    this.textItems = [];

    // Create container at (0,0) (top-left)
    this.container = new Phaser.GameObjects.Container(scene, 0, 0);
    this.container.setScrollFactor(0);
    
    // Create outline (full rectangle)
    this.outline = new Phaser.GameObjects.Graphics(scene);
    this.outline.setScrollFactor(0);
    this.outline.lineStyle(1, 0xffffff, 1);
    this.outline.strokeRect(0, 0, this.width, this.height);
    this.container.add(this.outline);

    // Add itemsContainer directly to the scene
    this.itemsContainer = new Phaser.GameObjects.Container(scene, 0, 0);
    this.container.add(this.itemsContainer);

    // Set up mouse wheel scrolling for the container
    this.container.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.width, this.height), Phaser.Geom.Rectangle.Contains);
    this.container.on('wheel', (pointer: Phaser.Input.Pointer, deltaX: number, deltaY: number, deltaZ: number, event: WheelEvent) => {
        // Stop the event from propagating to the world
      event.stopPropagation();
      
      const totalHeight = this.items.length * this.itemHeight;
      if (totalHeight <= this.height) return;
      
      // Scroll by 1 item worth of height for each wheel step
      const scrollAmount = this.itemHeight;
      this.scroll(deltaY > 0 ? -scrollAmount : scrollAmount);
    });

    // Create scroll buttons (right side, inside the box)
    this.scrollUpButton = new Phaser.GameObjects.Text(scene, this.width - 16, 16, 'v', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px',
      color: '#ffffff'
    });
    this.scrollUpButton.setOrigin(0.5, 0.5);
    this.scrollUpButton.setScrollFactor(0);
    this.scrollUpButton.setRotation(Math.PI); // Flip upside down
    this.scrollUpButton.setInteractive({ useHandCursor: true });
    this.scrollUpButton.on('pointerover', () => {
      this.scrollUpButton.setColor('#ffe066');
      this.scene.tweens.add({
        targets: this.scrollUpButton,
        scale: 1.2,
        duration: 120,
        ease: 'Sine.easeOut'
      });
    });
    this.scrollUpButton.on('pointerout', () => {
      this.scrollUpButton.setColor('#ffffff');
      this.scene.tweens.add({
        targets: this.scrollUpButton,
        scale: 1,
        duration: 120,
        ease: 'Sine.easeIn'
      });
    });
    this.scrollUpButton.on('pointerdown', () => {
      this.scroll(this.itemHeight);
    });
    this.container.add(this.scrollUpButton);

    this.scrollDownButton = new Phaser.GameObjects.Text(scene, this.width - 16, this.height - 16, 'v', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px',
      color: '#ffffff'
    });
    this.scrollDownButton.setOrigin(0.5, 0.5);
    this.scrollDownButton.setScrollFactor(0);
    this.scrollDownButton.setInteractive({ useHandCursor: true });
    this.scrollDownButton.on('pointerover', () => {
      this.scrollDownButton.setColor('#ffe066');
      this.scene.tweens.add({
        targets: this.scrollDownButton,
        scale: 1.2,
        duration: 120,
        ease: 'Sine.easeOut'
      });
    });
    this.scrollDownButton.on('pointerout', () => {
      this.scrollDownButton.setColor('#ffffff');
      this.scene.tweens.add({
        targets: this.scrollDownButton,
        scale: 1,
        duration: 120,
        ease: 'Sine.easeIn'
      });
    });
    this.scrollDownButton.on('pointerdown', () => {
      this.scroll(-this.itemHeight);
    });
    this.container.add(this.scrollDownButton);

    // Create scroll bar
    this.scrollBar = new Phaser.GameObjects.Graphics(this.scene);
    this.scrollBar.setScrollFactor(0);
    this.container.add(this.scrollBar);

    // Create items
    this.createItems();

  }

  private updateItemVisibility(): void {
    this.textItems.forEach((text, index) => {
      const itemY = (index * this.itemHeight) + this.scrollY + this.itemHeight/2;
      if (itemY < 0 || itemY > this.height) {
        text.setVisible(false);
      } else {
        text.setVisible(true);
      }
    });
  }

  private updateScrollBar(): void {
    this.scrollBar.clear();
    const totalHeight = this.items.length * this.itemHeight;
    const barArea = this.getScrollBarArea();
    if (totalHeight <= this.height) {
      this.scrollBar.disableInteractive();
      return;
    }

    // Calculate scrollbar height and position
    const barHeight = this.getScrollBarHeight();
    const barY = this.getScrollBarY();
    const barWidth = barArea.width;

    // Draw the bar
    this.scrollBar.fillStyle(0xffffff, 1);
    this.scrollBar.fillRect(barArea.x, barY, barWidth, barHeight);
  }

  private createItems(): void {
    // Clear existing items
    this.textItems.forEach(item => item.destroy());
    this.textItems = [];
    this.itemsContainer.removeAll(true); // Remove all children from itemsContainer

    // Create new items
    this.items.forEach((item, index) => {
      const isSelected = this.selectedIndex === index;
      const color = isSelected ? '#ffe066' : '#ffffff';
      const text = new Phaser.GameObjects.Text(this.scene, 8, (index * this.itemHeight) + this.scrollY + this.itemHeight/2, item.text, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${this.fontSize}px`,
        color,
      });
      text.setOrigin(0, 0.5);
      text.setScrollFactor(0);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => {
        if (this.selectedIndex !== index) text.setColor('#ffe066');
      });
      text.on('pointerout', () => {
        text.setColor(this.selectedIndex === index ? '#ffe066' : '#ffffff');
      });
      text.on('pointerdown', () => {
        this.selectedIndex = index;
        this.updateSelectedColors();
        item.callback();
      });
      this.itemsContainer.add(text);
      this.textItems.push(text);
    });
    this.updateItemVisibility();
    this.updateScrollBar();
  }

  private scroll(deltaY: number): void {
    const totalHeight = this.items.length * this.itemHeight;
    const maxScroll = Math.max(0, totalHeight - this.height);
    this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY, -maxScroll, 0);
    this.itemsContainer.y = this.scrollY;
    this.updateItemVisibility();
    this.updateScrollBar();
  }

  show(props: { x: number; y: number }) {
    this.container.setPosition(props.x, props.y);
    this.itemsContainer.setPosition(0, 0);
    this.updateScrollBar(); // Make sure scroll bar is updated when shown
  }

  hide() {
    this.container.setVisible(false);
  }

  destroy() {
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
    }
    if (this.itemsContainer) {
      this.itemsContainer.destroy();
    }
    this.container.destroy();
  }

  private getScrollBarArea() {
    // Calculate the area between the up and down buttons
    const upButtonY = this.scrollUpButton.y + this.scrollUpButton.height / 2;
    const downButtonY = this.scrollDownButton.y - this.scrollDownButton.height / 2;
    const barX = this.width - 28; // Align with "V" button width
    const barY = upButtonY;
    const barHeight = downButtonY - upButtonY;
    return { x: barX, y: barY, width: 25, height: barHeight };
  }

  private getScrollBarHeight(): number {
    const totalHeight = this.items.length * this.itemHeight;
    const barArea = this.getScrollBarArea();
    if (totalHeight <= this.height) return barArea.height;
    return Math.max((this.height / totalHeight) * barArea.height, 20);
  }

  private getScrollBarY(): number {
    const totalHeight = this.items.length * this.itemHeight;
    const barArea = this.getScrollBarArea();
    if (totalHeight <= this.height) return barArea.y;
    const scrollRatio = -this.scrollY / (totalHeight - this.height);
    return barArea.y + scrollRatio * (barArea.height - this.getScrollBarHeight());
  }

  private updateSelectedColors() {
    this.textItems.forEach((text, idx) => {
      text.setColor(this.selectedIndex === idx ? '#ffe066' : '#ffffff');
    });
  }

  public setSelectedIndex(idx: number) {
    this.selectedIndex = idx;
    this.updateSelectedColors();
  }
} 