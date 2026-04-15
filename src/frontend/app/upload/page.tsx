'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, Check, ArrowLeft, Loader2, File } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

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
  };
  error?: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUser();
  }, []);

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
      if (!userId) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, status: 'error', error: 'Nicht eingeloggt' }
              : f
          )
        );
        return;
      }

      const formData = new FormData();
      formData.append('file', fileObj.file);

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
          'x-user-id': userId,
        },
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();

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

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

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
              <h4 className="font-medium text-slate-900 mb-3">Unterstützte Dokumente</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Rechnungen & Belege
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Kontoauszüge (PDF)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Quittungen & Zahlungsbelege
                </li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                Die OCR erkennt automatisch ob es sich um einen Beleg oder Kontoauszug handelt.
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
                  {files.map((file) => (
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
                          <p className="font-medium text-slate-900 truncate">{file.file.name}</p>
                          <p className="text-sm text-slate-500">
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
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              {file.result.merchant && (
                                <span className="text-slate-700">{file.result.merchant}</span>
                              )}
                              {file.result.amount && (
                                <span className="text-slate-900 font-medium">
                                  {file.result.amount.toFixed(2)} €
                                </span>
                              )}
                              {file.result.matched && (
                                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs bg-emerald-50 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" />
                                  Zugeordnet
                                </span>
                              )}
                            </div>
                          )}

                          {file.error && (
                            <p className="mt-1 text-sm text-red-600">{file.error}</p>
                          )}
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
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
                    {matchedCount} von {files.length} Dateien automatisch zugeordnet
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
