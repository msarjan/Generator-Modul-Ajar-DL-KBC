// Vercel Serverless Function — proxy aman ke Anthropic API
// API key disimpan di environment variable Vercel, tidak pernah terekspos ke browser

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY belum diset di Vercel environment variables.'
    });
  }

  // Vercel menyediakan req.body sebagai Buffer (body sudah dikonsumsi runtime-nya).
  // Jika req.body tersedia, gunakan langsung. Jika tidak, baca dari stream sebagai fallback.
  let bodyBuffer;
  if (req.body && (Buffer.isBuffer(req.body) ? req.body.length : true)) {
    bodyBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));
  } else {
    bodyBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  if (!bodyBuffer || bodyBuffer.length === 0) {
    return res.status(400).json({ error: 'Request body kosong.' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'files-api-2025-04-14'
      },
      body: bodyBuffer
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'Gagal terhubung ke Anthropic API',
      details: err.message
    });
  }
};
