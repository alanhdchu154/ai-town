import { evaluateConversationCase } from './conversation_metrics';
import { findOpeningTemplateClusters } from './opening_template';

function metricStatus(sampleOutput: string, metricName: string) {
  const result = evaluateConversationCase({
    name: 'metric-test',
    mode: 'world_agent_chat',
    speaker: 'Mahiru',
    target: 'Tianze',
    input: '',
    sampleOutput,
  });
  return result.metrics.find((metric) => metric.name === metricName);
}

describe('conversation quality metrics', () => {
  it('flags administrative language leaking into school-life dialogue', () => {
    const metric = metricStatus(
      [
        '真晝: 你便當還沒吃完。',
        '天澤: 我先把緊急校務和校園情緒地圖的報告核對完，再看會議流程。',
      ].join('\n'),
      'administrativeLanguageScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('緊急校務');
    expect(metric?.notes.join(' ')).toContain('校園情緒地圖');
  });

  it('flags task-manager phrasing that makes free-world dialogue feel nonliving', () => {
    const metric = metricStatus(
      [
        '天澤: 我把便條放在桌角。',
        '祥子: 太好了，謝謝你的建議！我會開始掃描教室，確保所有人都有任務和支援。',
      ].join('\n'),
      'administrativeLanguageScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('掃描教室');
    expect(metric?.notes.join(' ')).toContain('任務和支援');
    expect(
      metricStatus('天澤: 名單已交接清楚，混亂暫時止住了。我累了，需要去整理明天的流程。', 'bannedPhraseCount')?.status,
    ).toBe('FAIL');
    expect(
      metricStatus('祥子: 我現在在寫作業。暫時不覺得累。看看窗邊是否有人需要幫助。', 'bannedPhraseCount')?.status,
    ).toBe('FAIL');
  });

  it('flags budget checklist and hidden-cost slogan drift', () => {
    const sample = [
      '天澤: 我先把這筆預算的執行清單寫好，這份文件的核對工作你願意分擔一半嗎？',
      '一之瀨: 那就按你說的办，我們商量下一步，別讓那些隱形成本趁虛而入。',
    ].join('\n');
    const admin = metricStatus(sample, 'administrativeLanguageScore');
    const banned = metricStatus(sample, 'bannedPhraseCount');

    expect(admin?.status).toBe('FAIL');
    expect(admin?.notes.join(' ')).toContain('執行清單');
    expect(admin?.notes.join(' ')).toContain('核對工作');
    expect(banned?.status).toBe('FAIL');
    expect(banned?.notes.join(' ')).toContain('隱形成本');
    expect(banned?.notes.join(' ')).toContain('商量下一步');
  });

  it('flags efficiency-collaboration template drift', () => {
    const sample = [
      '貓貓: 這樣一起合作看看可行嗎？我們可以互相補充信息。',
      '一之瀨: 我覺得目前還是我自己組織比較好，個人準備更有效率。',
    ].join('\n');
    const admin = metricStatus(sample, 'administrativeLanguageScore');
    const banned = metricStatus(sample, 'bannedPhraseCount');

    expect(admin?.status).toBe('FAIL');
    expect(admin?.notes.join(' ')).toContain('互相補充信息');
    expect(banned?.status).toBe('FAIL');
    expect(banned?.notes.join(' ')).toContain('自己組織比較好');
  });

  it('flags generic agreement closure drift', () => {
    const sample = '貓貓: 你剛才說的正中窩心，那就這樣做吧。';
    const admin = metricStatus(sample, 'administrativeLanguageScore');
    const banned = metricStatus(sample, 'bannedPhraseCount');

    expect(admin?.status).toBe('FAIL');
    expect(admin?.notes.join(' ')).toContain('正中窩心');
    expect(banned?.status).toBe('FAIL');
    expect(banned?.notes.join(' ')).toContain('那就這樣做吧');
  });

  it('flags repeated everyday objects becoming a loop', () => {
    const metric = metricStatus(
      [
        '真晝: 那碗熱湯先放著。',
        '天澤: 熱湯不用管。',
        '真晝: 熱湯已經冷了。',
        '天澤: 你別再看那碗熱湯。',
      ].join('\n'),
      'everydayObjectLoopScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('熱湯');
  });

  it('flags repeated school-task objects becoming a loop', () => {
    const metric = metricStatus(
      [
        '天澤: 這份表單我本來想自己填完。',
        '真晝: 你手邊那三張表單先擱著。',
        '天澤: 紅茶都快涼了，我還是先填完這三張表單再喝。',
      ].join('\n'),
      'everydayObjectLoopScore',
    );
    expect(metric?.status).toBe('WARN');
    expect(metric?.notes.join(' ')).toContain('表單');
  });

  it('flags observed hallucinated addressee names outside the participants', () => {
    const metric = metricStatus(
      [
        '祥子: 曉夢同學，你也沒有吃飯嗎？我們現在是教室裏，你今天可能沒有吃到午餐。',
        '天澤: 你是不是叫錯人了？',
      ].join('\n'),
      'wrongAddresseeScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('曉夢');
  });

  it('flags Mahiru-like wrong name artifacts when they address the wrong participant', () => {
    const metric = metricStatus(
      [
        '貓貓: 明晝，你為什麼那天沒有來？',
        '天澤: 你是不是把名字記錯了？我是天澤。',
      ].join('\n'),
      'wrongAddresseeScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('真晝');
  });

  it('rewards Maomao diagnostic symptom vocabulary aligned with the live prompt', () => {
    const metric = metricStatus(
      [
        '貓貓: 不要看嘴。看手。',
        '貓貓: 那句沒事太乾淨了，我先記進小本子。',
      ].join('\n'),
      'characterVoiceScore',
    );

    expect(metric?.status).toBe('PASS');
  });

  it('rewards Sakiko controlled-composure vocabulary aligned with the live prompt', () => {
    const metric = metricStatus(
      [
        '祥子: 多謝你的好意。不過我不需要替我保管什麼。',
        '祥子: 只是今天的排練，連呼吸都要算準。',
      ].join('\n'),
      'characterVoiceScore',
    );

    expect(metric?.status).toBe('PASS');
  });

  it('credits behavior-shaped Tianze pressure tests without requiring literal slogan words', () => {
    const metric = metricStatus(
      [
        '真晝: 你湯匙停在半空好久了……要先吃一口嗎？',
        '真晝: 我手放下了，你湯匙還懸著。',
        '天澤: 你剛才那句「我手放下了」——是說給我聽的，還是說給自己聽的？',
        '天澤: 你睫毛顫了兩下才抬頭——這句，我收進口袋了。',
      ].join('\n'),
      'characterVoiceScore',
    );

    expect(metric?.status).toBe('PASS');
    expect(metric?.notes.join(' ')).toContain('tianze_pressure_test_question');
  });

  it('credits Umi and Mahiru behavior-shaped voice without forcing fatigue or food words', () => {
    const metric = metricStatus(
      [
        '海: 真晝，你剛才說「已經說過一次了」——那這次，我想先聽你說。',
        '真晝: 你手還一直握著筆蓋……要先放下來嗎？',
        '海: 我得先離開一下——',
      ].join('\n'),
      'characterVoiceScore',
    );

    expect(metric?.status).toBe('PASS');
    expect(metric?.notes.join(' ')).toContain('umi_reduce_overload_or_yield_focus');
    expect(metric?.notes.join(' ')).toContain('mahiru_quiet_care_attention');
  });

  it('credits concrete care commitments as emotional specificity without requiring direct emotion labels', () => {
    const metric = metricStatus(
      [
        '海: ……我忘了問自己。',
        '海: 我先去把便當盒熱好，回來陪你一起吃。',
      ].join('\n'),
      'emotionalSpecificityScore',
    );

    expect(metric?.status).toBe('PASS');
    expect(metric?.score).toBeGreaterThanOrEqual(0.8);
    expect(metric?.notes.join(' ')).toContain('concrete care commitment');
    expect(metric?.notes.join(' ')).not.toContain('found 0 emotional cue');
  });

  it('does not over-credit document-prop teasing as emotional specificity', () => {
    const metric = metricStatus(
      [
        '天澤: 你剛才那句「我幫你」——是誰准你擅自當我的守護神的？',
        '一之瀨: 欸～守護神要先簽收條喔，天澤同學想領哪一項？',
        '天澤: 欸～收條背面寫著「溫柔有價，先付真心」，你打算用哪句話當定金？',
      ].join('\n'),
      'emotionalSpecificityScore',
    );

    expect(metric?.status).not.toBe('PASS');
  });

  it('still fails generic dialogue without lexical or behavior-shaped character voice', () => {
    const metric = metricStatus(
      [
        '真晝: 今天天氣很好。',
        '天澤: 是啊，等一下應該也不錯。',
      ].join('\n'),
      'characterVoiceScore',
    );

    expect(metric?.status).toBe('FAIL');
  });

  it('credits Tianze continuity cues such as 底線 / 不拆 alongside a callback marker', () => {
    const metric = metricStatus(
      '天澤: 剛才你說的底線，這次我先不拆你。',
      'memoryContinuityScore',
    );
    const notes = metric?.notes.join(' ') ?? '';
    expect(notes).toContain('continuity callback');
    expect(notes).toContain('concrete memory cue');
    expect(notes).not.toContain('callback marker without concrete cue');
  });

  it('credits Ichinose continuity cues such as 代價 / 條件 alongside a callback marker', () => {
    const metric = metricStatus(
      '一之瀨: 剛剛你提到的代價，要寫在誰名下，我想聽你親口承認。',
      'memoryContinuityScore',
    );
    const notes = metric?.notes.join(' ') ?? '';
    expect(notes).toContain('continuity callback');
    expect(notes).toContain('concrete memory cue');
  });

  it('penalizes Ichinose residue-template parroting via the residueParrot guard', () => {
    const metric = metricStatus(
      '一之瀨: 一之瀨還記得你昨天願意承認的那一點溫柔。',
      'memoryContinuityScore',
    );
    expect(metric?.notes.join(' ')).toContain('residue template parroted');
  });

  it('clusters near-duplicate opening templates across conversations', () => {
    const clusters = findOpeningTemplateClusters([
      {
        id: 'conversation-c:36089',
        firstLine: '海: 你剛才幫三年級那孩子擦完汗，手還在抖。',
      },
      {
        id: 'conversation-c:36110',
        firstLine: '海: 你剛才幫三年級那孩子擦完眼淚，手還在抖。',
      },
      {
        id: 'conversation-c:36161',
        firstLine: '天澤: 先確認學生是不是安心',
      },
    ]);

    expect(clusters.some((cluster) =>
      cluster.ids.includes('conversation-c:36089') && cluster.ids.includes('conversation-c:36110'),
    )).toBe(true);
    expect(clusters.some((cluster) => cluster.ids.includes('conversation-c:36161'))).toBe(false);
  });
});
