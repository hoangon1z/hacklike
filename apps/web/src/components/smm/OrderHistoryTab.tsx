import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
  Inbox,
  AlertCircle,
  Check,
  PlusCircle,
} from "lucide-react";
import { api, ApiError } from "../../api";
import { formatVND } from "../../utils/formatVND";

export interface OrderRecord {
  id: string;
  publicId: string;
  link: string;
  quantity: number;
  comments: string | null;
  chargeAmount: string | number;
  status: string;
  publicMessage?: string | null;
  remains?: number | null;
  startCount?: number | null;
  createdAt: string;
  updatedAt?: string;
  service: {
    displayName: string;
    providerServiceId?: string;
    providerName?: string;
    category?: { name: string };
  };
}

interface OrderHistoryTabProps {
  activeGroup?: string;
  onNewOrderClick?: () => void;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Trạng thái: Tất cả" },
  { value: "COMPLETED", label: "Đã hoàn thành" },
  { value: "IN_PROGRESS", label: "Đang chạy" },
  { value: "SUBMITTED", label: "Đã gửi đơn" },
  { value: "QUEUED", label: "Đang xử lý" },
  { value: "SCHEDULED", label: "Đã lên lịch" },
  { value: "PARTIAL", label: "Hoàn thành một phần" },
  { value: "CANCELED", label: "Đã hủy" },
  { value: "REFUNDED", label: "Đã hoàn tiền" },
  { value: "MANUAL_REVIEW", label: "Đang kiểm tra" },
];

