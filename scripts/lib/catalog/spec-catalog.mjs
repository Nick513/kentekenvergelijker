// Load spec_key metadata from the specifications table for dev tooling.

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {Promise<Map<string, { valueSource: string, displayType: string }>>}
 */
export async function loadSpecCatalog(supabase) {
  const { data, error } = await supabase
    .from("specifications")
    .select("spec_key, value_source, display_type");

  if (error) {
    throw new Error(`Failed to load specifications: ${error.message}`);
  }

  const catalog = new Map();
  for (const row of data ?? []) {
    catalog.set(row.spec_key, {
      valueSource: row.value_source,
      displayType: row.display_type,
    });
  }
  return catalog;
}
