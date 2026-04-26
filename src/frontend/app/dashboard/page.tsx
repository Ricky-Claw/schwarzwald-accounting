'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Upload, Download, CheckCircle, AlertCircle, 
  Calendar, Receipt, TrendingUp, FileText,
  ChevronRight, LogOut, Trash2, Users, BookOpen, Building2, FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';

interface Receipt {
  id: string;
  merchant_name: string;
  receipt_date: string;
  total_amount: number;
  file_name_display: string;
  created_at: string;
  skr04_code: string;
}

interface TimeGroup {
  label: string;
  receipts: Receipt[];
}

interface MonthStatus {
  month: string;
  monthName: string;
  total: number;
  matched: number;
  missing: number;
  status: 'complete' | 'incomplete' | 'empty';
}

interface DashboardStats {
  totalReceipts: number;
  unmatchedReceipts: number;
  totalTransactions: number;
  matchedTransactions: number;
  missingReceipts: number;
  currentMonth: {
    month: string;
    status: 'complete' | 'incomplete';
    missing: number;
  };
}

export default function DashboardPage() {
  const [months, setMonths] = useState<MonthStatus[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentReceipts, setRecentReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
      router.push('/login');
      return;
    }
    fetchDashboard();
  }, [router]);

  async function fetchDashboard() {
    try {
      const apiKey = localStorage.getItem('apiKey') || process.env.NEXT_PUBLIC_API_KEY || 'lanista-secret-key-2024';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      const headers: Record<string, string> = { 'x-api-key': apiKey };
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId) headers['x-tenant-id'] = tenantId;
      
      const [monthsRes, statsRes, receiptsRes] = await Promise.all([
        fetch(`${apiUrl}/api/accounting/receipts/months/list`, { headers }),
        fetch(`${apiUrl}/api/accounting/receipts/dashboard/stats`, { headers }),
        fetch(`${apiUrl}/api/accounting/receipts?limit=50`, { headers }),
      ]);
      
      const monthsData = await monthsRes.json();
      const statsData = await statsRes.json();
      const receiptsData = await receiptsRes.json();
      
      setMonths(monthsData.months || []);
      setStats(statsData);
      setRecentReceipts(receiptsData.receipts || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-8 h-8 border-2 border-slate-300 border-t-emerald-600 rounded-full"
        />
      </div>
    );
  }

  const completionRate = stats 
    ? Math.round((stats.matchedTransactions / stats.totalTransactions) * 100) || 0
    : 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,_#dff7ea,_transparent_30%),radial-gradient(circle_at_88%_12%,_#f8e8b9,_transparent_26%),linear-gradient(180deg,#fbfaf5_0%,#eef5ef_100%)]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#fbfaf5]/82 backdrop-blur-xl border-b border-emerald-900/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/10">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-950 tracking-tight">Lanista Buchhaltung</h1>
                <p className="text-slate-500 text-sm">Belege prüfen, Regeln lernen, Export vorbereiten.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-emerald-700 bg-emerald-50/90 border border-emerald-100 px-4 py-2 rounded-full">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">System aktiv</span>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('apiKey');
                  router.push('/login');
                }}
                className="flex items-center gap-2 text-slate-500 hover:text-red-600 px-4 py-2 rounded-full hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-7xl mx-auto px-6 py-8">
        <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br from-emerald-950 via-emerald-800 to-[#7a5b12] p-8 text-white shadow-2xl shadow-emerald-950/15"
          >
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-300/20 blur-3xl" />
            <div className="absolute right-10 bottom-8 h-28 w-28 rounded-full border border-white/10" />
            <div className="relative z-10 max-w-2xl">
              <p className="text-sm font-medium text-emerald-100/85 mb-3">Aktueller Arbeitsstand</p>
              <h2 className="text-4xl font-semibold tracking-tight mb-3">{stats?.missingReceipts ? `${stats.missingReceipts} Belege fehlen noch` : 'Alles bereit für den Export'}</h2>
              <p className="text-emerald-50/80 leading-relaxed mb-7">Der schnellste Weg: fehlende Belege hochladen, Regeln prüfen, danach DATEV/CSV exportieren.</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/upload" className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-900 px-5 py-3 text-sm font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all">
                  <Upload className="w-4 h-4" /> Beleg hochladen
                </Link>
                <Link href="/export" className="inline-flex items-center gap-2 rounded-full bg-white/12 text-white border border-white/20 px-5 py-3 text-sm font-semibold hover:bg-white/18 transition-all">
                  <Download className="w-4 h-4" /> Export öffnen
                </Link>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={<Receipt className="w-5 h-5" />} label="Belege" value={stats?.totalReceipts || 0} />
            <StatCard icon={<FileText className="w-5 h-5" />} label="Buchungen" value={stats?.totalTransactions || 0} />
            <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Zugeordnet" value={stats?.matchedTransactions || 0} variant="success" />
            <StatCard icon={<AlertCircle className="w-5 h-5" />} label="Fehlend" value={stats?.missingReceipts || 0} variant={(stats?.missingReceipts || 0) > 0 ? 'warning' : 'default'} />
          </div>
        </section>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Arbeitsbereiche</h2>
              <p className="text-sm text-slate-500">Alles Nötige, in der Reihenfolge des Buchhaltungsflusses.</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              <TrendingUp className="w-4 h-4 text-emerald-700" /> {completionRate}% zugeordnet
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <ActionCard href="/upload" icon={<Upload className="w-5 h-5" />} title="Belege" text="OCR Upload" tone="emerald" index={0} />
            <ActionCard href="/statements" icon={<FileSpreadsheet className="w-5 h-5" />} title="Kontoauszüge" text="Auszugs-Ordner" tone="gold" index={1} />
            <ActionCard href="/rules" icon={<BookOpen className="w-5 h-5" />} title="Regeln" text="Merken & prüfen" tone="gold" index={2} />
            <ActionCard href="/export" icon={<Download className="w-5 h-5" />} title="Export" text="DATEV oder CSV" tone="slate" index={3} />
            <ActionCard href="/users" icon={<Users className="w-5 h-5" />} title="Benutzer" text="Steuerberater" tone="emerald" index={4} />
            <ActionCard href="/settings" icon={<Building2 className="w-5 h-5" />} title="Firma" text="Stammdaten" tone="gold" index={5} />
          </div>
        </section>

        {/* Time-based Recent Uploads */}
        <RecentUploadsSection />

        {/* Month Cards */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            Übersicht nach Monat
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {months.map((month, index) => (
              <MonthCard key={month.month} month={month} index={index} />
            ))}
          </div>
        </div>
      </motion.main>
    </div>
  );
}

