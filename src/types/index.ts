export type CoffeeStatus ="active" |"depleted" |"reserved";
export type RoastLevel ="light" |"medium" |"medium_dark" |"dark";
export type RoastStatus ="trial" |"production" |"discarded";

export interface Roaster {
  id: string;
  user_id: string;
  business_name: string;
  country: string;
  currency: string;
  low_stock_threshold: number;
  default_energy_cost_per_kg: number;
  default_packaging_cost_per_kg: number;
  default_labor_cost_per_kg: number;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface GreenCoffee {
  id: string;
  roaster_id: string;
  name: string;
  origin_country: string | null;
  farm_producer: string | null;
  variety: string | null;
  process: string | null;
  score: number | null;
  purchase_price_per_kg: number;
  initial_stock_kg: number;
  current_stock_kg: number;
  purchase_date: string | null;
  supplier: string | null;
  tasting_notes: string | null;
  status: CoffeeStatus;
  created_at: string;
  updated_at: string;
}

export interface RoastBatch {
  id: string;
  roaster_id: string;
  green_coffee_id: string;
  roast_date: string;
  green_weight_kg: number;
  roasted_weight_kg: number;
  shrinkage_pct: number;
  roast_duration_min: number | null;
  charge_temp_celsius: number | null;
  first_crack_time_min: number | null;
  development_time_min: number | null;
  development_pct: number | null;
  roast_level: RoastLevel | null;
  sensory_result: string | null;
  roaster_notes: string | null;
  status: RoastStatus;
  packaging_cost_per_kg: number;
  energy_cost_per_kg: number;
  labor_cost_per_kg: number;
  total_cost_per_kg_roasted: number;
  current_stock_kg?: number;
  created_at: string;
  updated_at: string;
  green_coffees?: GreenCoffee;
}

export interface SellingPrice {
  id: string;
  roast_batch_id: string;
  weight_grams: number;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface CostBreakdown {
  greenCostBase: number;
  effectiveCostPerKgRoasted: number;
  packagingCostPerKg: number;
  energyCostPerKg: number;
  laborCostPerKg: number;
  totalCostPerKg: number;
  shrinkagePct: number;
}

export interface MarginResult {
  weightGrams: number;
  costForUnit: number;
  sellingPrice: number;
  profit: number;
  marginPct: number;
}

export type ClientType ="cafe" |"individual" |"restaurant" |"distributor" |"other";
export type OrderStatus = "draft" | "proforma" | "pending" | "confirmed" | "roasting" | "ready" | "delivered" | "cancelled";
export type DocumentType = "draft" | "proforma" | "boleta";

export interface OrderItem {
  id: string;
  order_id: string;
  green_coffee_id: string | null;
  roast_batch_id: string | null;
  product_type:"roasted" |"green" |"service" |"product";
  weight_grams: number | null;
  green_weight_kg: number | null;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  subtotal_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  notes: string | null;
  created_at: string;
  green_coffees?: GreenCoffee;
  roast_batches?: RoastBatch & { green_coffees?: GreenCoffee };
}

export interface Order {
  id: string;
  roaster_id: string;
  client_id: string | null;
  client_name: string | null;
  order_date: string;
  delivery_date: string | null;
  status: OrderStatus;
  document_type: DocumentType;
  tax_rate: number;
  subtotal_amount: number;
  tax_amount: number;
  notes: string | null;
  total_amount: number;
  inventory_committed_at: string | null;
  confirmed_at: string | null;
  payment_type: PaymentType | null;
  payment_status: PaymentStatus | null;
  payment_currency: PaymentCurrency | null;
  amount_paid: number | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: Client;
  order_items?: OrderItem[];
}

export type QuoteCategory ="green_coffee" |"brand_creation" |"machines";
export type QuoteStatus ="draft" |"issued" |"accepted" |"rejected" |"invoiced";
export type QuoteItemKind ="green_coffee" |"roast_service" |"machine" |"destoner" |"other";

export interface QuotePriceCatalogItem {
  id: string;
  roaster_id: string;
  category: QuoteCategory;
  item_kind: QuoteItemKind;
  green_coffee_id: string | null;
  name: string;
  description: string | null;
  unit_label: string;
  suggested_unit_price: number;
  machine_capacity_kg: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  green_coffees?: GreenCoffee;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  catalog_item_id: string | null;
  green_coffee_id: string | null;
  item_kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_label: string;
  unit_price: number;
  line_subtotal: number;
  tax_enabled?: boolean;
  tax_rate?: number;
  tax_amount?: number;
  line_total?: number;
  sort_order: number;
  created_at: string;
  green_coffees?: GreenCoffee;
}

export interface Quotation {
  id: string;
  roaster_id: string;
  quote_number: string;
  category: QuoteCategory;
  status: QuoteStatus;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  currency: string;
  quote_date: string;
  valid_until: string | null;
  tax_enabled: boolean;
  tax_rate: number;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  converted_sale_id: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: Client;
  quotation_items?: QuotationItem[];
}

export interface RoastProfile {
  id: string;
  roaster_id: string;
  green_coffee_id: string | null;
  name: string;
  roaster_machine: string | null;
  charge_kg: number | null;
  charge_temp_celsius: number | null;
  total_time_min: number | null;
  first_crack_time_min: number | null;
  development_time_min: number | null;
  development_pct: number | null;
  roast_level: RoastLevel | null;
  cup_result: string | null;
  recommendation: string | null;
  turning_point_time_min: number | null;
  turning_point_temp_celsius: number | null;
  yellowing_time_min: number | null;
  yellowing_temp_celsius: number | null;
  share_token: string | null;
  is_favorite: boolean;
  times_used: number;
  created_at: string;
  updated_at: string;
  green_coffees?: GreenCoffee;
}
export type ExpenseCategory ="energy" |"rent" |"packaging" |"maintenance" |"labor" |"marketing" |"supplies" |"other";
export type ExpenseFrequency ="once" |"daily" |"weekly" |"monthly" |"yearly";

export interface Expense {
  id: string;
  roaster_id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  currency: PaymentCurrency;
  frequency: ExpenseFrequency;
  expense_date: string;
  notes: string | null;
  created_at: string;
}
export type PaymentType ="cash" |"transfer" |"credit";
export type PaymentStatus ="paid" |"pending" |"partial";
export type PaymentCurrency = "USD" | "UYU";

export interface Payment {
  id: string;
  roaster_id: string;
  sale_id: string;
  amount: number;
  payment_type: PaymentType;
  paid_at: string;
  notes: string | null;
  created_at: string;
}
export type ProductType ="roasted" |"green" |"service" |"product";

export interface Client {
  id: string;
  roaster_id: string;
  name: string;
  type: ClientType;
  email: string | null;
  phone: string | null;
  notes: string | null;
  inactive_alert_days: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  roaster_id: string;
  quotation_id?: string | null;
  currency?: string | null;
  client_id: string | null;
  payment_type: PaymentType;
  payment_status: PaymentStatus;
  payment_currency: PaymentCurrency;
  amount_paid: number;
  due_date: string | null;
  paid_at: string | null;
  sale_date: string;
  product_type: ProductType;
  roast_batch_id: string | null;
  weight_grams: number | null;
  green_coffee_id: string | null;
  green_weight_kg: number | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  subtotal_amount?: number | null;
  tax_enabled?: boolean | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  total_with_tax?: number | null;
  final_price: number;
  cost_per_unit: number;
  profit: number;
  client_name: string | null;
  notes: string | null;
  created_at: string;
  roast_batches?: RoastBatch & { green_coffees?: GreenCoffee };
  green_coffees?: GreenCoffee;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_kind: "roasted_coffee" |"green_coffee" |"roast_service" |"machine" |"destoner" |"other" |"product";
  green_coffee_id: string | null;
  description: string;
  quantity: number;
  unit_label: string;
  unit_price: number;
  line_subtotal: number;
  sort_order: number;
  created_at: string;
  green_coffees?: GreenCoffee;
}

export interface DashboardStats {
  totalGreenStockKg: number;
  kgRoastedThisMonth: number;
  inventoryValue: number;
  averageMarginPct: number;
  lowStockCount: number;
  recentBatches: RoastBatch[];
  lowStockCoffees: GreenCoffee[];
}
