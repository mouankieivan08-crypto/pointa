# Pointa

Pointage des heures et calcul de la paie horaire des enseignants, pour les établissements privés d'Afrique centrale (zone FCFA).

Chaque enseignant pointe depuis **son propre téléphone**, dans l'enceinte de l'établissement : son visage est comparé à sa photo d'inscription, sa position est vérifiée au moment du pointage. Pointa compte les heures réellement faites, les retards et les absences, puis calcule la paie — le même relevé étant visible par la direction et par l'enseignant.

## Fonctionnement

| | |
|---|---|
| **Identité** | code personnel choisi par l'enseignant, verrouillage après 5 essais en 15 min |
| **Visage** | empreinte de 128 nombres calculée sur l'appareil, comparée **par le serveur** à la photo d'inscription |
| **Position** | vérifiée au seul moment du pointage, **jamais conservée** (seule la conclusion « dans l'établissement / hors zone » est enregistrée) |
| **Hors ligne** | le pointage est gardé sur le téléphone avec son heure réelle, puis envoyé à la reconnexion (72 h max) |
| **Structures** | le vocabulaire s'adapte : école primaire, collège/lycée, complexe scolaire, université, institut de formation |

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Supabase (PostgREST + Auth + Storage) · Web Push.

Toute la configuration métier est centralisée dans `config/` (`pricing.ts`, `rules.ts`, `structures.ts`, `face.ts`, `brand.ts`) — à modifier là, jamais en dur dans les pages.

## Démarrage

```bash
npm install
npm run dev
```

Variables d'environnement attendues dans `.env.local` (jamais versionné) :

| Nom | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SECRET_KEY` | clé secrète, **serveur uniquement** |
| `SESSION_SECRET` | signature des cookies de session |
| `CONSOLE_KEY` | accès à la console interne `/console` |
| `CRON_SECRET` | protège `/api/cron/notify` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | notifications Web Push |

Le schéma de la base est dans `supabase/` (à exécuter dans le SQL Editor de Supabase).

## Structure

```
app/          pages (direction /app, enseignant /espace, console /console, rapports imprimables)
components/   interface (ui/, app/, espace/, console/)
config/       règles métier et constantes
lib/          accès base, métriques, authentification, actions serveur
public/models/ modèles de reconnaissance du visage (chargés une fois, puis en cache)
supabase/     schéma SQL et migrations
```
