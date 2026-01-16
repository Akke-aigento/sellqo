export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address_verified: boolean | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_street: string | null
          company_name: string | null
          created_at: string | null
          customer_type: string | null
          default_billing_address: Json | null
          default_shipping_address: Json | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          peppol_id: string | null
          phone: string | null
          shipping_address_verified: boolean | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_street: string | null
          tax_exempt: boolean | null
          tax_exempt_reason: string | null
          tenant_id: string
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
          vat_number: string | null
          vat_verified: boolean | null
          vat_verified_at: string | null
        }
        Insert: {
          billing_address_verified?: boolean | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_type?: string | null
          default_billing_address?: Json | null
          default_shipping_address?: Json | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          peppol_id?: string | null
          phone?: string | null
          shipping_address_verified?: boolean | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_street?: string | null
          tax_exempt?: boolean | null
          tax_exempt_reason?: string | null
          tenant_id: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
          vat_number?: string | null
          vat_verified?: boolean | null
          vat_verified_at?: string | null
        }
        Update: {
          billing_address_verified?: boolean | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_type?: string | null
          default_billing_address?: Json | null
          default_shipping_address?: Json | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          peppol_id?: string | null
          phone?: string | null
          shipping_address_verified?: boolean | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_street?: string | null
          tax_exempt?: boolean | null
          tax_exempt_reason?: string | null
          tenant_id?: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
          vat_number?: string | null
          vat_verified?: boolean | null
          vat_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          invoice_number: string
          is_b2b: boolean | null
          order_id: string | null
          paid_at: string | null
          pdf_url: string | null
          peppol_sent_at: string | null
          peppol_status: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number | null
          tenant_id: string
          total: number
          ubl_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_number: string
          is_b2b?: boolean | null
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          peppol_sent_at?: string | null
          peppol_status?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number | null
          tenant_id: string
          total?: number
          ubl_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_number?: string
          is_b2b?: boolean | null
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          peppol_sent_at?: string | null
          peppol_status?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number | null
          tenant_id?: string
          total?: number
          ubl_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          product_sku?: string | null
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          cancelled_at: string | null
          carrier: string | null
          created_at: string | null
          customer_email: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          discount_amount: number | null
          id: string
          internal_notes: string | null
          notes: string | null
          order_number: string
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          shipping_method_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number | null
          tenant_id: string
          total: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          billing_address?: Json | null
          cancelled_at?: string | null
          carrier?: string | null
          created_at?: string | null
          customer_email: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_number: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          tenant_id: string
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_address?: Json | null
          cancelled_at?: string | null
          carrier?: string | null
          created_at?: string | null
          customer_email?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          tenant_id?: string
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_backorder: boolean | null
          barcode: string | null
          category_id: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          featured_image: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          low_stock_threshold: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          price: number
          requires_shipping: boolean | null
          short_description: string | null
          sku: string | null
          slug: string
          stock: number | null
          tags: string[] | null
          tenant_id: string
          track_inventory: boolean | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          allow_backorder?: boolean | null
          barcode?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          featured_image?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          price: number
          requires_shipping?: boolean | null
          short_description?: string | null
          sku?: string | null
          slug: string
          stock?: number | null
          tags?: string[] | null
          tenant_id: string
          track_inventory?: boolean | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          allow_backorder?: boolean | null
          barcode?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          featured_image?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          price?: number
          requires_shipping?: boolean | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock?: number | null
          tags?: string[] | null
          tenant_id?: string
          track_inventory?: boolean | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          product_id: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          quote_id: string
          sort_order: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          quantity?: number
          quote_id: string
          sort_order?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string
          declined_at: string | null
          discount_amount: number | null
          expired_at: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          payment_link: string | null
          quote_number: string
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_amount: number | null
          tenant_id: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id: string
          declined_at?: string | null
          discount_amount?: number | null
          expired_at?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          payment_link?: string | null
          quote_number: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_amount?: number | null
          tenant_id: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string
          declined_at?: string | null
          discount_amount?: number | null
          expired_at?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          payment_link?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_amount?: number | null
          tenant_id?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_methods: {
        Row: {
          created_at: string
          description: string | null
          estimated_days_max: number | null
          estimated_days_min: number | null
          free_above: number | null
          id: string
          is_active: boolean
          is_default: boolean | null
          name: string
          price: number
          sort_order: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          free_above?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          name: string
          price?: number
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          free_above?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          name?: string
          price?: number
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          apply_oss_rules: boolean | null
          auto_send_invoices: boolean | null
          block_invalid_vat_orders: boolean | null
          btw_number: string | null
          city: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          custom_domain: string | null
          default_vat_handling: string | null
          export_text: string | null
          id: string
          invoice_bcc_email: string | null
          invoice_cc_email: string | null
          invoice_email_body: string | null
          invoice_email_subject: string | null
          invoice_format: string | null
          invoice_prefix: string | null
          kvk_number: string | null
          language: string | null
          last_login: string | null
          logo_url: string | null
          name: string
          oss_identification_number: string | null
          oss_registration_date: string | null
          owner_email: string
          owner_name: string | null
          peppol_id: string | null
          phone: string | null
          postal_code: string | null
          primary_color: string | null
          require_vies_validation: boolean | null
          reverse_charge_text: string | null
          secondary_color: string | null
          shipping_enabled: boolean | null
          slug: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_onboarding_complete: boolean | null
          stripe_payouts_enabled: boolean | null
          subscription_plan: string | null
          subscription_status: string | null
          tax_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          apply_oss_rules?: boolean | null
          auto_send_invoices?: boolean | null
          block_invalid_vat_orders?: boolean | null
          btw_number?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          custom_domain?: string | null
          default_vat_handling?: string | null
          export_text?: string | null
          id?: string
          invoice_bcc_email?: string | null
          invoice_cc_email?: string | null
          invoice_email_body?: string | null
          invoice_email_subject?: string | null
          invoice_format?: string | null
          invoice_prefix?: string | null
          kvk_number?: string | null
          language?: string | null
          last_login?: string | null
          logo_url?: string | null
          name: string
          oss_identification_number?: string | null
          oss_registration_date?: string | null
          owner_email: string
          owner_name?: string | null
          peppol_id?: string | null
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          require_vies_validation?: boolean | null
          reverse_charge_text?: string | null
          secondary_color?: string | null
          shipping_enabled?: boolean | null
          slug: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          subscription_plan?: string | null
          subscription_status?: string | null
          tax_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          apply_oss_rules?: boolean | null
          auto_send_invoices?: boolean | null
          block_invalid_vat_orders?: boolean | null
          btw_number?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          custom_domain?: string | null
          default_vat_handling?: string | null
          export_text?: string | null
          id?: string
          invoice_bcc_email?: string | null
          invoice_cc_email?: string | null
          invoice_email_body?: string | null
          invoice_email_subject?: string | null
          invoice_format?: string | null
          invoice_prefix?: string | null
          kvk_number?: string | null
          language?: string | null
          last_login?: string | null
          logo_url?: string | null
          name?: string
          oss_identification_number?: string | null
          oss_registration_date?: string | null
          owner_email?: string
          owner_name?: string | null
          peppol_id?: string | null
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          require_vies_validation?: boolean | null
          reverse_charge_text?: string | null
          secondary_color?: string | null
          shipping_enabled?: boolean | null
          slug?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          subscription_plan?: string | null
          subscription_status?: string | null
          tax_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_validations: {
        Row: {
          company_address: string | null
          company_name: string | null
          country_code: string
          created_at: string
          customer_id: string | null
          id: string
          is_valid: boolean
          tenant_id: string
          validated_at: string
          vat_number: string
          vies_request_id: string | null
        }
        Insert: {
          company_address?: string | null
          company_name?: string | null
          country_code: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_valid: boolean
          tenant_id: string
          validated_at?: string
          vat_number: string
          vies_request_id?: string | null
        }
        Update: {
          company_address?: string | null
          company_name?: string | null
          country_code?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_valid?: boolean
          tenant_id?: string
          validated_at?: string
          vat_number?: string
          vies_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vat_validations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vat_validations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      generate_invoice_number: { Args: { _tenant_id: string }; Returns: string }
      generate_order_number: { Args: { _tenant_id: string }; Returns: string }
      generate_quote_number: { Args: { _tenant_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "platform_admin" | "tenant_admin" | "staff"
      invoice_status: "draft" | "sent" | "paid" | "cancelled"
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      quote_status:
        | "draft"
        | "sent"
        | "accepted"
        | "declined"
        | "expired"
        | "converted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["platform_admin", "tenant_admin", "staff"],
      invoice_status: ["draft", "sent", "paid", "cancelled"],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["pending", "paid", "refunded", "failed"],
      quote_status: [
        "draft",
        "sent",
        "accepted",
        "declined",
        "expired",
        "converted",
      ],
    },
  },
} as const
