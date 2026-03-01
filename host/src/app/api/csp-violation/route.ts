import { NextRequest, NextResponse } from 'next/server';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract CSP violation details
    const report = body['csp-report'] || body;
    
    audit('citadel', 'csp.violation', {
      documentUri: report['document-uri'],
      referrer: report['referrer'],
      blockedUri: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      effectiveDirective: report['effective-directive'],
      originalPolicy: report['original-policy'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      columnNumber: report['column-number'],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    audit('citadel', 'csp.violation.error', {
      error: String(error),
    });
    
    return NextResponse.json({ ok: false, error: 'Invalid report' }, { status: 400 });
  }
}
