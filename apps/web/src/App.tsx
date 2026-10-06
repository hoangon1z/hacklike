import { FormEvent, useEffect, useRef, useState } from "react";
import { AdminFinanceOverview } from './AdminFinanceOverview';
import { LandingPage } from './LandingPage';
import { PlatformIcon } from './PlatformIcon';
import { AuthPages } from './AuthPages';
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Copy,
  Headphones,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api, ApiError, errorText, SessionUser } from "./api";
import { RequiredPasswordChange } from './RequiredPasswordChange';
import { DashboardHome, ProfilePage, NotificationsPage, AdminAnnouncements } from "./CustomerPages";
import { QRCodeSVG } from "qrcode.react";
import { ManagedUsers, ManagedOrders, ManagedPayments, ManagedAudits } from './AdminManagementPages';

type Service = {
  id: string | number;
  name: string;
  platform: string;
  price: number;
  providerRate?: number;
  min: number;
  max: number;
  enabled: boolean;
  pricingMode?: "PERCENTAGE" | "FIXED_MARKUP" | "FIXED_PRICE";
  markupValue?: number;
  minimumSafeMargin?: number;
  systemEnabled?: boolean;
  providerEnabled?: boolean;
  providerType?: string;
  providerDescription?: string | null;
};
type RealOrder = {
  id: string;
  publicId: string;
  status: string;
  quantity: number;
  chargeAmount: string;
  costAmount?: string;
  providerOrderId?: string | null;
  createdAt: string;
  service: { displayName: string };
  user?: { email: string; displayName: string };
};
const money = (v: number) => new Intl.NumberFormat("vi-VN").format(v) + "đ";
const unitMoney = (v: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    v / 1000,
  ) + "đ/lượt";
const servicePlatform = (service: Service) => {
  const text = (service.platform + " " + service.name).toLowerCase();
  if (text.includes("facebook") || text.includes(" fb ")) return "Facebook";
  if (text.includes("tiktok")) return "TikTok";
  if (text.includes("instagram") || text.includes(" ig ")) return "Instagram";
  if (text.includes("youtube")) return "YouTube";
  if (text.includes("telegram")) return "Telegram";
  if (text.includes("twitter") || text.includes(" x ")) return "X";
  if (text.includes("thread")) return "Threads";
  if (text.includes("shopee")) return "Shopee";
  return "Khác";
};
const serviceType = (service: Service) => {
  const text = (service.name + " " + service.platform).toLowerCase();
  const types: [string, string[]][] = [
    ["Like / Cảm xúc", ["like", "cảm xúc", "reaction"]],
    ["Theo dõi", ["follow", "follower", "theo dõi"]],
    ["Lượt xem", ["view", "mắt live", "lượt xem"]],
    ["Bình luận", ["comment", "bình luận"]],
    ["Chia sẻ", ["share", "chia sẻ"]],
    ["Thành viên", ["member", "thành viên", "subscribers"]],
    ["Lưu bài", ["save", "lưu bài"]],
    ["Tương tác", ["engagement", "tương tác"]],
    ["Đánh giá", ["review", "đánh giá"]],
  ];
  return (
    types.find(([, keys]) => keys.some((key) => text.includes(key)))?.[0] ??
    "Khác"
  );
};


function Logo() {
  return (
    <div className="logo">
      <div className="logo-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <div className="logo-brand">
        <strong>Hacklike43</strong>
        <span>SMM Portal</span>
      </div>
    </div>
  );
}

function LogoutConfirmation({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await onConfirm(); }
    catch { setError("Chưa thể đăng xuất. Vui lòng thử lại."); setBusy(false); }
  }
  return <dialog ref={dialog} className="logout-dialog" aria-labelledby="logout-title" aria-describedby="logout-description" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <span className="logout-dialog-icon"><LogOut size={25}/></span>
    <h2 id="logout-title">Bạn chắc chắn muốn đăng xuất?</h2>
    <p id="logout-description">Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng tài khoản. Các đơn hàng đang chạy không bị ảnh hưởng.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="logout-dialog-actions">
      <button className="secondary" autoFocus disabled={busy} onClick={onClose}>Ở lại</button>
      <button className="primary" disabled={busy} onClick={confirm}>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</button>
    </div>
  </dialog>;
}

