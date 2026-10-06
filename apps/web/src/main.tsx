import { lazy, Suspense } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import './styles.css';
import {PageLoader} from './PageLoader';
const loadApp=()=>import('./App');
const App = lazy(loadApp);
const root = document.getElementById('root')!;
if (window.location.pathname === '/') {
  // Warm the private app bundle only when the visitor intends to open auth.
  const warmAuth=(event:Event)=>{const target=event.target;if(!(target instanceof Element))return;const href=target.closest('a')?.getAttribute('href');if(href==='/login'||href==='/register')void loadApp().catch(()=>{});};
  root.addEventListener('pointerover',warmAuth,{passive:true});
  root.addEventListener('focusin',warmAuth);
  if (root.hasChildNodes()) hydrateRoot(root, <LandingPage />);
  else createRoot(root).render(<LandingPage />);
} else {
  document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex, nofollow');
  document.querySelector('link[rel="canonical"]')?.remove();
  createRoot(root).render(<BrowserRouter><Suspense fallback={<PageLoader/>}><App /></Suspense></BrowserRouter>);
}
