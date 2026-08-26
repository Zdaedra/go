// Каталог задач: маппинг id категорий/секций из tsumego.json в i18n-ключи.
// Русские title из данных больше не показываются напрямую.

const norm = (id: string) => id.replace(/-/g, '_');

export const categoryKey = (catId: string) => `cat_${norm(catId)}`;
export const sectionKey = (catId: string, secId: string) =>
  `sec_${norm(catId)}_${norm(secId)}`;

/** Заголовок задачи из данных: у классики это номера (читаемы всюду),
    у seed-набора — русские названия; вне ru их не показываем. */
export function displayProblemTitle(title: string | undefined, lang: string): string | null {
  if (!title) return null;
  if (lang === 'ru') return title;
  return /[А-Яа-яЁё]/.test(title) ? null : title;
}
