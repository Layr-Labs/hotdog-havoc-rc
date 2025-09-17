import Phaser from 'phaser';

interface InputFieldProps {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  scrollFactor?: number;
}

export class InputField {
  private scene: Phaser.Scene;
  private parent: Phaser.GameObjects.Container | null = null;
  private graphics: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private cursor!: Phaser.GameObjects.Rectangle;
  private cursorBlinkTimer: Phaser.Time.TimerEvent | null = null;
  private value: string = '';
  private isFocused: boolean = false;
  private padding: number = 8;
  private height: number;
  private cursorIndex: number = 0;
  private scrollOffset: number = 0;
  private visibleText: string = '';
  private width: number = 0;
  private fontSize: number = 12;
  private scrollStart: number = 0;
  private inputChangeCallback: ((nextValue: string) => boolean) | null = null;
  private afterUpdateCallback: (() => void) | null = null;
  private justPasted: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.height = 0; // Will be set in show()
    // Create container for all elements
    this.parent = this.scene.add.container(0, 0);
    this.parent.setVisible(false);
    // Draw background (will be updated in show)
    this.parent.add(this.graphics);
    // Create text object
    this.text = this.scene.add.text(0, 0, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `12px`,
      color: '#000000',
      align: 'left'
    });
    this.text.setOrigin(0, 0.5);
    this.parent.add(this.text);
    // Create cursor
    this.cursor = this.scene.add.rectangle(0, 0, 2, 12, 0x000000);
    this.cursor.setOrigin(0, 0.5);
    this.cursor.setVisible(false);
    this.parent.add(this.cursor);
    // Handle keyboard input
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.on('keydown', this.handleKeyDown, this);
    }
    this.cursorIndex = this.value.length;
    this.scrollOffset = 0;
    window.addEventListener('paste', this.handlePaste);
  }

  show(props: InputFieldProps) {
    const { x = 0, y = 0, width, fontSize, scrollFactor = 0 } = props;
    this.height = fontSize + (this.padding * 2);
    this.width = width;
    this.fontSize = fontSize;
    this.scrollStart = 0;
    if (!this.parent) return;
    // Update background
    this.graphics.clear();
    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillRoundedRect(-width/2, -this.height/2, width, this.height, 4);
    // Update text and cursor font size/position
    this.text.setFontSize(fontSize);
    this.text.setX(-width/2 + this.padding);
    this.cursor.setSize(2, fontSize);
    this.cursor.setX(-width/2 + this.padding);
    // Update container position and visibility
    this.parent.setScrollFactor(scrollFactor);
    this.parent.setVisible(true);
    // Wait 1 second before attaching interactive area and pointerdown handler
    this.scene.time.delayedCall(1000, () => {
      if (!this.parent) return;
      this.parent.setInteractive(new Phaser.Geom.Rectangle(-width/2, -this.height/2, width, this.height), Phaser.Geom.Rectangle.Contains);
      this.parent.off('pointerdown');
      this.parent.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.setFocused(true);
        // Only set cursor if clicking inside the text area
        const localX = pointer.x - this.parent!.x;
        const textStartX = this.text.x;
        let minDist = Infinity;
        let bestIndex = 0;
        // Use a temp text object to measure each substring
        const tempText = this.scene.add.text(0, 0, '', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: `${this.fontSize}px`,
          color: '#000000',
          align: 'left',
          maxLines: 1
        });
        for (let i = 0; i <= this.visibleText.length; i++) {
          tempText.setText(this.visibleText.substring(0, i));
          const charX = textStartX + tempText.displayWidth;
          const dist = Math.abs(localX - charX);
          if (dist < minDist) {
            minDist = dist;
            bestIndex = i;
          }
        }
        tempText.destroy();
        // Adjust for scroll offset
        const start = this.value.indexOf(this.visibleText);
        this.cursorIndex = (start >= 0 ? start : 0) + bestIndex;
        this.updateText();
      });
    });
    this.updateText();
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() === 'v' && (event.ctrlKey || event.metaKey)) {
      return;
    }
    if (!this.isFocused) return;

    if (event.key === 'Backspace') {
      if (this.cursorIndex > 0) {
        this.value = this.value.slice(0, this.cursorIndex - 1) + this.value.slice(this.cursorIndex);
        this.cursorIndex--;
        this.updateText();
        if (this.afterUpdateCallback) this.afterUpdateCallback();
      }
    } else if (event.key === 'Delete') {
      if (this.cursorIndex < this.value.length) {
        this.value = this.value.slice(0, this.cursorIndex) + this.value.slice(this.cursorIndex + 1);
        this.updateText();
        if (this.afterUpdateCallback) this.afterUpdateCallback();
      }
    } else if (event.key === 'ArrowLeft') {
      if (this.cursorIndex > 0) {
        this.cursorIndex--;
        this.updateText();
      }
    } else if (event.key === 'ArrowRight') {
      if (this.cursorIndex < this.value.length) {
        this.cursorIndex++;
        this.updateText();
      }
    } else if (event.key === 'Home') {
      this.cursorIndex = 0;
      this.updateText();
    } else if (event.key === 'End') {
      this.cursorIndex = this.value.length;
      this.updateText();
    } else if (event.key === 'Enter') {
      this.setFocused(false);
    } else if (event.key.length === 1) {
      const nextValue = this.value.slice(0, this.cursorIndex) + event.key + this.value.slice(this.cursorIndex);
      if (this.inputChangeCallback && this.inputChangeCallback(nextValue) === false) {
        return;
      }
      this.value = nextValue;
      this.cursorIndex++;
      this.updateText();
      if (this.afterUpdateCallback) this.afterUpdateCallback();
    }
  }

  private updateText() {
    // Calculate visible text and scroll offset
    const availableWidth = this.width - 2 * this.padding;
    let cursorX = 0;
    // Use a temporary text object to measure substrings
    const tempText = this.scene.add.text(0, 0, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${this.fontSize}px`,
      color: '#000000',
      align: 'left',
      maxLines: 1
    });

    // 1. Scroll left if cursor is before scrollStart
    if (this.cursorIndex < this.scrollStart) {
      this.scrollStart = this.cursorIndex;
    }

    // 2. Find the max end index that fits from scrollStart
    let maxEnd = this.value.length;
    tempText.setText(this.value.substring(this.scrollStart, maxEnd));
    while (tempText.displayWidth > availableWidth && maxEnd > this.scrollStart) {
      maxEnd--;
      tempText.setText(this.value.substring(this.scrollStart, maxEnd));
    }

    // 3. If cursor is past maxEnd, scroll right
    if (this.cursorIndex > maxEnd) {
      this.scrollStart += this.cursorIndex - maxEnd;
      // Recalculate maxEnd after scrolling
      maxEnd = this.value.length;
      tempText.setText(this.value.substring(this.scrollStart, maxEnd));
      while (tempText.displayWidth > availableWidth && maxEnd > this.scrollStart) {
        maxEnd--;
        tempText.setText(this.value.substring(this.scrollStart, maxEnd));
      }
    }

    // 4. If cursor is at the start of the visible box and not at the start of the string, scroll left to reveal more text
    if (this.cursorIndex === this.scrollStart && this.scrollStart > 0) {
      // Try to scroll left by one and still fit
      let newScrollStart = this.scrollStart - 1;
      let newMaxEnd = this.value.length;
      tempText.setText(this.value.substring(newScrollStart, newMaxEnd));
      while (tempText.displayWidth > availableWidth && newMaxEnd > newScrollStart) {
        newMaxEnd--;
        tempText.setText(this.value.substring(newScrollStart, newMaxEnd));
      }
      // If the cursor is still visible, update scrollStart and maxEnd
      if (this.cursorIndex >= newScrollStart && this.cursorIndex <= newMaxEnd) {
        this.scrollStart = newScrollStart;
        maxEnd = newMaxEnd;
      }
    }

    this.visibleText = this.value.substring(this.scrollStart, maxEnd);
    this.text.setText(this.visibleText);
    // Set cursor position
    tempText.setText(this.visibleText.substring(0, this.cursorIndex - this.scrollStart));
    cursorX = this.text.x + tempText.displayWidth;
    this.cursor.setX(cursorX);
    tempText.destroy();
  }

  private outsidePointerDownHandler = (pointer: Phaser.Input.Pointer) => {
    if (!this.parent || !this.isFocused) return;
    const bounds = this.parent.getBounds();
    if (!bounds.contains(pointer.x, pointer.y)) {
      this.setFocused(false);
    }
  };

  private setFocused(focused: boolean) {
    this.isFocused = focused;
    this.cursor.setVisible(focused);

    if (focused) {
      // Stop any existing cursor blink timer before starting a new one
      if (this.cursorBlinkTimer) {
        this.cursorBlinkTimer.destroy();
        this.cursorBlinkTimer = null;
      }
      // Start cursor blink
      this.cursorBlinkTimer = this.scene.time.addEvent({
        delay: 500,
        callback: () => {
          this.cursor.setVisible(!this.cursor.visible);
        },
        loop: true
      });
      // Listen for outside clicks (with delay to avoid immediate blur)
      setTimeout(() => {
        if (this.isFocused) {
          this.scene.input.on('pointerdown', this.outsidePointerDownHandler, this);
        }
      }, 0);
    } else {
      // Stop cursor blink
      if (this.cursorBlinkTimer) {
        this.cursorBlinkTimer.destroy();
        this.cursorBlinkTimer = null;
      }
      this.cursor.setVisible(false);
      // Remove outside click listener
      this.scene.input.off('pointerdown', this.outsidePointerDownHandler, this);
    }
  }

  getValue(): string {
    return this.value;
  }

  setValue(value: string) {
    this.value = value;
    this.cursorIndex = value.length;
    this.updateText();
  }

  hide() {
    if (this.parent) {
      this.parent.setVisible(false);
    }
    this.setFocused(false);
  }

  destroy() {
    this.hide();
    if (this.parent) {
      this.parent.destroy();
      this.parent = null;
    }
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.off('keydown', this.handleKeyDown, this);
    }
    this.scene.input.off('pointerdown', this.outsidePointerDownHandler, this);
    window.removeEventListener('paste', this.handlePaste);
  }

  get displayObject() {
    return this.parent;
  }

  public onInputChange(cb: (nextValue: string) => boolean) {
    this.inputChangeCallback = cb;
  }

  private handlePaste = (event: ClipboardEvent) => {
    console.log("handlePaste", event);
    if (!this.isFocused) return;
    const paste = event.clipboardData?.getData('text');
    if (!paste) return;

    // Create the new value that would result from the paste
    const newValue = this.value.slice(0, this.cursorIndex) + paste + this.value.slice(this.cursorIndex);
    
    // Validate the new value if we have a callback
    if (this.inputChangeCallback && this.inputChangeCallback(newValue) === false) {
      event.preventDefault();
      return;
    }

    // If validation passes, update the value
    this.value = newValue;
    this.cursorIndex += paste.length;
    this.updateText();
    this.justPasted = true;
    if (this.afterUpdateCallback) this.afterUpdateCallback();
    event.preventDefault();
  };

  public onAfterUpdate(cb: () => void) {
    this.afterUpdateCallback = cb;
  }
} 