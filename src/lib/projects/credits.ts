export const CREDITS_GRANT = 50;
export const CREDIT_COST = 1;

export function creditsLabel(remaining: number, grant = CREDITS_GRANT) {
  return `${remaining} / ${grant}`;
}
