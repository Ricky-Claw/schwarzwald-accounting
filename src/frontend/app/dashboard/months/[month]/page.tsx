'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Calendar, Receipt, CheckCircle, AlertCircle,
  Download, Trash2, FileText, Loader2, Upload, ClipboardCheck, Edit3, Save, X
} from 'lucide-react';
import Link from 'next/link';

interface Receipt {
  id: string;
  merchant_name: string;
  receipt_date: string;
  total_amount: number;
  vat_amount?: number;
  invoice_number?: string;
  invoice_type?: string;
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
  review?: { count: number; receipts: Array<{ id: string; merchant_name: string; reasons: string[] }> };
  checklist?: Array<{ key: string; label: string; ok: boolean }>;
  summary: {
    totalTransactions: number;
    withReceipt: number;
    withoutReceipt: number;
    missingReceipts: MissingReceipt[];
  };
}

interface TransactionRow {
  id: string;
  transaction_date: string;
  amount: number;
  description?: string;
  counterparty_name?: string;
  matchingStatus: 'matched' | 'missing_receipt' | 'no_receipt_needed';
  receipt?: { merchant_name?: string; file_name_display?: string };
}

export default function MonthDetailPage() {
  const params = useParams();
  const router = useRouter();
  const month = params.month as string;
  
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; skr04Code: string }>>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
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
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      const headers: Record<string, string> = { 'x-api-key': apiKey };
      if (tenantId) headers['x-tenant-id'] = tenantId;
      
      const response = await fetch(
        `${apiUrl}/api/accounting/receipts?month=${month}`,
        { headers }
      );
      const [year, monthNum] = month.split('-');
      const statusResponse = await fetch(
        `${apiUrl}/api/accounting/export/status/${year}/${parseInt(monthNum)}`,
        { headers }
      );
      const overviewResponse = await fetch(`${apiUrl}/api/accounting/receipts/months/${year}/${parseInt(monthNum)}`, { headers });
      const categoriesResponse = await fetch(`${apiUrl}/api/accounting/receipts/categories/list`, { headers });
      
      const data = await response.json();
      const statusData = statusResponse.ok ? await statusResponse.json() : null;
      const overviewData = overviewResponse.ok ? await overviewResponse.json() : null;
      const categoryData = categoriesResponse.ok ? await categoriesResponse.json() : null;
      setReceipts(data.receipts || []);
      setExportStatus(statusData);
      setTransactions(overviewData?.transactions || []);
      setCategories([
        ...(categoryData?.incoming?.categories || []),
        ...(categoryData?.outgoing?.categories || []),
      ]);
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
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      const headers: Record<string, string> = { 'x-api-key': apiKey };
      if (tenantId) headers['x-tenant-id'] = tenantId;
      
      await fetch(`${apiUrl}/api/accounting/receipts/${id}`, {
        method: 'DELETE',
        headers
      });
      
      setReceipts(receipts.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error:', error);
      alert('Fehler beim Löschen');
    }
  }

  function startEdit(receipt: Receipt) {
    setEditingId(receipt.id);
    setEditForm({
      merchant_name: receipt.merchant_name || '',
      receipt_date: receipt.receipt_date || '',
      total_amount: receipt.total_amount || 0,
      vat_amount: receipt.vat_amount || '',
      invoice_number: receipt.invoice_number || '',
      invoice_type: receipt.invoice_type || 'incoming',
      category_id: '',
      status: receipt.status || 'verified',
    });
  }

  async function saveReceipt(id: string) {
    setSaving(true);
    try {
      const apiKey = 'lanista-secret-key-2024';
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': apiKey };
      if (tenantId) headers['x-tenant-id'] = tenantId;
      const body = {
        ...editForm,
        total_amount: Number(editForm.total_amount),
        vat_amount: editForm.vat_amount === '' ? null : Number(editForm.vat_amount),
        category_id: editForm.category_id || undefined,
      };
      const response = await fetch(`${apiUrl}/api/accounting/receipts/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Save failed');
      setEditingId(null);
      await fetchReceipts();
    } catch (error) {
      console.error('Error:', error);
      alert('Korrektur konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  }

  const totalAmount = receipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const matchedCount = receipts.filter(r => r.matched).length;
  const missingReceipts = exportStatus?.summary.missingReceipts || [];
  const totalTransactions = exportStatus?.summary.totalTransactions || 0;
  const readyForTaxOffice = !!exportStatus?.readyForTaxOffice;
  const reviewCount = exportStatus?.review?.count || 0;

  if (loading) {
    return (
      <div className="finance-shell ledger-grid flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="finance-shell ledger-grid">
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
                className="flex items-center gap-2 bg-[#0f6b4f] text-white px-4 py-2 rounded-lg hover:bg-[#0b573f] transition-colors"
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
                  {readyForTaxOffice ? 'Steuerberater-ready' : `${missingReceipts.length} Belege fehlen • ${reviewCount} Prüfungen offen`}
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

        {exportStatus?.checklist && (
          <div className="finance-card border border-slate-200 p-4 mb-8">
            <h2 className="font-semibold text-slate-900 mb-3">Monatsabschluss-Checkliste</h2>
            <div className="grid gap-3 md:grid-cols-4">
              {exportStatus.checklist.map((item) => (
                <div key={item.key} className={`rounded-xl p-3 border ${item.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {item.ok ? <CheckCircle className="w-4 h-4 text-emerald-700" /> : <AlertCircle className="w-4 h-4 text-amber-700" />}
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!reviewCount && (
          <div className="finance-card border border-amber-200 mb-8 overflow-hidden">
            <div className="p-4 border-b border-amber-200 bg-amber-50 font-semibold text-slate-900">Offene Beleg-Prüfungen</div>
            <div className="divide-y divide-slate-200">
              {exportStatus?.review?.receipts.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{item.merchant_name || 'Unbekannt'}</div>
                    <div className="text-sm text-amber-700">{item.reasons.join(' • ')}</div>
                  </div>
                  <button onClick={() => startEdit(receipts.find(r => r.id === item.id)!)} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm">Korrigieren</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="finance-card p-4 border border-slate-200">
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
          <div className="finance-card p-4 border border-slate-200">
            <div className="text-2xl font-semibold text-slate-900">{totalAmount.toFixed(2)} €</div>
            <div className="text-sm text-slate-500">Gesamtbetrag</div>
          </div>
        </div>

        {/* Missing receipts first */}
        {missingReceipts.length > 0 && (
          <div className="finance-card border border-amber-200 mb-8 overflow-hidden">
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
                    className="inline-flex items-center justify-center gap-2 bg-[#0f6b4f] text-white px-4 py-2 rounded-lg hover:bg-[#0b573f] transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    passenden Beleg hochladen
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking status table */}
        <div className="finance-card border border-slate-200 mb-8 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-700" /> Buchungs-Tabelle
              </h2>
              <p className="text-sm text-slate-500">Grün = Beleg vorhanden, Rot = Beleg fehlt, Grau = kein Beleg nötig.</p>
            </div>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Noch keine Bankbuchungen importiert. Kontoauszug als CSV/CAMT hochladen.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {transactions.map((tx) => {
                const isMissing = tx.matchingStatus === 'missing_receipt';
                const isMatched = tx.matchingStatus === 'matched';
                return (
                  <div key={tx.id} className={`p-4 grid gap-3 md:grid-cols-[120px_1fr_120px_160px] md:items-center ${isMatched ? 'bg-emerald-50/60' : isMissing ? 'bg-red-50/70' : 'bg-slate-50/70'}`}>
                    <div className="text-sm text-slate-600">{tx.transaction_date}</div>
                    <div>
                      <div className="font-medium text-slate-950">{tx.description || tx.counterparty_name || 'Unbekannte Buchung'}</div>
                      {tx.receipt?.merchant_name && <div className="text-xs text-emerald-700">Beleg: {tx.receipt.merchant_name}</div>}
                    </div>
                    <div className={`font-semibold ${tx.amount < 0 ? 'text-slate-950' : 'text-emerald-700'}`}>{Math.abs(tx.amount).toFixed(2)} €</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`finance-badge ${isMatched ? 'bg-emerald-100 text-emerald-800' : isMissing ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>{isMatched ? 'GRÜN · Beleg da' : isMissing ? 'ROT · Beleg fehlt' : 'GRAU · kein Beleg nötig'}</span>
                      {isMissing && (
                        <Link href={`/upload?month=${month}&transactionId=${tx.id}&date=${tx.transaction_date}&amount=${Math.abs(tx.amount)}&description=${encodeURIComponent(tx.description || tx.counterparty_name || '')}`} className="text-xs font-semibold text-red-700 hover:text-red-900">hochladen</Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Receipts List */}
        <div className="finance-card border border-slate-200">
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
                  className="p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-4">
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
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(receipt)} className="p-2 hover:bg-emerald-100 rounded-lg text-slate-400 hover:text-emerald-700 transition-colors" aria-label="Beleg korrigieren"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => deleteReceipt(receipt.id)} className="p-2 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors" aria-label="Beleg löschen"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  </div>
                  {editingId === receipt.id && (
                    <div className="mt-4 grid gap-3 md:grid-cols-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <input className="p-3 border rounded-lg" value={editForm.merchant_name} onChange={e => setEditForm({ ...editForm, merchant_name: e.target.value })} placeholder="Händler" />
                      <input className="p-3 border rounded-lg" type="date" value={editForm.receipt_date} onChange={e => setEditForm({ ...editForm, receipt_date: e.target.value })} />
                      <input className="p-3 border rounded-lg" type="number" step="0.01" value={editForm.total_amount} onChange={e => setEditForm({ ...editForm, total_amount: e.target.value })} placeholder="Brutto" />
                      <input className="p-3 border rounded-lg" type="number" step="0.01" value={editForm.vat_amount} onChange={e => setEditForm({ ...editForm, vat_amount: e.target.value })} placeholder="MwSt" />
                      <input className="p-3 border rounded-lg" value={editForm.invoice_number} onChange={e => setEditForm({ ...editForm, invoice_number: e.target.value })} placeholder="Rechnungsnummer" />
                      <select className="p-3 border rounded-lg" value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}>
                        <option value="">Kategorie behalten</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} · SKR04 {c.skr04Code}</option>)}
                      </select>
                      <div className="md:col-span-3 flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 inline-flex items-center gap-2"><X className="w-4 h-4" />Abbrechen</button>
                        <button disabled={saving} onClick={() => saveReceipt(receipt.id)} className="px-4 py-2 rounded-lg bg-[#0f6b4f] text-white inline-flex items-center gap-2 disabled:opacity-60"><Save className="w-4 h-4" />Speichern</button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