function Shell({
  admin = false,
  user,
  onLogout,
}: {
  admin?: boolean;
  user: SessionUser;
  onLogout: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [serviceNav, setServiceNav] = useState<Service[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => api<Array<{read:boolean}>>("/account/notifications").then(rows => { if(active) setUnreadNotifications(rows.filter(row => !row.read).length); }).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("notifications-updated", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("notifications-updated", refresh); };
  }, []);
  const location = useLocation();
  const requestedPlatform =
    new URLSearchParams(location.search).get("platform") ?? "";
  const [expandedPlatform, setExpandedPlatform] = useState(requestedPlatform);

  useEffect(() => {
    if (admin) return;
    api<
      Array<{
        id: string;
        displayName: string;
        sellingRate: string;
        min: number;
        max: number;
        category: { name: string };
      }>
    >("/services")
      .then((rows) =>
        setServiceNav(
          rows.map((x) => ({
            id: x.id,
            name: x.displayName,
            platform: x.category.name,
            price: Number(x.sellingRate),
            min: x.min,
            max: x.max,
            enabled: true,
          })),
        ),
      )
      .catch(() => null);
  }, [admin]);

  useEffect(() => {
    if (requestedPlatform) setExpandedPlatform(requestedPlatform);
  }, [requestedPlatform]);

  const serviceMenu = [...new Set(serviceNav.map(servicePlatform))]
    .sort()
    .map((platformName) => ({
      platform: platformName,
      groups: [
        ...new Set(
          serviceNav
            .filter((service) => servicePlatform(service) === platformName)
            .map((service) => service.platform),
        ),
      ].sort(),
    }));

  const adminLinks = [
    ["/admin", "Tổng quan", LayoutDashboard],
    ["/admin/users", "Thành viên", Users],
    ["/admin/services", "Dịch vụ & giá", Boxes],
    ["/admin/orders", "Đơn hàng", ClipboardList],
    ["/admin/payments", "Nạp tiền", CreditCard],
    ["/admin/system", "Hệ thống", ShieldCheck],
    ["/admin/settings", "Cấu hình", Settings],
    ["/admin/announcements", "Bảng tin & khuyến mãi", BookOpen],
    ["/admin/audits", "Nhật ký quản trị", ShieldCheck],
  ];

  const initials = user.displayName
    .split(" ")
    .slice(-2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

  return (
    <div className={admin ? "shell admin-shell" : "shell"}>
      <aside
        className={`${open ? "sidebar open" : "sidebar"} ${admin ? "admin-sidebar" : "customer-sidebar"}`}
      >
        <Logo />
        <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
          <X size={18} />
        </button>

        <nav className={admin ? "" : "customer-nav"}>
          {admin ? (
            <>
              <small className="nav-section-title">QUẢN TRỊ HỆ THỐNG</small>
              {adminLinks.map(([to, label, Icon]) => (
                <NavLink
                  key={to as string}
                  to={to as string}
                  end={to === "/admin"}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} />
                  <span>{label as string}</span>
                </NavLink>
              ))}
            </>
          ) : (
            <>
              <small className="nav-section-title">CHỨC NĂNG CHÍNH</small>
              <NavLink to="/dashboard" onClick={() => setOpen(false)}>
                <LayoutDashboard size={18} />
                <span>Tổng quan</span>
              </NavLink>


              {serviceMenu.length > 0 && (
                <>
                  <small className="nav-section-title">NỀN TẢNG DỊCH VỤ</small>
                  {serviceMenu.map((item) => {
                    const expanded = expandedPlatform === item.platform;
                    return (
                      <div className="service-nav-group" key={item.platform}>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          className={
                            expanded
                              ? "service-nav-parent open"
                              : "service-nav-parent"
                          }
                          onClick={() =>
                            setExpandedPlatform(expanded ? "" : item.platform)
                          }
                        >
                          <div className="platform-meta">
                            <span className="sidebar-platform-icon">
                              <PlatformIcon platform={item.platform} size={17} />
                            </span>
                            <b>{item.platform}</b>
                          </div>
                          <ChevronDown size={14} className="chevron" />
                        </button>
                        <div className={expanded ? "sidebar-accordion expanded" : "sidebar-accordion"}>
                          <div className="sidebar-accordion-inner">
                          <div className="service-nav-children">
                            {item.groups.map((groupName) => {
                              const target = `/order?platform=${encodeURIComponent(item.platform)}&group=${encodeURIComponent(groupName)}`;
                              const isActive =
                                location.pathname === "/order" &&
                                new URLSearchParams(location.search).get("platform") === item.platform &&
                                new URLSearchParams(location.search).get("group") === groupName;
                              return (
                                <NavLink
                                  key={groupName}
                                  to={target}
                                  className={() => isActive ? "active" : ""}
                                  onClick={() => setOpen(false)}
                                >
                                  {groupName}
                                </NavLink>
                              );
                            })}
                          </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              <small className="nav-section-title">TÀI CHÍNH & HỖ TRỢ</small>
              <NavLink to="/profile" onClick={() => setOpen(false)}><Users size={18}/><span>Hồ sơ tài khoản</span></NavLink>
              <NavLink to="/notifications" onClick={() => setOpen(false)}><Bell size={18}/><span>Thông báo{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}</span></NavLink>
              <NavLink to="/deposit" onClick={() => setOpen(false)}>
                <Wallet size={18} />
                <span>Nạp tiền</span>
              </NavLink>
              <NavLink to="/pricing" onClick={() => setOpen(false)}>
                <BookOpen size={18} />
                <span>Bảng giá</span>
              </NavLink>
              <NavLink to="/support" onClick={() => setOpen(false)}>
                <Headphones size={18} />
                <span>Hỗ trợ trực tuyến</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="side-foot">
          <div className="avatar">{initials}</div>
          <div className="user-info">
            <b>{user.displayName}</b>
            <span>
              <i />
              {admin ? "Quản trị viên" : "Khách hàng"}
            </span>
          </div>
          <button
            className="logout-btn"
            onClick={() => setConfirmLogout(true)}
            title="Đăng xuất tài khoản"
            aria-label="Đăng xuất"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main>
        <header>
          <button className="menu" onClick={() => setOpen(true)} aria-label="Mở menu">
            <Menu size={19} />
          </button>
          <div className="search">
            <Search size={16} />
            <input placeholder="Tìm dịch vụ hoặc mã đơn..." />
          </div>
          <div className="header-actions">
            <NavLink to="/deposit" className="wallet-chip" title="Nạp thêm tiền vào tài khoản">
              <Wallet size={16} />
              <span>
                {user.wallet
                  ? money(
                      Number(user.wallet.balance) - Number(user.wallet.reserved),
                    )
                  : "0đ"}
              </span>
              <span className="wallet-add">+</span>
            </NavLink>
            <NavLink to="/notifications" className="icon" title="Thông báo" aria-label="Thông báo">
              <Bell size={17} />
              {unreadNotifications > 0 && <i />}
            </NavLink>
            <NavLink to="/profile" className="mini-avatar" title="Hồ sơ tài khoản">{initials}</NavLink>
          </div>
        </header>
        {admin ? <AdminRoutes /> : <CustomerRoutes />}
      </main>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      {confirmLogout && <LogoutConfirmation onClose={() => setConfirmLogout(false)} onConfirm={onLogout}/>}
    </div>
  );
}

function CustomerRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardHome />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/order" element={<OrderPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/schedule" element={<ScheduledOrdersPage />} />
      <Route path="/deposit" element={<DepositPage />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/support" element={<Support />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}
function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<ManagedUsers />} />
      <Route path="services" element={<AdminServicesAdvanced />} />
      <Route path="orders" element={<ManagedOrders />} />
      <Route path="payments" element={<ManagedPayments />} />
      <Route path="audits" element={<ManagedAudits />} />
      <Route path="system" element={<SystemHealth />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="announcements" element={<AdminAnnouncements />} />
      <Route path="*" element={<Navigate to="/admin" />} />
    </Routes>
  );
}

function PageHead({
  eyebrow,
  title,
  desc,
  children,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {children}
    </div>
  );
}
function Stat({
  label,
  value,
  delta,
  color = "violet",
}: {
  label: string;
  value: string;
  delta: string;
  color?: string;
}) {
  return (
    <article className="stat">
      <div className={"stat-icon " + color}>
        <BarChart3 />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{delta}</small>
      </div>
    </article>
  );
}


function ServiceOrderTabs() {
  const location = useLocation();
  const group = new URLSearchParams(location.search).get("group");
  if (!group) return null;
  return <nav className="service-order-tabs" aria-label="Quản lý đơn theo dịch vụ">
    {[["/order", "Tạo đơn"], ["/orders", "Danh sách đơn"], ["/schedule", "Lịch chạy đơn"]].map(([path, label]) => <NavLink key={path} to={`${path}${location.search}`} className={location.pathname === path ? "selected" : ""}>{label}</NavLink>)}
  </nav>;
}

function OrderPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const requestedPlatform = queryParams.get("platform") ?? "";
  const requestedGroup = queryParams.get("group") ?? "";
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState(1000);
  const [comments, setComments] = useState("");
  const [link, setLink] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orderSupport, setOrderSupport] = useState<Capabilities | null>(null);
  const loadOrderServices = () =>
    api<
      Array<{
        id: string;
        displayName: string;
        sellingRate: string;
        providerType: string;
        providerDescription: string | null;
        min: number;
        max: number;
        category: { name: string };
      }>
    >("/services").then((rows) => {
      const mapped = rows.map((x) => ({
        id: x.id,
        name: x.displayName,
        platform: x.category.name,
        price: Number(x.sellingRate),
        providerType: x.providerType,
        providerDescription: x.providerDescription,
        min: x.min,
        max: x.max,
        enabled: true,
      }));
      setServices(mapped);
    });
  useEffect(() => {
    loadOrderServices().catch(() => {
      setFeedbackError(true);
      setFeedback("Chưa thể tải danh sách dịch vụ. Vui lòng thử lại sau.");
    });
  }, []);
  useEffect(() => {
    api<Capabilities>("/health/capabilities")
      .then(setOrderSupport)
      .catch(() => null);
  }, []);
  const filtered = services.filter(
    (s) =>
      Boolean(requestedGroup) &&
      servicePlatform(s) === requestedPlatform &&
      s.platform === requestedGroup && s.enabled,
  );
  useEffect(() => {
    setServiceId((current) =>
      filtered.some((x) => String(x.id) === current)
        ? current
        : String(filtered[0]?.id ?? ""),
    );
  }, [requestedPlatform, requestedGroup, services]);
  const selected = filtered.find((x) => String(x.id) === serviceId);
  const customComments = selected?.providerType === "Custom Comments";
  const commentLines = comments.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const orderQuantity = customComments ? commentLines.length : quantity;
  const descriptionDocument = new DOMParser().parseFromString(selected?.providerDescription ?? "", "text/html");
  descriptionDocument.querySelectorAll("style,script").forEach(node => node.remove());
  const serviceDescription = descriptionDocument.body.textContent?.trim();
  useEffect(() => {
    if (selected && (quantity < selected.min || quantity > selected.max))
      setQuantity(selected.min);
  }, [serviceId]);
  const validQuantity = Boolean(
    selected && orderQuantity >= selected.min && orderQuantity <= selected.max,
  );
  const validLink = /^https?:\/\/\S+$/i.test(link.trim());
  const validSchedule =
    !scheduleEnabled ||
    (Boolean(scheduledAt) &&
      new Date(scheduledAt).getTime() >= Date.now() + 30_000);
  const total = selected ? (selected.price * orderQuantity) / 1000 : 0;
  async function submit() {
    if (!selected || !validLink || !validQuantity || !validSchedule) {
      setFeedbackError(true);
      setFeedback(
        !validLink
          ? "Đường dẫn phải bắt đầu bằng http:// hoặc https://."
          : !validQuantity
            ? "Số lượng chưa nằm trong giới hạn của dịch vụ."
            : "Thời gian chạy phải cách hiện tại ít nhất 30 giây.",
      );
      return;
    }
    setBusy(true);
    setFeedback("");
    setFeedbackError(false);
    try {
      const order = await api<{ publicId: string }>("/orders", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          serviceId: String(selected.id),
          link,
          quantity: orderQuantity,
          comments: customComments ? commentLines.join("\n") : undefined,
          scheduledAt: scheduleEnabled
            ? new Date(scheduledAt).toISOString()
            : undefined,
        }),
      });
      setFeedback(
        scheduleEnabled
          ? `Đã tạo lịch ${order.publicId}. Tiền đã được giữ và đơn sẽ chạy đúng thời gian đã chọn.`
          : `Đã tiếp nhận đơn ${order.publicId}. Bạn có thể theo dõi trong mục Đơn hàng.`,
      );
      setLink("");
      setComments("");
    } catch (e) {
      setFeedbackError(true);
      const code = e instanceof ApiError ? e.code : "INTERNAL_ERROR";
      if (code === "SERVICE_PRICE_UPDATED")
        await loadOrderServices().catch(() => null);
      setFeedback(
        code === "INSUFFICIENT_BALANCE"
          ? "Số dư không đủ để tạo đơn. Vui lòng nạp thêm tiền."
          : code === "ORDER_QUANTITY_OUT_OF_RANGE"
            ? "Số lượng nằm ngoài giới hạn dịch vụ."
            : code === "SERVICE_PRICE_UPDATED"
              ? "Giá dịch vụ vừa thay đổi và giá cũ có thể gây bán lỗ. Hệ thống đã tải lại giá mới; vui lòng kiểm tra tổng tiền rồi đặt lại."
              : code === "INVALID_COMMENTS" ? "Vui lòng nhập mỗi bình luận trên một dòng, đúng giới hạn dịch vụ." : errorText(code),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page order-page">
      <PageHead
        eyebrow="ĐƠN HÀNG"
        title={requestedGroup || "Tạo đơn mới"}
        desc={requestedGroup ? "Chọn dịch vụ, nhập thông tin và xác nhận thanh toán." : "Chọn nhóm dịch vụ trong menu bên trái để bắt đầu."}
      />
      <ServiceOrderTabs />
      <div className="form-layout order-layout">
        <section className="card form-card">
          <div className="order-section-title"><b>1. Chọn dịch vụ</b><span>{filtered.length} dịch vụ</span></div>
          <div className="order-service-options">
            {filtered.map((service) => {
              const checked = String(service.id) === serviceId;
              return (
                <label
                  className={
                    checked
                      ? "order-service-option selected"
                      : "order-service-option"
                  }
                  key={service.id}
                >
                  <input
                    type="radio"
                    name="service"
                    checked={checked}
                    onChange={() => setServiceId(String(service.id))}
                  />
                  <span className="service-radio" />
                  <span className="order-service-copy">
                    <b>{service.name}</b>
                    <small>{service.platform}</small>
                    <small>
                      Giới hạn {service.min.toLocaleString("vi-VN")} –{" "}
                      {service.max.toLocaleString("vi-VN")}
                    </small>
                  </span>
                  <span className="order-service-price">
                    <b>{unitMoney(service.price)}</b>
                    <small>{money(service.price)} / 1.000</small>
                  </span>
                </label>
              );
            })}
            {!filtered.length && (
              <div className="order-empty-services">
                {requestedGroup ? "Nhóm này hiện chưa có dịch vụ đang mở bán." : "Chọn nhóm dịch vụ ở sidebar để xem các dịch vụ có thể đặt."}
              </div>
            )}
          </div>
          <div className="order-section-title"><b>2. Thông tin đơn hàng</b></div>
          <label>{customComments ? "Link bài viết / video cần bình luận" : "Đường dẫn bài viết / video / tài khoản"}</label>
          <input
            className="input"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Dán đường dẫn bài viết hoặc video"
          />
          {link && !validLink && (
            <small className="field-error">
              Đường dẫn phải bắt đầu bằng http:// hoặc https://
            </small>
          )}
          {customComments && <div className="order-comments-field">
            <label htmlFor="order-comments">Nội dung bình luận <span className="field-error">*</span></label>
            <textarea id="order-comments" className="input" rows={7} maxLength={100000} value={comments} onChange={e => setComments(e.target.value)} placeholder="Nhập mỗi bình luận trên một dòng" />
            <small>Mỗi dòng không trống tương ứng 1 bình luận. Đã nhập <b>{commentLines.length}</b> bình luận; số lượng và tổng tiền được tính tự động.</small>
          </div>}
          <div className="split">
            <div>
              <label>Số lượng</label>
              <input
                className="input"
                type="number"
                value={orderQuantity}
                readOnly={customComments}
                min={selected?.min ?? 1}
                max={selected?.max}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Giới hạn</label>
              <div className="input muted">
                {selected
                  ? `${selected.min.toLocaleString("vi-VN")} – ${selected.max.toLocaleString("vi-VN")}`
                  : "—"}
              </div>
            </div>
          </div>
          {selected && !validQuantity && (
            <small className="field-error">
              Nhập từ {selected.min.toLocaleString("vi-VN")} đến{" "}
              {selected.max.toLocaleString("vi-VN")}.
            </small>
          )}
          <div className="schedule-order-setting">
            <div>
              <b>Hẹn giờ lên đơn</b>
              <small>
                Đơn chỉ được gửi sang nhà cung cấp khi đến thời gian đã chọn.
              </small>
            </div>
            <button
              className={scheduleEnabled ? "toggle on" : "toggle"}
              onClick={() => setScheduleEnabled((value) => !value)}
              aria-label="Bật tắt hẹn giờ lên đơn"
            >
              <i />
            </button>
          </div>
          {scheduleEnabled && (
            <div className="schedule-time-field">
              <label>Thời gian chạy</label>
              <input
                className="input"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              {!validSchedule && scheduledAt && (
                <small className="field-error">
                  Chọn thời gian trong tương lai.
                </small>
              )}
            </div>
          )}
          <div className="order-review">
            <div className="order-review-heading">
              <div>
                <small>3. KIỂM TRA & XÁC NHẬN</small>
                <b>{selected?.name ?? "Chưa chọn dịch vụ"}</b>
              </div>
              <div className="order-total-highlight"><small>TỔNG THANH TOÁN</small><strong>{selected && validQuantity ? money(total) : "—"}</strong></div>
            </div>
            <div className="order-review-details">
              <span>
                Đơn giá <b>{selected ? unitMoney(selected.price) : "—"}</b>
              </span>
              <span>
                Số lượng <b>{orderQuantity.toLocaleString("vi-VN")}</b>
              </span>
              {scheduleEnabled && (
                <span>
                  Chạy lúc{" "}
                  <b>
                    {scheduledAt
                      ? new Date(scheduledAt).toLocaleString("vi-VN")
                      : "Chưa chọn"}
                  </b>
                </span>
              )}
            </div>
            <button
              className="primary wide"
              disabled={
                !selected ||
                !validLink ||
                !validQuantity ||
                !validSchedule ||
                busy
              }
              onClick={submit}
            >
              {busy
                ? "Đang ghi nhận…"
                : scheduleEnabled
                  ? "Xác nhận đặt lịch"
                  : "Xác nhận đặt đơn"}
            </button>
          </div>
          <div className="notice">
            Sau khi xác nhận, bạn có thể theo dõi tiến độ trong mục Đơn hàng.
          </div>
          {feedback && (
            <div className={feedbackError ? "form-error" : "form-success"}>
              {feedback}
            </div>
          )}
        </section>
        <aside className="order-help">
          {serviceDescription && <section className="card order-help-card"><h2>Lưu ý dịch vụ đã chọn</h2><p style={{whiteSpace: "pre-line", overflowWrap: "anywhere"}}>{serviceDescription}</p></section>}
          <section className="card order-help-card">
            <div className="order-help-icon">
              <Info />
            </div>
            <h2>Đặt đơn chính xác</h2>
            <ol>
              <li>
                Mở đúng bài viết, video hoặc tài khoản cần tăng tương tác.
              </li>
              <li>Sao chép đường dẫn đầy đủ rồi dán vào ô bên cạnh.</li>
              <li>Không tạo nhiều đơn giống nhau khi đơn cũ còn đang chạy.</li>
              <li>
                Không thay đổi quyền riêng tư hoặc xóa nội dung trong lúc chạy.
              </li>
            </ol>
          </section>
          <section className="card order-help-card support-card">
            <div className="order-help-icon">
              <Headphones />
            </div>
            <h2>Cần hỗ trợ?</h2>
            <p>
              Liên hệ bộ phận hỗ trợ nếu bạn chưa chắc đường dẫn hoặc loại dịch
              vụ cần chọn.
            </p>
            <div className="order-support-actions">
              {typeof orderSupport?.telegram === "string" &&
                orderSupport.telegram && (
                  <a
                    className="primary"
                    href={orderSupport.telegram}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Telegram
                  </a>
                )}
              {typeof orderSupport?.fanpage === "string" &&
                orderSupport.fanpage && (
                  <a
                    className="secondary"
                    href={orderSupport.fanpage}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Fanpage
                  </a>
                )}
              {!orderSupport?.telegram && !orderSupport?.fanpage && (
                <NavLink className="secondary" to="/support">
                  Trung tâm hỗ trợ
                </NavLink>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function RealOrderTable({
  items,
  admin = false,
}: {
  items: RealOrder[];
  admin?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã đơn</th>
            {admin && <th>Khách hàng</th>}
            <th>Dịch vụ</th>
            <th>Trạng thái</th>
            <th>Số lượng</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id}>
              <td>
                <b>{o.publicId}</b>
              </td>
              {admin && <td>{o.user?.email ?? "—"}</td>}
              <td>{o.service.displayName}</td>
              <td>
                <span
                  className={
                    "status " +
                    (o.status === "COMPLETED"
                      ? "success"
                      : o.status.includes("WAITING")
                        ? "warning"
                        : "info")
                  }
                >
                  <i />
                  {statusLabel[o.status] ?? o.status}
                </span>
              </td>
              <td>{o.quantity.toLocaleString("vi-VN")}</td>
              <td>
                <b>{money(Number(o.chargeAmount))}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <div className="empty">Chưa có dữ liệu.</div>}
    </div>
  );
}
const statusLabel: Record<string, string> = {
  CREATED: "Đã tiếp nhận",
  SCHEDULED: "Đang chờ lịch",
  FUNDS_RESERVED: "Đã tiếp nhận",
  QUEUED: "Đang chờ xử lý",
  WAITING_PROVIDER_BALANCE: "Đang chờ xử lý",
  WAITING_PROVIDER_SYNC: "Đang chờ hệ thống",
  PRICE_CONFLICT: "Đang được kiểm tra",
  SUBMITTING: "Đang khởi tạo",
  SUBMISSION_UNKNOWN: "Đang được kiểm tra",
  SUBMITTED: "Đã gửi",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  PARTIAL: "Hoàn thành một phần",
  CANCELED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
  MANUAL_REVIEW: "Đang được kiểm tra",
};
function OrdersPage() {
  const location = useLocation();
  const group = new URLSearchParams(location.search).get("group");
  const ordersUrl = group ? `/orders?group=${encodeURIComponent(group)}` : "/orders";
  const [items, setItems] = useState<
    Array<{
      id: string;
      publicId: string;
      status: string;
      quantity: number;
      chargeAmount: string;
      createdAt: string;
      publicMessage: string | null;
      service: { displayName: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api<typeof items>(ordersUrl)
        .then((rows) => active && setItems(rows))
        .finally(() => active && setLoading(false));
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [ordersUrl]);
  return (
    <div className="page order-page">
      <PageHead
        eyebrow="LỊCH SỬ"
        title={group ? `Đơn hàng · ${group}` : "Đơn hàng của bạn"}
        desc="Theo dõi tiến độ mà không cần tải lại trang."
      />
      <ServiceOrderTabs />
      <section className="card">
        <div className="toolbar">
          <div className="search field">
            <Search />
            <input placeholder="Tìm theo mã đơn hoặc liên kết" />
          </div>
          <button className="secondary">
            Tất cả trạng thái <ChevronDown />
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Dịch vụ</th>
                <th>Trạng thái</th>
                <th>Số lượng</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.publicId}</b>
                  </td>
                  <td>{o.service.displayName}</td>
                  <td>
                    <span
                      className={
                        "status " +
                        (o.status === "COMPLETED"
                          ? "success"
                          : o.status.includes("WAITING")
                            ? "warning"
                            : "info")
                      }
                    >
                      <i />
                      {statusLabel[o.status] ?? "Đang xử lý"}
                    </span>
                    {o.publicMessage && (
                      <small className="order-public-message">
                        {o.publicMessage}
                      </small>
                    )}
                  </td>
                  <td>{o.quantity.toLocaleString("vi-VN")}</td>
                  <td>
                    <b>{money(Number(o.chargeAmount))}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !items.length && (
            <div className="empty">Bạn chưa có đơn hàng nào.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ScheduledOrdersPage() {
  const location = useLocation();
  const group = new URLSearchParams(location.search).get("group");
  const ordersUrl = group ? `/orders?group=${encodeURIComponent(group)}` : "/orders";
  const [items, setItems] = useState<
    Array<{
      id: string;
      publicId: string;
      status: string;
      quantity: number;
      chargeAmount: string;
      scheduledAt: string | null;
      service: { displayName: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const loadSchedules = () =>
    api<typeof items>(ordersUrl).then((rows) =>
      setItems(rows.filter((x) => x.status === "SCHEDULED")),
    );
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api<typeof items>(ordersUrl)
        .then(
          (rows) =>
            active && setItems(rows.filter((x) => x.status === "SCHEDULED")),
        )
        .finally(() => active && setLoading(false));
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [ordersUrl]);
  return (
    <div className="page order-page">
      <PageHead
        eyebrow="HẸN GIỜ"
        title={group ? `Lịch chạy · ${group}` : "Lịch chạy đơn"}
        desc="Các đơn đã giữ số dư và đang chờ đến thời gian chạy."
      />
      {message && <div className="notice">{message}</div>}
      <ServiceOrderTabs />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã lịch</th>
                <th>Dịch vụ</th>
                <th>Thời gian chạy</th>
                <th>Số lượng</th>
                <th>Đã giữ</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id}>
                  <td>
                    <b>{order.publicId}</b>
                  </td>
                  <td>{order.service.displayName}</td>
                  <td>
                    <b>
                      {order.scheduledAt
                        ? new Date(order.scheduledAt).toLocaleString("vi-VN")
                        : "—"}
                    </b>
                  </td>
                  <td>{order.quantity.toLocaleString("vi-VN")}</td>
                  <td>{money(Number(order.chargeAmount))}</td>
                  <td>
                    <span className="status warning">
                      <i />
                      Đang chờ lịch
                    </span>
                  </td>
                  <td>
                    <button
                      className="secondary compact"
                      onClick={async () => {
                        setMessage("");
                        try {
                          await api(`/orders/${order.id}/cancel-schedule`, {
                            method: "PATCH",
                          });
                          await loadSchedules();
                          setMessage(
                            `Đã hủy lịch ${order.publicId} và hoàn lại số dư giữ.`,
                          );
                        } catch (e) {
                          setMessage(
                            errorText(
                              e instanceof ApiError ? e.code : "INTERNAL_ERROR",
                            ),
                          );
                        }
                      }}
                    >
                      Hủy lịch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !items.length && (
            <div className="empty">Chưa có lịch chạy đơn nào.</div>
          )}
        </div>
      </section>
    </div>
  );
}

type Capabilities = {
  banking: boolean;
  usdt: boolean;
  usdtTrc20?: boolean;
  usdtBep20?: boolean;
  usdtRate: unknown;
  telegram: unknown;
  fanpage: unknown;
};
type DepositInstruction = {
  publicId: string;
  method: string;
  requestedVnd: string;
  expectedUsdt: string | null;
  paymentCode: string;
  network: string | null;
  destinationAddress: string | null;
  expiresAt: string;
  banking: null | {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
};
function PaymentInstructions({ request }: { request: DepositInstruction }) {
  const [copyMessage, setCopyMessage] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const banking = request.method === "BANKING";
  const expired = now >= new Date(request.expiresAt).getTime();
  const networkLabel = request.network === "TRX" ? "TRON (TRC20)" : request.network === "BSC" ? "BNB Smart Chain (BEP20)" : request.network;
  const qrParams = request.banking ? new URLSearchParams({ acc: request.banking.accountNumber, bank: request.banking.bankName, amount: request.requestedVnd, des: request.paymentCode, template: "qronly" }) : null;
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopyMessage(`Đã sao chép ${label}.`); }
    catch { setCopyMessage("Chưa thể sao chép tự động. Bạn có thể chọn và sao chép thông tin bên dưới."); }
  }
  function copyField(label: string, value: string, highlight = false) {
    return <div className={highlight ? "payment-copy-field highlight" : "payment-copy-field"}><div><small>{label}</small><b>{value}</b></div><button type="button" className="payment-copy-button" onClick={() => copy(value, label.toLowerCase())} aria-label={`Sao chép ${label.toLowerCase()}`}><Copy size={16}/></button></div>;
  }
  return <section className="payment-instruction">
    <div className="payment-instruction-heading"><h3>{banking ? "Quét QR để chuyển khoản" : "Quét QR địa chỉ nhận USDT"}</h3><span className="payment-network-badge">{banking ? "Banking" : networkLabel}</span></div>
    <div className="payment-qr-layout"><div className="payment-qr-panel">
      {expired ? <div className="payment-qr-unavailable">Yêu cầu đã hết hạn. Vui lòng tạo yêu cầu mới trước khi chuyển tiền.</div> : banking && qrParams ? qrFailed ? <div className="payment-qr-unavailable">Chưa tải được QR. Bạn có thể chuyển khoản bằng thông tin bên cạnh.<button className="secondary" onClick={() => setQrFailed(false)}>Tải lại QR</button></div> : <img src={`https://vietqr.app/img?${qrParams}`} alt="QR ngân hàng chứa tài khoản, số tiền và nội dung chuyển khoản" width={220} height={220} referrerPolicy="no-referrer" onError={() => setQrFailed(true)}/> : request.destinationAddress ? <QRCodeSVG value={request.destinationAddress} size={220} level="M" marginSize={4} title={`QR địa chỉ nhận USDT trên ${networkLabel}`}/> : <p>Chưa có thông tin QR.</p>}
      <small>{banking ? "Mở ứng dụng ngân hàng để quét mã." : "QR chỉ chứa địa chỉ ví, không tự điền số tiền hoặc chọn mạng."}</small>
    </div><div className="payment-transfer-details">
      {request.banking && <>{copyField("Ngân hàng", request.banking.bankName)}{copyField("Số tài khoản", request.banking.accountNumber)}{copyField("Chủ tài khoản", request.banking.accountName)}{copyField("Số tiền chuyển (VND)", request.requestedVnd, true)}{copyField("Nội dung chuyển khoản", request.paymentCode)}</>}
      {!banking && request.destinationAddress && <>{copyField("Mạng nhận USDT", networkLabel ?? "")}{copyField("Địa chỉ ví nhận", request.destinationAddress)}{copyField("Số USDT cần nhận chính xác", request.expectedUsdt ?? "", true)}<div className="payment-credit-summary">Số dư được cộng: <b>{money(Number(request.requestedVnd))}</b></div></>}
      <small className="payment-expiry">{expired ? "Đã hết hạn" : "Hết hạn lúc"}: {new Date(request.expiresAt).toLocaleString("vi-VN")}</small>
    </div></div>
    {!banking && <div className="notice">Chuyển USDT không cần nội dung hoặc mã nạp. Sau khi quét QR, hãy chọn đúng {networkLabel} và nhập toàn bộ số USDT hiển thị, kể cả phần thập phân. Thanh toán phí riêng để số tiền nhận không bị thiếu. Không dùng lại yêu cầu này cho lần nạp khác.</div>}
    {copyMessage && <div className="payment-copy-status" role="status">{copyMessage}</div>}
  </section>;
}

function DepositPage() {
  const [method, setMethod] = useState<"BANKING" | "USDT_TRC20" | "USDT_BEP20">(
    "BANKING",
  );
  const [amount, setAmount] = useState(100000);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [result, setResult] = useState<DepositInstruction | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Capabilities>("/health/capabilities").then((c) => {
      setCaps(c);
      if (!c.banking) setMethod(c.usdtTrc20 ? "USDT_TRC20" : "USDT_BEP20");
    });
  }, []);
  async function create() {
    setBusy(true);
    setFeedback("");
    try {
      setResult(
        await api<DepositInstruction>("/payments/deposits", {
          method: "POST",
          body: JSON.stringify({ method, amountVnd: amount }),
        }),
      );
    } catch (e) {
      setFeedback(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    } finally {
      setBusy(false);
    }
  }
  if (!caps)
    return (
      <div className="page">
        <PageHead
          eyebrow="TÀI CHÍNH"
          title="Nạp tiền"
          desc="Đang tải phương thức nạp tiền…"
        />
      </div>
    );
  if (!caps.banking && !caps.usdt)
    return (
      <div className="page">
        <PageHead
          eyebrow="TÀI CHÍNH"
          title="Nạp tiền"
          desc="Quản lý số dư tài khoản của bạn."
        />
        <section className="card empty">
          <CreditCard />
          <h2>Nạp tiền tạm thời chưa khả dụng</h2>
          <p>Vui lòng quay lại sau.</p>
        </section>
      </div>
    );
  return (
    <div className="page">
      <PageHead
        eyebrow="TÀI CHÍNH"
        title="Nạp tiền"
        desc="Chọn phương thức phù hợp để nạp thêm số dư."
      />
      <div className="deposit-layout">
        <section className="card form-card">
          <div className="tabs">
            {caps.banking && (
              <button
                onClick={() => {
                  setMethod("BANKING");
                  setResult(null);
                }}
                className={method === "BANKING" ? "active" : ""}
              >
                Ngân hàng
              </button>
            )}
            {caps.usdtTrc20 && (
              <button
                onClick={() => {
                  setMethod("USDT_TRC20");
                  setResult(null);
                }}
                className={method === "USDT_TRC20" ? "active" : ""}
              >
                USDT TRC20
              </button>
            )}
            {caps.usdtBep20 && (
              <button
                onClick={() => {
                  setMethod("USDT_BEP20");
                  setResult(null);
                }}
                className={method === "USDT_BEP20" ? "active" : ""}
              >
                USDT BEP20
              </button>
            )}
          </div>
          <label>Số tiền muốn nạp (VND)</label>
          <div className="amount-presets">
            {[50000, 100000, 200000, 500000, 1000000, 2000000].map((preset) => (
              <button
                type="button"
                key={preset}
                className={amount === preset ? "selected" : ""}
                onClick={() => setAmount(preset)}
              >
                {money(preset)}
              </button>
            ))}
          </div>
          <input
            className="input"
            type="number"
            min="10000"
            step="10000"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button
            className="primary wide"
            disabled={busy || amount < 10000}
            onClick={create}
          >
            {busy ? "Đang tạo…" : "Tạo yêu cầu nạp"}
          </button>
          {feedback && <div className="form-error">{feedback}</div>}
          {result && <PaymentInstructions key={result.publicId} request={result}/>}
        </section>
        <aside className="card summary">
          <h2>Lưu ý</h2>
          <ul>
            <li>Chỉ thanh toán theo yêu cầu vừa tạo.</li>
            {method === "BANKING" ? <li>Ghi chính xác nội dung chuyển khoản hoặc quét QR ngân hàng.</li> : <><li>USDT không cần nội dung chuyển khoản. QR chỉ chứa địa chỉ ví.</li><li>Chọn đúng mạng và chuyển chính xác số USDT, gồm toàn bộ phần thập phân.</li></>}
            <li>Số dư tự cập nhật sau khi giao dịch được xác nhận.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
function Pricing() {
  const [items, setItems] = useState<Service[]>([]);
  useEffect(() => {
    api<
      Array<{
        id: string;
        displayName: string;
        sellingRate: string;
        min: number;
        max: number;
        category: { name: string };
      }>
    >("/services").then((rows) =>
      setItems(
        rows.map((x) => ({
          id: x.id,
          name: x.displayName,
          platform: x.category.name,
          price: Number(x.sellingRate),
          min: x.min,
          max: x.max,
          enabled: true,
        })),
      ),
    );
  }, []);
  return (
    <div className="page">
      <PageHead
        eyebrow="DỊCH VỤ"
        title="Bảng giá"
        desc="Chỉ hiển thị dịch vụ đang được bật và giá bán hiện tại."
      />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dịch vụ</th>
                <th>Nền tảng</th>
                <th>Giá / 1.000</th>
                <th>Tối thiểu</th>
                <th>Tối đa</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                  </td>
                  <td>{s.platform}</td>
                  <td>
                    <b>{money(s.price)}</b>
                  </td>
                  <td>{s.min.toLocaleString("vi-VN")}</td>
                  <td>{s.max.toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <div className="empty">Chưa có dịch vụ đang được mở bán.</div>
          )}
        </div>
      </section>
    </div>
  );
}
function Support() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  useEffect(() => {
    api<Capabilities>("/health/capabilities").then(setCaps);
  }, []);
  const telegram = typeof caps?.telegram === "string" ? caps.telegram : "";
  const fanpage = typeof caps?.fanpage === "string" ? caps.fanpage : "";
  if (caps && !telegram && !fanpage)
    return (
      <div className="page">
        <PageHead
          eyebrow="HỖ TRỢ"
          title="Bạn cần trợ giúp?"
          desc="Các kênh hỗ trợ trực tuyến."
        />
        <section className="card empty">
          <Headphones />
          <h2>Hỗ trợ trực tuyến tạm thời chưa khả dụng</h2>
          <p>Vui lòng quay lại sau.</p>
        </section>
      </div>
    );
  return (
    <div className="page">
      <PageHead
        eyebrow="HỖ TRỢ"
        title="Bạn cần trợ giúp?"
        desc="Chọn kênh liên hệ phù hợp."
      />
      <div className="support-grid">
        {telegram && (
          <article className="card support">
            <div className="support-icon telegram">
              <Send size={24} />
            </div>
            <h2>Telegram Hỗ trợ</h2>
            <p>Trao đổi nhanh với bộ phận hỗ trợ 24/7.</p>
            <a
              className="primary"
              href={telegram}
              target="_blank"
              rel="noreferrer"
            >
              Mở Telegram
            </a>
          </article>
        )}
        {fanpage && (
          <article className="card support">
            <div className="support-icon fanpage">
              <MessageCircle size={24} />
            </div>
            <h2>Fanpage Hỗ trợ</h2>
            <p>Nhắn tin trực tiếp qua Facebook Messenger.</p>
            <a
              className="secondary"
              href={fanpage}
              target="_blank"
              rel="noreferrer"
            >
              Mở Fanpage
            </a>
          </article>
        )}
      </div>
    </div>
  );
}

type AdminDashboardData = {
  users: number;
  totalOrders: number;
  todayOrders: number;
  completed: number;
  attention: number;
  serviceCount: number;
  activeServices: number;
  payments: number;
  revenue: number;
  profit: number;
  providerConfigured: boolean;
  provider: null | {
    balance: string;
    currency: string;
    status: string;
    lastCheckedAt: string | null;
  };
  queues: Array<{ status: string; _count: { _all: number } }>;
};
function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try { setData(await api<AdminDashboardData>("/admin/dashboard")); }
    catch { setError("Chưa tải được số liệu tổng quan. Vui lòng thử lại."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
  }, []);
  const queues = data?.queues ?? [];
  return (
    <div className="page admin-overview-page" aria-busy={loading}>
      <PageHead
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Tổng quan vận hành"
        desc="Theo dõi doanh thu, hàng đợi và số dư nhà cung cấp."
      >
        <button className="secondary" disabled={loading} onClick={() => load()}>
          <RefreshCw size={16} />
          {loading ? "Đang tải…" : "Làm mới"}
        </button>
      </PageHead>
      {error && <div className="form-error" role="alert">{error}</div>}
      <AdminFinanceOverview />
      {!data ? <div className="card admin-overview-loading" role="status">{loading ? "Đang tải số liệu tổng quan…" : "Chưa có số liệu để hiển thị."}</div> : <>
      <div className="stats">
        <Stat
          label="Đơn tạo hôm nay"
          value={String(data?.todayOrders ?? 0)}
          delta={`${data?.totalOrders ?? 0} đơn toàn hệ thống`}
        />
        <Stat
          label="Thành viên"
          value={String(data?.users ?? 0)}
          delta={`${data?.completed ?? 0} đơn đã hoàn thành`}
          color="green"
        />
        <Stat
          label="Số dư nhà cung cấp"
          value={
            data?.provider
              ? `${new Intl.NumberFormat("vi-VN").format(Number(data.provider.balance))} ${data.provider.currency}`
              : "—"
          }
          delta={
            data?.providerConfigured ? "Đã cấu hình API" : "Chưa cấu hình API"
          }
          color="blue"
        />
        <Stat
          label="Đơn cần chú ý"
          value={String(data?.attention ?? 0)}
          delta={`${data?.totalOrders ?? 0} tổng đơn`}
          color="orange"
        />
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-title">
            <div>
              <h2>Hàng đợi vận hành</h2>
              <p>Trạng thái thực tế cần theo dõi</p>
            </div>
          </div>
          <div className="queue-list">
            {queues.map((x) => (
              <div key={x.status}>
                <span>
                  <i />
                  {statusLabel[x.status] ?? x.status}
                </span>
                <b>{x._count._all}</b>
              </div>
            ))}
            {!queues.length && (
              <div className="empty">Không có đơn cần xử lý.</div>
            )}
          </div>
        </section>
        <section className="card provider">
          <div className="card-title">
            <div>
              <h2>Nhà cung cấp</h2>
              <p>API chính</p>
            </div>
            <span
              className={
                "status " + (data?.providerConfigured ? "success" : "warning")
              }
            >
              <i />
              {data?.providerConfigured ? "Đã cấu hình" : "Chưa cấu hình"}
            </span>
          </div>
          <div className="provider-balance">
            <small>SỐ DƯ GẦN NHẤT</small>
            <strong>
              {data?.provider
                ? `${new Intl.NumberFormat("vi-VN").format(Number(data.provider.balance))} ${data.provider.currency}`
                : "Chưa có dữ liệu"}
            </strong>
            <p>
              {data?.provider?.lastCheckedAt
                ? `Kiểm tra: ${new Date(data.provider.lastCheckedAt).toLocaleString("vi-VN")}`
                : "Chưa từng kiểm tra số dư"}
            </p>
          </div>
          <dl>
            <div>
              <dt>Thành viên</dt>
              <dd>{data?.users ?? 0}</dd>
            </div>
            <div>
              <dt>Dịch vụ đang bán</dt>
              <dd>
                {data?.activeServices ?? 0} / {data?.serviceCount ?? 0}
              </dd>
            </div>
            <div>
              <dt>Thanh toán ghi nhận</dt>
              <dd>{data?.payments ?? 0}</dd>
            </div>
          </dl>
        </section>
      </div>
      </>}
    </div>
  );
}
function AdminServices() {
  const [items, setItems] = useState<Service[]>([]);
  const load = () =>
    api<
      Array<{
        id: string;
        displayName: string;
        sellingRate: string;
        providerRate: string;
        min: number;
        max: number;
        adminEnabled: boolean;
        category: { name: string };
      }>
    >("/admin/services").then((rows) =>
      setItems(
        rows.map((x) => ({
          id: x.id,
          name: x.displayName,
          platform: x.category.name,
          price: Number(x.sellingRate),
          providerRate: Number(x.providerRate),
          min: x.min,
          max: x.max,
          enabled: x.adminEnabled,
        })),
      ),
    );
  useEffect(() => {
    load().catch(() => null);
  }, []);
  async function toggle(s: Service) {
    await api(`/admin/services/${s.id}`, {
      method: "PATCH",
      body: JSON.stringify({ adminEnabled: !s.enabled }),
    });
    setItems((xs) =>
      xs.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)),
    );
  }
  const active = items.filter((x) => x.enabled).length;
  return (
    <div className="page">
      <PageHead
        eyebrow="DANH MỤC"
        title="Dịch vụ & định giá"
        desc={`${active}/${items.length} dịch vụ đang được bán. Dịch vụ tắt thủ công không tự bật lại sau đồng bộ.`}
      >
        <button
          className="primary"
          onClick={() => api("/services/sync", { method: "POST" }).then(load)}
        >
          <RefreshCw />
          Đồng bộ giá
        </button>
      </PageHead>
      <section className="card">
        <div className="toolbar">
          <div className="search field">
            <Search />
            <input placeholder="Tìm dịch vụ" />
          </div>
          <span>{items.length} dịch vụ thực tế</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dịch vụ</th>
                <th>Giá vốn</th>
                <th>Giá bán</th>
                <th>Chênh lệch</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                    <small className="block">
                      #{s.id} · {s.platform}
                    </small>
                  </td>
                  <td>{money(s.providerRate ?? 0)}</td>
                  <td>
                    <b>{money(s.price)}</b>
                  </td>
                  <td>
                    <span className="profit">
                      {money(s.price - (s.providerRate ?? 0))}
                    </span>
                  </td>
                  <td>
                    <button
                      aria-label={`Bật tắt ${s.name}`}
                      className={s.enabled ? "toggle on" : "toggle"}
                      onClick={() => toggle(s)}
                    >
                      <i />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <div className="empty">Chưa đồng bộ dịch vụ từ nhà cung cấp.</div>
          )}
        </div>
      </section>
    </div>
  );
}
function AdminServicesEditor() {
  const [items, setItems] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [bulkMode, setBulkMode] =
    useState<Service["pricingMode"]>("PERCENTAGE");
  const [bulkValue, setBulkValue] = useState(20);
  const [bulkMargin, setBulkMargin] = useState(2);
  const [bulkBusy, setBulkBusy] = useState(false);
  const load = () =>
    api<
      Array<{
        id: string;
        displayName: string;
        sellingRate: string;
        providerRate: string;
        min: number;
        max: number;
        adminEnabled: boolean;
        systemEnabled: boolean;
        providerEnabled: boolean;
        pricingMode: Service["pricingMode"];
        markupValue: string;
        minimumSafeMargin: string;
        category: { name: string };
      }>
    >("/admin/services").then((rows) =>
      setItems(
        rows.map((x) => ({
          id: x.id,
          name: x.displayName,
          platform: x.category.name,
          price: Number(x.sellingRate),
          providerRate: Number(x.providerRate),
          min: x.min,
          max: x.max,
          enabled: x.adminEnabled,
          systemEnabled: x.systemEnabled,
          providerEnabled: x.providerEnabled,
          pricingMode: x.pricingMode,
          markupValue: Number(x.markupValue),
          minimumSafeMargin: Number(x.minimumSafeMargin),
        })),
      ),
    );
  useEffect(() => {
    load().catch(() => null);
  }, []);
  const update = (id: Service["id"], patch: Partial<Service>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  async function save(s: Service, enabled = s.enabled) {
    setMessage("");
    try {
      await api(`/admin/services/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          adminEnabled: enabled,
          pricingMode: s.pricingMode,
          markupValue: s.markupValue,
          minimumSafeMargin: s.minimumSafeMargin,
        }),
      });
      await load();
      setMessage(`Đã lưu ${s.name}.`);
    } catch (e) {
      setMessage(
        e instanceof ApiError && e.code === "UNSAFE_SELLING_PRICE"
          ? "Giá bán không đạt biên an toàn nên không thể bật dịch vụ."
          : errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"),
      );
    }
  }
  async function applyBulk() {
    const targets = selected.size
      ? items.filter((x) => selected.has(String(x.id)))
      : items;
    if (!targets.length) return;
    setBulkBusy(true);
    setMessage("");
    try {
      const result = await api<{ updated: number; suspended: number }>(
        "/admin/services-pricing/bulk",
        {
          method: "PATCH",
          body: JSON.stringify({
            ids: targets.map((x) => String(x.id)),
            pricingMode: bulkMode,
            markupValue: bulkValue,
            minimumSafeMargin: bulkMargin,
          }),
        },
      );
      await load();
      setMessage(
        `Đã cập nhật ${result.updated} dịch vụ.${result.suspended ? ` ${result.suspended} dịch vụ tạm dừng vì chưa đạt biên an toàn.` : ""}`,
      );
    } catch (e) {
      setMessage(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    } finally {
      setBulkBusy(false);
    }
  }
  const platforms = [...new Set(items.map(servicePlatform))].sort();
  const groups = [...new Set(items.map((x) => x.platform))].sort();
  const types = [...new Set(items.map(serviceType))].sort();
  const visible = items.filter(
    (x) =>
      (x.name + " " + x.platform).toLowerCase().includes(query.toLowerCase()) &&
      (!platformFilter || servicePlatform(x) === platformFilter) &&
      (!groupFilter || x.platform === groupFilter) &&
      (!typeFilter || serviceType(x) === typeFilter),
  );
  const active = items.filter(
    (x) => x.enabled && x.systemEnabled && x.providerEnabled,
  ).length;
  const allVisibleSelected =
    visible.length > 0 && visible.every((x) => selected.has(String(x.id)));
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((x) => next.delete(String(x.id)));
      else visible.forEach((x) => next.add(String(x.id)));
      return next;
    });
  return (
    <div className="page">
      <PageHead
        eyebrow="DANH MỤC"
        title="Dịch vụ & định giá"
        desc={`${active}/${items.length} dịch vụ đang được bán. Dịch vụ không an toàn sẽ tự dừng sau đồng bộ.`}
      >
        <div className="head-actions">
          <button
            className="icon info-button"
            aria-label="Hướng dẫn định giá"
            title="Hướng dẫn định giá"
            onClick={() => setShowGuide(true)}
          >
            <Info size={20} />
          </button>
          <button
            className="primary"
            onClick={() => api("/services/sync", { method: "POST" }).then(load)}
          >
            <RefreshCw />
            Đồng bộ giá
          </button>
        </div>
      </PageHead>
      {message && <div className="notice">{message}</div>}
      <section className="card bulk-pricing">
        <div>
          <b>Áp dụng giá cho toàn bộ dịch vụ</b>
          <small>
            Thiết lập một lần cho {items.length} dịch vụ; giá bán được tính lại
            ngay.
          </small>
        </div>
        <select
          className="compact-input"
          value={bulkMode}
          onChange={(e) =>
            setBulkMode(e.target.value as Service["pricingMode"])
          }
        >
          <option value="PERCENTAGE">Cộng theo %</option>
          <option value="FIXED_MARKUP">Cộng VND cố định</option>
          <option value="FIXED_PRICE">Đặt giá cố định</option>
        </select>
        <label>
          <span>
            {bulkMode === "PERCENTAGE"
              ? "Mức cộng (%)"
              : bulkMode === "FIXED_MARKUP"
                ? "Mức cộng (VND)"
                : "Giá bán (VND)"}
          </span>
          <input
            className="compact-input number"
            type="number"
            min="0"
            value={bulkValue}
            onChange={(e) => setBulkValue(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Biên tối thiểu (%)</span>
          <input
            className="compact-input number"
            type="number"
            min="0"
            value={bulkMargin}
            onChange={(e) => setBulkMargin(Number(e.target.value))}
          />
        </label>
        <button
          className="primary"
          disabled={bulkBusy || !items.length}
          onClick={applyBulk}
        >
          {bulkBusy ? "Đang áp dụng…" : "Áp dụng tất cả"}
        </button>
      </section>
      <section className="card">
        <div className="toolbar">
          <div className="search field">
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm dịch vụ"
            />
          </div>
          <span>{visible.length} dịch vụ</span>
        </div>
        <div className="services-list">
          <div className="service-list-head">
            <span>Dịch vụ</span>
            <span>Giá vốn</span>
            <span>Giá bán & cấu hình</span>
            <span>Trạng thái</span>
          </div>
          {visible.map((s) => (
            <article className="service-row" key={s.id}>
              <div className="service-name">
                <b>{s.name}</b>
                <small>
                  #{s.id} · {s.platform}
                </small>
                {(!s.providerEnabled || !s.systemEnabled) && (
                  <small className="danger">
                    {!s.providerEnabled ? "Nguồn đã tắt" : "Tạm dừng an toàn"}
                  </small>
                )}
              </div>
              <div className="price-stack">
                <small>Giá vốn / 1.000</small>
                <b>{money(s.providerRate ?? 0)}</b>
              </div>
              <div className="price-stack">
                <b>{money(s.price)}</b>
                <small className="profit">
                  Lãi {money(s.price - (s.providerRate ?? 0))}
                </small>
                <small>
                  {s.pricingMode === "PERCENTAGE"
                    ? `Cộng ${s.markupValue}%`
                    : s.pricingMode === "FIXED_MARKUP"
                      ? `Cộng ${money(s.markupValue ?? 0)}`
                      : `Giá cố định`}{" "}
                  · Biên ≥ {s.minimumSafeMargin}%
                </small>
              </div>
              <div className="service-actions">
                <button
                  className="secondary compact"
                  onClick={() => setEditing({ ...s })}
                >
                  Chỉnh sửa
                </button>
                <button
                  aria-label={`Bật tắt ${s.name}`}
                  className={s.enabled ? "toggle on" : "toggle"}
                  onClick={() => save(s, !s.enabled)}
                >
                  <i />
                </button>
              </div>
            </article>
          ))}
          {!visible.length && (
            <div className="empty">Không tìm thấy dịch vụ.</div>
          )}
        </div>
      </section>
      {showGuide && (
        <div className="modal-backdrop" onClick={() => setShowGuide(false)}>
          <section
            className="card guide-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Đóng"
              onClick={() => setShowGuide(false)}
            >
              <X />
            </button>
            <Info className="guide-icon" />
            <h2>Hướng dẫn định giá dịch vụ</h2>
            <div className="guide-item">
              <b>Cộng theo phần trăm</b>
              <p>
                Giá bán = giá vốn + phần trăm. Ví dụ vốn 10.000đ, cộng 20% thì
                bán 12.000đ.
              </p>
            </div>
            <div className="guide-item">
              <b>Cộng VND cố định</b>
              <p>
                Giá bán = giá vốn + số tiền cố định trên mỗi 1.000 tương tác.
              </p>
            </div>
            <div className="guide-item">
              <b>Đặt giá cố định</b>
              <p>
                Dùng đúng giá bạn nhập, không phụ thuộc giá vốn. Dịch vụ sẽ tự
                tạm dừng nếu giá này thấp hơn biên an toàn.
              </p>
            </div>
            <div className="guide-item">
              <b>Biên tối thiểu</b>
              <p>
                Là lợi nhuận tối thiểu so với giá vốn. Khi giá nguồn tăng làm
                biên lợi nhuận thấp hơn mức này, hệ thống tự dừng dịch vụ để
                tránh lỗ.
              </p>
            </div>
            <div className="guide-note">
              Thanh “Áp dụng giá cho toàn bộ dịch vụ” cập nhật tất cả dịch vụ
              một lần. Bạn vẫn có thể chỉnh riêng từng dịch vụ bên dưới.
            </div>
            <button
              className="primary wide"
              onClick={() => setShowGuide(false)}
            >
              Đã hiểu
            </button>
          </section>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <section
            className="card edit-service-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Đóng"
              onClick={() => setEditing(null)}
            >
              <X />
            </button>
            <small className="modal-eyebrow">CHỈNH SỬA DỊCH VỤ</small>
            <h2>{editing.name}</h2>
            <div className="edit-price-summary">
              <span>Giá vốn / 1.000</span>
              <b>{money(editing.providerRate ?? 0)}</b>
            </div>
            <label>Cách tính giá bán</label>
            <select
              className="input"
              value={editing.pricingMode}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  pricingMode: e.target.value as Service["pricingMode"],
                })
              }
            >
              <option value="PERCENTAGE">Cộng theo phần trăm</option>
              <option value="FIXED_MARKUP">Cộng VND cố định</option>
              <option value="FIXED_PRICE">Đặt giá cố định</option>
            </select>
            <label>
              {editing.pricingMode === "PERCENTAGE"
                ? "Mức cộng (%)"
                : editing.pricingMode === "FIXED_MARKUP"
                  ? "Mức cộng (VND / 1.000)"
                  : "Giá bán (VND / 1.000)"}
            </label>
            <input
              className="input"
              type="number"
              min="0"
              value={editing.markupValue}
              onChange={(e) =>
                setEditing({ ...editing, markupValue: Number(e.target.value) })
              }
            />
            <label>Biên lợi nhuận tối thiểu (%)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={editing.minimumSafeMargin}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  minimumSafeMargin: Number(e.target.value),
                })
              }
            />
            <div className="edit-price-preview">
              <span>Giá bán hiện tại</span>
              <b>{money(editing.price)}</b>
              <small>Giá mới được tính sau khi lưu.</small>
            </div>
            <button
              className="primary wide"
              onClick={async () => {
                await save(editing);
                setEditing(null);
              }}
            >
              Lưu thay đổi
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function AdminServicesAdvanced() {
  const [items, setItems] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [group, setGroup] = useState("");
  const [kind, setKind] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Service | null>(null);
  const [guide, setGuide] = useState(false);
  const [message, setMessage] = useState("");
  const [bulkMode, setBulkMode] = useState<Service["pricingMode"]>(() => {
    const saved = localStorage.getItem("admin.services.bulkMode");
    return saved === "FIXED_MARKUP" || saved === "FIXED_PRICE"
      ? saved
      : "PERCENTAGE";
  });
  const [bulkValue, setBulkValue] = useState(() => {
    const raw = localStorage.getItem("admin.services.bulkValue");
    const saved = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(saved) && saved >= 0 ? saved : 20;
  });
  const [bulkMargin, setBulkMargin] = useState(() => {
    const raw = localStorage.getItem("admin.services.bulkMargin");
    const saved = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(saved) && saved >= 0 ? saved : 2;
  });
  const [preventLossSales, setPreventLossSales] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<
      Array<{
        id: string;
        displayName: string;
        sellingRate: string;
        providerRate: string;
        min: number;
        max: number;
        adminEnabled: boolean;
        systemEnabled: boolean;
        providerEnabled: boolean;
        pricingMode: Service["pricingMode"];
        markupValue: string;
        minimumSafeMargin: string;
        category: { name: string };
      }>
    >("/admin/services").then((rows) =>
      setItems(
        rows.map((x) => ({
          id: x.id,
          name: x.displayName,
          platform: x.category.name,
          price: Number(x.sellingRate),
          providerRate: Number(x.providerRate),
          min: x.min,
          max: x.max,
          enabled: x.adminEnabled,
          systemEnabled: x.systemEnabled,
          providerEnabled: x.providerEnabled,
          pricingMode: x.pricingMode,
          markupValue: Number(x.markupValue),
          minimumSafeMargin: Number(x.minimumSafeMargin),
        })),
      ),
    );
  useEffect(() => {
    load().catch(() => null);
    api<{ preventLossSales: boolean }>("/admin/settings")
      .then((settings) =>
        setPreventLossSales(settings.preventLossSales !== false),
      )
      .catch(() => null);
  }, []);
  useEffect(() => {
    localStorage.setItem("admin.services.bulkMode", bulkMode ?? "PERCENTAGE");
    localStorage.setItem("admin.services.bulkValue", String(bulkValue));
    localStorage.setItem("admin.services.bulkMargin", String(bulkMargin));
  }, [bulkMode, bulkValue, bulkMargin]);
  const platforms = [...new Set(items.map(servicePlatform))].sort();
  const groups = [...new Set(items.map((x) => x.platform))].sort();
  const kinds = [...new Set(items.map(serviceType))].sort();
  const visible = items.filter(
    (x) =>
      (x.name + " " + x.platform).toLowerCase().includes(query.toLowerCase()) &&
      (!platform || servicePlatform(x) === platform) &&
      (!group || x.platform === group) &&
      (!kind || serviceType(x) === kind),
  );
  const active = items.filter(
    (x) => x.enabled && x.systemEnabled && x.providerEnabled,
  ).length;
  const allVisible =
    visible.length > 0 && visible.every((x) => selected.has(String(x.id)));
  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      visible.forEach((x) =>
        allVisible ? next.delete(String(x.id)) : next.add(String(x.id)),
      );
      return next;
    });
  async function save(service: Service) {
    setMessage("");
    try {
      await api(`/admin/services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          adminEnabled: service.enabled,
          pricingMode: service.pricingMode,
          markupValue: service.markupValue,
          minimumSafeMargin: service.minimumSafeMargin,
        }),
      });
      await load();
      setEditing(null);
      setMessage(`Đã lưu ${service.name}.`);
    } catch (e) {
      setMessage(
        e instanceof ApiError && e.code === "UNSAFE_SELLING_PRICE"
          ? "Giá bán chưa đạt biên an toàn nên không thể bật dịch vụ."
          : errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"),
      );
    }
  }
  async function toggle(service: Service) {
    await save({ ...service, enabled: !service.enabled });
  }
  async function setBulkVisibility(enabled: boolean) {
    const targets = selected.size
      ? items.filter((x) => selected.has(String(x.id)))
      : visible;
    if (!targets.length) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ updated: number }>(
        "/admin/services-status/bulk",
        {
          method: "PATCH",
          body: JSON.stringify({
            ids: targets.map((x) => String(x.id)),
            enabled,
          }),
        },
      );
      await load();
      setMessage(
        `Đã ${enabled ? "bật" : "tắt"} hiển thị ${result.updated} dịch vụ.`,
      );
    } catch (e) {
      setMessage(
        e instanceof ApiError && e.code === "UNSAFE_SELLING_PRICE"
          ? "Có dịch vụ chưa đạt biên an toàn. Hãy cấu hình giá trước khi bật."
          : errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"),
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggleLossProtection() {
    const next = !preventLossSales;
    setBusy(true);
    setMessage("");
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ preventLossSales: next }),
      });
      setPreventLossSales(next);
      setMessage(
        next
          ? "Đã bật Không bán lỗ. Hệ thống sẽ chặn đơn có giá bán thấp hơn giá vốn."
          : "Đã tắt Không bán lỗ.",
      );
    } catch (e) {
      setMessage(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    } finally {
      setBusy(false);
    }
  }
  async function applyBulk() {
    const targets = selected.size
      ? items.filter((x) => selected.has(String(x.id)))
      : items;
    if (!targets.length) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ updated: number; suspended: number }>(
        "/admin/services-pricing/bulk",
        {
          method: "PATCH",
          body: JSON.stringify({
            ids: targets.map((x) => String(x.id)),
            pricingMode: bulkMode,
            markupValue: bulkValue,
            minimumSafeMargin: bulkMargin,
          }),
        },
      );
      await load();
      setMessage(
        `Đã cập nhật ${result.updated} dịch vụ.${result.suspended ? ` ${result.suspended} dịch vụ được tạm dừng để tránh lỗ.` : ""}`,
      );
    } catch (e) {
      setMessage(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page admin-services-page">
      <PageHead
        eyebrow="DANH MỤC"
        title="Dịch vụ & định giá"
        desc={`${active}/${items.length} dịch vụ đang hiển thị cho khách.`}
      >
        <div className="head-actions">
          <button
            className="icon info-button"
            onClick={() => setGuide(true)}
            aria-label="Hướng dẫn"
          >
            <Info />
          </button>
          <button
            className="primary"
            onClick={() => api("/services/sync", { method: "POST" }).then(load)}
          >
            <RefreshCw />
            Đồng bộ giá
          </button>
        </div>
      </PageHead>
      {message && <div className="notice">{message}</div>}
      <section className="auto-price-note">
        <RefreshCw />
        <div>
          <b>Tự động cập nhật giá</b>
          <p>
            Giá tiền sẽ tự động đồng bộ từ site chính, lặp lại sau 10 phút theo
            tỷ lệ bạn thiết lập bên dưới. Tức web Mẹ tăng/giảm giá, web con sẽ
            áp dụng theo. Các thay đổi giá thủ công sẽ bị ghi đè.
          </p>
        </div>
      </section>
      <section className="card bulk-pricing">
        <div>
          <b>Cấu hình bảng giá nhanh</b>
          <small>
            {selected.size
              ? `Áp dụng cho ${selected.size} dịch vụ đã chọn.`
              : `Không có lựa chọn riêng: áp dụng cho toàn bộ ${items.length} dịch vụ.`}
          </small>
        </div>
        <select
          className="compact-input"
          value={bulkMode}
          onChange={(e) =>
            setBulkMode(e.target.value as Service["pricingMode"])
          }
        >
          <option value="PERCENTAGE">Cộng theo %</option>
          <option value="FIXED_MARKUP">Cộng VND cố định</option>
          <option value="FIXED_PRICE">Đặt giá cố định</option>
        </select>
        <label>
          <span>
            {bulkMode === "PERCENTAGE"
              ? "Mức cộng (%)"
              : bulkMode === "FIXED_MARKUP"
                ? "Mức cộng (VND)"
                : "Giá bán (VND)"}
          </span>
          <input
            className="compact-input number"
            type="number"
            min="0"
            value={bulkValue}
            onChange={(e) => setBulkValue(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Biên tối thiểu (%)</span>
          <input
            className="compact-input number"
            type="number"
            min="0"
            value={bulkMargin}
            onChange={(e) => setBulkMargin(Number(e.target.value))}
          />
        </label>
        <button
          className="primary"
          disabled={busy || !items.length}
          onClick={applyBulk}
        >
          {busy
            ? "Đang áp dụng…"
            : selected.size
              ? `Áp dụng ${selected.size} mục`
              : "Áp dụng toàn bộ"}
        </button>
      </section>
      <section className="card no-loss-setting">
        <div>
          <b>Không bán lỗ</b>
          <p>
            Khi bật, nếu giá bán thấp hơn giá gốc thì khách không thể mua và
            được yêu cầu tải lại giá mới. Cài đặt có hiệu lực ngay sau khi lưu,
            tối đa 30 giây.
          </p>
        </div>
        <button
          aria-label="Bật tắt không bán lỗ"
          className={preventLossSales ? "toggle on" : "toggle"}
          disabled={busy}
          onClick={toggleLossProtection}
        >
          <i />
        </button>
      </section>
      <section className="card">
        <div className="service-filters">
          <div className="search field">
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên hoặc mã dịch vụ"
            />
          </div>
          <select
            className="compact-input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">Tất cả nền tảng</option>
            {platforms.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            className="compact-input"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">Tất cả nhóm dịch vụ</option>
            {groups.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            className="compact-input"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Tất cả loại dịch vụ</option>
            {kinds.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button
            className="secondary compact"
            onClick={() => {
              setQuery("");
              setPlatform("");
              setGroup("");
              setKind("");
            }}
          >
            Xóa lọc
          </button>
        </div>
        <div className="selection-bar">
          <label>
            <input
              type="checkbox"
              checked={allVisible}
              onChange={toggleVisible}
            />{" "}
            Chọn tất cả kết quả lọc
          </label>
          <div className="selection-actions">
            <span>
              {selected.size} đã chọn · {visible.length} kết quả
            </span>
            <button
              className="secondary compact"
              disabled={busy || !visible.length}
              onClick={() => setBulkVisibility(true)}
            >
              Bật {selected.size ? "mục đã chọn" : "toàn bộ đang lọc"}
            </button>
            <button
              className="secondary compact"
              disabled={busy || !visible.length}
              onClick={() => setBulkVisibility(false)}
            >
              Tắt {selected.size ? "mục đã chọn" : "toàn bộ đang lọc"}
            </button>
          </div>
        </div>
        <div className="services-list">
          <div className="service-list-head">
            <span>Dịch vụ</span>
            <span>Giá vốn</span>
            <span>Giá bán & cấu hình</span>
            <span>Hiển thị</span>
            <span>Thao tác</span>
          </div>
          {visible.map((service) => (
            <article className="service-row" key={service.id}>
              <div className="service-name-with-check">
                <input
                  type="checkbox"
                  checked={selected.has(String(service.id))}
                  onChange={() => toggleOne(String(service.id))}
                />
                <div className="service-name">
                  <b>{service.name}</b>
                  <small>
                    #{service.id} · {servicePlatform(service)} ·{" "}
                    {service.platform}
                  </small>
                  <small>{serviceType(service)}</small>
                  {(!service.providerEnabled || !service.systemEnabled) && (
                    <small className="danger">
                      {!service.providerEnabled
                        ? "Nguồn đã tắt"
                        : "Tạm dừng an toàn"}
                    </small>
                  )}
                </div>
              </div>
              <div className="price-stack">
                <small>Giá vốn mỗi lượt</small>
                <b>{unitMoney(service.providerRate ?? 0)}</b>
                <small>{money(service.providerRate ?? 0)} / 1.000 lượt</small>
              </div>
              <div className="price-stack">
                <b>{unitMoney(service.price)}</b>
                <small>{money(service.price)} / 1.000 lượt</small>
                <small className="profit">
                  Lãi {unitMoney(service.price - (service.providerRate ?? 0))}
                </small>
                <small>
                  {service.pricingMode === "PERCENTAGE"
                    ? `Cộng ${service.markupValue}%`
                    : service.pricingMode === "FIXED_MARKUP"
                      ? `Cộng ${money(service.markupValue ?? 0)}`
                      : "Giá cố định"}{" "}
                  · Biên ≥ {service.minimumSafeMargin}%
                </small>
              </div>
              <div className="visibility-cell">
                <button
                  aria-label={`Bật tắt ${service.name}`}
                  className={service.enabled ? "toggle on" : "toggle"}
                  onClick={() => toggle(service)}
                >
                  <i />
                </button>
              </div>
              <div className="service-actions">
                <button
                  className="secondary compact"
                  onClick={() => setEditing({ ...service })}
                >
                  Chỉnh sửa
                </button>
              </div>
            </article>
          ))}
          {!visible.length && (
            <div className="empty">Không có dịch vụ phù hợp bộ lọc.</div>
          )}
        </div>
      </section>
      {guide && (
        <div className="modal-backdrop" onClick={() => setGuide(false)}>
          <section
            className="card guide-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setGuide(false)}>
              <X />
            </button>
            <Info className="guide-icon" />
            <h2>Hướng dẫn dịch vụ và định giá</h2>
            <div className="guide-item">
              <b>Giá vốn / 1.000 là gì?</b>
              <p>
                Là số tiền web trả cho site mẹ khi mua 1.000 lượt. Ví dụ 16.450đ
                / 1.000 tương đương 16,45đ mỗi lượt; mua 2.000 lượt có vốn
                32.900đ.
              </p>
            </div>
            <div className="guide-item">
              <b>Nền tảng, nhóm và loại dịch vụ</b>
              <p>
                Các bộ lọc được tách tự động từ danh mục và tên dịch vụ thật của
                site chính.
              </p>
            </div>
            <div className="guide-item">
              <b>Cấu hình nhanh</b>
              <p>
                Tích chọn các dịch vụ cần thay đổi rồi áp dụng. Nếu không tích
                chọn mục nào, cấu hình sẽ áp dụng cho toàn bộ.
              </p>
            </div>
            <div className="guide-item">
              <b>Biên tối thiểu</b>
              <p>
                Khi giá nguồn làm lợi nhuận thấp hơn mức này, dịch vụ tự tạm
                dừng để tránh lỗ.
              </p>
            </div>
            <button className="primary wide" onClick={() => setGuide(false)}>
              Đã hiểu
            </button>
          </section>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <section
            className="card edit-service-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setEditing(null)}>
              <X />
            </button>
            <small className="modal-eyebrow">CHỈNH SỬA DỊCH VỤ</small>
            <h2>{editing.name}</h2>
            <div className="edit-price-summary">
              <span>Giá vốn mỗi lượt</span>
              <b>{unitMoney(editing.providerRate ?? 0)}</b>
              <small>{money(editing.providerRate ?? 0)} / 1.000 lượt</small>
            </div>
            <div className="visibility-setting">
              <div>
                <b>Hiển thị dịch vụ</b>
                <p>
                  Nếu bạn tắt, dịch vụ này sẽ ẩn khỏi web, khách hàng sẽ không
                  thể nhìn thấy và mua.
                </p>
              </div>
              <button
                className={editing.enabled ? "toggle on" : "toggle"}
                onClick={() =>
                  setEditing({ ...editing, enabled: !editing.enabled })
                }
              >
                <i />
              </button>
            </div>
            <label>Cách tính giá bán</label>
            <select
              className="input"
              value={editing.pricingMode}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  pricingMode: e.target.value as Service["pricingMode"],
                })
              }
            >
              <option value="PERCENTAGE">Cộng theo phần trăm</option>
              <option value="FIXED_MARKUP">Cộng VND cố định</option>
              <option value="FIXED_PRICE">Đặt giá cố định</option>
            </select>
            <label>
              {editing.pricingMode === "PERCENTAGE"
                ? "Mức cộng (%)"
                : editing.pricingMode === "FIXED_MARKUP"
                  ? "Mức cộng (VND / 1.000)"
                  : "Giá bán (VND / 1.000)"}
            </label>
            <input
              className="input"
              type="number"
              min="0"
              value={editing.markupValue}
              onChange={(e) =>
                setEditing({ ...editing, markupValue: Number(e.target.value) })
              }
            />
            <label>Biên lợi nhuận tối thiểu (%)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={editing.minimumSafeMargin}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  minimumSafeMargin: Number(e.target.value),
                })
              }
            />
            <button className="primary wide" onClick={() => save(editing)}>
              Lưu thay đổi
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function AdminOrders() {
  const [items, setItems] = useState<RealOrder[]>([]);
  useEffect(() => {
    api<RealOrder[]>("/admin/orders").then(setItems);
  }, []);
  const attention = items.filter((x) =>
    ["SUBMISSION_UNKNOWN", "PRICE_CONFLICT", "MANUAL_REVIEW"].includes(
      x.status,
    ),
  ).length;
  return (
    <div className="page">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Quản lý đơn hàng"
        desc="Đơn không xác định không được tự động gửi lại."
      />
      <section className="card">
        {attention > 0 && (
          <div className="alert">
            <ShieldCheck />
            {attention} đơn cần đối soát thủ công để tránh tạo trùng.
          </div>
        )}
        <RealOrderTable items={items} admin />
      </section>
    </div>
  );
}
function AdminOrdersManager() {
  const [items, setItems] = useState<RealOrder[]>([]);
  const [providerIds, setProviderIds] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const load = () => api<RealOrder[]>("/admin/orders").then(setItems);
  useEffect(() => {
    load();
  }, []);
  async function act(
    order: RealOrder,
    action: "RETRY" | "CANCEL_RELEASE" | "CONFIRM_SUBMITTED",
  ) {
    setMessage("");
    try {
      await api(`/admin/orders/${order.id}/action`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          providerOrderId: providerIds[order.id],
        }),
      });
      await load();
      setMessage(`Đã xử lý đơn ${order.publicId}.`);
    } catch (e) {
      setMessage(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    }
  }
  const attention = items.filter((x) =>
    ["SUBMISSION_UNKNOWN", "PRICE_CONFLICT", "MANUAL_REVIEW"].includes(
      x.status,
    ),
  ).length;
  return (
    <div className="page">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Quản lý đơn hàng"
        desc="Đối soát trước khi thao tác để tránh gửi trùng hoặc hoàn nhầm."
      />
      <section className="card">
        {attention > 0 && (
          <div className="alert">
            <ShieldCheck />
            {attention} đơn cần đối soát thủ công.
          </div>
        )}
        {message && <div className="notice">{message}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Dịch vụ</th>
                <th>Trạng thái</th>
                <th>Giá trị</th>
                <th>Xử lý</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => {
                const retry = [
                  "WAITING_PROVIDER_BALANCE",
                  "WAITING_PROVIDER_SYNC",
                  "PRICE_CONFLICT",
                ].includes(o.status);
                const cancel =
                  !o.providerOrderId &&
                  [
                    "FUNDS_RESERVED",
                    "QUEUED",
                    "WAITING_PROVIDER_BALANCE",
                    "WAITING_PROVIDER_SYNC",
                    "PRICE_CONFLICT",
                  ].includes(o.status);
                return (
                  <tr key={o.id}>
                    <td>
                      <b>{o.publicId}</b>
                      <small className="block">
                        Nguồn: {o.providerOrderId ?? "—"}
                      </small>
                    </td>
                    <td>{o.user?.email ?? "—"}</td>
                    <td>{o.service.displayName}</td>
                    <td>
                      <span className="status">
                        <i />
                        {statusLabel[o.status] ?? o.status}
                      </span>
                    </td>
                    <td>{money(Number(o.chargeAmount))}</td>
                    <td>
                      {o.status === "SUBMISSION_UNKNOWN" ? (
                        <div className="reconcile">
                          <input
                            className="compact-input"
                            placeholder="Mã đơn nguồn"
                            value={providerIds[o.id] ?? ""}
                            onChange={(e) =>
                              setProviderIds((x) => ({
                                ...x,
                                [o.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            className="secondary compact"
                            disabled={!providerIds[o.id]}
                            onClick={() => act(o, "CONFIRM_SUBMITTED")}
                          >
                            Xác nhận
                          </button>
                        </div>
                      ) : (
                        <div className="service-actions">
                          {retry && (
                            <button
                              className="secondary compact"
                              onClick={() => act(o, "RETRY")}
                            >
                              Thử lại
                            </button>
                          )}
                          {cancel && (
                            <button
                              className="secondary compact danger-button"
                              onClick={() => act(o, "CANCEL_RELEASE")}
                            >
                              Hủy & trả giữ
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length && <div className="empty">Chưa có đơn hàng.</div>}
        </div>
      </section>
    </div>
  );
}
type SystemData = {
  database: { status: string; users: number; services: number; orders: number };
  provider: {
    configured: boolean;
    state: null | { status: string; lastCheckedAt: string | null };
  };
  payments: { sepayConfigured: boolean; binanceConfigured: boolean };
  outboxPending: number;
};
function SystemHealth() {
  const [data, setData] = useState<SystemData | null>(null);
  useEffect(() => {
    api<SystemData>("/admin/system").then(setData);
  }, []);
  const rows = data
    ? [
        [
          "PostgreSQL",
          data.database.status,
          `${data.database.users} users · ${data.database.orders} orders`,
        ],
        ["Outbox", "ACTIVE", `${data.outboxPending} sự kiện chờ`],
        [
          "API nhà cung cấp",
          data.provider.configured
            ? (data.provider.state?.status ?? "Đã cấu hình")
            : "Chưa cấu hình",
          data.provider.state?.lastCheckedAt
            ? new Date(data.provider.state.lastCheckedAt).toLocaleString(
                "vi-VN",
              )
            : "—",
        ],
        [
          "SePay",
          data.payments.sepayConfigured ? "Đã cấu hình" : "Chưa cấu hình",
          "—",
        ],
        [
          "Binance",
          data.payments.binanceConfigured ? "Đã cấu hình" : "Chưa cấu hình",
          "—",
        ],
      ]
    : [];
  return (
    <div className="page">
      <PageHead
        eyebrow="GIÁM SÁT"
        title="Tình trạng hệ thống"
        desc="Dữ liệu cấu hình và vận hành thực tế."
      />
      <div className="health-grid">
        {rows.map((x) => (
          <article className="card health" key={x[0]}>
            <div
              className={
                x[1] === "Chưa cấu hình" ? "health-icon pending" : "health-icon"
              }
            >
              {x[1] === "Chưa cấu hình" ? "!" : "✓"}
            </div>
            <div>
              <h3>{x[0]}</h3>
              <span>{x[1]}</span>
            </div>
            <b>{x[2]}</b>
          </article>
        ))}
      </div>
    </div>
  );
}
type AdminSettings = {
  supportTelegram: string;
  supportFanpage: string;
  usdtRate: number | null;
  providerRateMultiplier: number;
  defaultMarkupPercent: number;
  minimumSafeMarginPercent: number;
  providerLowBalanceThreshold: number;
  bankingEnabled: boolean;
  usdtTrc20Enabled: boolean;
  usdtBep20Enabled: boolean;
  readiness: { bankingCredentials: boolean; usdtCredentials: boolean };
};
function SettingsPage() {
  const [data, setData] = useState<AdminSettings | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<AdminSettings>("/admin/settings").then(setData);
  }, []);
  const set = <K extends keyof AdminSettings>(
    key: K,
    value: AdminSettings[K],
  ) => setData((x) => (x ? { ...x, [key]: value } : x));
  async function save() {
    if (!data) return;
    setBusy(true);
    setMessage("");
    try {
      const { readiness, ...payload } = data;
      void readiness;
      setData(
        await api<AdminSettings>("/admin/settings", {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
      );
      setMessage("Đã lưu cấu hình.");
    } catch (e) {
      setMessage(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="page">
        <PageHead
          eyebrow="CẤU HÌNH"
          title="Thiết lập hệ thống"
          desc="Đang tải cấu hình…"
        />
      </div>
    );
  return (
    <div className="page">
      <PageHead
        eyebrow="CẤU HÌNH"
        title="Thiết lập hệ thống"
        desc="Thông tin bí mật chỉ được đọc từ biến môi trường máy chủ."
      >
        <button className="primary" disabled={busy} onClick={save}>
          {busy ? "Đang lưu…" : "Lưu cấu hình"}
        </button>
      </PageHead>
      {message && <div className="notice">{message}</div>}
      <div className="settings-form">
        <section className="card form-card">
          <h2>Liên hệ khách hàng</h2>
          <label>Liên kết Telegram</label>
          <input
            className="input"
            value={data.supportTelegram}
            onChange={(e) => set("supportTelegram", e.target.value)}
            placeholder="https://t.me/..."
          />
          <label>Liên kết Fanpage</label>
          <input
            className="input"
            value={data.supportFanpage}
            onChange={(e) => set("supportFanpage", e.target.value)}
            placeholder="https://facebook.com/..."
          />
        </section>
        <section className="card form-card">
          <h2>Giá và cảnh báo</h2>
          <label>Tỷ giá USDT nạp tiền (VND)</label>
          <input
            className="input"
            type="number"
            min="1"
            value={data.usdtRate ?? ""}
            onChange={(e) => set("usdtRate", Number(e.target.value))}
          />
          <label>Tỷ giá quy đổi giá site mẹ (VND)</label>
          <input
            className="input"
            type="number"
            min="1"
            value={data.providerRateMultiplier}
            onChange={(e) =>
              set("providerRateMultiplier", Number(e.target.value))
            }
          />
          <small>
            SUBVIETNAM hiện công bố tỷ giá 25.000. Giá vốn / 1.000 = rate API ×
            tỷ giá này.
          </small>
          <label>Markup mặc định (%)</label>
          <input
            className="input"
            type="number"
            min="0"
            value={data.defaultMarkupPercent}
            onChange={(e) =>
              set("defaultMarkupPercent", Number(e.target.value))
            }
          />
          <label>Biên an toàn tối thiểu (%)</label>
          <input
            className="input"
            type="number"
            min="0"
            value={data.minimumSafeMarginPercent}
            onChange={(e) =>
              set("minimumSafeMarginPercent", Number(e.target.value))
            }
          />
          <label>Cảnh báo số dư nguồn (VND)</label>
          <input
            className="input"
            type="number"
            min="0"
            value={data.providerLowBalanceThreshold}
            onChange={(e) =>
              set("providerLowBalanceThreshold", Number(e.target.value))
            }
          />
        </section>
        <section className="card form-card">
          <h2>Phương thức nạp</h2>
          <SettingToggle
            label="Banking"
            detail={
              data.readiness.bankingCredentials
                ? "Đã có credential"
                : "Chưa có credential trong môi trường"
            }
            value={data.bankingEnabled}
            onChange={(v) => set("bankingEnabled", v)}
          />
          <SettingToggle
            label="USDT · TRC20"
            detail={
              data.readiness.usdtCredentials
                ? "Đã có credential"
                : "Chưa có credential trong môi trường"
            }
            value={data.usdtTrc20Enabled}
            onChange={(v) => set("usdtTrc20Enabled", v)}
          />
          <SettingToggle
            label="USDT · BEP20"
            detail={
              data.readiness.usdtCredentials
                ? "Đã có credential"
                : "Chưa có credential trong môi trường"
            }
            value={data.usdtBep20Enabled}
            onChange={(v) => set("usdtBep20Enabled", v)}
          />
        </section>
      </div>
    </div>
  );
}
function SettingToggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <span>
        <b>{label}</b>
        <small>{detail}</small>
      </span>
      <button
        aria-label={`Bật tắt ${label}`}
        className={value ? "toggle on" : "toggle"}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  );
}
type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
  wallet: null | { balance: string; reserved: string };
};
function AdminUsers() {
  const [items, setItems] = useState<AdminUser[]>([]);
  useEffect(() => {
    api<AdminUser[]>("/admin/users").then(setItems);
  }, []);
  return (
    <div className="page">
      <PageHead
        eyebrow="THÀNH VIÊN"
        title="Tài khoản người dùng"
        desc="Danh sách trực tiếp từ database."
      />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Số dư</th>
                <th>Đang giữ</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.displayName}</b>
                    <small className="block">{u.email}</small>
                  </td>
                  <td>{u.role}</td>
                  <td>
                    <span
                      className={
                        "status " +
                        (u.status === "ACTIVE" ? "success" : "warning")
                      }
                    >
                      <i />
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <b>{money(Number(u.wallet?.balance ?? 0))}</b>
                  </td>
                  <td>{money(Number(u.wallet?.reserved ?? 0))}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <div className="empty">Chưa có thành viên.</div>}
        </div>
      </section>
    </div>
  );
}
function AdminUsersManager() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const load = () => api<AdminUser[]>("/admin/users").then(setItems);
  useEffect(() => {
    load();
  }, []);
  async function update(id: string, body: object) {
    setMessage("");
    try {
      await api(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
      setMessage("Đã cập nhật tài khoản.");
    } catch (e) {
      setMessage(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    }
  }
  async function adjust(u: AdminUser) {
    const amount = Number(adjustments[u.id]);
    if (!amount) return;
    const reason = amount > 0 ? "Admin cộng số dư" : "Admin trừ số dư";
    setMessage("");
    try {
      await api(`/admin/users/${u.id}/wallet`, {
        method: "PATCH",
        body: JSON.stringify({ amount, reason }),
      });
      setAdjustments((x) => ({ ...x, [u.id]: "" }));
      await load();
      setMessage("Đã điều chỉnh số dư và ghi sổ giao dịch.");
    } catch (e) {
      setMessage(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    }
  }
  return (
    <div className="page">
      <PageHead
        eyebrow="THÀNH VIÊN"
        title="Tài khoản người dùng"
        desc="Thay đổi đều được ghi nhật ký quản trị."
      />
      {message && <div className="notice">{message}</div>}
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Số dư</th>
                <th>Đang giữ</th>
                <th>Điều chỉnh số dư</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.displayName}</b>
                    <small className="block">{u.email}</small>
                  </td>
                  <td>
                    <select
                      className="compact-input"
                      value={u.role}
                      onChange={(e) => update(u.id, { role: e.target.value })}
                    >
                      <option value="CUSTOMER">Khách hàng</option>
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="compact-input"
                      value={u.status}
                      onChange={(e) => update(u.id, { status: e.target.value })}
                    >
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="SUSPENDED">Tạm khóa</option>
                      <option value="PENDING">Chờ duyệt</option>
                    </select>
                  </td>
                  <td>
                    <b>{money(Number(u.wallet?.balance ?? 0))}</b>
                  </td>
                  <td>{money(Number(u.wallet?.reserved ?? 0))}</td>
                  <td>
                    <div className="reconcile">
                      <input
                        className="compact-input number"
                        type="number"
                        placeholder="± VND"
                        value={adjustments[u.id] ?? ""}
                        onChange={(e) =>
                          setAdjustments((x) => ({
                            ...x,
                            [u.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="secondary compact"
                        onClick={() => adjust(u)}
                      >
                        Ghi sổ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <div className="empty">Chưa có thành viên.</div>}
        </div>
      </section>
    </div>
  );
}
type AdminDeposit = {
  id: string;
  publicId: string;
  method: string;
  status: string;
  requestedVnd: string;
  creditedVnd: string | null;
  createdAt: string;
  user: { email: string; displayName: string };
  paymentTransactions: Array<{ id: string }>;
};
function AdminPayments() {
  const [items, setItems] = useState<AdminDeposit[]>([]);
  const [unmatched, setUnmatched] = useState<Array<{id:string;externalId:string;network:string|null;txHash:string|null;amount:string;receivedAt:string}>>([]);
  const [paymentError, setPaymentError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => Promise.all([api<AdminDeposit[]>("/admin/payments"), api<typeof unmatched>("/admin/payments/unmatched")]).then(([deposits, transfers]) => { if(active) { setItems(deposits); setUnmatched(transfers); setPaymentError(""); } }).catch(() => { if(active) setPaymentError("Chưa thể tải dữ liệu đối soát. Vui lòng thử lại."); });
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return (
    <div className="page">
      <PageHead
        eyebrow="THANH TOÁN"
        title="Nạp tiền & đối soát"
        desc="Dữ liệu yêu cầu nạp và giao dịch thực tế."
      />
      {paymentError && <div className="form-error" role="alert">{paymentError}</div>}
      {unmatched.length > 0 && <section className="card" style={{marginBottom:16}}><h2>USDT cần kiểm tra thủ công ({unmatched.length})</h2><p>Giao dịch chưa ghép được duy nhất với một yêu cầu nạp. Chưa cộng tiền vào ví khách hàng; cần xác minh trước khi xử lý.</p><div className="table-wrap"><table><thead><tr><th>ID Binance</th><th>Mạng</th><th>Số USDT</th><th>TxID</th><th>Thời gian nhận</th></tr></thead><tbody>{unmatched.map(transfer => <tr key={transfer.id}><td>{transfer.externalId}</td><td>{transfer.network}</td><td>{transfer.amount}</td><td style={{overflowWrap:"anywhere",maxWidth:300}}>{transfer.txHash}</td><td>{new Date(transfer.receivedAt).toLocaleString("vi-VN")}</td></tr>)}</tbody></table></div></section>}
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã yêu cầu</th>
                <th>Khách hàng</th>
                <th>Phương thức</th>
                <th>Trạng thái</th>
                <th>Yêu cầu</th>
                <th>Đã cộng</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <b>{d.publicId}</b>
                  </td>
                  <td>{d.user.email}</td>
                  <td>{d.method}</td>
                  <td>{d.status}</td>
                  <td>{money(Number(d.requestedVnd))}</td>
                  <td>{d.creditedVnd ? money(Number(d.creditedVnd)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <div className="empty">Chưa có giao dịch nạp tiền.</div>
          )}
        </div>
      </section>
    </div>
  );
}
function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const refresh = () => api<SessionUser>("/auth/me").then(setUser).catch(() => {});
    window.addEventListener("profile-updated", refresh);
    return () => window.removeEventListener("profile-updated", refresh);
  }, []);
  useEffect(() => {
    api<SessionUser>("/auth/me")
      .then(setUser)
      .catch(() =>
        api<{ user: SessionUser }>("/auth/refresh", { method: "POST" })
          .then((x) => setUser(x.user))
          .catch(() => null),
      )
      .finally(() => setLoading(false));
  }, []);
  function loggedIn(u: SessionUser) {
    setUser(u);
    navigate(
      u.role === "ADMIN" || u.role === "SUPER_ADMIN" ? "/admin" : "/dashboard",
      { replace: true },
    );
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => null);
    setUser(null);
    navigate("/", { replace: true });
  }
  if (location.pathname === '/') return <LandingPage />;
  if (loading)
    return (
      <div className="app-loading">
        <Logo />
        <span>Đang khởi động…</span>
      </div>
    );
  if (!user) return <AuthPages key={location.pathname} onLogin={loggedIn} />;
  if(user.passwordChangeRequired)return <RequiredPasswordChange onLogout={logout} onDone={()=>{setUser(null);navigate('/login',{replace:true,state:{passwordChanged:true}});}}/>;
  const admin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (location.pathname === "/")
    return <Navigate to={admin ? "/admin" : "/dashboard"} replace />;
  return (
    <Routes>
      <Route
        path="/login"
        element={<Navigate to={admin ? "/admin" : "/dashboard"} />}
      />
      <Route
        path="/admin/*"
        element={
          admin ? (
            <Shell admin user={user} onLogout={logout} />
          ) : (
            <Navigate to="/dashboard" />
          )
        }
      />
      <Route path="/*" element={<Shell user={user} onLogout={logout} />} />
    </Routes>
  );
}
export default App;
