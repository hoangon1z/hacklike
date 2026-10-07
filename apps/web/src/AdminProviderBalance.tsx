import { useEffect, useState } from 'react';
import { Wallet, RefreshCw } from 'lucide-react';
import { api } from './api';
import { formatVND } from './utils/formatVND';
import './admin-provider-balance.css';

type Provider = { configured:boolean; state:null|{ balance:string; currency:string; status:string; lastCheckedAt:string|null } };
export function AdminProviderBalance() {
  const [provider,setProvider]=useState<Provider|null>(null),[loading,setLoading]=useState(true),[checking,setChecking]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    const load=()=>api<{provider:Provider}>('/admin/system').then(result=>{if(active){setProvider(result.provider);setError('');}}).catch(()=>{if(active)setError('Chưa tải được số dư web cha.');}).finally(()=>{if(active)setLoading(false);});
    void load();const timer=window.setInterval(load,30000);return()=>{active=false;window.clearInterval(timer);};
  },[]);
  async function check(){setChecking(true);setError('');try{const result=await api<{provider:Provider}>('/admin/system/provider/check',{method:'POST'});setProvider(result.provider);}catch{setError('Chưa thể kiểm tra lại số dư. Vui lòng thử lại.');}finally{setChecking(false);}}
  const state=provider?.state;
  const confirmed=!!state && ['HEALTHY','LOW_BALANCE'].includes(state.status);
  const balance=state && (confirmed||Number(state.balance)>0) ? state.currency==='VND'?formatVND(state.balance):`${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:4}).format(Number(state.balance))} ${state.currency}` : 'Chưa có số dư xác nhận';
  const status=!provider?.configured?'Chưa cấu hình':state?.status==='LOW_BALANCE'?'Số dư thấp':state?.status==='HEALTHY'?'Đã cập nhật':state?.status==='UNAVAILABLE'?'Chưa kết nối được':'Chờ kiểm tra';
  return <section className="card admin-provider-summary" aria-label="Số dư web cha" aria-busy={loading||checking}>
    <span className="admin-provider-summary-icon"><Wallet size={25}/></span>
    <div className="admin-provider-summary-value"><small>SỐ DƯ WEB CHA · NHÀ CUNG CẤP</small><strong>{loading?'Đang tải…':balance}</strong><p>{provider?.configured?'Vốn trả trước để chạy đơn, không phải lợi nhuận.':'Cấu hình API nhà cung cấp để kiểm tra số dư.'}</p></div>
    <div className="admin-provider-summary-meta"><span className={confirmed&&state?.status==='HEALTHY'?'provider-ready':'provider-attention'}>{loading?'Đang tải…':status}</span><small>{state?.lastCheckedAt?`${confirmed?'Cập nhật':'Lần kiểm tra'}: ${new Date(state.lastCheckedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}`:'Chưa từng kiểm tra'}</small>{!confirmed&&state&&Number(state.balance)>0&&<small>Số dư lưu trước đó, chưa xác nhận ở lần kiểm tra hiện tại.</small>}<small>Backend kiểm tra mỗi 3 phút.</small></div>
    <button className="secondary" disabled={loading||checking||!provider?.configured} onClick={()=>void check()}><RefreshCw size={16}/>{checking?'Đang kiểm tra…':'Kiểm tra số dư'}</button>
    {error&&<p className="form-error" role="alert">{error}</p>}
  </section>;
}
