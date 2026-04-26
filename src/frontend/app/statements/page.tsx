'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Calendar, CheckCircle, FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react';
import { GlowCard } from '@/components/ui/spotlight-card';

type Statement = {
  id: string;
  account_name?: string;
  account_iban?: string;
  statement_date?: string;
  file_path?: string;
  file_type?: string;
  status: 'pending' | 'processed' | 'error';
  transaction_count?: number;
  total_amount?: number;
  created_at?: string;
};

export default function StatementsPage() {
  const router = useRouter();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';

  function headers() {
    const apiKey = localStorage.getItem('apiKey') || process.env.NEXT_PUBLIC_API_KEY || 'lanista-secret-key-2024';
    const h: Record<string, string> = { 'x-api-key': apiKey };
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) h['x-tenant-id'] = tenantId;
    return h;
  }

  async function loadStatements() {
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/accounting/statements`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kontoauszüge konnten nicht geladen werden');
      setStatements(data.statements || []);
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
    loadStatements();
  }, [router]);

  async function remove(id: string) {
    if (!confirm('Kontoauszug wirklich löschen?')) return;
    await fetch(`${apiUrl}/api/accounting/statements/${id}`, { method: 'DELETE', headers: headers() });
    await loadStatements();
  }

  const totalTransactions = statements.reduce((sum, s) => sum + (s.transaction_count || 0), 0);
  const processed = statements.filter(s => s.status === 'processed').length;

  if (loading) {
    return <div className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,_#dff7ea,_transparent_30%),radial-gradient(circle_at_88%_12%,_#f8e8b9,_transparent_26%),linear-gradient(180deg,#fbfaf5_0%,#eef5ef_100%)] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-700" /></div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,_#dff7ea,_transparent_30%),radial-gradient(circle_at_88%_12%,_#f8e8b9,_transparent_26%),linear-gradient(180deg,#fbfaf5_0%,#eef5ef_100%)]">
      <header className="sticky top-0 z-20 bg-[#fbfaf5]/82 backdrop-blur-xl border-b border-emerald-900/10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-700" /> Kontoauszüge</h1>
              <p className="text-sm text-slate-500">Ordner für importierte Auszüge und deren Buchungen.</p>
            </div>
            <Link href="/upload" className="hidden sm:inline-flex items-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition-colors">
              <Upload className="w-4 h-4" /> Auszug hochladen
            </Link>
          </div>
        </div>
      </header>

      <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl">{error}</div>}

        <section className="grid md:grid-cols-3 gap-4">
          <InfoCard icon={<FileSpreadsheet className="w-5 h-5" />} label="Auszüge" value={statements.length} />
          <InfoCard icon={<CheckCircle className="w-5 h-5" />} label="Verarbeitet" value={processed} tone="green" />
          <InfoCard icon={<Building2 className="w-5 h-5" />} label="Buchungen" value={totalTransactions} tone="gold" />
        </section>

        <section className="bg-white/85 rounded-3xl border border-white/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-950">Alle Kontoauszüge</h2>
              <p className="text-sm text-slate-500">Hier bleibt der Auszugs-Ordner getrennt von den Belegen.</p>
            </div>
          </div>

          <div className="space-y-3">
            {statements.length === 0 && (
              <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/50 p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-emerald-700 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-950">Noch keine Kontoauszüge</h3>
                <p className="text-sm text-slate-500 mt-1">Lade Kontoauszüge über den Upload hoch, dann erscheinen sie hier gesammelt.</p>
              </div>
            )}
            {statements.map((statement, index) => (
              <motion.div
                key={statement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ y: -2 }}
                className="rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white to-emerald-50/40 p-4 flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950 truncate">{statement.account_name || 'Kontoauszug'}</div>
                    <div className="text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {statement.statement_date && <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {statement.statement_date}</span>}
                      {statement.file_type && <span>{statement.file_type.toUpperCase()}</span>}
                      <span>{statement.transaction_count || 0} Buchungen</span>
                      <span className={statement.status === 'processed' ? 'text-emerald-700' : statement.status === 'error' ? 'text-red-600' : 'text-amber-700'}>{statement.status}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => remove(statement.id)} aria-label="Kontoauszug löschen" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      </motion.main>
    </div>
  );
}

function InfoCard({ icon, label, value, tone = 'default' }: { icon: React.ReactNode; label: string; value: number; tone?: 'default' | 'green' | 'gold' }) {
  const styles = {
    default: 'bg-white/85 border-white/80 text-slate-700',
    green: 'bg-emerald-50/90 border-emerald-200/80 text-emerald-800',
    gold: 'bg-amber-50/90 border-amber-200/80 text-amber-800',
  };
  return <GlowCard customSize glowColor={tone === 'gold' ? 'orange' : 'green'} className={`p-5 ${styles[tone]}`}><div className="relative z-10 flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-white/75 flex items-center justify-center">{icon}</div><div><div className="text-2xl font-semibold text-slate-950">{value}</div><div className="text-sm text-slate-500">{label}</div></div></div></GlowCard>;
}
