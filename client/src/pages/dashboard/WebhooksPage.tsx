import React, { useEffect, useState } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../api/client';

export const WebhooksPage: React.FC = () => {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Endpoint Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [url, setUrl] = useState('https://webhook.site/test-endpoint');
  const [registeredSecret, setRegisteredSecret] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  // Deliveries state for selected endpoint
  const [selectedEndpoint, setSelectedEndpoint] = useState<any | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const res = await api.get('/webhooks/merchant');
      setEndpoints(res.data.data || []);
    } catch (err) {
      console.error('Failed to load webhook endpoints', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);

    try {
      const res = await api.post('/webhooks/merchant', {
        url,
        subscribedEvents: ['payment.succeeded', 'refund.succeeded', 'refund.partial'],
      });
      setRegisteredSecret(res.data.data.secret);
      fetchEndpoints();
    } catch (err) {
      console.error('Failed to register endpoint', err);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this webhook endpoint?')) return;
    try {
      await api.delete(`/webhooks/merchant/${id}`);
      fetchEndpoints();
      if (selectedEndpoint?.id === id) {
        setSelectedEndpoint(null);
      }
    } catch (err) {
      console.error('Failed to delete endpoint', err);
    }
  };

  const viewDeliveries = async (ep: any) => {
    setSelectedEndpoint(ep);
    setDeliveriesLoading(true);
    try {
      const res = await api.get(`/webhooks/merchant/${ep.id}/deliveries`);
      setDeliveries(res.data.data || []);
    } catch (err) {
      console.error('Failed to load deliveries', err);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Transactional Webhooks</h1>
          <p className="text-sm text-slate-400 mt-1">
            Durable event relay backed by PostgreSQL Transactional Outbox and exponential backoff retry.
          </p>
        </div>
        <button
          onClick={() => {
            setRegisteredSecret(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Webhook Endpoint</span>
        </button>
      </div>

      {/* Endpoints Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900/40">
              <tr>
                <th className="py-3 px-4 font-semibold">Destination URL</th>
                <th className="py-3 px-4 font-semibold">Subscribed Events</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Total Deliveries</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-sky-400" />
                    <span>Loading endpoints...</span>
                  </td>
                </tr>
              ) : endpoints.length > 0 ? (
                endpoints.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono text-xs text-slate-200">{ep.url}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {ep.subscribedEvents.map((evt: string) => (
                          <span
                            key={evt}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-sky-300 border border-slate-700"
                          >
                            {evt}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {ep.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">
                      {ep.deliveryCount} attempts
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => viewDeliveries(ep)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-sky-400 font-medium transition"
                      >
                        Delivery Log
                      </button>
                      <button
                        onClick={() => handleDelete(ep.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    No webhook destinations registered yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deliveries Drawer / Section */}
      {selectedEndpoint && (
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">
                Delivery Attempt Log: <span className="font-mono text-sky-400">{selectedEndpoint.url}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Dispatched by Transactional Outbox Relay</p>
            </div>
            <button
              onClick={() => setSelectedEndpoint(null)}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900/40">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Event Type</th>
                  <th className="py-2.5 px-3 font-semibold">Attempt</th>
                  <th className="py-2.5 px-3 font-semibold">Status Code</th>
                  <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {deliveriesLoading ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                      Loading deliveries...
                    </td>
                  </tr>
                ) : deliveries.length > 0 ? (
                  deliveries.map((d) => (
                    <tr key={d.id} className="text-xs">
                      <td className="py-2.5 px-3 font-mono text-sky-300">{d.event.eventType}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">#{d.attemptNumber}</td>
                      <td className="py-2.5 px-3">
                        {d.httpStatusCode && d.httpStatusCode >= 200 && d.httpStatusCode < 300 ? (
                          <span className="font-mono text-emerald-400 font-semibold">{d.httpStatusCode} OK</span>
                        ) : (
                          <span className="font-mono text-rose-400 font-semibold">{d.httpStatusCode || 'Error'}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {new Date(d.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                      No webhook deliveries dispatched to this endpoint yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

            <h3 className="text-lg font-bold text-white">Register Webhook Endpoint</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Enter your HTTPS endpoint to receive cryptographically signed events.
            </p>

            {registeredSecret ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-xs text-emerald-300">
                  <p className="font-bold mb-1">Webhook Endpoint Registered!</p>
                  <p className="text-slate-300 mb-2">Signing Secret (use to verify X-NexusPay-Signature):</p>
                  <div className="p-2 rounded bg-slate-950 font-mono text-emerald-400 select-all break-all">
                    {registeredSecret}
                  </div>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500 font-mono text-xs"
                    placeholder="https://myserver.com/api/nexuspay-webhook"
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
                    disabled={registerLoading}
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                  >
                    {registerLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Register Endpoint</span>
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
