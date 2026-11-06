"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { NAV_GROUPS, type NavItem } from "@/config/nav";
import { ROLES } from "@/config/rbac";
import type { SessionUser } from "@/lib/types";

/**
 * Coquille de l'espace direction, conçue comme une application :
 * le menu et la barre du haut restent fixes, seul le contenu défile
 * (plus de page entière qui glisse sur mobile).
 */
export function AppShell({
  user,
  nav,
  children,
  logoutAction,
  notifCount = 0,
  plan,
  staffOne = "enseignant",
}: {
  user: SessionUser;
  nav: NavItem[];
  children: React.ReactNode;
  logoutAction: () => void | Promise<void>;
  notifCount?: number;
  plan: { label: string; detail: string; warn: boolean };
  staffOne?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement | null>(null);

  // Changement de page : on revient en haut du contenu.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Échap ferme le menu mobile.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Menu latéral (tiroir sur mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Menu principal"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/app" onClick={() => setOpen(false)}>
            <Logo size={24} />
          </Link>
          <button className="rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <Icon name="x" size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const items = nav.filter((n) => n.group === group.id);
            if (!items.length) return null;
            return (
              <div key={group.id}>
                <p className="px-3 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{group.label}</p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                            active ? "bg-brand-600 text-white shadow-sm" : "text-foreground hover:bg-surface-2"
                          }`}
                        >
                          <Icon name={item.icon} size={19} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
            <Avatar initials={initials} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted">{ROLES[user.role].label}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-absent" aria-label="Déconnexion" title="Déconnexion">
                <Icon name="logout" size={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Colonne principale : barre fixe + contenu qui défile */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 sm:px-6">
          <button className="rounded-lg p-2 text-foreground hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Icon name="menu" size={22} />
          </button>
          <Link href="/app" className="min-w-0 truncate text-sm font-semibold text-foreground sm:hidden">
            {user.companyName}
          </Link>

          <form action="/app/employees" role="search" className="relative hidden max-w-md flex-1 sm:block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <Icon name="search" size={17} />
            </span>
            <input
              type="search"
              name="q"
              aria-label={`Rechercher un ${staffOne}`}
              placeholder={`Rechercher un ${staffOne}…`}
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/app/upgrade"
              className={`hidden rounded-full px-3 py-1 text-xs font-semibold md:inline ${plan.warn ? "bg-late-bg text-late" : "bg-surface-2 text-muted hover:text-foreground"}`}
              title="Abonnement"
            >
              {plan.label} · {plan.detail}
            </Link>
            <span className="hidden max-w-[14rem] truncate rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 lg:inline">{user.companyName}</span>
            <Link href="/app/notifications" className="relative rounded-xl p-2 text-foreground hover:bg-surface-2" aria-label="Notifications">
              <Icon name="bell" size={20} />
              {notifCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-absent px-1 text-[0.6rem] font-bold text-white ring-2 ring-surface">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
