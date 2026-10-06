import './page-loader.css';
import {BrandLogo} from './BrandLogo';
export function PageLoader(){
  return <div className="hl-page-loader" role="status" aria-live="polite" aria-label="Đang tải trang"><div className="hl-page-loader-content"><BrandLogo/><div className="hl-page-loader-track" aria-hidden="true"><i/></div><p>Đang tải trang…</p></div></div>;
}
