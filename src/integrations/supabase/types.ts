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
      app_images: {
        Row: {
          key: string
          settings: Json
          updated_at: string
          url: string | null
        }
        Insert: {
          key: string
          settings?: Json
          updated_at?: string
          url?: string | null
        }
        Update: {
          key?: string
          settings?: Json
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      booking_pricing_logs: {
        Row: {
          booking_reference: string | null
          created_at: string
          final_price: number
          id: string
          item_total: number
          minimum_price: number | null
          zip_code: string
        }
        Insert: {
          booking_reference?: string | null
          created_at?: string
          final_price?: number
          id?: string
          item_total?: number
          minimum_price?: number | null
          zip_code: string
        }
        Update: {
          booking_reference?: string | null
          created_at?: string
          final_price?: number
          id?: string
          item_total?: number
          minimum_price?: number | null
          zip_code?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          image_url: string | null
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id: string
          image_url?: string | null
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          id: string
          date: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          reference: string
          service_type: string
          status: string
          customer_name: string | null
          customer_email: string | null
          customer_phone: string | null
          customer_address: string | null
          customer_address2: string | null
          customer_zip: string | null
          customer_property_type: string | null
          customer_gate_code: string | null
          schedule_date: string | null
          schedule_time_window: string | null
          items: Json
          custom_items: Json
          item_total: number
          photo_promo_discount: number
          adjusted_item_total: number
          minimum_price: number | null
          final_total: number
          amount_charged: number
          deposit_mode: boolean
          payment_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reference: string
          service_type: string
          status?: string
          customer_name?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          customer_address2?: string | null
          customer_zip?: string | null
          customer_property_type?: string | null
          customer_gate_code?: string | null
          schedule_date?: string | null
          schedule_time_window?: string | null
          items?: Json
          custom_items?: Json
          item_total?: number
          photo_promo_discount?: number
          adjusted_item_total?: number
          minimum_price?: number | null
          final_total?: number
          amount_charged?: number
          deposit_mode?: boolean
          payment_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reference?: string
          service_type?: string
          status?: string
          customer_name?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          customer_address2?: string | null
          customer_zip?: string | null
          customer_property_type?: string | null
          customer_gate_code?: string | null
          schedule_date?: string | null
          schedule_time_window?: string | null
          items?: Json
          custom_items?: Json
          item_total?: number
          photo_promo_discount?: number
          adjusted_item_total?: number
          minimum_price?: number | null
          final_total?: number
          amount_charged?: number
          deposit_mode?: boolean
          payment_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          component: string | null
          context: string | null
          created_at: string
          id: string
          message: string
          stack: string | null
        }
        Insert: {
          component?: string | null
          context?: string | null
          created_at?: string
          id?: string
          message: string
          stack?: string | null
        }
        Update: {
          component?: string | null
          context?: string | null
          created_at?: string
          id?: string
          message?: string
          stack?: string | null
        }
        Relationships: []
      }
      time_windows: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          label: string
          mode: string
          payload: Json | null
          status_code: number | null
          success: boolean
          webhook_url: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          label?: string
          mode: string
          payload?: Json | null
          status_code?: number | null
          success?: boolean
          webhook_url: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          label?: string
          mode?: string
          payload?: Json | null
          status_code?: number | null
          success?: boolean
          webhook_url?: string
        }
        Relationships: []
      }
      webhook_settings: {
        Row: {
          active_mode: string
          id: string
          live_url: string
          test_url: string
          twin_url: string
          updated_at: string
        }
        Insert: {
          active_mode?: string
          id?: string
          live_url?: string
          test_url?: string
          twin_url?: string
          updated_at?: string
        }
        Update: {
          active_mode?: string
          id?: string
          live_url?: string
          test_url?: string
          twin_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      zip_pricing: {
        Row: {
          active: boolean
          created_at: string
          id: string
          minimum_price: number
          updated_at: string
          zip_code: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          minimum_price?: number
          updated_at?: string
          zip_code: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          minimum_price?: number
          updated_at?: string
          zip_code?: string
        }
        Relationships: []
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
