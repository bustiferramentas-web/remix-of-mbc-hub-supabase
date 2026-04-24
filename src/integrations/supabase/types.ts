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
      churn_requests: {
        Row: {
          created_at: string
          enrollment_id: string
          handled_by: string | null
          id: string
          notes: string | null
          reason: string | null
          reason_category: Database["public"]["Enums"]["churn_reason"] | null
          requested_at: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["churn_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          handled_by?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          reason_category?: Database["public"]["Enums"]["churn_reason"] | null
          requested_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["churn_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          handled_by?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          reason_category?: Database["public"]["Enums"]["churn_reason"] | null
          requested_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["churn_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "churn_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_history: {
        Row: {
          created_at: string
          created_by: string | null
          enrollment_id: string
          id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enrollment_id: string
          id?: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enrollment_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          cancellation_date: string | null
          cancellation_reason: string | null
          chargeback_count: number
          community_expiration_date: string | null
          created_at: string
          email: string
          expiration_date: string | null
          id: string
          import_id: string | null
          is_renewal: boolean
          is_vitalicio: boolean
          last_payment_date: string | null
          manual_status:
            | Database["public"]["Enums"]["enrollment_manual_status"]
            | null
          manually_edited: boolean
          name: string
          notes: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone: string | null
          product_id: string
          purchase_date: string
          tmb_status: Database["public"]["Enums"]["tmb_status"] | null
          updated_at: string
        }
        Insert: {
          cancellation_date?: string | null
          cancellation_reason?: string | null
          chargeback_count?: number
          community_expiration_date?: string | null
          created_at?: string
          email: string
          expiration_date?: string | null
          id?: string
          import_id?: string | null
          is_renewal?: boolean
          is_vitalicio?: boolean
          last_payment_date?: string | null
          manual_status?:
            | Database["public"]["Enums"]["enrollment_manual_status"]
            | null
          manually_edited?: boolean
          name: string
          notes?: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          product_id: string
          purchase_date: string
          tmb_status?: Database["public"]["Enums"]["tmb_status"] | null
          updated_at?: string
        }
        Update: {
          cancellation_date?: string | null
          cancellation_reason?: string | null
          chargeback_count?: number
          community_expiration_date?: string | null
          created_at?: string
          email?: string
          expiration_date?: string | null
          id?: string
          import_id?: string | null
          is_renewal?: boolean
          is_vitalicio?: boolean
          last_payment_date?: string | null
          manual_status?:
            | Database["public"]["Enums"]["enrollment_manual_status"]
            | null
          manually_edited?: boolean
          name?: string
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          product_id?: string
          purchase_date?: string
          tmb_status?: Database["public"]["Enums"]["tmb_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      experts: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          error_rows: number
          expert_id: string | null
          file_name: string
          id: string
          imported_at: string
          imported_by: string | null
          product_id: string | null
          status: string
          success_rows: number
          total_rows: number
        }
        Insert: {
          error_rows?: number
          expert_id?: string | null
          file_name: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          product_id?: string | null
          status?: string
          success_rows?: number
          total_rows?: number
        }
        Update: {
          error_rows?: number
          expert_id?: string | null
          file_name?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          product_id?: string | null
          status?: string
          success_rows?: number
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "imports_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived: boolean
          created_at: string
          expert_id: string
          id: string
          internal_id: string[] | null
          name: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          expert_id: string
          id?: string
          internal_id?: string[] | null
          name: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          expert_id?: string
          id?: string
          internal_id?: string[] | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      churn_reason:
        | "price"
        | "competitor"
        | "personal"
        | "no_engagement"
        | "other"
      churn_status: "solicitado" | "em_negociacao" | "revertido" | "concluido"
      enrollment_manual_status: "cancelado" | "reembolsado" | "inadimplente"
      payment_type: "parcelado" | "recorrente" | "boleto_tmb"
      tmb_status:
        | "em_dia"
        | "quitado"
        | "em_atraso"
        | "negativado"
        | "cancelado"
        | "reembolsado"
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
      churn_reason: [
        "price",
        "competitor",
        "personal",
        "no_engagement",
        "other",
      ],
      churn_status: ["solicitado", "em_negociacao", "revertido", "concluido"],
      enrollment_manual_status: ["cancelado", "reembolsado", "inadimplente"],
      payment_type: ["parcelado", "recorrente", "boleto_tmb"],
      tmb_status: [
        "em_dia",
        "quitado",
        "em_atraso",
        "negativado",
        "cancelado",
        "reembolsado",
      ],
    },
  },
} as const
