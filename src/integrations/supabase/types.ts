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
      ab_test_configs: {
        Row: {
          auto_select_winner: boolean | null
          campaign_a_id: string
          campaign_b_id: string
          created_at: string | null
          id: string
          status: string | null
          tenant_id: string
          test_metric: string | null
          test_percentage: number | null
          updated_at: string | null
          winner_id: string | null
          winner_threshold: number | null
        }
        Insert: {
          auto_select_winner?: boolean | null
          campaign_a_id: string
          campaign_b_id: string
          created_at?: string | null
          id?: string
          status?: string | null
          tenant_id: string
          test_metric?: string | null
          test_percentage?: number | null
          updated_at?: string | null
          winner_id?: string | null
          winner_threshold?: number | null
        }
        Update: {
          auto_select_winner?: boolean | null
          campaign_a_id?: string
          campaign_b_id?: string
          created_at?: string | null
          id?: string
          status?: string | null
          tenant_id?: string
          test_metric?: string | null
          test_percentage?: number | null
          updated_at?: string | null
          winner_id?: string | null
          winner_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_configs_campaign_a_id_fkey"
            columns: ["campaign_a_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_configs_campaign_b_id_fkey"
            columns: ["campaign_b_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_configs_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_actions_log: {
        Row: {
          action_details: Json
          action_type: string
          admin_user_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          target_tenant_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_details?: Json
          action_type: string
          admin_user_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          target_tenant_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_details?: Json
          action_type?: string
          admin_user_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          target_tenant_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_log_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_action_suggestions: {
        Row: {
          action_data: Json
          confidence_score: number | null
          created_at: string
          description: string | null
          executed_at: string | null
          executed_by: string | null
          expires_at: string | null
          id: string
          notification_id: string | null
          priority: string
          reasoning: string | null
          status: string
          suggestion_type: string
          tenant_id: string
          title: string
          updated_at: string
          user_modifications: Json | null
        }
        Insert: {
          action_data?: Json
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          executed_at?: string | null
          executed_by?: string | null
          expires_at?: string | null
          id?: string
          notification_id?: string | null
          priority?: string
          reasoning?: string | null
          status?: string
          suggestion_type: string
          tenant_id: string
          title: string
          updated_at?: string
          user_modifications?: Json | null
        }
        Update: {
          action_data?: Json
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          executed_at?: string | null
          executed_by?: string | null
          expires_at?: string | null
          id?: string
          notification_id?: string | null
          priority?: string
          reasoning?: string | null
          status?: string
          suggestion_type?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_modifications?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_content_edits: {
        Row: {
          after_value: string | null
          before_value: string | null
          content_id: string | null
          created_at: string
          edit_type: string
          feedback_id: string | null
          field_changed: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          after_value?: string | null
          before_value?: string | null
          content_id?: string | null
          created_at?: string
          edit_type: string
          feedback_id?: string | null
          field_changed?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          after_value?: string | null
          before_value?: string | null
          content_id?: string | null
          created_at?: string
          edit_type?: string
          feedback_id?: string | null
          field_changed?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_edits_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ai_content_engagement_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_content_edits_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_content_edits_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "ai_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_content_edits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_purchases: {
        Row: {
          completed_at: string | null
          created_at: string | null
          credits_amount: number
          currency: string | null
          id: string
          price_paid: number
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          credits_amount: number
          currency?: string | null
          id?: string
          price_paid: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          credits_amount?: number
          currency?: string | null
          id?: string
          price_paid?: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          comments: string | null
          content_id: string | null
          content_type: string | null
          created_at: string
          edit_reason: string | null
          edited_content: string | null
          feedback_type: string
          id: string
          metadata: Json | null
          original_content: string | null
          rating: number | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          comments?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          edit_reason?: string | null
          edited_content?: string | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          original_content?: string | null
          rating?: number | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          comments?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          edit_reason?: string | null
          edited_content?: string | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          original_content?: string | null
          rating?: number | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ai_content_engagement_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_tenant_id_fkey"
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
          language: string | null
          metadata: Json | null
          platform: string | null
          product_ids: string[] | null
          publish_error: string | null
          publish_status: string | null
          published_at: string | null
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
          language?: string | null
          metadata?: Json | null
          platform?: string | null
          product_ids?: string[] | null
          publish_error?: string | null
          publish_status?: string | null
          published_at?: string | null
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
          language?: string | null
          metadata?: Json | null
          platform?: string | null
          product_ids?: string[] | null
          publish_error?: string | null
          publish_status?: string | null
          published_at?: string | null
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
      ai_generated_images: {
        Row: {
          content_id: string | null
          created_at: string | null
          credits_used: number | null
          enhancement_type: string | null
          height: number | null
          id: string
          image_url: string
          marketing_text: string | null
          platform_preset: string | null
          prompt: string
          setting_preset: string | null
          source_image_url: string | null
          source_product_id: string | null
          storage_path: string | null
          style: string | null
          tenant_id: string
          width: number | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          credits_used?: number | null
          enhancement_type?: string | null
          height?: number | null
          id?: string
          image_url: string
          marketing_text?: string | null
          platform_preset?: string | null
          prompt: string
          setting_preset?: string | null
          source_image_url?: string | null
          source_product_id?: string | null
          storage_path?: string | null
          style?: string | null
          tenant_id: string
          width?: number | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          credits_used?: number | null
          enhancement_type?: string | null
          height?: number | null
          id?: string
          image_url?: string
          marketing_text?: string | null
          platform_preset?: string | null
          prompt?: string
          setting_preset?: string | null
          source_image_url?: string | null
          source_product_id?: string | null
          storage_path?: string | null
          style?: string | null
          tenant_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_images_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ai_content_engagement_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_images_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_images_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_learning_patterns: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          last_updated_at: string | null
          learned_value: Json
          pattern_type: string
          sample_count: number | null
          tenant_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          last_updated_at?: string | null
          learned_value?: Json
          pattern_type: string
          sample_count?: number | null
          tenant_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          last_updated_at?: string | null
          learned_value?: Json
          pattern_type?: string
          sample_count?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_learning_patterns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_favorites: {
        Row: {
          created_at: string | null
          id: string
          name: string
          prompt_text: string
          prompt_type: string
          settings: Json | null
          tenant_id: string
          updated_at: string | null
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          prompt_text: string
          prompt_type: string
          settings?: Json | null
          tenant_id: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          prompt_text?: string
          prompt_type?: string
          settings?: Json | null
          tenant_id?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_favorites_tenant_id_fkey"
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
      automatic_discounts: {
        Row: {
          applies_to: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number | null
          free_product_id: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          name: string
          priority: number
          product_ids: string[] | null
          schedule: Json | null
          tenant_id: string
          trigger_product_ids: string[] | null
          trigger_type: string
          trigger_value: number | null
          updated_at: string
          usage_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to?: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value?: number | null
          free_product_id?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          name: string
          priority?: number
          product_ids?: string[] | null
          schedule?: Json | null
          tenant_id: string
          trigger_product_ids?: string[] | null
          trigger_type: string
          trigger_value?: number | null
          updated_at?: string
          usage_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          free_product_id?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          name?: string
          priority?: number
          product_ids?: string[] | null
          schedule?: Json | null
          tenant_id?: string
          trigger_product_ids?: string[] | null
          trigger_type?: string
          trigger_value?: number | null
          updated_at?: string
          usage_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automatic_discounts_free_product_id_fkey"
            columns: ["free_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automatic_discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          scheduled_for: string | null
          started_at: string | null
          status: string | null
          tenant_id: string
          trigger_entity_id: string | null
          trigger_entity_type: string
        }
        Insert: {
          automation_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string | null
          tenant_id: string
          trigger_entity_id?: string | null
          trigger_entity_type: string
        }
        Update: {
          automation_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string | null
          tenant_id?: string
          trigger_entity_id?: string | null
          trigger_entity_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_step_runs: {
        Row: {
          automation_run_id: string
          created_at: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          result: Json | null
          scheduled_for: string | null
          status: string | null
          step_id: string
        }
        Insert: {
          automation_run_id: string
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          result?: Json | null
          scheduled_for?: string | null
          status?: string | null
          step_id: string
        }
        Update: {
          automation_run_id?: string
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          result?: Json | null
          scheduled_for?: string | null
          status?: string | null
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_step_runs_automation_run_id_fkey"
            columns: ["automation_run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_step_runs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          action_type: string
          automation_id: string
          condition_rules: Json | null
          created_at: string | null
          delay_hours: number | null
          delay_minutes: number | null
          id: string
          is_active: boolean | null
          step_order: number
          subject_override: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          action_type: string
          automation_id: string
          condition_rules?: Json | null
          created_at?: string | null
          delay_hours?: number | null
          delay_minutes?: number | null
          id?: string
          is_active?: boolean | null
          step_order: number
          subject_override?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          automation_id?: string
          condition_rules?: Json | null
          created_at?: string | null
          delay_hours?: number | null
          delay_minutes?: number | null
          id?: string
          is_active?: boolean | null
          step_order?: number
          subject_override?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bogo_promotions: {
        Row: {
          buy_category_ids: string[] | null
          buy_product_ids: string[] | null
          buy_quantity: number
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          get_category_ids: string[] | null
          get_product_ids: string[] | null
          get_quantity: number
          id: string
          is_active: boolean
          max_uses_per_order: number | null
          name: string
          promotion_type: string
          tenant_id: string
          updated_at: string
          usage_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          buy_category_ids?: string[] | null
          buy_product_ids?: string[] | null
          buy_quantity?: number
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          get_category_ids?: string[] | null
          get_product_ids?: string[] | null
          get_quantity?: number
          id?: string
          is_active?: boolean
          max_uses_per_order?: number | null
          name: string
          promotion_type?: string
          tenant_id: string
          updated_at?: string
          usage_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          buy_category_ids?: string[] | null
          buy_product_ids?: string[] | null
          buy_quantity?: number
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          get_category_ids?: string[] | null
          get_product_ids?: string[] | null
          get_quantity?: number
          id?: string
          is_active?: boolean
          max_uses_per_order?: number | null
          name?: string
          promotion_type?: string
          tenant_id?: string
          updated_at?: string
          usage_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bogo_promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_products: {
        Row: {
          bundle_id: string
          created_at: string
          group_name: string | null
          id: string
          is_required: boolean
          product_id: string
          quantity: number
          sort_order: number
        }
        Insert: {
          bundle_id: string
          created_at?: string
          group_name?: string | null
          id?: string
          is_required?: boolean
          product_id: string
          quantity?: number
          sort_order?: number
        }
        Update: {
          bundle_id?: string
          created_at?: string
          group_name?: string | null
          id?: string
          is_required?: boolean
          product_id?: string
          quantity?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_products_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          hide_from_storefront: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          meta_description_de: string | null
          meta_description_en: string | null
          meta_description_fr: string | null
          meta_description_nl: string | null
          meta_title_de: string | null
          meta_title_en: string | null
          meta_title_fr: string | null
          meta_title_nl: string | null
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
          hide_from_storefront?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          meta_description_de?: string | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          meta_description_nl?: string | null
          meta_title_de?: string | null
          meta_title_en?: string | null
          meta_title_fr?: string | null
          meta_title_nl?: string | null
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
          hide_from_storefront?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          meta_description_de?: string | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          meta_description_nl?: string | null
          meta_title_de?: string | null
          meta_title_en?: string | null
          meta_title_fr?: string | null
          meta_title_nl?: string | null
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
      content_translations: {
        Row: {
          auto_sync_enabled: boolean | null
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          is_auto_translated: boolean | null
          is_locked: boolean | null
          last_source_hash: string | null
          source_content: string | null
          source_language: string
          target_language: string
          tenant_id: string
          translated_at: string | null
          translated_by: string | null
          translated_content: string | null
          translation_quality_score: number | null
          updated_at: string
        }
        Insert: {
          auto_sync_enabled?: boolean | null
          created_at?: string
          entity_id: string
          entity_type: string
          field_name: string
          id?: string
          is_auto_translated?: boolean | null
          is_locked?: boolean | null
          last_source_hash?: string | null
          source_content?: string | null
          source_language?: string
          target_language: string
          tenant_id: string
          translated_at?: string | null
          translated_by?: string | null
          translated_content?: string | null
          translation_quality_score?: number | null
          updated_at?: string
        }
        Update: {
          auto_sync_enabled?: boolean | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string
          id?: string
          is_auto_translated?: boolean | null
          is_locked?: boolean | null
          last_source_hash?: string | null
          source_content?: string | null
          source_language?: string
          target_language?: string
          tenant_id?: string
          translated_at?: string | null
          translated_by?: string | null
          translated_content?: string | null
          translation_quality_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_translations_tenant_id_fkey"
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
      customer_group_members: {
        Row: {
          customer_group_id: string
          customer_id: string
          expires_at: string | null
          id: string
          joined_at: string
        }
        Insert: {
          customer_group_id: string
          customer_id: string
          expires_at?: string | null
          id?: string
          joined_at?: string
        }
        Update: {
          customer_group_id?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_group_members_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_group_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_group_product_prices: {
        Row: {
          created_at: string
          custom_price: number | null
          customer_group_id: string
          discount_percentage: number | null
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          custom_price?: number | null
          customer_group_id: string
          discount_percentage?: number | null
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          custom_price?: number | null
          customer_group_id?: string
          discount_percentage?: number | null
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_group_product_prices_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_group_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_groups: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          is_active: boolean
          min_order_amount: number | null
          name: string
          priority: number
          tax_exempt: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          min_order_amount?: number | null
          name: string
          priority?: number
          tax_exempt?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          min_order_amount?: number | null
          name?: string
          priority?: number
          tax_exempt?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty: {
        Row: {
          current_tier_id: string | null
          customer_id: string
          id: string
          joined_at: string
          last_activity_at: string | null
          loyalty_program_id: string
          points_balance: number
          points_earned_total: number
          points_spent_total: number
        }
        Insert: {
          current_tier_id?: string | null
          customer_id: string
          id?: string
          joined_at?: string
          last_activity_at?: string | null
          loyalty_program_id: string
          points_balance?: number
          points_earned_total?: number
          points_spent_total?: number
        }
        Update: {
          current_tier_id?: string | null
          customer_id?: string
          id?: string
          joined_at?: string
          last_activity_at?: string | null
          loyalty_program_id?: string
          points_balance?: number
          points_earned_total?: number
          points_spent_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_current_tier_id_fkey"
            columns: ["current_tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_messages: {
        Row: {
          body_html: string
          body_text: string | null
          context_data: Json | null
          context_type: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          direction: string
          error_message: string | null
          from_email: string
          id: string
          opened_at: string | null
          order_id: string | null
          quote_id: string | null
          reply_to_email: string | null
          resend_id: string | null
          sent_at: string | null
          status: string
          subject: string
          tenant_id: string
          to_email: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          context_data?: Json | null
          context_type?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          from_email: string
          id?: string
          opened_at?: string | null
          order_id?: string | null
          quote_id?: string | null
          reply_to_email?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          tenant_id: string
          to_email: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          context_data?: Json | null
          context_type?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          from_email?: string
          id?: string
          opened_at?: string | null
          order_id?: string | null
          quote_id?: string | null
          reply_to_email?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_messages_tenant_id_fkey"
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
          shopify_customer_id: string | null
          shopify_last_synced_at: string | null
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
          shopify_customer_id?: string | null
          shopify_last_synced_at?: string | null
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
          shopify_customer_id?: string | null
          shopify_last_synced_at?: string | null
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
      dashboard_preferences: {
        Row: {
          created_at: string
          hidden_widgets: string[] | null
          id: string
          layout_type: string
          tenant_id: string
          updated_at: string
          user_id: string
          widget_order: Json | null
          widget_sizes: Json | null
        }
        Insert: {
          created_at?: string
          hidden_widgets?: string[] | null
          id?: string
          layout_type?: string
          tenant_id: string
          updated_at?: string
          user_id: string
          widget_order?: Json | null
          widget_sizes?: Json | null
        }
        Update: {
          created_at?: string
          hidden_widgets?: string[] | null
          id?: string
          layout_type?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          widget_order?: Json | null
          widget_sizes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_deliveries: {
        Row: {
          access_url: string | null
          created_at: string | null
          delivery_data: Json | null
          download_count: number | null
          download_limit: number | null
          download_token: string | null
          download_url: string | null
          expires_at: string | null
          first_accessed_at: string | null
          id: string
          last_accessed_at: string | null
          license_key_id: string | null
          order_item_id: string
          product_file_id: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          access_url?: string | null
          created_at?: string | null
          delivery_data?: Json | null
          download_count?: number | null
          download_limit?: number | null
          download_token?: string | null
          download_url?: string | null
          expires_at?: string | null
          first_accessed_at?: string | null
          id?: string
          last_accessed_at?: string | null
          license_key_id?: string | null
          order_item_id: string
          product_file_id?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          access_url?: string | null
          created_at?: string | null
          delivery_data?: Json | null
          download_count?: number | null
          download_limit?: number | null
          download_token?: string | null
          download_url?: string | null
          expires_at?: string | null
          first_accessed_at?: string | null
          id?: string
          last_accessed_at?: string | null
          license_key_id?: string | null
          order_item_id?: string
          product_file_id?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_deliveries_license_key_id_fkey"
            columns: ["license_key_id"]
            isOneToOne: false
            referencedRelation: "license_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_deliveries_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_deliveries_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items_warehouse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_deliveries_product_file_id_fkey"
            columns: ["product_file_id"]
            isOneToOne: false
            referencedRelation: "product_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_code_usage: {
        Row: {
          created_at: string
          customer_email: string
          discount_amount: number
          discount_code_id: string
          id: string
          order_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email: string
          discount_amount: number
          discount_code_id: string
          id?: string
          order_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string
          discount_amount?: number
          discount_code_id?: string
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applies_to: string
          category_ids: string[] | null
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          first_order_only: boolean
          id: string
          is_active: boolean
          maximum_discount_amount: number | null
          minimum_order_amount: number | null
          product_ids: string[] | null
          tenant_id: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
          usage_limit_per_customer: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to?: string
          category_ids?: string[] | null
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          maximum_discount_amount?: number | null
          minimum_order_amount?: number | null
          product_ids?: string[] | null
          tenant_id: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to?: string
          category_ids?: string[] | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          maximum_discount_amount?: number | null
          minimum_order_amount?: number | null
          product_ids?: string[] | null
          tenant_id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_stacking_rules: {
        Row: {
          created_at: string
          description: string | null
          discount_types: string[] | null
          id: string
          is_active: boolean
          max_stack_count: number | null
          max_total_discount_percent: number | null
          name: string
          priority_order: string[] | null
          rule_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_types?: string[] | null
          id?: string
          is_active?: boolean
          max_stack_count?: number | null
          max_total_discount_percent?: number | null
          name: string
          priority_order?: string[] | null
          rule_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_types?: string[] | null
          id?: string
          is_active?: boolean
          max_stack_count?: number | null
          max_total_discount_percent?: number | null
          name?: string
          priority_order?: string[] | null
          rule_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_stacking_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          cooldown_hours: number | null
          created_at: string | null
          delay_hours: number | null
          description: string | null
          id: string
          is_active: boolean | null
          max_runs_per_customer: number | null
          name: string
          priority: number | null
          segment_id: string | null
          template_id: string | null
          tenant_id: string
          total_completed: number | null
          total_converted: number | null
          total_runs: number | null
          total_sent: number | null
          trigger_conditions: Json | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          cooldown_hours?: number | null
          created_at?: string | null
          delay_hours?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_runs_per_customer?: number | null
          name: string
          priority?: number | null
          segment_id?: string | null
          template_id?: string | null
          tenant_id: string
          total_completed?: number | null
          total_converted?: number | null
          total_runs?: number | null
          total_sent?: number | null
          trigger_conditions?: Json | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          cooldown_hours?: number | null
          created_at?: string | null
          delay_hours?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_runs_per_customer?: number | null
          name?: string
          priority?: number | null
          segment_id?: string | null
          template_id?: string | null
          tenant_id?: string
          total_completed?: number | null
          total_converted?: number | null
          total_runs?: number | null
          total_sent?: number | null
          trigger_conditions?: Json | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automations_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
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
          ab_test_winner_selected_at: string | null
          ab_variant_of: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          html_content: string
          id: string
          is_ab_test: boolean | null
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
          variant_label: string | null
        }
        Insert: {
          ab_test_winner_selected_at?: string | null
          ab_variant_of?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          html_content: string
          id?: string
          is_ab_test?: boolean | null
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
          variant_label?: string | null
        }
        Update: {
          ab_test_winner_selected_at?: string | null
          ab_variant_of?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          html_content?: string
          id?: string
          is_ab_test?: boolean | null
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
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_ab_variant_of_fkey"
            columns: ["ab_variant_of"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
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
      email_preferences: {
        Row: {
          created_at: string | null
          customer_id: string | null
          email: string
          frequency: string | null
          id: string
          newsletter: boolean | null
          preference_token: string | null
          product_updates: boolean | null
          promotions: boolean | null
          tenant_id: string
          transactional: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          email: string
          frequency?: string | null
          id?: string
          newsletter?: boolean | null
          preference_token?: string | null
          product_updates?: boolean | null
          promotions?: boolean | null
          tenant_id: string
          transactional?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          email?: string
          frequency?: string | null
          id?: string
          newsletter?: boolean | null
          preference_token?: string | null
          product_updates?: boolean | null
          promotions?: boolean | null
          tenant_id?: string
          transactional?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_blocks: {
        Row: {
          block_order: number
          block_type: string
          content: Json | null
          created_at: string | null
          id: string
          style: Json | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          block_order: number
          block_type: string
          content?: Json | null
          created_at?: string | null
          id?: string
          style?: Json | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          block_order?: number
          block_type?: string
          content?: Json | null
          created_at?: string | null
          id?: string
          style?: Json | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_template_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
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
      external_reviews: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          connection_id: string
          created_at: string | null
          external_review_id: string
          id: string
          is_featured: boolean | null
          is_verified: boolean | null
          is_visible: boolean | null
          language: string | null
          metadata: Json | null
          platform: string
          rating: number | null
          reply: string | null
          reply_date: string | null
          review_date: string | null
          synced_at: string | null
          tenant_id: string
          text: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          connection_id: string
          created_at?: string | null
          external_review_id: string
          id?: string
          is_featured?: boolean | null
          is_verified?: boolean | null
          is_visible?: boolean | null
          language?: string | null
          metadata?: Json | null
          platform: string
          rating?: number | null
          reply?: string | null
          reply_date?: string | null
          review_date?: string | null
          synced_at?: string | null
          tenant_id: string
          text?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          connection_id?: string
          created_at?: string | null
          external_review_id?: string
          id?: string
          is_featured?: boolean | null
          is_verified?: boolean | null
          is_visible?: boolean | null
          language?: string | null
          metadata?: Json | null
          platform?: string
          rating?: number | null
          reply?: string | null
          reply_date?: string | null
          review_date?: string | null
          synced_at?: string | null
          tenant_id?: string
          text?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_reviews_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "review_platform_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_usage_events: {
        Row: {
          action_type: string
          created_at: string | null
          element_id: string | null
          feature_name: string
          id: string
          metadata: Json | null
          page_path: string
          session_id: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          element_id?: string | null
          feature_name: string
          id?: string
          metadata?: Json | null
          page_path: string
          session_id?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          element_id?: string | null
          feature_name?: string
          id?: string
          metadata?: Json | null
          page_path?: string
          session_id?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_api_keys: {
        Row: {
          api_key: string
          api_secret: string | null
          created_at: string | null
          id: string
          ip_whitelist: string[] | null
          is_active: boolean | null
          last_used_at: string | null
          name: string
          permissions: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_key: string
          api_secret?: string | null
          created_at?: string | null
          id?: string
          ip_whitelist?: string[] | null
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          permissions?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          api_secret?: string | null
          created_at?: string | null
          id?: string
          ip_whitelist?: string[] | null
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          permissions?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_designs: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_designs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          gift_card_id: string
          id: string
          order_id: string | null
          transaction_type: Database["public"]["Enums"]["gift_card_transaction_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          gift_card_id: string
          id?: string
          order_id?: string | null
          transaction_type: Database["public"]["Enums"]["gift_card_transaction_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          gift_card_id?: string
          id?: string
          order_id?: string | null
          transaction_type?: Database["public"]["Enums"]["gift_card_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          activated_at: string | null
          code: string
          created_at: string
          currency: string
          current_balance: number
          design_id: string | null
          email_resent_count: number | null
          email_sent_at: string | null
          expires_at: string | null
          id: string
          initial_balance: number
          order_id: string | null
          personal_message: string | null
          pos_terminal_id: string | null
          pos_transaction_id: string | null
          printed_at: string | null
          purchased_by_customer_id: string | null
          purchased_by_email: string | null
          recipient_email: string | null
          recipient_name: string | null
          sold_via_pos: boolean | null
          status: Database["public"]["Enums"]["gift_card_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          code: string
          created_at?: string
          currency?: string
          current_balance: number
          design_id?: string | null
          email_resent_count?: number | null
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          initial_balance: number
          order_id?: string | null
          personal_message?: string | null
          pos_terminal_id?: string | null
          pos_transaction_id?: string | null
          printed_at?: string | null
          purchased_by_customer_id?: string | null
          purchased_by_email?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sold_via_pos?: boolean | null
          status?: Database["public"]["Enums"]["gift_card_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          code?: string
          created_at?: string
          currency?: string
          current_balance?: number
          design_id?: string | null
          email_resent_count?: number | null
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          initial_balance?: number
          order_id?: string | null
          personal_message?: string | null
          pos_terminal_id?: string | null
          pos_transaction_id?: string | null
          printed_at?: string | null
          purchased_by_customer_id?: string | null
          purchased_by_email?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sold_via_pos?: boolean | null
          status?: Database["public"]["Enums"]["gift_card_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "gift_card_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_pos_terminal_id_fkey"
            columns: ["pos_terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_purchased_by_customer_id_fkey"
            columns: ["purchased_by_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_promotions: {
        Row: {
          created_at: string
          description: string | null
          gift_product_id: string
          gift_quantity: number
          id: string
          is_active: boolean
          is_stackable: boolean
          max_per_order: number | null
          name: string
          stock_limit: number | null
          stock_used: number
          tenant_id: string
          trigger_category_ids: string[] | null
          trigger_product_ids: string[] | null
          trigger_type: string
          trigger_value: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          gift_product_id: string
          gift_quantity?: number
          id?: string
          is_active?: boolean
          is_stackable?: boolean
          max_per_order?: number | null
          name: string
          stock_limit?: number | null
          stock_used?: number
          tenant_id: string
          trigger_category_ids?: string[] | null
          trigger_product_ids?: string[] | null
          trigger_type: string
          trigger_value?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          gift_product_id?: string
          gift_quantity?: number
          id?: string
          is_active?: boolean
          is_stackable?: boolean
          max_per_order?: number | null
          name?: string
          stock_limit?: number | null
          stock_used?: number
          tenant_id?: string
          trigger_category_ids?: string[] | null
          trigger_product_ids?: string[] | null
          trigger_type?: string
          trigger_value?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_promotions_gift_product_id_fkey"
            columns: ["gift_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_sections: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          section_type: string
          settings: Json | null
          sort_order: number | null
          subtitle: string | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          section_type: string
          settings?: Json | null
          sort_order?: number | null
          subtitle?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          section_type?: string
          settings?: Json | null
          sort_order?: number | null
          subtitle?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homepage_sections_tenant_id_fkey"
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
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
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
      legal_pages: {
        Row: {
          content_de: string | null
          content_en: string | null
          content_fr: string | null
          content_nl: string | null
          created_at: string | null
          id: string
          is_auto_generated: boolean | null
          is_published: boolean | null
          last_auto_generated_at: string | null
          meta_description_de: string | null
          meta_description_en: string | null
          meta_description_fr: string | null
          meta_description_nl: string | null
          meta_title_de: string | null
          meta_title_en: string | null
          meta_title_fr: string | null
          meta_title_nl: string | null
          page_type: string
          tenant_id: string
          title_de: string | null
          title_en: string | null
          title_fr: string | null
          title_nl: string | null
          updated_at: string | null
        }
        Insert: {
          content_de?: string | null
          content_en?: string | null
          content_fr?: string | null
          content_nl?: string | null
          created_at?: string | null
          id?: string
          is_auto_generated?: boolean | null
          is_published?: boolean | null
          last_auto_generated_at?: string | null
          meta_description_de?: string | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          meta_description_nl?: string | null
          meta_title_de?: string | null
          meta_title_en?: string | null
          meta_title_fr?: string | null
          meta_title_nl?: string | null
          page_type: string
          tenant_id: string
          title_de?: string | null
          title_en?: string | null
          title_fr?: string | null
          title_nl?: string | null
          updated_at?: string | null
        }
        Update: {
          content_de?: string | null
          content_en?: string | null
          content_fr?: string | null
          content_nl?: string | null
          created_at?: string | null
          id?: string
          is_auto_generated?: boolean | null
          is_published?: boolean | null
          last_auto_generated_at?: string | null
          meta_description_de?: string | null
          meta_description_en?: string | null
          meta_description_fr?: string | null
          meta_description_nl?: string | null
          meta_title_de?: string | null
          meta_title_en?: string | null
          meta_title_fr?: string | null
          meta_title_nl?: string | null
          page_type?: string
          tenant_id?: string
          title_de?: string | null
          title_en?: string | null
          title_fr?: string | null
          title_nl?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      license_keys: {
        Row: {
          assigned_at: string | null
          assigned_to_order_item_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          license_key: string
          product_id: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to_order_item_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          license_key: string
          product_id: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to_order_item_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          license_key?: string
          product_id?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          min_redemption_points: number
          name: string
          point_value: number
          points_expiry_days: number | null
          points_per_euro: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          min_redemption_points?: number
          name: string
          point_value?: number
          points_expiry_days?: number | null
          points_per_euro?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          min_redemption_points?: number
          name?: string
          point_value?: number
          points_expiry_days?: number | null
          points_per_euro?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          benefits: Json | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          loyalty_program_id: string
          min_points: number
          name: string
          points_multiplier: number
          sort_order: number
        }
        Insert: {
          benefits?: Json | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          loyalty_program_id: string
          min_points?: number
          name: string
          points_multiplier?: number
          sort_order?: number
        }
        Update: {
          benefits?: Json | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          loyalty_program_id?: string
          min_points?: number
          name?: string
          points_multiplier?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_tiers_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          customer_loyalty_id: string
          description: string | null
          expires_at: string | null
          id: string
          order_id: string | null
          points: number
          transaction_type: string
        }
        Insert: {
          created_at?: string
          customer_loyalty_id: string
          description?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points: number
          transaction_type: string
        }
        Update: {
          created_at?: string
          customer_loyalty_id?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_loyalty_id_fkey"
            columns: ["customer_loyalty_id"]
            isOneToOne: false
            referencedRelation: "customer_loyalty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
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
      marketplace_listing_queue: {
        Row: {
          action: string
          ai_optimized_content: Json | null
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          marketplace_type: string
          max_attempts: number | null
          payload: Json | null
          processed_at: string | null
          product_id: string
          scheduled_for: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          action: string
          ai_optimized_content?: Json | null
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          marketplace_type: string
          max_attempts?: number | null
          payload?: Json | null
          processed_at?: string | null
          product_id: string
          scheduled_for?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          ai_optimized_content?: Json | null
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          marketplace_type?: string
          max_attempts?: number | null
          payload?: Json | null
          processed_at?: string | null
          product_id?: string
          scheduled_for?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listing_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          email: string
          external_id: string | null
          first_name: string | null
          id: string
          metadata: Json | null
          preferences: Json | null
          source: string | null
          status: string | null
          subscribed_at: string | null
          sync_error: string | null
          sync_status: string | null
          tenant_id: string
          unsubscribe_reason: string | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          email: string
          external_id?: string | null
          first_name?: string | null
          id?: string
          metadata?: Json | null
          preferences?: Json | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          sync_error?: string | null
          sync_status?: string | null
          tenant_id: string
          unsubscribe_reason?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          email?: string
          external_id?: string | null
          first_name?: string | null
          id?: string
          metadata?: Json | null
          preferences?: Json | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          sync_error?: string | null
          sync_status?: string | null
          tenant_id?: string
          unsubscribe_reason?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          data: Json | null
          email_sent_at: string | null
          id: string
          message: string
          priority: Database["public"]["Enums"]["notification_priority"] | null
          read_at: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          data?: Json | null
          email_sent_at?: string | null
          id?: string
          message: string
          priority?: Database["public"]["Enums"]["notification_priority"] | null
          read_at?: string | null
          tenant_id: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          data?: Json | null
          email_sent_at?: string | null
          id?: string
          message?: string
          priority?: Database["public"]["Enums"]["notification_priority"] | null
          read_at?: string | null
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string | null
          expires_at: string
          platform: string
          redirect_url: string
          state: string
          tenant_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string | null
          expires_at: string
          platform: string
          redirect_url: string
          state: string
          tenant_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string | null
          expires_at?: string
          platform?: string
          redirect_url?: string
          state?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      odoo_customer_sync_log: {
        Row: {
          created_at: string
          customer_id: string | null
          error_message: string | null
          id: string
          marketplace_connection_id: string
          odoo_partner_id: string | null
          sync_direction: string
          sync_status: string
          synced_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          marketplace_connection_id: string
          odoo_partner_id?: string | null
          sync_direction?: string
          sync_status?: string
          synced_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          marketplace_connection_id?: string
          odoo_partner_id?: string | null
          sync_direction?: string
          sync_status?: string
          synced_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odoo_customer_sync_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odoo_customer_sync_log_marketplace_connection_id_fkey"
            columns: ["marketplace_connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odoo_customer_sync_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      odoo_invoice_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string | null
          marketplace_connection_id: string
          odoo_move_id: string | null
          sync_direction: string
          sync_status: string
          synced_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          marketplace_connection_id: string
          odoo_move_id?: string | null
          sync_direction?: string
          sync_status?: string
          synced_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          marketplace_connection_id?: string
          odoo_move_id?: string | null
          sync_direction?: string
          sync_status?: string
          synced_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odoo_invoice_sync_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odoo_invoice_sync_log_marketplace_connection_id_fkey"
            columns: ["marketplace_connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odoo_invoice_sync_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      odoo_journal_mappings: {
        Row: {
          created_at: string
          id: string
          invoice_type: string
          is_active: boolean
          marketplace_connection_id: string
          odoo_journal_id: string
          odoo_journal_name: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_type: string
          is_active?: boolean
          marketplace_connection_id: string
          odoo_journal_id: string
          odoo_journal_name?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_type?: string
          is_active?: boolean
          marketplace_connection_id?: string
          odoo_journal_id?: string
          odoo_journal_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odoo_journal_mappings_marketplace_connection_id_fkey"
            columns: ["marketplace_connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odoo_journal_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      odoo_tax_mappings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          marketplace_connection_id: string
          odoo_tax_id: string
          odoo_tax_name: string | null
          sellqo_vat_percentage: number | null
          sellqo_vat_rate_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          marketplace_connection_id: string
          odoo_tax_id: string
          odoo_tax_name?: string | null
          sellqo_vat_percentage?: number | null
          sellqo_vat_rate_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          marketplace_connection_id?: string
          odoo_tax_id?: string
          odoo_tax_name?: string | null
          sellqo_vat_percentage?: number | null
          sellqo_vat_rate_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odoo_tax_mappings_marketplace_connection_id_fkey"
            columns: ["marketplace_connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odoo_tax_mappings_sellqo_vat_rate_id_fkey"
            columns: ["sellqo_vat_rate_id"]
            isOneToOne: false
            referencedRelation: "vat_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odoo_tax_mappings_tenant_id_fkey"
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
          gift_card_id: string | null
          id: string
          marketplace_order_item_id: string | null
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
          gift_card_id?: string | null
          id?: string
          marketplace_order_item_id?: string | null
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
          gift_card_id?: string | null
          id?: string
          marketplace_order_item_id?: string | null
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
            foreignKeyName: "order_items_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
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
          applied_gift_card_ids: string[] | null
          billing_address: Json | null
          cancelled_at: string | null
          carrier: string | null
          created_at: string | null
          customer_company_name: string | null
          customer_email: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_type: string | null
          customer_vat_number: string | null
          customer_vat_verified: boolean | null
          delivered_at: string | null
          delivery_type: string | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          external_reference: string | null
          fulfillment_status: string | null
          gift_card_amount: number | null
          gift_card_ids: string[] | null
          id: string
          internal_notes: string | null
          last_tracking_check: string | null
          marketplace_connection_id: string | null
          marketplace_order_id: string | null
          marketplace_source: string | null
          notes: string | null
          ogm_reference: string | null
          order_number: string
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          raw_marketplace_data: Json | null
          service_point_data: Json | null
          service_point_id: string | null
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
          tracking_status: string | null
          tracking_url: string | null
          transaction_fee_charged: number | null
          updated_at: string | null
          vat_country: string | null
          vat_rate: number | null
          vat_text: string | null
          vat_type: string | null
        }
        Insert: {
          applied_gift_card_ids?: string[] | null
          billing_address?: Json | null
          cancelled_at?: string | null
          carrier?: string | null
          created_at?: string | null
          customer_company_name?: string | null
          customer_email: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_type?: string | null
          customer_vat_number?: string | null
          customer_vat_verified?: boolean | null
          delivered_at?: string | null
          delivery_type?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          external_reference?: string | null
          fulfillment_status?: string | null
          gift_card_amount?: number | null
          gift_card_ids?: string[] | null
          id?: string
          internal_notes?: string | null
          last_tracking_check?: string | null
          marketplace_connection_id?: string | null
          marketplace_order_id?: string | null
          marketplace_source?: string | null
          notes?: string | null
          ogm_reference?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          raw_marketplace_data?: Json | null
          service_point_data?: Json | null
          service_point_id?: string | null
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
          tracking_status?: string | null
          tracking_url?: string | null
          transaction_fee_charged?: number | null
          updated_at?: string | null
          vat_country?: string | null
          vat_rate?: number | null
          vat_text?: string | null
          vat_type?: string | null
        }
        Update: {
          applied_gift_card_ids?: string[] | null
          billing_address?: Json | null
          cancelled_at?: string | null
          carrier?: string | null
          created_at?: string | null
          customer_company_name?: string | null
          customer_email?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_type?: string | null
          customer_vat_number?: string | null
          customer_vat_verified?: boolean | null
          delivered_at?: string | null
          delivery_type?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          external_reference?: string | null
          fulfillment_status?: string | null
          gift_card_amount?: number | null
          gift_card_ids?: string[] | null
          id?: string
          internal_notes?: string | null
          last_tracking_check?: string | null
          marketplace_connection_id?: string | null
          marketplace_order_id?: string | null
          marketplace_source?: string | null
          notes?: string | null
          ogm_reference?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          raw_marketplace_data?: Json | null
          service_point_data?: Json | null
          service_point_id?: string | null
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
          tracking_status?: string | null
          tracking_url?: string | null
          transaction_fee_charged?: number | null
          updated_at?: string | null
          vat_country?: string | null
          vat_rate?: number | null
          vat_text?: string | null
          vat_type?: string | null
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
            foreignKeyName: "orders_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
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
            foreignKeyName: "packing_slips_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
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
      platform_coupon_redemptions: {
        Row: {
          applied_by: string | null
          coupon_id: string | null
          discount_applied: number | null
          id: string
          redeemed_at: string | null
          subscription_id: string | null
          tenant_id: string | null
        }
        Insert: {
          applied_by?: string | null
          coupon_id?: string | null
          discount_applied?: number | null
          id?: string
          redeemed_at?: string | null
          subscription_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          applied_by?: string | null
          coupon_id?: string | null
          discount_applied?: number | null
          id?: string
          redeemed_at?: string | null
          subscription_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "platform_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_coupon_redemptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_coupon_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_coupons: {
        Row: {
          applicable_plan_ids: string[] | null
          applies_to: string | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          max_uses_per_tenant: number | null
          min_subscription_months: number | null
          name: string
          stripe_coupon_id: string | null
          updated_at: string | null
          used_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_plan_ids?: string[] | null
          applies_to?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_tenant?: number | null
          min_subscription_months?: number | null
          name: string
          stripe_coupon_id?: string | null
          updated_at?: string | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_plan_ids?: string[] | null
          applies_to?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_tenant?: number | null
          min_subscription_months?: number | null
          name?: string
          stripe_coupon_id?: string | null
          updated_at?: string | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
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
      platform_quick_actions: {
        Row: {
          action_config: Json
          action_type: string
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          requires_confirmation: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          action_config?: Json
          action_type: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_confirmation?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_confirmation?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pos_cash_movements: {
        Row: {
          amount: number
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          reason: string
          session_id: string
          tenant_id: string
          terminal_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          reason: string
          session_id: string
          tenant_id: string
          terminal_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          reason?: string
          session_id?: string
          tenant_id?: string
          terminal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_movements_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_offline_queue: {
        Row: {
          created_at: string
          created_offline_at: string
          id: string
          sync_attempts: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          tenant_id: string
          terminal_id: string
          transaction_data: Json
        }
        Insert: {
          created_at?: string
          created_offline_at: string
          id?: string
          sync_attempts?: number
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          tenant_id: string
          terminal_id: string
          transaction_data: Json
        }
        Update: {
          created_at?: string
          created_offline_at?: string
          id?: string
          sync_attempts?: number
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          tenant_id?: string
          terminal_id?: string
          transaction_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pos_offline_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_offline_queue_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_parked_carts: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          items: Json
          notes: string | null
          parked_at: string
          parked_by: string
          resumed_at: string | null
          resumed_by: string | null
          session_id: string | null
          status: string
          tenant_id: string
          terminal_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          parked_at?: string
          parked_by: string
          resumed_at?: string | null
          resumed_by?: string | null
          session_id?: string | null
          status?: string
          tenant_id: string
          terminal_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          parked_at?: string
          parked_by?: string
          resumed_at?: string | null
          resumed_by?: string | null
          session_id?: string | null
          status?: string
          tenant_id?: string
          terminal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_parked_carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_parked_carts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_parked_carts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_parked_carts_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_quick_buttons: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          position: number
          product_id: string
          tenant_id: string
          terminal_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          position?: number
          product_id: string
          tenant_id: string
          terminal_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          product_id?: string
          tenant_id?: string
          terminal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_quick_buttons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_quick_buttons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_quick_buttons_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sessions: {
        Row: {
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_cash: number | null
          created_at: string
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_cash: number
          status: string
          tenant_id: string
          terminal_id: string
          updated_at: string
        }
        Insert: {
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_cash?: number
          status?: string
          tenant_id: string
          terminal_id: string
          updated_at?: string
        }
        Update: {
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_cash?: number
          status?: string
          tenant_id?: string
          terminal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_terminals: {
        Row: {
          capabilities: Json | null
          created_at: string
          device_id: string | null
          id: string
          last_seen_at: string | null
          location_name: string | null
          name: string
          settings: Json | null
          status: string
          stripe_location_id: string | null
          stripe_reader_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string
          device_id?: string | null
          id?: string
          last_seen_at?: string | null
          location_name?: string | null
          name: string
          settings?: Json | null
          status?: string
          stripe_location_id?: string | null
          stripe_reader_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json | null
          created_at?: string
          device_id?: string | null
          id?: string
          last_seen_at?: string | null
          location_name?: string | null
          name?: string
          settings?: Json | null
          status?: string
          stripe_location_id?: string | null
          stripe_reader_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_terminals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          card_brand: string | null
          card_last4: string | null
          cash_change: number | null
          cash_received: number | null
          cashier_id: string
          created_at: string
          customer_id: string | null
          discount_total: number
          id: string
          items: Json
          order_id: string | null
          payments: Json
          receipt_number: string | null
          receipt_printed_at: string | null
          refunded_at: string | null
          refunded_by: string | null
          session_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_reader_id: string | null
          stripe_refund_id: string | null
          subtotal: number
          tax_total: number
          tenant_id: string
          terminal_id: string
          total: number
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          card_brand?: string | null
          card_last4?: string | null
          cash_change?: number | null
          cash_received?: number | null
          cashier_id: string
          created_at?: string
          customer_id?: string | null
          discount_total?: number
          id?: string
          items?: Json
          order_id?: string | null
          payments?: Json
          receipt_number?: string | null
          receipt_printed_at?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          session_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_reader_id?: string | null
          stripe_refund_id?: string | null
          subtotal?: number
          tax_total?: number
          tenant_id: string
          terminal_id: string
          total?: number
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          card_brand?: string | null
          card_last4?: string | null
          cash_change?: number | null
          cash_received?: number | null
          cashier_id?: string
          created_at?: string
          customer_id?: string | null
          discount_total?: number
          id?: string
          items?: Json
          order_id?: string | null
          payments?: Json
          receipt_number?: string | null
          receipt_printed_at?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          session_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_reader_id?: string | null
          stripe_refund_id?: string | null
          subtotal?: number
          tax_total?: number
          tenant_id?: string
          terminal_id?: string
          total?: number
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
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
          included_transactions_monthly: number | null
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
          transaction_overage_fee: number | null
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
          included_transactions_monthly?: number | null
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
          transaction_overage_fee?: number | null
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
          included_transactions_monthly?: number | null
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
          transaction_overage_fee?: number | null
          updated_at?: string | null
          yearly_price?: number
        }
        Relationships: []
      }
      product_bundles: {
        Row: {
          bundle_type: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          image_url: string | null
          is_active: boolean
          max_items: number | null
          min_items: number | null
          name: string
          slug: string
          tenant_id: string
          updated_at: string
          usage_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          bundle_type?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_items?: number | null
          min_items?: number | null
          name: string
          slug: string
          tenant_id: string
          updated_at?: string
          usage_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          bundle_type?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_items?: number | null
          min_items?: number | null
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
          usage_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_bundles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_preview: boolean | null
          product_id: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_preview?: boolean | null
          product_id: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_preview?: boolean | null
          product_id?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          is_primary: boolean | null
          lead_time_days: number | null
          minimum_order_quantity: number | null
          notes: string | null
          product_id: string
          purchase_price: number
          supplier_id: string
          supplier_sku: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          is_primary?: boolean | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          notes?: string | null
          product_id: string
          purchase_price: number
          supplier_id: string
          supplier_sku?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          is_primary?: boolean | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          notes?: string | null
          product_id?: string
          purchase_price?: number
          supplier_id?: string
          supplier_sku?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          access_duration_days: number | null
          allow_backorder: boolean | null
          amazon_asin: string | null
          amazon_bullets: string[] | null
          amazon_last_synced_at: string | null
          amazon_listing_error: string | null
          amazon_listing_status: string | null
          amazon_offer_id: string | null
          amazon_optimized_description: string | null
          amazon_optimized_title: string | null
          barcode: string | null
          bol_bullets: string[] | null
          bol_condition: string | null
          bol_delivery_code: string | null
          bol_ean: string | null
          bol_fulfilment_method: string | null
          bol_last_synced_at: string | null
          bol_listing_error: string | null
          bol_listing_status: string | null
          bol_offer_id: string | null
          bol_optimized_description: string | null
          bol_optimized_title: string | null
          category_id: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          digital_delivery_type:
            | Database["public"]["Enums"]["digital_delivery_type"]
            | null
          download_expiry_hours: number | null
          download_limit: number | null
          external_id: string | null
          featured_image: string | null
          file_size_bytes: number | null
          gift_card_allow_custom: boolean | null
          gift_card_denominations: number[] | null
          gift_card_design_id: string | null
          gift_card_expiry_months: number | null
          gift_card_max_amount: number | null
          gift_card_min_amount: number | null
          hide_from_storefront: boolean | null
          id: string
          images: string[] | null
          import_job_id: string | null
          imported_at: string | null
          is_active: boolean | null
          is_featured: boolean | null
          last_inventory_sync: string | null
          license_generator: string | null
          low_stock_threshold: number | null
          marketplace_mappings: Json | null
          meta_description: string | null
          meta_title: string | null
          name: string
          odoo_last_synced_at: string | null
          odoo_listing_error: string | null
          odoo_listing_status: string | null
          odoo_optimized_description: string | null
          odoo_optimized_title: string | null
          odoo_product_id: string | null
          odoo_variant_id: string | null
          original_category_value: string | null
          price: number
          product_type: Database["public"]["Enums"]["product_type"] | null
          requires_shipping: boolean | null
          shopify_last_synced_at: string | null
          shopify_listing_error: string | null
          shopify_listing_status: string | null
          shopify_optimized_description: string | null
          shopify_optimized_title: string | null
          shopify_product_id: string | null
          shopify_variant_id: string | null
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
          woocommerce_last_synced_at: string | null
          woocommerce_listing_error: string | null
          woocommerce_listing_status: string | null
          woocommerce_optimized_description: string | null
          woocommerce_optimized_title: string | null
          woocommerce_product_id: string | null
          woocommerce_variant_id: string | null
        }
        Insert: {
          access_duration_days?: number | null
          allow_backorder?: boolean | null
          amazon_asin?: string | null
          amazon_bullets?: string[] | null
          amazon_last_synced_at?: string | null
          amazon_listing_error?: string | null
          amazon_listing_status?: string | null
          amazon_offer_id?: string | null
          amazon_optimized_description?: string | null
          amazon_optimized_title?: string | null
          barcode?: string | null
          bol_bullets?: string[] | null
          bol_condition?: string | null
          bol_delivery_code?: string | null
          bol_ean?: string | null
          bol_fulfilment_method?: string | null
          bol_last_synced_at?: string | null
          bol_listing_error?: string | null
          bol_listing_status?: string | null
          bol_offer_id?: string | null
          bol_optimized_description?: string | null
          bol_optimized_title?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          digital_delivery_type?:
            | Database["public"]["Enums"]["digital_delivery_type"]
            | null
          download_expiry_hours?: number | null
          download_limit?: number | null
          external_id?: string | null
          featured_image?: string | null
          file_size_bytes?: number | null
          gift_card_allow_custom?: boolean | null
          gift_card_denominations?: number[] | null
          gift_card_design_id?: string | null
          gift_card_expiry_months?: number | null
          gift_card_max_amount?: number | null
          gift_card_min_amount?: number | null
          hide_from_storefront?: boolean | null
          id?: string
          images?: string[] | null
          import_job_id?: string | null
          imported_at?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          last_inventory_sync?: string | null
          license_generator?: string | null
          low_stock_threshold?: number | null
          marketplace_mappings?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          odoo_last_synced_at?: string | null
          odoo_listing_error?: string | null
          odoo_listing_status?: string | null
          odoo_optimized_description?: string | null
          odoo_optimized_title?: string | null
          odoo_product_id?: string | null
          odoo_variant_id?: string | null
          original_category_value?: string | null
          price: number
          product_type?: Database["public"]["Enums"]["product_type"] | null
          requires_shipping?: boolean | null
          shopify_last_synced_at?: string | null
          shopify_listing_error?: string | null
          shopify_listing_status?: string | null
          shopify_optimized_description?: string | null
          shopify_optimized_title?: string | null
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
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
          woocommerce_last_synced_at?: string | null
          woocommerce_listing_error?: string | null
          woocommerce_listing_status?: string | null
          woocommerce_optimized_description?: string | null
          woocommerce_optimized_title?: string | null
          woocommerce_product_id?: string | null
          woocommerce_variant_id?: string | null
        }
        Update: {
          access_duration_days?: number | null
          allow_backorder?: boolean | null
          amazon_asin?: string | null
          amazon_bullets?: string[] | null
          amazon_last_synced_at?: string | null
          amazon_listing_error?: string | null
          amazon_listing_status?: string | null
          amazon_offer_id?: string | null
          amazon_optimized_description?: string | null
          amazon_optimized_title?: string | null
          barcode?: string | null
          bol_bullets?: string[] | null
          bol_condition?: string | null
          bol_delivery_code?: string | null
          bol_ean?: string | null
          bol_fulfilment_method?: string | null
          bol_last_synced_at?: string | null
          bol_listing_error?: string | null
          bol_listing_status?: string | null
          bol_offer_id?: string | null
          bol_optimized_description?: string | null
          bol_optimized_title?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          digital_delivery_type?:
            | Database["public"]["Enums"]["digital_delivery_type"]
            | null
          download_expiry_hours?: number | null
          download_limit?: number | null
          external_id?: string | null
          featured_image?: string | null
          file_size_bytes?: number | null
          gift_card_allow_custom?: boolean | null
          gift_card_denominations?: number[] | null
          gift_card_design_id?: string | null
          gift_card_expiry_months?: number | null
          gift_card_max_amount?: number | null
          gift_card_min_amount?: number | null
          hide_from_storefront?: boolean | null
          id?: string
          images?: string[] | null
          import_job_id?: string | null
          imported_at?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          last_inventory_sync?: string | null
          license_generator?: string | null
          low_stock_threshold?: number | null
          marketplace_mappings?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          odoo_last_synced_at?: string | null
          odoo_listing_error?: string | null
          odoo_listing_status?: string | null
          odoo_optimized_description?: string | null
          odoo_optimized_title?: string | null
          odoo_product_id?: string | null
          odoo_variant_id?: string | null
          original_category_value?: string | null
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"] | null
          requires_shipping?: boolean | null
          shopify_last_synced_at?: string | null
          shopify_listing_error?: string | null
          shopify_listing_status?: string | null
          shopify_optimized_description?: string | null
          shopify_optimized_title?: string | null
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
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
          woocommerce_last_synced_at?: string | null
          woocommerce_listing_error?: string | null
          woocommerce_listing_status?: string | null
          woocommerce_optimized_description?: string | null
          woocommerce_optimized_title?: string | null
          woocommerce_product_id?: string | null
          woocommerce_variant_id?: string | null
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
            foreignKeyName: "products_gift_card_design_id_fkey"
            columns: ["gift_card_design_id"]
            isOneToOne: false
            referencedRelation: "gift_card_designs"
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
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          notes: string | null
          product_id: string | null
          product_name: string
          product_supplier_id: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number | null
          supplier_sku: string | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          notes?: string | null
          product_id?: string | null
          product_name: string
          product_supplier_id?: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number | null
          supplier_sku?: string | null
          tax_rate?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          notes?: string | null
          product_id?: string | null
          product_name?: string
          product_supplier_id?: string | null
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number | null
          supplier_sku?: string | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_supplier_id_fkey"
            columns: ["product_supplier_id"]
            isOneToOne: false
            referencedRelation: "product_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          expected_delivery_date: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          order_date: string | null
          order_number: string
          received_at: string | null
          sent_at: string | null
          shipped_at: string | null
          shipping_cost: number | null
          status: Database["public"]["Enums"]["purchase_order_status"] | null
          subtotal: number | null
          supplier_id: string
          tax_amount: number | null
          tenant_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_delivery_date?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_date?: string | null
          order_number: string
          received_at?: string | null
          sent_at?: string | null
          shipped_at?: string | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["purchase_order_status"] | null
          subtotal?: number | null
          supplier_id: string
          tax_amount?: number | null
          tenant_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_delivery_date?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_date?: string | null
          order_number?: string
          received_at?: string | null
          sent_at?: string | null
          shipped_at?: string | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["purchase_order_status"] | null
          subtotal?: number | null
          supplier_id?: string
          tax_amount?: number | null
          tenant_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
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
            foreignKeyName: "quotes_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
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
      review_platform_connections: {
        Row: {
          api_key: string | null
          api_secret: string | null
          cached_rating: number | null
          cached_review_count: number | null
          created_at: string | null
          display_name: string | null
          external_id: string | null
          external_url: string | null
          id: string
          is_enabled: boolean | null
          last_synced_at: string | null
          platform: string
          settings: Json | null
          sync_error: string | null
          sync_frequency: string | null
          sync_status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          cached_rating?: number | null
          cached_review_count?: number | null
          created_at?: string | null
          display_name?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_enabled?: boolean | null
          last_synced_at?: string | null
          platform: string
          settings?: Json | null
          sync_error?: string | null
          sync_frequency?: string | null
          sync_status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          cached_rating?: number | null
          cached_review_count?: number | null
          created_at?: string | null
          display_name?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_enabled?: boolean | null
          last_synced_at?: string | null
          platform?: string
          settings?: Json | null
          sync_error?: string | null
          sync_frequency?: string | null
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_platform_connections_tenant_id_fkey"
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
      seo_analysis_history: {
        Row: {
          analyzed_at: string | null
          id: string
          overall_score: number | null
          score_id: string | null
          tenant_id: string
        }
        Insert: {
          analyzed_at?: string | null
          id?: string
          overall_score?: number | null
          score_id?: string | null
          tenant_id: string
        }
        Update: {
          analyzed_at?: string | null
          id?: string
          overall_score?: number | null
          score_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_analysis_history_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "seo_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_analysis_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audit_results: {
        Row: {
          audit_type: string
          completed_at: string | null
          created_at: string
          id: string
          issues_fixed: number | null
          issues_found: number | null
          overall_score: number | null
          results: Json | null
          scheduled_audit_id: string | null
          started_at: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          audit_type: string
          completed_at?: string | null
          created_at?: string
          id?: string
          issues_fixed?: number | null
          issues_found?: number | null
          overall_score?: number | null
          results?: Json | null
          scheduled_audit_id?: string | null
          started_at?: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          audit_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          issues_fixed?: number | null
          issues_found?: number | null
          overall_score?: number | null
          results?: Json | null
          scheduled_audit_id?: string | null
          started_at?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_audit_results_scheduled_audit_id_fkey"
            columns: ["scheduled_audit_id"]
            isOneToOne: false
            referencedRelation: "seo_scheduled_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_audit_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_competitor_keywords: {
        Row: {
          competitor_id: string | null
          competitor_position: number | null
          created_at: string
          difficulty_score: number | null
          id: string
          keyword: string
          our_position: number | null
          search_volume: number | null
          tenant_id: string
          tracked_at: string
        }
        Insert: {
          competitor_id?: string | null
          competitor_position?: number | null
          created_at?: string
          difficulty_score?: number | null
          id?: string
          keyword: string
          our_position?: number | null
          search_volume?: number | null
          tenant_id: string
          tracked_at?: string
        }
        Update: {
          competitor_id?: string | null
          competitor_position?: number | null
          created_at?: string
          difficulty_score?: number | null
          id?: string
          keyword?: string
          our_position?: number | null
          search_volume?: number | null
          tenant_id?: string
          tracked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_competitor_keywords_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "seo_competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_competitor_keywords_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_competitors: {
        Row: {
          created_at: string
          domain: string
          id: string
          keywords: string[] | null
          name: string
          tenant_id: string
          tracked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          keywords?: string[] | null
          name: string
          tenant_id: string
          tracked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          keywords?: string[] | null
          name?: string
          tenant_id?: string
          tracked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_competitors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keywords: {
        Row: {
          category_id: string | null
          created_at: string | null
          difficulty_estimate: string | null
          id: string
          intent: string | null
          is_primary: boolean | null
          keyword: string
          language: string
          position_tracking: Json | null
          product_id: string | null
          search_volume_estimate: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          difficulty_estimate?: string | null
          id?: string
          intent?: string | null
          is_primary?: boolean | null
          keyword: string
          language?: string
          position_tracking?: Json | null
          product_id?: string | null
          search_volume_estimate?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          difficulty_estimate?: string | null
          id?: string
          intent?: string | null
          is_primary?: boolean | null
          keyword?: string
          language?: string
          position_tracking?: Json | null
          product_id?: string | null
          search_volume_estimate?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_keywords_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_keywords_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_keywords_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_scheduled_audits: {
        Row: {
          audit_type: string
          created_at: string
          frequency: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          next_run_at: string
          notify_email: string | null
          notify_on_issues: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          audit_type?: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string
          notify_email?: string | null
          notify_on_issues?: boolean | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string
          notify_email?: string | null
          notify_on_issues?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_scheduled_audits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_scores: {
        Row: {
          ai_search_score: number | null
          content_score: number | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          issues: Json | null
          last_analyzed_at: string | null
          meta_score: number | null
          overall_score: number | null
          suggestions: Json | null
          technical_score: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ai_search_score?: number | null
          content_score?: number | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          issues?: Json | null
          last_analyzed_at?: string | null
          meta_score?: number | null
          overall_score?: number | null
          suggestions?: Json | null
          technical_score?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ai_search_score?: number | null
          content_score?: number | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          issues?: Json | null
          last_analyzed_at?: string | null
          meta_score?: number | null
          overall_score?: number | null
          suggestions?: Json | null
          technical_score?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_search_console_data: {
        Row: {
          clicks: number | null
          country: string | null
          created_at: string
          ctr: number | null
          date: string
          device: string | null
          id: string
          impressions: number | null
          page: string | null
          position: number | null
          query: string
          tenant_id: string
        }
        Insert: {
          clicks?: number | null
          country?: string | null
          created_at?: string
          ctr?: number | null
          date: string
          device?: string | null
          id?: string
          impressions?: number | null
          page?: string | null
          position?: number | null
          query: string
          tenant_id: string
        }
        Update: {
          clicks?: number | null
          country?: string | null
          created_at?: string
          ctr?: number | null
          date?: string
          device?: string | null
          id?: string
          impressions?: number | null
          page?: string | null
          position?: number | null
          query?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_search_console_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_web_vitals: {
        Row: {
          cls_value: number | null
          created_at: string
          device_type: string | null
          fid_value: number | null
          id: string
          inp_value: number | null
          lcp_value: number | null
          measured_at: string
          performance_score: number | null
          tenant_id: string
          ttfb_value: number | null
          url: string
        }
        Insert: {
          cls_value?: number | null
          created_at?: string
          device_type?: string | null
          fid_value?: number | null
          id?: string
          inp_value?: number | null
          lcp_value?: number | null
          measured_at?: string
          performance_score?: number | null
          tenant_id: string
          ttfb_value?: number | null
          url: string
        }
        Update: {
          cls_value?: number | null
          created_at?: string
          device_type?: string | null
          fid_value?: number | null
          id?: string
          inp_value?: number | null
          lcp_value?: number | null
          measured_at?: string
          performance_score?: number | null
          tenant_id?: string
          ttfb_value?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_web_vitals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_integrations: {
        Row: {
          api_key: string | null
          api_secret: string | null
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean
          is_default: boolean
          last_sync_at: string | null
          provider: string
          settings: Json | null
          tenant_id: string
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_sync_at?: string | null
          provider: string
          settings?: Json | null
          tenant_id: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_sync_at?: string | null
          provider?: string
          settings?: Json | null
          tenant_id?: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_labels: {
        Row: {
          carrier: string | null
          created_at: string | null
          dimensions: Json | null
          error_message: string | null
          external_id: string | null
          external_parcel_id: string | null
          id: string
          integration_id: string | null
          label_format: string | null
          label_url: string | null
          metadata: Json | null
          order_id: string
          provider: string
          service_type: string | null
          shipping_cost: number | null
          status: string
          tenant_id: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          dimensions?: Json | null
          error_message?: string | null
          external_id?: string | null
          external_parcel_id?: string | null
          id?: string
          integration_id?: string | null
          label_format?: string | null
          label_url?: string | null
          metadata?: Json | null
          order_id: string
          provider: string
          service_type?: string | null
          shipping_cost?: number | null
          status?: string
          tenant_id: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          dimensions?: Json | null
          error_message?: string | null
          external_id?: string | null
          external_parcel_id?: string | null
          id?: string
          integration_id?: string | null
          label_format?: string | null
          label_url?: string | null
          metadata?: Json | null
          order_id?: string
          provider?: string
          service_type?: string | null
          shipping_cost?: number | null
          status?: string
          tenant_id?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_labels_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "shipping_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_tenant_id_fkey"
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
      shipping_status_updates: {
        Row: {
          carrier_status: string | null
          created_at: string | null
          event_timestamp: string | null
          external_event_id: string | null
          id: string
          label_id: string | null
          location: string | null
          order_id: string | null
          provider: string
          raw_payload: Json | null
          status: string
          status_message: string | null
          tenant_id: string
        }
        Insert: {
          carrier_status?: string | null
          created_at?: string | null
          event_timestamp?: string | null
          external_event_id?: string | null
          id?: string
          label_id?: string | null
          location?: string | null
          order_id?: string | null
          provider: string
          raw_payload?: Json | null
          status: string
          status_message?: string | null
          tenant_id: string
        }
        Update: {
          carrier_status?: string | null
          created_at?: string | null
          event_timestamp?: string | null
          external_event_id?: string | null
          id?: string
          label_id?: string | null
          location?: string | null
          order_id?: string | null
          provider?: string
          raw_payload?: Json | null
          status?: string
          status_message?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_status_updates_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "shipping_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_status_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_status_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_status_updates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sidebar_preferences: {
        Row: {
          created_at: string | null
          hidden_items: string[] | null
          id: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          hidden_items?: string[] | null
          id?: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          hidden_items?: string[] | null
          id?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidebar_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_token: string
          account_avatar: string | null
          account_id: string | null
          account_name: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          platform: string
          refresh_token: string | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          account_avatar?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          platform: string
          refresh_token?: string | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          account_avatar?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          platform?: string
          refresh_token?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          connection_id: string | null
          content_id: string | null
          created_at: string | null
          engagement_data: Json | null
          error_message: string | null
          id: string
          image_urls: string[] | null
          platform: string
          platform_post_id: string | null
          post_text: string
          posted_at: string | null
          scheduled_for: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          connection_id?: string | null
          content_id?: string | null
          created_at?: string | null
          engagement_data?: Json | null
          error_message?: string | null
          id?: string
          image_urls?: string[] | null
          platform: string
          platform_post_id?: string | null
          post_text: string
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          connection_id?: string | null
          content_id?: string | null
          created_at?: string | null
          engagement_data?: Json | null
          error_message?: string | null
          id?: string
          image_urls?: string[] | null
          platform?: string
          platform_post_id?: string | null
          post_text?: string
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ai_content_engagement_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_pages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_published: boolean | null
          meta_description: string | null
          meta_title: string | null
          nav_order: number | null
          show_in_nav: boolean | null
          slug: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          nav_order?: number | null
          show_in_nav?: boolean | null
          slug: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          nav_order?: number | null
          show_in_nav?: boolean | null
          slug?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      supplier_documents: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          document_date: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["supplier_document_type"]
          due_date: string | null
          extracted_data: Json | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_status:
            | Database["public"]["Enums"]["supplier_payment_status"]
            | null
          purchase_order_id: string | null
          storage_path: string | null
          supplier_id: string
          tax_amount: number | null
          tenant_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          document_date?: string | null
          document_number?: string | null
          document_type: Database["public"]["Enums"]["supplier_document_type"]
          due_date?: string | null
          extracted_data?: Json | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?:
            | Database["public"]["Enums"]["supplier_payment_status"]
            | null
          purchase_order_id?: string | null
          storage_path?: string | null
          supplier_id: string
          tax_amount?: number | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          document_date?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["supplier_document_type"]
          due_date?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?:
            | Database["public"]["Enums"]["supplier_payment_status"]
            | null
          purchase_order_id?: string | null
          storage_path?: string | null
          supplier_id?: string
          tax_amount?: number | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          bic: string | null
          chamber_of_commerce: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          iban: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms_days: number | null
          phone: string | null
          postal_code: string | null
          rating: number | null
          street: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          bic?: string | null
          chamber_of_commerce?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          street?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          bic?: string | null
          chamber_of_commerce?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          street?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_activity_log: {
        Row: {
          completed_at: string | null
          connection_id: string
          created_at: string | null
          data_type: string
          direction: string
          error_details: Json | null
          id: string
          records_failed: number | null
          records_processed: number | null
          started_at: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          created_at?: string | null
          data_type: string
          direction: string
          error_details?: Json | null
          id?: string
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          created_at?: string | null
          data_type?: string
          direction?: string
          error_details?: Json | null
          id?: string
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_activity_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_activity_log_tenant_id_fkey"
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
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_tenant_id_fkey"
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
          stripe_customer_id: string | null
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
          stripe_customer_id?: string | null
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
          stripe_customer_id?: string | null
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
      tenant_feature_overrides: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          extended_trial_until: string | null
          id: string
          limit_api_calls_override: number | null
          limit_customers_override: number | null
          limit_orders_override: number | null
          limit_products_override: number | null
          limit_storage_gb_override: number | null
          limit_users_override: number | null
          module_advanced_analytics: boolean | null
          module_ai_marketing: boolean | null
          module_api_access: boolean | null
          module_facturx: boolean | null
          module_multi_currency: boolean | null
          module_peppol: boolean | null
          module_webhooks: boolean | null
          module_white_label: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          extended_trial_until?: string | null
          id?: string
          limit_api_calls_override?: number | null
          limit_customers_override?: number | null
          limit_orders_override?: number | null
          limit_products_override?: number | null
          limit_storage_gb_override?: number | null
          limit_users_override?: number | null
          module_advanced_analytics?: boolean | null
          module_ai_marketing?: boolean | null
          module_api_access?: boolean | null
          module_facturx?: boolean | null
          module_multi_currency?: boolean | null
          module_peppol?: boolean | null
          module_webhooks?: boolean | null
          module_white_label?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          extended_trial_until?: string | null
          id?: string
          limit_api_calls_override?: number | null
          limit_customers_override?: number | null
          limit_orders_override?: number | null
          limit_products_override?: number | null
          limit_storage_gb_override?: number | null
          limit_users_override?: number | null
          module_advanced_analytics?: boolean | null
          module_ai_marketing?: boolean | null
          module_api_access?: boolean | null
          module_facturx?: boolean | null
          module_multi_currency?: boolean | null
          module_peppol?: boolean | null
          module_webhooks?: boolean | null
          module_white_label?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_loyalty_rewards: {
        Row: {
          applied: boolean | null
          applied_at: string | null
          applied_by: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          name: string
          reward_type: string
          tenant_id: string | null
          value: Json
        }
        Insert: {
          applied?: boolean | null
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          name: string
          reward_type: string
          tenant_id?: string | null
          value: Json
        }
        Update: {
          applied?: boolean | null
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          name?: string
          reward_type?: string
          tenant_id?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tenant_loyalty_rewards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_newsletter_config: {
        Row: {
          created_at: string | null
          double_optin: boolean | null
          id: string
          klaviyo_api_key: string | null
          klaviyo_list_id: string | null
          mailchimp_api_key: string | null
          mailchimp_audience_id: string | null
          mailchimp_server_prefix: string | null
          provider: string
          tenant_id: string
          updated_at: string | null
          welcome_email_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          double_optin?: boolean | null
          id?: string
          klaviyo_api_key?: string | null
          klaviyo_list_id?: string | null
          mailchimp_api_key?: string | null
          mailchimp_audience_id?: string | null
          mailchimp_server_prefix?: string | null
          provider?: string
          tenant_id: string
          updated_at?: string | null
          welcome_email_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          double_optin?: boolean | null
          id?: string
          klaviyo_api_key?: string | null
          klaviyo_list_id?: string | null
          mailchimp_api_key?: string | null
          mailchimp_audience_id?: string | null
          mailchimp_server_prefix?: string | null
          provider?: string
          tenant_id?: string
          updated_at?: string | null
          welcome_email_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_newsletter_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_notification_settings: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          email_enabled: boolean | null
          email_recipients: string[] | null
          id: string
          in_app_enabled: boolean | null
          notification_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          email_enabled?: boolean | null
          email_recipients?: string[] | null
          id?: string
          in_app_enabled?: boolean | null
          notification_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          email_enabled?: boolean | null
          email_recipients?: string[] | null
          id?: string
          in_app_enabled?: boolean | null
          notification_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notification_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
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
      tenant_theme_settings: {
        Row: {
          accent_color: string | null
          announcement_link: string | null
          announcement_text: string | null
          background_color: string | null
          body_font: string | null
          checkout_address_autocomplete: boolean | null
          checkout_company_field: string | null
          checkout_guest_enabled: boolean | null
          checkout_phone_required: boolean | null
          cookie_banner_enabled: boolean | null
          cookie_banner_style: string | null
          created_at: string | null
          custom_css: string | null
          custom_frontend_url: string | null
          custom_head_scripts: string | null
          exit_intent_popup: boolean | null
          favicon_url: string | null
          footer_text: string | null
          header_sticky: boolean | null
          header_style: string | null
          heading_font: string | null
          id: string
          is_published: boolean | null
          logo_url: string | null
          mobile_bottom_nav: boolean | null
          nav_style: string | null
          newsletter_enabled: boolean | null
          newsletter_incentive_text: string | null
          newsletter_popup_delay_seconds: number | null
          newsletter_popup_enabled: boolean | null
          newsletter_provider: string | null
          primary_color: string | null
          product_card_style: string | null
          product_image_zoom: string | null
          product_related_mode: string | null
          product_reviews_display: string | null
          product_stock_indicator: boolean | null
          product_variant_style: string | null
          products_per_row: number | null
          published_at: string | null
          reviews_aggregate_display: boolean | null
          reviews_auto_feature_threshold: number | null
          reviews_display_platforms: Json | null
          reviews_floating_style: string | null
          reviews_homepage_section: boolean | null
          reviews_hub_enabled: boolean | null
          reviews_min_rating_filter: number | null
          reviews_trust_bar_enabled: boolean | null
          reviews_widget_position: string | null
          search_display: string | null
          secondary_color: string | null
          show_announcement_bar: boolean | null
          show_breadcrumbs: boolean | null
          show_recent_purchases: boolean | null
          show_stock_count: boolean | null
          show_viewers_count: boolean | null
          show_wishlist: boolean | null
          social_links: Json | null
          storefront_default_language: string | null
          storefront_language_selector_style: string | null
          storefront_languages: Json | null
          storefront_multilingual_enabled: boolean | null
          tenant_id: string
          text_color: string | null
          theme_id: string | null
          trust_badges: Json | null
          updated_at: string | null
          use_custom_frontend: boolean | null
        }
        Insert: {
          accent_color?: string | null
          announcement_link?: string | null
          announcement_text?: string | null
          background_color?: string | null
          body_font?: string | null
          checkout_address_autocomplete?: boolean | null
          checkout_company_field?: string | null
          checkout_guest_enabled?: boolean | null
          checkout_phone_required?: boolean | null
          cookie_banner_enabled?: boolean | null
          cookie_banner_style?: string | null
          created_at?: string | null
          custom_css?: string | null
          custom_frontend_url?: string | null
          custom_head_scripts?: string | null
          exit_intent_popup?: boolean | null
          favicon_url?: string | null
          footer_text?: string | null
          header_sticky?: boolean | null
          header_style?: string | null
          heading_font?: string | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          mobile_bottom_nav?: boolean | null
          nav_style?: string | null
          newsletter_enabled?: boolean | null
          newsletter_incentive_text?: string | null
          newsletter_popup_delay_seconds?: number | null
          newsletter_popup_enabled?: boolean | null
          newsletter_provider?: string | null
          primary_color?: string | null
          product_card_style?: string | null
          product_image_zoom?: string | null
          product_related_mode?: string | null
          product_reviews_display?: string | null
          product_stock_indicator?: boolean | null
          product_variant_style?: string | null
          products_per_row?: number | null
          published_at?: string | null
          reviews_aggregate_display?: boolean | null
          reviews_auto_feature_threshold?: number | null
          reviews_display_platforms?: Json | null
          reviews_floating_style?: string | null
          reviews_homepage_section?: boolean | null
          reviews_hub_enabled?: boolean | null
          reviews_min_rating_filter?: number | null
          reviews_trust_bar_enabled?: boolean | null
          reviews_widget_position?: string | null
          search_display?: string | null
          secondary_color?: string | null
          show_announcement_bar?: boolean | null
          show_breadcrumbs?: boolean | null
          show_recent_purchases?: boolean | null
          show_stock_count?: boolean | null
          show_viewers_count?: boolean | null
          show_wishlist?: boolean | null
          social_links?: Json | null
          storefront_default_language?: string | null
          storefront_language_selector_style?: string | null
          storefront_languages?: Json | null
          storefront_multilingual_enabled?: boolean | null
          tenant_id: string
          text_color?: string | null
          theme_id?: string | null
          trust_badges?: Json | null
          updated_at?: string | null
          use_custom_frontend?: boolean | null
        }
        Update: {
          accent_color?: string | null
          announcement_link?: string | null
          announcement_text?: string | null
          background_color?: string | null
          body_font?: string | null
          checkout_address_autocomplete?: boolean | null
          checkout_company_field?: string | null
          checkout_guest_enabled?: boolean | null
          checkout_phone_required?: boolean | null
          cookie_banner_enabled?: boolean | null
          cookie_banner_style?: string | null
          created_at?: string | null
          custom_css?: string | null
          custom_frontend_url?: string | null
          custom_head_scripts?: string | null
          exit_intent_popup?: boolean | null
          favicon_url?: string | null
          footer_text?: string | null
          header_sticky?: boolean | null
          header_style?: string | null
          heading_font?: string | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          mobile_bottom_nav?: boolean | null
          nav_style?: string | null
          newsletter_enabled?: boolean | null
          newsletter_incentive_text?: string | null
          newsletter_popup_delay_seconds?: number | null
          newsletter_popup_enabled?: boolean | null
          newsletter_provider?: string | null
          primary_color?: string | null
          product_card_style?: string | null
          product_image_zoom?: string | null
          product_related_mode?: string | null
          product_reviews_display?: string | null
          product_stock_indicator?: boolean | null
          product_variant_style?: string | null
          products_per_row?: number | null
          published_at?: string | null
          reviews_aggregate_display?: boolean | null
          reviews_auto_feature_threshold?: number | null
          reviews_display_platforms?: Json | null
          reviews_floating_style?: string | null
          reviews_homepage_section?: boolean | null
          reviews_hub_enabled?: boolean | null
          reviews_min_rating_filter?: number | null
          reviews_trust_bar_enabled?: boolean | null
          reviews_widget_position?: string | null
          search_display?: string | null
          secondary_color?: string | null
          show_announcement_bar?: boolean | null
          show_breadcrumbs?: boolean | null
          show_recent_purchases?: boolean | null
          show_stock_count?: boolean | null
          show_viewers_count?: boolean | null
          show_wishlist?: boolean | null
          social_links?: Json | null
          storefront_default_language?: string | null
          storefront_language_selector_style?: string | null
          storefront_languages?: Json | null
          storefront_multilingual_enabled?: boolean | null
          tenant_id?: string
          text_color?: string | null
          theme_id?: string | null
          trust_badges?: Json | null
          updated_at?: string | null
          use_custom_frontend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_theme_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_theme_settings_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_tracking_settings: {
        Row: {
          api_key_17track: string | null
          auto_poll_17track: boolean | null
          created_at: string | null
          id: string
          notify_on_delivered: boolean | null
          notify_on_exception: boolean | null
          notify_on_out_for_delivery: boolean | null
          notify_on_shipped: boolean | null
          poll_interval_hours: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_key_17track?: string | null
          auto_poll_17track?: boolean | null
          created_at?: string | null
          id?: string
          notify_on_delivered?: boolean | null
          notify_on_exception?: boolean | null
          notify_on_out_for_delivery?: boolean | null
          notify_on_shipped?: boolean | null
          poll_interval_hours?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          api_key_17track?: string | null
          auto_poll_17track?: boolean | null
          created_at?: string | null
          id?: string
          notify_on_delivered?: boolean | null
          notify_on_exception?: boolean | null
          notify_on_out_for_delivery?: boolean | null
          notify_on_shipped?: boolean | null
          poll_interval_hours?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_tracking_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_transaction_usage: {
        Row: {
          bank_transfer_transactions: number | null
          created_at: string | null
          id: string
          month_year: string
          overage_fee_total: number | null
          pos_card_transactions: number | null
          pos_cash_transactions: number | null
          stripe_transactions: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          bank_transfer_transactions?: number | null
          created_at?: string | null
          id?: string
          month_year: string
          overage_fee_total?: number | null
          pos_card_transactions?: number | null
          pos_cash_transactions?: number | null
          stripe_transactions?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          bank_transfer_transactions?: number | null
          created_at?: string | null
          id?: string
          month_year?: string
          overage_fee_total?: number | null
          pos_card_transactions?: number | null
          pos_cash_transactions?: number | null
          stripe_transactions?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_transaction_usage_tenant_id_fkey"
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
          auto_generate_invoice: boolean | null
          auto_send_invoice_email: boolean | null
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
          domain_verification_token: string | null
          domain_verified: boolean | null
          enable_b2b_checkout: boolean | null
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
          pass_transaction_fee_to_customer: boolean | null
          payment_methods_enabled: Json | null
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
          simplified_vat_acknowledged_at: string | null
          simplified_vat_mode: boolean | null
          slug: string
          ssl_checked_at: string | null
          ssl_expires_at: string | null
          ssl_status: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_onboarding_complete: boolean | null
          stripe_payouts_enabled: boolean | null
          subscription_plan: string | null
          subscription_status: string | null
          tax_percentage: number | null
          transaction_fee_label: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          apply_oss_rules?: boolean | null
          auto_generate_invoice?: boolean | null
          auto_send_invoice_email?: boolean | null
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
          domain_verification_token?: string | null
          domain_verified?: boolean | null
          enable_b2b_checkout?: boolean | null
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
          pass_transaction_fee_to_customer?: boolean | null
          payment_methods_enabled?: Json | null
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
          simplified_vat_acknowledged_at?: string | null
          simplified_vat_mode?: boolean | null
          slug: string
          ssl_checked_at?: string | null
          ssl_expires_at?: string | null
          ssl_status?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          subscription_plan?: string | null
          subscription_status?: string | null
          tax_percentage?: number | null
          transaction_fee_label?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          apply_oss_rules?: boolean | null
          auto_generate_invoice?: boolean | null
          auto_send_invoice_email?: boolean | null
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
          domain_verification_token?: string | null
          domain_verified?: boolean | null
          enable_b2b_checkout?: boolean | null
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
          pass_transaction_fee_to_customer?: boolean | null
          payment_methods_enabled?: Json | null
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
          simplified_vat_acknowledged_at?: string | null
          simplified_vat_mode?: boolean | null
          slug?: string
          ssl_checked_at?: string | null
          ssl_expires_at?: string | null
          ssl_status?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          subscription_plan?: string | null
          subscription_status?: string | null
          tax_percentage?: number | null
          transaction_fee_label?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      themes: {
        Row: {
          created_at: string | null
          default_settings: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          name: string
          preview_image_url: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          default_settings?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          name: string
          preview_image_url?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          default_settings?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          name?: string
          preview_image_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      tracking_import_log: {
        Row: {
          created_at: string | null
          error_details: Json | null
          failed_records: number | null
          id: string
          import_data: Json | null
          import_source: string
          imported_by: string | null
          matched_records: number | null
          tenant_id: string
          total_records: number | null
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          failed_records?: number | null
          id?: string
          import_data?: Json | null
          import_source: string
          imported_by?: string | null
          matched_records?: number | null
          tenant_id: string
          total_records?: number | null
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          failed_records?: number | null
          id?: string
          import_data?: Json | null
          import_source?: string
          imported_by?: string | null
          matched_records?: number | null
          tenant_id?: string
          total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_import_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          credits_used: number | null
          entity_types: string[]
          error_log: Json | null
          failed_items: number | null
          id: string
          job_type: string
          processed_items: number | null
          started_at: string | null
          status: string
          target_languages: string[]
          tenant_id: string
          total_items: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          credits_used?: number | null
          entity_types?: string[]
          error_log?: Json | null
          failed_items?: number | null
          id?: string
          job_type: string
          processed_items?: number | null
          started_at?: string | null
          status?: string
          target_languages: string[]
          tenant_id: string
          total_items?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          credits_used?: number | null
          entity_types?: string[]
          error_log?: Json | null
          failed_items?: number | null
          id?: string
          job_type?: string
          processed_items?: number | null
          started_at?: string | null
          status?: string
          target_languages?: string[]
          tenant_id?: string
          total_items?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_settings: {
        Row: {
          ai_model_preference: string | null
          auto_translate_categories: boolean | null
          auto_translate_marketing: boolean | null
          auto_translate_products: boolean | null
          auto_translate_seo: boolean | null
          created_at: string
          excluded_fields: string[] | null
          id: string
          source_language: string
          target_languages: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_model_preference?: string | null
          auto_translate_categories?: boolean | null
          auto_translate_marketing?: boolean | null
          auto_translate_products?: boolean | null
          auto_translate_seo?: boolean | null
          created_at?: string
          excluded_fields?: string[] | null
          id?: string
          source_language?: string
          target_languages?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_model_preference?: string | null
          auto_translate_categories?: boolean | null
          auto_translate_marketing?: boolean | null
          auto_translate_products?: boolean | null
          auto_translate_seo?: boolean | null
          created_at?: string
          excluded_fields?: string[] | null
          id?: string
          source_language?: string
          target_languages?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      volume_discount_tiers: {
        Row: {
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          max_quantity: number | null
          min_quantity: number
          sort_order: number
          volume_discount_id: string
        }
        Insert: {
          created_at?: string
          discount_type?: string
          discount_value: number
          id?: string
          max_quantity?: number | null
          min_quantity: number
          sort_order?: number
          volume_discount_id: string
        }
        Update: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          sort_order?: number
          volume_discount_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volume_discount_tiers_volume_discount_id_fkey"
            columns: ["volume_discount_id"]
            isOneToOne: false
            referencedRelation: "volume_discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      volume_discounts: {
        Row: {
          applies_to: string
          category_ids: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_ids: string[] | null
          tenant_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to?: string
          category_ids?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_ids?: string[] | null
          tenant_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to?: string
          category_ids?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_ids?: string[] | null
          tenant_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volume_discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_content_engagement_stats: {
        Row: {
          comments: number | null
          content_type: string | null
          created_at: string | null
          engagement_data: Json | null
          id: string | null
          impressions: number | null
          is_used: boolean | null
          language: string | null
          likes: number | null
          platform: string | null
          publish_status: string | null
          published_at: string | null
          shares: number | null
          social_post_id: string | null
          social_status: string | null
          tenant_id: string | null
          title: string | null
          used_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_content_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items_warehouse: {
        Row: {
          id: string | null
          order_id: string | null
          product_id: string | null
          product_image: string | null
          product_name: string | null
          product_sku: string | null
          quantity: number | null
        }
        Insert: {
          id?: string | null
          order_id?: string | null
          product_id?: string | null
          product_image?: string | null
          product_name?: string | null
          product_sku?: string | null
          quantity?: number | null
        }
        Update: {
          id?: string | null
          order_id?: string | null
          product_id?: string | null
          product_image?: string | null
          product_name?: string | null
          product_sku?: string | null
          quantity?: number | null
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
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_warehouse"
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
      orders_warehouse: {
        Row: {
          carrier: string | null
          created_at: string | null
          customer_name: string | null
          delivered_at: string | null
          delivery_type: string | null
          fulfillment_status: string | null
          id: string | null
          marketplace_order_id: string | null
          marketplace_source: string | null
          order_number: string | null
          service_point_data: Json | null
          service_point_id: string | null
          shipped_at: string | null
          shipping_address: Json | null
          status: Database["public"]["Enums"]["order_status"] | null
          tenant_id: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          delivery_type?: string | null
          fulfillment_status?: string | null
          id?: string | null
          marketplace_order_id?: string | null
          marketplace_source?: string | null
          order_number?: string | null
          service_point_data?: Json | null
          service_point_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tenant_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          delivery_type?: string | null
          fulfillment_status?: string | null
          id?: string | null
          marketplace_order_id?: string | null
          marketplace_source?: string | null
          order_number?: string | null
          service_point_data?: Json | null
          service_point_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tenant_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_ai_credits: {
        Args: { p_credits: number; p_tenant_id: string }
        Returns: undefined
      }
      admin_adjust_ai_credits: {
        Args: { p_adjustment: number; p_reason?: string; p_tenant_id: string }
        Returns: boolean
      }
      calculate_session_expected_cash: {
        Args: { p_session_id: string }
        Returns: number
      }
      decrement_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      find_order_by_reference: {
        Args: { p_reference: string; p_tenant_id: string }
        Returns: string
      }
      generate_content_hash: { Args: { content: string }; Returns: string }
      generate_credit_note_number: {
        Args: { _tenant_id: string }
        Returns: string
      }
      generate_fulfillment_api_key: { Args: never; Returns: string }
      generate_gift_card_code: { Args: never; Returns: string }
      generate_invoice_number: { Args: { _tenant_id: string }; Returns: string }
      generate_order_number: { Args: { _tenant_id: string }; Returns: string }
      generate_packing_slip_number: {
        Args: { _tenant_id: string }
        Returns: string
      }
      generate_po_number: { Args: { p_tenant_id: string }; Returns: string }
      generate_proforma_number: {
        Args: { _tenant_id: string }
        Returns: string
      }
      generate_quote_number: { Args: { _tenant_id: string }; Returns: string }
      get_user_highest_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
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
      is_warehouse_user: { Args: { _user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action_details?: Json
          p_action_type: string
          p_target_tenant_id: string
        }
        Returns: string
      }
      record_transaction: {
        Args: {
          p_order_id?: string
          p_tenant_id: string
          p_transaction_type: string
        }
        Returns: Json
      }
      redeem_gift_card: {
        Args: { p_amount: number; p_gift_card_id: string; p_order_id?: string }
        Returns: number
      }
      reset_monthly_ai_credits:
        | { Args: never; Returns: number }
        | {
            Args: { p_monthly_credits: number; p_tenant_id: string }
            Returns: undefined
          }
      schedule_automation_run: {
        Args: {
          p_automation_id: string
          p_metadata?: Json
          p_trigger_entity_id: string
          p_trigger_entity_type: string
        }
        Returns: string
      }
      send_notification: {
        Args: {
          p_action_url?: string
          p_category: string
          p_data?: Json
          p_message: string
          p_priority?: string
          p_tenant_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      update_ai_learning_pattern: {
        Args: {
          p_learned_value: Json
          p_pattern_type: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      use_ai_credits:
        | {
            Args: {
              p_credits: number
              p_feature: string
              p_metadata?: Json
              p_model?: string
              p_tenant_id: string
            }
            Returns: boolean
          }
        | {
            Args: { p_credits_needed?: number; p_tenant_id: string }
            Returns: boolean
          }
    }
    Enums: {
      app_role:
        | "platform_admin"
        | "tenant_admin"
        | "staff"
        | "accountant"
        | "viewer"
        | "warehouse"
      digital_delivery_type:
        | "download"
        | "license_key"
        | "access_url"
        | "email_attachment"
        | "qr_code"
        | "external_service"
      gift_card_status: "active" | "depleted" | "expired" | "disabled"
      gift_card_transaction_type:
        | "purchase"
        | "redeem"
        | "refund"
        | "adjustment"
      invoice_status: "draft" | "sent" | "paid" | "cancelled"
      notification_category:
        | "orders"
        | "invoices"
        | "payments"
        | "customers"
        | "products"
        | "quotes"
        | "subscriptions"
        | "marketing"
        | "team"
        | "system"
      notification_priority: "low" | "medium" | "high" | "urgent"
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      product_type:
        | "physical"
        | "digital"
        | "service"
        | "subscription"
        | "bundle"
        | "gift_card"
      purchase_order_status:
        | "draft"
        | "sent"
        | "confirmed"
        | "shipped"
        | "partially_received"
        | "received"
        | "cancelled"
      quote_status:
        | "draft"
        | "sent"
        | "accepted"
        | "declined"
        | "expired"
        | "converted"
      supplier_document_type:
        | "invoice"
        | "quote"
        | "delivery_note"
        | "credit_note"
        | "contract"
        | "other"
      supplier_payment_status:
        | "pending"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
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
      app_role: [
        "platform_admin",
        "tenant_admin",
        "staff",
        "accountant",
        "viewer",
        "warehouse",
      ],
      digital_delivery_type: [
        "download",
        "license_key",
        "access_url",
        "email_attachment",
        "qr_code",
        "external_service",
      ],
      gift_card_status: ["active", "depleted", "expired", "disabled"],
      gift_card_transaction_type: [
        "purchase",
        "redeem",
        "refund",
        "adjustment",
      ],
      invoice_status: ["draft", "sent", "paid", "cancelled"],
      notification_category: [
        "orders",
        "invoices",
        "payments",
        "customers",
        "products",
        "quotes",
        "subscriptions",
        "marketing",
        "team",
        "system",
      ],
      notification_priority: ["low", "medium", "high", "urgent"],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["pending", "paid", "refunded", "failed"],
      product_type: [
        "physical",
        "digital",
        "service",
        "subscription",
        "bundle",
        "gift_card",
      ],
      purchase_order_status: [
        "draft",
        "sent",
        "confirmed",
        "shipped",
        "partially_received",
        "received",
        "cancelled",
      ],
      quote_status: [
        "draft",
        "sent",
        "accepted",
        "declined",
        "expired",
        "converted",
      ],
      supplier_document_type: [
        "invoice",
        "quote",
        "delivery_note",
        "credit_note",
        "contract",
        "other",
      ],
      supplier_payment_status: [
        "pending",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
    },
  },
} as const
