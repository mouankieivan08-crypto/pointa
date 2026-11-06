/** Squelette affiché pendant le chargement d'une page (connexions mobiles lentes). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-surface-2" />
    </div>
  );
}
