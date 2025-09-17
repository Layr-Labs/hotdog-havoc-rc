import { useEffect, useState } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import Game from './components/Game';
import UI from './components/UI';
import { loadGameFont } from './utils/fontLoader';

function App() {
  const [fontLoaded, setFontLoaded] = useState(false);

  useEffect(() => {
    loadGameFont().then(() => {
      setFontLoaded(true);
    });
  }, []);

  if (!fontLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <ChakraProvider>
      <Game />
      <UI />
    </ChakraProvider>
  );
}

export default App; 