function ActionCard({ href, icon, title, text, tone, index }: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: 'emerald' | 'gold' | 'slate';
  index: number;
}) {
  const tones = {
    emerald: 'from-emerald-50 to-white text-emerald-800 border-emerald-100 group-hover:border-emerald-200',
    gold: 'from-amber-50 to-white text-amber-800 border-amber-100 group-hover:border-amber-200',
    slate: 'from-slate-50 to-white text-slate-700 border-slate-100 group-hover:border-slate-200',
  };
  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        whileHover={{ y: -5, scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        className={`group h-full rounded-3xl bg-gradient-to-br ${tones[tone]} border p-5 shadow-sm hover:shadow-xl hover:shadow-emerald-950/5 transition-all cursor-pointer`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/80 shadow-inner flex items-center justify-center">
            {icon}
          </div>
          <ChevronRight className="w-4 h-4 opacity-35 group-hover:opacity-80 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div className="mt-5">
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{text}</p>
        </div>
      </motion.div>
    </Link>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  variant = 'default'
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  variant?: 'default' | 'success' | 'warning';
}) {
  const variantStyles = {
    default: 'bg-white/80 border-white/80',
    success: 'bg-emerald-50/90 border-emerald-200/80',
    warning: 'bg-amber-50/95 border-amber-200/90',
  };

  return (
    <div className={`rounded-3xl p-5 border shadow-sm hover:-translate-y-0.5 hover:shadow-lg transition-all ${variantStyles[variant]}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          variant === 'success' ? 'bg-emerald-100 text-emerald-700' :
          variant === 'warning' ? 'bg-amber-100 text-amber-700' :
          'bg-stone-100 text-stone-600'
        }`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
          <div className="text-sm text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function MonthCard({ month, index }: { month: MonthStatus; index: number }) {
  const progress = month.total > 0 ? (month.matched / month.total) * 100 : 0;
  const router = useRouter();

  const statusConfig = {
    complete: { bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-700' },
    incomplete: { bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500', text: 'text-amber-700' },
    empty: { bg: 'bg-slate-50', border: 'border-slate-200', bar: 'bg-slate-300', text: 'text-slate-500' },
  };

  const config = statusConfig[month.status];

  const handleClick = () => {
    router.push(`/dashboard/months/${month.month}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      whileHover={{ y: -3, scale: 1.01 }}
      className={`rounded-2xl p-5 border shadow-sm cursor-pointer hover:shadow-lg transition-all ${config.bg} ${config.border}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">{month.monthName}</h3>
          <p className="text-slate-500 text-sm">{month.total} Buchungen</p>
        </div>
        {month.status === 'complete' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
        {month.status === 'incomplete' && <AlertCircle className="w-5 h-5 text-amber-600" />}
      </div>

      <div className="bg-white/60 rounded-full h-2 mb-3 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.7, delay: index * 0.05, ease: 'easeOut' }}
          className={`h-full rounded-full ${config.bar}`}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">
          {month.matched} / {month.total}
        </span>
        {month.missing > 0 ? (
          <span className={`text-xs font-medium ${config.text}`}>
            {month.missing} fehlen
          </span>
        ) : month.status === 'complete' ? (
          <span className="text-xs font-medium text-emerald-700">
            Bereit
          </span>
        ) : null}
      </div>

      {month.status !== 'empty' && (
        <Link 
          href={`/export?year=${month.month.split('-')[0]}&month=${month.month.split('-')[1]}`}
          className="mt-4 flex items-center justify-center gap-2 bg-white hover:bg-emerald-50/60 rounded-lg py-2 text-sm font-medium text-slate-700 transition-colors border border-slate-200"
        >
          <Download className="w-4 h-4" />
          Exportieren
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </motion.div>
  );
}

// Time-based folder organization component
function RecentUploadsSection() {
  const router = useRouter();
  const [timeGroups, setTimeGroups] = useState<TimeGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentReceipts();
  }, []);

  async function fetchRecentReceipts() {
    try {
      const apiKey = localStorage.getItem('apiKey') || 'lanista-secret-key-2024';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      
      const response = await fetch(`${apiUrl}/api/accounting/receipts?limit=100`, {
        headers: { 'x-api-key': apiKey }
      });
      
      const data = await response.json();
      const receipts: Receipt[] = data.receipts || [];
      
      // Group by time periods
      const groups = groupReceiptsByTime(receipts);
      setTimeGroups(groups);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteReceipt(receiptId: string) {
    if (!confirm('Beleg wirklich löschen?')) return;
    
    try {
      const apiKey = localStorage.getItem('apiKey') || 'lanista-secret-key-2024';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      
      const response = await fetch(`${apiUrl}/api/accounting/receipts/${receiptId}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey }
      });
      
      if (response.ok) {
        // Refresh list
        fetchRecentReceipts();
      } else {
        alert('Löschen fehlgeschlagen');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Löschen fehlgeschlagen');
    }
  }

  function groupReceiptsByTime(receipts: Receipt[]): TimeGroup[] {
    const now = new Date();
    const groups: { [key: string]: Receipt[] } = {};
    
    receipts.forEach(receipt => {
      const created = new Date(receipt.created_at);
      const diffMs = now.getTime() - created.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      let key: string;
      
      if (diffMins < 5) {
        key = 'Gerade';
      } else if (diffMins < 20) {
        key = 'Vor 15 Min';
      } else if (diffHours < 1) {
        key = 'Vor 1h';
      } else if (diffHours < 2) {
        key = 'Vor 2h';
      } else if (diffDays < 1) {
        key = 'Heute';
      } else if (diffDays < 2) {
        key = 'Vor 1 Tag';
      } else if (diffDays < 7) {
        key = 'Diese Woche';
      } else if (diffDays < 14) {
        key = 'Letzte Woche';
      } else {
        key = created.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(receipt);
    });
    
    // Sort order
    const order = ['Gerade', 'Vor 15 Min', 'Vor 1h', 'Vor 2h', 'Heute', 'Vor 1 Tag', 'Diese Woche', 'Letzte Woche'];
    
    return Object.entries(groups)
      .sort((a, b) => {
        const idxA = order.indexOf(a[0]);
        const idxB = order.indexOf(b[0]);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b[1][0].created_at.localeCompare(a[1][0].created_at);
      })
      .map(([label, receipts]) => ({ label, receipts }));
  }

  if (loading) {
    return (
      <div className="bg-white/85 rounded-3xl p-6 border border-white/80 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Neueste Uploads</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (timeGroups.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/85 rounded-3xl p-6 border border-white/80 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Receipt className="w-5 h-5 text-slate-500" />
        Neueste Uploads
      </h2>
      
      <div className="space-y-4">
        {timeGroups.slice(0, 6).map((group) => (
          <div key={group.label} className="border-l-4 border-amber-300 pl-4">
            <h3 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
              {group.label}
              <span className="text-sm text-slate-500 font-normal">
                ({group.receipts.length})
              </span>
            </h3>
            <div className="space-y-2">
              {group.receipts.slice(0, 3).map((receipt) => (
                <div 
                  key={receipt.id}
                  className="flex items-center justify-between p-2 hover:bg-emerald-50/60 rounded-lg text-sm group"
                >
                  <div 
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => router.push(`/dashboard/months/${receipt.receipt_date?.slice(0, 7) || '2025-04'}`)}
                  >
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="truncate max-w-[180px]">
                      {receipt.merchant_name || 'Unbekannt'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">
                      {receipt.total_amount?.toFixed(2)} €
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReceipt(receipt.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500 transition-opacity"
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {group.receipts.length > 3 && (
                <p className="text-xs text-slate-400 pl-6">
                  +{group.receipts.length - 3} weitere
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
