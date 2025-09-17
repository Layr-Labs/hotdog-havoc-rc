import WebFont from 'webfontloader';

export const loadGameFont = (): Promise<void> => {
  return new Promise((resolve) => {
    WebFont.load({
      google: { families: ['Press Start 2P'] },
      active: () => resolve(),
      inactive: () => resolve() // fallback if font fails
    });
  });
}; 