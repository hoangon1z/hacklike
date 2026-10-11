const url = new URL(process.argv[2]);
const local = url.hostname === '127.0.0.1' && url.protocol === 'http:';
if ((!local && url.protocol !== 'https:') || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash) {
  throw new Error('Nhập origin HTTPS của Tunnel hoặc http://127.0.0.1:8787.');
}
if (!process.env.RELAY_TOKEN) throw new Error('Thiếu RELAY_TOKEN.');
try {
  const response = await fetch(new URL('/balance', url), {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RELAY_TOKEN}` },
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  // Do not print the balance, token, API key or arbitrary upstream content.
  console.log(JSON.stringify({
    http: response.status,
    balanceReceived: response.ok && data.balance !== undefined,
    currency: data.currency,
    error: data.error,
    upstreamStatus: data.upstreamStatus,
    challenge: data.challenge,
    ray: data.ray,
  }, null, 2));
  if (!response.ok || data.balance === undefined) process.exitCode = 1;
} catch {
  console.error('Không nhận được JSON từ relay; kiểm tra URL và hai tiến trình local.');
  process.exitCode = 1;
}
