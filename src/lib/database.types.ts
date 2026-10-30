/* Elle yazılmış şema tipleri — supabase/migrations/0001_init.sql ile uyumlu.
   Supabase CLI ile `supabase gen types typescript` çıktısıyla değiştirilebilir. */

export type AppRole = "owner" | "manager" | "reception" | "staff";
export type VisitStatus = "pending" | "confirmed" | "arrived" | "completed" | "no_show" | "cancelled";
export type VisitSource = "salon" | "phone" | "whatsapp" | "online" | "instagram" | "dikidi" | "walk_in";
export type PayMethod = "cash" | "card" | "transfer" | "online" | "package" | "gift_card" | "points" | "balance" | "other";

type Timestamps = { created_at: string; updated_at: string };

export type Profile = {
  id: string; full_name: string; role: AppRole; staff_id: string | null; locale: string;
} & Timestamps;

export type Settings = {
  id: number; business_name: string; tagline: string; currency: string; timezone: string;
  slot_minutes: number; open_time: string; close_time: string; open_days: number[];
  online_booking_enabled: boolean; online_requires_approval: boolean; online_min_notice_minutes: number;
  online_max_days_ahead: number; online_cancel_limit_minutes: number; kdv_rate: number;
  whatsapp_number: string; instagram_url: string; google_review_url: string; import_token: string; loyalty_earn_percent: number; loyalty_point_value: number; loyalty_max_pay_percent: number; payroll_start: string; referral_inviter_points: number; referral_invitee_discount: number; package_default_months: number; updated_at: string;
};

export type ServiceCategory = {
  id: string; code: string | null; name_tr: string; name_en: string; name_ru: string; sort_order: number;
  color: string; online_visible: boolean; is_active: boolean;
} & Timestamps;

export type Service = {
  id: string; category_id: string | null; code: string | null;
  name_tr: string; name_en: string; name_ru: string;
  description_tr: string; description_en: string; description_ru: string;
  duration_min: number; buffer_min: number; price: number; price_min: number | null;
  session_count: number; kind: "service" | "package" | "consultation" | "product_like";
  online_visible: boolean; is_active: boolean; requires_consultation: boolean; sort_order: number;
  dikidi_id: string | null;
} & Timestamps;

export type Staff = {
  id: string; full_name: string; title: string; title_en: string; title_ru: string; schedule_mode: "weekly" | "daily"; dikidi_master_id: string | null; phone: string; color: string; photo_url: string | null;
  languages: string[]; online_bookable: boolean; pay_model: "daily_prim" | "percent" | "fixed";
  pay_percent: number; product_percent: number; is_active: boolean; sort_order: number; dikidi_id: string | null;
} & Timestamps;

export type StaffSchedule = { id: string; staff_id: string; weekday: number; start_time: string; end_time: string };
export type StaffTimeOff = { id: string; staff_id: string; starts_at: string; ends_at: string; reason: string };
export type Resource = { id: string; name: string; kind: "room" | "device" | "other"; capacity: number; is_active: boolean; sort_order: number };

export type Customer = {
  id: string; first_name: string; last_name: string; phone: string; email: string; gender: "" | "f" | "m" | "x";
  birth_date: string | null; locale: string; nationality: string; source: string; tags: string[];
  notes: string; health_notes: string; consent_marketing: boolean; consent_at: string | null;
  is_blocked: boolean; no_show_count: number; discount_percent: number; balance: number; dikidi_id: string | null; loyalty_points: number;
  card_no: string; dikidi_source: string; referred_by: string | null; health_flags: string[];
} & Timestamps;

export type Visit = {
  id: string; customer_id: string | null; visit_date: string; status: VisitStatus; source: VisitSource;
  notes: string; internal_notes: string; discount_percent: number; prepaid_amount: number; created_by: string | null; import_ref: string | null;
  color: string; is_anonymous: boolean; remind_offsets: number[]; remind_confirm: boolean; review_request: string; promo_code: string; review_token: string;
} & Timestamps;

export type VisitItem = {
  id: string; visit_id: string; service_id: string | null; service_name: string; staff_id: string | null;
  resource_id: string | null; starts_at: string; ends_at: string; price: number; discount: number;
  status: VisitStatus; package_id: string | null; notes: string; break_min: number; dikidi_id: string | null; booked_by_staff_id: string | null;
} & Timestamps;

export type CustomerPackage = {
  id: string; customer_id: string; service_id: string | null; name: string; total_sessions: number;
  used_sessions: number; price_paid: number; purchased_at: string; expires_at: string | null; notes: string; created_at: string; sale_id: string | null; is_active: boolean;
};

