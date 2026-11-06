import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/Icon";
import { TeacherForm } from "@/components/app/TeacherForm";
import { getSession } from "@/lib/auth";
import { getTeacher, listTeachers } from "@/lib/db";
import { getSchoolConfig } from "@/lib/school-config";
import { getFaceReference } from "@/lib/face";
import { updateTeacherAction } from "@/lib/actions";
import { formatPhone } from "@/lib/phone";

export default async function EditTeacherPage({ params }: PageProps<"/app/employees/[id]/edit">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [e, teachers, config, face] = await Promise.all([
    getTeacher(session.schoolId, id),
    listTeachers(session.schoolId),
    getSchoolConfig(session.schoolId),
    getFaceReference(id),
  ]);
  if (!e) notFound();
  const v = config.structure;

  const classSuggestions = [...new Set([...config.levels, ...teachers.flatMap((t) => t.assignments.map((a) => a.classe))])];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/app/employees/${e.id}`} className="text-muted hover:text-foreground" aria-label="Retour à la fiche">
          <Icon name="arrow" size={20} className="rotate-180" />
        </Link>
        <PageHeader title={`Modifier ${e.firstName} ${e.lastName}`} subtitle="Identité, téléphone et emploi du temps hebdomadaire" />
      </div>
      <TeacherForm
        mode="edit"
        action={updateTeacherAction}
        teacherId={e.id}
        classSuggestions={classSuggestions}
        vocab={{ staffOne: v.staffOne, groupOne: v.groupOne, groupMany: v.groupMany, example: v.example }}
        initial={{
          firstName: e.firstName,
          lastName: e.lastName,
          subject: e.subject,
          phone: formatPhone(e.phone),
          email: e.email,
          photoUrl: e.photoUrl ?? null,
          hasFace: !!face,
          slots: e.assignments.map((a) => ({ classe: a.classe, day: a.day || "Lundi", start: a.startTime || "08:00", end: a.endTime || "10:00", rate: a.hourlyRate })),
        }}
      />
    </div>
  );
}
