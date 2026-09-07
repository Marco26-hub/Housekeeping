const userAgent = process.env.USER_AGENT || 'LeadForgeItalia/1.0';
const categoryAliases = {
  ristorante:'restaurant', ristoranti:'restaurant', pizzeria:'restaurant|fast_food', bar:'bar|cafe',
  caffe:'cafe', caffè:'cafe', dentista:'dentist', dentisti:'dentist', farmacia:'pharmacy', farmacie:'pharmacy',
  parrucchiere:'hairdresser', parrucchieri:'hairdresser', barbiere:'hairdresser', estetista:'beauty',
  palestra:'fitness_centre', palestre:'fitness_centre', hotel:'hotel', albergo:'hotel',
  supermercato:'supermarket', supermercati:'supermarket', panificio:'bakery', panetteria:'bakery',
  macelleria:'butcher', ferramenta:'hardware', fioraio:'florist', ottico:'optician',
  commercialista:'accountant', avvocato:'lawyer', assicurazione:'insurance', agenzia:'estate_agent',
  meccanico:'car_repair', carrozzeria:'car_repair', concessionaria:'car', elettricista:'electrician',
  idraulico:'plumber', impresa_edile:'builder', pulizie:'cleaning', lavanderia:'laundry'
};

function osmCategory(value) {
  const normalized = String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  return categoryAliases[normalized] || normalized;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.href;
  } catch { return ''; }
}

export async function discoverOpenStreetMap({ category, city, limit = 30 }) {
  if (!category || !city) throw new Error('Categoria e località sono obbligatorie');
  const search = encodeURIComponent(`${city}, Italia`);
  const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${search}`, {
    headers: { 'User-Agent': userAgent, 'Accept-Language': 'it' }
  });
  if (!geoResponse.ok) throw new Error('Servizio di geocodifica non disponibile');
  const [place] = await geoResponse.json();
  if (!place) throw new Error('Località non trovata');

  const radius = 12000;
  const q = osmCategory(category).replace(/["\\]/g, '');
  const query = `[out:json][timeout:25];(nwr["name"]["amenity"~"${q}",i](around:${radius},${place.lat},${place.lon});nwr["name"]["shop"~"${q}",i](around:${radius},${place.lat},${place.lon});nwr["name"]["craft"~"${q}",i](around:${radius},${place.lat},${place.lon});nwr["name"]["office"~"${q}",i](around:${radius},${place.lat},${place.lon}););out center tags ${Math.min(Number(limit) || 30, 100)};`;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent },
    body: `data=${encodeURIComponent(query)}`
  });
  if (!response.ok) throw new Error('OpenStreetMap/Overpass non disponibile');
  const data = await response.json();
  return data.elements.slice(0, limit).map(({ id, type, tags = {} }) => ({
    company: tags.name,
    category,
    city: tags['addr:city'] || city,
    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
    website: safeUrl(tags.website || tags['contact:website'] || ''),
    email: tags.email || tags['contact:email'] || '',
    phone: tags.phone || tags['contact:phone'] || '',
    source: 'OpenStreetMap',
    source_url: `https://www.openstreetmap.org/${type}/${id}`
  }));
}

export async function enrichWebsite(rawUrl) {
  const url = safeUrl(rawUrl);
  if (!url) throw new Error('URL non valido');
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': userAgent } });
  if (!response.ok) throw new Error(`Il sito ha risposto con stato ${response.status}`);
  const html = await response.text();
  const emails = [...new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .filter(email => !/example\.|sentry|wixpress|domain\./i.test(email)))];
  const phones = [...new Set((html.match(/(?:\+39[ .-]?)?(?:0\d{1,3}|3\d{2})[ .-]?\d{3,4}[ .-]?\d{3,4}/g) || [])
    .map(v => v.trim()))];
  return { website: response.url, email: emails[0] || '', phone: phones[0] || '' };
}

export function parseCsv(text) {
  const lines = String(text).trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const split = line => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  const headers = split(lines.shift()).map(h => h.toLowerCase());
  return lines.filter(Boolean).map(line => Object.fromEntries(split(line).map((v, i) => [headers[i], v])));
}
