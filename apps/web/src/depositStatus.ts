export type DepositStatusRecord = {
  publicId: string;
  status: string;
  requestedVnd: string;
  creditedVnd: string | null;
};
export function depositSucceeded(request: DepositStatusRecord) {
  const credited = Number(request.creditedVnd), requested = Number(request.requestedVnd);
  return ['COMPLETED', 'OVERPAID'].includes(request.status) &&
    Number.isFinite(credited) && Number.isFinite(requested) && requested > 0 && credited >= requested;
}
export function depositNotice(request: DepositStatusRecord) {
  if (depositSucceeded(request)) return {kind:'success' as const,title:'Nạp tiền thành công'};
  if (['REJECTED','FAILED'].includes(request.status)) return {kind:'error' as const,title:'Nạp tiền không thành công'};
  if (['CANCELED','CANCELLED'].includes(request.status)) return {kind:'info' as const,title:'Giao dịch đã bị hủy'};
  return null;
}
export function depositStatusText(status: string) {
  return ({CREATED:'Đang xử lý...',WAITING:'Đang chờ thanh toán',CONFIRMING:'Đang xử lý...',COMPLETED:'Nạp tiền thành công',OVERPAID:'Đã cộng tiền · cần đối soát phần dư',UNDERPAID:'Đã nhận một phần · chưa đủ số tiền',EXPIRED:'Mã thanh toán đã hết hạn',MANUAL_REVIEW:'Giao dịch cần đối soát',UNMATCHED:'Giao dịch cần đối soát',REJECTED:'Nạp tiền không thành công',FAILED:'Nạp tiền không thành công',CANCELED:'Giao dịch đã bị hủy',CANCELLED:'Giao dịch đã bị hủy'} as Record<string,string>)[status] ?? 'Đang kiểm tra giao dịch';
}
