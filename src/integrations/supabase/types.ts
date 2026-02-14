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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          blocked: boolean
          business_score: number | null
          created_at: string | null
          decision_type: string
          description: string
          domain_decisional: number | null
          domain_emotional: number | null
          domain_energetic: number | null
          domain_financial: number | null
          domain_operational: number | null
          domain_relational: number | null
          financial_score: number | null
          full_result: Json | null
          guidance_text: string | null
          human_score: number | null
          id: string
          impact: string
          overall_score: number
          pipeline_id: string
          relational_score: number | null
          resources_required: string | null
          reversibility: string
          state_id: string
          state_severity: number
          urgency: string
          user_id: string
          verdict: string
        }
        Insert: {
          blocked?: boolean
          business_score?: number | null
          created_at?: string | null
          decision_type: string
          description: string
          domain_decisional?: number | null
          domain_emotional?: number | null
          domain_energetic?: number | null
          domain_financial?: number | null
          domain_operational?: number | null
          domain_relational?: number | null
          financial_score?: number | null
          full_result?: Json | null
          guidance_text?: string | null
          human_score?: number | null
          id?: string
          impact: string
          overall_score: number
          pipeline_id: string
          relational_score?: number | null
          resources_required?: string | null
          reversibility: string
          state_id: string
          state_severity: number
          urgency: string
          user_id: string
          verdict: string
        }
        Update: {
          blocked?: boolean
          business_score?: number | null
          created_at?: string | null
          decision_type?: string
          description?: string
          domain_decisional?: number | null
          domain_emotional?: number | null
          domain_energetic?: number | null
          domain_financial?: number | null
          domain_operational?: number | null
          domain_relational?: number | null
          financial_score?: number | null
          full_result?: Json | null
          guidance_text?: string | null
          human_score?: number | null
          id?: string
          impact?: string
          overall_score?: number
          pipeline_id?: string
          relational_score?: number | null
          resources_required?: string | null
          reversibility?: string
          state_id?: string
          state_severity?: number
          urgency?: string
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_actions: {
        Row: {
          action_index: number
          action_text: string
          completed: boolean
          completed_at: string | null
          created_at: string | null
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          action_index: number
          action_text: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string | null
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          action_index?: number
          action_text?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string | null
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_actions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "readiness_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string | null
          id: string
          name: string | null
          onboarding_completed: boolean | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          id: string
          name?: string | null
          onboarding_completed?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          onboarding_completed?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      readiness_plans: {
        Row: {
          actions: Json
          actions_completed: number
          actions_total: number
          created_at: string | null
          decision_id: string
          id: string
          primary_bottleneck: Json
          reevaluated: boolean
          reevaluated_at: string | null
          reevaluation_triggers: Json
          reevaluation_verdict: string | null
          secondary_bottleneck: Json | null
          status: string
          structural_reason: string
          timeline: string | null
          user_id: string
        }
        Insert: {
          actions: Json
          actions_completed?: number
          actions_total: number
          created_at?: string | null
          decision_id: string
          id?: string
          primary_bottleneck: Json
          reevaluated?: boolean
          reevaluated_at?: string | null
          reevaluation_triggers: Json
          reevaluation_verdict?: string | null
          secondary_bottleneck?: Json | null
          status?: string
          structural_reason: string
          timeline?: string | null
          user_id: string
        }
        Update: {
          actions?: Json
          actions_completed?: number
          actions_total?: number
          created_at?: string | null
          decision_id?: string
          id?: string
          primary_bottleneck?: Json
          reevaluated?: boolean
          reevaluated_at?: string | null
          reevaluation_triggers?: Json
          reevaluation_verdict?: string | null
          secondary_bottleneck?: Json | null
          status?: string
          structural_reason?: string
          timeline?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_plans_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      state_classifications: {
        Row: {
          clarity: number
          classification_confidence: number
          confidence: number
          created_at: string | null
          energy: number
          id: string
          load: number
          overall_score: number
          state_id: string
          state_label: string
          state_severity: number
          stress: number
          user_id: string
        }
        Insert: {
          clarity: number
          classification_confidence: number
          confidence: number
          created_at?: string | null
          energy: number
          id?: string
          load: number
          overall_score: number
          state_id: string
          state_label: string
          state_severity: number
          stress: number
          user_id: string
        }
        Update: {
          clarity?: number
          classification_confidence?: number
          confidence?: number
          created_at?: string | null
          energy?: number
          id?: string
          load?: number
          overall_score?: number
          state_id?: string
          state_label?: string
          state_severity?: number
          stress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_classifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          id: string
          key: string
          source: string | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          category: string
          confidence?: number | null
          created_at?: string
          id?: string
          key: string
          source?: string | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          id?: string
          key?: string
          source?: string | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_dashboard_stats: {
        Row: {
          avg_score: number | null
          last_decision_at: string | null
          total_decisions: number | null
          total_nao_agora: number | null
          total_sim: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_capacity_trend: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          classification_confidence: number
          created_at: string
          overall_score: number
          state_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
