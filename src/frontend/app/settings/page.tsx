'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Save } from 'lucide-react';

type Tenant = { id: string; name: string; legal_name?: string; tax_number?: string; vat_id?: string; address?: string; fiscal_year_start_month?: number };

export default function SettingsPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';

  function headers() {
    const apiKey = localStorage.getItem('apiKey') || process.env.NEXT_PUBLIC_API_KEY || 'lanista-secret-key-2024';
    const h: Record<string, string> = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) h['x-tenant-id'] = tenantId;
    return h;
  }

  useEffect(() => {
    if (!localStorage.getItem('apiKey')) { router.push('/login'); return; }
    fetch(`${apiUrl}/api/accounting/tenants`, { headers: headers() })
      .then(r=>r.json())
      .then(d=>setTenant(d.tenants?.[0]?.tenant || null))
      .catch(()=>setError('Firmendaten konnten nicht geladen werden'));
  }, [router]);

  async function save() {
    if (!tenant) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const res = await fetch(`${apiUrl}/api/accounting/tenants/current`, { method: 'PATCH', headers: headers(), body: JSON.stringify(tenant) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen');
      setTenant(data.tenant);
      setMessage('Firmendaten gespeichert.');
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  if (!tenant) return <div className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,_#dff7ea,_transparent_30%),radial-gradient(circle_at_88%_12%,_#f8e8b9,_transparent_26%),linear-gradient(180deg,#fbfaf5_0%,#eef5ef_100%)] p-8">Lade Firmendaten...</div>;

  return <div className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,_#dff7ea,_transparent_30%),radial-gradient(circle_at_88%_12%,_#f8e8b9,_transparent_26%),linear-gradient(180deg,#fbfaf5_0%,#eef5ef_100%)]">
    <header className="bg-[#fbfaf5]/82 backdrop-blur-xl border-b border-emerald-900/10 shadow-sm"><div className="max-w-4xl mx-auto px-6 py-4">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4" /> Zurück</Link>
      <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2"><Building2 className="w-6 h-6" /> Firmendaten</h1>
      <p className="text-sm text-slate-500">Nur die Daten, die Steuerberater und Export später brauchen.</p>
    </div></header>
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-4xl mx-auto px-6 py-8">
      <section className="bg-white/85 rounded-2xl border border-white/80 shadow-sm p-6 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
        {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">{message}</div>}
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">Kurzname<input value={tenant.name || ''} onChange={e=>setTenant({...tenant, name:e.target.value})} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">Rechtlicher Firmenname<input value={tenant.legal_name || ''} onChange={e=>setTenant({...tenant, legal_name:e.target.value})} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">Steuernummer<input value={tenant.tax_number || ''} onChange={e=>setTenant({...tenant, tax_number:e.target.value})} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">USt-ID<input value={tenant.vat_id || ''} onChange={e=>setTenant({...tenant, vat_id:e.target.value})} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Adresse<textarea value={tenant.address || ''} onChange={e=>setTenant({...tenant, address:e.target.value})} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" rows={3} /></label>
          <label className="text-sm font-medium text-slate-700">Wirtschaftsjahr startet im Monat<input type="number" min="1" max="12" value={tenant.fiscal_year_start_month || 1} onChange={e=>setTenant({...tenant, fiscal_year_start_month:Number(e.target.value)})} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" /></label>
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-lg px-4 py-2 font-medium"><Save className="w-4 h-4" /> {saving ? 'Speichert...' : 'Speichern'}</button>
      </section>
    </motion.main>
  </div>;
}
