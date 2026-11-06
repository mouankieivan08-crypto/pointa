import Link from "next/link";
import { BRAND, CTA } from "@/config/brand";
import { PLANS, FREE_TIER_MAX_TEACHERS, SALES_WHATSAPP } from "@/config/pricing";
import { formatMoney } from "@/config/money";
import { Logo } from "@/components/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { Reveal } from "@/components/Reveal";
import { LossCalculator } from "@/components/LossCalculator";
import { TrackVisit } from "@/components/TrackVisit";

const WHATSAPP_URL = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent("Bonjour, je souhaite en savoir plus sur Pointa pour mon école.")}`;

const STEPS = [
  { icon: "users", title: "Inscrivez vos enseignants", desc: "Nom, téléphone, matière et emploi du temps : classe, jour, heures et taux horaire. Quelques minutes par enseignant." },
  { icon: "clock", title: "Ils pointent depuis leur téléphone", desc: "Arrivée et départ, dans l'enceinte de l'établissement, avec leur code personnel. Rien à installer." },
  { icon: "wallet", title: "Vous payez juste", desc: "Heures vérifiées, retards, absences et montant à payer : calculés automatiquement, visibles aussi par l'enseignant." },
];

const POINTAGE: [string, string, string][] = [
  ["key", "Un code personnel", "À la première connexion, l'enseignant choisit son code : personne ne pointe à sa place avec son numéro."],
  ["pin", "Forcément sur place", "Le pointage n'est validé que dans le rayon défini par la direction. La position n'est jamais conservée."],
  ["camera", "Une photo à chaque pointage", "Une preuve visible uniquement par la direction, à comparer avec la photo de la fiche."],
  ["handshake", "Un relevé partagé", "L'enseignant voit ses heures validées et son montant : fini les contestations de fin de mois."],
];

const FEATURES = [
  { icon: "clock", title: "Pointage par téléphone", desc: "Arrivée et départ en un geste, depuis le téléphone de l'enseignant." },
  { icon: "pin", title: "Présence vérifiée", desc: "Validé seulement dans l'enceinte de l'établissement, dans le rayon que vous choisissez." },
  { icon: "calendar", title: "Emplois du temps", desc: "Créneaux par classe, jour et heure, avec un taux horaire par créneau." },
  { icon: "alert", title: "Retards & absences", desc: "Calculés automatiquement à partir de l'emploi du temps et de votre tolérance." },
  { icon: "wallet", title: "Paie horaire", desc: "Heures vérifiées × taux : le montant juste, enseignant par enseignant." },
  { icon: "repeat", title: "Remplacements & heures sup.", desc: "Programmez une séance : elle est payée si l'enseignant pointe sa présence." },
  { icon: "leaf", title: "Congés & absences justifiées", desc: "Demandés depuis le téléphone, acceptés en un clic par la direction." },
  { icon: "printer", title: "Rapports PDF & Excel", desc: "État de paie et relevé des présences du mois, prêts à signer." },
  { icon: "bell", title: "Rappels de cours", desc: "Une notification avant le cours, et avant la fin pour pointer le départ." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <TrackVisit path="/" />
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
          <Link href="/" aria-label="Pointa — accueil"><Logo /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
            <a href="#fonctionnement" className="hover:text-foreground">Fonctionnement</a>
            <a href="#pointage" className="hover:text-foreground">Le pointage</a>
            <a href="#fonctionnalites" className="hover:text-foreground">Fonctionnalités</a>
            <a href="#tarifs" className="hover:text-foreground">Tarifs</a>
          </nav>
          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">{CTA.login}</ButtonLink>
            <ButtonLink href="/signup" variant="primary" size="sm">{CTA.signup}</ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute -top-24 left-1/2 -z-10 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-[1fr_1.1fr] md:py-20">
            <div className="pointa-rise">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <Icon name="shield" size={14} /> {BRAND.audience}
              </span>
              <h1 className="mt-5 text-[2.1rem] font-extrabold leading-[1.1] tracking-tight text-foreground md:text-5xl">
                Valorisez les heures réelles. <span className="text-brand-600">Payez chaque enseignant au juste prix, sans contestation.</span>
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">{BRAND.subtitle}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink href="/signup" size="lg" className="pointa-cta">
                  <span className="relative z-10 flex items-center gap-2">{CTA.primary} <Icon name="arrow" size={18} /></span>
                </ButtonLink>
                <ButtonLink href="#fonctionnement" variant="secondary" size="lg">{CTA.secondary}</ButtonLink>
              </div>
              <p className="mt-4 text-sm text-muted">
                <Icon name="check" size={15} className="mb-0.5 inline text-present" /> {FREE_TIER_MAX_TEACHERS} enseignants offerts · Sans engagement · Sans carte bancaire
              </p>
            </div>
            <figure className="pointa-rise">
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
                <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2 text-xs text-muted">
                  <span className="font-medium text-foreground">pointa-tawny.vercel.app/app</span>
                  <span>Capture réelle · données de démonstration</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/dashboard-demo.jpg" alt="Tableau de bord Pointa : présents, retards, absents, heures effectuées et montant à payer du mois" className="block w-full" width={1400} height={1086} />
              </div>
            </figure>
          </div>
        </section>

        {/* CALCULATEUR DE PERTE */}
        <section id="calcul" className="mx-auto max-w-5xl px-5 pb-4 pt-8 md:pt-12">
          <Reveal>
            <SectionTitle eyebrow="Faites le calcul" title="Combien coûtent les heures non justifiées ?" subtitle="Un enseignant payé à l'heure qui manque une heure par semaine, c'est une dépense sans contrepartie." />
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <LossCalculator />
          </Reveal>
        </section>

        {/* FONCTIONNEMENT */}
        <section id="fonctionnement" className="mt-12 border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <Reveal><SectionTitle eyebrow="Comment ça marche" title="Simple. En trois étapes." /></Reveal>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 110}>
                  <div className="pointa-card h-full p-6">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white"><Icon name={s.icon} size={24} /></span>
                    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-600">Étape {i + 1}</p>
                    <h3 className="mt-1 text-lg font-bold text-foreground">{s.title}</h3>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* LE POINTAGE */}
        <section id="pointage" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-present-bg px-3 py-1 text-xs font-semibold text-present">
                <Icon name="check" size={14} /> Depuis son propre téléphone
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">L&apos;enseignant pointe en quelques secondes. Chacun a la preuve.</h2>
              <ul className="mt-6 space-y-4">
                {POINTAGE.map(([icon, t, d]) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={icon} size={20} /></span>
                    <div>
                      <p className="font-bold text-foreground">{t}</p>
                      <p className="text-sm text-muted">{d}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <ButtonLink href="/espace" variant="secondary" className="mt-7">Voir l&apos;espace enseignant <Icon name="arrow" size={16} /></ButtonLink>
            </Reveal>
            <Reveal delay={120} className="flex justify-center">
              <PhoneMockup />
            </Reveal>
          </div>
        </section>

        {/* PROBLÈME → SOLUTION */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <Reveal>
                <p className="text-sm font-semibold uppercase tracking-wide text-absent">Aujourd&apos;hui</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">Des heures payées, difficiles à justifier.</h2>
                <ul className="mt-6 space-y-3">
                  {[
                    "Les feuilles d'émargement se perdent ou se remplissent après coup.",
                    "Retards, cours écourtés et absences sont difficiles à suivre à la main.",
                    "En fin de mois, la paie est approximative et source de litiges.",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-foreground">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-absent-bg text-xs text-absent">✕</span>{t}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={120}>
                <div className="rounded-2xl border border-border bg-background p-6">
                  <p className="text-sm font-semibold uppercase tracking-wide text-present">Avec Pointa</p>
                  <h3 className="mt-2 text-2xl font-bold text-foreground">Chaque heure est vérifiable. Chaque paie est juste.</h3>
                  <ul className="mt-5 space-y-3">
                    {[
                      "L'enseignant pointe l'arrivée et le départ depuis son téléphone, dans l'établissement.",
                      "Les heures sont comparées à l'emploi du temps : retards et absences sont visibles.",
                      "La paie se calcule automatiquement, et l'enseignant voit le même relevé.",
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-3 text-foreground">
                        <Icon name="check" size={20} className="mt-0.5 shrink-0 text-present" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* FONCTIONNALITÉS */}
        <section id="fonctionnalites" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <Reveal><SectionTitle eyebrow="Fonctionnalités" title="Tout pour suivre les heures et payer juste." subtitle="Pointa s'adapte à votre structure : école primaire, collège, lycée, complexe scolaire, université ou centre de formation — avec votre vocabulaire (classes, promotions, groupes)." /></Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <div className="pointa-card h-full p-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={f.icon} size={22} /></span>
                  <h3 className="mt-4 font-bold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* TARIFS */}
        <section id="tarifs" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <Reveal>
              <SectionTitle eyebrow="Tarifs" title="Un prix clair, selon votre taille." subtitle={`Essai gratuit : ${FREE_TIER_MAX_TEACHERS} enseignants, sans limite de durée et sans engagement.`} />
            </Reveal>
            <div className="mt-12 grid items-start gap-6 md:grid-cols-3">
              {PLANS.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 110}>
                  <div className={`pointa-card relative flex h-full flex-col p-6 ${plan.highlighted ? "ring-2 ring-brand-500 md:shadow-xl" : ""}`}>
                    {plan.highlighted && <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Le plus choisi</span>}
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted">{plan.audience}</p>
                    <div className="mt-5">
                      {plan.priceMonthly !== null ? (
                        <p className="text-3xl font-extrabold text-foreground">
                          {formatMoney(plan.priceMonthly, false)}
                          <span className="text-base font-medium text-muted"> {BRAND.currency}/mois</span>
                        </p>
                      ) : (
                        <p className="text-3xl font-extrabold text-foreground">{plan.priceLabel}</p>
                      )}
                      <p className="mt-1 text-sm text-muted">{plan.employeesLabel}</p>
                    </div>
                    <ul className="mt-6 flex-1 space-y-2.5">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-sm text-foreground">
                          <Icon name="check" size={16} className="mt-0.5 shrink-0 text-present" />{feat}
                        </li>
                      ))}
                    </ul>
                    {plan.id === "reseau" ? (
                      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white font-semibold text-brand-700 hover:bg-surface-2">
                        <Icon name="message" size={18} /> {plan.cta}
                      </a>
                    ) : (
                      <ButtonLink href="/signup" variant={plan.highlighted ? "primary" : "secondary"} className="mt-6 w-full">Commencer gratuitement</ButtonLink>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-muted">Paiement par Mobile Money (MTN MoMo, Airtel Money). Activation le jour même.</p>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <div className="pointa-gradient relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-8">
              <h2 className="text-3xl font-extrabold text-white md:text-4xl">Mettez Pointa en place cette semaine.</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/80">Vos enseignants pointent depuis leur téléphone, vous payez les heures réelles. {FREE_TIER_MAX_TEACHERS} enseignants offerts pour commencer.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/signup" variant="secondary" size="lg">{CTA.primary}</ButtonLink>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/30 px-7 font-semibold text-white hover:bg-white/10">
                  <Icon name="message" size={18} /> Nous écrire sur WhatsApp
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* FOOTER */}
      <footer id="contact" className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div className="sm:col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted">{BRAND.tagline}</p>
          </div>
          <FooterCol title="Produit" links={[["Fonctionnement", "#fonctionnement"], ["Le pointage", "#pointage"], ["Fonctionnalités", "#fonctionnalites"], ["Tarifs", "#tarifs"]]} />
          <FooterCol title="Compte" links={[["Connexion direction", "/login"], ["Créer un compte", "/signup"], ["Espace enseignant", "/espace"]]} />
          <div>
            <h4 className="text-sm font-semibold text-foreground">Contact</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600">WhatsApp {BRAND.whatsapp}</a></li>
              <li><a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="hover:text-brand-600">Appel {BRAND.phone}</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-5 py-5 text-sm text-muted">© {new Date().getFullYear()} {BRAND.name}. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-lg text-muted">{subtitle}</p>}
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={label}><Link href={href} className="text-sm text-muted hover:text-brand-600">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

/** Aperçu de l'écran enseignant (reprend l'interface réelle de l'espace de pointage). */
function PhoneMockup() {
  return (
    <div className="w-[270px] max-w-full rounded-[2.4rem] border-[7px] border-slate-900 bg-slate-900 shadow-2xl">
      <div className="pointa-gradient overflow-hidden rounded-[1.9rem] p-5 text-white">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>07:52</span>
          <span className="inline-flex items-center gap-1"><Icon name="pin" size={12} /> Position au pointage</span>
        </div>
        <p className="mt-6 text-center text-sm text-white/70">vendredi 11 septembre</p>
        <p className="text-center text-xl font-extrabold">Bonjour Armand</p>
        <div className="mt-4 rounded-2xl bg-white/10 p-3 text-left text-xs">
          <p className="text-white/60">Mes cours aujourd&apos;hui</p>
          <p className="mt-1 flex justify-between"><span className="font-semibold">07:30 – 09:30</span><span>6e A</span></p>
          <p className="flex justify-between"><span className="font-semibold">10:00 – 12:00</span><span>5e B</span></p>
        </div>
        <div className="mt-4 rounded-2xl bg-white py-3 text-center text-sm font-bold text-brand-700">Pointer l&apos;arrivée</div>
        <div className="mt-2 rounded-2xl border border-white/40 py-3 text-center text-sm font-bold">Pointer le départ</div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-green-300">
          <Icon name="check" size={14} /> Dans l&apos;établissement · pointage validé
        </div>
      </div>
    </div>
  );
}
