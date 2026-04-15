// api/exchange-rate.js
// Fetches the current USD → IDR rate from ExchangeRate-API (no key required)
// and returns it as JSON. Vercel caches the response for 1 hour.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!resp.ok) throw new Error(`Exchange rate fetch failed: ${resp.status}`);
    const data = await resp.json();
    const idr = data.rates?.IDR;
    if (!idr) throw new Error('IDR rate not found in response');

    // Cache for 1 hour on Vercel edge
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ rate: Math.round(idr) });
  } catch (err) {
    // Return a fallback rate so the app still works if the API is down
    return res.status(200).json({ rate: 17085, fallback: true, error: err.message });
  }
}
