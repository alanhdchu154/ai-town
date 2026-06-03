const displayNameMap: Record<string, string> = {
  Alan: 'Alan',
  Umi: '海',
  Tianze: '天澤',
  Ichinose: '一之瀨',
  Mahiru: '真晝',
  'Mahiru Shiina': '真晝',
  CaoCao: '曹操',
  'Cao Cao': '曹操',
  'Liu Bei': '劉備',
  LiuBei: '劉備',
  海: '海',
  朝凪海: '海',
  天澤: '天澤',
  天澤一夏: '天澤',
  天擇: '天澤',
  天擇一夏: '天澤',
  一之瀨: '一之瀨',
  一之瀨帆波: '一之瀨',
  黑化一之瀨: '一之瀨',
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
