'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, Download, CheckCircle, AlertCircle, 
  Calendar, Receipt, TrendingUp, FileText,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const [monthsRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounting/receipts/months/list`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounting/receipts/dashboard/stats`),
      ]);
      
      const monthsData = await monthsRes.json();
      const statsData = await statsRes.json();
      
      setMonths(monthsData.months || []);
      setStats(statsData);
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

        {/* Month Cards */}
        <div>
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

  const statusConfig = {
    complete: { bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-700' },
    incomplete: { bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500', text: 'text-amber-700' },
    empty: { bg: 'bg-slate-50', border: 'border-slate-200', bar: 'bg-slate-300', text: 'text-slate-500' },
  };

  const config = statusConfig[month.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-xl p-5 border shadow-sm ${config.bg} ${config.border}`}
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
