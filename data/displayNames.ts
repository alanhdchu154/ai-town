const displayNameMap: Record<string, string> = {
  Alan: 'Alan',
  Umi: '海',
  Tianze: '天澤',
  Ichinose: '一之瀨',
  Mahiru: '真晝',
  'Mahiru Shiina': '真晝',
  Maomao: '貓貓',
  Sakiko: '祥子',
  CaoCao: '貓貓',
  'Cao Cao': '貓貓',
  'Liu Bei': '祥子',
  LiuBei: '祥子',
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
  曹操: '貓貓',
  劉備: '祥子',
  貓貓: '貓貓',
  祥子: '祥子',
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
