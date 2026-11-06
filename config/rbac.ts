/**
 * Rôles & permissions centralisés.
 * L'isolation par entreprise (multi-tenant) est garantie côté données ;
 * ce module gère ce qu'un rôle peut faire À L'INTÉRIEUR de son entreprise.
 */
export type Role = "super_admin" | "admin_rh" | "manager" | "employee";

export const ROLES: Record<Role, { label: string; description: string }> = {
  super_admin: {
    label: "Super Admin",
    description: "Accès complet à l'entreprise.",
  },
  admin_rh: {
    label: "Administrateur / RH",
    description: "Gestion des employés et du pointage.",
  },
  manager: {
    label: "Manager",
    description: "Accès limité à son équipe.",
  },
  employee: {
    label: "Employé",
    description: "Accès à ses propres informations.",
  },
};

export type Permission =
  | "dashboard.view"
  | "employees.view"
  | "employees.manage"
  | "attendance.view"
  | "attendance.edit"
  | "schedules.manage"
  | "leaves.view"
  | "leaves.approve"
  | "payroll.view"
  | "payroll.manage"
  | "deductions.manage"
  | "reports.view"
  | "settings.manage"
  | "users.manage"
  | "activitylog.view"
  | "self.view";

const ALL: Permission[] = [
  "dashboard.view",
  "employees.view",
  "employees.manage",
  "attendance.view",
  "attendance.edit",
  "schedules.manage",
  "leaves.view",
  "leaves.approve",
  "payroll.view",
  "payroll.manage",
  "deductions.manage",
  "reports.view",
  "settings.manage",
  "users.manage",
  "activitylog.view",
  "self.view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ALL,
  admin_rh: [
    "dashboard.view",
    "employees.view",
    "employees.manage",
    "attendance.view",
    "attendance.edit",
    "schedules.manage",
    "leaves.view",
    "leaves.approve",
    "payroll.view",
    "payroll.manage",
    "deductions.manage",
    "reports.view",
    "activitylog.view",
  ],
  manager: [
    "dashboard.view",
    "employees.view",
    "attendance.view",
    "leaves.view",
    "leaves.approve",
    "reports.view",
  ],
  employee: ["self.view"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
