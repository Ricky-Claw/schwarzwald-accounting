'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, Check, ArrowLeft, Loader2, File, Trash2, Tag, Calendar, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  skr04Code: string;
  description: string;
  vatRate: number;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'matched' | 'error';
  result?: {
    merchant?: string;
    date?: string;
    amount?: number;
    matched?: boolean;
    fileName?: string;
    category?: Category;
    skr04Code?: string;
  };
  error?: string;
}

const EXPENSE_CATEGORIES: Category[] = [
  { id: 'buero_material', name: 'Büromaterial', skr04Code: '4400', description: 'Papier, Stifte, Ordner', vatRate: 19 },
  { id: 'it_hardware', name: 'IT & Hardware', skr04Code: '0440', description: 'Computer, Laptop, Monitor', vatRate: 19 },
  { id: 'software', name: 'Software & Lizenzen', skr04Code: '0460', description: 'Programme, Cloud', vatRate: 19 },
  { id: 'telefon_internet', name: 'Telefon & Internet', skr04Code: '6800', description: 'Handy, Festnetz, DSL', vatRate: 19 },
  { id: 'reisekosten', name: 'Reisekosten', skr04Code: '4600', description: 'Bahn, Hotel, Flug', vatRate: 19 },
  { id: 'fahrzeug_sprit', name: 'Fahrzeug - Sprit', skr04Code: '6610', description: 'Tanken, Kraftstoff', vatRate: 19 },
  { id: 'fahrzeug_wartung', name: 'Fahrzeug - Wartung', skr04Code: '6620', description: 'Reparatur, Inspektion', vatRate: 19 },
  { id: 'werbung_marketing', name: 'Werbung & Marketing', skr04Code: '6900', description: 'Anzeigen, Flyer', vatRate: 19 },
  { id: 'miete_nebenkosten', name: 'Miete & Nebenkosten', skr04Code: '6600', description: 'Büromiete, Heizung', vatRate: 19 },
  { id: 'strom', name: 'Strom', skr04Code: '6700', description: 'Stromrechnung', vatRate: 19 },
  { id: 'versicherungen', name: 'Versicherungen', skr04Code: '6600', description: 'Haftpflicht, Rechtsschutz', vatRate: 19 },
  { id: 'fortbildung', name: 'Fortbildung & Schulung', skr04Code: '6900', description: 'Kurse, Seminare', vatRate: 19 },
  { id: 'bewirtung', name: 'Bewirtung & Geschenke', skr04Code: '6900', description: 'Kundenbewirtung', vatRate: 19 },
  { id: 'reinigung', name: 'Reinigung & Wartung', skr04Code: '6600', description: 'Gebäudereinigung', vatRate: 19 },
  { id: 'sonstiges', name: 'Sonstige Betriebsausgaben', skr04Code: '4900', description: 'Alles andere', vatRate: 19 },
];

