export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      claim_history: {
        Row: {
          action: Database["public"]["Enums"]["claim_action"]
          actor_id: string | null
          actor_name: string | null
          id: number
          mode: Database["public"]["Enums"]["claim_mode"]
          occurred_at: string
          owner_id: string
          owner_name: string
          room: string
          session_date: string
          session_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["claim_action"]
          actor_id?: string | null
          actor_name?: string | null
          id?: never
          mode: Database["public"]["Enums"]["claim_mode"]
          occurred_at?: string
          owner_id: string
          owner_name: string
          room: string
          session_date: string
          session_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["claim_action"]
          actor_id?: string | null
          actor_name?: string | null
          id?: never
          mode?: Database["public"]["Enums"]["claim_mode"]
          occurred_at?: string
          owner_id?: string
          owner_name?: string
          room?: string
          session_date?: string
          session_id?: string
        }
        Relationships: []
      }
      committee: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          display_name: string
          user_id: string
        }
        Insert: {
          display_name: string
          user_id: string
        }
        Update: {
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          available: boolean
          day_type: Database["public"]["Enums"]["day_type"]
          id: string
          room: string
          room_position: number
          session_date: string
        }
        Insert: {
          available?: boolean
          day_type?: Database["public"]["Enums"]["day_type"]
          id?: string
          room: string
          room_position?: number
          session_date: string
        }
        Update: {
          available?: boolean
          day_type?: Database["public"]["Enums"]["day_type"]
          id?: string
          room?: string
          room_position?: number
          session_date?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          claims_close_at: string | null
          id: boolean
        }
        Insert: {
          claims_close_at?: string | null
          id?: boolean
        }
        Update: {
          claims_close_at?: string | null
          id?: boolean
        }
        Relationships: []
      }
      signups: {
        Row: {
          claimed_at: string
          id: string
          mode: Database["public"]["Enums"]["claim_mode"]
          owner_id: string
          session_id: string
          slot_number: number
        }
        Insert: {
          claimed_at?: string
          id?: string
          mode: Database["public"]["Enums"]["claim_mode"]
          owner_id: string
          session_id: string
          slot_number: number
        }
        Update: {
          claimed_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["claim_mode"]
          owner_id?: string
          session_id?: string
          slot_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "signups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "signups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_series: {
        Args: {
          p_day: Database["public"]["Enums"]["day_type"]
          p_mode: Database["public"]["Enums"]["claim_mode"]
          p_room: string
        }
        Returns: string[]
      }
      claim_slot: {
        Args: {
          p_mode: Database["public"]["Enums"]["claim_mode"]
          p_session_id: string
        }
        Returns: undefined
      }
      clear_claim: {
        Args: { p_owner_id: string; p_session_id: string }
        Returns: number
      }
      hook_restrict_signup_domain: { Args: { event: Json }; Returns: Json }
      is_committee: { Args: never; Returns: boolean }
      release_claim: { Args: { p_session_id: string }; Returns: number }
      release_series: {
        Args: { p_day: Database["public"]["Enums"]["day_type"]; p_room: string }
        Returns: number
      }
      set_closing_time: { Args: { p_close_at: string }; Returns: undefined }
    }
    Enums: {
      claim_action: "claimed" | "released" | "cleared" | "removed"
      claim_mode: "shared" | "quiet"
      day_type:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      claim_action: ["claimed", "released", "cleared", "removed"],
      claim_mode: ["shared", "quiet"],
      day_type: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    },
  },
} as const

