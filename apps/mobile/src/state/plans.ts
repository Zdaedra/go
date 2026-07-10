// Subscription plans shown on the paywall. Store product ids are wired
// to RevenueCat later; prices here are display copy.

export interface Plan {
  id: 'monthly' | 'yearly';
  title: string;
  price: string;
  note: string | null;
  /** RevenueCat / store product identifier. */
  productId: string;
}

// Only recurring plans — no lifetime tier (a perpetual-updates promise is
// too large a commitment to make at this stage).
export const PLANS: Plan[] = [
  {
    id: 'yearly',
    title: 'Год',
    price: '$36 / год',
    note: 'выгоднее 40% — $3 в месяц',
    productId: 'go9x9_pro_yearly',
  },
  {
    id: 'monthly',
    title: 'Месяц',
    price: '$5 / месяц',
    note: null,
    productId: 'go9x9_pro_monthly',
  },
];

// Live content counts, shown on the paywall copy. Update if the base grows.
export const CONTENT = {
  openings: 43,
  branches: 229,
  tsumego: 35, // problems currently marked/visible; grows with KataGo pass
};

export const TRIAL_DAYS = 7;
