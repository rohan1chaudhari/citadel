import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const translationCache = new Map<string, string>();
const CACHE_SIZE_LIMIT = 1000;

async function translateWithLibreTranslate(text: string): Promise<string | null> {
  const cacheKey = text.toLowerCase().trim();
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey)!;

  const instances = [
    'https://libretranslate.de',
    'https://libretranslate.pussthecat.org',
    'https://libretranslate.eownerdead.dedyn.io',
  ];

  for (const baseUrl of instances) {
    try {
      const res = await fetch(`${baseUrl}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: 'fr', target: 'en', format: 'text' }),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.translatedText) continue;
      if (translationCache.size >= CACHE_SIZE_LIMIT) {
        const firstKey = translationCache.keys().next().value;
        if (firstKey) translationCache.delete(firstKey);
      }
      translationCache.set(cacheKey, data.translatedText);
      return data.translatedText;
    } catch {}
  }
  return null;
}

function getFallbackTranslation(text: string): string {
  const dictionary: Record<string, string> = { bonjour: 'hello', bonsoir: 'good evening', salut: 'hi', merci: 'thank you', oui: 'yes', non: 'no' };
  const lowerText = text.toLowerCase().trim();
  if (dictionary[lowerText]) return dictionary[lowerText];
  for (const [fr, en] of Object.entries(dictionary)) if (lowerText.includes(fr)) return lowerText.replace(fr, en);
  return `[Translation pending] ${text}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? '').trim();
  if (!text) return NextResponse.json({ ok: false, error: 'Text is required' }, { status: 400 });

  let translation = await translateWithLibreTranslate(text);
  if (!translation) translation = getFallbackTranslation(text);
  return NextResponse.json({ ok: true, text, translation, source: 'fr', target: 'en' });
}