export type Expense = {
  id: string; expense_date: string; category: string; description: string; amount: number; method: PayMethod;
  staff_id: string | null; created_by: string | null; created_at: string; dikidi_id: string | null;
};
export type Sale = {
  id: string; visit_id: string | null; customer_id: string | null; sale_date: string; subtotal: number; discount: number;
  total: number; notes: string; created_by: string | null; created_at: string; dikidi_id: string | null;
};
export type SalePayment = { id: string; sale_id: string; method: PayMethod; amount: number; ref: string };
export type SaleItem = {
  id: string; sale_id: string; visit_item_id: string | null; product_id: string | null; kind: "service" | "product" | "package" | "gift_card" | "balance"; name: string; staff_id: string | null;
  qty: number; unit_price: number; discount: number; total: number; material_cost: number; dikidi_pay: number | null; staff_name: string;
};
export type StaffPayout = {
  id: string; staff_id: string; period_start: string; period_end: string; amount: number; method: PayMethod; notes: string;
  paid_at: string; created_by: string | null; created_at: string; dikidi_id: string | null;
};

export type StaffPayScheme = {
  id: string; staff_id: string; valid_from: string;
  service_percent: number; product_percent: number; service_deduct_discount: boolean; product_deduct_discount: boolean; service_deduct_materials: boolean;
  company_service_percent: number; company_product_percent: number; company_deduct_discount: boolean; company_exclude_own: boolean; company_only_on_shift: boolean;
  booking_service_percent: number; booking_product_percent: number; booking_exclude_own: boolean;
  daily_wage: number; daily_guarantee: number; notes: string; dikidi_id: string | null; created_at: string;
};
export type StaffAdjustment = { id: string; staff_id: string; adj_date: string; amount: number; note: string; created_by: string | null; created_at: string };
export type Campaign = { id: string; name: string; segment: Record<string, unknown>; body_tr: string; body_en: string; body_ru: string; created_by: string | null; created_at: string };
export type CashAccount = { id: string; name: string; kind: "cash" | "bank"; opening_balance: number; opening_date: string; sort_order: number; is_active: boolean; created_at: string };
export type CashAdjustment = { id: string; account_id: string; adj_date: string; amount: number; note: string; created_by: string | null; created_at: string };
export type SyncRun = { id: string; source: string; started_at: string; finished_at: string | null; range_from: string | null; range_to: string | null; report: Record<string, unknown>; ok: boolean };

export type GiftCard = { id: string; template_id: string | null; code: string; initial_amount: number; balance: number; buyer_name: string; customer_id: string | null; sale_id: string | null; expires_at: string | null; notes: string; created_by: string | null; created_at: string };
export type GiftCardUse = { id: string; gift_card_id: string; sale_id: string | null; amount: number; created_at: string };
export type Product = {
  id: string; name: string; brand: string; category: string; barcode: string; unit: string; sale_price: number; cost_price: number;
  stock_qty: number; min_stock: number; is_retail: boolean; is_active: boolean; notes: string;
  dikidi_id: string | null; use_price: number; material_qty: number; material_unit: string; last_purchase_at: string | null;
} & Timestamps;
export type Review = { id: string; customer_id: string | null; author_name: string; staff_id: string | null; rating: number; body: string; reply: string; is_public: boolean; source: string; dikidi_id: string | null; created_at: string; visit_id: string | null; handled: boolean };
export type CustomerNote = { id: string; customer_id: string; body: string; created_by: string | null; created_at: string };
export type CustomerPhoto = { id: string; customer_id: string; storage_path: string; caption: string; taken_at: string; created_at: string; kind: "before" | "after" | "other"; visit_id: string | null; created_by: string | null };
export type ClientForm = {
  id: string; customer_id: string; visit_id: string | null; form_key: string; form_date: string; status: "pending" | "signed" | "completed";
  data: Record<string, unknown>; signatures: { client?: string; staff?: string }; flags: string[]; staff_name: string; staff_id: string | null;
  token: string | null; lang: string; signed_at: string | null; created_by: string | null; created_at: string; updated_at: string;
};
export type ClientSession = { id: string; customer_id: string; visit_id: string | null; kind: string; session_date: string; fields: Record<string, string>; staff_name: string; created_by: string | null; created_at: string };
export type CareGuideGiven = { id: string; customer_id: string; visit_id: string | null; guide_key: string; given_at: string; created_by: string | null; created_at: string };
export type GiftCardTemplate = { id: string; name: string; usage: "service" | "product" | "both"; amount: number; open_amount: boolean; valid_days: number; bonus_percent: number; sale_from: string | null; sale_to: string | null; sale_limit: number; online: boolean; is_active: boolean; created_at: string };
export type Supplier = { id: string; name: string; phone: string; notes: string; dikidi_name: string | null; created_at: string };
export type Warehouse = { id: string; name: string; responsible_staff_id: string | null; is_active: boolean; dikidi_name: string | null; created_at: string };
export type StockMove = { id: string; product_id: string; kind: "purchase" | "sale" | "use" | "adjust" | "return"; qty: number; unit_cost: number | null; note: string; sale_id: string | null; staff_id: string | null; created_by: string | null; created_at: string };
export type PromoCode = { code: string; percent: number; description: string; valid_until: string | null; is_active: boolean; created_at: string };
export type VisitFile = { id: string; visit_id: string; customer_id: string | null; storage_path: string; file_name: string; mime: string; size_bytes: number; created_by: string | null; created_at: string };
export type AuditLog = { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; diff: unknown; created_at: string };
export type BalanceLedger = { id: string; customer_id: string; amount: number; reason: string; sale_id: string | null; created_by: string | null; created_at: string };
export type LoyaltyLedger = { id: string; customer_id: string; points: number; reason: string; sale_id: string | null; created_at: string };
export type MessageTemplate = { kind: string; locale: string; body: string; updated_at: string };
export type MessageLog = { id: string; customer_id: string | null; visit_id: string | null; kind: string; channel: string; body: string; sent_at: string; sent_by: string | null };

