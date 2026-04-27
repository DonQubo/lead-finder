'use client';

import { useState, useEffect } from 'react';

interface Lead {
  place_id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  business_status: string;
  opening_hours: string;
  price_level: string;
  rating: string;
  user_ratings_total: string;
  types: string;
  found_at: string;
}

interface SearchResponse { leads: Lead[]; count: number; }
interface LeadsResponse  { leads: Lead[]; count: number; }

const DEFAULT_SHEET_ID = '1ZP3TWy5kzvkKegxTEwzoVigOHFFBXC5tIsIh1KFFuzg';

function extractSheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
  return '';
}

function exportCSV(leads: Lead[]) {
  const headers: (keyof Lead)[] = [
    'place_id','name','address','phone','website','business_status',
    'opening_hours','price_level','rating','user_ratings_total','types','found_at',
  ];
  const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
  const rows = leads.map(l => headers.map(h => escape(l[h])).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'leads.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-zinc-400">—</span>;
  const ok = status === 'OPERATIONAL';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {ok ? 'Operational' : status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

function PriceLevel({ level }: { level: string }) {
  if (level === '') return <span className="text-zinc-400">—</span>;
  const n = parseInt(level);
  return <span className="text-zinc-700">{n === 0 ? 'Free' : '$'.repeat(n)}</span>;
}

function RatingCell({ rating, total }: { rating: string; total: string }) {
  if (!rating) return <span className="text-zinc-400">—</span>;
  return <span className="text-zinc-700">{rating} <span className="text-amber-400">★</span>{total && <span className="text-zinc-400 text-xs ml-1">({total})</span>}</span>;
}

function HoursCell({ hours }: { hours: string }) {
  if (!hours) return <span className="text-zinc-400">—</span>;
  const days = hours.split(' | ');
  return (
    <span title={hours} className="cursor-help text-zinc-600 text-xs">
      {days[0]}{days.length > 1 && <span className="text-zinc-400"> +{days.length - 1} more</span>}
    </span>
  );
}

function LeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            {['Name','Address','Phone','Website','Status','Rating','Price','Types','Hours'].map(h => (
              <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => (
            <tr key={lead.place_id || i} className={i % 2 === 0 ? '' : 'bg-zinc-50'}>
              <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">{lead.name}</td>
              <td className="px-4 py-3 text-zinc-600 max-w-[200px]">{lead.address}</td>
              <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{lead.phone || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {lead.website
                  ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block max-w-[160px]">{lead.website.replace(/^https?:\/\//, '')}</a>
                  : <span className="text-zinc-400">—</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={lead.business_status} /></td>
              <td className="px-4 py-3 whitespace-nowrap"><RatingCell rating={lead.rating} total={lead.user_ratings_total} /></td>
              <td className="px-4 py-3 whitespace-nowrap"><PriceLevel level={lead.price_level} /></td>
              <td className="px-4 py-3 text-zinc-600 max-w-[180px]">{lead.types || <span className="text-zinc-400">—</span>}</td>
              <td className="px-4 py-3 max-w-[200px]"><HoursCell hours={lead.opening_hours} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'search' | 'sheet'>('search');

  // Search tab state
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation]         = useState('');
  const [radius, setRadius]             = useState('1000');
  const [searching, setSearching]       = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [searchError, setSearchError]   = useState<string | null>(null);

  // Sheet tab state
  const [sheetId, setSheetId]           = useState('');
  const [sheetInput, setSheetInput]     = useState('');
  const [sheetError, setSheetError]     = useState<string | null>(null);
  const [allLeads, setAllLeads]         = useState<Lead[] | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadsError, setLeadsError]     = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing]         = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('leadFinderSheetId');
    if (saved) { setSheetId(saved); setSheetInput(saved); }
  }, []);

  const activeSheetId = sheetId || DEFAULT_SHEET_ID;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const res = await fetch('/api/find-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_type: businessType, location, radius: Number(radius), sheet_id: sheetId || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${res.status}`);
      }
      setSearchResult(await res.json());
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSearching(false);
    }
  }

  function handleSaveSheet() {
    const id = extractSheetId(sheetInput);
    if (!id) { setSheetError('Could not find a valid sheet ID in that URL. Paste the full Google Sheets URL or just the ID.'); return; }
    setSheetError(null);
    setSheetId(id);
    localStorage.setItem('leadFinderSheetId', id);
    setAllLeads(null);
  }

  function handleResetSheet() {
    setSheetId('');
    setSheetInput('');
    setSheetError(null);
    setAllLeads(null);
    localStorage.removeItem('leadFinderSheetId');
  }

  async function handleLoadLeads() {
    setLoadingLeads(true);
    setLeadsError(null);
    try {
      const res = await fetch(`/api/leads?sheet_id=${activeSheetId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${res.status}`);
      }
      const data: LeadsResponse = await res.json();
      setAllLeads(data.leads);
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoadingLeads(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet_id: activeSheetId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${res.status}`);
      }
      setAllLeads([]);
      setClearConfirm(false);
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Lead Finder</h1>
          <p className="mt-1 text-zinc-500">Find local businesses and export them to Google Sheets.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-200">
          {(['search', 'sheet'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-white border border-b-white border-zinc-200 text-zinc-900 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab === 'search' ? 'Find Leads' : 'Sheet'}
            </button>
          ))}
        </div>

        {/* ── SEARCH TAB ── */}
        {activeTab === 'search' && (
          <div>
            <form onSubmit={handleSearch} className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <label htmlFor="businessType" className="block text-sm font-medium text-zinc-700 mb-1">Business type</label>
                  <input id="businessType" type="text" required placeholder="e.g. restaurant, gym, school"
                    value={businessType} onChange={e => setBusinessType(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-zinc-700 mb-1">Location</label>
                  <input id="location" type="text" required placeholder="e.g. Austin, TX"
                    value={location} onChange={e => setLocation(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                </div>
                <div>
                  <label htmlFor="radius" className="block text-sm font-medium text-zinc-700 mb-1">Radius</label>
                  <select id="radius" value={radius} onChange={e => setRadius(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900">
                    <option value="500">500 m</option>
                    <option value="1000">1 km</option>
                    <option value="2000">2 km</option>
                    <option value="5000">5 km</option>
                    <option value="10000">10 km</option>
                  </select>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <button type="submit" disabled={searching}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {searching && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
                  {searching ? 'Searching…' : 'Find leads'}
                </button>
                {sheetId && <span className="text-xs text-zinc-400">Writing to custom sheet</span>}
              </div>
            </form>

            {searching && <p className="mt-4 text-sm text-zinc-500">This usually takes 20–30 seconds…</p>}

            {searchError && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{searchError}</div>
            )}

            {searchResult && searchResult.count === 0 && (
              <div className="mt-6 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
                All businesses from this search are already in your sheet.
              </div>
            )}

            {searchResult && searchResult.count > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-zinc-500">{searchResult.count} new lead{searchResult.count !== 1 ? 's' : ''} added to your sheet.</p>
                  <button onClick={() => exportCSV(searchResult.leads)}
                    className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-2">
                    Export CSV
                  </button>
                </div>
                <LeadsTable leads={searchResult.leads} />
              </div>
            )}
          </div>
        )}

        {/* ── SHEET TAB ── */}
        {activeTab === 'sheet' && (
          <div className="space-y-6">

            {/* Sheet Settings */}
            <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-zinc-900 mb-4">Sheet settings</h2>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <input type="text" placeholder="Paste Google Sheets URL or sheet ID"
                    value={sheetInput} onChange={e => { setSheetInput(e.target.value); setSheetError(null); }}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                  {sheetError && <p className="mt-1 text-xs text-red-600">{sheetError}</p>}
                  {sheetId
                    ? <p className="mt-1 text-xs text-zinc-400">Active sheet ID: <span className="font-mono">{sheetId}</span></p>
                    : <p className="mt-1 text-xs text-zinc-400">Using default sheet.</p>}
                </div>
                <button onClick={handleSaveSheet}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors whitespace-nowrap">
                  Use this sheet
                </button>
                {sheetId && (
                  <button onClick={handleResetSheet}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors whitespace-nowrap">
                    Reset to default
                  </button>
                )}
              </div>
            </div>

            {/* View Leads */}
            <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-zinc-900">
                  Existing leads {allLeads !== null && <span className="text-zinc-400 font-normal text-sm">({allLeads.length})</span>}
                </h2>
                <div className="flex items-center gap-3">
                  {allLeads && allLeads.length > 0 && (
                    <button onClick={() => exportCSV(allLeads)}
                      className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-2">
                      Export CSV
                    </button>
                  )}
                  <button onClick={handleLoadLeads} disabled={loadingLeads}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                    {loadingLeads && <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
                    {loadingLeads ? 'Loading…' : allLeads !== null ? 'Refresh' : 'Load leads'}
                  </button>
                </div>
              </div>

              {leadsError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{leadsError}</div>}

              {allLeads === null && !loadingLeads && (
                <p className="text-sm text-zinc-400">Click "Load leads" to view all leads in your sheet.</p>
              )}
              {allLeads !== null && allLeads.length === 0 && (
                <p className="text-sm text-zinc-400">No leads in the sheet yet.</p>
              )}
              {allLeads !== null && allLeads.length > 0 && <LeadsTable leads={allLeads} />}
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-red-700 mb-1">Danger zone</h2>
              <p className="text-sm text-zinc-500 mb-4">Permanently removes all leads from the sheet. The header row is kept.</p>
              {!clearConfirm ? (
                <button onClick={() => setClearConfirm(true)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                  Clear all leads
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-600">Are you sure? This cannot be undone.</span>
                  <button onClick={handleClear} disabled={clearing}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                    {clearing ? 'Clearing…' : 'Yes, clear all'}
                  </button>
                  <button onClick={() => setClearConfirm(false)}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
