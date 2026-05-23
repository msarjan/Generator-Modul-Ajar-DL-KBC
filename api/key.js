// Vercel Serverless Function — kirim API key ke browser
// Dilindungi rate limit: max 30 request/menit per IP
// API key diambil dari environment variable Vercel, tidak hardcode

// ── Rate limiter sederhana (in-memory, per IP) ──
// Catatan: in-memory berarti reset saat serverless function cold start
// Cukup untuk beta — untuk produksi gunakan Upstash Redis
const rateLimitMap = new Map();
const RATE_LIMIT    = 30;  // max request per window
const WINDOW_MS     = 60 * 1000; // 1 menit

function checkRateLimit(ip) {
  const now  = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // IP baru atau window sudah expired — reset
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    // Melebihi limit
    const resetIn = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }

  // Masih dalam limit — tambah count
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// ── Bersihkan map setiap 5 menit agar tidak memory leak ──
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > WINDOW_MS * 5) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

module.exports = async (req, res) => {
  // CORS — hanya izinkan GET
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ambil IP dari header Vercel (x-forwarded-for) atau fallback
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  // Cek rate limit
  const limit = checkRateLimit(ip);
  res.setHeader('X-RateLimit-Limit',     RATE_LIMIT);
  res.setHeader('X-RateLimit-Remaining', limit.remaining);

  if (!limit.allowed) {
    return res.status(429).json({
      error: `Terlalu banyak request. Coba lagi dalam ${limit.resetIn} detik.`
    });
  }

  // Ambil API key dari environment variable
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY belum diset di Vercel environment variables.'
    });
  }

  return res.status(200).json({ key: apiKey });
};
