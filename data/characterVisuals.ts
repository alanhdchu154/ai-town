export type PortraitEmotion = 'neutral' | 'smiling' | 'worried' | 'serious';

export type CharacterVisual = {
  tint: number;
  accent: number;
  label: string;
  portraitPath: string;
  portraitPaths: Record<PortraitEmotion, string>;
  renderPath?: string;
  renderPaths?: Partial<Record<PortraitEmotion, string>>;
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
const RENDER_BASE = `${ASSET_BASE}/renders`;
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
    renderPath: `${RENDER_BASE}/umi-smiling.png`,
    renderPaths: {
      worried: `${RENDER_BASE}/umi-worried.png`,
      smiling: `${RENDER_BASE}/umi-smiling.png`,
      serious: `${RENDER_BASE}/umi-serious.png`,
    },
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
    renderPath: `${RENDER_BASE}/tianze-serious.png`,
    renderPaths: {
      neutral: `${RENDER_BASE}/tianze-neutral.png`,
      smiling: `${RENDER_BASE}/tianze-smiling.png`,
      serious: `${RENDER_BASE}/tianze-serious.png`,
    },
    spritePath: `${SPRITE_BASE}/tianze.png`,
    archetypeZh: '笑著拆系統的壓力測試者',
    artDirection:
      'original anime-style full-body female mischievous elite transfer student inspired by the Tianze Ichika archetype, coral red palette, black and white school blazer, teasing sharp eyes, playful dangerous smile, human pressure-test energy, safe non-sexual character reference pose',
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
    renderPath: `${RENDER_BASE}/ichinose-serious.png`,
    renderPaths: {
      serious: `${RENDER_BASE}/ichinose-serious.png`,
    },
    spritePath: `${SPRITE_BASE}/ichinose.png`,
    archetypeZh: '用善意收債的粉紅髮溫柔惡魔',
    artDirection:
      'original anime-style full-body pink-haired former class leader with angelic demon aura, short side-swept bangs that keep the full face and both eyes clearly visible, rose and navy palette, warm possessive smile, polished student council aura, weaponized kindness, yandere-like psychological pressure without fantasy horns, safe non-sexual character reference pose',
    defaultEmotion: 'serious',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'H2SSS2H.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0xf07faf, S: 0xf0bea0, F: 0x181425, T: 0xd84f8f, C: 0x20304f, '2': 0xffffff },
  },
  Maomao: {
    tint: 0x7ec6a4,
    accent: 0x2f8a62,
    label: '貓貓',
    portraitPath: `${PORTRAIT_BASE}/maomao.png`,
    portraitPaths: portraitSet('maomao'),
    renderPath: `${RENDER_BASE}/maomao-serious.png`,
    renderPaths: {
      serious: `${RENDER_BASE}/maomao-serious.png`,
    },
    spritePath: `${SPRITE_BASE}/maomao.png`,
    archetypeZh: '冷眼診斷怪才',
    artDirection:
      'original anime-style full-body small sharp-eyed diagnostic oddball girl, dark green hair with messy low side buns, jade and charcoal school uniform, tiny herb pouch and notebook, deadpan suspicious expression, cute but not sweet, forensic school infirmary energy, safe non-sexual character reference pose',
    defaultEmotion: 'serious',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'HS2SS2H.', '.HTTTH..', '..CCCC..'],
    palette: {
      H: 0x173b32,
      S: 0xe8b68f,
      F: 0x181425,
      T: 0x2f8a62,
      C: 0x7ec6a4,
      '2': 0xffffff,
    },
  },
  Sakiko: {
    tint: 0xb8b1f0,
    accent: 0x6b5bd6,
    label: '祥子',
    portraitPath: `${PORTRAIT_BASE}/sakiko.png`,
    portraitPaths: portraitSet('sakiko'),
    renderPath: `${RENDER_BASE}/sakiko-serious.png`,
    renderPaths: {
      serious: `${RENDER_BASE}/sakiko-serious.png`,
    },
    spritePath: `${SPRITE_BASE}/sakiko.png`,
    archetypeZh: '破碎舞台大小姐',
    artDirection:
      'original anime-style full-body elegant broken stage heiress, long deep violet hair, refined purple and white school uniform, composed formal posture, one hand near a music-score folder, polished but fragile expression, beautiful controlled loneliness, safe non-sexual character reference pose',
    defaultEmotion: 'serious',
    avatar: ['..HHHH..', '.HSSSSH.', 'HSFSSFH.', 'HSSSSSH.', 'H2SSS2H.', '.HTTTH..', '..CCCC..'],
    palette: { H: 0x37235f, S: 0xe8b993, F: 0x181425, T: 0x6b5bd6, C: 0xb8b1f0, '2': 0xffffff },
  },
  'Mahiru': {
    tint: 0xffd6ec,
    accent: 0xf28abd,
    label: '真晝',
    portraitPath: `${PORTRAIT_BASE}/mahiru.png`,
    portraitPaths: portraitSet('mahiru'),
    renderPath: `${RENDER_BASE}/mahiru-worried.png`,
    renderPaths: {
      smiling: `${RENDER_BASE}/mahiru-smiling.png`,
      worried: `${RENDER_BASE}/mahiru-worried.png`,
      serious: `${RENDER_BASE}/mahiru-serious.png`,
    },
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
  if (name === 'Maomao' || name === '貓貓' || name === 'CaoCao' || name === 'Cao Cao' || name === '曹操') return CharacterVisuals.Maomao;
  if (name === 'Sakiko' || name === '祥子' || name === 'Liu Bei' || name === 'LiuBei' || name === '劉備') return CharacterVisuals.Sakiko;
  return CharacterVisuals[name];
}
