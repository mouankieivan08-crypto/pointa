import type { Role } from "@/config/rbac";

export type EmployeeStatus = "active" | "suspended" | "archived";
export type AttendanceStatus = "present" | "late" | "absent" | "off";

export interface Department {
  id: string;
  name: string;
}

export interface Site {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  radiusM: number;
}

/** Affectation d'un enseignant à un créneau : classe, jour, plage horaire et taux. */
export interface Assignment {
  id?: string;
  classe: string; // ex: "5e A"
  day?: string | null; // ex: "Lundi"
  startTime?: string | null; // ex: "08:00"
  endTime?: string | null; // ex: "10:00"
  hoursPerWeek: number; // durée du créneau (ou heures/sem si pas de plage)
  hourlyRate: number; // FCFA / heure (peut différer d'une classe à l'autre)
}

export interface Employee {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  position: string; // ex: "Enseignant"
  subject: string; // matière enseignée (ex: "Physique-Chimie")
  assignments: Assignment[]; // classes enseignées (emploi du temps)
  departmentId: string; // pôle : Sciences / Lettres / Langues…
  siteId: string;
  phone: string;
  email: string;
  hireDate: string; // ISO
  // --- Paiement à l'heure (écoles) ---
  hourlyRate: number; // FCFA / heure
  weeklyQuotaHours: number; // heures prévues / semaine (emploi du temps)
  hoursDoneThisMonth: number; // heures réellement faites ce mois
  baseSalary: number; // conservé pour compat (staff mensualisé éventuel)
  scheduleStart: string; // HH:mm
  scheduleEnd: string; // HH:mm
  status: EmployeeStatus;
  hasSmartphone: boolean; // sinon → pointage tablette/PIN
  color: string;
  photoUrl?: string | null; // photo d'inscription (Supabase Storage)
  hasCode?: boolean; // l'enseignant a choisi son code personnel
}

export interface AttendanceToday {
  employeeId: string;
  status: AttendanceStatus;
  arrival?: string; // HH:mm
  departure?: string; // HH:mm
  siteId: string;
  lateMinutes: number;
  overtimeMinutes: number;
  withinGeofence: boolean;
}

export interface DayPoint {
  label: string; // ex: "Lun"
  present: number;
  late: number;
  absent: number;
}

export interface SessionUser {
  name: string;
  email: string;
  role: Role;
  companyName: string;
}
