import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './api';
import {depositNotice,DepositStatusRecord} from './depositStatus';

export type DepositRecord = DepositStatusRecord & {
  method: 'BANKING'|'USDT_TRC20'|'USDT_BEP20';
  expectedUsdt: string|null; paymentCode: string; network: string|null;
  destinationAddress: string|null; expiresAt: string;
  banking: null|{id?:string;bankName:string;accountNumber:string;virtualAccountNumber?:string;accountName:string};
};
export type DepositNotice = {id:string;kind:'success'|'error'|'info';title:string;request:DepositRecord};
const inMemorySeen = new Set<string>();
function readIds(key:string):string[] {
  try {const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[];} catch {return [];}
}
function saveIds(key:string,values:Iterable<string>) {try {localStorage.setItem(key,JSON.stringify([...values]));} catch {/* Polling still works if storage is unavailable. */}}
export function useDepositMonitor(userId:string) {
  const pendingKey=`deposit-pending:${userId}`,seenKey=`deposit-notified:${userId}`;
  const tracked=useRef(new Set(readIds(pendingKey)));
  const [rows,setRows]=useState<DepositRecord[]>([]),[ready,setReady]=useState(false);
  const [restored,setRestored]=useState<DepositRecord|null>(null);
  const [error,setError]=useState(''),[checking,setChecking]=useState(false);
  const [notices,setNotices]=useState<DepositNotice[]>([]);
  const [revision,setRevision]=useState(0);
  const initialized=useRef(false),previousCredits=useRef(new Map<string,string>());
  const retry=useCallback(()=>setRevision(x=>x+1),[]);
  const track=useCallback((request:DepositRecord)=>{
    tracked.current.add(request.publicId);saveIds(pendingKey,tracked.current);
    setRows(old=>[request,...old.filter(x=>x.publicId!==request.publicId)].slice(0,50));
  },[pendingKey]);
  useEffect(()=>{
    let active=true,timer:number|undefined;
    let controller:AbortController|undefined;
    async function poll() {
      controller=new AbortController();
      setChecking(true);
      const timeout=window.setTimeout(()=>controller?.abort(),15000);
      try {
        const fetched=await api<DepositRecord[]>('/payments/deposits',{signal:controller.signal});
        if(!active)return;
        if(!initialized.current) {
          const remembered=fetched.find(x=>tracked.current.has(x.publicId));
          const waiting=fetched.filter(x=>['CREATED','WAITING','CONFIRMING','UNDERPAID','MANUAL_REVIEW','UNMATCHED','EXPIRED'].includes(x.status));
          waiting.forEach(x=>tracked.current.add(x.publicId));
          setRestored(remembered??waiting.find(x=>new Date(x.expiresAt).getTime()>Date.now())??null);
          initialized.current=true;
        }
        const seen=new Set(readIds(seenKey));
        const notifications:DepositNotice[]=[];
        let changed=false;
        for(const request of fetched) {
          if(!tracked.current.has(request.publicId))continue;
          const before=previousCredits.current.get(request.publicId);
          const credited=String(request.creditedVnd??0);
          if(Number(credited)>0 && (before===undefined || before!==credited))changed=true;
          previousCredits.current.set(request.publicId,credited);
          const notice=depositNotice(request);
          if(notice) {
            const key=`${userId}:${request.publicId}:${notice.kind}`;
            if(!seen.has(key)&&!inMemorySeen.has(key)) {
              seen.add(key);inMemorySeen.add(key);
              notifications.push({id:key,...notice,request});
              if(notice.kind==='success')changed=true;
            }
            tracked.current.delete(request.publicId);
          }
        }
        saveIds(seenKey,seen);saveIds(pendingKey,tracked.current);
        setRows(fetched);setError('');setReady(true);
        if(notifications.length)setNotices(old=>[...old,...notifications]);
        if(changed){window.dispatchEvent(new Event('wallet-updated'));window.dispatchEvent(new Event('notifications-updated'));}
      } catch {
        if(active)setError('Không thể kiểm tra trạng thái giao dịch. Vui lòng thử lại.');
      } finally {
        window.clearTimeout(timeout);
        if(active){setChecking(false);timer=window.setTimeout(poll,4000);}
      }
    }
    void poll();
    return ()=>{active=false;controller?.abort();window.clearTimeout(timer);};
  },[pendingKey,seenKey,userId,revision]);
  const dismiss=useCallback(()=>setNotices(old=>old.slice(1)),[]);
  return {rows,ready,restored,error,checking,track,retry,notice:notices[0]??null,dismiss};
}
