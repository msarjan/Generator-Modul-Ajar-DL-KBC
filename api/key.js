// Endpoint untuk mengembalikan Anthropic API key ke browser
// Browser kemudian memanggil Anthropic API langsung (bypass batas 4.5MB Edge Function)

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY belum diset di Vercel environment variables.'
    });
  }

  return res.status(200).json({ key: apiKey });
};
