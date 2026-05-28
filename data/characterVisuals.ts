export type PortraitEmotion = 'neutral' | 'smiling' | 'worried' | 'serious';

export type CharacterVisual = {
  tint: number;
  accent: number;
  label: string;
  portraitPath: string;
  portraitPaths: Record<PortraitEmotion, string>;
  spritePath: string;
  archetypeZh: string;
  artDirection: string;
  defaultEmotion: PortraitEmotion;
  avatar: string[];
  palette: Record<string, number>;
};

// Vite is configured with `base: '/ai-town'` (see vite.config.ts), so any
// absolute asset URL referenced from React must include that prefix or it
// will 404 in both dev and production. This is the same pattern used by
// data/characters.ts for sprite textures.
const PORTRAIT_BASE = '/ai-town/portraits';

function portraitSet(slug: string): Record<PortraitEmotion, string> {
  return {
    neutral: `${PORTRAIT_BASE}/${slug}.png`,
    smiling: `${PORTRAIT_BASE}/${slug}-smiling.png`,
    worried: `${PORTRAIT_BASE}/${slug}-worried.png`,
    serious: `${PORTRAIT_BASE}/${slug}-serious.png`,
  };
}

export const CharacterVisuals: Record<string, CharacterVisual> = {
  Alan: {
    tint: 0xf5d06a,
    accent: 0xffd15c,
    label: 'Alan',
    portraitPath: `${PORTRAIT_BASE}/alan.png`,
    portraitPaths: portraitSet('alan'),
    spritePath: '/sprites/alan.png',
    archetypeZh: '混亂但冷靜的科技校長',
    artDirection:
      'modern anime male protagonist, black/navy palette, hoodie, school lanyard, laptop, intelligent but slightly sleep-deprived, thoughtful half-smile, chaotic AI builder energy',
    defaultEmotion: 'neutral',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFTH', 'HSFFSFTH', 'HS2SS2TH', '.HSTTSH.', '..CCCC..'],
    palette: { H: 0x5a3926, S: 0xf2b27d, F: 0x181425, T: 0x6a7ee8, C: 0xffd15c, '2': 0xffffff },
  },
  Umi: {
    tint: 0x8fd3ff,
    accent: 0x4aa3ff,
    label: '海',
    portraitPath: `${PORTRAIT_BASE}/umi.png`,
    portraitPaths: portraitSet('umi'),
    spritePath: '/sprites/umi.png',
    archetypeZh: '聰明吐槽系助理校長',
    artDirection:
      'original anime-style witty assistant principal, teal/blue palette, sharp warm eyes, clever teasing smile, elegant school office outfit, confident posture, emotionally intelligent vibe',
    defaultEmotion: 'smiling',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'HS2SS2H.', '.HSTTH..', '..CCCC..'],
    palette: { H: 0x1d6f8f, S: 0xf4c7a1, F: 0x102a43, T: 0x2dd4bf, C: 0x8fd3ff, '2': 0xffffff },
  },
  Asuna: {
    tint: 0xffb48a,
    accent: 0xf06d4f,
    label: '明日奈',
    portraitPath: `${PORTRAIT_BASE}/asuna.png`,
    portraitPaths: portraitSet('asuna'),
    spritePath: '/sprites/asuna.png',
    archetypeZh: '紀律明快的執行助理',
    artDirection:
      'original anime-style disciplined executive assistant, warm orange/red palette, clean uniform jacket, composed confident expression, organized dependable leader energy',
    defaultEmotion: 'serious',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'HS2SS2H.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0xa85b2a, S: 0xf3bc92, F: 0x181425, T: 0xe85f4d, C: 0xfff2df, '2': 0xffffff },
  },
  Mai: {
    tint: 0xd8a7ff,
    accent: 0x9d6adf,
    label: '麻衣',
    portraitPath: `${PORTRAIT_BASE}/mai.png`,
    portraitPaths: portraitSet('mai'),
    spritePath: '/sprites/mai.png',
    archetypeZh: '冷靜成熟的策略顧問',
    artDirection:
      'original anime-style mature strategic advisor, purple/black palette, elegant long dark hair, dry humor expression, calm analytical gaze, sophisticated social-sim aura',
    defaultEmotion: 'serious',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'H2SSS2H.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0x17111f, S: 0xe8b894, F: 0x181425, T: 0x7d5bbf, C: 0xd8a7ff, '2': 0xffffff },
  },
  CaoCao: {
    tint: 0xff8f8f,
    accent: 0xd04444,
    label: '曹操',
    portraitPath: `${PORTRAIT_BASE}/caocao.png`,
    portraitPaths: portraitSet('caocao'),
    spritePath: '/sprites/caocao.png',
    archetypeZh: '自信野心派學生政治家',
    artDirection:
      'original anime-style ambitious student strategist, red/black palette, confident political smile, sharp eyes, subtle intimidating aura, student council power styling',
    defaultEmotion: 'smiling',
    avatar: ['..RRRR..', '.RHHHHR.', 'HSSSSSH.', 'HSFFSSH.', 'H2SSS2H.', '.HTTTH..', '..CCCC..'],
    palette: {
      R: 0xb72f35,
      H: 0x191826,
      S: 0xdca078,
      F: 0x181425,
      T: 0x9e2f38,
      C: 0xd04444,
      '2': 0xffffff,
    },
  },
  'Liu Bei': {
    tint: 0x9fe6a0,
    accent: 0x49b96a,
    label: '劉備',
    portraitPath: `${PORTRAIT_BASE}/liubei.png`,
    portraitPaths: portraitSet('liubei'),
    spritePath: '/sprites/liubei.png',
    archetypeZh: '溫暖凝聚型學生盟友',
    artDirection:
      'original anime-style warm alliance leader, green/gold palette, trustworthy smile, approachable charisma, community-oriented energy, gentle expressive eyes',
    defaultEmotion: 'smiling',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'HS2S2SH.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0x3a4a2a, S: 0xedbd8f, F: 0x181425, T: 0x42a85f, C: 0x9fe6a0, '2': 0xffffff },
  },
  'Mahiru': {
    tint: 0xffd6ec,
    accent: 0xf28abd,
    label: '真晝',
    portraitPath: `${PORTRAIT_BASE}/mahiru.png`,
    portraitPaths: portraitSet('mahiru'),
    spritePath: '/sprites/mahiru.png',
    archetypeZh: '溫柔治癒系學生事務助理',
    artDirection:
      'original anime-style gentle student affairs assistant, cream/pink palette, soft warm lighting, cardigan counselor vibe, kind concerned expression, emotionally safe presence',
    defaultEmotion: 'worried',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'HS2S2SH.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0xf2cf78, S: 0xf4c6a6, F: 0x181425, T: 0xf28abd, C: 0xfff2d5, '2': 0xffffff },
  },
};

export function characterVisualFor(name?: string): CharacterVisual | undefined {
  if (!name) return undefined;
  if (name === '海' || name === '朝凪海') return CharacterVisuals.Umi;
  if (name === '明日奈' || name === '結城明日奈') return CharacterVisuals.Asuna;
  if (name === '麻衣' || name === '櫻島麻衣') return CharacterVisuals.Mai;
  if (name === 'Mahiru' || name === 'Mahiru Shiina' || name === '真晝' || name === '椎名真晝') return CharacterVisuals['Mahiru'];
  if (name === 'Cao Cao' || name === '曹操') return CharacterVisuals.CaoCao;
  if (name === '劉備') return CharacterVisuals['Liu Bei'];
  if (name === 'LiuBei') return CharacterVisuals['Liu Bei'];
  return CharacterVisuals[name];
}
