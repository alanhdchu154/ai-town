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

// Vite is configured with a non-root base in this project. Build asset URLs
// from BASE_URL so dev, production, and preview all resolve the same files.
const ASSET_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const PORTRAIT_BASE = `${ASSET_BASE}/portraits`;
const SPRITE_BASE = `${ASSET_BASE}/sprites`;

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
    spritePath: `${SPRITE_BASE}/alan.png`,
    archetypeZh: '混亂但冷靜的科技校長',
    artDirection:
      'modern anime male protagonist, black/navy palette, hoodie, school lanyard, laptop, intelligent but slightly sleep-deprived, thoughtful half-smile, chaotic AI builder energy',
    defaultEmotion: 'neutral',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFTH', 'HSFFSFTH', 'HS2SS2TH', '.HSTTSH.', '..CCCC..'],
    palette: { H: 0x5a3926, S: 0xf2b27d, F: 0x181425, T: 0x6a7ee8, C: 0xffd15c, '2': 0xffffff },
  },
  Umi: {
    tint: 0xb9c7df,
    accent: 0x2f66b2,
    label: '海',
    portraitPath: `${PORTRAIT_BASE}/umi.png`,
    portraitPaths: portraitSet('umi'),
    spritePath: `${SPRITE_BASE}/umi.png`,
    archetypeZh: '聰明吐槽系助理校長',
    artDirection:
      'original anime-style full-body Umi companion with short dark navy bob hair, pink-purple eyes, light gray school cardigan or blazer, white blouse, small blue ribbon bow, navy pleated skirt, dark knee-high socks, brown loafers, clever gentle teasing smile, safe non-sexual character reference pose',
    defaultEmotion: 'smiling',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'HS2SS2H.', '.HSTTH..', '..CCCC..'],
    palette: { H: 0x151c3a, S: 0xf4c7a1, F: 0xbb4d8f, T: 0x2f66b2, C: 0xd8dee8, '2': 0xffffff },
  },
  Tianze: {
    tint: 0xff6f7d,
    accent: 0xd83a45,
    label: '天澤',
    portraitPath: `${PORTRAIT_BASE}/tianze.png`,
    portraitPaths: portraitSet('tianze'),
    spritePath: `${SPRITE_BASE}/tianze.png`,
    archetypeZh: '笑著拆系統的壓力測試者',
    artDirection:
      'original anime-style full-body mischievous elite transfer student, coral red palette, black and white school blazer, teasing sharp eyes, playful dangerous smile, human pressure-test energy, safe non-sexual character reference pose',
    defaultEmotion: 'serious',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'H2SSS2H.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0xd64a4f, S: 0xf1b998, F: 0x181425, T: 0xd83a45, C: 0x111318, '2': 0xffffff },
  },
  Ichinose: {
    tint: 0xff9ec8,
    accent: 0xd84f8f,
    label: '一之瀨',
    portraitPath: `${PORTRAIT_BASE}/ichinose.png`,
    portraitPaths: portraitSet('ichinose'),
    spritePath: `${SPRITE_BASE}/ichinose.png`,
    archetypeZh: '用善意收債的粉紅髮溫柔惡魔',
    artDirection:
      'original anime-style full-body pink-haired former class leader with angelic demon aura, short side-swept bangs that keep the full face and both eyes clearly visible, rose and navy palette, warm possessive smile, polished student council aura, weaponized kindness, yandere-like psychological pressure without fantasy horns, safe non-sexual character reference pose',
    defaultEmotion: 'serious',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'H2SSS2H.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0xf07faf, S: 0xf0bea0, F: 0x181425, T: 0xd84f8f, C: 0x20304f, '2': 0xffffff },
  },
  CaoCao: {
    tint: 0xff8f8f,
    accent: 0xd04444,
    label: '曹操',
    portraitPath: `${PORTRAIT_BASE}/caocao.png`,
    portraitPaths: portraitSet('caocao'),
    spritePath: `${SPRITE_BASE}/caocao.png`,
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
    spritePath: `${SPRITE_BASE}/liubei.png`,
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
    spritePath: `${SPRITE_BASE}/mahiru.png`,
    archetypeZh: '溫柔治癒系學生事務助理',
    artDirection:
      'original anime-style full-body gentle student affairs assistant, cream/pink palette, soft warm lighting, cardigan counselor vibe, kind concerned expression, emotionally safe presence, safe non-sexual character reference pose',
    defaultEmotion: 'worried',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'HS2S2SH.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0xf2cf78, S: 0xf4c6a6, F: 0x181425, T: 0xf28abd, C: 0xfff2d5, '2': 0xffffff },
  },
};

export function characterVisualFor(name?: string): CharacterVisual | undefined {
  if (!name) return undefined;
  if (name === '海' || name === '朝凪海') return CharacterVisuals.Umi;
  if (name === '天澤' || name === '天澤一夏' || name === '天擇' || name === '天擇一夏') return CharacterVisuals.Tianze;
  if (name === '一之瀨' || name === '一之瀨帆波' || name === '黑化一之瀨') return CharacterVisuals.Ichinose;
  if (name === 'Mahiru' || name === 'Mahiru Shiina' || name === '真晝' || name === '椎名真晝') return CharacterVisuals['Mahiru'];
  if (name === 'Cao Cao' || name === '曹操') return CharacterVisuals.CaoCao;
  if (name === '劉備') return CharacterVisuals['Liu Bei'];
  if (name === 'LiuBei') return CharacterVisuals['Liu Bei'];
  return CharacterVisuals[name];
}
