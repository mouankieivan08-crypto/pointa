import type { Permission } from "./rbac";

/** Navigation de l'espace direction. */
export interface NavItem {
  href: string;
  label: string;
  icon: string; // clé d'icône (voir components/Icon)
  permission: Permission;
  group: "principal" | "gestion" | "systeme";
}

export const NAV: NavItem[] = [
  { href: "/app", label: "Tableau de bord", icon: "dashboard", permission: "dashboard.view", group: "principal" },
  { href: "/app/employees", label: "Enseignants", icon: "users", permission: "employees.view", group: "principal" },
  { href: "/app/attendance", label: "Pointages", icon: "clock", permission: "attendance.view", group: "principal" },

  { href: "/app/schedules", label: "Emplois du temps", icon: "calendar", permission: "schedules.manage", group: "gestion" },
  { href: "/app/leaves", label: "Absences & congés", icon: "leaf", permission: "leaves.view", group: "gestion" },
  { href: "/app/payroll", label: "Paie", icon: "wallet", permission: "payroll.view", group: "gestion" },
  { href: "/app/awards", label: "Enseignant du mois", icon: "trophy", permission: "dashboard.view", group: "gestion" },
  { href: "/app/reports", label: "Rapports", icon: "chart", permission: "reports.view", group: "gestion" },

  { href: "/app/location", label: "Localisation", icon: "pin", permission: "settings.manage", group: "systeme" },
  { href: "/app/sites", label: "Sites & départements", icon: "globe", permission: "employees.manage", group: "systeme" },
  { href: "/app/activity", label: "Journal d'activité", icon: "history", permission: "activitylog.view", group: "systeme" },
  { href: "/app/settings", label: "Paramètres", icon: "settings", permission: "settings.manage", group: "systeme" },
  { href: "/app/upgrade", label: "Abonnement", icon: "lightning", permission: "dashboard.view", group: "systeme" },
];

export const NAV_GROUPS: { id: NavItem["group"]; label: string }[] = [
  { id: "principal", label: "Principal" },
  { id: "gestion", label: "Gestion" },
  { id: "systeme", label: "Système" },
];
