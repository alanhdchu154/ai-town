import {
  buildSpeechIntrospectionPrompt,
  parseSpeechIntrospection,
  speechIntrospectionEnabled,
  SPEECH_INTROSPECTION_FAILED,
} from './speechIntrospectionPrompt';

const profile = {
  role: '保健室老師',
  persona: '海在別人面前協調、溫暖、有效率。',
  communicationStyle: '溫暖、聰明、略帶吐槽。',
  stakes: {
    hiddenFear: '只被當成有用的人。',
    hiddenDesire: '被看見疲憊本身。',
    emotionalVulnerability: '把累藏在「有用」後面。',
  },
  coreValues: ['清晰', '情緒誠實'],
};

describe('speech introspection (the unsaid)', () => {
  test('is disabled unless env-gated', () => {
    expect(speechIntrospectionEnabled({})).toBe(false);
    expect(speechIntrospectionEnabled({ UNDERWORLD_SPEECH_INTROSPECTION: 'true' })).toBe(true);
  });

  test('prompt grounds on the said line, soul, and asks for the three layers as JSON', () => {
    const p = buildSpeechIntrospectionPrompt(
      '海',
      '天澤',
      profile,
      '天澤：你又在替 Alan 擋事了。\n海：還好，習慣了。',
      '還好，習慣了。',
    );
    expect(p).toContain('You are 海');
    expect(p).toContain('「還好，習慣了。」');
    expect(p).toContain('隱藏的恐懼：');
    expect(p).toMatch(/innerWant/);
    expect(p).toMatch(/heldBack/);
    expect(p).toMatch(/gateReason/);
    expect(p).toMatch(/只輸出一個 JSON/);
  });

  test('parses a clean JSON object', () => {
    const r = parseSpeechIntrospection(
      '{"innerWant":"你別再一個人扛了","heldBack":"把擔心收成一句輕描淡寫","gateReason":"不想加重對方負擔"}',
    );
    expect(r).toEqual({
      innerWant: '你別再一個人扛了',
      heldBack: '把擔心收成一句輕描淡寫',
      gateReason: '不想加重對方負擔',
    });
  });

  test('tolerates code fences / surrounding prose', () => {
    const r = parseSpeechIntrospection(
      '這是我的回答：\n```json\n{"innerWant":"想說你累了","heldBack":"沒說","gateReason":"面子"}\n```',
    );
    expect(r?.innerWant).toBe('想說你累了');
  });

  test('defaults heldBack when the line was already honest', () => {
    const r = parseSpeechIntrospection('{"innerWant":"我就是想謝謝你","heldBack":"","gateReason":""}');
    expect(r?.innerWant).toBe('我就是想謝謝你');
    expect(r?.heldBack).toBe('這次沒有特別收住什麼');
  });

  test('returns null on failure marker, non-JSON, or missing innerWant', () => {
    expect(parseSpeechIntrospection(SPEECH_INTROSPECTION_FAILED)).toBeNull();
    expect(parseSpeechIntrospection('no json here')).toBeNull();
    expect(parseSpeechIntrospection('{"heldBack":"x","gateReason":"y"}')).toBeNull();
  });

  test('caps overly long fields', () => {
    const long = '字'.repeat(200);
    const r = parseSpeechIntrospection(`{"innerWant":"${long}","heldBack":"x","gateReason":"y"}`);
    expect(r!.innerWant.length).toBeLessThanOrEqual(120);
    expect(r!.innerWant.endsWith('…')).toBe(true);
  });
});
