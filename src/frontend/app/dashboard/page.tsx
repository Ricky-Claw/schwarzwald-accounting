'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Upload, Download, CheckCircle, AlertCircle, 
  Calendar, Receipt, TrendingUp, FileText,
  ChevronRight, LogOut
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Lanista Buchhaltung</h1>
              <p className="text-slate-500 text-sm">Professionelle Buchhaltung einfach gemacht</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">System aktiv</span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('apiKey');
                router.push('/login');
              }}
              className="flex items-center gap-2 text-slate-500 hover:text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href="/upload">
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Dokumente hochladen</h3>
                  <p className="text-slate-500 text-sm">Belege & Kontoauszüge</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/export">
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Download className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Exportieren</h3>
                  <p className="text-slate-500 text-sm">DATEV oder CSV Format</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{completionRate}%</h3>
                <p className="text-slate-500 text-sm">Belege zugeordnet</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard 
              icon={<Receipt className="w-5 h-5" />}
              label="Belege gesamt"
              value={stats.totalReceipts}
            />
            <StatCard 
              icon={<CheckCircle className="w-5 h-5" />}
              label="Zugeordnet"
              value={stats.matchedTransactions}
              variant="success"
            />
            <StatCard 
              icon={<AlertCircle className="w-5 h-5" />}
              label="Fehlend"
              value={stats.missingReceipts}
              variant={stats.missingReceipts > 0 ? "warning" : "default"}
            />
            <StatCard 
              icon={<FileText className="w-5 h-5" />}
              label="Buchungen"
              value={stats.totalTransactions}
            />
          </div>
        )}

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
      </main>
    </div>
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
    default: 'bg-white border-slate-200',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
  };

  return (
    <div className={`rounded-xl p-4 border shadow-sm ${variantStyles[variant]}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          variant === 'success' ? 'bg-emerald-100 text-emerald-600' :
          variant === 'warning' ? 'bg-amber-100 text-amber-600' :
          'bg-slate-100 text-slate-600'
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
      className={`rounded-xl p-5 border shadow-sm cursor-pointer hover:shadow-md transition-shadow ${config.bg} ${config.border}`}
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
          transition={{ duration: 0.5, delay: index * 0.05 }}
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
          className="mt-4 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 rounded-lg py-2 text-sm font-medium text-slate-700 transition-colors border border-slate-200"
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
      const apiKey = 'lanista-secret-key-2024';
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
      <div className="bg-white rounded-xl p-6 border border-slate-200">
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
    <div className="bg-white rounded-xl p-6 border border-slate-200">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Receipt className="w-5 h-5 text-slate-500" />
        Neueste Uploads
      </h2>
      
      <div className="space-y-4">
        {timeGroups.slice(0, 6).map((group) => (
          <div key={group.label} className="border-l-4 border-emerald-400 pl-4">
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
                  onClick={() => router.push(`/dashboard/months/${receipt.receipt_date?.slice(0, 7) || '2025-04'}`)}
                  className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="truncate max-w-[200px]">
                      {receipt.merchant_name || 'Unbekannt'}
                    </span>
                  </div>
                  <span className="font-medium text-slate-700">
                    {receipt.total_amount?.toFixed(2)} €
                  </span>
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
