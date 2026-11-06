"use client";

/** Dernier filet de sécurité (erreur dans la mise en page racine). */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", background: "#f7f8fb", color: "#0f172a" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>Pointa est momentanément indisponible</h1>
            <p style={{ color: "#64748b", fontSize: 14 }}>Vérifiez votre connexion internet, puis réessayez.</p>
            <button
              onClick={() => retry()}
              style={{ marginTop: 12, height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#1e46c8", color: "#fff", fontWeight: 600, fontSize: 14 }}
            >
              Réessayer
            </button>
            {error.digest && <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 16 }}>Référence : {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
