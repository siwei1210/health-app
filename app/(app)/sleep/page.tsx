import { createClient } from "@/lib/supabase/server";
import SleepClient from "@/components/SleepClient";
import type { SleepEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SleepPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sleep_entries")
    .select("*")
    .order("night_of", { ascending: false })
    .limit(30);

  return <SleepClient initialEntries={(data as SleepEntry[]) ?? []} />;
}