export type BookingRequest = {
  id: string; first_name: string; last_name: string; phone: string; email: string; locale: string;
  service_id: string; staff_id: string | null; starts_at: string; notes: string;
  status: "new" | "approved" | "rejected" | "expired"; visit_id: string | null; ip_hash: string; created_at: string;
};

export type WaState = "offline" | "starting" | "qr" | "connected" | "reconnecting" | "logged_out";
export type WaBridge = {
  id: number; token_hash: string | null; token_created_at: string | null; state: WaState; qr: string | null; phone: string | null;
  push_name: string | null; version: string | null; host: string | null; error: string | null; last_seen: string | null;
  command: "logout" | "restart" | null; send_enabled: boolean; updated_at: string;
};
export type WaOutbox = {
  id: string; to_phone: string; body: string; kind: string | null; visit_id: string | null; customer_id: string | null;
  status: "queued" | "sending" | "sent" | "failed" | "cancelled"; error: string | null; created_at: string; sent_at: string | null; created_by: string | null;
};

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };
type R<N extends string, C extends string, T extends string> = { foreignKeyName: N; columns: [C]; isOneToOne: false; referencedRelation: T; referencedColumns: ["id"] };

type Tbl<Row, Opt extends keyof Row = never, Rels extends Rel[] = []> = {
  Row: Row;
  Insert: Omit<Row, Opt | "id" | "created_at" | "updated_at"> & Partial<Pick<Row, Extract<Opt | "id" | "created_at" | "updated_at", keyof Row>>>;
  Update: Partial<Row>;
  Relationships: Rels;
};

