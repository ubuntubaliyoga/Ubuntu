// api/enrich-helpers.js — shared phone-enrichment utilities
// Imported by leadgen-agent.js and retro-enrich.js

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

export const LINK_IN_BIO_DOMAINS = [
  'linktr.ee','beacons.ai','taplink.cc','bio.fm','campsite.bio',
  'lnk.bio','flow.page','milkshake.app','linkinbio.at','later.com',
  'bento.me','bio.link','carrd.co',
];

export function isLinkInBioUrl(url) {
  return !!url && LINK_IN_BIO_DOMAINS.some(d => url.includes(d));
}

export function extractAllLinkInBio(website, bio) {
  const text = `${website || ''} ${bio || ''}`;
  const found = [];
  for (const d of LINK_IN_BIO_DOMAINS) {
    const re = new RegExp(`(?:https?:\\/\\/)?${d.replace('.','\\.')}[\\/#][\\w.\\-]+`, 'gi');
    const m  = text.match(re);
    if (m) found.push(...m.map(u => u.startsWith('http') ? u : `https://${u}`));
  }
  return [...new Set(found)];
}

export function shortUrl(url) { try { return new URL(url).hostname; } catch { return url; } }

export function extractPhoneFromText(text) {
  if (!text) return null;
  const waM = text.match(/wa\.me\/\+?([\d]{7,15})/);
  if (waM) return waM[1];
  const waApi = text.match(/api\.whatsapp\.com\/send[^"'\s]*[?&]phone=\+?([\d]{7,15})/i);
  if (waApi) return waApi[1];
  return text.match(/\+[\d][\d\s\-().]{8,14}[\d]/)?.[0]?.replace(/[\s\-()]/g, '') || null;
}

export function extractPhoneFromHtml(html) {
  const telM = html.match(/href="tel:(\+?[\d\s\-().+]{7,20})"/i);
  if (telM) return telM[1].replace(/[\s\-().]/g, '');
  const waM = html.match(/wa\.me\/\+?([\d]{7,15})/);
  if (waM) return waM[1];
  const waApi = html.match(/api\.whatsapp\.com\/send[^"'\s]*[?&]phone=\+?([\d]{7,15})/i);
  if (waApi) return waApi[1];
  const intl = html.match(/\+[\d][\d\s\-().]{8,14}[\d]/)?.[0];
  if (intl) return intl.replace(/[\s\-()]/g, '');
  const labeled = html.match(/(?:tel|phone|whatsapp|wa|mob(?:ile)?|call|contact|hp)[:\s 📞]+(\+?[\d][\d\s\-().]{7,14}[\d])/i);
  if (labeled) return labeled[1].replace(/[\s\-().]/g, '');
  return null;
}

export async function scrapeLinkInBio(url) {
  try {
    const r    = await fetch(url, { headers: { 'User-Agent': IPHONE_UA }, signal: AbortSignal.timeout(10000) });
    const html = await r.text();

    const waM = html.match(/wa\.me\/\+?([\d]{7,15})/);
    if (waM) return waM[1];
    const waApi = html.match(/api\.whatsapp\.com\/send[^"'\s]*[?&]phone=\+?([\d]{7,15})/i);
    if (waApi) return waApi[1];
    const telM = html.match(/href="tel:(\+?[\d\s\-().+]{7,20})"/i);
    if (telM) return telM[1].replace(/[\s\-().]/g, '');

    // Next.js __NEXT_DATA__ — raw string search then recursive JSON walk
    const ndM = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (ndM) {
      const ndStr = ndM[1];
      const ndWa  = ndStr.match(/wa\.me\\?\/\+?([\d]{7,15})/);
      if (ndWa) return ndWa[1];
      const ndApi = ndStr.match(/api\.whatsapp\.com\\?\/send[^"'\s\\]*[?&]phone=\+?([\d]{7,15})/i);
      if (ndApi) return ndApi[1];
      try {
        const findLinks = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          if (Array.isArray(obj)) { for (const x of obj) { const r = findLinks(x); if (r) return r; } return null; }
          const href = (obj.url || obj.href || obj.link || '').trim();
          if (href.startsWith('tel:')) return href.slice(4).replace(/[\s\-]/g,'');
          const tP = (obj.title || obj.label || '').match(/\+[\d]{8,14}/)?.[0];
          if (tP) return tP.replace(/\s/g,'');
          for (const v of Object.values(obj)) { const r = findLinks(v); if (r) return r; }
          return null;
        };
        const found = findLinks(JSON.parse(ndStr));
        if (found) return found;
      } catch { /* fall through */ }
    }
    return null;
  } catch { return null; }
}

export async function fetchContactDeep(website) {
  const base  = website.replace(/\/$/, '');
  const PAGES = ['', '/contact', '/about', '/impressum', '/imprint', '/legal', '/kontakt', '/book', '/schedule', '/workshop'];
  const results = await Promise.allSettled(PAGES.map(async suffix => {
    try {
      const r    = await fetch(`${base}${suffix}`, { headers: { 'User-Agent': IPHONE_UA }, signal: AbortSignal.timeout(6000) });
      const html = await r.text();
      const phone = extractPhoneFromHtml(html);
      const email = html.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i)?.[0] || null;
      if (phone || email) return { phone, email, page: suffix || '/' };
    } catch { /* skip */ }
    return null;
  }));
  for (const r of results) { if (r.status === 'fulfilled' && r.value?.phone) return r.value; }
  for (const r of results) { if (r.status === 'fulfilled' && r.value?.email) return r.value; }
  return null;
}

export async function braveSearchPhone(name, insta, city) {
  const handle = (insta || '').replace('@', '');
  const q = `"${name}" OR "@${handle}" yoga retreat WhatsApp ${city || ''}`.trim();
  try {
    const r    = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY }, signal: AbortSignal.timeout(8000) });
    const d    = await r.json();
    const text = (d.web?.results || []).map(x => x.description || '').join(' ');
    return extractPhoneFromText(text);
  } catch { return null; }
}
