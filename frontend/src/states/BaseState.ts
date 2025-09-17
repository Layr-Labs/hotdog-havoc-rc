import Phaser from 'phaser';
import { IGameState } from './GameState';

export abstract class BaseState implements IGameState {
  protected scene: Phaser.Scene;
  protected gameObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(scene: Phaser.Scene): void {
    this.scene = scene;
    this.onCreate();
  }

  update(scene: Phaser.Scene): void {
    this.scene = scene;
    this.onUpdate();
  }

  destroy(): void {
    this.gameObjects.forEach(obj => obj.destroy());
    this.gameObjects = [];
    this.onDestroy();
  }

  protected addGameObject(obj: Phaser.GameObjects.GameObject): void {
    this.gameObjects.push(obj);
  }

  protected abstract onCreate(): void;
  protected abstract onUpdate(): void;
  protected abstract onDestroy(): void;
} 