import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

function webhookBase() {
  return process.env.N8N_WEBHOOK_URL?.replace(/\/[^/]+$/, '');
}

export async function GET(req: NextRequest) {
  const base = webhookBase();
  if (!base) return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 500 });

  const sheetId = req.nextUrl.searchParams.get('sheet_id') ?? undefined;

  const response = await fetch(`${base}/lead-finder-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheet_id: sheetId }),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: 502 });
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return NextResponse.json({ error: 'Invalid response from workflow' }, { status: 502 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const base = webhookBase();
  if (!base) return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 500 });

  const body = await req.json().catch(() => ({}));

  const response = await fetch(`${base}/lead-finder-clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: 502 });
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return NextResponse.json({ error: 'Invalid response from workflow' }, { status: 502 });
  }

  return NextResponse.json(data);
}
