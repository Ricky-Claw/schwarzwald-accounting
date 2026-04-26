'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Save, Trash2 } from 'lucide-react';

type Rule = {
  id: string;
  merchant_pattern?: string | null;
  keyword_pattern?: string | null;
  purpose_pattern?: string | null;
  category_name: string;
  skr04_code: string;
  vat_rate: number;
  needs_review: boolean;
  active: boolean;
  usage_count: number;
};

const CATEGORIES = [
  ['Büromaterial', '4400'],
  ['IT & Hardware', '0440'],
  ['Software & Lizenzen', '0460'],
  ['Telefon & Internet', '6800'],
  ['Reisekosten', '4600'],
  ['Fahrzeug - Sprit', '6610'],
  ['Werbung & Marketing', '6900'],
  ['Bewirtung & Geschenke', '6900'],
  ['Arbeitskleidung', '4980'],
  ['Sonstige Betriebsausgaben', '4900'],
];

export default function RulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ merchant_pattern: '', purpose_pattern: '', keyword_pattern: '', category_name: 'Büromaterial', skr04_code: '4400', needs_review: false });
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';

  function headers() {
    const apiKey = localStorage.getItem('apiKey') || process.env.NEXT_PUBLIC_API_KEY || 'lanista-secret-key-2024';
    const h: Record<string, string> = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) h['x-tenant-id'] = tenantId;
    return h;
  }

  async function load() {
    try {
      const res = await fetch(`${apiUrl}/api/accounting/rules`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Regeln konnten nicht geladen werden');
      setRules(data.rules || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('apiKey')) {
      router.push('/login');
      return;
    }
    load();
  }, [router]);

  async function createRule() {
    setSaving(true); setError('');
    try {
      const res = await fetch(`${apiUrl}/api/accounting/rules`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ ...form, vat_rate: 19 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Regel konnte nicht gespeichert werden');
      setForm({ merchant_pattern: '', purpose_pattern: '', keyword_pattern: '', category_name: 'Büromaterial', skr04_code: '4400', needs_review: false });
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function disableRule(id: string) {
    if (!confirm('Regel deaktivieren?')) return;
    await fetch(`${apiUrl}/api/accounting/rules/${id}`, { method: 'DELETE', headers: headers() });
    await load();
  }

  function pickCategory(value: string) {
    const [name, code] = value.split('|');
    setForm((f) => ({ ...f, category_name: name, skr04_code: code }));
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-8">Lade Regeln...</div>;

  return <div className="min-h-screen bg-slate-50">
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-6 py-4">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4" /> Zurück</Link>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2"><BookOpen className="w-6 h-6" /> Gelernte Regeln</h1>
        <p className="text-sm text-slate-500">Schlichte Buchungsregeln. Kein Zauber, nur Muster → Kategorie.</p>
      </div>
    </header>
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Neue Regel</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <input value={form.merchant_pattern} onChange={e=>setForm({...form, merchant_pattern:e.target.value})} placeholder="Händler enthält z.B. Amazon" className="border border-slate-300 rounded-lg px-3 py-2" />
          <input value={form.purpose_pattern} onChange={e=>setForm({...form, purpose_pattern:e.target.value})} placeholder="Zweck enthält z.B. Büro" className="border border-slate-300 rounded-lg px-3 py-2" />
          <input value={form.keyword_pattern} onChange={e=>setForm({...form, keyword_pattern:e.target.value})} placeholder="OCR/Text enthält" className="border border-slate-300 rounded-lg px-3 py-2" />
          <select value={`${form.category_name}|${form.skr04_code}`} onChange={e=>pickCategory(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 md:col-span-2">
            {CATEGORIES.map(([name, code]) => <option key={`${name}-${code}`} value={`${name}|${code}`}>{name} · SKR04 {code}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.needs_review} onChange={e=>setForm({...form, needs_review:e.target.checked})} /> immer prüfen</label>
        </div>
        <button onClick={createRule} disabled={saving || (!form.merchant_pattern && !form.purpose_pattern && !form.keyword_pattern)} className="mt-4 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg px-4 py-2 font-medium"><Save className="w-4 h-4" /> {saving ? 'Speichert...' : 'Regel speichern'}</button>
      </section>
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Aktive Regeln</h2>
        <div className="divide-y divide-slate-100">
          {rules.filter(r=>r.active).length === 0 && <p className="text-sm text-slate-500">Noch keine Regeln.</p>}
          {rules.filter(r=>r.active).map(rule => <div key={rule.id} className="py-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-slate-900">{rule.category_name} · SKR04 {rule.skr04_code}</div>
              <div className="text-sm text-slate-500">{[rule.merchant_pattern && `Händler: ${rule.merchant_pattern}`, rule.purpose_pattern && `Zweck: ${rule.purpose_pattern}`, rule.keyword_pattern && `Text: ${rule.keyword_pattern}`].filter(Boolean).join(' · ')}</div>
              <div className="text-xs text-slate-400">{rule.usage_count || 0}x genutzt{rule.needs_review ? ' · immer prüfen' : ''}</div>
            </div>
            <button aria-label="Regel deaktivieren" onClick={()=>disableRule(rule.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </div>)}
        </div>
      </section>
    </main>
  </div>;
}
