import Phaser from 'phaser';
import { IGameState, GameStateType } from './GameState';
import { GameEventEmitter, GameEventType, GameEvent } from './GameEvents';

export class GameStateManager {
  private states: Map<GameStateType, IGameState>;
  private currentState: IGameState | null = null;
  private currentStateType: GameStateType | null = null;
  private scene!: Phaser.Scene;

  constructor() {
    this.states = new Map();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    GameEventEmitter.on(GameEventType.STATE_CHANGE, (event: GameEvent) => {
      if (event.data?.state) {
        this.setState(event.data.state, this.scene);
      }
    });
  }

  registerState(type: GameStateType, state: IGameState): void {
    this.states.set(type, state);
  }

  setState(type: GameStateType, scene: Phaser.Scene): void {
    // Store the scene reference
    this.scene = scene;

    // Clean up current state if it exists
    if (this.currentState) {
      this.currentState.destroy();
    }

    // Get and initialize new state
    const newState = this.states.get(type);
    if (!newState) {
      console.error(`State ${type} not registered`);
      return;
    }

    this.currentState = newState;
    this.currentStateType = type;
    this.currentState.create(scene);
  }

  update(scene: Phaser.Scene): void {
    if (this.currentState) {
      this.currentState.update(scene);
    }
  }

  getCurrentStateType(): GameStateType | null {
    return this.currentStateType;
  }
} 