// Owner: Danah (routing + Home). Each game screen lives in its owner's folder.
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './theme/theme.css';
import { PaintFilters } from './theme/Logo.jsx';
import { Home } from './theme/Home.jsx';
import HostApp from './host/HostApp.jsx';
import PlayerApp from './player/PlayerApp.jsx';

// Design references (SPEC §6.1) — loaded only when someone opens them, not part of the product.
const Preview = lazy(() => import('./theme/Preview.jsx'));
const Flow = lazy(() => import('./theme/Flow.jsx'));

// One Home for every device (SPEC §2.2, §2.3 step 1). The choice decides what this device becomes.
function HomePage() {
  const go = useNavigate();
  return <Home onJoin={() => go('/play')} onBigScreen={() => go('/host')} onPhones={() => go('/play/new')} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PaintFilters />
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/host/*" element={<HostApp />} />
          <Route path="/play/*" element={<PlayerApp />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/flow" element={<Flow />} />
          <Route path="/flow/:screen" element={<Flow />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
