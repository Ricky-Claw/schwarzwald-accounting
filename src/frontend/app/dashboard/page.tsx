'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileText, Download, CheckCircle, AlertCircle, 
  ChevronRight, Calendar, Receipt, TrendingUp 
} from 'lucide-react';
import Link from 'next/link';
import { Hernie } from '../components/Hernie';

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
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const [monthsRes, statsRes] = await Promise.all([
        fetch('/api/accounting/receipts/months/list'),
        fetch('/api/accounting/receipts/dashboard/stats'),
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-4xl"
        >
          🌀
        </motion.div>
      </div>
    );
  }

  const currentMonth = months[0];
  const completionRate = stats 
    ? Math.round((stats.matchedTransactions / stats.totalTransactions) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-purple-800 mb-2">
              🌈 Hernies Buchhaltung
            </h1>
            <p className="text-purple-600">Dein freundlicher Accounting-Helper!</p>
          </div>
          <Hernie 
            mood={currentMonth?.status === 'complete' ? 'excited' : 'happy'}
            message={currentMonth?.status === 'complete' 
              ? "Super! Alles erledigt! 🎉" 
              : `Noch ${currentMonth?.missing || 0} Belege fehlen...`
            }
          />
        </div>
      </header>

      {/* Quick Actions */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/upload">
            <motion.div
              whileHover={{ scale: 1.02, rotate: -1 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-yellow-300 to-orange-300 rounded-3xl p-6 shadow-lg border-4 border-white cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-md">
                  <Upload className="text-orange-500" />
                </div>
                <div>
                  <h3 className="font-bold text-orange-800 text-lg">Belege hochladen</h3>
                  <p className="text-orange-700 text-sm">OCR erkennt automatisch!</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/export">
            <motion.div
              whileHover={{ scale: 1.02, rotate: 1 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-green-300 to-emerald-300 rounded-3xl p-6 shadow-lg border-4 border-white cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-md">
                  <Download className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-800 text-lg">Für Steuerbüro</h3>
                  <p className="text-emerald-700 text-sm">DATEV oder CSV Export</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-r from-blue-300 to-indigo-300 rounded-3xl p-6 shadow-lg border-4 border-white"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-md">
                <TrendingUp className="text-indigo-500" />
              </div>
              <div>
                <h3 className="font-bold text-indigo-800 text-lg">{completionRate}%</h3>
                <p className="text-indigo-700 text-sm">Belege zugeordnet</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Month Cards */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-purple-800 mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Deine Monate
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {months.map((month, index) => (
              <MonthCard 
                key={month.month} 
                month={month} 
                index={index}
                isSelected={selectedMonth === month.month}
                onClick={() => setSelectedMonth(selectedMonth === month.month ? null : month.month)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Stats Footer */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto mt-8 bg-white/80 backdrop-blur rounded-3xl p-6 border-4 border-purple-200"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <StatBox 
              icon={<Receipt className="w-6 h-6 text-pink-500" />}
              label="Belege gesamt"
              value={stats.totalReceipts}
            />
            <StatBox 
              icon={<CheckCircle className="w-6 h-6 text-green-500" />}
              label="Zugeordnet"
              value={stats.matchedTransactions}
            />
            <StatBox 
              icon={<AlertCircle className="w-6 h-6 text-orange-500" />}
              label="Fehlend"
              value={stats.missingReceipts}
              highlight={stats.missingReceipts > 0}
            />
            <StatBox 
              icon={<FileText className="w-6 h-6 text-blue-500" />}
              label="Buchungen"
              value={stats.totalTransactions}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

function MonthCard({ 
  month, 
  index, 
  isSelected, 
  onClick 
}: { 
  month: MonthStatus; 
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = {
    complete: 'from-green-200 to-emerald-200 border-green-300',
    incomplete: 'from-orange-200 to-amber-200 border-orange-300',
    empty: 'from-gray-100 to-gray-200 border-gray-300',
  };

  const icons = {
    complete: '🌟',
    incomplete: '⚡',
    empty: '💤',
  };

  const progress = month.total > 0 ? (month.matched / month.total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02, rotate: index % 2 === 0 ? 1 : -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`bg-gradient-to-br ${colors[month.status]} rounded-3xl p-5 border-4 ${isSelected ? 'border-purple-500 ring-4 ring-purple-200' : ''} cursor-pointer shadow-lg`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">{month.monthName}</h3>
          <p className="text-gray-600 text-sm">{month.total} Buchungen</p>
        </div>
        <span className="text-3xl">{icons[month.status]}</span>
      </div>

      {/* Progress Bar */}
      <div className="bg-white/50 rounded-full h-3 mb-3 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, delay: index * 0.1 }}
          className={`h-full rounded-full ${
            month.status === 'complete' ? 'bg-green-500' : 'bg-orange-500'
          }`}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">
          {month.matched} <span className="text-gray-500">/ {month.total}</span>
        </span>
        {month.missing > 0 && (
          <span className="text-orange-700 font-medium bg-orange-100 px-2 py-1 rounded-full text-xs">
            {month.missing} fehlen
          </span>
        )}
        {month.status === 'complete' && (
          <span className="text-green-700 font-medium bg-green-100 px-2 py-1 rounded-full text-xs">
            Bereit!
          </span>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-black/10"
          >
            <Link 
              href={`/export?year=${month.month.split('-')[0]}&month=${month.month.split('-')[1]}`}
              className="flex items-center justify-center gap-2 bg-white/80 hover:bg-white rounded-xl py-3 text-sm font-medium text-gray-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportieren
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatBox({ 
  icon, 
  label, 
  value, 
  highlight = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl ${highlight ? 'bg-orange-100 border-2 border-orange-300' : 'bg-gray-50'}`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