export type Database = {
  public: {
    Tables: {
      profiles: Tbl<Profile, "full_name" | "role" | "staff_id" | "locale">;
      settings: Tbl<Settings, keyof Settings>;
      service_categories: Tbl<ServiceCategory, "code" | "name_en" | "name_ru" | "sort_order" | "color" | "online_visible" | "is_active">;
      services: Tbl<Service, Exclude<keyof Service, "name_tr">, [R<"services_category_id_fkey","category_id","service_categories">]>;
      staff: Tbl<Staff, Exclude<keyof Staff, "full_name">>;
      staff_schedules: Tbl<StaffSchedule>;
      staff_time_off: Tbl<StaffTimeOff, "reason">;
      resources: Tbl<Resource, "kind" | "capacity" | "is_active" | "sort_order">;
      staff_services: { Row: { staff_id: string; service_id: string; price_override: number | null; duration_override: number | null; online: boolean }; Insert: { staff_id: string; service_id: string; price_override?: number | null; duration_override?: number | null; online?: boolean }; Update: Partial<{ staff_id: string; service_id: string; price_override: number | null; duration_override: number | null; online: boolean }>; Relationships: [] };
      staff_day_hours: { Row: { staff_id: string; day: string; start_time: string; end_time: string; source: string }; Insert: { staff_id: string; day: string; start_time: string; end_time: string; source?: string }; Update: Partial<{ staff_id: string; day: string; start_time: string; end_time: string; source: string }>; Relationships: [] };
      service_resources: { Row: { service_id: string; resource_id: string }; Insert: { service_id: string; resource_id: string }; Update: Partial<{ service_id: string; resource_id: string }>; Relationships: [] };
      customers: Tbl<Customer, Exclude<keyof Customer, "first_name">>;
      client_forms: Tbl<ClientForm, "visit_id" | "form_date" | "status" | "data" | "signatures" | "flags" | "staff_name" | "staff_id" | "token" | "lang" | "signed_at" | "created_by", [R<"client_forms_customer_id_fkey","customer_id","customers">, R<"client_forms_visit_id_fkey","visit_id","visits">]>;
      client_sessions: Tbl<ClientSession, "visit_id" | "session_date" | "fields" | "staff_name" | "created_by", [R<"client_sessions_customer_id_fkey","customer_id","customers">]>;
      care_guides_given: Tbl<CareGuideGiven, "visit_id" | "given_at" | "created_by", [R<"care_guides_given_customer_id_fkey","customer_id","customers">]>;
      customer_notes: Tbl<CustomerNote, "created_by", [R<"customer_notes_customer_id_fkey","customer_id","customers">, R<"customer_notes_created_by_fkey","created_by","profiles">]>;
      customer_photos: Tbl<CustomerPhoto, "caption" | "taken_at" | "kind" | "visit_id" | "created_by", [R<"customer_photos_customer_id_fkey","customer_id","customers">]>;
      visits: Tbl<Visit, Exclude<keyof Visit, "visit_date">, [R<"visits_customer_id_fkey","customer_id","customers">]>;
      visit_items: Tbl<VisitItem, "service_id" | "staff_id" | "resource_id" | "price" | "discount" | "status" | "package_id" | "notes" | "break_min" | "dikidi_id" | "booked_by_staff_id", [R<"visit_items_visit_id_fkey","visit_id","visits">, R<"visit_items_staff_id_fkey","staff_id","staff">, R<"visit_items_service_id_fkey","service_id","services">]>;
      customer_packages: Tbl<CustomerPackage, "service_id" | "used_sessions" | "price_paid" | "purchased_at" | "expires_at" | "notes" | "sale_id" | "is_active", [R<"customer_packages_customer_id_fkey","customer_id","customers">]>;
      expenses: Tbl<Expense, "expense_date" | "category" | "description" | "method" | "staff_id" | "created_by" | "dikidi_id", [R<"expenses_staff_id_fkey","staff_id","staff">]>;
      sales: Tbl<Sale, "visit_id" | "customer_id" | "sale_date" | "subtotal" | "discount" | "total" | "notes" | "created_by" | "dikidi_id", [R<"sales_visit_id_fkey","visit_id","visits">, R<"sales_customer_id_fkey","customer_id","customers">]>;
      sale_payments: Tbl<SalePayment, "ref", [R<"sale_payments_sale_id_fkey","sale_id","sales">]>;
      sale_items: Tbl<SaleItem, "visit_item_id" | "product_id" | "kind" | "staff_id" | "qty" | "unit_price" | "discount" | "total" | "material_cost" | "dikidi_pay" | "staff_name", [R<"sale_items_sale_id_fkey","sale_id","sales">, R<"sale_items_staff_id_fkey","staff_id","staff">, R<"sale_items_visit_item_id_fkey","visit_item_id","visit_items">]>;
      staff_payouts: Tbl<StaffPayout, "method" | "notes" | "paid_at" | "created_by" | "dikidi_id", [R<"staff_payouts_staff_id_fkey","staff_id","staff">]>;
      staff_pay_schemes: Tbl<StaffPayScheme, Exclude<keyof StaffPayScheme, "staff_id" | "valid_from">, [R<"staff_pay_schemes_staff_id_fkey","staff_id","staff">]>;
      staff_adjustments: Tbl<StaffAdjustment, "adj_date" | "note" | "created_by", [R<"staff_adjustments_staff_id_fkey","staff_id","staff">]>;
      campaigns: Tbl<Campaign, "segment" | "body_tr" | "body_en" | "body_ru" | "created_by">;
      cash_accounts: Tbl<CashAccount, Exclude<keyof CashAccount, "name" | "kind">>;
      cash_adjustments: Tbl<CashAdjustment, "adj_date" | "note" | "created_by", [R<"cash_adjustments_account_id_fkey","account_id","cash_accounts">]>;
      sync_runs: Tbl<SyncRun, Exclude<keyof SyncRun, "id">>;
      gift_cards: Tbl<GiftCard, "template_id" | "buyer_name" | "customer_id" | "sale_id" | "expires_at" | "notes" | "created_by", [R<"gift_cards_customer_id_fkey","customer_id","customers">, R<"gift_cards_sale_id_fkey","sale_id","sales">]>;
      gift_card_uses: Tbl<GiftCardUse, "sale_id", [R<"gift_card_uses_gift_card_id_fkey","gift_card_id","gift_cards">]>;
      products: Tbl<Product, Exclude<keyof Product, "name">>;
      suppliers: Tbl<Supplier, Exclude<keyof Supplier, "name">>;
      reviews: Tbl<Review, Exclude<keyof Review, "id">, [R<"reviews_customer_id_fkey","customer_id","customers">, R<"reviews_staff_id_fkey","staff_id","staff">]>;
      gift_card_templates: Tbl<GiftCardTemplate, Exclude<keyof GiftCardTemplate, "name" | "amount">>;
      warehouses: Tbl<Warehouse, Exclude<keyof Warehouse, "name">>;
      stock_moves: Tbl<StockMove, "unit_cost" | "note" | "sale_id" | "staff_id" | "created_by", [R<"stock_moves_product_id_fkey","product_id","products">, R<"stock_moves_staff_id_fkey","staff_id","staff">]>;
      promo_codes: { Row: PromoCode; Insert: Partial<PromoCode> & { code: string; percent: number }; Update: Partial<PromoCode>; Relationships: [] };
      visit_files: Tbl<VisitFile, "customer_id" | "mime" | "size_bytes" | "created_by", [R<"visit_files_visit_id_fkey","visit_id","visits">]>;
      audit_log: { Row: AuditLog; Insert: { actor_id?: string | null; action: string; entity: string; entity_id?: string | null; diff?: unknown }; Update: Partial<AuditLog>; Relationships: [] };
      balance_ledger: Tbl<BalanceLedger, "reason" | "sale_id" | "created_by", [R<"balance_ledger_customer_id_fkey","customer_id","customers">]>;
      loyalty_ledger: Tbl<LoyaltyLedger, "reason" | "sale_id", [R<"loyalty_ledger_customer_id_fkey","customer_id","customers">]>;
      message_templates: { Row: MessageTemplate; Insert: { kind: string; locale: string; body: string; updated_at?: string }; Update: Partial<MessageTemplate>; Relationships: [] };
      message_log: Tbl<MessageLog, "customer_id" | "visit_id" | "channel" | "body" | "sent_at" | "sent_by", [R<"message_log_customer_id_fkey","customer_id","customers">, R<"message_log_visit_id_fkey","visit_id","visits">]>;
      booking_requests: Tbl<BookingRequest, "last_name" | "email" | "locale" | "staff_id" | "notes" | "status" | "visit_id" | "ip_hash", [R<"booking_requests_service_id_fkey","service_id","services">, R<"booking_requests_staff_id_fkey","staff_id","staff">]>;
      wa_bridge: Tbl<WaBridge, Exclude<keyof WaBridge, "id">>;
      wa_outbox: Tbl<WaOutbox, "kind" | "visit_id" | "customer_id" | "status" | "error" | "sent_at" | "created_by", [R<"wa_outbox_visit_id_fkey","visit_id","visits">, R<"wa_outbox_customer_id_fkey","customer_id","customers">]>;
    };
    Views: {
      customer_list: { Row: { id: string; first_name: string; last_name: string; phone: string; tags: string[]; locale: string; no_show_count: number; is_blocked: boolean; balance: number; loyalty_points: number; birth_date: string | null; created_at: string; consent_marketing: boolean; source: string; last_visit: string | null; next_visit: string | null; visits: number; spent: number; packages: number; bday_in: number | null }; Relationships: [] };
      visit_totals: { Row: { visit_id: string; customer_id: string | null; visit_date: string; item_count: number; subtotal: number; total: number }; Relationships: [] };
    };
    Functions: {
      current_role: { Args: Record<string, never>; Returns: AppRole };
      is_manager: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { app_role: AppRole; visit_status: VisitStatus; visit_source: VisitSource; pay_method: PayMethod };
    CompositeTypes: Record<string, never>;
  };
};
