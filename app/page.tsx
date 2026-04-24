'use client';

import { useState } from 'react';

interface Lead {
  place_id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  found_at: string;
}

interface ApiResponse {
  leads: Lead[];
  count: number;
}

export default function Home() {
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/find-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_type: businessType, location, radius: Number(radius) }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data: ApiResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900">Lead Finder</h1>
          <p className="mt-1 text-zinc-500">Find local businesses and export them to Google Sheets.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="businessType" className="block text-sm font-medium text-zinc-700 mb-1">
                Business type
              </label>
              <input
                id="businessType"
                type="text"
                required
                placeholder="e.g. restaurant, gym, school"
                value={businessType}
                onChange={e => setBusinessType(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-zinc-700 mb-1">
                Location
              </label>
              <input
                id="location"
                type="text"
                required
                placeholder="e.g. Austin, TX"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label htmlFor="radius" className="block text-sm font-medium text-zinc-700 mb-1">
                Radius
              </label>
              <select
                id="radius"
                value={radius}
                onChange={e => setRadius(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="500">500 m</option>
                <option value="1000">1 km</option>
                <option value="2000">2 km</option>
                <option value="5000">5 km</option>
                <option value="10000">10 km</option>
              </select>
            </div>
          </div>

          <div className="mt-5">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? 'Searching…' : 'Find leads'}
            </button>
          </div>
        </form>

        {loading && (
          <p className="mt-4 text-sm text-zinc-500">This usually takes 20–30 seconds…</p>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && result.count === 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
            All businesses from this search are already in your sheet.
          </div>
        )}

        {result && result.count > 0 && (
          <div className="mt-6">
            <p className="text-sm text-zinc-500 mb-3">
              {result.count} new lead{result.count !== 1 ? 's' : ''} added to your sheet.
            </p>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Address</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Phone</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Website</th>
                  </tr>
                </thead>
                <tbody>
                  {result.leads.map((lead, i) => (
                    <tr key={lead.place_id} className={i % 2 === 0 ? '' : 'bg-zinc-50'}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{lead.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{lead.address}</td>
                      <td className="px-4 py-3 text-zinc-600">{lead.phone || '—'}</td>
                      <td className="px-4 py-3">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate block max-w-[200px]"
                          >
                            {lead.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
