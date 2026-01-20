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
      admin_billing_actions: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_billing_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_content: {
        Row: {
          content_text: string | null
          content_type: string
          created_at: string
          html_content: string | null
          id: string
          image_urls: string[] | null
          is_used: boolean | null
          metadata: Json | null
          platform: string | null
          product_ids: string[] | null
          scheduled_at: string | null
          segment_id: string | null
          tenant_id: string
          title: string | null
          updated_at: string
          used_at: string | null
        }
        Insert: {
          content_text?: string | null
          content_type: string
          created_at?: string
          html_content?: string | null
          id?: string
          image_urls?: string[] | null
          is_used?: boolean | null
          metadata?: Json | null
          platform?: string | null
          product_ids?: string[] | null
          scheduled_at?: string | null
          segment_id?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          content_text?: string | null
          content_type?: string
          created_at?: string
          html_content?: string | null
          id?: string
          image_urls?: string[] | null
          is_used?: boolean | null
          metadata?: Json | null
          platform?: string | null
          product_ids?: string[] | null
          scheduled_at?: string | null
          segment_id?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_content_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_content_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          created_at: string
          credits_used: number
          feature: string
          id: string
          input_tokens: number | null
          metadata: Json | null
          model_used: string | null
          output_tokens: number | null
          prompt_summary: string | null
          result_summary: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          feature: string
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model_used?: string | null
          output_tokens?: number | null
          prompt_summary?: string | null
          result_summary?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          feature?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model_used?: string | null
          output_tokens?: number | null
          prompt_summary?: string | null
          result_summary?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_link_clicks: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          customer_id: string | null
          id: string
          ip_country: string | null
          link_text: string | null
          link_url: string
          send_id: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          customer_id?: string | null
          id?: string
          ip_country?: string | null
          link_text?: string | null
          link_url: string
          send_id?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          customer_id?: string | null
          id?: string
          ip_country?: string | null
          link_text?: string | null
          link_url?: string
          send_id?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_link_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_link_clicks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_link_clicks_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "campaign_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_link_clicks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sends: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          clicked_at: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          delivered_at: string | null
          email: string
          error_message: string | null
          first_clicked_at: string | null
          first_opened_at: string | null
          id: string
          ip_country: string | null
          link_clicks: number | null
          opened_at: string | null
          resend_id: string | null
          sent_at: string | null
          status: string | null
          user_agent: string | null
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          clicked_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          email: string
          error_message?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          id?: string
          ip_country?: string | null
          link_clicks?: number | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          user_agent?: string | null
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          id?: string
          ip_country?: string | null
          link_clicks?: number | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      credit_note_lines: {
        Row: {
          created_at: string | null
          credit_note_id: string
          description: string
          id: string
          line_total: number
          line_type: string | null
          original_invoice_line_id: string | null
          quantity: number
          unit_price: number
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          credit_note_id: string
          description: string
          id?: string
          line_total: number
          line_type?: string | null
          original_invoice_line_id?: string | null
          quantity?: number
          unit_price: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          credit_note_id?: string
          description?: string
          id?: string
          line_total?: number
          line_type?: string | null
          original_invoice_line_id?: string | null
          quantity?: number
          unit_price?: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          created_at: string | null
          credit_note_number: string
          customer_id: string | null
          id: string
          issue_date: string
          ogm_reference: string | null
          original_invoice_id: string
          pdf_url: string | null
          peppol_required: boolean | null
          peppol_status: string | null
          reason: string
          status: string | null
          subtotal: number
          tax_amount: number | null
          tenant_id: string
          total: number
          type: string
          ubl_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credit_note_number: string
          customer_id?: string | null
          id?: string
          issue_date?: string
          ogm_reference?: string | null
          original_invoice_id: string
          pdf_url?: string | null
          peppol_required?: boolean | null
          peppol_status?: string | null
          reason: string
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tenant_id: string
          total?: number
          type: string
          ubl_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credit_note_number?: string
          customer_id?: string | null
          id?: string
          issue_date?: string
          ogm_reference?: string | null
          original_invoice_id?: string
          pdf_url?: string | null
          peppol_required?: boolean | null
          peppol_status?: string | null
          reason?: string
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tenant_id?: string
          total?: number
          type?: string
          ubl_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          created_at: string | null
          description: string | null
          filter_rules: Json
          id: string
          is_dynamic: boolean | null
          member_count: number | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          filter_rules?: Json
          id?: string
          is_dynamic?: boolean | null
          member_count?: number | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          filter_rules?: Json
          id?: string
          is_dynamic?: boolean | null
          member_count?: number | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_segments_tenant_id_fkey"
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
          email_engagement_score: number | null
          email_subscribed: boolean | null
          email_subscribed_at: string | null
          external_id: string | null
          first_name: string | null
          id: string
          import_job_id: string | null
          imported_at: string | null
          last_email_opened_at: string | null
          last_email_sent_at: string | null
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
          email_engagement_score?: number | null
          email_subscribed?: boolean | null
          email_subscribed_at?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          last_email_opened_at?: string | null
          last_email_sent_at?: string | null
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
          email_engagement_score?: number | null
          email_subscribed?: boolean | null
          email_subscribed_at?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          last_email_opened_at?: string | null
          last_email_sent_at?: string | null
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
            foreignKeyName: "customers_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          created_at: string | null
          delay_hours: number | null
          id: string
          is_active: boolean | null
          name: string
          template_id: string | null
          tenant_id: string
          total_converted: number | null
          total_sent: number | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delay_hours?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          template_id?: string | null
          tenant_id: string
          total_converted?: number | null
          total_sent?: number | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delay_hours?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          template_id?: string | null
          tenant_id?: string
          total_converted?: number | null
          total_sent?: number | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          html_content: string
          id: string
          name: string
          preview_text: string | null
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
          tenant_id: string
          total_bounced: number | null
          total_clicked: number | null
          total_delivered: number | null
          total_opened: number | null
          total_recipients: number | null
          total_sent: number | null
          total_unsubscribed: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          html_content: string
          id?: string
          name: string
          preview_text?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          tenant_id: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          html_content?: string
          id?: string
          name?: string
          preview_text?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          tenant_id?: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string | null
          created_at: string | null
          html_content: string
          id: string
          is_default: boolean | null
          json_content: Json | null
          name: string
          subject: string
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          html_content: string
          id?: string
          is_default?: boolean | null
          json_content?: Json | null
          name: string
          subject: string
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          html_content?: string
          id?: string
          is_default?: boolean | null
          json_content?: Json | null
          name?: string
          subject?: string
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribes: {
        Row: {
          campaign_id: string | null
          customer_id: string | null
          email: string
          id: string
          reason: string | null
          tenant_id: string
          unsubscribed_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          customer_id?: string | null
          email: string
          id?: string
          reason?: string | null
          tenant_id: string
          unsubscribed_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          customer_id?: string | null
          email?: string
          id?: string
          reason?: string | null
          tenant_id?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_category_mappings: {
        Row: {
          confidence: number | null
          created_at: string | null
          created_category_id: string | null
          id: string
          import_job_id: string | null
          is_approved: boolean | null
          matched_existing_id: string | null
          original_value: string
          parent_category_id: string | null
          parent_mapping_id: string | null
          product_count: number | null
          source_field: string | null
          suggested_name: string
          suggested_slug: string | null
          user_assigned_parent: string | null
          user_modified_name: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          created_category_id?: string | null
          id?: string
          import_job_id?: string | null
          is_approved?: boolean | null
          matched_existing_id?: string | null
          original_value: string
          parent_category_id?: string | null
          parent_mapping_id?: string | null
          product_count?: number | null
          source_field?: string | null
          suggested_name: string
          suggested_slug?: string | null
          user_assigned_parent?: string | null
          user_modified_name?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          created_category_id?: string | null
          id?: string
          import_job_id?: string | null
          is_approved?: boolean | null
          matched_existing_id?: string | null
          original_value?: string
          parent_category_id?: string | null
          parent_mapping_id?: string | null
          product_count?: number | null
          source_field?: string | null
          suggested_name?: string
          suggested_slug?: string | null
          user_assigned_parent?: string | null
          user_modified_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_category_mappings_created_category_id_fkey"
            columns: ["created_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_category_mappings_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_category_mappings_matched_existing_id_fkey"
            columns: ["matched_existing_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_category_mappings_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_category_mappings_user_assigned_parent_fkey"
            columns: ["user_assigned_parent"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          categories_created: number | null
          categories_matched: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          data_type: string
          duration_ms: number | null
          errors: Json | null
          failed_count: number | null
          file_name: string | null
          id: string
          mapping: Json | null
          options: Json | null
          skipped_count: number | null
          source_platform: string
          started_at: string | null
          status: string | null
          success_count: number | null
          tenant_id: string | null
          total_rows: number | null
        }
        Insert: {
          categories_created?: number | null
          categories_matched?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          data_type: string
          duration_ms?: number | null
          errors?: Json | null
          failed_count?: number | null
          file_name?: string | null
          id?: string
          mapping?: Json | null
          options?: Json | null
          skipped_count?: number | null
          source_platform: string
          started_at?: string | null
          status?: string | null
          success_count?: number | null
          tenant_id?: string | null
          total_rows?: number | null
        }
        Update: {
          categories_created?: number | null
          categories_matched?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          data_type?: string
          duration_ms?: number | null
          errors?: Json | null
          failed_count?: number | null
          file_name?: string | null
          id?: string
          mapping?: Json | null
          options?: Json | null
          skipped_count?: number | null
          source_platform?: string
          started_at?: string | null
          status?: string | null
          success_count?: number | null
          tenant_id?: string | null
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mappings: {
        Row: {
          category_mappings: Json | null
          created_at: string | null
          data_type: string
          id: string
          is_default: boolean | null
          mapping: Json
          name: string
          source_platform: string
          tenant_id: string | null
        }
        Insert: {
          category_mappings?: Json | null
          created_at?: string | null
          data_type: string
          id?: string
          is_default?: boolean | null
          mapping: Json
          name: string
          source_platform: string
          tenant_id?: string | null
        }
        Update: {
          category_mappings?: Json | null
          created_at?: string | null
          data_type?: string
          id?: string
          is_default?: boolean | null
          mapping?: Json
          name?: string
          source_platform?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sync_log: {
        Row: {
          error_message: string | null
          id: string
          marketplace_connection_id: string | null
          marketplace_type: string
          new_quantity: number | null
          old_quantity: number | null
          product_id: string | null
          sync_status: string | null
          synced_at: string | null
          tenant_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          marketplace_connection_id?: string | null
          marketplace_type: string
          new_quantity?: number | null
          old_quantity?: number | null
          product_id?: string | null
          sync_status?: string | null
          synced_at?: string | null
          tenant_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          marketplace_connection_id?: string | null
          marketplace_type?: string
          new_quantity?: number | null
          old_quantity?: number | null
          product_id?: string | null
          sync_status?: string | null
          synced_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_sync_log_marketplace_connection_id_fkey"
            columns: ["marketplace_connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_sync_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_sync_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_archive: {
        Row: {
          archived_at: string
          cii_storage_key: string | null
          created_at: string | null
          document_id: string
          document_number: string
          document_type: string
          expires_at: string
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          pdf_storage_key: string
          sha256_hash: string
          tenant_id: string
          ubl_storage_key: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string
          cii_storage_key?: string | null
          created_at?: string | null
          document_id: string
          document_number: string
          document_type: string
          expires_at: string
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          pdf_storage_key: string
          sha256_hash: string
          tenant_id: string
          ubl_storage_key?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string
          cii_storage_key?: string | null
          created_at?: string | null
          document_id?: string
          document_number?: string
          document_type?: string
          expires_at?: string
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          pdf_storage_key?: string
          sha256_hash?: string
          tenant_id?: string
          ubl_storage_key?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_archive_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_discounts: {
        Row: {
          amount: number
          applies_to: string
          coupon_code: string | null
          created_at: string | null
          description: string | null
          discount_type: string
          id: string
          invoice_id: string | null
          value: number
        }
        Insert: {
          amount: number
          applies_to: string
          coupon_code?: string | null
          created_at?: string | null
          description?: string | null
          discount_type: string
          id?: string
          invoice_id?: string | null
          value: number
        }
        Update: {
          amount?: number
          applies_to?: string
          coupon_code?: string | null
          created_at?: string | null
          description?: string | null
          discount_type?: string
          id?: string
          invoice_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_discounts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_duplicates: {
        Row: {
          generated_at: string | null
          generated_by: string | null
          id: string
          invoice_id: string
          reason: string | null
          sent_to_email: string | null
          tenant_id: string
        }
        Insert: {
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          invoice_id: string
          reason?: string | null
          sent_to_email?: string | null
          tenant_id: string
        }
        Update: {
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          invoice_id?: string
          reason?: string | null
          sent_to_email?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_duplicates_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_duplicates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string | null
          description: string
          discount_amount: number | null
          discount_percentage: number | null
          gross_amount: number | null
          id: string
          invoice_id: string
          line_total: number
          line_type: string | null
          net_amount: number | null
          product_id: string | null
          quantity: number
          shipping_method_id: string | null
          sort_order: number | null
          unit_price: number
          vat_amount: number
          vat_category: string | null
          vat_rate: number
        }
        Insert: {
          created_at?: string | null
          description: string
          discount_amount?: number | null
          discount_percentage?: number | null
          gross_amount?: number | null
          id?: string
          invoice_id: string
          line_total: number
          line_type?: string | null
          net_amount?: number | null
          product_id?: string | null
          quantity?: number
          shipping_method_id?: string | null
          sort_order?: number | null
          unit_price: number
          vat_amount?: number
          vat_category?: string | null
          vat_rate?: number
        }
        Update: {
          created_at?: string | null
          description?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          gross_amount?: number | null
          id?: string
          invoice_id?: string
          line_total?: number
          line_type?: string | null
          net_amount?: number | null
          product_id?: string | null
          quantity?: number
          shipping_method_id?: string | null
          sort_order?: number | null
          unit_price?: number
          vat_amount?: number
          vat_category?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string | null
          due_date: string | null
          id: string
          invoice_number: string
          is_b2b: boolean | null
          last_reminder_at: string | null
          ogm_reference: string | null
          order_id: string | null
          paid_at: string | null
          pdf_url: string | null
          peppol_required: boolean | null
          peppol_sent_at: string | null
          peppol_status: string | null
          proforma_reference: string | null
          reminder_level: number | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
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
          due_date?: string | null
          id?: string
          invoice_number: string
          is_b2b?: boolean | null
          last_reminder_at?: string | null
          ogm_reference?: string | null
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          peppol_required?: boolean | null
          peppol_sent_at?: string | null
          peppol_status?: string | null
          proforma_reference?: string | null
          reminder_level?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
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
          due_date?: string | null
          id?: string
          invoice_number?: string
          is_b2b?: boolean | null
          last_reminder_at?: string | null
          ogm_reference?: string | null
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          peppol_required?: boolean | null
          peppol_sent_at?: string | null
          peppol_status?: string | null
          proforma_reference?: string | null
          reminder_level?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
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
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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
      marketplace_connections: {
        Row: {
          created_at: string | null
          credentials: Json
          id: string
          is_active: boolean | null
          last_error: string | null
          last_sync_at: string | null
          marketplace_name: string | null
          marketplace_type: string
          settings: Json | null
          stats: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          marketplace_name?: string | null
          marketplace_type: string
          settings?: Json | null
          stats?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          marketplace_name?: string | null
          marketplace_type?: string
          settings?: Json | null
          stats?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_connections_tenant_id_fkey"
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
          fulfillment_status: string | null
          id: string
          internal_notes: string | null
          marketplace_connection_id: string | null
          marketplace_order_id: string | null
          marketplace_source: string | null
          notes: string | null
          order_number: string
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          raw_marketplace_data: Json | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          shipping_method_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          sync_status: string | null
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
          fulfillment_status?: string | null
          id?: string
          internal_notes?: string | null
          marketplace_connection_id?: string | null
          marketplace_order_id?: string | null
          marketplace_source?: string | null
          notes?: string | null
          order_number: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          raw_marketplace_data?: Json | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          sync_status?: string | null
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
          fulfillment_status?: string | null
          id?: string
          internal_notes?: string | null
          marketplace_connection_id?: string | null
          marketplace_order_id?: string | null
          marketplace_source?: string | null
          notes?: string | null
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          raw_marketplace_data?: Json | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_method_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          sync_status?: string | null
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
            foreignKeyName: "orders_marketplace_connection_id_fkey"
            columns: ["marketplace_connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
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
      packing_slip_lines: {
        Row: {
          created_at: string | null
          description: string
          id: string
          packing_slip_id: string | null
          quantity: number | null
          sku: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          packing_slip_id?: string | null
          quantity?: number | null
          sku?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          packing_slip_id?: string | null
          quantity?: number | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_slip_lines_packing_slip_id_fkey"
            columns: ["packing_slip_id"]
            isOneToOne: false
            referencedRelation: "packing_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_slips: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_id: string | null
          packing_slip_number: string
          printed_at: string | null
          ship_from_address: Json | null
          ship_to_address: Json | null
          tenant_id: string
          total_packages: number | null
          total_weight: number | null
          weight_unit: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          packing_slip_number: string
          printed_at?: string | null
          ship_from_address?: Json | null
          ship_to_address?: Json | null
          tenant_id: string
          total_packages?: number | null
          total_weight?: number | null
          weight_unit?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          packing_slip_number?: string
          printed_at?: string | null
          ship_from_address?: Json | null
          ship_to_address?: Json | null
          tenant_id?: string
          total_packages?: number | null
          total_weight?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_slips_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_slips_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_slips_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          created_at: string | null
          email_sent_to: string | null
          id: string
          invoice_id: string | null
          late_fee_amount: number | null
          level: number
          sent_at: string
          total_due_amount: number | null
        }
        Insert: {
          created_at?: string | null
          email_sent_to?: string | null
          id?: string
          invoice_id?: string | null
          late_fee_amount?: number | null
          level: number
          sent_at?: string
          total_due_amount?: number | null
        }
        Update: {
          created_at?: string | null
          email_sent_to?: string | null
          id?: string
          invoice_id?: string | null
          late_fee_amount?: number | null
          level?: number
          sent_at?: string
          total_due_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          due_date: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_pdf_url: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_charge_id: string | null
          stripe_invoice_id: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          active: boolean | null
          ai_credits_monthly: number | null
          created_at: string | null
          currency: string | null
          features: Json
          highlighted: boolean | null
          id: string
          limit_api_calls: number | null
          limit_customers: number | null
          limit_orders: number | null
          limit_products: number | null
          limit_storage_gb: number
          limit_users: number
          monthly_price: number
          name: string
          slug: string
          sort_order: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          updated_at: string | null
          yearly_price: number
        }
        Insert: {
          active?: boolean | null
          ai_credits_monthly?: number | null
          created_at?: string | null
          currency?: string | null
          features?: Json
          highlighted?: boolean | null
          id: string
          limit_api_calls?: number | null
          limit_customers?: number | null
          limit_orders?: number | null
          limit_products?: number | null
          limit_storage_gb?: number
          limit_users?: number
          monthly_price?: number
          name: string
          slug: string
          sort_order?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          yearly_price?: number
        }
        Update: {
          active?: boolean | null
          ai_credits_monthly?: number | null
          created_at?: string | null
          currency?: string | null
          features?: Json
          highlighted?: boolean | null
          id?: string
          limit_api_calls?: number | null
          limit_customers?: number | null
          limit_orders?: number | null
          limit_products?: number | null
          limit_storage_gb?: number
          limit_users?: number
          monthly_price?: number
          name?: string
          slug?: string
          sort_order?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          yearly_price?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          allow_backorder: boolean | null
          amazon_asin: string | null
          barcode: string | null
          bol_ean: string | null
          category_id: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          external_id: string | null
          featured_image: string | null
          id: string
          images: string[] | null
          import_job_id: string | null
          imported_at: string | null
          is_active: boolean | null
          is_featured: boolean | null
          last_inventory_sync: string | null
          low_stock_threshold: number | null
          marketplace_mappings: Json | null
          meta_description: string | null
          meta_title: string | null
          name: string
          original_category_value: string | null
          price: number
          requires_shipping: boolean | null
          short_description: string | null
          sku: string | null
          slug: string
          stock: number | null
          sync_inventory: boolean | null
          tags: string[] | null
          tenant_id: string
          track_inventory: boolean | null
          updated_at: string | null
          vat_rate_id: string | null
          weight: number | null
        }
        Insert: {
          allow_backorder?: boolean | null
          amazon_asin?: string | null
          barcode?: string | null
          bol_ean?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          featured_image?: string | null
          id?: string
          images?: string[] | null
          import_job_id?: string | null
          imported_at?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          last_inventory_sync?: string | null
          low_stock_threshold?: number | null
          marketplace_mappings?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          original_category_value?: string | null
          price: number
          requires_shipping?: boolean | null
          short_description?: string | null
          sku?: string | null
          slug: string
          stock?: number | null
          sync_inventory?: boolean | null
          tags?: string[] | null
          tenant_id: string
          track_inventory?: boolean | null
          updated_at?: string | null
          vat_rate_id?: string | null
          weight?: number | null
        }
        Update: {
          allow_backorder?: boolean | null
          amazon_asin?: string | null
          barcode?: string | null
          bol_ean?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          featured_image?: string | null
          id?: string
          images?: string[] | null
          import_job_id?: string | null
          imported_at?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          last_inventory_sync?: string | null
          low_stock_threshold?: number | null
          marketplace_mappings?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          original_category_value?: string | null
          price?: number
          requires_shipping?: boolean | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock?: number | null
          sync_inventory?: boolean | null
          tags?: string[] | null
          tenant_id?: string
          track_inventory?: boolean | null
          updated_at?: string | null
          vat_rate_id?: string | null
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
            foreignKeyName: "products_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vat_rate_id_fkey"
            columns: ["vat_rate_id"]
            isOneToOne: false
            referencedRelation: "vat_rates"
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
      proforma_invoice_lines: {
        Row: {
          created_at: string | null
          description: string
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          line_total: number
          line_type: string | null
          product_id: string | null
          proforma_id: string | null
          quantity: number | null
          sort_order: number | null
          unit_price: number
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          line_total: number
          line_type?: string | null
          product_id?: string | null
          proforma_id?: string | null
          quantity?: number | null
          sort_order?: number | null
          unit_price: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          line_total?: number
          line_type?: string | null
          product_id?: string | null
          proforma_id?: string | null
          quantity?: number | null
          sort_order?: number | null
          unit_price?: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proforma_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoice_lines_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proforma_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      proforma_invoices: {
        Row: {
          converted_to_invoice_id: string | null
          created_at: string | null
          customer_id: string | null
          discount_total: number | null
          id: string
          notes: string | null
          proforma_number: string
          shipping_method_id: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string
          total: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          converted_to_invoice_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_total?: number | null
          id?: string
          notes?: string | null
          proforma_number: string
          shipping_method_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id: string
          total?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          converted_to_invoice_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_total?: number | null
          id?: string
          notes?: string | null
          proforma_number?: string
          shipping_method_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string
          total?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proforma_invoices_converted_to_invoice_id_fkey"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      segment_members: {
        Row: {
          added_at: string | null
          customer_id: string
          id: string
          segment_id: string
        }
        Insert: {
          added_at?: string | null
          customer_id: string
          id?: string
          segment_id: string
        }
        Update: {
          added_at?: string | null
          customer_id?: string
          id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_members_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
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
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          price: number
          sort_order: number | null
          tenant_id: string
          updated_at: string
          vat_rate_id: string | null
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
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          price?: number
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
          vat_rate_id?: string | null
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
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          price?: number
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
          vat_rate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_methods_vat_rate_id_fkey"
            columns: ["vat_rate_id"]
            isOneToOne: false
            referencedRelation: "vat_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          generated_at: string | null
          id: string
          invoice_id: string
          subscription_id: string
        }
        Insert: {
          generated_at?: string | null
          id?: string
          invoice_id: string
          subscription_id: string
        }
        Update: {
          generated_at?: string | null
          id?: string
          invoice_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_lines: {
        Row: {
          created_at: string | null
          description: string
          id: string
          quantity: number | null
          sort_order: number | null
          subscription_id: string
          unit_price: number
          vat_rate: number | null
          vat_rate_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          quantity?: number | null
          sort_order?: number | null
          subscription_id: string
          unit_price: number
          vat_rate?: number | null
          vat_rate_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          quantity?: number | null
          sort_order?: number | null
          subscription_id?: string
          unit_price?: number
          vat_rate?: number | null
          vat_rate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_lines_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_lines_vat_rate_id_fkey"
            columns: ["vat_rate_id"]
            isOneToOne: false
            referencedRelation: "vat_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_notifications: {
        Row: {
          id: string
          next_invoice_date: string | null
          notification_type: string
          sent_at: string | null
          subscription_id: string
        }
        Insert: {
          id?: string
          next_invoice_date?: string | null
          notification_type: string
          sent_at?: string | null
          subscription_id: string
        }
        Update: {
          id?: string
          next_invoice_date?: string | null
          notification_type?: string
          sent_at?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notifications_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_send: boolean | null
          created_at: string | null
          customer_id: string
          end_date: string | null
          generate_days_before: number | null
          id: string
          interval: string
          interval_count: number | null
          last_invoice_date: string | null
          name: string
          next_invoice_date: string
          notify_before_renewal: boolean | null
          notify_days_before: number | null
          payment_term_days: number | null
          start_date: string
          status: string | null
          subtotal: number | null
          tenant_id: string
          total: number | null
          updated_at: string | null
          vat_total: number | null
        }
        Insert: {
          auto_send?: boolean | null
          created_at?: string | null
          customer_id: string
          end_date?: string | null
          generate_days_before?: number | null
          id?: string
          interval: string
          interval_count?: number | null
          last_invoice_date?: string | null
          name: string
          next_invoice_date: string
          notify_before_renewal?: boolean | null
          notify_days_before?: number | null
          payment_term_days?: number | null
          start_date: string
          status?: string | null
          subtotal?: number | null
          tenant_id: string
          total?: number | null
          updated_at?: string | null
          vat_total?: number | null
        }
        Update: {
          auto_send?: boolean | null
          created_at?: string | null
          customer_id?: string
          end_date?: string | null
          generate_days_before?: number | null
          id?: string
          interval?: string
          interval_count?: number | null
          last_invoice_date?: string | null
          name?: string
          next_invoice_date?: string
          notify_before_renewal?: boolean | null
          notify_days_before?: number | null
          payment_term_days?: number | null
          start_date?: string
          status?: string | null
          subtotal?: number | null
          tenant_id?: string
          total?: number | null
          updated_at?: string | null
          vat_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          marketplace_connection_id: string | null
          max_attempts: number | null
          payload: Json | null
          processed_at: string | null
          scheduled_for: string | null
          status: string | null
          sync_type: string
          tenant_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          marketplace_connection_id?: string | null
          max_attempts?: number | null
          payload?: Json | null
          processed_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          sync_type: string
          tenant_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          marketplace_connection_id?: string | null
          max_attempts?: number | null
          payload?: Json | null
          processed_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          sync_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_queue_marketplace_connection_id_fkey"
            columns: ["marketplace_connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_credits: {
        Row: {
          created_at: string
          credits_purchased: number
          credits_reset_at: string | null
          credits_total: number
          credits_used: number
          id: string
          last_purchase_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_purchased?: number
          credits_reset_at?: string | null
          credits_total?: number
          credits_used?: number
          id?: string
          last_purchase_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_purchased?: number
          credits_reset_at?: string | null
          credits_total?: number
          credits_used?: number
          id?: string
          last_purchase_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          billing_interval: string
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_payment_amount: number | null
          last_payment_date: string | null
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string | null
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          billing_interval?: string
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_interval?: string
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
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
          bic: string | null
          billing_address: Json | null
          billing_company_name: string | null
          billing_email: string | null
          billing_vat_number: string | null
          block_invalid_vat_orders: boolean | null
          btw_number: string | null
          city: string | null
          country: string | null
          created_at: string | null
          credit_note_prefix: string | null
          credit_note_start_number: number | null
          currency: string | null
          custom_domain: string | null
          default_vat_handling: string | null
          export_text: string | null
          iban: string | null
          id: string
          invoice_bcc_email: string | null
          invoice_cc_email: string | null
          invoice_email_body: string | null
          invoice_email_subject: string | null
          invoice_format: string | null
          invoice_prefix: string | null
          invoice_start_number: number | null
          kvk_number: string | null
          language: string | null
          last_login: string | null
          logo_url: string | null
          name: string
          oss_identification_number: string | null
          oss_registration_date: string | null
          owner_email: string
          owner_name: string | null
          packing_slip_prefix: string | null
          packing_slip_start_number: number | null
          peppol_id: string | null
          phone: string | null
          postal_code: string | null
          primary_color: string | null
          proforma_prefix: string | null
          proforma_start_number: number | null
          proforma_validity_days: number | null
          reminder_late_fee_enabled: boolean | null
          reminder_late_fee_percentage: number | null
          reminder_level1_days: number | null
          reminder_level2_days: number | null
          reminder_level3_days: number | null
          reminders_enabled: boolean | null
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
          bic?: string | null
          billing_address?: Json | null
          billing_company_name?: string | null
          billing_email?: string | null
          billing_vat_number?: string | null
          block_invalid_vat_orders?: boolean | null
          btw_number?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          credit_note_prefix?: string | null
          credit_note_start_number?: number | null
          currency?: string | null
          custom_domain?: string | null
          default_vat_handling?: string | null
          export_text?: string | null
          iban?: string | null
          id?: string
          invoice_bcc_email?: string | null
          invoice_cc_email?: string | null
          invoice_email_body?: string | null
          invoice_email_subject?: string | null
          invoice_format?: string | null
          invoice_prefix?: string | null
          invoice_start_number?: number | null
          kvk_number?: string | null
          language?: string | null
          last_login?: string | null
          logo_url?: string | null
          name: string
          oss_identification_number?: string | null
          oss_registration_date?: string | null
          owner_email: string
          owner_name?: string | null
          packing_slip_prefix?: string | null
          packing_slip_start_number?: number | null
          peppol_id?: string | null
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          proforma_prefix?: string | null
          proforma_start_number?: number | null
          proforma_validity_days?: number | null
          reminder_late_fee_enabled?: boolean | null
          reminder_late_fee_percentage?: number | null
          reminder_level1_days?: number | null
          reminder_level2_days?: number | null
          reminder_level3_days?: number | null
          reminders_enabled?: boolean | null
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
          bic?: string | null
          billing_address?: Json | null
          billing_company_name?: string | null
          billing_email?: string | null
          billing_vat_number?: string | null
          block_invalid_vat_orders?: boolean | null
          btw_number?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          credit_note_prefix?: string | null
          credit_note_start_number?: number | null
          currency?: string | null
          custom_domain?: string | null
          default_vat_handling?: string | null
          export_text?: string | null
          iban?: string | null
          id?: string
          invoice_bcc_email?: string | null
          invoice_cc_email?: string | null
          invoice_email_body?: string | null
          invoice_email_subject?: string | null
          invoice_format?: string | null
          invoice_prefix?: string | null
          invoice_start_number?: number | null
          kvk_number?: string | null
          language?: string | null
          last_login?: string | null
          logo_url?: string | null
          name?: string
          oss_identification_number?: string | null
          oss_registration_date?: string | null
          owner_email?: string
          owner_name?: string | null
          packing_slip_prefix?: string | null
          packing_slip_start_number?: number | null
          peppol_id?: string | null
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          proforma_prefix?: string | null
          proforma_start_number?: number | null
          proforma_validity_days?: number | null
          reminder_late_fee_enabled?: boolean | null
          reminder_late_fee_percentage?: number | null
          reminder_level1_days?: number | null
          reminder_level2_days?: number | null
          reminder_level3_days?: number | null
          reminders_enabled?: boolean | null
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
      vat_rates: {
        Row: {
          category: string
          country_code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          rate: number
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          country_code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          rate: number
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          country_code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          rate?: number
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vat_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_returns: {
        Row: {
          created_at: string | null
          credit_note_count: number | null
          domestic_taxable: number | null
          domestic_vat: number | null
          exported_at: string | null
          exports: number | null
          id: string
          intra_community: number | null
          invoice_count: number | null
          period: number
          period_type: string
          status: string | null
          submitted_at: string | null
          tenant_id: string
          vat_due: number | null
          year: number
        }
        Insert: {
          created_at?: string | null
          credit_note_count?: number | null
          domestic_taxable?: number | null
          domestic_vat?: number | null
          exported_at?: string | null
          exports?: number | null
          id?: string
          intra_community?: number | null
          invoice_count?: number | null
          period: number
          period_type: string
          status?: string | null
          submitted_at?: string | null
          tenant_id: string
          vat_due?: number | null
          year: number
        }
        Update: {
          created_at?: string | null
          credit_note_count?: number | null
          domestic_taxable?: number | null
          domestic_vat?: number | null
          exported_at?: string | null
          exports?: number | null
          id?: string
          intra_community?: number | null
          invoice_count?: number | null
          period?: number
          period_type?: string
          status?: string | null
          submitted_at?: string | null
          tenant_id?: string
          vat_due?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vat_returns_tenant_id_fkey"
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
      add_ai_credits: {
        Args: { p_credits: number; p_tenant_id: string }
        Returns: undefined
      }
      decrement_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      generate_credit_note_number: {
        Args: { _tenant_id: string }
        Returns: string
      }
      generate_invoice_number: { Args: { _tenant_id: string }; Returns: string }
      generate_order_number: { Args: { _tenant_id: string }; Returns: string }
      generate_packing_slip_number: {
        Args: { _tenant_id: string }
        Returns: string
      }
      generate_proforma_number: {
        Args: { _tenant_id: string }
        Returns: string
      }
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
      increment_campaign_bounced: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      increment_campaign_clicked: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      increment_campaign_delivered: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      increment_campaign_opened: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      reset_monthly_ai_credits: {
        Args: { p_monthly_credits: number; p_tenant_id: string }
        Returns: undefined
      }
      use_ai_credits: {
        Args: {
          p_credits: number
          p_feature: string
          p_metadata?: Json
          p_model?: string
          p_tenant_id: string
        }
        Returns: boolean
      }
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
