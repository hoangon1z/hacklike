import {formatVND} from './utils/formatVND';
import { FormEvent, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, ApiError, SessionUser } from './api';
import './customer-design.css';
import { ArrowDownLeft, ArrowUpRight, Bell, BookOpen, Calendar, Check, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Clock, CreditCard, Eye, EyeOff, Headphones, Lock, Mail, Megaphone, Plus, Send, Settings2, ShieldAlert, ShieldCheck, Sparkles, Tag, TrendingUp, UserRound, Wallet } from 'lucide-react';

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
  const [channels, setChannels] = useState<{ telegram: string | null; fanpage: string | null } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      Promise.all([
        api<Summary>('/account/dashboard'),
        api<SessionUser>('/auth/me'),
        api<Notification[]>('/account/notifications'),
      ])
        .then(([d, u, n]) => {
          if (active) {
            setData(d);
            setUser(u);
            setNotifications(n);
            setError('');
          }
        })
        .catch(() => {
          if (active) setError('Chưa thể tải thông tin tài khoản.');
        });

    load();
    api<{ telegram: string | null; fanpage: string | null }>('/health/capabilities')
      .then(value => {
        if (active) setChannels(value);
      })
      .catch(() => null);

    window.addEventListener('wallet-updated', load);
    const timer = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('wallet-updated', load);
    };
  }, [retry]);

  // Loading & Error States
  if (!data || !user) {
    return (
      <div className="page customer-page home-dashboard">
        {error ? (
          <div className="card dashboard-load-error" role="alert">
            <Bell />
            <h2>{error}</h2>
            <button className="secondary" onClick={() => setRetry(v => v + 1)}>
              Thử lại
            </button>
          </div>
        ) : (
          <div className="smm-dash-container" role="status" aria-label="Đang tải tổng quan">
            <div className="smm-dash-left">
              <div className="smm-dash-account-card">
                <div className="smm-dash-account-top">
                  <div className="smm-dash-skeleton-avatar" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    <div className="smm-skeleton-line tall" style={{ width: 180 }} />
                    <div className="smm-skeleton-line medium" />
                  </div>
                </div>
                <hr className="smm-dash-divider" />
                <div className="smm-dash-metrics">
                  <div className="smm-dash-skeleton-metric" />
                  <div className="smm-dash-skeleton-metric" />
                  <div className="smm-dash-skeleton-metric" />
                </div>
              </div>
              <div className="smm-dash-post-card" style={{ minHeight: 240 }} />
            </div>
            <div className="smm-dash-right">
              <div className="smm-dash-card" style={{ minHeight: 220 }} />
              <div className="smm-dash-card" style={{ minHeight: 140 }} />
              <div className="smm-dash-card" style={{ minHeight: 180 }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const initials = user.displayName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map(v => v[0])
    .join('')
    .toUpperCase();
  const role = { CUSTOMER: 'Thành viên', ADMIN: 'Quản trị viên', SUPER_ADMIN: 'Quản trị hệ thống' }[user.role] ?? 'Thành viên';
  const isVerified = user.status === 'ACTIVE';
  const safe = (url: string | null | undefined) => (url && /^https:\/\//i.test(url) ? url : null);
  const activity = notifications.filter(n => !n.id.startsWith('post:'));
  const balance = user.wallet ? Number(user.wallet.balance) - Number(user.wallet.reserved) : 0;

  return (
    <div className="page customer-page home-dashboard">
      {error && (
        <div className="form-error" role="alert">
          {error}
          <button className="secondary" onClick={() => setRetry(v => v + 1)}>
            Thử lại
          </button>
        </div>
      )}

      <div className="smm-dash-container">
        {/* LEFT COLUMN: ~71% */}
        <div className="smm-dash-left">
          {/* Top Account Overview Card */}
          <section className="smm-dash-account-card">
            <div className="smm-dash-account-top">
              <div className="smm-dash-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="smm-dash-user-info">
                <div className="smm-dash-user-row">
                  <h1 className="smm-dash-username">{user.displayName}</h1>
                  {isVerified && (
                    <span className="smm-dash-verified-badge" title="Tài khoản đã kích hoạt">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                  )}
                </div>
                <div className="smm-dash-user-sub">
                  <span className="smm-dash-meta-item">
                    <Mail size={13} />
                    <span>{user.email}</span>
                  </span>
                  <span className="smm-dash-meta-item smm-dash-role-badge">
                    <UserRound size={13} />
                    <span>{role}</span>
                  </span>
                </div>
              </div>
            </div>

            <hr className="smm-dash-divider" />

            <div className="smm-dash-metrics">
              <div className="smm-dash-metric">
                <div className="smm-dash-metric-icon balance">
                  <Wallet size={21} />
                </div>
                <div className="smm-dash-metric-content">
                  <span className="smm-dash-metric-label">Số Dư</span>
                  <strong className="smm-dash-metric-value">{formatVND(balance)}</strong>
                </div>
              </div>

              <div className="smm-dash-metric">
                <div className="smm-dash-metric-icon deposit">
                  <CreditCard size={21} />
                </div>
                <div className="smm-dash-metric-content">
                  <span className="smm-dash-metric-label">Tổng nạp</span>
                  <strong className="smm-dash-metric-value">{formatVND(data.totalDeposited)}</strong>
                </div>
              </div>

              <div className="smm-dash-metric">
                <div className="smm-dash-metric-icon tier">
                  <ShieldCheck size={21} />
                </div>
                <div className="smm-dash-metric-content">
                  <span className="smm-dash-metric-label">Cấp bậc</span>
                  <strong className="smm-dash-metric-value">{role}</strong>
                </div>
              </div>
            </div>
          </section>

          {/* Main Announcement / Admin Post Card */}
          <section className="smm-dash-post-card">
            {data.posts.length > 0 ? (
              data.posts.map(post => (
                <article className="smm-dash-post-item" key={post.id}>
                  <div className="smm-dash-post-header">
                    <div className="smm-dash-post-avatar">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="smm-dash-post-meta">
                      <span className="smm-dash-post-author">
                        Quản Trị Viên <span title="Ghim">📌</span>
                      </span>
                      <time className="smm-dash-post-date" dateTime={post.createdAt}>
                        {new Date(post.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} lúc{' '}
                        {new Date(post.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </div>
                    <span className="smm-dash-post-tag">
                      {post.kind === 'PROMOTION' ? 'Khuyến mãi' : post.kind === 'NOTICE' ? 'Thông báo' : 'Bảng tin'}
                    </span>
                  </div>
                  <h3 className="smm-dash-post-title">{post.title}</h3>
                  <p className="smm-dash-post-content">{post.content}</p>
                </article>
              ))
            ) : (
              <div className="smm-dash-empty-post">
                <div className="smm-dash-empty-icon">
                  <Megaphone size={26} />
                </div>
                <p className="smm-dash-empty-title">Chưa có thông báo mới.</p>
                <p className="smm-dash-empty-desc">
                  Các thông báo và cập nhật chính thức từ ban quản trị sẽ xuất hiện tại đây.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: ~29% */}
        <aside className="smm-dash-right">
          {/* Recent Activity Card */}
          <section className="smm-dash-card">
            <div className="smm-dash-card-header">
              <h2 className="smm-dash-card-title">
                <Bell size={17} />
                <span>Hoạt động mới</span>
              </h2>
            </div>
            {activity.length > 0 ? (
              <div className="smm-dash-activity-list">
                {activity.map(n => {
                  const d = new Date(n.createdAt);
                  const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                  return (
                    <NavLink to={n.href} key={n.id} className="smm-dash-activity-row">
                      <span className="smm-dash-activity-date">{dateStr}</span>
                      <span className="smm-dash-activity-desc">
                        {n.status
                          ? `${n.title} - ${statuses[n.status] ?? 'Đang xử lý'}`
                          : n.content.replace(/ VND\b/g, ' ₫')}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            ) : (
              <div className="smm-dash-activity-empty">
                <Bell size={22} />
                <span>Chưa có hoạt động mới</span>
              </div>
            )}
            <div className="smm-dash-btn-center">
              <NavLink to="/notifications" className="smm-dash-all-activity-btn">
                Xem tất cả thông báo
              </NavLink>
            </div>
          </section>

          {/* Support Channels Card */}
          <section className="smm-dash-card">
            <div className="smm-dash-card-header">
              <h2 className="smm-dash-card-title">
                <Headphones size={17} />
                <span>Bạn cần hỗ trợ?</span>
              </h2>
            </div>
            <div className="smm-dash-support-grid">
              {safe(channels?.fanpage) && (
                <a
                  href={channels!.fanpage!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="smm-dash-support-item"
                >
                  <span className="smm-dash-support-icon facebook">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </span>
                  <span>Fanpage Hỗ trợ</span>
                </a>
              )}
              {safe(channels?.telegram) && (
                <a
                  href={channels!.telegram!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="smm-dash-support-item"
                >
                  <span className="smm-dash-support-icon telegram">
                    <Send size={18} />
                  </span>
                  <span>Liên Kết Telegram</span>
                </a>
              )}
              <NavLink to="/deposit" className="smm-dash-support-item">
                <span className="smm-dash-support-icon deposit">
                  <CreditCard size={18} />
                </span>
                <span>Nạp Tiền</span>
              </NavLink>
              <NavLink to="/support" className="smm-dash-support-item">
                <span className="smm-dash-support-icon help">
                  <Headphones size={18} />
                </span>
                <span>Trung tâm hỗ trợ</span>
              </NavLink>
            </div>
          </section>

          {/* FAQ Accordion Card */}
          <section className="smm-dash-card">
            <div className="smm-dash-card-header">
              <h2 className="smm-dash-card-title">
                <BookOpen size={17} />
                <span>Câu hỏi thường gặp (nhấn để xem)</span>
              </h2>
            </div>
            <div className="smm-dash-faq-list">
              <details className="smm-dash-faq-item">
                <summary>
                  <span className="smm-dash-faq-icon">📝</span>
                  <span>Tôi cần bảo hành?</span>
                </summary>
                <p>
                  Hệ thống hỗ trợ bảo hành theo cam kết của từng dịch vụ. Bạn có thể kiểm tra trạng thái bảo hành trong
                  mục Lịch sử đơn hàng hoặc liên hệ kênh hỗ trợ kèm mã đơn nếu cần trợ giúp.
                </p>
              </details>
              <details className="smm-dash-faq-item">
                <summary>
                  <span className="smm-dash-faq-icon">📝</span>
                  <span>Tôi nạp tiền nhưng chưa nhận được?</span>
                </summary>
                <p>
                  Hệ thống tự động cộng tiền sau 1–3 phút khi chuyển đúng cú pháp nội dung. Nếu sau 10 phút số dư chưa
                  cập nhật, vui lòng gửi biên lai chuyển khoản đến kênh hỗ trợ để được kiểm tra ngay.
                </p>
              </details>
              <details className="smm-dash-faq-item">
                <summary>
                  <span className="smm-dash-faq-icon">📝</span>
                  <span>Dịch vụ mua không chạy?</span>
                </summary>
                <p>
                  Mỗi dịch vụ có thời gian bắt đầu khác nhau được ghi rõ ở phần mô tả. Nếu quá thời gian bắt đầu quy định
                  mà đơn chưa chạy, hệ thống sẽ tự động cập nhật hoặc xử lý hoàn tiền vào số dư tài khoản của bạn.
                </p>
              </details>
              <details className="smm-dash-faq-item">
                <summary>
                  <span className="smm-dash-faq-icon">📝</span>
                  <span>Giá tăng tương tác được tính như thế nào?</span>
                </summary>
                <p>
                  Giá phụ thuộc vào nền tảng và máy chủ dịch vụ. Hệ thống luôn hiển thị đơn giá và tổng chi phí ước tính
                  theo số lượng trước khi bạn xác nhận tạo đơn.
                </p>
              </details>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
export function ProfilePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [name, setName] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [busyProfile, setBusyProfile] = useState(false);

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [busyPassword, setBusyPassword] = useState(false);

  const loadUser = () => {
    api<SessionUser>('/auth/me')
      .then(u => {
        setUser(u);
        setName(u.displayName);
      })
      .catch(() => setProfileError('Chưa thể tải thông tin hồ sơ.'));
  };

  useEffect(() => {
    loadUser();
  }, []);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusyProfile(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await api('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: name.trim() }),
      });
      setProfileSuccess('Cập nhật thông tin thành công');
      window.dispatchEvent(new Event('profile-updated'));
      await loadUser();
    } catch (err) {
      setProfileError(
        err instanceof ApiError && err.code === 'INVALID_PROFILE'
          ? 'Tên hiển thị không hợp lệ.'
          : 'Chưa thể lưu thông tin. Vui lòng thử lại.'
      );
    } finally {
      setBusyProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setPasswordError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    if (password.length < 12) {
      setPasswordError('Mật khẩu mới phải có ít nhất 12 ký tự.');
      return;
    }
    setBusyPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      await api('/account/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      });
      setPasswordSuccess('Đổi mật khẩu thành công. Vui lòng đăng xuất và đăng nhập lại.');
      setCurrent('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'WRONG_PASSWORD') {
          setPasswordError('Mật khẩu hiện tại chưa đúng.');
        } else if (err.code === 'PASSWORD_TOO_LONG') {
          setPasswordError('Mật khẩu quá dài (tối đa 72 ký tự).');
        } else if (err.code === 'PASSWORD_UNCHANGED') {
          setPasswordError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
        } else {
          setPasswordError('Chưa thể đổi mật khẩu. Vui lòng thử lại.');
        }
      } else {
        setPasswordError('Chưa thể đổi mật khẩu. Vui lòng thử lại.');
      }
    } finally {
      setBusyPassword(false);
    }
  }

  const role = user ? ({ CUSTOMER: 'Thành viên', ADMIN: 'Quản trị viên', SUPER_ADMIN: 'Quản trị hệ thống' }[user.role] ?? 'Thành viên') : 'Thành viên';
  const initials = user
    ? user.displayName.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase() || 'U'
    : 'U';
  const balance = user?.wallet ? Number(user.wallet.balance) - Number(user.wallet.reserved) : 0;

  return (
    <div className="page customer-page profile-page-wrap">
      <div className="profile-page-head">
        <h1 className="profile-title">Hồ sơ tài khoản</h1>
        <p className="profile-subtitle">Quản lý thông tin cá nhân và bảo mật tài khoản.</p>
      </div>

      <div className="profile-layout-container">
        {/* LEFT COLUMN: Profile Identity Card */}
        <aside className="profile-sidebar-card">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-circle" aria-hidden="true">
              {initials}
            </div>
          </div>

          <div className="profile-identity">
            <h2 className="profile-card-name">{user?.displayName || '...'}</h2>
            <div className="profile-card-role-badge">
              <span className="profile-role-dot" />
              <span>{role}</span>
            </div>
          </div>

          <div className="profile-balance-box">
            <div className="profile-balance-label">
              <Wallet size={14} />
              <span>SỐ DƯ TÀI KHOẢN</span>
            </div>
            <div className="profile-balance-amount">
              {user ? formatVND(balance) : '...'}
            </div>
          </div>

          <div className="profile-meta-list">
            <div className="profile-meta-row">
              <div className="profile-meta-icon"><Mail size={16} /></div>
              <div className="profile-meta-content">
                <span className="profile-meta-label">Email</span>
                <strong className="profile-meta-value">{user?.email || '...'}</strong>
              </div>
            </div>

            <div className="profile-meta-row">
              <div className="profile-meta-icon"><ShieldCheck size={16} /></div>
              <div className="profile-meta-content">
                <span className="profile-meta-label">Cấp bậc</span>
                <strong className="profile-meta-value">{role}</strong>
              </div>
            </div>

            {user?.createdAt && (
              <div className="profile-meta-row">
                <div className="profile-meta-icon"><Calendar size={16} /></div>
                <div className="profile-meta-content">
                  <span className="profile-meta-label">Thành viên từ</span>
                  <strong className="profile-meta-value">
                    {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                  </strong>
                </div>
              </div>
            )}

            {user?.updatedAt && (
              <div className="profile-meta-row">
                <div className="profile-meta-icon"><Clock size={16} /></div>
                <div className="profile-meta-content">
                  <span className="profile-meta-label">Cập nhật lần cuối</span>
                  <strong className="profile-meta-value">
                    {new Date(user.updatedAt).toLocaleDateString('vi-VN')}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: Account Information & Security */}
        <div className="profile-main-forms">
          {/* Card 1: Thông tin tài khoản */}
          <section className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-title-row">
                <div className="profile-header-icon">
                  <UserRound size={18} />
                </div>
                <h2 className="profile-card-title">Thông tin tài khoản</h2>
              </div>
              <p className="profile-card-subtext">Cập nhật thông tin hiển thị của tài khoản.</p>
            </div>

            {profileSuccess && (
              <div className="profile-banner success" role="status">
                <CheckCircle2 size={16} />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="profile-banner error" role="alert">
                <ShieldAlert size={16} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="profile-form-grid">
              <div className="profile-field-group">
                <label htmlFor="profile-name">Tên hiển thị</label>
                <input
                  id="profile-name"
                  className="profile-input"
                  required
                  maxLength={80}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nhập tên hiển thị"
                />
              </div>

              <div className="profile-field-group">
                <label htmlFor="profile-email">Email</label>
                <input
                  id="profile-email"
                  className="profile-input readonly"
                  readOnly
                  value={user?.email ?? ''}
                />
              </div>

              <div className="profile-form-footer">
                <button
                  type="submit"
                  className="profile-action-btn"
                  disabled={busyProfile || !user || !name.trim() || name === user.displayName}
                >
                  {busyProfile ? 'Lưu thay đổi...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </section>

          {/* Card 2: Bảo mật & mật khẩu */}
          <section className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-title-row">
                <div className="profile-header-icon">
                  <Lock size={18} />
                </div>
                <h2 className="profile-card-title">Bảo mật & mật khẩu</h2>
              </div>
              <p className="profile-card-subtext">Thay đổi mật khẩu đăng nhập của bạn.</p>
            </div>

            <div className="profile-security-tip">
              <ShieldAlert size={17} />
              <span>Để bảo vệ tài khoản, hãy sử dụng mật khẩu mạnh và không chia sẻ mật khẩu với người khác.</span>
            </div>

            {passwordSuccess && (
              <div className="profile-banner success" role="status">
                <CheckCircle2 size={16} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="profile-banner error" role="alert">
                <ShieldAlert size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="profile-form-grid">
              <div className="profile-field-group">
                <label htmlFor="current-password">Mật khẩu hiện tại</label>
                <div className="profile-password-wrap">
                  <input
                    id="current-password"
                    type={showCurrent ? 'text' : 'password'}
                    className="profile-input"
                    autoComplete="current-password"
                    required
                    value={current}
                    onChange={e => setCurrent(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => setShowCurrent(!showCurrent)}
                    aria-label={showCurrent ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="profile-field-group">
                <label htmlFor="new-password">Mật khẩu mới (ít nhất 12 ký tự)</label>
                <div className="profile-password-wrap">
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    className="profile-input"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => setShowNew(!showNew)}
                    aria-label={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="profile-field-group">
                <label htmlFor="confirm-password">Xác nhận mật khẩu</label>
                <div className="profile-password-wrap">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    className="profile-input"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="profile-form-footer">
                <button
                  type="submit"
                  className="profile-action-btn"
                  disabled={busyPassword || !current || !password || !confirm}
                >
                  {busyPassword ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
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
