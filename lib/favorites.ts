import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Toggle favorite status for a property (add or remove from favorites)
 */
export async function toggleFavorite(
  supabase: SupabaseClient,
  propertyId: string,
  renterId: string,
): Promise<{ success: boolean; error?: string; isFavorite?: boolean }> {
  if (!renterId) {
    return { success: false, error: "User not authenticated" };
  }

  try {
    // Check if already favorited
    const { data: existing, error: checkError } = await supabase
      .from("favorites")
      .select("id")
      .eq("renter_id", renterId)
      .eq("property_id", propertyId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = not found (expected for new favorites)
      return { success: false, error: checkError.message };
    }

    if (existing) {
      // Remove favorite
      const { error: deleteError } = await supabase
        .from("favorites")
        .delete()
        .eq("renter_id", renterId)
        .eq("property_id", propertyId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      return { success: true, isFavorite: false };
    } else {
      // Add favorite
      const { error: insertError } = await supabase.from("favorites").insert({
        renter_id: renterId,
        property_id: propertyId,
      });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return { success: true, isFavorite: true };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Check if a property is favorited by the current user
 */
export async function isFavorite(
  supabase: SupabaseClient,
  propertyId: string,
  renterId: string,
): Promise<boolean> {
  if (!renterId) return false;

  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("id")
      .eq("renter_id", renterId)
      .eq("property_id", propertyId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking favorite status:", error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error("Error checking favorite:", err);
    return false;
  }
}
