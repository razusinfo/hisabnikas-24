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
      branch_users: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          owner_id: string
          role: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          owner_id: string
          role?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_main: boolean
          name: string
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name: string
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cashbook: {
        Row: {
          amount: number
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "cashbook_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
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
      companies: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
          created_at?: string
          due_balance?: number
          email?: string | null
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
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
      mfs_accounts: {
        Row: {
          account_name: string
          account_number: string
          branch_id: string | null
          created_at: string
          id: string
          note: string | null
          owner_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          branch_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          owner_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          branch_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfs_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      mfs_sms_inbox: {
        Row: {
          account_number: string | null
          amount: number | null
          branch_id: string | null
          cashbook_id: string | null
          created_at: string
          error: string | null
          id: string
          matched_sale_id: string | null
          owner_id: string
          provider: string
          raw_body: string
          received_at: string
          sender: string | null
          sender_msisdn: string | null
          status: string
          txn_id: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          amount?: number | null
          branch_id?: string | null
          cashbook_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          matched_sale_id?: string | null
          owner_id: string
          provider?: string
          raw_body: string
          received_at?: string
          sender?: string | null
          sender_msisdn?: string | null
          status?: string
          txn_id?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          amount?: number | null
          branch_id?: string | null
          cashbook_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          matched_sale_id?: string | null
          owner_id?: string
          provider?: string
          raw_body?: string
          received_at?: string
          sender?: string | null
          sender_msisdn?: string | null
          status?: string
          txn_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfs_sms_inbox_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfs_sms_inbox_matched_sale_id_fkey"
            columns: ["matched_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reconciliation: {
        Row: {
          branch_id: string | null
          confidence: number | null
          created_at: string
          created_by: string | null
          difference: number | null
          expected_amount: number | null
          id: string
          match_reason: string | null
          note: string | null
          owner_id: string
          provider: string | null
          received_amount: number
          sale_id: string | null
          sms_inbox_id: string | null
          status: string
          txn_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          match_reason?: string | null
          note?: string | null
          owner_id: string
          provider?: string | null
          received_amount: number
          sale_id?: string | null
          sms_inbox_id?: string | null
          status?: string
          txn_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          match_reason?: string | null
          note?: string | null
          owner_id?: string
          provider?: string | null
          received_amount?: number
          sale_id?: string | null
          sms_inbox_id?: string | null
          status?: string
          txn_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliation_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_sms_inbox_id_fkey"
            columns: ["sms_inbox_id"]
            isOneToOne: false
            referencedRelation: "mfs_sms_inbox"
            referencedColumns: ["id"]
          },
        ]
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
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
          language: string
          logo_url: string | null
          message_credits: number
          phone: string | null
          sms_auto_post: boolean
          sms_device_secret_hash: string | null
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
          language?: string
          logo_url?: string | null
          message_credits?: number
          phone?: string | null
          sms_auto_post?: boolean
          sms_device_secret_hash?: string | null
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
          language?: string
          logo_url?: string | null
          message_credits?: number
          phone?: string | null
          sms_auto_post?: boolean
          sms_device_secret_hash?: string | null
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
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
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
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
      dismiss_mfs_sms: {
        Args: { _reason?: string; _sms_id: string }
        Returns: undefined
      }
      generate_sms_device_secret: { Args: never; Returns: string }
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
      list_all_subscriptions: {
        Args: never
        Returns: {
          company_name: string
          expires_at: string
          full_name: string
          phone: string
          plan: string
          started_at: string
          status: string
          user_id: string
        }[]
      }
      list_all_users: {
        Args: never
        Returns: {
          company_name: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          message_credits: number
          phone: string
          plan: string
          roles: string[]
          status: string
          user_id: string
        }[]
      }
      manual_match_mfs_sms: {
        Args: { _note?: string; _sale_id: string; _sms_id: string }
        Returns: string
      }
      process_mfs_sms: {
        Args: {
          _amount: number
          _owner_id: string
          _provider: string
          _received_at: string
          _sender_msisdn: string
          _sms_id: string
          _txn_id: string
        }
        Returns: string
      }
      refund_sms_credit: { Args: { _user_id: string }; Returns: undefined }
      reject_payment_request: {
        Args: { _note: string; _request_id: string }
        Returns: undefined
      }
      revoke_subscription: {
        Args: { _reason?: string; _user_id: string }
        Returns: undefined
      }
      send_due_reminder_sms: {
        Args: { _body: string; _customer_id: string; _phone: string }
        Returns: string
      }
      set_sms_auto_post: { Args: { _enabled: boolean }; Returns: undefined }
      user_branch_ids: { Args: { _uid: string }; Returns: string[] }
      user_can_access_branch: {
        Args: { _branch_id: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "staff" | "super_admin"
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
      app_role: ["admin", "manager", "staff", "super_admin"],
    },
  },
} as const
