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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_custom_metrics: {
        Row: {
          aggregation_method: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          metric_key: string
          metric_name: string
          metric_type: string
          show_in_exports: boolean
          show_in_whatsapp: boolean
          updated_at: string
        }
        Insert: {
          aggregation_method?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metric_key: string
          metric_name: string
          metric_type: string
          show_in_exports?: boolean
          show_in_whatsapp?: boolean
          updated_at?: string
        }
        Update: {
          aggregation_method?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metric_key?: string
          metric_name?: string
          metric_type?: string
          show_in_exports?: boolean
          show_in_whatsapp?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      daily_lead_report_ad_accounts: {
        Row: {
          ad_account_name: string
          ad_spend: number
          created_at: string
          id: string
          metrics: Json | null
          report_media_buyer_id: string
          updated_at: string
        }
        Insert: {
          ad_account_name: string
          ad_spend?: number
          created_at?: string
          id?: string
          metrics?: Json | null
          report_media_buyer_id: string
          updated_at?: string
        }
        Update: {
          ad_account_name?: string
          ad_spend?: number
          created_at?: string
          id?: string
          metrics?: Json | null
          report_media_buyer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_lead_report_ad_accounts_report_media_buyer_id_fkey"
            columns: ["report_media_buyer_id"]
            isOneToOne: false
            referencedRelation: "daily_lead_report_media_buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_lead_report_media_buyers: {
        Row: {
          cpl: number
          created_at: string
          date_column: string | null
          fetch_metadata: Json | null
          id: string
          is_manual_lead_override: boolean
          lead_count_source: string
          lead_source_url: string | null
          media_buyer_key: string | null
          media_buyer_name: string
          report_id: string
          sheet_id: string | null
          spreadsheet_id: string | null
          spreadsheet_title: string | null
          status: string
          tab_name: string | null
          team_member_id: string | null
          total_ad_spend: number
          total_leads: number
          updated_at: string
        }
        Insert: {
          cpl?: number
          created_at?: string
          date_column?: string | null
          fetch_metadata?: Json | null
          id?: string
          is_manual_lead_override?: boolean
          lead_count_source?: string
          lead_source_url?: string | null
          media_buyer_key?: string | null
          media_buyer_name: string
          report_id: string
          sheet_id?: string | null
          spreadsheet_id?: string | null
          spreadsheet_title?: string | null
          status?: string
          tab_name?: string | null
          team_member_id?: string | null
          total_ad_spend?: number
          total_leads?: number
          updated_at?: string
        }
        Update: {
          cpl?: number
          created_at?: string
          date_column?: string | null
          fetch_metadata?: Json | null
          id?: string
          is_manual_lead_override?: boolean
          lead_count_source?: string
          lead_source_url?: string | null
          media_buyer_key?: string | null
          media_buyer_name?: string
          report_id?: string
          sheet_id?: string | null
          spreadsheet_id?: string | null
          spreadsheet_title?: string | null
          status?: string
          tab_name?: string | null
          team_member_id?: string | null
          total_ad_spend?: number
          total_leads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_lead_report_media_buyers_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_lead_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_lead_report_media_buyers_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_lead_reports: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          input_hash: string | null
          is_deleted: boolean
          metric_template_id: string | null
          notes: string | null
          overall_cpl: number
          report_date: string
          report_name: string | null
          report_status: string
          total_ad_spend: number
          total_leads: number
          updated_at: string
          whatsapp_message: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          input_hash?: string | null
          is_deleted?: boolean
          metric_template_id?: string | null
          notes?: string | null
          overall_cpl?: number
          report_date: string
          report_name?: string | null
          report_status?: string
          total_ad_spend?: number
          total_leads?: number
          updated_at?: string
          whatsapp_message?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          input_hash?: string | null
          is_deleted?: boolean
          metric_template_id?: string | null
          notes?: string | null
          overall_cpl?: number
          report_date?: string
          report_name?: string | null
          report_status?: string
          total_ad_spend?: number
          total_leads?: number
          updated_at?: string
          whatsapp_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_lead_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_lead_source_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          date_column: string | null
          id: string
          is_active: boolean
          is_default: boolean
          lead_source_name: string | null
          media_buyer_name: string
          sheet_id: string | null
          sheet_url: string
          spreadsheet_id: string | null
          spreadsheet_title: string | null
          tab_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_column?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          lead_source_name?: string | null
          media_buyer_name: string
          sheet_id?: string | null
          sheet_url: string
          spreadsheet_id?: string | null
          spreadsheet_title?: string | null
          tab_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_column?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          lead_source_name?: string | null
          media_buyer_name?: string
          sheet_id?: string | null
          sheet_url?: string
          spreadsheet_id?: string | null
          spreadsheet_title?: string | null
          tab_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_metric_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          metrics: Json
          template_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          metrics?: Json
          template_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          metrics?: Json
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      delegation_activity: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          new_value: Json | null
          note: string | null
          old_value: Json | null
          task_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "delegation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_due_date_requests: {
        Row: {
          created_at: string
          current_due_date: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          delay_reason: string | null
          id: string
          note: string | null
          requested_by: string
          requested_due_date: string
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_due_date?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          delay_reason?: string | null
          id?: string
          note?: string | null
          requested_by: string
          requested_due_date: string
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_due_date?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          delay_reason?: string | null
          id?: string
          note?: string | null
          requested_by?: string
          requested_due_date?: string
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_due_date_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "delegation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_monthly_appraisals: {
        Row: {
          created_at: string
          frozen_at: string
          frozen_by: string | null
          grade: string
          id: string
          month: string
          report_json: Json
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          frozen_at?: string
          frozen_by?: string | null
          grade?: string
          id?: string
          month: string
          report_json: Json
          score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          frozen_at?: string
          frozen_by?: string | null
          grade?: string
          id?: string
          month?: string
          report_json?: Json
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      delegation_monthly_awards: {
        Row: {
          award_type: string
          created_at: string
          frozen_at: string
          frozen_by: string | null
          id: string
          month: string
          reward_label: string | null
          user_id: string
          value: number
        }
        Insert: {
          award_type: string
          created_at?: string
          frozen_at?: string
          frozen_by?: string | null
          id?: string
          month: string
          reward_label?: string | null
          user_id: string
          value?: number
        }
        Update: {
          award_type?: string
          created_at?: string
          frozen_at?: string
          frozen_by?: string | null
          id?: string
          month?: string
          reward_label?: string | null
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      delegation_points_ledger: {
        Row: {
          created_at: string
          id: string
          period_date: string
          points: number
          reason: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_date?: string
          points: number
          reason: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_date?: string
          points?: number
          reason?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_points_ledger_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "delegation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_settings: {
        Row: {
          id: number
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      delegation_tasks: {
        Row: {
          assigned_by_email: string | null
          assigned_by_name: string | null
          assigned_by_user_id: string | null
          assignee_email: string | null
          assignee_id: string | null
          assignee_name: string | null
          assignee_team_member_id: string | null
          blocked_reason: string | null
          brand_id: string | null
          category: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          delay_reason: string | null
          department: string | null
          description: string | null
          difficulty: string
          due_date: string | null
          due_date_locked: boolean
          due_time: string | null
          final_date: string | null
          follow_up_reminder: string | null
          id: string
          is_deleted: boolean
          priority: string
          proof_note: string | null
          proof_required: boolean
          proof_url: string | null
          revision_1_date: string | null
          revision_2_date: string | null
          revision_count: number
          status: string
          system_stage: string
          task_type: Database["public"]["Enums"]["delegation_task_type"]
          title: string
          updated_at: string
          waiting_on_user_id: string | null
        }
        Insert: {
          assigned_by_email?: string | null
          assigned_by_name?: string | null
          assigned_by_user_id?: string | null
          assignee_email?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          assignee_team_member_id?: string | null
          blocked_reason?: string | null
          brand_id?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          delay_reason?: string | null
          department?: string | null
          description?: string | null
          difficulty?: string
          due_date?: string | null
          due_date_locked?: boolean
          due_time?: string | null
          final_date?: string | null
          follow_up_reminder?: string | null
          id?: string
          is_deleted?: boolean
          priority?: string
          proof_note?: string | null
          proof_required?: boolean
          proof_url?: string | null
          revision_1_date?: string | null
          revision_2_date?: string | null
          revision_count?: number
          status?: string
          system_stage?: string
          task_type?: Database["public"]["Enums"]["delegation_task_type"]
          title: string
          updated_at?: string
          waiting_on_user_id?: string | null
        }
        Update: {
          assigned_by_email?: string | null
          assigned_by_name?: string | null
          assigned_by_user_id?: string | null
          assignee_email?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          assignee_team_member_id?: string | null
          blocked_reason?: string | null
          brand_id?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          delay_reason?: string | null
          department?: string | null
          description?: string | null
          difficulty?: string
          due_date?: string | null
          due_date_locked?: boolean
          due_time?: string | null
          final_date?: string | null
          follow_up_reminder?: string | null
          id?: string
          is_deleted?: boolean
          priority?: string
          proof_note?: string | null
          proof_required?: boolean
          proof_url?: string | null
          revision_1_date?: string | null
          revision_2_date?: string | null
          revision_count?: number
          status?: string
          system_stage?: string
          task_type?: Database["public"]["Enums"]["delegation_task_type"]
          title?: string
          updated_at?: string
          waiting_on_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delegation_tasks_assignee_team_member_id_fkey"
            columns: ["assignee_team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      discipline_automation_run_logs: {
        Row: {
          created_at: string
          drafts_created: number
          drafts_skipped: number
          emails_failed: number
          emails_sent: number
          error_message: string | null
          finished_at: string | null
          id: string
          penalties_applied: number
          penalties_skipped: number
          report_json: Json
          run_by: string | null
          run_type: string
          scanned_count: number
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          drafts_created?: number
          drafts_skipped?: number
          emails_failed?: number
          emails_sent?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          penalties_applied?: number
          penalties_skipped?: number
          report_json?: Json
          run_by?: string | null
          run_type: string
          scanned_count?: number
          started_at?: string
          status: string
        }
        Update: {
          created_at?: string
          drafts_created?: number
          drafts_skipped?: number
          emails_failed?: number
          emails_sent?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          penalties_applied?: number
          penalties_skipped?: number
          report_json?: Json
          run_by?: string | null
          run_type?: string
          scanned_count?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      gwv_access_audit_log: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          summary: string | null
          target_team_member_id: string | null
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          summary?: string | null
          target_team_member_id?: string | null
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: string | null
          target_team_member_id?: string | null
        }
        Relationships: []
      }
      gwv_attendance_records: {
        Row: {
          check_in_accuracy: number | null
          check_in_at: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_status: string
          check_out_accuracy: number | null
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_status: string
          created_at: string
          date: string
          id: string
          is_late: boolean
          late_minutes: number
          location_status: string
          notes: string | null
          team_member_id: string | null
          total_work_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_accuracy?: number | null
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_status?: string
          check_out_accuracy?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_status?: string
          created_at?: string
          date?: string
          id?: string
          is_late?: boolean
          late_minutes?: number
          location_status?: string
          notes?: string | null
          team_member_id?: string | null
          total_work_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_accuracy?: number | null
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_status?: string
          check_out_accuracy?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_status?: string
          created_at?: string
          date?: string
          id?: string
          is_late?: boolean
          late_minutes?: number
          location_status?: string
          notes?: string | null
          team_member_id?: string | null
          total_work_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gwv_attendance_settings: {
        Row: {
          allowed_check_in_start_time: string | null
          allowed_radius_meters: number
          created_at: string
          enable_auto_checkin_prompt: boolean
          enable_location_required: boolean
          expected_check_in_time: string | null
          expected_check_out_time: string | null
          id: string
          late_grace_minutes: number
          missed_cutoff_time: string
          office_lat: number | null
          office_lng: number | null
          office_name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          allowed_check_in_start_time?: string | null
          allowed_radius_meters?: number
          created_at?: string
          enable_auto_checkin_prompt?: boolean
          enable_location_required?: boolean
          expected_check_in_time?: string | null
          expected_check_out_time?: string | null
          id?: string
          late_grace_minutes?: number
          missed_cutoff_time?: string
          office_lat?: number | null
          office_lng?: number | null
          office_name?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          allowed_check_in_start_time?: string | null
          allowed_radius_meters?: number
          created_at?: string
          enable_auto_checkin_prompt?: boolean
          enable_location_required?: boolean
          expected_check_in_time?: string | null
          expected_check_out_time?: string | null
          id?: string
          late_grace_minutes?: number
          missed_cutoff_time?: string
          office_lat?: number | null
          office_lng?: number | null
          office_name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      gwv_brands: {
        Row: {
          category: string | null
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          include_in_expense_allocation: boolean
          include_in_sidebar: boolean
          is_deleted: boolean
          legacy_slug: string | null
          name: string
          route_path: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          include_in_expense_allocation?: boolean
          include_in_sidebar?: boolean
          is_deleted?: boolean
          legacy_slug?: string | null
          name: string
          route_path?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          include_in_expense_allocation?: boolean
          include_in_sidebar?: boolean
          is_deleted?: boolean
          legacy_slug?: string | null
          name?: string
          route_path?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gwv_company_positions: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          created_at: string
          created_by: string | null
          daily_interview_target_override: number | null
          default_sla_days: number
          department: string | null
          hiring_bible_route: string | null
          hiring_bible_table_key: string | null
          id: string
          is_deleted: boolean
          location: string | null
          minimum_ready_now: number
          pool_target: number
          position_name: string
          priority: string
          reporting_manager: string | null
          salary_range: string | null
          source: string
          status: string
          updated_at: string
          work_mode: string | null
        }
        Insert: {
          brand_id?: string | null
          brand_name?: string | null
          created_at?: string
          created_by?: string | null
          daily_interview_target_override?: number | null
          default_sla_days?: number
          department?: string | null
          hiring_bible_route?: string | null
          hiring_bible_table_key?: string | null
          id?: string
          is_deleted?: boolean
          location?: string | null
          minimum_ready_now?: number
          pool_target?: number
          position_name: string
          priority?: string
          reporting_manager?: string | null
          salary_range?: string | null
          source?: string
          status?: string
          updated_at?: string
          work_mode?: string | null
        }
        Update: {
          brand_id?: string | null
          brand_name?: string | null
          created_at?: string
          created_by?: string | null
          daily_interview_target_override?: number | null
          default_sla_days?: number
          department?: string | null
          hiring_bible_route?: string | null
          hiring_bible_table_key?: string | null
          id?: string
          is_deleted?: boolean
          location?: string | null
          minimum_ready_now?: number
          pool_target?: number
          position_name?: string
          priority?: string
          reporting_manager?: string | null
          salary_range?: string | null
          source?: string
          status?: string
          updated_at?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      gwv_hr_candidate_pool: {
        Row: {
          availability: string | null
          brand_fit: string | null
          brand_id: string | null
          brand_name: string | null
          candidate_name: string
          created_at: string
          created_by: string | null
          email: string | null
          expected_salary: string | null
          freshness_status: string
          hiring_bible_candidate_id: string | null
          hiring_bible_route: string | null
          hiring_bible_table_key: string | null
          hiring_source: string | null
          hr_remarks: string | null
          id: string
          interview_decision: string | null
          interview_score: number | null
          interview_status: string | null
          is_active: boolean
          is_deleted: boolean
          last_contacted_at: string | null
          location: string | null
          manager_remarks: string | null
          phone: string
          position_id: string | null
          position_name: string
          readiness_tier: string
          ready_to_join_from: string | null
          skill_level: string | null
          source: string | null
          updated_at: string
          work_mode: string | null
        }
        Insert: {
          availability?: string | null
          brand_fit?: string | null
          brand_id?: string | null
          brand_name?: string | null
          candidate_name: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expected_salary?: string | null
          freshness_status?: string
          hiring_bible_candidate_id?: string | null
          hiring_bible_route?: string | null
          hiring_bible_table_key?: string | null
          hiring_source?: string | null
          hr_remarks?: string | null
          id?: string
          interview_decision?: string | null
          interview_score?: number | null
          interview_status?: string | null
          is_active?: boolean
          is_deleted?: boolean
          last_contacted_at?: string | null
          location?: string | null
          manager_remarks?: string | null
          phone: string
          position_id?: string | null
          position_name: string
          readiness_tier?: string
          ready_to_join_from?: string | null
          skill_level?: string | null
          source?: string | null
          updated_at?: string
          work_mode?: string | null
        }
        Update: {
          availability?: string | null
          brand_fit?: string | null
          brand_id?: string | null
          brand_name?: string | null
          candidate_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expected_salary?: string | null
          freshness_status?: string
          hiring_bible_candidate_id?: string | null
          hiring_bible_route?: string | null
          hiring_bible_table_key?: string | null
          hiring_source?: string | null
          hr_remarks?: string | null
          id?: string
          interview_decision?: string | null
          interview_score?: number | null
          interview_status?: string | null
          is_active?: boolean
          is_deleted?: boolean
          last_contacted_at?: string | null
          location?: string | null
          manager_remarks?: string | null
          phone?: string
          position_id?: string | null
          position_name?: string
          readiness_tier?: string
          ready_to_join_from?: string | null
          skill_level?: string | null
          source?: string | null
          updated_at?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      gwv_hr_daily_reports: {
        Row: {
          blockers: string | null
          bonus_breakdown: Json
          checklist_completed_count: number
          checklist_total_count: number
          created_at: string
          followup_notes: string | null
          hiring_mode: string | null
          hr_name: string | null
          hr_user_id: string | null
          id: string
          interview_target: number
          interviews_conducted: number
          is_deleted: boolean
          key_outcomes: string | null
          login_time: string | null
          logout_time: string | null
          open_positions_count: number
          pdf_url: string | null
          penalty_breakdown: Json
          ready_pool_added_count: number
          rejected_count: number
          report_date: string
          report_status: string
          score_breakdown: Json
          score_total: number
          shortlisted_count: number
          sla_missed_count: number
          source_snapshot: Json
          submitted_at: string | null
          tomorrow_focus: string | null
          updated_at: string
          whatsapp_summary: string | null
        }
        Insert: {
          blockers?: string | null
          bonus_breakdown?: Json
          checklist_completed_count?: number
          checklist_total_count?: number
          created_at?: string
          followup_notes?: string | null
          hiring_mode?: string | null
          hr_name?: string | null
          hr_user_id?: string | null
          id?: string
          interview_target?: number
          interviews_conducted?: number
          is_deleted?: boolean
          key_outcomes?: string | null
          login_time?: string | null
          logout_time?: string | null
          open_positions_count?: number
          pdf_url?: string | null
          penalty_breakdown?: Json
          ready_pool_added_count?: number
          rejected_count?: number
          report_date: string
          report_status?: string
          score_breakdown?: Json
          score_total?: number
          shortlisted_count?: number
          sla_missed_count?: number
          source_snapshot?: Json
          submitted_at?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          whatsapp_summary?: string | null
        }
        Update: {
          blockers?: string | null
          bonus_breakdown?: Json
          checklist_completed_count?: number
          checklist_total_count?: number
          created_at?: string
          followup_notes?: string | null
          hiring_mode?: string | null
          hr_name?: string | null
          hr_user_id?: string | null
          id?: string
          interview_target?: number
          interviews_conducted?: number
          is_deleted?: boolean
          key_outcomes?: string | null
          login_time?: string | null
          logout_time?: string | null
          open_positions_count?: number
          pdf_url?: string | null
          penalty_breakdown?: Json
          ready_pool_added_count?: number
          rejected_count?: number
          report_date?: string
          report_status?: string
          score_breakdown?: Json
          score_total?: number
          shortlisted_count?: number
          sla_missed_count?: number
          source_snapshot?: Json
          submitted_at?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          whatsapp_summary?: string | null
        }
        Relationships: []
      }
      gwv_hr_hiring_requirements: {
        Row: {
          assigned_date: string
          assigned_to_user_id: string | null
          brand_id: string | null
          brand_name: string | null
          created_at: string
          created_by: string | null
          deadline_date: string | null
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          experience_required: string | null
          filled_at: string | null
          filled_count: number
          id: string
          is_deleted: boolean
          is_filled: boolean
          location: string | null
          missed_sla: boolean
          missed_sla_at: string | null
          openings: number
          position_id: string | null
          position_name: string
          priority: string
          reason_for_hiring: string | null
          reporting_manager: string | null
          salary_range: string | null
          skills_required: string | null
          sla_days: number
          sla_status: string
          source: string
          special_notes: string | null
          status: string
          updated_at: string
          work_mode: string | null
        }
        Insert: {
          assigned_date?: string
          assigned_to_user_id?: string | null
          brand_id?: string | null
          brand_name?: string | null
          created_at?: string
          created_by?: string | null
          deadline_date?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          experience_required?: string | null
          filled_at?: string | null
          filled_count?: number
          id?: string
          is_deleted?: boolean
          is_filled?: boolean
          location?: string | null
          missed_sla?: boolean
          missed_sla_at?: string | null
          openings?: number
          position_id?: string | null
          position_name: string
          priority?: string
          reason_for_hiring?: string | null
          reporting_manager?: string | null
          salary_range?: string | null
          skills_required?: string | null
          sla_days?: number
          sla_status?: string
          source?: string
          special_notes?: string | null
          status?: string
          updated_at?: string
          work_mode?: string | null
        }
        Update: {
          assigned_date?: string
          assigned_to_user_id?: string | null
          brand_id?: string | null
          brand_name?: string | null
          created_at?: string
          created_by?: string | null
          deadline_date?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          experience_required?: string | null
          filled_at?: string | null
          filled_count?: number
          id?: string
          is_deleted?: boolean
          is_filled?: boolean
          location?: string | null
          missed_sla?: boolean
          missed_sla_at?: string | null
          openings?: number
          position_id?: string | null
          position_name?: string
          priority?: string
          reason_for_hiring?: string | null
          reporting_manager?: string | null
          salary_range?: string | null
          skills_required?: string | null
          sla_days?: number
          sla_status?: string
          source?: string
          special_notes?: string | null
          status?: string
          updated_at?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      gwv_hr_kpi_settings: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      gwv_hr_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json
          priority: string
          read_at: string | null
          role_target: string | null
          source_id: string | null
          source_type: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json
          priority?: string
          read_at?: string | null
          role_target?: string | null
          source_id?: string | null
          source_type?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json
          priority?: string
          read_at?: string | null
          role_target?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gwv_hr_score_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_date: string
          event_type: string
          hr_user_id: string | null
          id: string
          is_deleted: boolean
          metadata: Json
          reason: string | null
          score_category: string | null
          score_delta: number
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_date: string
          event_type: string
          hr_user_id?: string | null
          id?: string
          is_deleted?: boolean
          metadata?: Json
          reason?: string | null
          score_category?: string | null
          score_delta: number
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type?: string
          hr_user_id?: string | null
          id?: string
          is_deleted?: boolean
          metadata?: Json
          reason?: string | null
          score_category?: string | null
          score_delta?: number
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: []
      }
      gwv_hr_work_sessions: {
        Row: {
          created_at: string
          id: string
          last_activity_at: string | null
          login_time: string
          logout_time: string | null
          metadata: Json
          session_date: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_activity_at?: string | null
          login_time?: string
          logout_time?: string | null
          metadata?: Json
          session_date: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_activity_at?: string | null
          login_time?: string
          logout_time?: string | null
          metadata?: Json
          session_date?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      gwv_master_options: {
        Row: {
          brand_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          metadata: Json
          option_key: string
          option_type: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          metadata?: Json
          option_key: string
          option_type: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          metadata?: Json
          option_key?: string
          option_type?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "gwv_master_options_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "gwv_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      gwv_modules: {
        Row: {
          brand_id: string | null
          created_at: string
          created_by: string | null
          default_access_level: string
          description: string | null
          id: string
          is_assignable: boolean
          is_deleted: boolean
          metadata: Json
          module_key: string
          module_name: string
          module_status: string
          parent_module_id: string | null
          route_path: string | null
          sensitivity: string
          show_in_module_hub: boolean
          show_in_sidebar: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          default_access_level?: string
          description?: string | null
          id?: string
          is_assignable?: boolean
          is_deleted?: boolean
          metadata?: Json
          module_key: string
          module_name: string
          module_status?: string
          parent_module_id?: string | null
          route_path?: string | null
          sensitivity?: string
          show_in_module_hub?: boolean
          show_in_sidebar?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          default_access_level?: string
          description?: string | null
          id?: string
          is_assignable?: boolean
          is_deleted?: boolean
          metadata?: Json
          module_key?: string
          module_name?: string
          module_status?: string
          parent_module_id?: string | null
          route_path?: string | null
          sensitivity?: string
          show_in_module_hub?: boolean
          show_in_sidebar?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gwv_modules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "gwv_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwv_modules_parent_module_id_fkey"
            columns: ["parent_module_id"]
            isOneToOne: false
            referencedRelation: "gwv_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      gwv_position_module_access: {
        Row: {
          access_level: string
          brand_id: string | null
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_manage: boolean
          can_view: boolean
          can_view_finance: boolean
          created_at: string
          id: string
          module_id: string
          position_id: string
          scope: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          brand_id?: string | null
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          can_view_finance?: boolean
          created_at?: string
          id?: string
          module_id: string
          position_id: string
          scope?: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          brand_id?: string | null
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          can_view_finance?: boolean
          created_at?: string
          id?: string
          module_id?: string
          position_id?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gwv_position_module_access_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "gwv_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwv_position_module_access_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "gwv_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwv_position_module_access_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "gwv_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      gwv_positions: {
        Row: {
          created_at: string
          created_by: string | null
          default_access_level: string
          default_permissions: Json
          description: string | null
          id: string
          is_deleted: boolean
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_access_level?: string
          default_permissions?: Json
          description?: string | null
          id?: string
          is_deleted?: boolean
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_access_level?: string
          default_permissions?: Json
          description?: string | null
          id?: string
          is_deleted?: boolean
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gwv_shared_expense_allocations: {
        Row: {
          allocated_amount_in_inr: number
          allocation_percentage: number
          brand_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          month: string | null
          notes: string | null
          source_id: string
          source_type: string
          updated_at: string
        }
        Insert: {
          allocated_amount_in_inr?: number
          allocation_percentage?: number
          brand_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          month?: string | null
          notes?: string | null
          source_id: string
          source_type: string
          updated_at?: string
        }
        Update: {
          allocated_amount_in_inr?: number
          allocation_percentage?: number
          brand_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          month?: string | null
          notes?: string | null
          source_id?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gwv_shared_expense_allocations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "gwv_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      gwv_team_brand_allocations: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          percentage: number
          team_member_id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          percentage?: number
          team_member_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          percentage?: number
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gwv_team_brand_allocations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "gwv_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwv_team_brand_allocations_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      gwv_team_members: {
        Row: {
          access_level: string
          access_preset: string | null
          auto_add_to_expenses: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          email: string
          employment_type: string | null
          expense_category: string | null
          id: string
          invited_at: string | null
          is_deleted: boolean
          joining_date: string | null
          last_active_at: string | null
          linked_user_id: string | null
          name: string
          notes: string | null
          payment_cycle: string | null
          payment_date: string | null
          phone: string | null
          position_id: string | null
          reporting_manager: string | null
          salary_amount: number | null
          salary_currency: string | null
          salary_type: string | null
          status: string
          updated_at: string
          work_mode: string | null
        }
        Insert: {
          access_level?: string
          access_preset?: string | null
          auto_add_to_expenses?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          email: string
          employment_type?: string | null
          expense_category?: string | null
          id?: string
          invited_at?: string | null
          is_deleted?: boolean
          joining_date?: string | null
          last_active_at?: string | null
          linked_user_id?: string | null
          name: string
          notes?: string | null
          payment_cycle?: string | null
          payment_date?: string | null
          phone?: string | null
          position_id?: string | null
          reporting_manager?: string | null
          salary_amount?: number | null
          salary_currency?: string | null
          salary_type?: string | null
          status?: string
          updated_at?: string
          work_mode?: string | null
        }
        Update: {
          access_level?: string
          access_preset?: string | null
          auto_add_to_expenses?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          email?: string
          employment_type?: string | null
          expense_category?: string | null
          id?: string
          invited_at?: string | null
          is_deleted?: boolean
          joining_date?: string | null
          last_active_at?: string | null
          linked_user_id?: string | null
          name?: string
          notes?: string | null
          payment_cycle?: string | null
          payment_date?: string | null
          phone?: string | null
          position_id?: string | null
          reporting_manager?: string | null
          salary_amount?: number | null
          salary_currency?: string | null
          salary_type?: string | null
          status?: string
          updated_at?: string
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gwv_team_members_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "gwv_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      gwv_user_brand_access: {
        Row: {
          access_level: string
          brand_id: string
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_manage: boolean
          can_view: boolean
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          team_member_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_level?: string
          brand_id: string
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          team_member_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_level?: string
          brand_id?: string
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          team_member_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gwv_user_brand_access_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "gwv_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwv_user_brand_access_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      gwv_user_module_access: {
        Row: {
          access_level: string
          brand_id: string | null
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_manage: boolean
          can_view: boolean
          can_view_finance: boolean
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          metadata: Json
          module_id: string
          scope: string
          team_member_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_level?: string
          brand_id?: string | null
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          can_view_finance?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          module_id: string
          scope?: string
          team_member_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_level?: string
          brand_id?: string | null
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          can_view_finance?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          module_id?: string
          scope?: string
          team_member_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gwv_user_module_access_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "gwv_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwv_user_module_access_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "gwv_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwv_user_module_access_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_daily_entry: {
        Row: {
          committed: number | null
          created_at: string
          created_by: string | null
          entry_date: string
          good_day: boolean | null
          id: string
          note: string | null
          position_id: string | null
          quality_passed: boolean | null
          shipped: number | null
          team_member_id: string
          updated_at: string
          values: Json
        }
        Insert: {
          committed?: number | null
          created_at?: string
          created_by?: string | null
          entry_date: string
          good_day?: boolean | null
          id?: string
          note?: string | null
          position_id?: string | null
          quality_passed?: boolean | null
          shipped?: number | null
          team_member_id: string
          updated_at?: string
          values?: Json
        }
        Update: {
          committed?: number | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          good_day?: boolean | null
          id?: string
          note?: string | null
          position_id?: string | null
          quality_passed?: boolean | null
          shipped?: number | null
          team_member_id?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "kpi_daily_entry_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "gwv_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_daily_entry_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          config_id: string
          created_at: string
          description: string | null
          direction: string
          id: string
          is_active: boolean
          is_quality_gate: boolean
          kpi_key: string
          kpi_type: string
          label: string
          sort_order: number
          target: number | null
          unit: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          config_id: string
          created_at?: string
          description?: string | null
          direction?: string
          id?: string
          is_active?: boolean
          is_quality_gate?: boolean
          kpi_key: string
          kpi_type: string
          label: string
          sort_order?: number
          target?: number | null
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          config_id?: string
          created_at?: string
          description?: string | null
          direction?: string
          id?: string
          is_active?: boolean
          is_quality_gate?: boolean
          kpi_key?: string
          kpi_type?: string
          label?: string
          sort_order?: number
          target?: number | null
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "kpi_position_config"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_position_config: {
        Row: {
          created_at: string
          created_by: string | null
          critical_number: string | null
          critical_number_target: number | null
          critical_number_unit: string | null
          daily_commit_target: number
          good_day_rule: Json
          id: string
          is_active: boolean
          position_id: string
          quarter_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          critical_number?: string | null
          critical_number_target?: number | null
          critical_number_unit?: string | null
          daily_commit_target?: number
          good_day_rule?: Json
          id?: string
          is_active?: boolean
          position_id: string
          quarter_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          critical_number?: string | null
          critical_number_target?: number | null
          critical_number_unit?: string | null
          daily_commit_target?: number
          good_day_rule?: Json
          id?: string
          is_active?: boolean
          position_id?: string
          quarter_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_position_config_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: true
            referencedRelation: "gwv_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_client_ledger_entries: {
        Row: {
          amount_excluding_gst: number
          amount_inclusive_gst: number
          category: string | null
          client_id: string
          created_at: string
          created_by: string | null
          entry_date: string | null
          entry_type: string
          id: string
          import_batch_id: string | null
          import_source: string | null
          is_deleted: boolean
          ledger_month: string
          metadata: Json
          name: string | null
          notes: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          amount_excluding_gst?: number
          amount_inclusive_gst?: number
          category?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          entry_date?: string | null
          entry_type: string
          id?: string
          import_batch_id?: string | null
          import_source?: string | null
          is_deleted?: boolean
          ledger_month: string
          metadata?: Json
          name?: string | null
          notes?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          amount_excluding_gst?: number
          amount_inclusive_gst?: number
          category?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string | null
          entry_type?: string
          id?: string
          import_batch_id?: string | null
          import_source?: string | null
          is_deleted?: boolean
          ledger_month?: string
          metadata?: Json
          name?: string | null
          notes?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_client_ledger_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketizers_client_ledger_entries_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "marketizers_client_ledger_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_client_ledger_import_batches: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          duplicates_skipped: number
          expense_total_excl_gst: number
          id: string
          import_type: string
          income_total_excl_gst: number
          is_undone: boolean
          ledger_month: string
          rows_imported: number
          rows_skipped: number
          source_name: string | null
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          duplicates_skipped?: number
          expense_total_excl_gst?: number
          id?: string
          import_type: string
          income_total_excl_gst?: number
          is_undone?: boolean
          ledger_month: string
          rows_imported?: number
          rows_skipped?: number
          source_name?: string | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          duplicates_skipped?: number
          expense_total_excl_gst?: number
          id?: string
          import_type?: string
          income_total_excl_gst?: number
          is_undone?: boolean
          ledger_month?: string
          rows_imported?: number
          rows_skipped?: number
          source_name?: string | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_client_ledger_import_batches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_client_profit_splits: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_deleted: boolean
          is_marketizers_revenue: boolean
          receiver_name: string
          receiver_type: string
          sort_order: number
          split_percent: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_marketizers_revenue?: boolean
          receiver_name: string
          receiver_type: string
          sort_order?: number
          split_percent?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_marketizers_revenue?: boolean
          receiver_name?: string
          receiver_type?: string
          sort_order?: number
          split_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_client_profit_splits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_clients: {
        Row: {
          account_owner: string | null
          assigned_manager: string | null
          base_retainer_amount: number | null
          billing_cycle: string | null
          billing_date: string | null
          billing_notes: string | null
          bonus_amount: number | null
          bonus_trigger: string | null
          bonus_type: string | null
          business_category: string | null
          client_name: string
          client_risk: string | null
          client_stage: string | null
          collection_due_date: string | null
          created_at: string
          created_by: string | null
          custom_revenue_terms: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          expected_monthly_revenue: number | null
          founder_name: string | null
          gst_applicable: boolean | null
          id: string
          important_reminder: string | null
          is_deleted: boolean
          media_buyer: string | null
          metric_used: string | null
          minimum_guarantee: number | null
          monthly_retainer_amount: number | null
          niche: string | null
          notes: string | null
          payment_risk: string | null
          phone: string | null
          revenue_base: string | null
          revenue_model: string
          revenue_share_percentage: number | null
          revenue_tracking_source: string | null
          revenue_tracking_sources: string[] | null
          sales_owner: string | null
          settlement_frequency: string | null
          setup_delivery_deadline: string | null
          setup_fee: number | null
          setup_payment_status: string | null
          setup_scope: string | null
          social_url: string | null
          start_date: string | null
          status: string
          trial_conversion_plan: string | null
          trial_duration: string | null
          trial_end_date: string | null
          trial_fee: number | null
          trigger_target_value: number | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          account_owner?: string | null
          assigned_manager?: string | null
          base_retainer_amount?: number | null
          billing_cycle?: string | null
          billing_date?: string | null
          billing_notes?: string | null
          bonus_amount?: number | null
          bonus_trigger?: string | null
          bonus_type?: string | null
          business_category?: string | null
          client_name: string
          client_risk?: string | null
          client_stage?: string | null
          collection_due_date?: string | null
          created_at?: string
          created_by?: string | null
          custom_revenue_terms?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          expected_monthly_revenue?: number | null
          founder_name?: string | null
          gst_applicable?: boolean | null
          id?: string
          important_reminder?: string | null
          is_deleted?: boolean
          media_buyer?: string | null
          metric_used?: string | null
          minimum_guarantee?: number | null
          monthly_retainer_amount?: number | null
          niche?: string | null
          notes?: string | null
          payment_risk?: string | null
          phone?: string | null
          revenue_base?: string | null
          revenue_model: string
          revenue_share_percentage?: number | null
          revenue_tracking_source?: string | null
          revenue_tracking_sources?: string[] | null
          sales_owner?: string | null
          settlement_frequency?: string | null
          setup_delivery_deadline?: string | null
          setup_fee?: number | null
          setup_payment_status?: string | null
          setup_scope?: string | null
          social_url?: string | null
          start_date?: string | null
          status?: string
          trial_conversion_plan?: string | null
          trial_duration?: string | null
          trial_end_date?: string | null
          trial_fee?: number | null
          trigger_target_value?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          account_owner?: string | null
          assigned_manager?: string | null
          base_retainer_amount?: number | null
          billing_cycle?: string | null
          billing_date?: string | null
          billing_notes?: string | null
          bonus_amount?: number | null
          bonus_trigger?: string | null
          bonus_type?: string | null
          business_category?: string | null
          client_name?: string
          client_risk?: string | null
          client_stage?: string | null
          collection_due_date?: string | null
          created_at?: string
          created_by?: string | null
          custom_revenue_terms?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          expected_monthly_revenue?: number | null
          founder_name?: string | null
          gst_applicable?: boolean | null
          id?: string
          important_reminder?: string | null
          is_deleted?: boolean
          media_buyer?: string | null
          metric_used?: string | null
          minimum_guarantee?: number | null
          monthly_retainer_amount?: number | null
          niche?: string | null
          notes?: string | null
          payment_risk?: string | null
          phone?: string | null
          revenue_base?: string | null
          revenue_model?: string
          revenue_share_percentage?: number | null
          revenue_tracking_source?: string | null
          revenue_tracking_sources?: string[] | null
          sales_owner?: string | null
          settlement_frequency?: string | null
          setup_delivery_deadline?: string | null
          setup_fee?: number | null
          setup_payment_status?: string | null
          setup_scope?: string | null
          social_url?: string | null
          start_date?: string | null
          status?: string
          trial_conversion_plan?: string | null
          trial_duration?: string | null
          trial_end_date?: string | null
          trial_fee?: number | null
          trigger_target_value?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      marketizers_collection_followups: {
        Row: {
          amount_recovered: number
          client_id: string
          communication_channel: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          followup_owner: string | null
          id: string
          is_deleted: boolean
          last_followup_date: string | null
          month: string
          monthly_entry_id: string | null
          next_followup_date: string | null
          notes: string | null
          pending_amount: number
          priority: string
          promise_to_pay_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_recovered?: number
          client_id: string
          communication_channel?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          followup_owner?: string | null
          id?: string
          is_deleted?: boolean
          last_followup_date?: string | null
          month: string
          monthly_entry_id?: string | null
          next_followup_date?: string | null
          notes?: string | null
          pending_amount?: number
          priority?: string
          promise_to_pay_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_recovered?: number
          client_id?: string
          communication_channel?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          followup_owner?: string | null
          id?: string
          is_deleted?: boolean
          last_followup_date?: string | null
          month?: string
          monthly_entry_id?: string | null
          next_followup_date?: string | null
          notes?: string | null
          pending_amount?: number
          priority?: string
          promise_to_pay_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_collection_followups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketizers_collection_followups_monthly_entry_id_fkey"
            columns: ["monthly_entry_id"]
            isOneToOne: false
            referencedRelation: "marketizers_monthly_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_expense_entries: {
        Row: {
          amount: number
          amount_in_inr: number
          category: string
          client_id: string | null
          conversion_rate: number | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          employee_name: string | null
          entry_status: string
          expense_date: string | null
          expense_name: string
          expense_scope: string
          expense_type: string
          freelancer_name: string | null
          id: string
          impact_type: string | null
          is_deleted: boolean
          is_generated_from_recurring: boolean
          is_shared_expense: boolean
          metadata: Json
          month: string
          notes: string | null
          payment_day: number | null
          payment_handler: string | null
          payment_mode: string | null
          payment_status: string
          platform: string | null
          purpose: string | null
          receipt_status: string | null
          receipt_url: string | null
          recurring_period_end_day: number | null
          recurring_period_start_day: number | null
          role: string | null
          template_id: string | null
          updated_at: string
          vendor_or_tool: string | null
        }
        Insert: {
          amount?: number
          amount_in_inr?: number
          category: string
          client_id?: string | null
          conversion_rate?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          employee_name?: string | null
          entry_status?: string
          expense_date?: string | null
          expense_name: string
          expense_scope?: string
          expense_type?: string
          freelancer_name?: string | null
          id?: string
          impact_type?: string | null
          is_deleted?: boolean
          is_generated_from_recurring?: boolean
          is_shared_expense?: boolean
          metadata?: Json
          month: string
          notes?: string | null
          payment_day?: number | null
          payment_handler?: string | null
          payment_mode?: string | null
          payment_status?: string
          platform?: string | null
          purpose?: string | null
          receipt_status?: string | null
          receipt_url?: string | null
          recurring_period_end_day?: number | null
          recurring_period_start_day?: number | null
          role?: string | null
          template_id?: string | null
          updated_at?: string
          vendor_or_tool?: string | null
        }
        Update: {
          amount?: number
          amount_in_inr?: number
          category?: string
          client_id?: string | null
          conversion_rate?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          employee_name?: string | null
          entry_status?: string
          expense_date?: string | null
          expense_name?: string
          expense_scope?: string
          expense_type?: string
          freelancer_name?: string | null
          id?: string
          impact_type?: string | null
          is_deleted?: boolean
          is_generated_from_recurring?: boolean
          is_shared_expense?: boolean
          metadata?: Json
          month?: string
          notes?: string | null
          payment_day?: number | null
          payment_handler?: string | null
          payment_mode?: string | null
          payment_status?: string
          platform?: string | null
          purpose?: string | null
          receipt_status?: string | null
          receipt_url?: string | null
          recurring_period_end_day?: number | null
          recurring_period_start_day?: number | null
          role?: string | null
          template_id?: string | null
          updated_at?: string
          vendor_or_tool?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_expense_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketizers_expense_entries_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "marketizers_expense_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_expense_master_options: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_deleted: boolean
          label: string
          metadata: Json
          option_type: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean
          label: string
          metadata?: Json
          option_type: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean
          label?: string
          metadata?: Json
          option_type?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketizers_expense_monthly_closures: {
        Row: {
          client_specific_expenses: number
          company_wide_expenses: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          is_locked: boolean
          locked_at: string | null
          locked_by: string | null
          missing_receipts_count: number
          month: string
          notes: string | null
          one_time_expenses: number
          pending_expenses: number
          recurring_expenses: number
          review_items_count: number
          team_salary_expenses: number
          tools_expenses: number
          total_expenses: number
          updated_at: string
        }
        Insert: {
          client_specific_expenses?: number
          company_wide_expenses?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          missing_receipts_count?: number
          month: string
          notes?: string | null
          one_time_expenses?: number
          pending_expenses?: number
          recurring_expenses?: number
          review_items_count?: number
          team_salary_expenses?: number
          tools_expenses?: number
          total_expenses?: number
          updated_at?: string
        }
        Update: {
          client_specific_expenses?: number
          company_wide_expenses?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          missing_receipts_count?: number
          month?: string
          notes?: string | null
          one_time_expenses?: number
          pending_expenses?: number
          recurring_expenses?: number
          review_items_count?: number
          team_salary_expenses?: number
          tools_expenses?: number
          total_expenses?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketizers_expense_templates: {
        Row: {
          amount: number
          amount_in_inr: number
          cancellation_reason: string | null
          category: string
          client_id: string | null
          conversion_rate: number | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          employee_name: string | null
          expense_name: string
          expense_scope: string
          expense_type: string
          freelancer_name: string | null
          id: string
          impact_type: string | null
          is_deleted: boolean
          is_recurring: boolean
          is_shared_expense: boolean
          metadata: Json
          notes: string | null
          payment_day: number | null
          payment_handler: string | null
          payment_mode: string | null
          platform: string | null
          purpose: string | null
          receipt_status: string | null
          recurring_end_month: string | null
          recurring_period_end_day: number
          recurring_period_start_day: number
          recurring_start_month: string | null
          review_status: string
          role: string | null
          template_status: string
          updated_at: string
          vendor_or_tool: string | null
        }
        Insert: {
          amount?: number
          amount_in_inr?: number
          cancellation_reason?: string | null
          category: string
          client_id?: string | null
          conversion_rate?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          employee_name?: string | null
          expense_name: string
          expense_scope?: string
          expense_type?: string
          freelancer_name?: string | null
          id?: string
          impact_type?: string | null
          is_deleted?: boolean
          is_recurring?: boolean
          is_shared_expense?: boolean
          metadata?: Json
          notes?: string | null
          payment_day?: number | null
          payment_handler?: string | null
          payment_mode?: string | null
          platform?: string | null
          purpose?: string | null
          receipt_status?: string | null
          recurring_end_month?: string | null
          recurring_period_end_day?: number
          recurring_period_start_day?: number
          recurring_start_month?: string | null
          review_status?: string
          role?: string | null
          template_status?: string
          updated_at?: string
          vendor_or_tool?: string | null
        }
        Update: {
          amount?: number
          amount_in_inr?: number
          cancellation_reason?: string | null
          category?: string
          client_id?: string | null
          conversion_rate?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          employee_name?: string | null
          expense_name?: string
          expense_scope?: string
          expense_type?: string
          freelancer_name?: string | null
          id?: string
          impact_type?: string | null
          is_deleted?: boolean
          is_recurring?: boolean
          is_shared_expense?: boolean
          metadata?: Json
          notes?: string | null
          payment_day?: number | null
          payment_handler?: string | null
          payment_mode?: string | null
          platform?: string | null
          purpose?: string | null
          receipt_status?: string | null
          recurring_end_month?: string | null
          recurring_period_end_day?: number
          recurring_period_start_day?: number
          recurring_start_month?: string | null
          review_status?: string
          role?: string | null
          template_status?: string
          updated_at?: string
          vendor_or_tool?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_expense_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_ledger_categories: {
        Row: {
          category_type: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketizers_ledger_import_mapping_templates: {
        Row: {
          client_id: string | null
          created_at: string
          default_row_type: string
          headers: Json
          id: string
          mapping: Json
          name: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          default_row_type?: string
          headers: Json
          id?: string
          mapping: Json
          name: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          default_row_type?: string
          headers?: Json
          id?: string
          mapping?: Json
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_ledger_import_mapping_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_ledger_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          source_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          source_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketizers_monthly_entries: {
        Row: {
          account_status: string | null
          ad_spend: number
          amount_collected: number
          amount_pending: number
          client_gross_revenue: number
          client_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          is_locked: boolean
          leads_generated: number
          ledger_pushed_amount: number | null
          ledger_pushed_at: string | null
          ledger_pushed_by: string | null
          ledger_source: string | null
          locked_at: string | null
          locked_by: string | null
          marketizers_revenue: number
          month: string
          notes: string | null
          qualified_leads: number
          revenue_model: string | null
          sales_closed: number
          total_direct_expense: number
          updated_at: string
        }
        Insert: {
          account_status?: string | null
          ad_spend?: number
          amount_collected?: number
          amount_pending?: number
          client_gross_revenue?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          leads_generated?: number
          ledger_pushed_amount?: number | null
          ledger_pushed_at?: string | null
          ledger_pushed_by?: string | null
          ledger_source?: string | null
          locked_at?: string | null
          locked_by?: string | null
          marketizers_revenue?: number
          month: string
          notes?: string | null
          qualified_leads?: number
          revenue_model?: string | null
          sales_closed?: number
          total_direct_expense?: number
          updated_at?: string
        }
        Update: {
          account_status?: string | null
          ad_spend?: number
          amount_collected?: number
          amount_pending?: number
          client_gross_revenue?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          leads_generated?: number
          ledger_pushed_amount?: number | null
          ledger_pushed_at?: string | null
          ledger_pushed_by?: string | null
          ledger_source?: string | null
          locked_at?: string | null
          locked_by?: string | null
          marketizers_revenue?: number
          month?: string
          notes?: string | null
          qualified_leads?: number
          revenue_model?: string | null
          sales_closed?: number
          total_direct_expense?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_monthly_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketizers_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_quick_save_options: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          metadata: Json | null
          option_group: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          metadata?: Json | null
          option_group: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          metadata?: Json | null
          option_group?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      marketizers_roas_audience_segments: {
        Row: {
          created_at: string
          id: string
          segment_count: number | null
          segment_name: string
          segment_percentage: number | null
          session_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          segment_count?: number | null
          segment_name: string
          segment_percentage?: number | null
          session_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          segment_count?: number | null
          segment_name?: string
          segment_percentage?: number | null
          session_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketizers_roas_audience_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "marketizers_roas_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketizers_roas_import_mappings: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          event_type: string | null
          id: string
          is_deleted: boolean
          last_used_at: string | null
          mapping: Json
          template_name: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string | null
          id?: string
          is_deleted?: boolean
          last_used_at?: string | null
          mapping?: Json
          template_name: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string | null
          id?: string
          is_deleted?: boolean
          last_used_at?: string | null
          mapping?: Json
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketizers_roas_quick_save_options: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          metadata: Json
          option_group: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          metadata?: Json
          option_group: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          metadata?: Json
          option_group?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      marketizers_roas_sessions: {
        Row: {
          ad_spend: number
          campaign_date_from: string | null
          campaign_date_to: string | null
          campaign_name: string | null
          client_id: string | null
          client_name: string | null
          cpc: number | null
          cpl: number | null
          cpl_drop_percent: number | null
          cpm: number | null
          cpp: number | null
          created_at: string
          created_by: string | null
          ctr: number | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          event_dates: Json | null
          event_day_pattern: string | null
          event_name: string | null
          event_type: string | null
          final_purchase_conversion: number | null
          final_purchases: number
          final_revenue: number
          google_sheet_url: string | null
          heard_count: number | null
          id: string
          landing_page_views: number | null
          lead_drop_rate: number | null
          leads: number
          manual_revenue_override: number | null
          media_buyer_id: string | null
          media_buyer_name: string | null
          meta_ad_account: string | null
          notes: string | null
          offer_name: string | null
          offer_showup_count: number | null
          offer_showup_percent: number | null
          performance_health: string | null
          pnl: number | null
          product_final_value: number | null
          profit_per_lead: number | null
          revenue_per_lead: number | null
          roas: number | null
          sales_count: number | null
          showup_count: number | null
          showup_percent: number | null
          source_type: string | null
          token_amount: number | null
          token_purchases: number
          token_revenue: number
          total_revenue: number
          updated_at: string
        }
        Insert: {
          ad_spend?: number
          campaign_date_from?: string | null
          campaign_date_to?: string | null
          campaign_name?: string | null
          client_id?: string | null
          client_name?: string | null
          cpc?: number | null
          cpl?: number | null
          cpl_drop_percent?: number | null
          cpm?: number | null
          cpp?: number | null
          created_at?: string
          created_by?: string | null
          ctr?: number | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          event_dates?: Json | null
          event_day_pattern?: string | null
          event_name?: string | null
          event_type?: string | null
          final_purchase_conversion?: number | null
          final_purchases?: number
          final_revenue?: number
          google_sheet_url?: string | null
          heard_count?: number | null
          id?: string
          landing_page_views?: number | null
          lead_drop_rate?: number | null
          leads?: number
          manual_revenue_override?: number | null
          media_buyer_id?: string | null
          media_buyer_name?: string | null
          meta_ad_account?: string | null
          notes?: string | null
          offer_name?: string | null
          offer_showup_count?: number | null
          offer_showup_percent?: number | null
          performance_health?: string | null
          pnl?: number | null
          product_final_value?: number | null
          profit_per_lead?: number | null
          revenue_per_lead?: number | null
          roas?: number | null
          sales_count?: number | null
          showup_count?: number | null
          showup_percent?: number | null
          source_type?: string | null
          token_amount?: number | null
          token_purchases?: number
          token_revenue?: number
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          ad_spend?: number
          campaign_date_from?: string | null
          campaign_date_to?: string | null
          campaign_name?: string | null
          client_id?: string | null
          client_name?: string | null
          cpc?: number | null
          cpl?: number | null
          cpl_drop_percent?: number | null
          cpm?: number | null
          cpp?: number | null
          created_at?: string
          created_by?: string | null
          ctr?: number | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          event_dates?: Json | null
          event_day_pattern?: string | null
          event_name?: string | null
          event_type?: string | null
          final_purchase_conversion?: number | null
          final_purchases?: number
          final_revenue?: number
          google_sheet_url?: string | null
          heard_count?: number | null
          id?: string
          landing_page_views?: number | null
          lead_drop_rate?: number | null
          leads?: number
          manual_revenue_override?: number | null
          media_buyer_id?: string | null
          media_buyer_name?: string | null
          meta_ad_account?: string | null
          notes?: string | null
          offer_name?: string | null
          offer_showup_count?: number | null
          offer_showup_percent?: number | null
          performance_health?: string | null
          pnl?: number | null
          product_final_value?: number | null
          profit_per_lead?: number | null
          revenue_per_lead?: number | null
          roas?: number | null
          sales_count?: number | null
          showup_count?: number | null
          showup_percent?: number | null
          source_type?: string | null
          token_amount?: number | null
          token_purchases?: number
          token_revenue?: number
          total_revenue?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketizers_shared_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          expense_date: string | null
          id: string
          is_deleted: boolean
          month: string
          paid_by: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          is_deleted?: boolean
          month: string
          paid_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          is_deleted?: boolean
          month?: string
          paid_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketizers_targets: {
        Row: {
          collection_target: number
          created_at: string
          created_by: string | null
          id: string
          month: string
          profit_target: number
          revenue_target: number
          updated_at: string
        }
        Insert: {
          collection_target?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          profit_target?: number
          revenue_target?: number
          updated_at?: string
        }
        Update: {
          collection_target?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          profit_target?: number
          revenue_target?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketizers_team_salary_expenses: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          month: string
          notes: string | null
          payment_date: string | null
          payment_status: string
          role: string | null
          salary_amount: number
          team_member_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          month: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          role?: string | null
          salary_amount?: number
          team_member_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          month?: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          role?: string | null
          salary_amount?: number
          team_member_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          disabled_at: string | null
          display_name: string | null
          email: string | null
          id: string
          invite_sent_at: string | null
          invite_status: string
          last_login_at: string | null
          password_reset_sent_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          invite_sent_at?: string | null
          invite_status?: string
          last_login_at?: string | null
          password_reset_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          invite_sent_at?: string | null
          invite_status?: string
          last_login_at?: string | null
          password_reset_sent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qa_autopilot_run_logs: {
        Row: {
          cleanup_status: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          report_json: Json
          run_by: string | null
          run_type: string
          started_at: string
          status: string
          trigger_source: string | null
        }
        Insert: {
          cleanup_status?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          report_json?: Json
          run_by?: string | null
          run_type: string
          started_at?: string
          status: string
          trigger_source?: string | null
        }
        Update: {
          cleanup_status?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          report_json?: Json
          run_by?: string | null
          run_type?: string
          started_at?: string
          status?: string
          trigger_source?: string | null
        }
        Relationships: []
      }
      quick_save_entries: {
        Row: {
          created_at: string
          created_by: string | null
          field_key: string
          id: string
          is_active: boolean
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_key: string
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_key?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      recurring_daily_completions: {
        Row: {
          completed_at: string
          completed_by_name: string | null
          completed_by_team_member_id: string | null
          completed_by_user_id: string | null
          completion_date: string
          created_at: string
          id: string
          note: string | null
          proof_url: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string
          completed_by_name?: string | null
          completed_by_team_member_id?: string | null
          completed_by_user_id?: string | null
          completion_date: string
          created_at?: string
          id?: string
          note?: string | null
          proof_url?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string
          completed_by_name?: string | null
          completed_by_team_member_id?: string | null
          completed_by_user_id?: string | null
          completion_date?: string
          created_at?: string
          id?: string
          note?: string | null
          proof_url?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_daily_completions_completed_by_team_member_id_fkey"
            columns: ["completed_by_team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_daily_completions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_daily_email_logs: {
        Row: {
          created_at: string
          email_body: string
          email_status: string
          email_subject: string
          email_to: string
          email_type: string
          error_message: string | null
          id: string
          points_date: string
          provider_message_id: string | null
          sent_at: string | null
          sent_by: string | null
          team_member_id: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_body: string
          email_status: string
          email_subject: string
          email_to: string
          email_type: string
          error_message?: string | null
          id?: string
          points_date: string
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          team_member_id?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_body?: string
          email_status?: string
          email_subject?: string
          email_to?: string
          email_type?: string
          error_message?: string | null
          id?: string
          points_date?: string
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          team_member_id?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_daily_email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_daily_points_ledger: {
        Row: {
          completion_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          points: number
          points_date: string
          reason: string | null
          team_member_id: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          completion_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          points: number
          points_date?: string
          reason?: string | null
          team_member_id?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          completion_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          points?: number
          points_date?: string
          reason?: string | null
          team_member_id?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_daily_points_ledger_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "recurring_daily_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_daily_points_ledger_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_daily_tasks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          due_time: string | null
          id: string
          negative_points_if_missed: number
          points_on_completion: number
          task_doer_email: string | null
          task_doer_name: string
          task_doer_team_member_id: string | null
          task_doer_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_time?: string | null
          id?: string
          negative_points_if_missed?: number
          points_on_completion?: number
          task_doer_email?: string | null
          task_doer_name: string
          task_doer_team_member_id?: string | null
          task_doer_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_time?: string | null
          id?: string
          negative_points_if_missed?: number
          points_on_completion?: number
          task_doer_email?: string | null
          task_doer_name?: string
          task_doer_team_member_id?: string | null
          task_doer_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_daily_tasks_task_doer_team_member_id_fkey"
            columns: ["task_doer_team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          action: string
          created_at: string
          id: string
          task_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          task_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_missed_email_logs: {
        Row: {
          created_at: string
          email_body: string
          email_status: string
          email_subject: string
          email_to: string
          email_type: string
          error_message: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          sent_at: string | null
          sent_by: string | null
          task_id: string
          team_member_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email_body: string
          email_status: string
          email_subject: string
          email_to: string
          email_type: string
          error_message?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          task_id: string
          team_member_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email_body?: string
          email_status?: string
          email_subject?: string
          email_to?: string
          email_type?: string
          error_message?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          task_id?: string
          team_member_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_missed_email_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "delegation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_missed_points_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          period_date: string
          points: number
          reason: string | null
          task_id: string
          team_member_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          period_date?: string
          points: number
          reason?: string | null
          task_id: string
          team_member_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          period_date?: string
          points?: number
          reason?: string | null
          task_id?: string
          team_member_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_missed_points_ledger_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "delegation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_submissions: {
        Row: {
          created_at: string
          id: string
          note: string | null
          submission_url: string
          submitted_by: string
          submitted_by_name: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          submission_url: string
          submitted_by: string
          submitted_by_name?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          submission_url?: string
          submitted_by?: string
          submitted_by_name?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_initials: string | null
          assigned_name: string | null
          assigned_to: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          due_date: string | null
          id: string
          is_archived: boolean
          note: string | null
          priority: string
          sort_order: number
          status: string
          tag: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_initials?: string | null
          assigned_name?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          note?: string | null
          priority?: string
          sort_order?: number
          status?: string
          tag?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_initials?: string | null
          assigned_name?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          note?: string | null
          priority?: string
          sort_order?: number
          status?: string
          tag?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_access_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          details: Json
          id: string
          target_email: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_email: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_email?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      user_brand_access: {
        Row: {
          access_level: string
          brand_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          brand_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          brand_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_brand_access_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "gwv_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          brand_ids: string[] | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          invited_by: string | null
          notes: string | null
          roles: string[]
          status: string
        }
        Insert: {
          accepted_at?: string | null
          brand_ids?: string[] | null
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          invited_by?: string | null
          notes?: string | null
          roles?: string[]
          status?: string
        }
        Update: {
          accepted_at?: string | null
          brand_ids?: string[] | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          notes?: string | null
          roles?: string[]
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vc_google_sheet_connections: {
        Row: {
          connection_name: string
          created_at: string
          created_by: string | null
          date_column: string | null
          destination_module: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          sheet_name: string | null
          sheet_url: string
          spreadsheet_id: string
          status: string
          updated_at: string
        }
        Insert: {
          connection_name: string
          created_at?: string
          created_by?: string | null
          date_column?: string | null
          destination_module?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          sheet_name?: string | null
          sheet_url: string
          spreadsheet_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          connection_name?: string
          created_at?: string
          created_by?: string | null
          date_column?: string | null
          destination_module?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          sheet_name?: string | null
          sheet_url?: string
          spreadsheet_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vc_google_sheet_sync_runs: {
        Row: {
          connection_id: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          row_count: number | null
          started_at: string
          status: string
          synced_by: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          row_count?: number | null
          started_at?: string
          status?: string
          synced_by?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          row_count?: number | null
          started_at?: string
          status?: string
          synced_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vc_google_sheet_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "vc_google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      video_editor_daily_kpi: {
        Row: {
          backed_up_eod: boolean
          blockers: string | null
          committed_pieces: number
          created_at: string
          created_by: string | null
          extra: Json
          finish_gate_passed: boolean
          good_day: boolean
          id: string
          max_revision_rounds: number
          report_date: string
          shipped_finished: number
          team_member_id: string
          updated_at: string
        }
        Insert: {
          backed_up_eod?: boolean
          blockers?: string | null
          committed_pieces?: number
          created_at?: string
          created_by?: string | null
          extra?: Json
          finish_gate_passed?: boolean
          good_day?: boolean
          id?: string
          max_revision_rounds?: number
          report_date: string
          shipped_finished?: number
          team_member_id: string
          updated_at?: string
        }
        Update: {
          backed_up_eod?: boolean
          blockers?: string | null
          committed_pieces?: number
          created_at?: string
          created_by?: string | null
          extra?: Json
          finish_gate_passed?: boolean
          good_day?: boolean
          id?: string
          max_revision_rounds?: number
          report_date?: string
          shipped_finished?: number
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_editor_daily_kpi_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "gwv_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      video_editor_kpi_config: {
        Row: {
          cn_green: number
          cn_label: string
          cn_red: number
          cn_super_green: number
          cn_target: number
          created_at: string
          created_by: string | null
          daily_commit_target: number
          fields: Json
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          cn_green?: number
          cn_label?: string
          cn_red?: number
          cn_super_green?: number
          cn_target?: number
          created_at?: string
          created_by?: string | null
          daily_commit_target?: number
          fields?: Json
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          cn_green?: number
          cn_label?: string
          cn_red?: number
          cn_super_green?: number
          cn_target?: number
          created_at?: string
          created_by?: string | null
          daily_commit_target?: number
          fields?: Json
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dt_assignee_is_self: {
        Args: { _assignee_id: string; _assignee_team_member_id: string }
        Returns: boolean
      }
      ve_owns_team_member: {
        Args: { _team_member_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "finance_manager"
        | "brand_manager"
        | "operator"
        | "team_member"
        | "media_buyer"
        | "hr"
      delegation_task_type: "recurring_daily" | "standup" | "ad_hoc"
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
        "admin",
        "finance_manager",
        "brand_manager",
        "operator",
        "team_member",
        "media_buyer",
        "hr",
      ],
      delegation_task_type: ["recurring_daily", "standup", "ad_hoc"],
    },
  },
} as const
