import { createClient } from "@/lib/supabase/server";
import SleepClient from "@/components/SleepClient";
import type { SleepEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SleepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("sleep_entries")
      .select("*")
      .order("night_of", { ascending: false })
      .limit(60),
    user
      ? supabase.from("profiles").select("sleep_factors").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <SleepClient
      initialEntries={(data as SleepEntry[]) ?? []}
      initialFactors={(profile?.sleep_factors as string[]) ?? []}
    />
  );
}
