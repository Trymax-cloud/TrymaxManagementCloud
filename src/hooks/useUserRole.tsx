import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { UserRole } from "@/types";

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        // Fall back to metadata role
        const metaRole = user.user_metadata?.role as UserRole;
        setRole(metaRole || "employee");
      } else if (data) {
        setRole(data.role as UserRole);
      } else {
        // Fall back to metadata role if no DB role exists
        const metaRole = user.user_metadata?.role as UserRole;
        setRole(metaRole || "employee");
      }
      setIsLoading(false);
    }

    fetchRole();
  }, [user]);

  return { role, isLoading, isDirector: role === "director" };
}
