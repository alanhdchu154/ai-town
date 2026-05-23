const displayNameMap: Record<string, string> = {
  Alan: 'Alan',
  Umi: '海',
  Asuna: '明日奈',
  Mai: '麻衣',
  Mahiru: '真晝',
  'Mahiru Shiina': '真晝',
  CaoCao: '曹操',
  'Cao Cao': '曹操',
  'Liu Bei': '劉備',
  LiuBei: '劉備',
  海: '海',
  朝凪海: '海',
  明日奈: '明日奈',
  結城明日奈: '明日奈',
  麻衣: '麻衣',
  櫻島麻衣: '麻衣',
  真晝: '真晝',
  椎名真晝: '真晝',
};

export function getDisplayName(name?: string) {
  if (!name) return '';
  return displayNameMap[name] ?? name;
}

export const displayAgentName = getDisplayName;

export function displayTextWithNames(text?: string) {
  return Object.entries(displayNameMap)
    .sort(([a], [b]) => b.length - a.length)
    .reduce(
      (value, [rawName, displayName]) => value.replaceAll(rawName, displayName),
      text ?? '',
    );
}
