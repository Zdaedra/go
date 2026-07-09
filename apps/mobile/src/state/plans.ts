// Subscription plans shown on the paywall. Store product ids are wired
// to RevenueCat later; prices here are display copy.

export interface Plan {
  id: 'monthly' | 'yearly' | 'lifetime';
  title: string;
  price: string;
  note: string | null;
  /** RevenueCat / store product identifier. */
  productId: string;
}

export const PLANS: Plan[] = [
  {
    id: 'yearly',
    title: 'Год',
    price: '$30 / год',
    note: 'выгоднее 50% — $2.50 в месяц',
    productId: 'go9x9_pro_yearly',
  },
  {
    id: 'monthly',
    title: 'Месяц',
    price: '$5 / месяц',
    note: null,
    productId: 'go9x9_pro_monthly',
  },
  {
    id: 'lifetime',
    title: 'Навсегда',
    price: '$50 однажды',
    note: 'разовая покупка, все обновления базы',
    productId: 'go9x9_pro_lifetime',
  },
];

export const TRIAL_DAYS = 7;
