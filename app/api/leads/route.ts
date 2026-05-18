import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

function webhookBase() {
  return process.env.N8N_WEBHOOK_URL?.replace(/\/[^/]+$/, '');
}

export async function GET(req: NextRequest) {
  const base = webhookBase();
  if (!base) return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 500 });

  const sheetId = req.nextUrl.searchParams.get('sheet_id') ?? undefined;

  const [leadsRes, dmRes] = await Promise.all([
    fetch(`${base}/lead-finder-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet_id: sheetId }),
      signal: AbortSignal.timeout(25000),
    }),
    fetch(`${base}/lead-finder-dm-data${sheetId ? '?sheet_id=' + encodeURIComponent(sheetId) : ''}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    }).catch(() => null),
  ]);

  if (!leadsRes.ok) {
    return NextResponse.json({ error: `Upstream error: ${leadsRes.status}` }, { status: 502 });
  }

  let data;
  try {
    data = await leadsRes.json();
  } catch {
    return NextResponse.json({ error: 'Invalid response from workflow' }, { status: 502 });
  }

  if (dmRes?.ok) {
    try {
      const dmData = await dmRes.json();
      const dm = dmData.dm || {};
      data.leads = (data.leads || []).flatMap((lead: Record<string, string>) => {
        const matches = dm[lead.place_id];
        if (Array.isArray(matches) && matches.length > 0) {
          return matches.map((person: Record<string, string>) => ({ ...lead, ...person }));
        }
        if (matches && typeof matches === 'object') {
          return [{ ...lead, ...matches }];
        }
        return [lead];
      });
    } catch { /* DM merge failed — return leads without enrichment */ }
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
