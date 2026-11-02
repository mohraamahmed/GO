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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          record_id: string
          source: string | null
          status: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          record_id: string
          source?: string | null
          status?: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          record_id?: string
          source?: string | null
          status?: string
          table_name?: string
        }
        Relationships: []
      }
      cafe_attributes: {
        Row: {
          atmosphere_tags: string[]
          atmosphere_tags_status: string
          cafe_id: string
          couple_friendly: boolean | null
          couple_friendly_status: string
          group_seating: boolean | null
          group_seating_status: string
          laptop_friendly: boolean | null
          laptop_friendly_status: string
          measured_wifi_speed: number | null
          measured_wifi_speed_status: string
          noise_level: number | null
          noise_level_status: string
          outdoor_seating: boolean | null
          outdoor_seating_status: string
          power_outlets: boolean | null
          power_outlets_status: string
          seating_comfort: number | null
          seating_comfort_status: string
          updated_at: string
          visit_reports: Json
          wifi_available: boolean | null
          wifi_available_status: string
          workspace_suitability: number | null
          workspace_suitability_status: string
        }
        Insert: {
          atmosphere_tags?: string[]
          atmosphere_tags_status?: string
          cafe_id: string
          couple_friendly?: boolean | null
          couple_friendly_status?: string
          group_seating?: boolean | null
          group_seating_status?: string
          laptop_friendly?: boolean | null
          laptop_friendly_status?: string
          measured_wifi_speed?: number | null
          measured_wifi_speed_status?: string
          noise_level?: number | null
          noise_level_status?: string
          outdoor_seating?: boolean | null
          outdoor_seating_status?: string
          power_outlets?: boolean | null
          power_outlets_status?: string
          seating_comfort?: number | null
          seating_comfort_status?: string
          updated_at?: string
          visit_reports?: Json
          wifi_available?: boolean | null
          wifi_available_status?: string
          workspace_suitability?: number | null
          workspace_suitability_status?: string
        }
        Update: {
          atmosphere_tags?: string[]
          atmosphere_tags_status?: string
          cafe_id?: string
          couple_friendly?: boolean | null
          couple_friendly_status?: string
          group_seating?: boolean | null
          group_seating_status?: string
          laptop_friendly?: boolean | null
          laptop_friendly_status?: string
          measured_wifi_speed?: number | null
          measured_wifi_speed_status?: string
          noise_level?: number | null
          noise_level_status?: string
          outdoor_seating?: boolean | null
          outdoor_seating_status?: string
          power_outlets?: boolean | null
          power_outlets_status?: string
          seating_comfort?: number | null
          seating_comfort_status?: string
          updated_at?: string
          visit_reports?: Json
          wifi_available?: boolean | null
          wifi_available_status?: string
          workspace_suitability?: number | null
          workspace_suitability_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_attributes_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: true
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_fees: {
        Row: {
          cafe_id: string
          service_charge_pct: number | null
          source: string | null
          vat_pct: number | null
          verified_at: string | null
        }
        Insert: {
          cafe_id: string
          service_charge_pct?: number | null
          source?: string | null
          vat_pct?: number | null
          verified_at?: string | null
        }
        Update: {
          cafe_id?: string
          service_charge_pct?: number | null
          source?: string | null
          vat_pct?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_fees_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: true
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_photos: {
        Row: {
          cafe_id: string
          id: string
          license_type: string | null
          permission_proof: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rights_holder: string | null
          source: string | null
          status: string
          uploaded_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          cafe_id: string
          id?: string
          license_type?: string | null
          permission_proof?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_holder?: string | null
          source?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          cafe_id?: string
          id?: string
          license_type?: string | null
          permission_proof?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_holder?: string | null
          source?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_photos_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      cafes: {
        Row: {
          address: string | null
          archived_at: string | null
          area: string
          area_class: string
          area_class_source: string | null
          area_classified_at: string | null
          area_classified_by: string | null
          area_review_reason: string | null
          category: string | null
          created_at: string
          hours: string[]
          id: string
          lat: number
          lng: number
          maps_url: string | null
          name: string
          phone: string | null
          photos: Json
          price_level: number | null
          rating: number | null
          rating_count: number | null
          services: string[]
          slug: string
          source: string
          verified_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          area: string
          area_class: string
          area_class_source?: string | null
          area_classified_at?: string | null
          area_classified_by?: string | null
          area_review_reason?: string | null
          category?: string | null
          created_at?: string
          hours?: string[]
          id: string
          lat: number
          lng: number
          maps_url?: string | null
          name: string
          phone?: string | null
          photos?: Json
          price_level?: number | null
          rating?: number | null
          rating_count?: number | null
          services?: string[]
          slug: string
          source?: string
          verified_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          area?: string
          area_class?: string
          area_class_source?: string | null
          area_classified_at?: string | null
          area_classified_by?: string | null
          area_review_reason?: string | null
          category?: string | null
          created_at?: string
          hours?: string[]
          id?: string
          lat?: number
          lng?: number
          maps_url?: string | null
          name?: string
          phone?: string | null
          photos?: Json
          price_level?: number | null
          rating?: number | null
          rating_count?: number | null
          services?: string[]
          slug?: string
          source?: string
          verified_at?: string
          website?: string | null
        }
        Relationships: []
      }
      menu_item_price_history: {
        Row: {
          changed_by: string | null
          created_at: string
          currency: string
          id: string
          menu_item_id: string
          price: number
          reason: string | null
          source: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          menu_item_id: string
          price: number
          reason?: string | null
          source?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          menu_item_id?: string
          price?: number
          reason?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_price_history_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          cafe_id: string
          category: string | null
          created_at: string
          currency: string
          id: string
          name: string
          price: number
          price_source: string
          retrieved_at: string
          size: string | null
          source_license: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          cafe_id: string
          category?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          price: number
          price_source: string
          retrieved_at?: string
          size?: string | null
          source_license?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          cafe_id?: string
          category?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          price?: number
          price_source?: string
          retrieved_at?: string
          size?: string | null
          source_license?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          cafe_id: string | null
          id: string
          name: string
          notes: string | null
          retrieved_at: string
          status: string
          supports_field: string | null
          type: string
          url: string | null
          verified_at: string | null
        }
        Insert: {
          cafe_id?: string | null
          id?: string
          name: string
          notes?: string | null
          retrieved_at?: string
          status?: string
          supports_field?: string | null
          type: string
          url?: string | null
          verified_at?: string | null
        }
        Update: {
          cafe_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          retrieved_at?: string
          status?: string
          supports_field?: string | null
          type?: string
          url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
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
      verification_requests: {
        Row: {
          cafe_id: string | null
          created_at: string
          decision_reason: string | null
          id: string
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          type: string
        }
        Insert: {
          cafe_id?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          type: string
        }
        Update: {
          cafe_id?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "data_manager"
        | "content_reviewer"
        | "support"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "super_admin",
        "admin",
        "data_manager",
        "content_reviewer",
        "support",
      ],
    },
  },
} as const
