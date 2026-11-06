import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { TeacherForm } from "@/components/app/TeacherForm";
import { getSession } from "@/lib/auth";
import { listTeachers } from "@/lib/db";
import { getSchoolPlan } from "@/lib/plan";
import { getSchoolConfig } from "@/lib/school-config";
import { createTeacherAction } from "@/lib/actions";

export default async function NewTeacherPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [teachers, plan, config] = await Promise.all([listTeachers(session.schoolId), getSchoolPlan(session.schoolId), getSchoolConfig(session.schoolId)]);
  const v = config.structure;

  const header = (
    <div className="flex items-center gap-3">
      <Link href="/app/employees" className="text-muted hover:text-foreground" aria-label="Retour à la liste">
        <Icon name="arrow" size={20} className="rotate-180" />
      </Link>
      <PageHeader title={`Ajouter un ${v.staffOne}`} subtitle="Identité, téléphone et emploi du temps" />
    </div>
  );

  // Limite de l'offre atteinte : on explique la marche à suivre au lieu d'afficher un formulaire inutile.
  if (teachers.length >= plan.maxTeachers) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="mx-auto max-w-xl text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon name="lightning" size={24} /></span>
          <h2 className="mt-3 text-lg font-bold text-foreground">Vous avez atteint {plan.maxTeachers} {v.staffOne}s actifs</h2>
          <p className="mt-2 text-sm text-muted">
            {plan.paid ? `Votre abonnement ${plan.name} couvre ${plan.maxTeachers} ${v.staffOne}s.` : `L'essai gratuit couvre ${plan.maxTeachers} ${v.staffOne}s.`} Pour en ajouter d&apos;autres :
          </p>
          <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm text-foreground">
            <li className="flex gap-2"><strong className="text-brand-600">1.</strong> Choisissez un abonnement et contactez-nous sur WhatsApp.</li>
            <li className="flex gap-2"><strong className="text-brand-600">2.</strong> Réglez par Mobile Money : l&apos;abonnement est activé le jour même.</li>
            <li className="flex gap-2"><strong className="text-brand-600">3.</strong> Revenez ici : vous pouvez ajouter vos autres {v.staffOne}s.</li>
          </ol>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/app/upgrade"><Icon name="lightning" size={16} /> Voir les abonnements</ButtonLink>
            <ButtonLink href="/app/employees" variant="secondary">Archiver un profil</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const classSuggestions = [...new Set([...config.levels, ...teachers.flatMap((t) => t.assignments.map((a) => a.classe))])];
  return (
    <div className="space-y-6">
      {header}
      <TeacherForm
        mode="create"
        action={createTeacherAction}
        classSuggestions={classSuggestions}
        vocab={{ staffOne: v.staffOne, groupOne: v.groupOne, groupMany: v.groupMany, example: v.example }}
      />
    </div>
  );
}
