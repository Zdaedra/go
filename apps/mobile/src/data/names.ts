// Opening display names. For now we keep the author's names from the
// source database as-is; rename/localize later by editing ONLY this file.
// Key: `${family}/${opening}` slug from the database.

const overrides: Record<string, string> = {
  // 'tengen/curveball': 'Кручёный мяч',   // example of a future rename
};

export function openingDisplayName(family: string, opening: string, dbName: string): string {
  return overrides[`${family}/${opening}`] ?? dbName;
}

export const familyNamesRu: Record<string, string> = {
  tengen: 'Тэнгэн',
  hoshi: 'Хоси',
  takamoku: 'Такамоку',
  territorial: 'Территориальные',
};
