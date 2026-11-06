import { redirect } from "next/navigation";

// L'approche « tablette partagée » a été remplacée par l'espace enseignant
// (chaque enseignant pointe depuis son propre téléphone).
export default function TabletRedirect() {
  redirect("/espace");
}
