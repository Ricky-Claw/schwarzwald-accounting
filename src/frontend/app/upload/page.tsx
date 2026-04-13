'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, Check, Camera, File } from 'lucide-react';
import Link from 'next/link';
import { Hernie } from '../components/Hernie';

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

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

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

    // Upload each file
    newFiles.forEach((file) => uploadFile(file));
  };

  const uploadFile = async (fileObj: UploadingFile) => {
    try {
      const formData = new FormData();
      formData.append('file', fileObj.file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, progress: Math.min(f.progress + 10, 90) }
              : f
          )
        );
      }, 200);

      const response = await fetch('/api/accounting/receipts', {
        method: 'POST',
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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 p-6">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-8">
        <Link href="/dashboard" className="text-orange-600 hover:text-orange-800 mb-4 inline-block">
          ← Zurück zum Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-bold text-orange-800">Belege hochladen</h1>
          <Hernie
            mood={allDone ? 'excited' : 'happy'}
            message={
              allDone
                ? matchedCount > 0
                  ? `${matchedCount} automatisch zugeordnet! 🎉`
                  : 'Fertig! Ich ordne die Belege zu...'
                : 'Lad deine Belege hoch! Ich erkenne alles automatisch ✨'
            }
          />
        </div>
      </header>

      {/* Upload Zone */}
      <div className="max-w-4xl mx-auto">
        <motion.div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          animate={{
            scale: dragActive ? 1.02 : 1,
            borderColor: dragActive ? '#f97316' : '#fed7aa',
          }}
          className={`relative bg-white/80 backdrop-blur rounded-3xl border-4 border-dashed p-12 text-center transition-colors ${
            dragActive ? 'border-orange-500 bg-orange-50' : 'border-orange-200'
          }`}
        >
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <motion.div
            animate={{ y: dragActive ? -10 : 0 }}
            className="pointer-events-none"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-orange-300 to-pink-300 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg">
              <Camera className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Fotos hierher ziehen oder klicken
            </h3>
            <p className="text-gray-600">
              Unterstützt: JPG, PNG, PDF • Max 10MB pro Datei
            </p>
          </motion.div>
        </motion.div>

        {/* File List */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 space-y-3"
            >
              <h3 className="font-bold text-gray-800 mb-4">Hochgeladene Belege</h3>

              {files.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white rounded-2xl p-4 shadow-md border-2 border-gray-100 flex items-center gap-4"
                >
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      file.status === 'matched'
                        ? 'bg-green-100'
                        : file.status === 'error'
                        ? 'bg-red-100'
                        : 'bg-orange-100'
                    }`}
                  >
                    {file.status === 'matched' ? (
                      <Check className="w-6 h-6 text-green-600" />
                    ) : file.status === 'error' ? (
                      <X className="w-6 h-6 text-red-600" />
                    ) : (
                      <FileText className="w-6 h-6 text-orange-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 truncate">
                      {file.file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    {/* Result */}
                    {file.result && (
                      <div className="mt-1 text-sm">
                        {file.result.merchant && (
                          <span className="text-purple-600">{file.result.merchant} • </span>
                        )}
                        {file.result.amount && (
                          <span className="text-gray-700">{file.result.amount.toFixed(2)} €</span>
                        )}
                        {file.result.matched && (
                          <span className="ml-2 text-green-600 font-medium">✓ Zugeordnet</span>
                        )}
                      </div>
                    )}

                    {/* Progress */}
                    {file.status === 'uploading' && (
                      <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${file.progress}%` }}
                          className="h-full bg-gradient-to-r from-orange-400 to-pink-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 border-2 border-purple-200"
        >
          <h4 className="font-bold text-purple-800 mb-2">💡 Hernies Tipps</h4>
          <ul className="text-purple-700 space-y-1 text-sm">
            <li>• Achte auf gute Beleuchtung beim Fotografieren</li>
            <li>• Der gesamte Beleg sollte sichtbar sein</li>
            <li>• Ich erkenne Datum und Betrag automatisch!</li>
            <li>• PDFs von E-Mail ebenfalls möglich</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
