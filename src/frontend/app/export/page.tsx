'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Download, AlertCircle, CheckCircle, FileText, Calendar, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface ExportStatus {
  year: number;
  month: number;
  status: 'complete' | 'incomplete' | 'empty';
  summary: {
    totalTransactions: number;
    withReceipt: number;
    withoutReceipt: number;
    totalIncome: number;
    totalExpense: number;
    missingReceipts: Array<{
      date: string;
      amount: number;
      description: string;
    }>;
  };
  readyForTaxOffice: boolean;
}

export default function ExportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>}>
      <ExportContent />
    </Suspense>
  );
}

function ExportContent() {
  const searchParams = useSearchParams();
  const preselectedYear = searchParams.get('year');
  const preselectedMonth = searchParams.get('month');

  const [year, setYear] = useState(preselectedYear || new Date().getFullYear().toString());
  const [month, setMonth] = useState(preselectedMonth || (new Date().getMonth() + 1).toString());
  const [format, setFormat] = useState<'datev' | 'csv'>('csv');
  const [includeIncomplete, setIncludeIncomplete] = useState(false);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, [year, month]);

  async function fetchStatus() {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/export/status/${year}/${month}`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setDownloading(true);
    try {
      const response = await fetch('/api/accounting/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(year),
          month: parseInt(month),
          format,
          includeIncomplete,
          comment: comment || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error === 'INCOMPLETE_DATA') {
          alert('Es fehlen noch Belege! Aktiviere "Unvollständig exportieren" oder ergänze die fehlenden Belege.');
          return;
        }
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Buchungen_${year}_${month.padStart(2, '0')}.${format === 'csv' ? 'csv' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export fehlgeschlagen');
    } finally {
      setDownloading(false);
    }
  }

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  const progressPercent = status?.summary.totalTransactions
    ? Math.round((status.summary.withReceipt / status.summary.totalTransactions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Zurück zum Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">Export für Steuerbüro</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Settings */}
          <div className="lg:col-span-1 space-y-6">
            {/* Period Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-500" />
                Zeitraum
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Jahr</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={2024 + i} value={2024 + i}>{2024 + i}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Monat</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {monthNames.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>

            {/* Format Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Format</h2>
              <div className="space-y-3">
                <button
                  onClick={() => setFormat('csv')}
                  className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-4 ${
                    format === 'csv'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <FileText className={`w-6 h-6 ${format === 'csv' ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <div className="font-medium text-slate-900">CSV</div>
                    <div className="text-sm text-slate-500">Für Excel</div>
                  </div>
                </button>
                <button
                  onClick={() => setFormat('datev')}
                  className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-4 ${
                    format === 'datev'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <FileText className={`w-6 h-6 ${format === 'datev' ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <div className="font-medium text-slate-900">DATEV</div>
                    <div className="text-sm text-slate-500">Für Steuerbüro</div>
                  </div>
                </button>
              </div>
            </motion.div>

            {/* Options */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Optionen</h2>
              
              <label className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
                <input
                  type="checkbox"
                  checked={includeIncomplete}
                  onChange={(e) => setIncludeIncomplete(e.target.checked)}
                  className="mt-1 w-5 h-5 text-amber-600 rounded border-slate-300"
                />
                <div>
                  <div className="font-medium text-slate-900">Unvollständig exportieren</div>
                  <div className="text-sm text-slate-600">
                    Export auch wenn Belege fehlen
                  </div>
                </div>
              </label>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kommentar für Steuerbüro
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="z.B. Rechnung für Amazon-Buchung liegt per Mail beim SB..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none"
                  rows={3}
                />
              </div>
            </motion.div>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-full"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Vorschau</h2>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : status ? (
                <div className="space-y-6">
                  {/* Status Header */}
                  <div className={`p-4 rounded-lg border ${
                    status.readyForTaxOffice
                      ? 'bg-emerald-50 border-emerald-200'
                      : status.summary.withoutReceipt
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      {status.readyForTaxOffice ? (
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                      )}
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {status.readyForTaxOffice
                            ? 'Bereit für Steuerbüro'
                            : `${status.summary.withoutReceipt} Belege fehlen`}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {monthNames[status.month - 1]} {status.year}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-600">Zuordnung</span>
                      <span className="text-sm font-medium text-slate-900">{progressPercent}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5 }}
                        className={`h-full rounded-full ${
                          progressPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatBox label="Buchungen" value={status.summary.totalTransactions} />
                    <StatBox label="Mit Beleg" value={status.summary.withReceipt} variant="success" />
                    <StatBox label="Ohne Beleg" value={status.summary.withoutReceipt} variant={status.summary.withoutReceipt > 0 ? 'warning' : 'default'} />
                    <StatBox label="Einnahmen" value={`${status.summary.totalIncome.toFixed(0)}€`} />
                  </div>

                  {/* Missing Receipts List */}
                  {status.summary.missingReceipts.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <h4 className="font-medium text-slate-900">Fehlende Belege</h4>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-4 py-2 text-left">Datum</th>
                              <th className="px-4 py-2 text-left">Beschreibung</th>
                              <th className="px-4 py-2 text-right">Betrag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {status.summary.missingReceipts.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-slate-900">{item.date}</td>
                                <td className="px-4 py-2 text-slate-600 truncate max-w-xs">{item.description}</td>
                                <td className="px-4 py-2 text-right font-medium text-slate-900">{item.amount.toFixed(2)} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Export Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleExport}
                    disabled={downloading || (!includeIncomplete && !status.readyForTaxOffice)}
                    className={`w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 transition-colors ${
                      !includeIncomplete && !status.readyForTaxOffice
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Wird erstellt...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        {status.readyForTaxOffice
                          ? 'Export herunterladen'
                          : includeIncomplete
                          ? 'Unvollständig exportieren'
                          : 'Bitte Belege ergänzen'}
                      </>
                    )}
                  </motion.button>
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatBox({ 
  label, 
  value, 
  variant = 'default'
}: { 
  label: string; 
  value: number | string;
  variant?: 'default' | 'success' | 'warning';
}) {
  const variantStyles = {
    default: 'bg-slate-50',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className={`p-4 rounded-lg ${variantStyles[variant]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
