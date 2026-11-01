/** Valeur temporaire utilisée lors du premier déploiement, avant la configuration réelle des secrets. */
export const PLACEHOLDER = "A_CONFIGURER";

export function isConfigured(value: string | undefined): value is string {
  const trimmed = value?.trim();
  return Boolean(trimmed) && trimmed !== PLACEHOLDER;
}
