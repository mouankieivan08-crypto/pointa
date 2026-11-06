import type { AttendanceStatus, EmployeeStatus } from "./types";

export const ATTENDANCE_META: Record<AttendanceStatus, { label: string; tone: string }> = {
  present: { label: "Présent", tone: "present" },
  late: { label: "En retard", tone: "late" },
  absent: { label: "Absent", tone: "absent" },
  off: { label: "Repos / Congé", tone: "off" },
};

export const EMPLOYEE_STATUS_META: Record<EmployeeStatus, { label: string; tone: string }> = {
  active: { label: "Actif", tone: "present" },
  suspended: { label: "Suspendu", tone: "late" },
  archived: { label: "Archivé", tone: "off" },
};
