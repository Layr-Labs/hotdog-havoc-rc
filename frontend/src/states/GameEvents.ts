export enum GameEventType {
  STATE_CHANGE = 'state_change',
  WALLET_CONNECTED = 'wallet_connected',
  WALLET_DISCONNECTED = 'wallet_disconnected',
}

export interface GameEvent {
  type: GameEventType;
  data?: any;
}

export type GameEventHandler = (event: GameEvent) => void;

export class GameEventEmitter {
  private static handlers: Map<GameEventType, GameEventHandler[]> = new Map();

  static on(eventType: GameEventType, handler: GameEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  static off(eventType: GameEventType, handler: GameEventHandler): void {
    if (!this.handlers.has(eventType)) return;
    const handlers = this.handlers.get(eventType)!;
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  static emit(event: GameEvent): void {
    if (!this.handlers.has(event.type)) return;
    this.handlers.get(event.type)!.forEach(handler => handler(event));
  }
} 