import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedProgram } from "@/lib/seed";
import TabBar from "@/components/TabBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Ensure the 5x5 program exists (first login only; guarded by profiles.seeded).
  try {
    await seedProgram(supabase, user.id);
  } catch {
    // Non-fatal: the workout tab surfaces an empty state if seeding failed.
  }

  return (
    <div className="mx-auto max-w-lg min-h-screen pb-24">
      {children}
      <TabBar />
    </div>
  );
}
