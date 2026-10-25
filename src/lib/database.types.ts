/* Elle yazılmış şema tipleri — supabase/migrations/0001_init.sql ile uyumlu.
   Supabase CLI ile `supabase gen types typescript` çıktısıyla değiştirilebilir. */

export type AppRole = "owner" | "manager" | "reception" | "staff";
export type VisitStatus = "pending" | "confirmed" | "arrived" | "completed" | "no_show" | "cancelled";
export type VisitSource = "salon" | "phone" | "whatsapp" | "online" | "instagram" | "dikidi" | "walk_in";
export type PayMethod = "cash" | "card" | "transfer" | "online" | "package" | "gift_card" | "other";

type Timestamps = { created_at: string; updated_at: string };

export type Profile = {
  id: string; full_name: string; role: AppRole; staff_id: string | null; locale: string;
} & Timestamps;

export type Settings = {
  id: number; business_name: string; tagline: string; currency: string; timezone: string;
  slot_minutes: number; open_time: string; close_time: string; open_days: number[];
  online_booking_enabled: boolean; online_requires_approval: boolean; online_min_notice_minutes: number;
  online_max_days_ahead: number; online_cancel_limit_minutes: number; kdv_rate: number;
  whatsapp_number: string; instagram_url: string; google_review_url: string; import_token: string; updated_at: string;
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
  id: string; full_name: string; title: string; phone: string; color: string; photo_url: string | null;
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
  is_blocked: boolean; no_show_count: number; discount_percent: number; balance: number; dikidi_id: string | null;
} & Timestamps;

export type Visit = {
  id: string; customer_id: string | null; visit_date: string; status: VisitStatus; source: VisitSource;
  notes: string; internal_notes: string; discount_percent: number; prepaid_amount: number; created_by: string | null; import_ref: string | null;
} & Timestamps;

export type VisitItem = {
  id: string; visit_id: string; service_id: string | null; service_name: string; staff_id: string | null;
  resource_id: string | null; starts_at: string; ends_at: string; price: number; discount: number;
  status: VisitStatus; package_id: string | null; notes: string;
} & Timestamps;

export type CustomerPackage = {
  id: string; customer_id: string; service_id: string | null; name: string; total_sessions: number;
  used_sessions: number; price_paid: number; purchased_at: string; expires_at: string | null; notes: string; created_at: string;
};

export type Expense = {
  id: string; expense_date: string; category: string; description: string; amount: number; method: PayMethod;
  staff_id: string | null; created_by: string | null; created_at: string;
};
export type Sale = {
  id: string; visit_id: string | null; customer_id: string | null; sale_date: string; subtotal: number; discount: number;
  total: number; notes: string; created_by: string | null; created_at: string;
};
export type SalePayment = { id: string; sale_id: string; method: PayMethod; amount: number };
export type SaleItem = {
  id: string; sale_id: string; visit_item_id: string | null; kind: "service" | "product"; name: string; staff_id: string | null;
  qty: number; unit_price: number; discount: number; total: number;
};
export type StaffPayout = {
  id: string; staff_id: string; period_start: string; period_end: string; amount: number; method: PayMethod; notes: string;
  paid_at: string; created_by: string | null; created_at: string;
};

export type BookingRequest = {
  id: string; first_name: string; last_name: string; phone: string; email: string; locale: string;
  service_id: string; staff_id: string | null; starts_at: string; notes: string;
  status: "new" | "approved" | "rejected" | "expired"; visit_id: string | null; ip_hash: string; created_at: string;
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
      staff_services: { Row: { staff_id: string; service_id: string; price_override: number | null; duration_override: number | null }; Insert: { staff_id: string; service_id: string; price_override?: number | null; duration_override?: number | null }; Update: Partial<{ staff_id: string; service_id: string; price_override: number | null; duration_override: number | null }>; Relationships: [] };
      service_resources: { Row: { service_id: string; resource_id: string }; Insert: { service_id: string; resource_id: string }; Update: Partial<{ service_id: string; resource_id: string }>; Relationships: [] };
      customers: Tbl<Customer, Exclude<keyof Customer, "first_name">>;
      visits: Tbl<Visit, Exclude<keyof Visit, "visit_date">, [R<"visits_customer_id_fkey","customer_id","customers">]>;
      visit_items: Tbl<VisitItem, "service_id" | "staff_id" | "resource_id" | "price" | "discount" | "status" | "package_id" | "notes", [R<"visit_items_visit_id_fkey","visit_id","visits">, R<"visit_items_staff_id_fkey","staff_id","staff">, R<"visit_items_service_id_fkey","service_id","services">]>;
      customer_packages: Tbl<CustomerPackage, "service_id" | "used_sessions" | "price_paid" | "purchased_at" | "expires_at" | "notes", [R<"customer_packages_customer_id_fkey","customer_id","customers">]>;
      expenses: Tbl<Expense, "expense_date" | "category" | "description" | "method" | "staff_id" | "created_by", [R<"expenses_staff_id_fkey","staff_id","staff">]>;
      sales: Tbl<Sale, "visit_id" | "customer_id" | "sale_date" | "subtotal" | "discount" | "total" | "notes" | "created_by", [R<"sales_visit_id_fkey","visit_id","visits">, R<"sales_customer_id_fkey","customer_id","customers">]>;
      sale_payments: Tbl<SalePayment, never, [R<"sale_payments_sale_id_fkey","sale_id","sales">]>;
      sale_items: Tbl<SaleItem, "visit_item_id" | "kind" | "staff_id" | "qty" | "unit_price" | "discount" | "total", [R<"sale_items_sale_id_fkey","sale_id","sales">, R<"sale_items_staff_id_fkey","staff_id","staff">, R<"sale_items_visit_item_id_fkey","visit_item_id","visit_items">]>;
      staff_payouts: Tbl<StaffPayout, "method" | "notes" | "paid_at" | "created_by", [R<"staff_payouts_staff_id_fkey","staff_id","staff">]>;
      booking_requests: Tbl<BookingRequest, "last_name" | "email" | "locale" | "staff_id" | "notes" | "status" | "visit_id" | "ip_hash", [R<"booking_requests_service_id_fkey","service_id","services">, R<"booking_requests_staff_id_fkey","staff_id","staff">]>;
    };
    Views: {
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
