import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  // Note: program seeding happens inside the workout page (awaited before it
  // reads the program) so the two never race on first login.

  return (
    <div className="mx-auto max-w-lg min-h-screen pb-24">
      {children}
      <TabBar />
    </div>
  );
}
