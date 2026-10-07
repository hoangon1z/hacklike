import { ConfigService } from '@nestjs/config';

export type SepayBankAccount = {
  id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  virtualAccountNumber?: string;
  depositsEnabled?: boolean;
};

export function sepayAccounts(config: Pick<ConfigService, 'get'>): SepayBankAccount[] {
  const raw = config.get<string>('SEPAY_BANK_ACCOUNTS');
  if (raw) {
    try {
      const rows: unknown = JSON.parse(raw);
      if (!Array.isArray(rows) || !rows.length) return [];
      if (!rows.every(row => row && ['id','bankName','bankCode','accountNumber','accountName'].every(key => typeof row[key] === 'string' && row[key].trim()))) return [];
      if (!rows.every(row => row.virtualAccountNumber === undefined || (typeof row.virtualAccountNumber === 'string' && /^[A-Za-z0-9]+$/.test(row.virtualAccountNumber)))) return [];
      if (!rows.every(row => row.depositsEnabled === undefined || typeof row.depositsEnabled === 'boolean')) return [];
      const accounts = rows as SepayBankAccount[];
      if (new Set(accounts.map(row => row.id)).size !== accounts.length) return [];
      return accounts;
    } catch { return []; }
  }
  const bankName = config.get<string>('SEPAY_BANK_NAME');
  const accountNumber = config.get<string>('SEPAY_ACCOUNT_NUMBER');
  const accountName = config.get<string>('SEPAY_ACCOUNT_NAME');
  return bankName && accountNumber && accountName
    ? [{ id: 'legacy', bankName, bankCode: config.get<string>('SEPAY_BANK_CODE') || bankName, accountNumber, accountName }]
    : [];
}

export function sepayDepositAccounts(config: Pick<ConfigService, 'get'>) {
  return sepayAccounts(config).filter(account => account.depositsEnabled !== false);
}

export function sepayConfigured(config: Pick<ConfigService, 'get'>) {
  return Boolean(config.get('SEPAY_API_TOKEN') && config.get('SEPAY_WEBHOOK_SECRET') && sepayDepositAccounts(config).length);
}

export function matchesSepayBank(account: SepayBankAccount, accountNumber: unknown, gateway: unknown, subAccount?: unknown) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return String(accountNumber ?? '') === account.accountNumber &&
    (!account.virtualAccountNumber || String(subAccount ?? '') === account.virtualAccountNumber) && typeof gateway === 'string' &&
    [account.bankName, account.bankCode].some(name => normalize(name) === normalize(gateway));
}
