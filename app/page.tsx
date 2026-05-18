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
  person_name: string;
  person_title: string;
  person_phone: string;
  person_email: string;
  person_linkedin: string;
  person_instagram: string;
  person_twitter: string;
}

interface SavedSearch {
  id: string;
  timestamp: string;
  business_type: string;
  location: string;
  radius: string;
  max_results: string;
}

const DEFAULT_SHEET_ID = '1ZP3TWy5kzvkKegxTEwzoVigOHFFBXC5tIsIh1KFFuzg';
const HISTORY_KEY = 'leadFinderHistory';
const SHEET_KEY = 'leadFinderSheetId';
const MAX_HISTORY = 10;

const PRICE_OPTIONS = [
  { value: '', label: '?' },
  { value: '0', label: 'Free' },
  { value: '1', label: '$' },
  { value: '2', label: '$$' },
  { value: '3', label: '$$$' },
  { value: '4', label: '$$$$' },
];

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
    'person_name','person_title','person_phone','person_email','person_linkedin','person_instagram','person_twitter',
  ];
  const escape = (v: string) => {
    const s = (v || '');
    const safe = /^[=+\-@\t\r]/.test(s) ? '\t' + s : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = leads.map(l => headers.map(h => escape(l[h])).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'leads.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

function applyFilters(leads: Lead[], minRating: number, operationalOnly: boolean, priceLevels: string[]): Lead[] {
  return leads.filter(lead => {
    if (operationalOnly && lead.business_status !== 'OPERATIONAL') return false;
    if (minRating > 0) {
      const r = parseFloat(lead.rating);
      if (isNaN(r) || r < minRating) return false;
    }
    if (priceLevels.length > 0 && !priceLevels.includes(lead.price_level)) return false;
    return true;
  });
}

function saveToHistory(history: SavedSearch[], entry: Omit<SavedSearch, 'id' | 'timestamp'>): SavedSearch[] {
  const newEntry: SavedSearch = { id: Date.now().toString(), timestamp: new Date().toISOString(), ...entry };
  const deduped = history.filter(s =>
    !(s.business_type === entry.business_type && s.location === entry.location && s.radius === entry.radius)
  );
  return [newEntry, ...deduped].slice(0, MAX_HISTORY);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
  return (
    <span className="text-zinc-700">
      {rating} <span className="text-amber-400">★</span>
      {total && <span className="text-zinc-400 text-xs ml-1">({total})</span>}
    </span>
  );
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

function validSocialUrl(val: string, ...domains: string[]): boolean {
  if (!val || val === 'N/A') return false;
  try {
    const { hostname } = new URL(val);
    return domains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function DecisionMakerCell({ lead }: { lead: Lead }) {
  const hasData = lead.person_name && lead.person_name !== 'N/A' && lead.person_name !== '';
  if (!hasData) return <span className="text-zinc-400 text-xs">—</span>;

  const validEmail = EMAIL_RE.test(lead.person_email || '');
  const liOk = validSocialUrl(lead.person_linkedin, 'linkedin.com');
  const igOk = validSocialUrl(lead.person_instagram, 'instagram.com');
  const twOk = validSocialUrl(lead.person_twitter, 'twitter.com', 'x.com');

  return (
    <div className="text-xs space-y-0.5 min-w-[160px]">
      <div className="font-medium text-zinc-700">{lead.person_name}</div>
      {lead.person_title && lead.person_title !== 'N/A' && (
        <div className="text-zinc-500">{lead.person_title}</div>
      )}
      {lead.person_phone && lead.person_phone !== 'N/A' && (
        <a href={`tel:${lead.person_phone}`} className="text-zinc-600 hover:underline block">{lead.person_phone}</a>
      )}
      {validEmail && (
        <a href={`mailto:${lead.person_email}`} className="text-blue-600 hover:underline block truncate max-w-[200px]">
          {lead.person_email}
        </a>
      )}
      {(liOk || igOk || twOk) && (
        <div className="flex gap-2 pt-0.5">
          {liOk && <a href={lead.person_linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">LI</a>}
          {igOk && <a href={lead.person_instagram} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">IG</a>}
          {twOk && <a href={lead.person_twitter} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">X</a>}
        </div>
      )}
    </div>
  );
}

function LeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            {['Name','Address','Phone','Website','Status','Rating','Price','Hours','Decision Maker'].map(h => (
              <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => (
            <tr key={`${lead.place_id || i}-${lead.person_email || lead.person_name || i}`} className={i % 2 === 0 ? '' : 'bg-zinc-50'}>
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
              <td className="px-4 py-3 max-w-[200px]"><HoursCell hours={lead.opening_hours} /></td>
              <td className="px-4 py-3"><DecisionMakerCell lead={lead} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface FiltersBarProps {
  minRating: number;
  setMinRating: (v: number) => void;
  operationalOnly: boolean;
  setOperationalOnly: (v: boolean) => void;
  priceLevels: string[];
  setPriceLevels: (v: string[]) => void;
  total: number;
  filtered: number;
}

function FiltersBar({ minRating, setMinRating, operationalOnly, setOperationalOnly, priceLevels, setPriceLevels, total, filtered }: FiltersBarProps) {
  function togglePrice(p: string) {
    setPriceLevels(priceLevels.includes(p) ? priceLevels.filter(x => x !== p) : [...priceLevels, p]);
  }
  const hasActive = minRating > 0 || operationalOnly || priceLevels.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 bg-white rounded-xl border border-zinc-200 shadow-sm text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-500">Rating</span>
        <select value={minRating} onChange={e => setMinRating(Number(e.target.value))}
          className="rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-700 bg-transparent focus:outline-none">
          <option value={0}>Any</option>
          <option value={3}>3+</option>
          <option value={3.5}>3.5+</option>
          <option value={4}>4+</option>
          <option value={4.5}>4.5+</option>
        </select>
      </div>

      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input type="checkbox" checked={operationalOnly} onChange={e => setOperationalOnly(e.target.checked)}
          className="rounded border-zinc-300 accent-zinc-900" />
        <span className="text-zinc-600">Operational only</span>
      </label>

      <div className="flex items-center gap-1.5">
        <span className="text-zinc-500">Price</span>
        <div className="flex gap-1">
          {PRICE_OPTIONS.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => togglePrice(value)}
              className={`rounded px-1.5 py-0.5 text-xs font-medium border transition-colors ${
                priceLevels.length === 0 || priceLevels.includes(value)
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-400 border-zinc-200'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {hasActive && (
          <button type="button" onClick={() => { setMinRating(0); setOperationalOnly(false); setPriceLevels([]); }}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
            Clear filters
          </button>
        )}
        <span className="text-zinc-400 text-xs font-medium">
          {filtered === total ? `${total}` : `${filtered} / ${total}`} results
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'search' | 'sheet'>('search');

  // Search form
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation]         = useState('');
  const [radius, setRadius]             = useState('1000');
  const [maxResults, setMaxResults]     = useState('20');
  const [searching, setSearching]       = useState(false);
  const [searchResult, setSearchResult] = useState<{ leads: Lead[]; count: number } | null>(null);
  const [searchError, setSearchError]   = useState<string | null>(null);

  // History
  const [searchHistory, setSearchHistory] = useState<SavedSearch[]>([]);

  // Sheet tab
  const [sheetId, setSheetId]           = useState('');
  const [sheetInput, setSheetInput]     = useState('');
  const [sheetError, setSheetError]     = useState<string | null>(null);
  const [allLeads, setAllLeads]         = useState<Lead[] | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadsError, setLeadsError]     = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing]         = useState(false);
  const [enriching, setEnriching]       = useState(false);
  const [enrichMsg, setEnrichMsg]       = useState('');

  // Filters (shared between tabs)
  const [filterRating, setFilterRating]           = useState(0);
  const [filterOperational, setFilterOperational] = useState(false);
  const [filterPriceLevels, setFilterPriceLevels] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedSheet = localStorage.getItem(SHEET_KEY);
      if (savedSheet) { setSheetId(savedSheet); setSheetInput(savedSheet); }
      try {
        const h = localStorage.getItem(HISTORY_KEY);
        if (h) setSearchHistory(JSON.parse(h));
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const activeSheetId   = sheetId || DEFAULT_SHEET_ID;
  const filteredSearch  = searchResult ? applyFilters(searchResult.leads, filterRating, filterOperational, filterPriceLevels) : [];
  const filteredSheet   = allLeads    ? applyFilters(allLeads,           filterRating, filterOperational, filterPriceLevels) : [];

  const searchDuration = maxResults === '60' ? '3–5 minutes' : maxResults === '40' ? '2–3 minutes' : '1–2 minutes';

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const res = await fetch('/api/find-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_type: businessType,
          location,
          radius: Number(radius),
          max_results: Number(maxResults),
          sheet_id: sheetId || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      setSearchResult(data);
      const next = saveToHistory(searchHistory, { business_type: businessType, location, radius, max_results: maxResults });
      setSearchHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSearching(false);
    }
  }

  function fillFromHistory(s: SavedSearch) {
    setBusinessType(s.business_type);
    setLocation(s.location);
    setRadius(s.radius);
    setMaxResults(s.max_results || '20');
    setSearchResult(null);
    setSearchError(null);
  }

  function removeHistory(id: string) {
    const next = searchHistory.filter(s => s.id !== id);
    setSearchHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  function handleSaveSheet() {
    const id = extractSheetId(sheetInput);
    if (!id) { setSheetError('Could not find a valid sheet ID in that URL. Paste the full Google Sheets URL or just the ID.'); return; }
    setSheetError(null);
    setSheetId(id);
    localStorage.setItem(SHEET_KEY, id);
    setAllLeads(null);
  }

  function handleResetSheet() {
    setSheetId('');
    setSheetInput('');
    setSheetError(null);
    setAllLeads(null);
    localStorage.removeItem(SHEET_KEY);
  }

  async function handleLoadLeads() {
    setLoadingLeads(true);
    setLeadsError(null);
    setEnrichMsg('');
    try {
      const res = await fetch(`/api/leads?sheet_id=${activeSheetId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
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
            <button key={tab} onClick={() => { setActiveTab(tab); setEnrichMsg(''); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-white border border-b-white border-zinc-200 text-zinc-900 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {tab === 'search' ? 'Find Leads' : 'Sheet'}
            </button>
          ))}
        </div>

        {/* ── SEARCH TAB ── */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Business type</label>
                  <input type="text" required placeholder="e.g. restaurant, gym"
                    value={businessType} onChange={e => setBusinessType(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Location</label>
                  <input type="text" required placeholder="e.g. Austin, TX"
                    value={location} onChange={e => setLocation(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Radius</label>
                  <select value={radius} onChange={e => setRadius(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900">
                    <option value="500">500 m</option>
                    <option value="1000">1 km</option>
                    <option value="2000">2 km</option>
                    <option value="5000">5 km</option>
                    <option value="10000">10 km</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Max results</label>
                  <select value={maxResults} onChange={e => setMaxResults(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900">
                    <option value="20">20 results</option>
                    <option value="40">40 results</option>
                    <option value="60">60 results</option>
                  </select>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <button type="submit" disabled={searching}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {searching && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                  )}
                  {searching ? 'Searching…' : 'Find leads'}
                </button>
                {sheetId && <span className="text-xs text-zinc-400">Writing to custom sheet</span>}
              </div>
            </form>

            {/* Recent searches */}
            {searchHistory.length > 0 && !searching && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-400 whitespace-nowrap">Recent:</span>
                {searchHistory.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center rounded-full bg-white border border-zinc-200 pl-3 pr-1 py-1 text-xs shadow-sm">
                    <button type="button" onClick={() => fillFromHistory(s)} className="text-zinc-600 hover:text-zinc-900">
                      {s.business_type} · {s.location} · {Number(s.radius) >= 1000 ? `${Number(s.radius)/1000}km` : `${s.radius}m`}
                      <span className="text-zinc-400 ml-1.5">{relativeTime(s.timestamp)}</span>
                    </button>
                    <button type="button" onClick={() => removeHistory(s.id)}
                      className="ml-2 mr-0.5 text-zinc-300 hover:text-zinc-500 text-base leading-none">×</button>
                  </div>
                ))}
              </div>
            )}

            {searching && (
              <p className="text-sm text-zinc-500">This usually takes {searchDuration}…</p>
            )}

            {searchError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{searchError}</div>
            )}

            {searchResult && searchResult.count === 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
                All businesses from this search are already in your sheet.
              </div>
            )}

            {searchResult && searchResult.count > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500">
                    {searchResult.count} new lead{searchResult.count !== 1 ? 's' : ''} added to your sheet.
                  </p>
                  <button onClick={() => exportCSV(filteredSearch)}
                    className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-2">
                    Export CSV
                  </button>
                </div>
                <FiltersBar
                  minRating={filterRating} setMinRating={setFilterRating}
                  operationalOnly={filterOperational} setOperationalOnly={setFilterOperational}
                  priceLevels={filterPriceLevels} setPriceLevels={setFilterPriceLevels}
                  total={searchResult.leads.length} filtered={filteredSearch.length}
                />
                {filteredSearch.length === 0
                  ? <p className="text-sm text-zinc-400 text-center py-8">No results match the current filters.</p>
                  : <LeadsTable leads={filteredSearch} />}
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
                    ? <p className="mt-1 text-xs text-zinc-400">Active: <span className="font-mono">{sheetId}</span></p>
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
                <div className="flex items-center gap-3 flex-wrap">
                  {allLeads && allLeads.length > 0 && (
                    <button onClick={() => exportCSV(filteredSheet)}
                      className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-2">
                      Export CSV
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      setEnriching(true);
                      setEnrichMsg('');
                      try {
                        const res = await fetch('/api/enrich-dm', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ only_missing: true, sheet_id: activeSheetId }),
                        });
                        const data = await res.json();
                        if (res.status === 202) {
                          const total = data.total ?? 0;
                          const mins = Math.ceil(total * 15 / 60);
                          const timeStr = mins <= 5 ? 'a few minutes' : `~${mins} minutes`;
                          setEnrichMsg(`Enriching ${total} leads in background. Refresh table in ${timeStr}.`);
                        } else if (res.status === 409) {
                          setEnrichMsg('Enrichment is already running. Check back in a few minutes.');
                        } else if (res.status === 429) {
                          setEnrichMsg('Enrichment was triggered recently. Try again in a few minutes.');
                        } else if (res.status === 200 && data.status === 'ok') {
                          setEnrichMsg('Nothing to enrich — all leads already have decision maker data.');
                        } else {
                          setEnrichMsg(`Error: ${data.error ?? 'Unknown error'}`);
                        }
                      } catch {
                        setEnrichMsg('Failed to start enrichment.');
                      } finally {
                        setEnriching(false);
                      }
                    }}
                    disabled={enriching || allLeads === null || allLeads.length === 0}
                    className="px-3 py-1.5 text-sm rounded-md bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {enriching ? 'Starting…' : 'Find Decision Makers'}
                  </button>
                  <button onClick={handleLoadLeads} disabled={loadingLeads}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                    {loadingLeads && (
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    )}
                    {loadingLeads ? 'Loading…' : allLeads !== null ? 'Refresh' : 'Load leads'}
                  </button>
                </div>
              </div>
              {enrichMsg && <p className="mb-3 text-sm text-zinc-500">{enrichMsg}</p>}
              <p className="mb-3 text-xs text-zinc-400">AI enrichment powered by OpenAI · <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">View usage</a></p>

              {leadsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{leadsError}</div>
              )}

              {allLeads === null && !loadingLeads && (
                <p className="text-sm text-zinc-400">Click &quot;Load leads&quot; to view all leads in your sheet.</p>
              )}
              {allLeads !== null && allLeads.length === 0 && (
                <p className="text-sm text-zinc-400">No leads in the sheet yet.</p>
              )}
              {allLeads !== null && allLeads.length > 0 && (
                <div className="space-y-3">
                  <FiltersBar
                    minRating={filterRating} setMinRating={setFilterRating}
                    operationalOnly={filterOperational} setOperationalOnly={setFilterOperational}
                    priceLevels={filterPriceLevels} setPriceLevels={setFilterPriceLevels}
                    total={allLeads.length} filtered={filteredSheet.length}
                  />
                  {filteredSheet.length === 0
                    ? <p className="text-sm text-zinc-400 text-center py-8">No results match the current filters.</p>
                    : <LeadsTable leads={filteredSheet} />}
                </div>
              )}
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
