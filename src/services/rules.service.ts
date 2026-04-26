import { createClient } from '@supabase/supabase-js';
import type { CategoryDecision } from '../types/categories.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface AccountingRule {
  id: string;
  user_id?: string | null;
  company_name?: string | null;
  merchant_pattern?: string | null;
  keyword_pattern?: string | null;
  purpose_pattern?: string | null;
  category_id?: string | null;
  category_name: string;
  skr04_code: string;
  vat_rate: number;
  needs_review: boolean;
  reason?: string | null;
  source: 'manual' | 'system' | 'accountant';
  active: boolean;
  usage_count: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RuleMatch {
  rule: AccountingRule;
  decision: CategoryDecision;
}

function normalize(value?: string | null): string {
  return (value || '').toLowerCase().trim();
}

function matches(pattern: string | null | undefined, value: string): boolean {
  const normalizedPattern = normalize(pattern);
  if (!normalizedPattern) return false;
  return value.includes(normalizedPattern);
}

export async function findMatchingRule(
  userId: string,
  merchantName?: string,
  purposeNote?: string,
  ocrText?: string,
  tenantId?: string
): Promise<RuleMatch | null> {
  let query = supabase
    .from('accounting_rules')
    .select('*')
    .eq('active', true)
    .order('usage_count', { ascending: false })
    .limit(100);

  query = tenantId
    ? query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    : query.or(`user_id.eq.${userId},user_id.is.null`);

  const { data, error } = await query;

  if (error || !data) return null;

  const merchant = normalize(merchantName);
  const purpose = normalize(purposeNote);
  const text = normalize(`${merchantName || ''} ${purposeNote || ''} ${ocrText || ''}`);

  for (const rule of data as AccountingRule[]) {
    const merchantOk = matches(rule.merchant_pattern, merchant);
    const purposeOk = matches(rule.purpose_pattern, purpose);
    const keywordOk = matches(rule.keyword_pattern, text);

    if (!merchantOk && !purposeOk && !keywordOk) continue;

    await supabase
      .from('accounting_rules')
      .update({ usage_count: (rule.usage_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq('id', rule.id);

    return {
      rule,
      decision: {
        category: {
          id: rule.category_id || rule.skr04_code,
          name: rule.category_name,
          skr04Code: rule.skr04_code,
          description: rule.reason || 'Gelernte Regel',
          vatRate: Number(rule.vat_rate || 19),
          keywords: []
        },
        confidence: 'high',
        needsReview: rule.needs_review,
        reason: rule.reason || 'Gelernte Regel angewendet.',
        suggestedQuestions: rule.needs_review ? ['Bitte gelernte Regel fachlich prüfen.'] : []
      }
    };
  }

  return null;
}

export async function listRules(userId: string, tenantId?: string): Promise<AccountingRule[]> {
  let query = supabase
    .from('accounting_rules')
    .select('*')
    .order('created_at', { ascending: false });

  query = tenantId
    ? query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    : query.or(`user_id.eq.${userId},user_id.is.null`);

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as AccountingRule[];
}

export async function createRule(userId: string, input: Partial<AccountingRule>, tenantId?: string): Promise<AccountingRule> {
  const { data, error } = await supabase
    .from('accounting_rules')
    .insert({
      user_id: userId,
      tenant_id: tenantId || null,
      merchant_pattern: input.merchant_pattern || null,
      keyword_pattern: input.keyword_pattern || null,
      purpose_pattern: input.purpose_pattern || null,
      category_id: input.category_id || null,
      category_name: input.category_name,
      skr04_code: input.skr04_code,
      vat_rate: input.vat_rate ?? 19,
      needs_review: input.needs_review ?? false,
      reason: input.reason || 'Manuell gemerkt.',
      source: input.source || 'manual',
      active: input.active ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AccountingRule;
}

export async function updateRule(userId: string, id: string, input: Partial<AccountingRule>, tenantId?: string): Promise<AccountingRule> {
  let query = supabase
    .from('accounting_rules')
    .update(input)
    .eq('id', id);

  query = tenantId ? query.eq('tenant_id', tenantId) : query.eq('user_id', userId);

  const { data, error } = await query.select().single();

  if (error) throw error;
  return data as AccountingRule;
}
