import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSession } from "@/lib/auth";
import { getSchool } from "@/lib/db";
import { LocationForm } from "@/components/app/LocationForm";
import { DEFAULT_GEOFENCE_RADIUS_M } from "@/config/rules";

export default async function LocationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const school = await getSchool(session.schoolId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Localisation de l'établissement"
        subtitle={school?.lat != null ? "Position validée — vous pouvez l'ajuster" : "Validez la position pour activer le pointage géolocalisé"}
      />
      <LocationForm
        initial={{ lat: school?.lat ?? null, lng: school?.lng ?? null, radius: school?.radius_m ?? DEFAULT_GEOFENCE_RADIUS_M }}
      />
    </div>
  );
}
