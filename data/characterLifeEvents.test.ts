import { CHARACTER_LIFE_EVENTS, characterLifeEventForClock } from './characterLifeEvents';

describe('character life events', () => {
  test('uses only the current Underworld roster for v0.1 life-event seeds', () => {
    const allowed = new Set(['Umi', 'Mahiru', 'Tianze', 'Ichinose', 'Maomao', 'Sakiko', 'Alan']);
    for (const event of CHARACTER_LIFE_EVENTS) {
      expect(allowed.has(event.actorName)).toBe(true);
      expect(event.affectedNames.every((name) => allowed.has(name))).toBe(true);
      expect(['exam', 'birthday', 'club', 'performance', 'errand', 'boundary']).toContain(event.type);
      expect(event.descriptionZh.length).toBeGreaterThan(8);
      expect(event.developmentHook.length).toBeGreaterThan(8);
    }
  });

  test('selects a deterministic bounded event from world clock', () => {
    expect(characterLifeEventForClock(31, 9)).toEqual(characterLifeEventForClock(31, 9));
    expect(CHARACTER_LIFE_EVENTS).toContain(characterLifeEventForClock(31, 9));
    expect(CHARACTER_LIFE_EVENTS).toContain(characterLifeEventForClock(31, 18));
  });
});
