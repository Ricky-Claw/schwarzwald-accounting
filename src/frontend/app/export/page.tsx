'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertCircle, CheckCircle, FileText, MessageSquare, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Hernie } from '../components/Hernie';

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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">🌀 Laden...</div>}>
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

  // Status laden wenn sich Jahr/Monat ändert
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

      // Download
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-8">
        <Link href="/dashboard" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">
          ← Zurück zum Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-bold text-emerald-800">Für Steuerbüro</h1>
          <Hernie
            mood={status?.readyForTaxOffice ? 'excited' : 'thinking'}
            message={
              status?.readyForTaxOffice
                ? 'Alles bereit! Super Arbeit! 🎉'
                : status?.summary.withoutReceipt
                ? `Noch ${status.summary.withoutReceipt} Belege fehlen...`
                : 'Wähle einen Monat zum Exportieren!'
            }
          />
        </div>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Settings */}
        <div className="space-y-6">
          {/* Month Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 shadow-lg border-4 border-emerald-100"
          >
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              Zeitraum
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jahr</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-400 focus:outline-none"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monat</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-400 focus:outline-none"
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
            className="bg-white rounded-3xl p-6 shadow-lg border-4 border-emerald-100"
          >
            <h2 className="text-xl font-bold text-gray-800 mb-4">Format</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setFormat('csv')}
                className={`p-4 rounded-2xl border-4 transition-all ${
                  format === 'csv'
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-200'
                }`}
              >
                <FileText className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <div className="font-bold text-gray-800">CSV</div>
                <div className="text-sm text-gray-500">Für Excel</div>
              </button>
              <button
                onClick={() => setFormat('datev')}
                className={`p-4 rounded-2xl border-4 transition-all ${
                  format === 'datev'
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-200'
                }`}
              >
                <FileText className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <div className="font-bold text-gray-800">DATEV</div>
                <div className="text-sm text-gray-500">Für Steuerbüro</div>
              </button>
            </div>
          </motion.div>

          {/* Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-6 shadow-lg border-4 border-emerald-100"
          >
            <h2 className="text-xl font-bold text-gray-800 mb-4">Optionen</h2>

            <label className="flex items-start gap-3 p-4 bg-orange-50 rounded-2xl border-2 border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors">
              <input
                type="checkbox"
                checked={includeIncomplete}
                onChange={(e) => setIncludeIncomplete(e.target.checked)}
                className="mt-1 w-5 h-5 text-orange-500 rounded"
              />
              <div>
                <div className="font-medium text-gray-800">Unvollständig exportieren</div>
                <div className="text-sm text-gray-600">
                  Export auch wenn Belege fehlen (mit Markierung)
                </div>
              </div>
            </label>

            {/* Comment */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Kommentar für Steuerbüro
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="z.B. Rechnung für Amazon-Buchung liegt per Mail beim SB..."
                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-400 focus:outline-none resize-none"
                rows={3}
              />
            </div>
          </motion.div>
        </div>

        {/* Right: Status & Preview */}
        <div className="space-y-6">
          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`rounded-3xl p-6 shadow-lg border-4 ${
              status?.readyForTaxOffice
                ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-300'
                : status?.summary.withoutReceipt
                ? 'bg-gradient-to-br from-orange-100 to-amber-100 border-orange-300'
                : 'bg-gray-100 border-gray-200'
            }`}
          >
            {loading ? (
              <div className="text-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-4xl"
                >
                  🌀
                </motion.div>
              </div>
            ) : status ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  {status.readyForTaxOffice ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-orange-600" />
                  )}
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {status.readyForTaxOffice
                        ? 'Bereit für Steuerbüro!'
                        : `${status.summary.withoutReceipt} Belege fehlen`}
                    </h3>
                    <p className="text-gray-600">
                      {monthNames[status.month - 1]} {status.year}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/60 rounded-2xl p-3">
                    <div className="text-2xl font-bold text-gray-800">
                      {status.summary.totalTransactions}
                    </div>
                    <div className="text-sm text-gray-600">Buchungen</div>
                  </div>
                  <div className="bg-white/60 rounded-2xl p-3">
                    <div className="text-2xl font-bold text-green-600">
                      {status.summary.withReceipt}
                    </div>
                    <div className="text-sm text-gray-600">Mit Beleg</div>
                  </div>
                </div>

                {/* Missing List */}
                {status.summary.missingReceipts.length > 0 && (
                  <div className="bg-white/60 rounded-2xl p-4">
                    <h4 className="font-medium text-gray-800 mb-2">Fehlende Belege:</h4>
                    <ul className="space-y-2 text-sm">
                      {status.summary.missingReceipts.slice(0, 5).map((item, i) => (
                        <li key={i} className="flex justify-between text-gray-700">
                          <span>{item.date}</span>
                          <span className="font-medium">{item.amount.toFixed(2)} €</span>
                        </li>
                      ))}
                      {status.summary.missingReceipts.length > 5 && (
                        <li className="text-gray-500 text-center">
                          +{status.summary.missingReceipts.length - 5} weitere...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </motion.div>

          {/* Export Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={handleExport}
            disabled={downloading || (!includeIncomplete && !status?.readyForTaxOffice)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full p-6 rounded-3xl font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-colors ${
              !includeIncomplete && !status?.readyForTaxOffice
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white hover:from-emerald-500 hover:to-teal-500'
            }`}
          >
            {downloading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  🌀
                </motion.div>
                Wird erstellt...
              </>
            ) : (
              <>
                <Download className="w-6 h-6" />
                {status?.readyForTaxOffice
                  ? 'Export herunterladen'
                  : includeIncomplete
                  ? 'Unvollständig exportieren'
                  : 'Bitte Belege ergänzen'}
              </>
            )}
          </motion.button>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-blue-50 rounded-2xl p-4 border-2 border-blue-200"
          >
            <h4 className="font-bold text-blue-800 mb-2">📋 Was ist im Export?</h4>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Alle Buchungen des Monats</li>
              <li>• Markierung: "Beleg vorhanden" / "Beleg fehlt"</li>
              <li>• Liste fehlender Belege mit Kommentaren</li>
              <li>• Zusammenfassung (Einnahmen/Ausgaben)</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
