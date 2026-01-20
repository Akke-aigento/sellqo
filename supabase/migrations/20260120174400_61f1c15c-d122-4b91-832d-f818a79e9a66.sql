-- First create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create enum types for purchase orders
CREATE TYPE purchase_order_status AS ENUM ('draft', 'sent', 'confirmed', 'shipped', 'partially_received', 'received', 'cancelled');
CREATE TYPE supplier_document_type AS ENUM ('invoice', 'quote', 'delivery_note', 'credit_note', 'contract', 'other');
CREATE TYPE supplier_payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue', 'cancelled');

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  street TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'NL',
  vat_number TEXT,
  chamber_of_commerce TEXT,
  iban TEXT,
  bic TEXT,
  payment_terms_days INTEGER DEFAULT 30,
  contact_person TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_suppliers linking table
CREATE TABLE public.product_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_sku TEXT,
  purchase_price NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  minimum_order_quantity INTEGER DEFAULT 1,
  lead_time_days INTEGER,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, supplier_id)
);

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  status purchase_order_status DEFAULT 'draft',
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  notes TEXT,
  internal_notes TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_order_items table
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_supplier_id UUID REFERENCES public.product_suppliers(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  supplier_sku TEXT,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 21,
  line_total NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create supplier_documents table
CREATE TABLE public.supplier_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  document_type supplier_document_type NOT NULL,
  document_number TEXT,
  document_date DATE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  amount NUMERIC(10,2),
  tax_amount NUMERIC(10,2),
  total_amount NUMERIC(10,2),
  currency TEXT DEFAULT 'EUR',
  due_date DATE,
  payment_status supplier_payment_status DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  extracted_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX idx_suppliers_name ON public.suppliers(tenant_id, name);
CREATE INDEX idx_suppliers_active ON public.suppliers(tenant_id, is_active);

CREATE INDEX idx_product_suppliers_tenant ON public.product_suppliers(tenant_id);
CREATE INDEX idx_product_suppliers_product ON public.product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier ON public.product_suppliers(supplier_id);
CREATE INDEX idx_product_suppliers_primary ON public.product_suppliers(product_id, is_primary) WHERE is_primary = true;

CREATE INDEX idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(tenant_id, status);
CREATE INDEX idx_purchase_orders_date ON public.purchase_orders(tenant_id, order_date);
CREATE INDEX idx_purchase_orders_number ON public.purchase_orders(tenant_id, order_number);

CREATE INDEX idx_purchase_order_items_order ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product ON public.purchase_order_items(product_id);

CREATE INDEX idx_supplier_documents_tenant ON public.supplier_documents(tenant_id);
CREATE INDEX idx_supplier_documents_supplier ON public.supplier_documents(supplier_id);
CREATE INDEX idx_supplier_documents_po ON public.supplier_documents(purchase_order_id);
CREATE INDEX idx_supplier_documents_type ON public.supplier_documents(tenant_id, document_type);
CREATE INDEX idx_supplier_documents_payment ON public.supplier_documents(tenant_id, payment_status) WHERE document_type = 'invoice';

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Users can view suppliers in their tenant" ON public.suppliers
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create suppliers in their tenant" ON public.suppliers
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update suppliers in their tenant" ON public.suppliers
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete suppliers in their tenant" ON public.suppliers
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for product_suppliers
CREATE POLICY "Users can view product_suppliers in their tenant" ON public.product_suppliers
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create product_suppliers in their tenant" ON public.product_suppliers
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update product_suppliers in their tenant" ON public.product_suppliers
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete product_suppliers in their tenant" ON public.product_suppliers
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view purchase_orders in their tenant" ON public.purchase_orders
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create purchase_orders in their tenant" ON public.purchase_orders
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update purchase_orders in their tenant" ON public.purchase_orders
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete purchase_orders in their tenant" ON public.purchase_orders
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for purchase_order_items
CREATE POLICY "Users can view purchase_order_items via order" ON public.purchase_order_items
  FOR SELECT USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can create purchase_order_items via order" ON public.purchase_order_items
  FOR INSERT WITH CHECK (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can update purchase_order_items via order" ON public.purchase_order_items
  FOR UPDATE USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can delete purchase_order_items via order" ON public.purchase_order_items
  FOR DELETE USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

-- RLS Policies for supplier_documents
CREATE POLICY "Users can view supplier_documents in their tenant" ON public.supplier_documents
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create supplier_documents in their tenant" ON public.supplier_documents
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update supplier_documents in their tenant" ON public.supplier_documents
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete supplier_documents in their tenant" ON public.supplier_documents
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_suppliers_updated_at BEFORE UPDATE ON public.product_suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_supplier_documents_updated_at BEFORE UPDATE ON public.supplier_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate PO number
CREATE OR REPLACE FUNCTION public.generate_po_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count FROM purchase_orders WHERE tenant_id = p_tenant_id AND order_number LIKE 'PO-' || v_year || '-%';
  RETURN 'PO-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- Create storage bucket for supplier documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('supplier-documents', 'supplier-documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Tenant users can upload supplier documents" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] IN (SELECT tenant_id::text FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can view supplier documents" ON storage.objects FOR SELECT
USING (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] IN (SELECT tenant_id::text FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can delete supplier documents" ON storage.objects FOR DELETE
USING (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] IN (SELECT tenant_id::text FROM public.user_roles WHERE user_id = auth.uid()));