import Phaser from 'phaser';

export function createSkyGradient(scene: Phaser.Scene): Phaser.GameObjects.Image | null {
  const bgCreated = drawSkyGradientTexture(scene);
  if (!bgCreated) {
    console.warn('Could not create gradient background.');
    return null;
  }

  const bgImage = scene.add.image(0, 0, 'sky-gradient')
    .setOrigin(0, 0)
    .setDisplaySize(scene.scale.width, scene.scale.height);
  bgImage.setDepth(-100);
  return bgImage;
}

export function drawSkyGradientTexture(scene: Phaser.Scene): boolean {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#2a2251');
  gradient.addColorStop(0.5, '#4e3c7c');
  gradient.addColorStop(1, '#8a7bbd');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  if (scene.textures.exists('sky-gradient')) {
    scene.textures.remove('sky-gradient');
  }
  scene.textures.addCanvas('sky-gradient', canvas);
  return true;
} 