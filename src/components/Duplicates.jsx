import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Users, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getDuplicates, mergeDonors } from '../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-MY');

const REASON_STYLE = {
  'Same phone': 'bg-blue-100 text-blue-700',
  'Same email': 'bg-violet-100 text-violet-700',
  'Same name':  'bg-amber-100 text-amber-700',
};

function DonorCard({ donor, label, onKeep, merging }) {
  return (
    <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <Link to={`/customer/${donor.id}`} className="flex items-center gap-3 hover:opacity-80">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold uppercase text-blue-700">
          {(donor.full_name || 'U').charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{donor.full_name || '—'}</p>
          <p className="text-xs text-slate-400 truncate">{donor.email || 'No email'}</p>
        </div>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div><span className="font-semibold text-slate-700">Phone:</span> {donor.phone || '—'}</div>
        <div><span className="font-semibold text-slate-700">Donations:</span> {fmt(donor.donation_count)}</div>
        <div className="col-span-2 text-slate-400">
          ID: <span className="font-mono">{donor.id?.slice(0, 8)}…</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onKeep}
        disabled={merging}
        className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {merging ? 'Merging…' : `Keep ${label} · Delete other`}
      </button>
    </div>
  );
}

export default function Duplicates() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(null);
  const [merged, setMerged] = useState(0);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getDuplicates().then(setPairs).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMerge = async (keepId, deleteId, pairKey) => {
    setMerging(pairKey);
    setError('');
    try {
      await mergeDonors({ keep_id: keepId, delete_id: deleteId });
      setPairs((prev) =>
        prev.filter((p) => p.donor_a.id !== deleteId && p.donor_b.id !== deleteId &&
                           p.donor_a.id !== keepId   && p.donor_b.id !== keepId)
      );
      setMerged((n) => n + 1);
    } catch (e) {
      setError(e.response?.data?.error || 'Merge failed. Please try again.');
    } finally {
      setMerging(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {loading ? 'Scanning…' : `${pairs.length} potential duplicate pair${pairs.length !== 1 ? 's' : ''} found`}
            </p>
            <p className="text-xs text-slate-500">Matches by same phone, email or name.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {merged > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {merged} merged this session
            </div>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-400 shadow-sm ring-1 ring-slate-200">
          Scanning donors for duplicates…
        </div>
      ) : pairs.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <Users className="mx-auto h-10 w-10 text-emerald-400 mb-3" />
          <p className="font-semibold text-slate-700">No duplicates detected</p>
          <p className="mt-1 text-sm text-slate-400">All donors appear to be unique.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pairs.map((pair, i) => {
            const pairKey = `${pair.donor_a.id}:${pair.donor_b.id}`;
            const isMerging = merging === pairKey;
            return (
              <div key={pairKey} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${REASON_STYLE[pair.reason] || 'bg-slate-100 text-slate-600'}`}>
                    {pair.reason}
                  </span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <DonorCard
                    donor={pair.donor_a}
                    label="Donor A"
                    merging={isMerging}
                    onKeep={() => handleMerge(pair.donor_a.id, pair.donor_b.id, pairKey)}
                  />
                  <div className="flex items-center justify-center text-slate-300 text-xl font-bold sm:flex-col">
                    vs
                  </div>
                  <DonorCard
                    donor={pair.donor_b}
                    label="Donor B"
                    merging={isMerging}
                    onKeep={() => handleMerge(pair.donor_b.id, pair.donor_a.id, pairKey)}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Keeping a donor will reassign all donations from the deleted record to the kept record. This cannot be undone.
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
