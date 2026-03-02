import { NextResponse } from 'next/server';

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/openclaw/citadel-registry/main/registry.json';
const REGISTRY_URL = process.env.CITADEL_REGISTRY_URL || DEFAULT_REGISTRY_URL;

export const runtime = 'nodejs';

export async function GET() {
  try {
    const response = await fetch(REGISTRY_URL, {
      next: { revalidate: 60 } // Cache for 60 seconds
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Registry returned ${response.status}` },
        { status: 502 }
      );
    }

    const registry = await response.json();
    
    if (!registry || !Array.isArray(registry.apps)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid registry format' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      apps: registry.apps,
      registryUrl: REGISTRY_URL
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { ok: false, error: 'offline', message: 'Cannot reach registry. You appear to be offline.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
