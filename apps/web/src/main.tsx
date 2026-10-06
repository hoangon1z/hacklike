import { lazy, Suspense } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import './styles.css';
const App = lazy(() => import('./App'));
const root = document.getElementById('root')!;
if (window.location.pathname === '/') {
  if (root.hasChildNodes()) hydrateRoot(root, <LandingPage />);
  else createRoot(root).render(<LandingPage />);
} else {
  document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex, nofollow');
  document.querySelector('link[rel="canonical"]')?.remove();
  createRoot(root).render(<BrowserRouter><Suspense fallback={<div role="status" className="app-loading">Đang tải Hacklike43…</div>}><App /></Suspense></BrowserRouter>);
}
