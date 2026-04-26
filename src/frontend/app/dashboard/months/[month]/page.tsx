'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Calendar, Receipt, CheckCircle, AlertCircle, 
  Download, Trash2, FileText, Loader2, Upload, ClipboardCheck
} from 'lucide-react';
import Link from 'next/link';

interface Receipt {
  id: string;
  merchant_name: string;
  receipt_date: string;
  total_amount: number;
  file_name_display: string;
  skr04_code: string;
  status: string;
  matched: boolean;
}

interface MissingReceipt {
  id: string;
  date: string;
  amount: number;
  description: string;
}

interface ExportStatus {
  readyForTaxOffice: boolean;
  summary: {
    totalTransactions: number;
    withReceipt: number;
    withoutReceipt: number;
    missingReceipts: MissingReceipt[];
  };
}

export default function MonthDetailPage() {
  const params = useParams();
  const router = useRouter();
  const month = params.month as string;
  
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthName, setMonthName] = useState('');

  useEffect(() => {
    if (month) {
      fetchReceipts();
      setMonthName(formatMonthName(month));
    }
  }, [month]);

  function formatMonthName(monthStr: string) {
    const [year, monthNum] = monthStr.split('-');
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  }

  async function fetchReceipts() {
    try {
      const apiKey = 'lanista-secret-key-2024';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      
      const response = await fetch(
        `${apiUrl}/api/accounting/receipts?month=${month}`,
        { headers: { 'x-api-key': apiKey } }
      );
      const [year, monthNum] = month.split('-');
      const statusResponse = await fetch(
        `${apiUrl}/api/accounting/export/status/${year}/${parseInt(monthNum)}`,
        { headers: { 'x-api-key': apiKey } }
      );
      
      const data = await response.json();
      const statusData = statusResponse.ok ? await statusResponse.json() : null;
      setReceipts(data.receipts || []);
      setExportStatus(statusData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteReceipt(id: string) {
    if (!confirm('Beleg wirklich löschen?')) return;
    
    try {
      const apiKey = 'lanista-secret-key-2024';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      
      await fetch(`${apiUrl}/api/accounting/receipts/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey }
      });
      
      setReceipts(receipts.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error:', error);
      alert('Fehler beim Löschen');
    }
  }

  const totalAmount = receipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const matchedCount = receipts.filter(r => r.matched).length;
  const missingReceipts = exportStatus?.summary.missingReceipts || [];
  const totalTransactions = exportStatus?.summary.totalTransactions || 0;
  const readyForTaxOffice = !!exportStatus?.readyForTaxOffice;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Zurück zum Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-slate-500" />
              <h1 className="text-2xl font-semibold text-slate-900">{monthName}</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                {receipts.length} Belege • {totalAmount.toFixed(2)} €
              </span>
              <Link
                href={`/export?year=${month.split('-')[0]}&month=${month.split('-')[1]}`}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tax office readiness */}
        <div className={`rounded-2xl p-6 mb-8 border ${
          readyForTaxOffice ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${readyForTaxOffice ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {readyForTaxOffice ? <ClipboardCheck className="w-6 h-6 text-emerald-700" /> : <AlertCircle className="w-6 h-6 text-amber-700" />}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {readyForTaxOffice ? 'Steuerberater-ready' : `${missingReceipts.length} Belege fehlen noch`}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {readyForTaxOffice
                    ? 'Alle relevanten Buchungen haben Belege. Export kann sauber geteilt werden.'
                    : 'Arbeite diese Liste ab: Beleg hochladen, OCR prüfen, Export neu laden.'}
                </p>
              </div>
            </div>
            <Link
              href={`/export?year=${month.split('-')[0]}&month=${parseInt(month.split('-')[1])}`}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Steuerberater-Export
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-semibold text-slate-900">{totalTransactions}</div>
            <div className="text-sm text-slate-500">Buchungen</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="text-2xl font-semibold text-emerald-700">{exportStatus?.summary.withReceipt ?? matchedCount}</div>
            <div className="text-sm text-emerald-600">Mit Beleg</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="text-2xl font-semibold text-amber-700">{missingReceipts.length}</div>
            <div className="text-sm text-amber-600">Fehlend</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-semibold text-slate-900">{totalAmount.toFixed(2)} €</div>
            <div className="text-sm text-slate-500">Gesamtbetrag</div>
          </div>
        </div>

        {/* Missing receipts first */}
        {missingReceipts.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 mb-8 overflow-hidden">
            <div className="p-4 border-b border-amber-200 bg-amber-50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                Fehlende Belege — zuerst erledigen
              </h2>
            </div>
            <div className="divide-y divide-slate-200">
              {missingReceipts.map((item) => (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{item.description}</div>
                    <div className="text-sm text-slate-500">{item.date} • {item.amount.toFixed(2)} €</div>
                  </div>
                  <Link
                    href={`/upload?month=${month}&transactionId=${item.id}&date=${item.date}&amount=${item.amount}&description=${encodeURIComponent(item.description)}`}
                    className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    passenden Beleg hochladen
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receipts List */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-500" />
              Belege
            </h2>
          </div>
          
          {receipts.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Keine Belege für diesen Monat</p>
              <Link 
                href="/upload" 
                className="inline-flex items-center gap-2 mt-4 text-emerald-600 hover:text-emerald-700"
              >
                Belege hochladen
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {receipts.map((receipt, index) => (
                <motion.div
                  key={receipt.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 flex items-center justify-between hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      receipt.matched ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}>
                      {receipt.matched ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {receipt.merchant_name || 'Unbekannt'}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-2">
                        <span>{receipt.receipt_date}</span>
                        <span>•</span>
                        <span className="font-medium text-slate-700">
                          {receipt.total_amount?.toFixed(2)} €
                        </span>
                        {receipt.skr04_code && (
                          <>
                            <span>•</span>
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                              SKR04: {receipt.skr04_code}
                            </span>
                          </>
                        )}
                      </div>
                      {receipt.file_name_display && (
                        <div className="text-xs text-slate-400 mt-1">
                          {receipt.file_name_display}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteReceipt(receipt.id)}
                    className="p-2 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
