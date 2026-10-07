import {formatVND} from './utils/formatVND';
import { FormEvent, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, ApiError, SessionUser } from './api';
import './customer-design.css';
import { ArrowDownLeft, ArrowUpRight, Bell, BookOpen, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, CreditCard, Headphones, Mail, Megaphone, Plus, Send, Settings2, ShieldCheck, Sparkles, Tag, TrendingUp, UserRound, Wallet } from 'lucide-react';

type Post={id:string;title:string;content:string;kind:string;published:boolean;createdAt:string};
type Notification={id:string;title:string;content:string;status?:string;createdAt:string;href:string;read:boolean};
type Summary={historicalDeposited?:number;totalDeposited:number;totalSpent:number;orderCount:number;newOrders:number;averageOrder:number;daily:{date:string;amount:number}[];posts:Post[]};
const statuses:Record<string,string>={CREATED:'Đã tạo',SCHEDULED:'Đã hẹn giờ',FUNDS_RESERVED:'Đã tiếp nhận',QUEUED:'Đang chờ xử lý',WAITING_PROVIDER_BALANCE:'Đang chờ xử lý',WAITING_PROVIDER_SYNC:'Đang chờ xử lý',SUBMITTING:'Đang xử lý',SUBMITTED:'Đã gửi',IN_PROGRESS:'Đang chạy',COMPLETED:'Hoàn thành',PARTIAL:'Hoàn thành một phần',CANCELED:'Đã hủy',REFUNDED:'Đã hoàn tiền',MANUAL_REVIEW:'Đang được kiểm tra',SUBMISSION_UNKNOWN:'Đang được kiểm tra',PRICE_CONFLICT:'Cần kiểm tra lại giá'};
function SupportChannels(){
  const [channels,setChannels]=useState<{telegram:string|null;fanpage:string|null}|null>(null);
  useEffect(()=>{api<typeof channels>('/health/capabilities').then(setChannels).catch(()=>{});},[]);
  const safe=(url:string|null|undefined)=>url&&/^https:\/\//i.test(url)?url:null;
  return <section className="card support-panel"><div className="support-emblem"><Headphones size={25}/></div><span className="section-kicker">LUÔN SẴN SÀNG KẾT NỐI</span><h2>Bạn cần hỗ trợ?</h2><p>Giải đáp dịch vụ, hướng dẫn đặt đơn và hỗ trợ tài khoản qua các kênh chính thức.</p><div className="support-links">{safe(channels?.telegram)&&<a href={channels!.telegram!} target="_blank" rel="noopener noreferrer"><Send size={19}/><span><b>Telegram</b><small>Liên hệ bộ phận hỗ trợ</small></span><ArrowUpRight size={17}/></a>}{safe(channels?.fanpage)&&<a href={channels!.fanpage!} target="_blank" rel="noopener noreferrer"><Headphones size={19}/><span><b>Fanpage</b><small>Nhắn tin qua Facebook</small></span><ArrowUpRight size={17}/></a>}{!safe(channels?.telegram)&&!safe(channels?.fanpage)&&<div className="support-unavailable">Kênh hỗ trợ hiện chưa khả dụng. Vui lòng quay lại sau.</div>}</div></section>;
}
function SpendingChart({ daily }: { daily: Summary['daily'] }) {
  const [days, setDays] = useState(30);
  const [hovered, setHovered] = useState<number | null>(null);
  const rows = daily.slice(-days);
  const top = Math.max(1, ...rows.map(row => row.amount));
  const bottom = Math.min(0, ...rows.map(row => row.amount));
  const width = 800, height = 200, left = 8, right = 790;
  const y = (value: number) => 12 + (top - value) / (top - bottom) * (height - 24);
  const points = rows.map((row, i) => ({ x: left + i * (right - left) / Math.max(1, rows.length - 1), y: y(row.amount), ...row }));
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const chosen = hovered === null ? null : points[hovered];
  const amount = rows.reduce((sum, row) => sum + row.amount, 0);
  return <section className="card insight-card">
    <div className="section-heading"><div><span className="section-kicker">HOẠT ĐỘNG TÀI KHOẢN</span><h2>Biểu đồ chi tiêu</h2></div><div className="period-switch" aria-label="Khoảng thời gian">{[7, 14, 30].map(value => <button key={value} className={days === value ? 'selected' : ''} aria-pressed={days === value} onClick={() => { setDays(value); setHovered(null); }}>{value} ngày</button>)}</div></div>
    <div className="chart-summary"><div><strong>{formatVND(amount)}</strong><small>Chi tiêu ròng trong {days} ngày gần nhất</small></div><span><i/>Thanh toán trừ khoản hoàn</span></div>
    <div className="area-chart"><div className="chart-axis">{[top, (top + bottom) / 2, bottom].map((value, i) => <span key={i}>{formatVND(value)}</span>)}</div><div className="chart-canvas">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Biểu đồ chi tiêu ${days} ngày, tổng ${formatVND(amount)}`}>
        <defs><linearGradient id="spending-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#397aef" stopOpacity=".22"/><stop offset="100%" stopColor="#397aef" stopOpacity=".02"/></linearGradient></defs>
        {[12, height/2, height-12].map(value => <line key={value} x1={left} x2={right} y1={value} y2={value} stroke="#e9eef6" strokeDasharray="4 5"/>)}
        {bottom < 0 && <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="#bccce0"/>}
        <path d={`${line} L ${right} ${y(0)} L ${left} ${y(0)} Z`} fill="url(#spending-area)"/>
        <path d={line} fill="none" stroke="#397aef" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {chosen && <><line x1={chosen.x} x2={chosen.x} y1="12" y2={height-12} stroke="#9ab9f6" strokeDasharray="4 4"/><circle cx={chosen.x} cy={chosen.y} r="5" fill="#397aef" stroke="white" strokeWidth="3"/></>}
      </svg>
      <div className="chart-hit-targets">{points.map((p, i) => <button key={p.date} aria-label={`${p.date}: ${formatVND(p.amount)}`} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)} onClick={() => setHovered(i)}/>)}</div>
      {chosen && <div className="area-tooltip" role="status"><small>{chosen.date.split('-').reverse().join('/')}</small><b>{formatVND(chosen.amount)}</b></div>}
      <div className="chart-date-labels">{[points[0], points[Math.floor(points.length/2)], points[points.length-1]].filter(Boolean).map((p,i) => <span key={i}>{p.date.slice(8)}/{p.date.slice(5,7)}</span>)}</div>
    </div></div>
    {rows.every(row => row.amount === 0) && <div className="chart-zero"><TrendingUp size={15}/> Chưa có chi tiêu trong khoảng thời gian này.</div>}
  </section>;
}
function NotificationIcon({ item }: { item: Notification }) {
  const complete = ['COMPLETED', 'REFUNDED'].includes(item.status ?? '');
  const Icon = complete ? CheckCircle2 : item.id.startsWith('wallet:') ? ArrowDownLeft : item.status ? ClipboardList : Megaphone;
  return <span className={`event-icon ${complete || item.id.startsWith('wallet:') ? 'green' : item.status ? 'blue' : 'orange'}`}><Icon size={18}/></span>;
}
export function DashboardHome() {
  const [data, setData] = useState<Summary | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => Promise.all([api<Summary>('/account/dashboard'), api<SessionUser>('/auth/me'), api<Notification[]>('/account/notifications')])
      .then(([d, u, n]) => { if (active) { setData(d); setUser(u); setNotifications(n); setError(''); } })
      .catch(() => { if (active) setError('Chưa thể tải thông tin tài khoản.'); });
    load(); window.addEventListener("wallet-updated", load); const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); window.removeEventListener("wallet-updated", load); };
  }, [retry]);
  if (!data || !user) return <div className="page customer-page home-dashboard">{error ? <div className="card dashboard-load-error"><Bell/><h2>{error}</h2><button className="secondary" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : <div className="dashboard-skeleton" role="status" aria-label="Đang tải tổng quan"><div/><div/><div/><div/></div>}</div>;
  const initials = user.displayName.trim().split(/\s+/).slice(-2).map(value => value[0]).join('').toUpperCase();
  const unread = notifications.filter(n => !n.read).length;
  const actions = [
    { href: '/order', title: 'Tạo đơn mới', detail: 'Chọn dịch vụ phù hợp', Icon: Plus, tone: 'blue' },
    { href: '/deposit', title: 'Nạp tiền', detail: 'Bổ sung số dư tài khoản', Icon: CreditCard, tone: 'green' },
    { href: '/pricing', title: 'Bảng giá', detail: 'Xem giá các dịch vụ', Icon: BookOpen, tone: 'orange' },
    { href: '/profile', title: 'Hồ sơ', detail: 'Thông tin & bảo mật', Icon: Settings2, tone: 'purple' },
  ];
  return <div className="page customer-page home-dashboard">
    <div className="page-head dashboard-heading"><div><span className="section-kicker">KHÔNG GIAN LÀM VIỆC CỦA BẠN</span><h1>Xin chào, {user.displayName} <span className="hello-spark"><Sparkles size={21}/></span></h1><p>Mọi hoạt động, tài khoản và cập nhật trong một nơi.</p></div><div className="dashboard-date">{new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}</div></div>
    {error && <div className="form-error" role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Thử lại</button></div>}
    <div className="dashboard-account-row">
      <section className="card identity-card"><div className="identity-top"><span className="identity-avatar">{initials}<i/></span><NavLink to="/profile" className="identity-edit" aria-label="Chỉnh sửa hồ sơ"><ArrowUpRight size={19}/></NavLink></div><span className="section-kicker">THÔNG TIN TÀI KHOẢN</span><h2>{user.displayName}</h2><p className="identity-email"><Mail size={14}/>{user.email}</p><div className="identity-bottom"><span><ShieldCheck size={14}/>{user.status === 'ACTIVE' ? 'Tài khoản hoạt động' : 'Tài khoản chưa hoạt động'}</span><NavLink to="/profile">Hồ sơ <ChevronRight size={14}/></NavLink></div></section>
      <section className="wallet-hero"><div className="wallet-hero-heading"><span><Wallet size={19}/> Số dư khả dụng</span><span className="wallet-currency">VND</span></div><strong>{formatVND(Number(user.wallet?.balance ?? 0) - Number(user.wallet?.reserved ?? 0))}</strong><div className="wallet-hero-bottom"><small>Đang giữ cho đơn hàng<br/><b>{formatVND(Number(user.wallet?.reserved ?? 0))}</b></small><NavLink to="/deposit"><Plus size={16}/> Nạp tiền</NavLink></div></section>
      <section className="card deposit-summary"><span className="summary-icon"><CircleDollarSign size={23}/></span><span className="section-kicker">TỔNG NẠP THÀNH CÔNG</span><strong>{formatVND(data.totalDeposited)}</strong><p>{data.historicalDeposited?'Bao gồm tổng nạp đã chuyển từ website cũ.':'Tổng tiền đã được cộng vào ví của bạn.'}</p><NavLink to="/deposit">Quản lý nạp tiền <ArrowUpRight size={15}/></NavLink></section>
    </div>
    <section className="dashboard-quick-actions">{actions.map(({href,title,detail,Icon,tone}) => <NavLink key={href} to={href}><span className={`quick-action-icon ${tone}`}><Icon size={21}/></span><span><b>{title}</b><small>{detail}</small></span><ChevronRight size={17}/></NavLink>)}</section>
    <div className="dashboard-content-grid">
      <div className="dashboard-primary">
        <section className="dashboard-metrics">
          <article><span className="metric-symbol blue"><TrendingUp size={19}/></span><div><span>Tổng chi tiêu</span><strong>{formatVND(data.totalSpent)}</strong><small>Toàn thời gian · đã trừ hoàn tiền</small></div></article>
          <article><span className="metric-symbol purple"><ClipboardList size={19}/></span><div><span>Đơn tạo mới</span><strong>{data.newOrders.toLocaleString('vi-VN')} <small>đơn</small></strong><small>Trong 30 ngày gần nhất</small></div></article>
          <article><span className="metric-symbol orange"><CircleDollarSign size={19}/></span><div><span>Giá trị trung bình</span><strong>{formatVND(data.averageOrder)}</strong><small>Mỗi đơn đã thanh toán</small></div></article>
        </section>
        <SpendingChart daily={data.daily}/>
        <section className="card news-panel"><div className="section-heading"><div><span className="section-kicker">CẬP NHẬT TỪ Hacklike43</span><h2>Bảng tin & khuyến mãi</h2></div><span className="subtle-icon"><Megaphone size={20}/></span></div>
          {data.posts.length ? <div className="news-list">{data.posts.map(p => <article className={`news-entry ${p.kind === 'PROMOTION' ? 'promotion' : ''}`} key={p.id}><span className="news-entry-icon">{p.kind === 'PROMOTION' ? <Tag size={20}/> : <Megaphone size={20}/>}</span><div className="news-entry-body"><div className="news-meta"><span className="news-kind">{p.kind === 'PROMOTION' ? 'Khuyến mãi' : p.kind === 'NOTICE' ? 'Thông báo' : 'Bảng tin'}</span><time>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</time></div><h3>{p.title}</h3><p>{p.content}</p></div></article>)}</div> : <div className="designed-empty"><span><Megaphone size={25}/></span><b>Chưa có cập nhật mới</b><p>Tin tức và ưu đãi mới sẽ xuất hiện tại đây khi được đăng.</p></div>}
        </section>
      </div>
      <aside className="dashboard-secondary"><section className="card activity-panel"><div className="section-heading"><h2>Thông báo <span className="count-pill">{unread}</span></h2><NavLink to="/notifications" aria-label="Xem tất cả thông báo"><ArrowUpRight size={18}/></NavLink></div>
        {notifications.length ? <div className="activity-list">{notifications.slice(0,4).map(n => <NavLink to={n.href} className={`activity-item ${!n.read ? 'unread' : ''}`} key={n.id}><NotificationIcon item={n}/><div><b>{n.title}{!n.read && <span className="unread-dot"/>}</b><p>{n.status ? statuses[n.status] ?? 'Đang xử lý' : n.content.slice(0,110)}</p><time>{new Date(n.createdAt).toLocaleString('vi-VN', { day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' })}</time></div></NavLink>)}</div> : <div className="designed-empty compact"><span><Bell size={24}/></span><b>Bạn đã xem hết thông báo</b><p>Cập nhật đơn hàng và giao dịch sẽ hiển thị tại đây.</p></div>}
        <NavLink className="activity-footer" to="/notifications">Xem tất cả thông báo <ChevronRight size={15}/></NavLink></section><SupportChannels/>
      </aside>
    </div>
  </div>;
}
export function ProfilePage(){
  const [user,setUser]=useState<SessionUser|null>(null),[name,setName]=useState(''),[current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{api<SessionUser>('/auth/me').then(u=>{setUser(u);setName(u.displayName);}).catch(()=>setMessage('Chưa thể tải hồ sơ.'));},[]);
  async function save(e:FormEvent,changePassword=false){e.preventDefault();if(changePassword&&password!==confirm){setMessage('Mật khẩu xác nhận chưa khớp.');return;}setBusy(true);setMessage('');try{await api(changePassword?'/account/password':'/account/profile',{method:'PATCH',body:JSON.stringify(changePassword?{currentPassword:current,newPassword:password}:{displayName:name})});setMessage(changePassword?'Đã đổi mật khẩu. Vui lòng đăng xuất và đăng nhập lại.':'Đã lưu hồ sơ.');if(changePassword){setCurrent('');setPassword('');setConfirm('');}else window.dispatchEvent(new Event('profile-updated'));}catch(e){setMessage(e instanceof ApiError&&e.code==='WRONG_PASSWORD'?'Mật khẩu hiện tại chưa đúng.':'Chưa thể lưu. Kiểm tra thông tin và thử lại.');}finally{setBusy(false);}}
  return <div className="page customer-page"><div className="page-head"><div><h1>Hồ sơ tài khoản</h1><p>Thông tin cá nhân và bảo mật.</p></div></div>{message&&<div className="notice" role="status">{message}</div>}<div className="customer-home-grid"><form className="card customer-form" onSubmit={e=>save(e)}><h2>Thông tin tài khoản</h2><label htmlFor="profile-email">Email</label><input id="profile-email" className="input" readOnly value={user?.email??''}/><label htmlFor="profile-name">Tên hiển thị</label><input id="profile-name" className="input" required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/><button className="primary" disabled={busy||!user}>Lưu thay đổi</button></form><form className="card customer-form" onSubmit={e=>save(e,true)}><h2>Đổi mật khẩu</h2><label htmlFor="current-password">Mật khẩu hiện tại</label><input id="current-password" className="input" type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/><label htmlFor="new-password">Mật khẩu mới (ít nhất 12 ký tự)</label><input id="new-password" className="input" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><label htmlFor="confirm-password">Xác nhận mật khẩu</label><input id="confirm-password" className="input" type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/><button className="primary" disabled={busy||!user}>Đổi mật khẩu</button></form></div></div>;
}
export function NotificationsPage() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const load = () => api<Notification[]>('/account/notifications').then(data => { setRows(data); setError(''); }).catch(() => setError('Chưa thể tải thông báo.')).finally(() => setLoading(false));
  useEffect(() => { load(); window.addEventListener("wallet-updated", load); const timer = setInterval(load, 30000); return () => { clearInterval(timer); window.removeEventListener("wallet-updated", load); }; }, []);
  const unread = rows.filter(n => !n.read).length;
  const visible = filter === 'unread' ? rows.filter(n => !n.read) : rows;
  async function markRead() {
    setBusy(true);
    try { await api('/account/notifications/read', { method: 'POST' }); await load(); window.dispatchEvent(new Event('notifications-updated')); }
    catch { setError('Chưa thể cập nhật thông báo.'); }
    finally { setBusy(false); }
  }
  return <div className="page customer-page home-dashboard notifications-design">
    <div className="page-head"><div><span className="section-kicker">TRUNG TÂM CẬP NHẬT</span><h1>Thông báo</h1><p>Đơn hàng, giao dịch và tin mới dành cho bạn.</p></div><button className="secondary" disabled={busy || !unread} onClick={markRead}><CheckCircle2 size={16}/>{busy ? 'Đang cập nhật…' : 'Đánh dấu tất cả đã đọc'}</button></div>
    {error && <div className="form-error" role="alert">{error}<button className="secondary" onClick={load}>Thử lại</button></div>}
    <section className="card"><div className="notification-toolbar"><div className="period-switch"><button className={filter === 'all' ? 'selected' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tất cả ({rows.length})</button><button className={filter === 'unread' ? 'selected' : ''} aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Chưa đọc ({unread})</button></div><span>Cập nhật tự động</span></div>
      {loading ? <div className="designed-empty" role="status">Đang tải thông báo…</div> : !visible.length ? <div className="designed-empty"><span><Bell size={27}/></span><b>{filter === 'unread' ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'}</b><p>Các cập nhật mới sẽ xuất hiện tại đây.</p></div> : <div className="notification-feed">{visible.map(n => <article className={`notification-feed-item ${!n.read ? 'unread' : ''}`} key={n.id}><NotificationIcon item={n}/><div><div className="notification-feed-top"><NavLink to={n.href}><h3>{n.title}{!n.read && <span className="unread-dot"/>}</h3></NavLink><time>{new Date(n.createdAt).toLocaleString('vi-VN')}</time></div><p>{n.status ? statuses[n.status] ?? 'Đang xử lý' : n.content}</p><NavLink className="notification-detail-link" to={n.href}>Xem chi tiết <ArrowUpRight size={13}/></NavLink></div></article>)}</div>}
    </section>
  </div>;
}
export function AdminAnnouncements(){
  const [posts,setPosts]=useState<Post[]>([]),[id,setId]=useState(''),[title,setTitle]=useState(''),[content,setContent]=useState(''),[kind,setKind]=useState('NEWS'),[published,setPublished]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>api<Post[]>('/admin/announcements').then(setPosts);
  useEffect(()=>{load().catch(()=>setMessage('Chưa thể tải bài đăng.'));},[]);
  function reset(){setId('');setTitle('');setContent('');setKind('NEWS');setPublished(false);}
  async function save(e:FormEvent){e.preventDefault();setBusy(true);try{await api(`/admin/announcements${id?`/${id}`:''}`,{method:id?'PATCH':'POST',body:JSON.stringify({title,content,kind,published})});reset();await load();setMessage('Đã lưu bài đăng.');}catch{setMessage('Chưa thể lưu bài đăng. Vui lòng thử lại.');}finally{setBusy(false);}}
  return <div className="page customer-page"><div className="page-head"><div><h1>Bảng tin & khuyến mãi</h1><p>Bài đã xuất bản hiển thị trên dashboard khách hàng.</p></div></div>{message&&<div className="notice" role="status">{message}</div>}<div className="customer-home-grid"><form className="card customer-form" onSubmit={save}><h2>{id?'Chỉnh sửa bài đăng':'Tạo bài đăng'}</h2><label htmlFor="post-title">Tiêu đề</label><input id="post-title" className="input" value={title} required maxLength={160} onChange={e=>setTitle(e.target.value)}/><label htmlFor="post-kind">Loại bài</label><select id="post-kind" className="input" value={kind} onChange={e=>setKind(e.target.value)}><option value="NEWS">Bảng tin</option><option value="PROMOTION">Khuyến mãi</option><option value="NOTICE">Thông báo</option></select><label htmlFor="post-content">Nội dung</label><textarea id="post-content" className="input" rows={10} value={content} required maxLength={20000} onChange={e=>setContent(e.target.value)}/><label><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Xuất bản trên website</label><div className="customer-actions"><button className="primary" disabled={busy}>Lưu bài đăng</button>{id&&<button type="button" className="secondary" onClick={reset}>Hủy chỉnh sửa</button>}</div></form><section className="card"><h2>Bài đã tạo</h2>{!posts.length&&<p>Chưa có bài đăng.</p>}{posts.map(p=><article className="bulletin-post" key={p.id}><small>{p.published?'Đã xuất bản':'Bản nháp'}</small><h3>{p.title}</h3><button className="secondary" onClick={()=>{setId(p.id);setTitle(p.title);setContent(p.content);setKind(p.kind);setPublished(p.published);}}>Chỉnh sửa</button></article>)}</section></div></div>;
}
