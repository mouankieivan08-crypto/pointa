import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { NAV } from "@/config/nav";
import { can } from "@/config/rbac";
import { getSession } from "@/lib/auth";
import { getSchool, unreadNotificationCount, countActiveTeachers } from "@/lib/db";
import { getSchoolPlan } from "@/lib/plan";
import { getSchoolConfig } from "@/lib/school-config";
import { logoutAction } from "@/lib/actions";
import type { SessionUser } from "@/lib/types";

// Espace de travail : l'écran reste stable (pas de zoom involontaire).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [school, notifCount, plan, used, config] = await Promise.all([
    getSchool(session.schoolId),
    unreadNotificationCount(session.schoolId),
    getSchoolPlan(session.schoolId),
    countActiveTeachers(session.schoolId),
    getSchoolConfig(session.schoolId),
  ]);
  if (!school) redirect("/login");

  const user: SessionUser = {
    name: session.name || "Administrateur",
    email: "",
    role: "super_admin",
    companyName: school.name || "Mon établissement",
  };
  // Le vocabulaire suit la structure : enseignants / formateurs, classes / promotions…
  const v = config.structure;
  const nav = NAV.filter((item) => can(user.role, item.permission)).map((item) => (item.href === "/app/employees" ? { ...item, label: v.staffMany } : item));

  return (
    <AppShell
      user={user}
      nav={nav}
      logoutAction={logoutAction}
      notifCount={notifCount}
      staffOne={v.staffOne}
      plan={{ label: plan.paid ? plan.name : "Essai gratuit", detail: `${used}/${plan.maxTeachers}`, warn: plan.expired || used >= plan.maxTeachers }}
    >
      {children}
    </AppShell>
  );
}
