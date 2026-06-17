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
      cashbook: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          entry_date: string
          id: string
          method: string
          note: string | null
          owner_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          entry_date?: string
          id?: string
          method?: string
          note?: string | null
          owner_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          method?: string
          note?: string | null
          owner_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cashbook_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          due_balance: number
          email: string | null
          id: string
          name: string
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          due_balance?: number
          email?: string | null
          id?: string
          name: string
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          due_balance?: number
          email?: string | null
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string | null
          expense_date: string
          id: string
          method: string
          note: string | null
          owner_id: string
          paid_amount: number
          party_name: string
          party_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          due_date?: string | null
          expense_date?: string
          id?: string
          method?: string
          note?: string | null
          owner_id: string
          paid_amount?: number
          party_name?: string
          party_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string | null
          expense_date?: string
          id?: string
          method?: string
          note?: string | null
          owner_id?: string
          paid_amount?: number
          party_name?: string
          party_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_drive_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          auto_daily: boolean
          created_at: string
          folder_id: string | null
          google_email: string | null
          last_backup_at: string | null
          last_backup_error: string | null
          last_backup_status: string | null
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          auto_daily?: boolean
          created_at?: string
          folder_id?: string | null
          google_email?: string | null
          last_backup_at?: string | null
          last_backup_error?: string | null
          last_backup_status?: string | null
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          auto_daily?: boolean
          created_at?: string
          folder_id?: string | null
          google_email?: string | null
          last_backup_at?: string | null
          last_backup_error?: string | null
          last_backup_status?: string | null
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          bkash_number: string
          created_at: string
          duration_days: number | null
          id: string
          kind: string
          messages_count: number | null
          note: string | null
          plan: string | null
          processed_at: string | null
          processed_by: string | null
          sender_number: string
          status: string
          trx_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bkash_number: string
          created_at?: string
          duration_days?: number | null
          id?: string
          kind?: string
          messages_count?: number | null
          note?: string | null
          plan?: string | null
          processed_at?: string | null
          processed_by?: string | null
          sender_number: string
          status?: string
          trx_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bkash_number?: string
          created_at?: string
          duration_days?: number | null
          id?: string
          kind?: string
          messages_count?: number | null
          note?: string | null
          plan?: string | null
          processed_at?: string | null
          processed_by?: string | null
          sender_number?: string
          status?: string
          trx_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used: boolean
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          used?: boolean
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          batch_no: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          expiry_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          low_stock_threshold: number
          mrp: number | null
          name: string
          owner_id: string
          sell_price: number
          serial_no: string | null
          size: string | null
          sku: string | null
          stock: number
          unit: string
          updated_at: string
          vat: number
        }
        Insert: {
          barcode?: string | null
          batch_no?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          mrp?: number | null
          name: string
          owner_id: string
          sell_price?: number
          serial_no?: string | null
          size?: string | null
          sku?: string | null
          stock?: number
          unit?: string
          updated_at?: string
          vat?: number
        }
        Update: {
          barcode?: string | null
          batch_no?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          mrp?: number | null
          name?: string
          owner_id?: string
          sell_price?: number
          serial_no?: string | null
          size?: string | null
          sku?: string | null
          stock?: number
          unit?: string
          updated_at?: string
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          company_name: string | null
          created_at: string
          currency: string
          full_name: string | null
          id: string
          invoice_settings: Json
          is_super_admin: boolean
          language: string
          logo_url: string | null
          message_credits: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string
          full_name?: string | null
          id: string
          invoice_settings?: Json
          is_super_admin?: boolean
          language?: string
          logo_url?: string | null
          message_credits?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string
          full_name?: string | null
          id?: string
          invoice_settings?: Json
          is_super_admin?: boolean
          language?: string
          logo_url?: string | null
          message_credits?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          id: string
          line_total: number
          owner_id: string
          product_id: string | null
          product_name: string
          purchase_id: string
          qty: number
          unit_cost: number
        }
        Insert: {
          id?: string
          line_total: number
          owner_id: string
          product_id?: string | null
          product_name: string
          purchase_id: string
          qty: number
          unit_cost: number
        }
        Update: {
          id?: string
          line_total?: number
          owner_id?: string
          product_id?: string | null
          product_name?: string
          purchase_id?: string
          qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          discount: number
          due: number
          id: string
          invoice_no: string
          note: string | null
          owner_id: string
          paid: number
          payment_method: string
          status: string
          subtotal: number
          supplier_name: string | null
          tax: number
          total: number
        }
        Insert: {
          created_at?: string
          discount?: number
          due?: number
          id?: string
          invoice_no: string
          note?: string | null
          owner_id: string
          paid?: number
          payment_method?: string
          status?: string
          subtotal?: number
          supplier_name?: string | null
          tax?: number
          total?: number
        }
        Update: {
          created_at?: string
          discount?: number
          due?: number
          id?: string
          invoice_no?: string
          note?: string | null
          owner_id?: string
          paid?: number
          payment_method?: string
          status?: string
          subtotal?: number
          supplier_name?: string | null
          tax?: number
          total?: number
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          line_total: number
          owner_id: string
          product_id: string | null
          product_name: string
          qty: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          owner_id: string
          product_id?: string | null
          product_name: string
          qty: number
          sale_id: string
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          owner_id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string | null
          discount: number
          due: number
          id: string
          invoice_no: string
          note: string | null
          owner_id: string
          paid: number
          payment_method: string
          status: string
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount?: number
          due?: number
          id?: string
          invoice_no: string
          note?: string | null
          owner_id: string
          paid?: number
          payment_method?: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount?: number
          due?: number
          id?: string
          invoice_no?: string
          note?: string | null
          owner_id?: string
          paid?: number
          payment_method?: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          body: string
          created_at: string
          customer_id: string | null
          id: string
          kind: string
          owner_id: string
          phone: string
          provider_msg_id: string | null
          provider_response: string | null
          status: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: string
          owner_id: string
          phone: string
          provider_msg_id?: string | null
          provider_response?: string | null
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: string
          owner_id?: string
          phone?: string
          provider_msg_id?: string | null
          provider_response?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_free_plan: { Args: never; Returns: undefined }
      activate_plan: { Args: { _plan: string }; Returns: undefined }
      approve_payment_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      consume_sms_credit: {
        Args: {
          _body: string
          _customer_id: string
          _kind: string
          _phone: string
        }
        Returns: string
      }
      get_plan_spec: {
        Args: { _kind: string; _plan: string }
        Returns: {
          amount: number
          duration_days: number
          messages_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      refund_sms_credit: { Args: { _user_id: string }; Returns: undefined }
      reject_payment_request: {
        Args: { _note: string; _request_id: string }
        Returns: undefined
      }
      send_due_reminder_sms: {
        Args: { _body: string; _customer_id: string; _phone: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "staff"
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
      app_role: ["admin", "manager", "staff"],
    },
  },
} as const
