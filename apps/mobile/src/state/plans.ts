// Subscription plans shown on the paywall. Store product ids are wired
// to RevenueCat later; prices here are display copy.

export interface Plan {
  id: 'monthly' | 'yearly';
  price: string;
  /** RevenueCat / store product identifier. */
  productId: string;
}

// Only recurring plans — no lifetime tier (a perpetual-updates promise is
// too large a commitment to make at this stage).
export const PLANS: Plan[] = [
  {
    id: 'yearly',
    price: '$36',
    productId: 'go9x9_pro_yearly',
  },
  {
    id: 'monthly',
    price: '$5',
    productId: 'go9x9_pro_monthly',
  },
];

// Live content counts, shown on the paywall copy. Update if the base grows.
export const CONTENT = {
  openings: 43,
  branches: 229,
  tsumego: 1038, // KataGo-marked problems in the adaptive pool
};

export const TRIAL_DAYS = 7;