export function OrderHistoryTab({ activeGroup, onNewOrderClick }: OrderHistoryTabProps) {
  const [items, setItems] = useState<OrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when status or pageSize changes
  useEffect(() => {
    setPage(1);
  }, [status, pageSize, activeGroup]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeGroup) params.set("group", activeGroup);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status && status !== "ALL") params.set("status", status);
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      const res = await api<{
        items: OrderRecord[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/orders?${params.toString()}`);

      if (res && Array.isArray((res as any).items)) {
        setItems((res as any).items);
        setTotal((res as any).total ?? (res as any).items.length);
      } else if (Array.isArray(res)) {
        // Fallback if returned plain array
        const all = res as unknown as OrderRecord[];
        setItems(all.slice((page - 1) * pageSize, page * pageSize));
        setTotal(all.length);
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (e) {
      console.error("Failed to load orders:", e);
      setError("Không thể tải lịch sử đơn hàng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeGroup, debouncedSearch, status, page, pageSize]);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => showToast("Đã sao chép"),
      () => showToast("Không thể sao chép")
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return { time: "—", date: "—" };
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return {
        time: `${hours}:${minutes}:${seconds}`,
        date: `${day}/${month}/${year}`,
      };
    } catch {
      return { time: "—", date: "—" };
    }
  };

  const renderStatusBadge = (orderStatus: string) => {
    switch (orderStatus) {
      case "COMPLETED":
        return <span className="smm-hist-badge badge-completed">Đã xong</span>;
      case "IN_PROGRESS":
        return <span className="smm-hist-badge badge-running">Đang chạy</span>;
      case "SUBMITTED":
      case "SUBMITTING":
        return <span className="smm-hist-badge badge-processing">Đã gửi đơn</span>;
      case "QUEUED":
      case "FUNDS_RESERVED":
      case "CREATED":
        return <span className="smm-hist-badge badge-processing">Đang xử lý</span>;
      case "SCHEDULED":
        return <span className="smm-hist-badge badge-scheduled">Đã hẹn giờ</span>;
      case "PARTIAL":
        return <span className="smm-hist-badge badge-partial">Hoàn 1 phần</span>;
      case "CANCELED":
        return <span className="smm-hist-badge badge-canceled">Đã hủy</span>;
      case "REFUNDED":
        return <span className="smm-hist-badge badge-refunded">Đã hoàn tiền</span>;
      case "MANUAL_REVIEW":
      case "PRICE_CONFLICT":
      case "WAITING_PROVIDER_BALANCE":
      case "WAITING_PROVIDER_SYNC":
        return <span className="smm-hist-badge badge-error">Kiểm tra</span>;
      default:
        return <span className="smm-hist-badge badge-processing">{orderStatus}</span>;
    }
  };

  const renderProgress = (order: OrderRecord) => {
    const qty = order.quantity || 1;
    let completed = 0;

    if (order.status === "COMPLETED") {
      completed = qty;
    } else if (order.remains !== null && order.remains !== undefined) {
      completed = Math.max(0, qty - order.remains);
    } else if (["CANCELED", "REFUNDED"].includes(order.status)) {
      completed = 0;
    } else {
      // In progress or queued without remains yet
      completed = 0;
    }

    const pct = Math.min(100, Math.max(0, Math.round((completed / qty) * 100)));

    return (
      <div className="smm-hist-progress-col">
        <div className="smm-hist-progress-info">
          <span className="smm-hist-progress-counts">
            {completed.toLocaleString("vi-VN")} / {qty.toLocaleString("vi-VN")}
          </span>
          <span className="smm-hist-progress-pct">{pct}%</span>
        </div>
        <div className="smm-hist-progress-bar">
          <div
            className="smm-hist-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="smm-history-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="smm-hist-toast" role="status">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="smm-hist-toolbar">
        <div className="smm-hist-search-box">
          <Search size={16} className="smm-hist-search-icon" />
          <input
            type="text"
            className="smm-hist-search-input"
            placeholder="Tìm theo mã đơn, UID, nội dung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="smm-hist-filter-controls">
          <div className="smm-hist-select-wrap">
            <span className="smm-hist-label-inline">Lọc theo</span>
            <select
              className="smm-hist-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="smm-hist-select-wrap">
            <span className="smm-hist-label-inline">Xem</span>
            <select
              className="smm-hist-select smm-hist-select-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="smm-hist-label-inline">mục</span>
          </div>

          <button
            type="button"
            className="smm-hist-reload-btn"
            title="Làm mới dữ liệu"
            onClick={fetchOrders}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="smm-hist-error-box">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button type="button" className="smm-hist-retry-btn" onClick={fetchOrders}>
            <RefreshCw size={14} />
            Thử lại
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="smm-hist-table-wrapper">
        <table className="smm-hist-table">
          <thead>
            <tr>
              <th style={{ width: "135px" }}>MÃ ĐƠN</th>
              <th style={{ width: "110px", textAlign: "center" }}>TRẠNG THÁI</th>
              <th style={{ width: "160px" }}>UID / ĐƯỜNG DẪN</th>
              <th style={{ width: "170px" }}>SERVER</th>
              <th style={{ width: "150px" }}>NỘI DUNG</th>
              <th style={{ width: "70px", textAlign: "center" }}>BẮT ĐẦU</th>
              <th style={{ width: "130px" }}>TIẾN ĐỘ</th>
              <th style={{ width: "100px", textAlign: "right" }}>SỐ TIỀN</th>
              <th style={{ width: "105px", textAlign: "center" }}>THỜI GIAN</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // 8 Skeleton rows
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="smm-hist-row smm-hist-skeleton-row">
                  <td><div className="smm-skeleton-box" style={{ width: "70%" }} /></td>
                  <td style={{ textAlign: "center" }}><div className="smm-skeleton-box" style={{ width: "65px", margin: "0 auto", height: "24px", borderRadius: "12px" }} /></td>
                  <td><div className="smm-skeleton-box" style={{ width: "85%" }} /></td>
                  <td><div className="smm-skeleton-box" style={{ width: "60%" }} /></td>
                  <td><div className="smm-skeleton-box" style={{ width: "90%" }} /></td>
                  <td style={{ textAlign: "center" }}><div className="smm-skeleton-box" style={{ width: "32px", margin: "0 auto", height: "24px", borderRadius: "6px" }} /></td>
                  <td>
                    <div className="smm-skeleton-box" style={{ width: "100%", height: "14px", marginBottom: "4px" }} />
                    <div className="smm-skeleton-box" style={{ width: "100%", height: "5px" }} />
                  </td>
                  <td style={{ textAlign: "right" }}><div className="smm-skeleton-box" style={{ width: "60px", marginLeft: "auto" }} /></td>
                  <td style={{ textAlign: "center" }}><div className="smm-skeleton-box" style={{ width: "75px", margin: "0 auto", height: "34px", borderRadius: "6px" }} /></td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="smm-hist-empty">
                    <div className="smm-hist-empty-icon">
                      <Inbox size={40} />
                    </div>
                    <div className="smm-hist-empty-title">Chưa có đơn hàng</div>
                    <p className="smm-hist-empty-desc">
                      {debouncedSearch || status !== "ALL"
                        ? "Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại."
                        : "Bạn chưa có đơn hàng nào trong dịch vụ này."}
                    </p>
                    {onNewOrderClick && (
                      <button
                        type="button"
                        className="smm-hist-new-order-btn"
                        onClick={onNewOrderClick}
                      >
                        <PlusCircle size={16} />
                        Tạo đơn mới
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((order) => {
                const ts = formatTimestamp(order.createdAt);
                const isUrl = order.link && (order.link.startsWith("http://") || order.link.startsWith("https://"));

                return (
                  <tr key={order.id} className="smm-hist-row">
                    {/* STT / MÃ ĐƠN */}
                    <td className="smm-hist-id-cell">
                      <span className="smm-hist-order-id" title={order.publicId}>
                        {order.publicId}
                      </span>
                    </td>

                    {/* TRẠNG THÁI */}
                    <td style={{ textAlign: "center" }}>
                      {renderStatusBadge(order.status)}
                    </td>

                    {/* UID / ĐƯỜNG DẪN */}
                    <td className="smm-hist-target-cell">
                      <div className="smm-hist-target-wrap">
                        {isUrl ? (
                          <a
                            href={order.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="smm-hist-target-link"
                            title={order.link}
                          >
                            {order.link}
                          </a>
                        ) : (
                          <span className="smm-hist-target-text" title={order.link}>
                            {order.link}
                          </span>
                        )}
                        <button
                          type="button"
                          className="smm-hist-copy-btn"
                          title="Sao chép đường dẫn / UID"
                          onClick={() => copyToClipboard(order.link)}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>

                    {/* SERVER / DỊCH VỤ */}
                    <td className="smm-hist-server-cell">
                      <span className="smm-hist-server-name" title={order.service.displayName}>
                        {order.service.displayName}
                      </span>
                    </td>

                    {/* NỘI DUNG */}
                    <td className="smm-hist-content-cell">
                      {order.comments ? (
                        <div className="smm-hist-content-preview" title={order.comments}>
                          {order.comments}
                        </div>
                      ) : (
                        <span className="smm-hist-muted">—</span>
                      )}
                    </td>

                    {/* BẮT ĐẦU */}
                    <td style={{ textAlign: "center" }}>
                      {order.startCount !== null && order.startCount !== undefined ? (
                        <span className="smm-hist-start-badge">
                          {order.startCount}
                        </span>
                      ) : (
                        <span className="smm-hist-muted">—</span>
                      )}
                    </td>

                    {/* TIẾN ĐỘ */}
                    <td>
                      {renderProgress(order)}
                    </td>

                    {/* SỐ TIỀN */}
                    <td style={{ textAlign: "right" }} className="smm-hist-amount-cell">
                      <span className="smm-hist-amount">
                        {formatVND(Number(order.chargeAmount))}
                      </span>
                    </td>

                    {/* THỜI GIAN */}
                    <td style={{ textAlign: "center" }}>
                      <div className="smm-hist-time-pill" title={`${ts.time} ${ts.date}`}>
                        <span className="smm-hist-time-hour">{ts.time}</span>
                        <span className="smm-hist-time-date">{ts.date}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && total > 0 && (
        <div className="smm-hist-pagination-bar">
          <div className="smm-hist-pagination-info">
            Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total.toLocaleString("vi-VN")} đơn
          </div>

          <div className="smm-hist-pagination-controls">
            <button
              type="button"
              className="smm-hist-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Smart page numbers */}
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              if (
                pNum === 1 ||
                pNum === totalPages ||
                (pNum >= page - 1 && pNum <= page + 1)
              ) {
                return (
                  <button
                    key={`page-${pNum}`}
                    type="button"
                    className={`smm-hist-page-btn ${page === pNum ? "active" : ""}`}
                    onClick={() => setPage(pNum)}
                  >
                    {pNum}
                  </button>
                );
              }
              if (
                (pNum === 2 && page > 3) ||
                (pNum === totalPages - 1 && page < totalPages - 2)
              ) {
                return (
                  <span key={`ellipsis-${pNum}`} className="smm-hist-page-ellipsis">
                    …
                  </span>
                );
              }
              return null;
            })}

            <button
              type="button"
              className="smm-hist-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
