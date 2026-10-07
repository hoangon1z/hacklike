import { ReactNode, useEffect, useRef } from 'react';
import { CircleCheck, CircleAlert, Info, X } from 'lucide-react';

export function NotificationDialog({title,kind='success',autoCloseMs,onClose,children,actions}: {
  title:string;kind?:'success'|'error'|'info';autoCloseMs?:number;onClose:()=>void;children:ReactNode;actions?:ReactNode;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  useEffect(()=>{if(!autoCloseMs)return;const timer=window.setTimeout(onClose,autoCloseMs);return()=>window.clearTimeout(timer);},[autoCloseMs,onClose]);
  const Icon=kind==='success'?CircleCheck:kind==='error'?CircleAlert:Info;
  return <dialog ref={dialog} className={`order-success-dialog notification-${kind}`} aria-label={title}
    onCancel={event=>{event.preventDefault();onClose();}}>
    <button type="button" className="order-success-close" aria-label="Đóng thông báo" onClick={onClose}><X size={20}/></button>
    <span className="order-success-icon"><Icon size={32} aria-hidden="true"/></span>
    <h2>{title}</h2>{children}
    <div className="order-success-actions"><button type="button" className="secondary" onClick={onClose}>Đóng</button>{actions}</div>
  </dialog>;
}
export function OrderSuccessDialog({ publicId, scheduled, onClose, onViewOrders }: {
  publicId: string; scheduled: boolean; onClose: () => void; onViewOrders: () => void;
}) {
  return <NotificationDialog title={scheduled?'Đã tạo lịch chạy đơn':'Đã tiếp nhận đơn hàng'} onClose={onClose}
    actions={<button type="button" className="primary" autoFocus onClick={onViewOrders}>Xem đơn hàng</button>}>
    <div className="order-success-code"><span>Mã đơn hàng</span><strong>{publicId}</strong></div>
    <p>{scheduled?'Tiền đã được giữ. Đơn sẽ được xử lý theo thời gian bạn đã chọn.':'Bạn có thể theo dõi tiến độ xử lý trong mục Đơn hàng.'}</p>
  </NotificationDialog>;
}
