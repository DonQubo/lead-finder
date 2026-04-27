import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 500 });
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });

  if (!response.ok) {
    return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: 502 });
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return NextResponse.json({ error: 'Workflow returned an empty response' }, { status: 502 });
  }
  return NextResponse.json(data);
}
