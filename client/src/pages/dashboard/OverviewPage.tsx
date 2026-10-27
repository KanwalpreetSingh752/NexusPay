import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export const OverviewPage: React.FC = () => {
  const { merchant } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [overviewRes, trendsRes, paymentsRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/trends?days=14'),
        api.get('/payments?limit=5'),
      ]);

      setOverview(overviewRes.data.data);
      setTrends(trendsRes.data.data);
      setRecentPayments(paymentsRes.data.data.items || []);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (minorUnitsStr = '0') => {
    const val = Number(minorUnitsStr) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: merchant?.currency || 'INR',
      maximumFractionDigits: 2,
    }).format(val);
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
    <div className="space-y-8">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Financial Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Live metrics from your PostgreSQL transaction journal</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Gross Volume */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Volume</span>
            <TrendingUp className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(overview?.grossVolume)}
          </div>
          <p className="text-xs text-slate-500 mt-2">Cumulative captured payments</p>
        </div>

        {/* Net Volume */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Volume</span>
            <CreditCard className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {formatCurrency(overview?.netVolume)}
          </div>
          <p className="text-xs text-slate-500 mt-2">After refunds deducted</p>
        </div>

        {/* Success Rate */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Intent Success Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {overview?.successRate || 0}%
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {overview?.successfulIntents || 0} of {overview?.totalIntents || 0} intents settled
          </p>
        </div>

        {/* Total Attempts */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Conversion Rate</span>
            <ArrowUpRight className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 tracking-tight">
            {overview?.conversionRate || 0}%
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {overview?.successfulAttempts || 0} successful of {overview?.totalAttempts || 0} attempts
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Transaction Volume Trend</h2>
            <p className="text-xs text-slate-400 mt-0.5">Daily captured revenue across the last 14 days</p>
          </div>
          <div className="text-xs font-medium px-2.5 py-1 rounded bg-slate-800 text-slate-300">
            Last 14 Days
          </div>
        </div>

        <div className="h-64 w-full">
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  stroke="#475569"
                  fontSize={11}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis
                  tickLine={false}
                  stroke="#475569"
                  fontSize={11}
                  tickFormatter={(val) => `₹${val / 100}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                  formatter={(value: any) => [`₹${(Number(value) / 100).toFixed(2)}`, 'Volume']}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#volGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              No trend data available yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Payments Table */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Recent Transactions</h2>
            <p className="text-xs text-slate-400 mt-0.5">Latest entries recorded in PostgreSQL</p>
          </div>
          <Link
            to="/payments"
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900/40">
              <tr>
                <th className="py-3 px-4 font-semibold">Payment Intent ID</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentPayments.length > 0 ? (
                recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono text-xs text-slate-300">{p.id.slice(0, 8)}...</td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                    <td className="py-3 px-4 text-xs text-slate-400">{p.description || '—'}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    No transactions yet. Run the <Link to="/checkout-demo" className="text-sky-400 hover:underline">Checkout Demo</Link> to create your first payment!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
