import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export function createUserApiKey(): string {
  return `lanista_user_${crypto.randomBytes(24).toString('base64url')}`;
}

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'accountant' | 'member';
  canUpload: boolean;
  canExport: boolean;
  canManageRules: boolean;
  canManageUsers: boolean;
}

export async function ensureDefaultTenant(): Promise<TenantContext> {
  const defaultEmail = 'owner@lanista.local';

  const { data: user, error: userError } = await supabase
    .from('accounting_users')
    .upsert({ id: DEFAULT_USER_ID, email: defaultEmail, display_name: 'Lanista Admin', first_login_completed: true }, { onConflict: 'id' })
    .select()
    .single();

  if (userError) throw userError;

  const { data: existingMembership, error: membershipError } = await supabase
    .from('accounting_memberships')
    .select('*, tenant:tenant_id(*)')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;

  let membership = existingMembership;

  if (!membership) {
    const { data: tenant, error: tenantError } = await supabase
      .from('accounting_tenants')
      .insert({
        name: 'Lanista Ecom UG',
        legal_name: 'Lanista Ecom UG',
        created_by: user.id,
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    const { data: createdMembership, error: createMembershipError } = await supabase
      .from('accounting_memberships')
      .insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: 'owner',
        can_upload: true,
        can_export: true,
        can_manage_rules: true,
        can_manage_users: true,
      })
      .select('*, tenant:tenant_id(*)')
      .single();

    if (createMembershipError) throw createMembershipError;
    membership = createdMembership;
  }

  await backfillTenant(membership.tenant_id, user.id);

  return {
    userId: user.id,
    tenantId: membership.tenant_id,
    role: membership.role,
    canUpload: membership.can_upload,
    canExport: membership.can_export,
    canManageRules: membership.can_manage_rules,
    canManageUsers: membership.can_manage_users,
  };
}

export async function getTenantContext(userId = DEFAULT_USER_ID, tenantId?: string): Promise<TenantContext> {
  await ensureDefaultTenant();

  let query = supabase
    .from('accounting_memberships')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No active tenant membership');

  return {
    userId,
    tenantId: data.tenant_id,
    role: data.role,
    canUpload: data.can_upload,
    canExport: data.can_export,
    canManageRules: data.can_manage_rules,
    canManageUsers: data.can_manage_users,
  };
}

async function backfillTenant(tenantId: string, userId: string) {
  await Promise.all([
    supabase.from('bank_statements').update({ tenant_id: tenantId }).eq('user_id', userId).is('tenant_id', null),
    supabase.from('bank_transactions').update({ tenant_id: tenantId }).eq('user_id', userId).is('tenant_id', null),
    supabase.from('invoices').update({ tenant_id: tenantId }).eq('user_id', userId).is('tenant_id', null),
    supabase.from('receipts').update({ tenant_id: tenantId }).is('tenant_id', null),
    supabase.from('accounting_exports').update({ tenant_id: tenantId }).eq('user_id', userId).is('tenant_id', null),
    supabase.from('accounting_rules').update({ tenant_id: tenantId }).eq('user_id', userId).is('tenant_id', null),
  ]);
}

export async function listTenants(userId: string) {
  const { data, error } = await supabase
    .from('accounting_memberships')
    .select('*, tenant:tenant_id(*)')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateTenant(ctx: TenantContext, input: any) {
  if (!ctx.canManageUsers) throw new Error('Missing permission: manage users');

  const allowed = ['name', 'legal_name', 'tax_number', 'vat_id', 'address', 'fiscal_year_start_month'];
  const updates = Object.fromEntries(
    Object.entries(input).filter(([key]) => allowed.includes(key))
  );
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('accounting_tenants')
    .update(updates)
    .eq('id', ctx.tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listTenantMembers(ctx: TenantContext) {
  if (!ctx.canManageUsers) throw new Error('Missing permission: manage users');

  const { data, error } = await supabase
    .from('accounting_memberships')
    .select('*, user:user_id(email, display_name, last_login_at, created_at)')
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function listOpenInvites(ctx: TenantContext) {
  if (!ctx.canManageUsers) throw new Error('Missing permission: manage users');

  const { data, error } = await supabase
    .from('accounting_invites')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createInvite(ctx: TenantContext, input: any) {
  if (!ctx.canManageUsers) throw new Error('Missing permission: manage users');

  const role = input.role || 'member';
  const token = crypto.randomBytes(18).toString('base64url');
  const canUpload = input.can_upload ?? true;
  const canExport = input.can_export ?? true;
  const canManageRules = input.can_manage_rules ?? (role === 'owner' || role === 'admin');
  const canManageUsers = input.can_manage_users ?? (role === 'owner' || role === 'admin');

  const { data, error } = await supabase
    .from('accounting_invites')
    .insert({
      token,
      tenant_id: input.tenant_id || ctx.tenantId,
      role,
      email: input.email || null,
      can_upload: canUpload,
      can_export: canExport,
      can_manage_rules: canManageRules,
      can_manage_users: canManageUsers,
      created_by: ctx.userId,
      expires_at: input.expires_at || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function findUserByApiKey(apiKey: string) {
  const { data, error } = await supabase
    .from('accounting_users')
    .select('*')
    .eq('api_key', apiKey)
    .single();

  if (error || !data) return null;

  await supabase
    .from('accounting_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

export async function acceptInvite(token: string, input: any) {
  const { data: invite, error: inviteError } = await supabase
    .from('accounting_invites')
    .select('*')
    .eq('token', token)
    .eq('status', 'open')
    .single();

  if (inviteError || !invite) throw new Error('Invite not found or not open');

  const email = input.email || invite.email;
  if (!email) throw new Error('email required');

  const apiKey = createUserApiKey();

  const { data: user, error: userError } = await supabase
    .from('accounting_users')
    .upsert({ email, display_name: input.display_name || email, first_login_completed: true, api_key: apiKey }, { onConflict: 'email' })
    .select()
    .single();

  if (userError) throw userError;

  await supabase
    .from('accounting_memberships')
    .upsert({
      tenant_id: invite.tenant_id,
      user_id: user.id,
      role: invite.role,
      can_upload: invite.can_upload,
      can_export: invite.can_export,
      can_manage_rules: invite.can_manage_rules,
      can_manage_users: invite.can_manage_users,
      active: true,
    }, { onConflict: 'tenant_id,user_id' });

  await supabase
    .from('accounting_invites')
    .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  return { user, tenantId: invite.tenant_id, role: invite.role, apiKey: user.api_key || apiKey };
}
