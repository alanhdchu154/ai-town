import { inferEmotionFromConversation } from './conversationEmotion';

describe('conversation -> emotion (②→④ feedback edge)', () => {
  test('warmth / connection -> smiling', () => {
    expect(inferEmotionFromConversation('謝謝你記得我，我們明天一起去吧。')).toBe('smiling');
    expect(inferEmotionFromConversation('我願意陪你，放心。')).toBe('smiling');
  });

  test('surfaced vulnerability / stress -> worried', () => {
    expect(inferEmotionFromConversation('你看起來很累，別再硬撐了，手都在抖。')).toBe('worried');
    expect(inferEmotionFromConversation('他說沒事，但其實壓力很大。')).toBe('worried');
  });

  test('boundary pressed / confrontation -> serious', () => {
    expect(inferEmotionFromConversation('這條規則到底保護誰？這個玩笑誰買單？')).toBe('serious');
    expect(inferEmotionFromConversation('我拒絕，你不能一直測試我的底線。')).toBe('serious');
  });

  test('settled / resolved -> neutral', () => {
    expect(inferEmotionFromConversation('沒什麼，先這樣，東西收好了。')).toBe('neutral');
  });

  test('exhaustion / overload -> tired without stealing ordinary worry', () => {
    expect(inferEmotionFromConversation('今天先到這裡，我真的睡不太夠，少接一件事吧。')).toBe('tired');
  });

  test('affection that breaks composure -> flustered without stealing normal warmth', () => {
    expect(inferEmotionFromConversation('你說喜歡你，我也喜歡，可是我有點不好意思，心跳亂了一下。')).toBe('flustered');
    expect(inferEmotionFromConversation('謝謝你記得我，我們明天一起去吧。')).toBe('smiling');
  });

  test('defensive distance / withheld trust -> guarded without stealing confrontation', () => {
    expect(inferEmotionFromConversation('我先保留，不想說滿，也請你先不要問。')).toBe('guarded');
    expect(inferEmotionFromConversation('我拒絕，你不能一直測試我的底線。')).toBe('serious');
  });

  test('de-escalated repair / safe pause -> calm', () => {
    expect(inferEmotionFromConversation('事情說開了，先安靜一下，不用急，也不催你。')).toBe('calm');
  });

  test('no clear signal -> null (do not wipe a meaningful emotion)', () => {
    expect(inferEmotionFromConversation('窗外的天色變了一點。')).toBeNull();
    expect(inferEmotionFromConversation('')).toBeNull();
    expect(inferEmotionFromConversation('   ')).toBeNull();
  });

  test('vulnerability outweighs a passing warm word (worried wins ties up)', () => {
    // "謝謝" (smiling) + "累/撐不住" (worried x2): worried dominates by count.
    expect(inferEmotionFromConversation('謝謝你，但我真的快撐不住了，好累。')).toBe('worried');
  });
});
