// ============================================
// ACCOUNTING TYPES
// ============================================

export interface BankStatement {
  id: string;
  user_id: string;
  account_name: string;
  account_iban?: string;
  statement_date: string;
  file_path?: string;
  file_type: 'pdf' | 'csv' | 'camt';
  status: 'pending' | 'processed' | 'error';
  total_amount?: number;
  transaction_count?: number;
  processed_at?: string;
  error_message?: string;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  statement_id?: string;
  user_id: string;
  transaction_date: string;
  booking_date?: string;
  amount: number;
  currency: string;
  description?: string;
  counterparty_name?: string;
  counterparty_iban?: string;
  reference?: string;
  category_id?: string;
  receipt_id?: string;
  status: 'unmatched' | 'matched' | 'categorized' | 'split';
  is_split: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionCategory {
  id: string;
  user_id?: string;
  code: string;
  name: string;
  name_en?: string;
  account_type: 'income' | 'expense' | 'asset' | 'liability';
  vat_rate: number;
  is_system: boolean;
  parent_id?: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_type: 'incoming' | 'outgoing';
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  partner_name: string;
  partner_address?: string;
  partner_vat_id?: string;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  currency: string;
  vat_rate: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paid_date?: string;
  paid_amount?: number;
  file_path?: string;
  bank_transaction_id?: string;
  category_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  merchant_name?: string;
  receipt_date?: string;
  total_amount?: number;
  vat_amount?: number;
  currency: string;
  category_id?: string;
  bank_transaction_id?: string;
  invoice_id?: string;
  file_path: string;
  ocr_confidence?: number;
  ocr_raw?: Record<string, unknown>;
  ocr_status: 'pending' | 'processing' | 'success' | 'error';
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
}

// ============================================
// AMAZON SELLER CENTRAL TYPES
// ============================================

export interface AmazonDocument {
  id: string;
  user_id: string;
  document_type: AmazonDocumentType;
  file_path: string;
  file_name: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  processed_data?: AmazonProcessedData;
  ocr_confidence?: number;
  created_at: string;
  updated_at: string;
}

export type AmazonDocumentType = 
  | 'settlement_statement'      // Abrechnungsbericht
  | 'transaction_report'        // Transaktionsbericht
  | 'inventory_report'          // Bestandsbericht
  | 'payment_report'            // Zahlungsbericht
  | 'vat_invoice'               // USt-Rechnung
  | 'fee_statement'             // Gebührenübersicht
  | 'advertising_invoice';      // Werberechnung

export interface AmazonProcessedData {
  settlement_id?: string;
  settlement_period_start?: string;
  settlement_period_end?: string;
  total_sales?: number;
  total_refunds?: number;
  total_fees?: number;
  total_advertising?: number;
  net_amount?: number;
  currency?: string;
  transactions?: AmazonTransaction[];
  fees?: AmazonFee[];
}

export interface AmazonTransaction {
  order_id: string;
  transaction_type: 'order' | 'refund' | 'adjustment';
  date: string;
  sku?: string;
  quantity: number;
  product_name?: string;
  sales_price: number;
  fees: number;
  net_amount: number;
}

export interface AmazonFee {
  fee_type: string;
  description: string;
  amount: number;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface UploadStatementRequest {
  account_name: string;
  account_iban?: string;
  statement_date: string;
}

export interface UpdateTransactionRequest {
  category_id?: string;
  status?: 'unmatched' | 'matched' | 'categorized';
}

export interface CreateInvoiceRequest {
  invoice_type: 'incoming' | 'outgoing';
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  partner_name: string;
  net_amount: number;
  vat_rate?: number;
  category_id?: string;
}

export interface ProcessAmazonDocumentRequest {
  document_type: AmazonDocumentType;
}

export interface ExportRequest {
  type: 'datev' | 'csv' | 'excel';
  period_start: string;
  period_end: string;
}

// ============================================
// OCR TYPES
// ============================================

export interface OCRResult {
  success: boolean;
  merchant_name?: string;
  date?: string;
  total_amount?: number;
  vat_amount?: number;
  vat_rate?: number;
  currency?: string;
  receipt_number?: string;
  payment_method?: string;
  items?: OCRItem[];
  confidence: number;
  raw?: Record<string, unknown>;
  error?: string;
}

export interface OCRItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total_price: number;
}

export interface AmazonOCRResult {
  success: boolean;
  document_type: AmazonDocumentType;
  settlement_id?: string;
  period_start?: string;
  period_end?: string;
  total_sales?: number;
  total_refunds?: number;
  total_fees?: number;
  net_amount?: number;
  currency: string;
  confidence: number;
  transactions: AmazonTransaction[];
  raw?: Record<string, unknown>;
  error?: string;
}
