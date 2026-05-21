export interface Category {
  id: number;
  name: string;
}

export interface Medicine {
  id: number;
  name: string;
  scientific_name?: string;
  description: string;
  category_id: number;
  category_name?: string;
  stock: number;
  min_stock_level?: number;
  purchase_price: number;
  price: number;
  barcode: string;
  expiry_date: string;
  tax_rate?: number | null;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  balance: number;
  created_at: string;
}

export interface Sale {
  id: number;
  customer_id?: number;
  total_amount: number;
  payment_method: string;
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  medicine_id: number;
  medicine_name?: string;
  quantity: number;
  unit_price: number;
  purchase_price: number; // Historical cost tracking
}

export interface MedicineBatch {
  id: number;
  medicine_id: number;
  quantity: number;
  expiry_date: string;
  purchase_price: number;
  selling_price: number;
  created_at: string;
}
