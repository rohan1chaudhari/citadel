import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Simple in-memory cache for translations
const translationCache = new Map<string, string>();
const CACHE_SIZE_LIMIT = 1000;

/**
 * Translate French text to English using LibreTranslate API
 * This is a free, open-source translation API
 */
async function translateWithLibreTranslate(text: string): Promise<string | null> {
  try {
    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    // Try multiple LibreTranslate instances for reliability
    const instances = [
      'https://libretranslate.de',
      'https://libretranslate.pussthecat.org',
      'https://libretranslate.eownerdead.dedyn.io',
    ];

    for (const baseUrl of instances) {
      try {
        const res = await fetch(`${baseUrl}/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: text,
            source: 'fr',
            target: 'en',
            format: 'text',
          }),
          // Short timeout to ensure quick response
          signal: AbortSignal.timeout(2000),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.translatedText) {
            // Cache the result
            if (translationCache.size >= CACHE_SIZE_LIMIT) {
              const firstKey = translationCache.keys().next().value;
              if (firstKey) translationCache.delete(firstKey);
            }
            translationCache.set(cacheKey, data.translatedText);
            return data.translatedText;
          }
        }
      } catch (err) {
        // Try next instance
        continue;
      }
    }

    return null;
  } catch (err) {
    console.error('Translation error:', err);
    return null;
  }
}

/**
 * Fallback: Simple dictionary-based translation for common phrases
 */
function getFallbackTranslation(text: string): string {
  const dictionary: Record<string, string> = {
    'bonjour': 'hello',
    'bonsoir': 'good evening',
    'salut': 'hi',
    'au revoir': 'goodbye',
    'merci': 'thank you',
    's\'il vous plaît': 'please',
    's\'il te plaît': 'please',
    'oui': 'yes',
    'non': 'no',
    'comment allez-vous': 'how are you',
    'comment vas-tu': 'how are you',
    'je vais bien': 'I am well',
    'je ne comprends pas': 'I do not understand',
    'parlez-vous anglais': 'do you speak English',
    'je ne parle pas français': 'I do not speak French',
    'où sont les toilettes': 'where is the bathroom',
    'combien ça coûte': 'how much does it cost',
    'je t\'aime': 'I love you',
    'bonne nuit': 'good night',
    'bonne journée': 'have a good day',
    'à bientôt': 'see you soon',
    'à demain': 'see you tomorrow',
    'excusez-moi': 'excuse me',
    'pardon': 'sorry',
    'je suis désolé': 'I am sorry',
    'je suis désolée': 'I am sorry',
    'bon appétit': 'enjoy your meal',
    'santé': 'cheers',
    'felicitations': 'congratulations',
    'bonne chance': 'good luck',
    'bon voyage': 'have a good trip',
    'bienvenue': 'welcome',
    'de rien': 'you\'re welcome',
    'je m\'appelle': 'my name is',
    'comment vous appelez-vous': 'what is your name',
    'je suis': 'I am',
    'c\'est': 'it is',
    'très bien': 'very good',
    'parfait': 'perfect',
    'super': 'great',
    'magnifique': 'magnificent',
    'belle': 'beautiful',
    'beau': 'beautiful',
    'joli': 'pretty',
    'gros': 'big',
    'petit': 'small',
    'chaud': 'hot',
    'froid': 'cold',
    'nouveau': 'new',
    'vieux': 'old',
    'jeune': 'young',
    'bon': 'good',
    'mauvais': 'bad',
  };

  const lowerText = text.toLowerCase().trim();
  
  // Check for exact match
  if (dictionary[lowerText]) {
    return dictionary[lowerText];
  }

  // Check if text contains any known phrases
  for (const [fr, en] of Object.entries(dictionary)) {
    if (lowerText.includes(fr)) {
      return text.toLowerCase().replace(fr, en);
    }
  }

  // Return original with note if no translation found
  return `[Translation pending] ${text}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? '').trim();

    if (!text) {
      return NextResponse.json(
        { ok: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Try online translation first
    let translation = await translateWithLibreTranslate(text);
    
    // Fallback to dictionary if online fails
    if (!translation) {
      translation = getFallbackTranslation(text);
    }

    return NextResponse.json({
      ok: true,
      text,
      translation,
      source: 'fr',
      target: 'en',
    });
  } catch (err) {
    console.error('Translation API error:', err);
    return NextResponse.json(
      { ok: false, error: 'Translation failed' },
      { status: 500 }
    );
  }
}
