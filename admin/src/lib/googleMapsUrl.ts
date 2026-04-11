/**
 * Extract coordinates from pasted Google Maps URLs or plain "lat, lng" text.
 * Short links are resolved by fetching page text (Jina Reader, then AllOrigins) and parsing coordinates.
 */

const COORD_PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/

/** @lat,lng,zoom or @lat,lngz — common in maps URLs */
const AT_COORD = /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:,|\d*z|$|[/\s?&])/i

/** Place data segment !3d(lat)!4d(lng) (often after other ! chunks, e.g. !8m2!3d…!4d…) */
const PLACE_3D_4D = /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/i

/** Google Maps protobuf-style microdegrees (lat/lng × 1e7), common in /maps/vt/pb tile URLs */
const E7_PAIR = /!1x(-?\d{6,})!2x(-?\d{6,})/g

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
}

function tryPair(a: string, b: string): { lat: number; lng: number } | null {
  const lat = Number(a)
  const lng = Number(b)
  if (!isValidLatLng(lat, lng)) return null
  return { lat, lng }
}

/**
 * Returns latitude/longitude from a maps link, URL with @…, or a "lat, lng" / "lat lng" line.
 */
export function parseLatLngFromGoogleMapsInput(raw: string): { lat: number; lng: number } | null {
  const text = raw.trim()
  if (!text) return null

  const trimmedLine = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? text

  const qMatch = trimmedLine.match(/[?&](?:q|query|ll)=([^&]+)/i)
  if (qMatch) {
    const decoded = decodeURIComponent(qMatch[1].replace(/\+/g, ' '))
    const pair = decoded.match(COORD_PAIR)
    if (pair) {
      const t = tryPair(pair[1], pair[2])
      if (t) return t
    }
  }

  const at = trimmedLine.match(AT_COORD)
  if (at) {
    const t = tryPair(at[1], at[2])
    if (t) return t
  }

  const d34 = trimmedLine.match(PLACE_3D_4D)
  if (d34) {
    const t = tryPair(d34[1], d34[2])
    if (t) return t
  }

  const direct = trimmedLine.match(new RegExp(`^\\s*${COORD_PAIR.source}\\s*$`, 'i'))
  if (direct) {
    const t = tryPair(direct[1], direct[2])
    if (t) return t
  }

  const anywhere = trimmedLine.match(COORD_PAIR)
  if (anywhere) {
    const t = tryPair(anywhere[1], anywhere[2])
    if (t) return t
  }

  return null
}

/** First valid lat/lng from !1x…!2x… microdegree pairs (Jina / embed HTML often only has these). */
export function parseLatLngFromGoogleE7Pairs(html: string): { lat: number; lng: number } | null {
  E7_PAIR.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = E7_PAIR.exec(html))) {
    const lat = Number(m[1]) / 1e7
    const lng = Number(m[2]) / 1e7
    if (isValidLatLng(lat, lng)) return { lat, lng }
  }
  return null
}

/** Share / redirect hosts where coordinates are not in the URL string itself. */
export function isShortMapsLink(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    /goo\.gl\//.test(t) ||
    /maps\.app\.goo\.gl\//.test(t) ||
    /g\.co\/maps\//.test(t)
  )
}

function looksLikeHttpUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

/** Pull google.com/maps URLs out of HTML (redirect pages, embeds). */
function extractGoogleMapsUrlsFromHtml(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const re = /https?:\/\/(?:www\.)?google\.com\/maps[^"'\\s<>]*/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const u = m[0].replace(/&amp;/g, '&')
    if (!seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

function tryParseFromHtmlDocument(html: string): { lat: number; lng: number } | null {
  const canonical = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  )
  if (canonical?.[1]) {
    const fromCanon = parseLatLngFromGoogleMapsInput(
      decodeURIComponent(canonical[1].replace(/&amp;/g, '&')),
    )
    if (fromCanon) return fromCanon
  }
  for (const url of extractGoogleMapsUrlsFromHtml(html)) {
    const p = parseLatLngFromGoogleMapsInput(url)
    if (p) return p
  }
  const e7 = parseLatLngFromGoogleE7Pairs(html)
  if (e7) return e7
  return parseLatLngFromGoogleMapsInput(html)
}

/**
 * [Jina AI Reader](https://jina.ai/reader) fetches the resolved page as text; works well for
 * `maps.app.goo.gl` short links where other proxies time out.
 */
async function fetchPageTextViaJina(url: string, signal?: AbortSignal): Promise<string | null> {
  const jina = `https://r.jina.ai/${encodeURIComponent(url)}`
  try {
    const res = await fetch(jina, {
      signal,
      headers: { Accept: 'text/plain' },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/**
 * Fetches URL HTML via AllOrigins (fallback if Jina fails).
 */
async function fetchUrlContentsViaAllOrigins(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  try {
    const res = await fetch(proxy, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as { contents?: unknown }
    return typeof data.contents === 'string' ? data.contents : null
  } catch {
    return null
  }
}

/**
 * Resolves coordinates from plain text, a long Maps URL, or a short share link (best-effort).
 * Tries [Jina Reader](https://jina.ai/reader) first (reliable for `maps.app.goo.gl`), then AllOrigins.
 */
export async function resolveGoogleMapsInputToLatLng(
  raw: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  const direct = parseLatLngFromGoogleMapsInput(raw)
  if (direct) return direct

  const trimmed = raw.trim()
  if (!trimmed || !looksLikeHttpUrl(trimmed)) return null

  const jina = await fetchPageTextViaJina(trimmed, signal)
  if (jina) {
    const fromJina = tryParseFromHtmlDocument(jina)
    if (fromJina) return fromJina
  }

  const html = await fetchUrlContentsViaAllOrigins(trimmed, signal)
  if (!html) return null

  return tryParseFromHtmlDocument(html)
}

/** Opens Google Maps at the exact pin (search by coordinates). */
export function googleMapsOpenPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
}
