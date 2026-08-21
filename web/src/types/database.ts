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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_ledger: {
        Row: {
          consent_version: string
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          organization_id: string
          patient_id: string
          profile_id: string
          purpose: string
          revoked_at: string | null
          revoked_by: string | null
          source: string
        }
        Insert: {
          consent_version?: string
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          patient_id: string
          profile_id: string
          purpose: string
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
        }
        Update: {
          consent_version?: string
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          profile_id?: string
          purpose?: string
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_ledger_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_ledger_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_ledger_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "consent_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_ledger_profile_org_fkey"
            columns: ["profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "consent_ledger_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_agenda: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_communal: boolean
          local_date: string
          organization_id: string
          patient_id: string | null
          start_time: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_communal?: boolean
          local_date: string
          organization_id: string
          patient_id?: string | null
          start_time: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_communal?: boolean
          local_date?: string
          organization_id?: string
          patient_id?: string | null
          start_time?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_agenda_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      daily_agenda_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_communal: boolean
          organization_id: string
          start_time: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_communal?: boolean
          organization_id: string
          start_time: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_communal?: boolean
          organization_id?: string
          start_time?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_agenda_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          ai_generated_at: string | null
          ai_model: string | null
          ai_prompt_version: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_ai_generated: boolean
          organization_id: string
          patient_id: string
          processed_data: Json | null
          raw_data: Json | null
          typ_logu: Database["public"]["Enums"]["log_type"]
          updated_at: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_model?: string | null
          ai_prompt_version?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_ai_generated?: boolean
          organization_id: string
          patient_id: string
          processed_data?: Json | null
          raw_data?: Json | null
          typ_logu: Database["public"]["Enums"]["log_type"]
          updated_at?: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_model?: string | null
          ai_prompt_version?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_ai_generated?: boolean
          organization_id?: string
          patient_id?: string
          processed_data?: Json | null
          raw_data?: Json | null
          typ_logu?: Database["public"]["Enums"]["log_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          ai_model: string | null
          ai_prompt_version: string | null
          approved_at: string | null
          approved_by: string | null
          content: string | null
          created_at: string
          generated_at: string | null
          id: string
          local_date: string
          organization_id: string
          patient_id: string
          published_at: string | null
          source_log_count: number
          status: Database["public"]["Enums"]["daily_report_status"]
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          local_date: string
          organization_id: string
          patient_id: string
          published_at?: string | null
          source_log_count?: number
          status?: Database["public"]["Enums"]["daily_report_status"]
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          local_date?: string
          organization_id?: string
          patient_id?: string
          published_at?: string | null
          source_log_count?: number
          status?: Database["public"]["Enums"]["daily_report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      family_connections: {
        Row: {
          created_at: string
          id: string
          is_primary_contact: boolean
          organization_id: string
          patient_id: string
          profile_id: string
          relationship: string | null
          revoked_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary_contact?: boolean
          organization_id: string
          patient_id: string
          profile_id: string
          relationship?: string | null
          revoked_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary_contact?: boolean
          organization_id?: string
          patient_id?: string
          profile_id?: string
          relationship?: string | null
          revoked_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_connections_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_connections_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "family_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_connections_profile_org_fkey"
            columns: ["profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      family_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_token: string
          invited_by_user_id: string
          organization_id: string
          patient_id: string
          relationship: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by_user_id: string
          organization_id: string
          patient_id: string
          relationship?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by_user_id?: string
          organization_id?: string
          patient_id?: string
          relationship?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invitations_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invitations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invitations_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      family_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          patient_id: string
          read_at: string | null
          sender_profile_id: string
          status: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          patient_id: string
          read_at?: string | null
          sender_profile_id: string
          status?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          patient_id?: string
          read_at?: string | null
          sender_profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_messages_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "family_messages_sender_org_fkey"
            columns: ["sender_profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempted_at: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          daily_report_id: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          organization_id: string
          patient_id: string
          profile_id: string
          provider: string | null
          provider_message_id: string | null
          recipient: string
          status: Database["public"]["Enums"]["notification_delivery_status"]
        }
        Insert: {
          attempted_at?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          daily_report_id: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          organization_id: string
          patient_id: string
          profile_id: string
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          status?: Database["public"]["Enums"]["notification_delivery_status"]
        }
        Update: {
          attempted_at?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          daily_report_id?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          profile_id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          status?: Database["public"]["Enums"]["notification_delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "notification_deliveries_profile_org_fkey"
            columns: ["profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "notification_deliveries_report_org_fkey"
            columns: ["daily_report_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "notification_deliveries_report_org_fkey"
            columns: ["daily_report_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "family_daily_reports"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "notification_deliveries_report_patient_fkey"
            columns: ["daily_report_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id", "patient_id"]
          },
          {
            foreignKeyName: "notification_deliveries_report_patient_fkey"
            columns: ["daily_report_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "family_daily_reports"
            referencedColumns: ["id", "patient_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          is_enabled: boolean
          organization_id: string
          patient_id: string
          profile_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id: string
          patient_id: string
          profile_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id?: string
          patient_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_org_fkey"
            columns: ["profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          settings_json: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings_json?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      patient_staff_assignments: {
        Row: {
          assigned_role: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          patient_id: string
          profile_id: string
        }
        Insert: {
          assigned_role: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          patient_id: string
          profile_id: string
        }
        Update: {
          assigned_role?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_staff_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_staff_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_staff_assignments_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "patient_staff_assignments_profile_org_fkey"
            columns: ["profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      patients: {
        Row: {
          archived_at: string | null
          archived_reason: string | null
          created_at: string
          first_name: string
          id: string
          last_name_initial: string
          organization_id: string
          pesel_hash: string | null
          room: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_reason?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name_initial: string
          organization_id: string
          pesel_hash?: string | null
          room?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_reason?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name_initial?: string
          organization_id?: string
          pesel_hash?: string | null
          room?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          organization_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_access_logs: {
        Row: {
          accessed_at: string
          action: string
          actor_id: string | null
          id: string
          organization_id: string
          patient_id: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          accessed_at?: string
          action: string
          actor_id?: string | null
          id?: string
          organization_id: string
          patient_id?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          accessed_at?: string
          action?: string
          actor_id?: string | null
          id?: string
          organization_id?: string
          patient_id?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_access_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_access_logs_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      voice_conversation_turns: {
        Row: {
          author_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["voice_turn_role"]
        }
        Insert: {
          author_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["voice_turn_role"]
        }
        Update: {
          author_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["voice_turn_role"]
        }
        Relationships: [
          {
            foreignKeyName: "voice_conversation_turns_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_conversation_turns_conv_org_fkey"
            columns: ["conversation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "voice_conversations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "voice_conversation_turns_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "voice_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_conversation_turns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_conversations: {
        Row: {
          created_at: string
          id: string
          last_assistant_question: string | null
          local_date: string
          missing_contexts: Database["public"]["Enums"]["voice_missing_context"][]
          organization_id: string
          patient_id: string
          status: Database["public"]["Enums"]["voice_conversation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_assistant_question?: string | null
          local_date: string
          missing_contexts?: Database["public"]["Enums"]["voice_missing_context"][]
          organization_id: string
          patient_id: string
          status?: Database["public"]["Enums"]["voice_conversation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_assistant_question?: string | null
          local_date?: string
          missing_contexts?: Database["public"]["Enums"]["voice_missing_context"][]
          organization_id?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["voice_conversation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_conversations_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      voice_draft_notes: {
        Row: {
          author_id: string
          clinical_handling: Database["public"]["Enums"]["voice_clinical_handling"]
          conversation_id: string | null
          created_at: string
          family_safe_partial: string | null
          id: string
          local_date: string
          organization_id: string
          patient_id: string
          staff_internal_notes: string
          status: Database["public"]["Enums"]["voice_draft_status"]
          transcript: string
          turn_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          clinical_handling?: Database["public"]["Enums"]["voice_clinical_handling"]
          conversation_id?: string | null
          created_at?: string
          family_safe_partial?: string | null
          id?: string
          local_date: string
          organization_id: string
          patient_id: string
          staff_internal_notes?: string
          status?: Database["public"]["Enums"]["voice_draft_status"]
          transcript: string
          turn_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          clinical_handling?: Database["public"]["Enums"]["voice_clinical_handling"]
          conversation_id?: string | null
          created_at?: string
          family_safe_partial?: string | null
          id?: string
          local_date?: string
          organization_id?: string
          patient_id?: string
          staff_internal_notes?: string
          status?: Database["public"]["Enums"]["voice_draft_status"]
          transcript?: string
          turn_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_draft_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_draft_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "voice_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_draft_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_draft_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_draft_notes_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "voice_draft_notes_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "voice_conversation_turns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      family_daily_reports: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          is_ai_generated: boolean | null
          local_date: string | null
          organization_id: string | null
          patient_id: string | null
          published_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_patient_org_fkey"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_old_voice_drafts: { Args: never; Returns: Json }
      conversation_patient_is_active: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      family_can_access_patient: {
        Args: { p_patient_id: string }
        Returns: boolean
      }
      jwt_privileged_aal2_ok: { Args: never; Returns: boolean }
      log_security_access: {
        Args: {
          p_action: string
          p_patient_id: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: string
      }
      patient_is_active: { Args: { p_patient_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "superadmin" | "org_admin" | "nurse" | "family" | "iot_device"
      daily_report_status:
        | "draft"
        | "generating"
        | "ready"
        | "approved"
        | "published"
        | "failed"
      log_type: "voice_note" | "hardware_sensor" | "ai_report"
      notification_channel: "sms" | "email"
      notification_delivery_status: "pending" | "sent" | "delivered" | "failed"
      voice_clinical_handling: "staff_internal" | "redact"
      voice_conversation_status:
        | "active"
        | "awaiting_staff"
        | "ready_to_merge"
        | "merged"
        | "abandoned"
      voice_draft_status:
        | "open"
        | "awaiting_staff"
        | "ready_to_merge"
        | "merged"
        | "discarded"
      voice_missing_context: "mood" | "meal" | "sleep" | "activity"
      voice_turn_role: "staff" | "assistant"
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
      app_role: ["superadmin", "org_admin", "nurse", "family", "iot_device"],
      daily_report_status: [
        "draft",
        "generating",
        "ready",
        "approved",
        "published",
        "failed",
      ],
      log_type: ["voice_note", "hardware_sensor", "ai_report"],
      notification_channel: ["sms", "email"],
      notification_delivery_status: ["pending", "sent", "delivered", "failed"],
      voice_clinical_handling: ["staff_internal", "redact"],
      voice_conversation_status: [
        "active",
        "awaiting_staff",
        "ready_to_merge",
        "merged",
        "abandoned",
      ],
      voice_draft_status: [
        "open",
        "awaiting_staff",
        "ready_to_merge",
        "merged",
        "discarded",
      ],
      voice_missing_context: ["mood", "meal", "sleep", "activity"],
      voice_turn_role: ["staff", "assistant"],
    },
  },
} as const
