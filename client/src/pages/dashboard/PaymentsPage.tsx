import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const PaymentsPage: React.FC = () => {
  const { merchant } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  // Refund Modal state
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('Customer request');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const url = statusFilter ? `/payments?status=${statusFilter}` : '/payments';
      const res = await api.get(url);
      setPayments(res.data.data.items || []);
    } catch (err) {
      console.error('Failed to fetch payments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const formatCurrency = (minorUnitsStr = '0') => {
    const val = Number(minorUnitsStr) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: merchant?.currency || 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const openRefundModal = (payment: any) => {
    setSelectedPayment(payment);
    const availablePaise = Number(payment.capturedAmount) - Number(payment.refundedAmount);
    setRefundAmount(availablePaise / 100);
    setRefundError(null);
    setRefundSuccess(false);
    setRefundModalOpen(true);
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    setRefundLoading(true);
    setRefundError(null);

    const amountInPaise = Math.round(refundAmount * 100);

    try {
      await api.post(`/payments/${selectedPayment.id}/refunds`, {
        amount: amountInPaise,
        reason: refundReason,
      });

      setRefundSuccess(true);
      setTimeout(() => {
        setRefundModalOpen(false);
        fetchPayments();
      }, 1500);
    } catch (err: any) {
      setRefundError(err.response?.data?.error?.message || 'Refund failed to execute');
    } finally {
      setRefundLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            <CheckCircle2 className="h-3 w-3" />
            Succeeded
          </span>
        );
      case 'PARTIALLY_REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60">
            Partially Refunded
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-400 border border-purple-800/60">
            Refunded
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-400 border border-rose-800/60">
            <AlertTriangle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950/60 text-sky-400 border border-sky-800/60">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Payments & Transactions</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time ledger entries, multi-attempt tracking, and refund operations.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="">All Statuses</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="PROCESSING">Processing</option>
              <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
              <option value="REFUNDED">Refunded</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900/40">
              <tr>
                <th className="py-3 px-4 font-semibold">Intent ID</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Attempts</th>
                <th className="py-3 px-4 font-semibold">Refunded</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-sky-400" />
                    <span>Loading transactions from PostgreSQL...</span>
                  </td>
                </tr>
              ) : payments.length > 0 ? (
                payments.map((p) => {
                  const isRefundable =
                    (p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED') &&
                    Number(p.capturedAmount) > Number(p.refundedAmount);

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono text-xs text-sky-400">{p.id}</td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                        {p.attemptsCount} attempt(s)
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">
                        {Number(p.refundedAmount) > 0 ? formatCurrency(p.refundedAmount) : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isRefundable && (
                          <button
                            onClick={() => openRefundModal(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Refund</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No transactions found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {refundModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setRefundModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-white">Process Refund</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Intent ID: <span className="font-mono text-slate-300">{selectedPayment.id.slice(0, 12)}...</span>
            </p>

            {refundSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-white">Refund Successfully Recorded!</p>
                <p className="text-xs text-slate-400">Transaction journal has been updated with reversal entry.</p>
              </div>
            ) : (
              <form onSubmit={handleRefundSubmit} className="space-y-4">
                {refundError && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{refundError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Refund Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(Number(selectedPayment.capturedAmount) - Number(selectedPayment.refundedAmount)) / 100}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Available to refund: ₹
                    {((Number(selectedPayment.capturedAmount) - Number(selectedPayment.refundedAmount)) / 100).toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRefundModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={refundLoading || refundAmount <= 0}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                  >
                    {refundLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    <span>Confirm Refund</span>
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
