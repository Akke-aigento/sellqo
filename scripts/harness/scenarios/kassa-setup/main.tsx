import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DeviceSetup } from '@/kassa/app/screens/DeviceSetup';

// eslint-disable-next-line react-refresh/only-export-components -- harnas-ingang, geen HMR nodig
function App() {
  const [done, setDone] = useState<string | null>(null);
  return done ? <p id="gekoppeld" className="p-6">Gekoppeld aan {done}</p> : <DeviceSetup onDone={(d) => setDone(d.terminalRowId)} />;
}
createRoot(document.getElementById('root')!).render(<App />);
