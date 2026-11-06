import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSchool } from "@/lib/db";
import { getSchoolConfig } from "@/lib/school-config";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

/** Quelques questions courtes, juste après l'inscription, pour adapter Pointa à la structure. */
export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [school, config] = await Promise.all([getSchool(session.schoolId), getSchoolConfig(session.schoolId)]);
  if (!school) redirect("/login");
  if (config.configured) redirect("/app");

  return <OnboardingWizard schoolName={school.name} firstName={(session.name || "").split(" ")[0] || "à vous"} />;
}
