import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameStateManager } from '../states/GameStateManager';
import { GameStateType } from '../states/GameState';
import { TitleState } from '../states/TitleState';
import { MenuState } from '../states/MenuState';
import { EditorState } from '../states/EditorState';
import { CreateGameState } from '../states/CreateGameState';
import { ManageTeamState } from '../states/ManageTeamState';

const Game = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateManagerRef = useRef<GameStateManager | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#000000',
      scene: {
        preload: preload,
        create: create,
        update: update
      }
    };

    gameRef.current = new Phaser.Game(config);

    const handleResize = () => {
      if (gameRef.current) {
        gameRef.current.scale.resize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh'
      }} 
    />
  );
};

// --- Phaser Scene Functions ---
function preload(this: Phaser.Scene) {
  // Load assets
  this.load.image('title', 'src/images/title.png');
  this.load.image('mainMenu', 'src/images/mainMenu.png');
  this.load.image('hotdog-title-left', 'src/images/hotdog-title-left.png');
  this.load.image('hotdog-title-right', 'src/images/hotdog-title-right.png');
  this.load.image('land', 'src/images/land.png');
  this.load.image('save', 'src/images/save.png');
  this.load.image('load', 'src/images/load.png');
  this.load.image('back', 'src/images/back.png');
  this.load.image('createGame', 'src/images/createGame.png');
  this.load.image('ethereum', 'src/images/ethereum.png');
  this.load.image('hotdog-standing', 'src/images/hotdog-standing.png');
}

function create(this: Phaser.Scene) {
  // Create state manager
  const stateManager = new GameStateManager();
  
  // Register all states with the current scene
  stateManager.registerState(GameStateType.TITLE, new TitleState(this));
  stateManager.registerState(GameStateType.MENU, new MenuState(this));
  stateManager.registerState(GameStateType.EDITOR, new EditorState(this));
  stateManager.registerState(GameStateType.CREATE_GAME, new CreateGameState(this));
  stateManager.registerState(GameStateType.MANAGE_TEAM, new ManageTeamState(this));

  // Set initial state
  stateManager.setState(GameStateType.TITLE, this);

  // Store state manager in scene
  (this as any).stateManager = stateManager;
}

function update(this: Phaser.Scene) {
  const stateManager = (this as any).stateManager as GameStateManager;
  if (stateManager) {
    stateManager.update(this);
  }
}

export default Game; 