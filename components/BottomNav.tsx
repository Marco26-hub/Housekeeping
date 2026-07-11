"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FilePlus2, History, User, LayoutDashboard } from "lucide-react";
import clsx from "clsx";

export default function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/reports/new", label: "Nuovo", icon: FilePlus2 },
    { href: "/reports", label: "Storico", icon: History },
    isAdmin
      ? { href: "/admin", label: "Admin", icon: LayoutDashboard }
      : { href: "/profile", label: "Profilo", icon: User }
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const Active = path === it.href || path.startsWith(`${it.href}/`);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link href={it.href} className={clsx(
                "flex flex-col items-center gap-1 py-2 text-xs",
                Active ? "text-brand-600 font-semibold" : "text-gray-500"
              )}>
                <Icon size={22} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