const INCOME_CATEGORIES: Category[] = [
  { id: 'warenverkauf', name: 'Warenverkauf (Einnahme)', skr04Code: '8200', description: 'Verkauf von Waren', vatRate: 19 },
  { id: 'dienstleistungen', name: 'Dienstleistungen (Einnahme)', skr04Code: '8400', description: 'Erbrachte Leistungen', vatRate: 19 },
  { id: 'sonstige_einnahmen', name: 'Sonstige Einnahmen', skr04Code: '8400', description: 'Nicht reguläre Einnahmen', vatRate: 19 },
];

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'incoming' | 'outgoing'>('incoming');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
      router.push('/login');
    }
  }, [router]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFiles = (fileList: FileList) => {
    const newFiles: UploadingFile[] = Array.from(fileList).map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'uploading',
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((file) => uploadFile(file));
  };

  const uploadFile = async (fileObj: UploadingFile) => {
    try {
      const apiKey = localStorage.getItem('apiKey') || 'lanista-secret-key-2024';
      
      const formData = new FormData();
      formData.append('file', fileObj.file);
      formData.append('invoice_type', invoiceType);
      if (selectedCategory) {
        formData.append('category_id', selectedCategory);
      }

      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, progress: Math.min(f.progress + 10, 90) }
              : f
          )
        );
      }, 200);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounting/receipts`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      
      const categories = invoiceType === 'incoming' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      const category = categories.find(c => c.id === data.receipt?.category_id);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? {
                ...f,
                progress: 100,
                status: data.autoMatched ? 'matched' : 'processing',
                result: {
                  merchant: data.receipt?.merchant_name,
                  date: data.receipt?.receipt_date,
                  amount: data.receipt?.total_amount,
                  matched: !!data.autoMatched,
                  fileName: data.fileName,
                  category: category,
                  skr04Code: data.receipt?.skr04_code,
                },
              }
            : f
        )
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? { ...f, status: 'error', error: 'Upload fehlgeschlagen' }
            : f
        )
      );
    }
  };

  const deleteReceipt = async (fileId: string, index: number) => {
    if (!confirm('Beleg wirklich löschen?')) return;
    
    try {
      const apiKey = localStorage.getItem('apiKey') || 'lanista-secret-key-2024';
      
      // Hier müsste die Receipt ID vom Backend kommen - vereinfacht:
      // In der Realität: ID aus dem Upload-Response speichern
      
      setFiles((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      alert('Fehler beim Löschen');
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const categories = invoiceType === 'incoming' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const allDone = files.length > 0 && files.every((f) => f.status !== 'uploading');
  const matchedCount = files.filter((f) => f.result?.matched).length;

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
            <h1 className="text-2xl font-semibold text-slate-900">Dokumente hochladen</h1>
            {files.length > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">
                  {matchedCount} von {files.length} zugeordnet
                </span>
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(matchedCount / files.length) * 100}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Rechnungstyp & Kategorie Auswahl */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rechnungstyp */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <ArrowRightLeft className="w-4 h-4 inline mr-1" />
                Rechnungstyp
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setInvoiceType('incoming')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    invoiceType === 'incoming'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Eingangsrechnung
                </button>
                <button
                  onClick={() => setInvoiceType('outgoing')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    invoiceType === 'outgoing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Ausgangsrechnung
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {invoiceType === 'incoming' ? 'Rechnungen die du bekommst (Ausgaben)' : 'Rechnungen die du schreibst (Einnahmen)'}
              </p>
            </div>

            {/* Kategorie */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                Kategorie (optional)
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Automatisch erkennen</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} (SKR04: {cat.skr04Code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Oder lasse die KI die Kategorie automatisch basierend auf dem Händler erkennen
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Zone */}
          <div>
            <motion.div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              animate={{ scale: dragActive ? 1.01 : 1 }}
              className={`relative bg-white rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'
              }`}
            >
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              <motion.div animate={{ y: dragActive ? -5 : 0 }} className="pointer-events-none">
                <div className="w-16 h-16 bg-emerald-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Dateien hierher ziehen
                </h3>
                <p className="text-slate-500 text-sm mb-4">
                  oder klicken zum Durchsuchen
                </p>
                <p className="text-slate-400 text-xs">
                  JPG, PNG, PDF • Max 10MB
                </p>
              </motion.div>
            </motion.div>

            {/* Info Box */}
            <div className="mt-6 bg-slate-100 rounded-xl p-5">
              <h4 className="font-medium text-slate-900 mb-3">Automatische Funktionen</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  OCR erkennt Händler, Datum, Betrag
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Datei wird automatisch umbenannt
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  SKR04-Konto wird zugewiesen
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Matching mit Bankbuchung
                </li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                Dateiname: YYYYMMDD_Betrag_Kategorie_Händler.pdf
              </p>
            </div>
          </div>

          {/* File List */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Hochgeladene Dateien</h2>
            
            <AnimatePresence>
              {files.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-xl p-8 text-center border border-slate-200"
                >
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Noch keine Dateien hochgeladen</p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {files.map((file, index) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            file.status === 'matched'
                              ? 'bg-emerald-100'
                              : file.status === 'error'
                              ? 'bg-red-100'
                              : file.status === 'uploading'
                              ? 'bg-slate-100'
                              : 'bg-amber-100'
                          }`}
                        >
                          {file.status === 'matched' ? (
                            <Check className="w-5 h-5 text-emerald-600" />
                          ) : file.status === 'error' ? (
                            <X className="w-5 h-5 text-red-600" />
                          ) : file.status === 'uploading' ? (
                            <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
                          ) : (
                            <File className="w-5 h-5 text-amber-600" />
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          {/* Original Name */}
                          <p className="text-xs text-slate-400 truncate">{file.file.name}</p>
                          
                          {/* New Generated Name */}
                          {file.result?.fileName && (
                            <p className="font-medium text-emerald-700 text-sm truncate" title={file.result.fileName}>
                              → {file.result.fileName}
                            </p>
                          )}
                          
                          <p className="text-xs text-slate-500">
                            {(file.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>

                          {/* Progress Bar */}
                          {file.status === 'uploading' && (
                            <div className="mt-2 bg-slate-100 rounded-full h-1.5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${file.progress}%` }}
                                className="h-full bg-emerald-500 rounded-full"
                              />
                            </div>
                          )}

                          {/* Result */}
                          {file.result && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2 text-sm flex-wrap">
                                {file.result.merchant && (
                                  <span className="text-slate-700 font-medium">{file.result.merchant}</span>
                                )}
                                {file.result.date && (
                                  <span className="text-slate-500 text-xs">
                                    <Calendar className="w-3 h-3 inline mr-1" />
                                    {file.result.date}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm flex-wrap">
                                {file.result.amount && (
                                  <span className="text-slate-900 font-bold">
                                    {file.result.amount.toFixed(2)} €
                                  </span>
                                )}
                                {file.result.category && (
                                  <span className="inline-flex items-center gap-1 text-blue-600 text-xs bg-blue-50 px-2 py-0.5 rounded-full">
                                    <Tag className="w-3 h-3" />
                                    {file.result.category.name}
                                  </span>
                                )}
                                {file.result.skr04Code && (
                                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    SKR04: {file.result.skr04Code}
                                  </span>
                                )}
                                {file.result.matched && (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 text-xs bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" />
                                    Zugeordnet
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {file.error && (
                            <p className="mt-1 text-sm text-red-600">{file.error}</p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-1">
                          {file.status !== 'uploading' && (
                            <button
                              onClick={() => deleteReceipt(file.id, index)}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                            </button>
                          )}
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Summary */}
            {allDone && files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200"
              >
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span className="text-emerald-800 font-medium">
                    {matchedCount} von {files.length} Dateien verarbeitet
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
