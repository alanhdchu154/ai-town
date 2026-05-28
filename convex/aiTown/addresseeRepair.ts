const CONVERSATION_NAME_ALIASES = [
  'Alan',
  'Umi',
  '海',
  '朝凪海',
  'Asuna',
  '明日奈',
  '明天奈',
  '結城明日奈',
  'Mai',
  '麻衣',
  '櫻島麻衣',
  'Mahiru',
  'Mahiru Shiina',
  '真晝',
  '椎名真晝',
  'CaoCao',
  'Cao Cao',
  '曹操',
  'Liu Bei',
  'LiuBei',
  '劉備',
  '曉夢同學',
  '曉夢',
];

export function repairConversationAddresseeText(
  text: string,
  authorName: string,
  otherName?: string,
) {
  const namePattern = CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|');
  const leadingName = new RegExp(`(^|\\n+)([\\s「『（(]*?)(${namePattern})([，,、：:])`, 'g');
  const authorAliases = conversationNameAliasesFor(authorName);

  if (!otherName) {
    return text.replace(leadingName, (match, lineStart: string, prefix: string, name: string) => {
      return authorAliases.has(name) ? `${lineStart}${prefix}` : match;
    });
  }

  const allowed = conversationNameAliasesFor(otherName);
  const repaired = text.replace(
    leadingName,
    (match, lineStart: string, prefix: string, name: string, punctuation: string) => {
      if (allowed.has(name) && !authorAliases.has(name)) return match;
      return `${lineStart}${prefix}${displayConversationName(otherName)}${punctuation}`;
    },
  );
  return stripLeadingConversationVocatives(
    repairTerminalVocativeAddressee(
      repairEmbeddedThanksFrameAddressee(repaired, allowed, authorAliases, otherName),
      allowed,
      authorAliases,
      otherName,
    ),
  );
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
    case 'Asuna':
    case '結城明日奈':
      return '明日奈';
    case 'Mai':
    case '櫻島麻衣':
      return '麻衣';
    case 'Mahiru':
    case 'Mahiru Shiina':
    case '椎名真晝':
      return '真晝';
    case 'CaoCao':
    case 'Cao Cao':
      return '曹操';
    case 'Liu Bei':
    case 'LiuBei':
      return '劉備';
    default:
      return name;
  }
}

function conversationNameAliasesFor(name: string) {
  const displayName = displayConversationName(name);
  const aliases = new Set([name, displayName]);
  if (displayName === '海') aliases.add('Umi').add('朝凪海');
  if (displayName === '明日奈') aliases.add('Asuna').add('結城明日奈').add('明天奈');
  if (displayName === '麻衣') aliases.add('Mai').add('櫻島麻衣');
  if (displayName === '真晝') aliases.add('Mahiru').add('Mahiru Shiina').add('椎名真晝');
  if (displayName === '曹操') aliases.add('CaoCao').add('Cao Cao');
  if (displayName === '劉備') aliases.add('Liu Bei').add('LiuBei');
  return aliases;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
