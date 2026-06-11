const CONVERSATION_NAME_ALIASES = [
  'Alan',
  'Umi',
  '海',
  '朝凪海',
  'Tianze',
  '天澤',
  '明天奈',
  '天澤',
  'Ichinose',
  '一之瀨',
  '一之瀨',
  'Mahiru',
  'Mahiru Shiina',
  '真晝',
  '明晝',
  '阿真晝',
  '椎名真晝',
  'Maomao',
  '貓貓',
  'CaoCao',
  'Cao Cao',
  '曹操',
  'Sakiko',
  '祥子',
  'Liu Bei',
  'LiuBei',
  '劉備',
  '曉夢同學',
  '曉夢',
];
const REPAIRED_LEADING_ADDRESSEE_MARKER = '__repaired_leading_addressee__';

export function repairConversationAddresseeText(
  text: string,
  authorName: string,
  otherName?: string,
) {
  const normalizedText = normalizeKnownNameArtifacts(text);
  const namePattern = CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|');
  const leadingName = new RegExp(`(^|\\n+)([\\s「『（(]*?)(${namePattern})([，,、：:])`, 'g');
  const authorAliases = conversationNameAliasesFor(authorName);

  if (!otherName) {
    return normalizedText.replace(leadingName, (match, lineStart: string, prefix: string, name: string) => {
      return authorAliases.has(name) ? `${lineStart}${prefix}` : match;
    });
  }

  const allowed = conversationNameAliasesFor(otherName);
  const repaired = normalizedText.replace(
    leadingName,
    (match, lineStart: string, prefix: string, name: string, punctuation: string) => {
      if (allowed.has(name) && !authorAliases.has(name)) return match;
      return `${lineStart}${prefix}${REPAIRED_LEADING_ADDRESSEE_MARKER}${displayConversationName(otherName)}${punctuation}`;
    },
  );
  return stripLeadingConversationVocatives(
    repairTerminalVocativeAddressee(
      repairEmbeddedThanksFrameAddressee(repaired, allowed, authorAliases, otherName),
      allowed,
      authorAliases,
      otherName,
    ),
  ).replaceAll(REPAIRED_LEADING_ADDRESSEE_MARKER, '');
}

function stripLeadingConversationVocatives(text: string) {
  const namePattern = CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|');
  const leadingName = new RegExp(`(^|\\n+)([\\s「『（(]*?)(${namePattern})([，,、：:])\\s*`, 'g');
  return text.replace(leadingName, (_match, lineStart: string, prefix: string) => `${lineStart}${prefix}`);
}

function repairEmbeddedThanksFrameAddressee(
  text: string,
  allowed: Set<string>,
  authorAliases: Set<string>,
  otherName: string,
) {
  const replacement = displayConversationName(otherName);
  const namePattern = CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|');
  const thanksFrame = new RegExp(
    `(謝謝|感謝|多謝)(\\s*)(${namePattern})(?=(?:提點|提醒|幫忙|幫我|陪|照顧|關心))`,
    'g',
  );
  return text.replace(thanksFrame, (match, prefix: string, spacing: string, name: string) => {
    if (allowed.has(name) && !authorAliases.has(name)) return match;
    return `${prefix}${spacing}${replacement}`;
  });
}

function repairTerminalVocativeAddressee(
  text: string,
  allowed: Set<string>,
  authorAliases: Set<string>,
  otherName: string,
) {
  const replacement = displayConversationName(otherName);
  const namePattern = CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|');
  const terminalVocative = new RegExp(
    `([，,、]\\s*)((?:${namePattern}){1,3})(\\s*[？?。.!！])$`,
  );
  return text.replace(terminalVocative, (match, prefix: string, nameCluster: string, suffix: string) => {
    const names = splitNameCluster(nameCluster);
  if (
    names.length === 1 &&
    allowed.has(names[0]) &&
    !authorAliases.has(names[0])
  ) {
      return `${prefix}${replacement}${suffix}`;
  }
    if (!names.length || names.every((name) => !allowed.has(name) || authorAliases.has(name))) {
      return `${prefix}${replacement}${suffix}`;
    }
    return `${prefix}${replacement}${suffix}`;
  });
}

function splitNameCluster(cluster: string) {
  const namePattern = new RegExp(CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|'), 'g');
  return [...cluster.matchAll(namePattern)].map((match) => match[0]);
}

function displayConversationName(name: string) {
  switch (name) {
    case 'Umi':
    case '朝凪海':
      return '海';
    case 'Tianze':
    case '天澤':
    case '天擇':
    case '天擇一夏':
    case '天澤一夏':
      return '天澤';
    case 'Ichinose':
    case '一之瀨':
    case '一之瀨帆波':
    case '黑化一之瀨':
      return '一之瀨';
    case 'Mahiru':
    case 'Mahiru Shiina':
    case '椎名真晝':
    case '明晝':
    case '阿真晝':
      return '真晝';
    case 'Maomao':
    case '貓貓':
    case 'CaoCao':
    case 'Cao Cao':
    case '曹操':
      return '貓貓';
    case 'Sakiko':
    case '祥子':
    case 'Liu Bei':
    case 'LiuBei':
    case '劉備':
      return '祥子';
    default:
      return name;
  }
}

function conversationNameAliasesFor(name: string) {
  const displayName = displayConversationName(name);
  const aliases = new Set([name, displayName]);
  if (displayName === '海') aliases.add('Umi').add('朝凪海');
  if (displayName === '天澤') aliases.add('Tianze').add('天澤').add('明天奈').add('天擇').add('天擇一夏').add('天澤一夏');
  if (displayName === '一之瀨') aliases.add('Ichinose').add('一之瀨').add('一之瀨帆波').add('黑化一之瀨');
  if (displayName === '真晝') aliases.add('Mahiru').add('Mahiru Shiina').add('椎名真晝').add('明晝').add('阿真晝');
  if (displayName === '貓貓') aliases.add('Maomao').add('CaoCao').add('Cao Cao').add('曹操');
  if (displayName === '祥子') aliases.add('Sakiko').add('Liu Bei').add('LiuBei').add('劉備');
  return aliases;
}

function normalizeKnownNameArtifacts(text: string) {
  return text.replace(/阿真晝/g, '真晝').replace(/明晝/g, '真晝');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
