'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, UserPlus } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const invite = params.get('invite') || '';
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';
      const response = await fetch(`${apiUrl}/api/accounting/tenants/invites/${invite}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, display_name: displayName || email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Einladung konnte nicht angenommen werden');

      localStorage.setItem('apiKey', data.apiKey);
      if (data.tenantId) localStorage.setItem('tenantId', data.tenantId);
      setDone(true);
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-xl mx-auto mb-4 flex items-center justify-center">
            {done ? <CheckCircle className="w-8 h-8 text-emerald-600" /> : <UserPlus className="w-8 h-8 text-emerald-600" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Lanista Zugang einrichten</h1>
          <p className="text-slate-500 mt-2">Daten selbst eintragen, danach bist du direkt im passenden Mandanten.</p>
        </div>

        {!invite ? (
          <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm">Einladungslink fehlt.</div>
        ) : done ? (
          <div className="bg-emerald-50 text-emerald-700 rounded-lg p-4 text-sm text-center">Zugang erstellt. Weiterleitung...</div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="name@example.com"
                required
              />
            </div>

            {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Zugang erstellen
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
