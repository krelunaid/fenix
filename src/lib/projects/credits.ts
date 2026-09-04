export const CREDITS_GRANT = 100;
export const CREDIT_COST = 1;
export const CREATE_COST = 4;
export const ITERATE_COST = 2;

export function creditsLabel(remaining: number, grant = CREDITS_GRANT) {
  return `${remaining} / ${grant}`;
}
