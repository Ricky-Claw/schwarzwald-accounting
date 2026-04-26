'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Mail, Shield, Users } from 'lucide-react';

interface Member {
  id: string;
  role: string;
  can_upload: boolean;
  can_export: boolean;
  can_manage_rules: boolean;
  can_manage_users: boolean;
  user?: {
    email: string;
    display_name: string;
    last_login_at?: string;
  };
}

interface Invite {
  id: string;
  token: string;
  email?: string;
  role: string;
  inviteUrl: string;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('accountant');
  const [createdUrl, setCreatedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com';

  function getHeaders() {
    const apiKey = localStorage.getItem('apiKey') || process.env.NEXT_PUBLIC_API_KEY || 'lanista-secret-key-2024';
    const headers: Record<string, string> = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) headers['x-tenant-id'] = tenantId;
    return headers;
  }

  async function loadMembers() {
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/accounting/tenants/members`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Benutzer konnten nicht geladen werden');
      setMembers(data.members || []);
      setInvites(data.invites || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('apiKey')) {
      router.push('/login');
      return;
    }
    loadMembers();
  }, [router]);

  async function createInvite() {
    setSaving(true);
    setError('');
    setCreatedUrl('');
    try {
      const res = await fetch(`${apiUrl}/api/accounting/tenants/invites`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          email: email || undefined,
          role,
          can_upload: true,
          can_export: true,
          can_manage_rules: role === 'admin' || role === 'owner',
          can_manage_users: role === 'admin' || role === 'owner',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Einladung konnte nicht erstellt werden');
      setCreatedUrl(data.inviteUrl);
      setEmail('');
      await loadMembers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfdf5,_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] p-8">Lade Benutzer...</div>;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfdf5,_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/70 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" /> Zurück
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6" /> Benutzer & Steuerberater</h1>
            <p className="text-sm text-slate-500">Einladungen erstellen und Zugänge prüfen.</p>
          </div>
        </div>
      </header>

      <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

        <section className="bg-white/85 rounded-2xl border border-white/80 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Mail className="w-5 h-5" /> Neue Einladung</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail optional"
              className="border border-slate-300 rounded-lg px-3 py-2"
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2">
              <option value="accountant">Steuerberater</option>
              <option value="member">Mitarbeiter</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={createInvite}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg px-4 py-2 font-medium"
            >
              {saving ? 'Erstelle...' : 'Einladung erstellen'}
            </button>
          </div>
          {createdUrl && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="text-sm font-medium text-emerald-900 mb-2">Einladungslink</div>
              <div className="flex gap-2">
                <input readOnly value={createdUrl} className="flex-1 border border-emerald-200 rounded-lg px-3 py-2 text-sm" />
                <button onClick={() => navigator.clipboard.writeText(createdUrl)} className="px-3 py-2 bg-white border rounded-lg"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white/85 rounded-2xl border border-white/80 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Shield className="w-5 h-5" /> Aktive Benutzer</h2>
          <div className="divide-y divide-slate-100">
            {members.map((member) => (
              <div key={member.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">{member.user?.display_name || member.user?.email || 'Unbekannt'}</div>
                  <div className="text-sm text-slate-500">{member.user?.email} · Rolle: {member.role}</div>
                </div>
                <div className="text-xs text-slate-500">
                  {member.can_upload && 'Upload '} {member.can_export && 'Export '} {member.can_manage_users && 'User-Admin'}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white/85 rounded-2xl border border-white/80 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Offene Einladungen</h2>
          <div className="space-y-3">
            {invites.length === 0 && <p className="text-sm text-slate-500">Keine offenen Einladungen.</p>}
            {invites.map((invite) => (
              <div key={invite.id} className="border border-slate-100 rounded-lg p-3">
                <div className="text-sm font-medium text-slate-900">{invite.email || 'Ohne E-Mail'} · {invite.role}</div>
                <div className="flex gap-2 mt-2">
                  <input readOnly value={invite.inviteUrl} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                  <button onClick={() => navigator.clipboard.writeText(invite.inviteUrl)} className="px-3 py-2 bg-slate-50 border rounded-lg"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </motion.main>
    </div>
  );
}
