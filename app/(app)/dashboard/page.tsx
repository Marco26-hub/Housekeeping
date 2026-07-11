import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { FilePlus2, History, CalendarDays, User } from "lucide-react";
import { todayISO } from "@/lib/utils";

export default async function Home() {
  const { profile, sb } = await requireUser();
  const today = todayISO();
  const { count: todayCount } = await sb
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("operator_id", profile.id)
    .eq("intervention_date", today);

  const tiles = [
    { href: "/reports/new", label: "Nuovo Report", icon: FilePlus2, color: "bg-brand-600 text-white" },
    { href: `/reports?date=${today}`, label: `Report di oggi (${todayCount ?? 0})`, icon: CalendarDays, color: "bg-white" },
    { href: "/reports", label: "Storico Report", icon: History, color: "bg-white" },
    { href: "/profile", label: "Profilo", icon: User, color: "bg-white" }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href}
              className={`card p-4 flex flex-col gap-3 min-h-[120px] justify-between ${t.color}`}>
              <Icon size={26} />
              <div className="font-semibold leading-tight">{t.label}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
