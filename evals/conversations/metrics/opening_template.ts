export type OpeningTemplateInput = {
  id: string;
  firstLine: string;
};

export type OpeningTemplateCluster = {
  ids: string[];
  sharedFingerprint: string;
  examples: string[];
};

export function findOpeningTemplateClusters(items: OpeningTemplateInput[]): OpeningTemplateCluster[] {
  const buckets = new Map<string, OpeningTemplateInput[]>();
  for (const item of items) {
    for (const fingerprint of openingFingerprints(item.firstLine)) {
      const existing = buckets.get(fingerprint) ?? [];
      existing.push(item);
      buckets.set(fingerprint, existing);
    }
  }
  const clusters = [...buckets.entries()]
    .map(([sharedFingerprint, bucket]) => ({
      ids: [...new Set(bucket.map((item) => item.id))],
      sharedFingerprint,
      examples: bucket.slice(0, 3).map((item) => item.firstLine),
    }))
    .filter((cluster) => cluster.ids.length >= 2)
    .sort((a, b) => b.ids.length - a.ids.length || b.sharedFingerprint.length - a.sharedFingerprint.length);

  const seen = new Set<string>();
  return clusters.filter((cluster) => {
    const key = cluster.ids.slice().sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function openingFingerprints(text: string) {
  const normalized = normalizeOpening(text);
  if (!normalized) return [];
  const tokens = openingTokens(normalized);
  const shingles = new Set<string>();
  for (let size = Math.min(8, tokens.length); size >= 4; size -= 1) {
    for (let index = 0; index + size <= tokens.length; index += 1) {
      shingles.add(tokens.slice(index, index + size).join(''));
    }
    if (shingles.size) break;
  }
  return [...shingles];
}

function normalizeOpening(text: string) {
  return String(text ?? '')
    .replace(/^[^:：]{1,12}[:：]\s*/, '')
    .replace(/[0-9０-９]/g, '')
    .replace(/[，,。！？!?；;：「」『』"'（）()、…—\-_\s]/g, '')
    .replace(/汗|眼淚|淚|水|茶|便當|筆蓋|鞋帶|琴譜|排練表|收條/g, '<OBJ>')
    .replace(/桌角|桌緣|桌邊|頁角|抽屜|走廊|窗邊/g, '<PLACE>')
    .replace(/抖|沒動|沒放開|停住|鬆了|太緊/g, '<STATE>')
    .trim();
}

function openingTokens(text: string) {
  const tokens = text.match(/<[^>]+>|[\u4e00-\u9fffA-Za-z]+/g) ?? [];
  return tokens.flatMap((token) => {
    if (token.startsWith('<')) return [token];
    return [...token];
  });
}
