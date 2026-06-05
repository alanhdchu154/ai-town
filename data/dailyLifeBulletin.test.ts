import {
  DAILY_LIFE_BULLETIN_ROTATIONS,
  dailyLifeBulletinSourcesForDay,
} from './dailyLifeBulletin';

describe('dailyLifeBulletinSourcesForDay', () => {
  test('each authored rotation has four ordinary moments across distinct periods', () => {
    for (const rotation of DAILY_LIFE_BULLETIN_ROTATIONS) {
      expect(rotation).toHaveLength(4);
      const periods = rotation.map((item) => item.period);
      expect(new Set(periods)).toEqual(
        new Set(['morning', 'lunch', 'afterSchool', 'evening']),
      );
      for (const item of rotation) {
        expect(item.titleZh.length).toBeGreaterThan(0);
        expect(item.descriptionZh.length).toBeGreaterThan(0);
        expect(item.angleZh.length).toBeGreaterThan(0);
        expect(item.involvedNames.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('selects rotations by day and wraps around the cycle', () => {
    const count = DAILY_LIFE_BULLETIN_ROTATIONS.length;
    expect(dailyLifeBulletinSourcesForDay(0)).toBe(DAILY_LIFE_BULLETIN_ROTATIONS[0]);
    expect(dailyLifeBulletinSourcesForDay(count)).toBe(DAILY_LIFE_BULLETIN_ROTATIONS[0]);
    expect(dailyLifeBulletinSourcesForDay(count + 1)).toBe(DAILY_LIFE_BULLETIN_ROTATIONS[1 % count]);
  });

  test('handles negative or fractional day numbers without throwing', () => {
    expect(dailyLifeBulletinSourcesForDay(-1)).toBe(
      DAILY_LIFE_BULLETIN_ROTATIONS[DAILY_LIFE_BULLETIN_ROTATIONS.length - 1],
    );
    expect(dailyLifeBulletinSourcesForDay(2.9)).toBe(
      DAILY_LIFE_BULLETIN_ROTATIONS[2 % DAILY_LIFE_BULLETIN_ROTATIONS.length],
    );
  });
});
