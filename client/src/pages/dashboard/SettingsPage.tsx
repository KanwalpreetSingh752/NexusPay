import React, { useEffect, useState } from 'react';
import { Building2, ShieldCheck, Database, Server, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { merchant } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [profileRes, healthRes] = await Promise.all([
        api.get('/merchants/me'),
        api.get('/health/ready', { baseURL: '' }), // hitting top level /health/ready
      ]);
      setProfile(profileRes.data.data);
      setHealth(healthRes.data);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Organization & Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Merchant tenant boundaries and infrastructure health checks.
        </p>
      </div>

      {/* Merchant Profile */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Building2 className="h-4 w-4 text-sky-400" />
          <span>Merchant Profile</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-500 block mb-1">Organization Name</span>
            <span className="font-semibold text-slate-200">{profile?.businessName || merchant?.businessName}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-500 block mb-1">Tenant ID (UUID)</span>
            <span className="font-mono text-xs text-sky-400">{profile?.id || merchant?.id}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-500 block mb-1">Primary Email</span>
            <span className="font-medium text-slate-200">{profile?.email || merchant?.email}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-500 block mb-1">Settlement Currency</span>
            <span className="font-medium text-slate-200">{profile?.currency || 'INR'} (Paise minor units)</span>
          </div>
        </div>
      </div>

      {/* Infrastructure Readiness */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-400" />
            <span>Infrastructure Health Monitor</span>
          </h3>
          <button
            onClick={fetchSettings}
            className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Check Status</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-sky-400" />
              <div>
                <span className="font-medium text-slate-200 block">PostgreSQL 15+</span>
                <span className="text-xs text-slate-500">Source of Truth & Journal</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
              {health?.dependencies?.database || 'healthy'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              <div>
                <span className="font-medium text-slate-200 block">Redis 7+</span>
                <span className="text-xs text-slate-500">Sliding Window Rate Limiter</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
              {health?.dependencies?.redis || 'healthy'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
