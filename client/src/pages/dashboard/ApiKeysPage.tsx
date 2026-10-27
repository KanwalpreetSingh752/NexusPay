import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Loader2,
  X,
} from 'lucide-react';
import { api } from '../../api/client';

export const ApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Key Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('Production Test API Key');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api-keys');
      setKeys(res.data.data || []);
    } catch (err) {
      console.error('Failed to load API keys', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);

    try {
      const res = await api.post('/api-keys', { name: keyName });
      setCreatedSecret(res.data.data.secret);
      fetchKeys();
    } catch (err) {
      console.error('Failed to generate key', err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This action is permanent.')) {
      return;
    }

    try {
      await api.delete(`/api-keys/${id}`);
      fetchKeys();
    } catch (err) {
      console.error('Failed to revoke API key', err);
    }
  };

  const copySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">API Key Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Authenticate merchant server-to-server requests using cryptographically random keys.
          </p>
        </div>
        <button
          onClick={() => {
            setKeyName('Development Test Key');
            setCreatedSecret(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Generate New Key</span>
        </button>
      </div>

      {/* Security Info Card */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200 text-xs flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
        <span>
          Keys are stored as SHA-256 hashes in PostgreSQL. NexusPay never stores your plaintext API secrets.
          Authenticate requests by providing the header <code className="font-mono bg-amber-950/60 px-1 py-0.5 rounded text-amber-300">Authorization: Bearer npay_test_...</code>.
        </span>
      </div>

      {/* Keys Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900/40">
              <tr>
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Prefix</th>
                <th className="py-3 px-4 font-semibold">Environment</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Created</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-sky-400" />
                    <span>Loading API keys...</span>
                  </td>
                </tr>
              ) : keys.length > 0 ? (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-medium text-white">{k.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-sky-400">{k.keyPrefix}...</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {k.environment}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {k.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/60 text-rose-400 border border-rose-800/60">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {k.isActive && (
                        <button
                          onClick={() => handleRevoke(k.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Revoke key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No API keys generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-white">Generate Test API Key</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              This secret will be displayed once. Copy and store it securely.
            </p>

            {createdSecret ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-400 break-all select-all mr-2">
                    {createdSecret}
                  </span>
                  <button
                    onClick={copySecret}
                    className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                  >
                    I Have Saved It
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Key Identifier Name
                  </label>
                  <input
                    type="text"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                  >
                    {createLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Generate Key</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
