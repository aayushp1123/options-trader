"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  { href: "/dashboard", label: "Positions" },
  { href: "/dashboard/log", label: "Trade Log" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-paper-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex flex-none items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-xs font-bold text-white">
            OD
          </span>
          <span className="whitespace-nowrap font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">
            Options Desk
          </span>
        </Link>

        <div className="flex flex-1 justify-center gap-1.5 overflow-x-auto">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 font-[family-name:var(--font-heading)] text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ${
                  active
                    ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                    : "border-line text-ink-700 hover:border-teal-600 hover:text-teal-600 hover:shadow-sm"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <ThemeToggle className="flex-none" />
        <span className="flex-none rounded-full border border-warn-600/40 bg-warn-100 px-2.5 py-1 text-xs font-semibold text-warn-800">
          Sandbox
        </span>
        <button
          onClick={handleLogout}
          className="flex-none whitespace-nowrap text-sm text-ink-500 hover:text-crit-600"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
