import Phaser from 'phaser';

export interface IGameState {
  create(scene: Phaser.Scene): void;
  update(scene: Phaser.Scene): void;
  destroy(): void;
}

export enum GameStateType {
  TITLE = 'title',
  MENU = 'menu',
  GAME = 'game',
  EDITOR = 'editor',
  CREATE_GAME = 'create_game',
  MANAGE_TEAM = 'manage_team'
} 