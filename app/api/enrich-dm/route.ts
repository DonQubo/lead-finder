import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// Module-level cooldown: secondary abuse guard (10 min per server instance).
// NOTE: resets on serverless cold starts and does NOT coordinate across multiple instances.
// The n8n _enriching lock is the primary guard against duplicate concurrent runs.
let lastEnrichAt = 0;
const COOLDOWN_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const now = Date.now();
  if (now - lastEnrichAt < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - (now - lastEnrichAt)) / 1000);
    return NextResponse.json(
      { error: 'Enrichment already triggered recently. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const body = await req.json();

  const requestedSheetId = body.sheet_id as string | undefined;
  const defaultSheetId = process.env.LEAD_FINDER_SHEET_ID;
  if (requestedSheetId && defaultSheetId && requestedSheetId !== defaultSheetId) {
    return NextResponse.json(
      { error: 'Enrichment only works with the default sheet. Reset the sheet selector and try again.' },
      { status: 400 }
    );
  }

  const payload = { only_missing: body.only_missing !== false };

  const base = process.env.N8N_WEBHOOK_URL_BASE;
  const secret = process.env.ENRICH_DM_SECRET;
  if (!base || !secret) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const response = await fetch(`${base}/webhook/lead-finder-enrich-dm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-enrich-secret': secret,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(55000),
  });

  if (!response.ok) return NextResponse.json({ error: `Upstream: ${response.status}` }, { status: response.status });
  const data = await response.json();
  if (data.status === 'started') lastEnrichAt = now;
  return NextResponse.json(data, { status: data.status === 'started' ? 202 : 409 });
}
