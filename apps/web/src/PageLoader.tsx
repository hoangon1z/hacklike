import './page-loader.css';
export function PageLoader(){
  return <div className="hl-page-loader" role="status" aria-live="polite" aria-label="Đang tải trang"><div className="hl-page-loader-content"><div className="hl-page-loader-mark" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg></div><strong>Hacklike<span>43</span></strong><div className="hl-page-loader-track" aria-hidden="true"><i/></div><p>Đang tải trang…</p></div></div>;
}
