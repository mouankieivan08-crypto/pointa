"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "@/lib/actions";

/**
 * Formulaire relié à une action serveur, SANS remise à zéro du formulaire.
 *
 * React 19 réinitialise le formulaire après une action passée à `<form action={…}>` :
 * les `<select>` reviennent à leur première option et les fichiers choisis disparaissent,
 * alors que l'état React, lui, n'a pas changé. Résultat : ce qui est affiché ne correspond
 * plus à ce qui sera envoyé — et une photo déjà choisie est perdue dès la moindre erreur.
 *
 * On envoie donc le formulaire nous-mêmes : la validation du navigateur (champs requis)
 * fonctionne toujours, mais rien n'est réinitialisé.
 */
export function useActionForm(
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>,
  initial: ActionState = {},
) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(action, initial);

  /** `onSubmit={submit()}` — ou `onSubmit={submit((fd) => fd.set("photo", file))}`. */
  const submit =
    (fill?: (fd: FormData) => void) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      fill?.(fd);
      startTransition(() => dispatch(fd));
    };

  return { state, pending, submit };
}
