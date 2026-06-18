export type SchoolLocationId =
  | 'classroom'
  | 'courtyard'
  | 'aiClubRoom'
  | 'studentCouncilRoom'
  | 'dormitory';

export type SchoolLocation = {
  id: SchoolLocationId;
  labelZh: string;
  labelEn: string;
  scheduleZh: string;
  position: { x: number; y: number };
  spawnPoints: Array<{ x: number; y: number }>;
  radius: number;
  // Scene-anchored mood-event seeds. Added 2026-05-27 as design data for
  // future scene-mood overlays / event injection. Not yet consumed
  // anywhere — kept in-tree so the design copy (e.g. classroom 小考考差,
  // courtyard 告白, dormitory 室友距離) is reviewable. When a consumer
  // ships, add it to docs/giis-v0.1-roadmap.md.
  moodEvents: Array<{ id: string; titleZh: string; emotionHintZh: string }>;
};

export const SchoolLocations: SchoolLocation[] = [
  {
    id: 'classroom',
    labelZh: '教室',
    labelEn: 'Classroom',
    scheduleZh: '課堂 / 小考 / 作業 / 正式討論',
    position: { x: 8, y: 9 },
    spawnPoints: [
      { x: 7, y: 9 },
      { x: 8, y: 9 },
      { x: 9, y: 9 },
      { x: 8, y: 10 },
      { x: 11, y: 10 },
      { x: 12, y: 10 },
      { x: 10, y: 12 },
      { x: 12, y: 12 },
      { x: 9, y: 13 },
      { x: 13, y: 13 },
    ],
    radius: 1.9,
    moodEvents: [
      { id: 'caught-cheating', titleZh: '作弊被發現', emotionHintZh: '教室會變安靜，貓貓會在意公平，海會提醒 Alan 先不要公開羞辱。' },
      { id: 'late-homework', titleZh: '作業連兩天沒交', emotionHintZh: '天澤會測試這條作業規則到底保護誰，照顧型角色會注意背後是不是睡眠或家庭壓力。' },
    ],
  },
  {
    id: 'courtyard',
    labelZh: '中央庭院',
    labelEn: 'Courtyard',
    scheduleZh: '午間社交 / 告白 / 秘密 / 公開觀察',
    position: { x: 7, y: 15 },
    spawnPoints: [
      { x: 7, y: 14 },
      { x: 7, y: 15 },
      { x: 8, y: 15 },
      { x: 8, y: 14 },
      { x: 9, y: 14 },
      { x: 6, y: 15 },
    ],
    radius: 1.9,
    moodEvents: [
      { id: 'overheard-secret', titleZh: '秘密被聽到', emotionHintZh: '傳聞會變成第二層記憶，一之瀨會戳破太工整的說法。' },
      { id: 'confession', titleZh: '沒敢說完的告白', emotionHintZh: '角色會更在意沉默和停頓，而不是只看結果。' },
      { id: 'eating-alone', titleZh: '有人一個人吃飯', emotionHintZh: '祥子會用禮貌藏住自己的停頓，真晝會判斷對方是否想被打擾。' },
    ],
  },
  {
    id: 'aiClubRoom',
    labelZh: '餐廳',
    labelEn: 'Cafeteria',
    scheduleZh: '午餐 / 閒聊 / 小衝突 / 心情變化',
    position: { x: 13, y: 15 },
    spawnPoints: [
      { x: 12, y: 14 },
      { x: 13, y: 15 },
      { x: 14, y: 15 },
      { x: 13, y: 14 },
      { x: 12, y: 15 },
      { x: 14, y: 14 },
    ],
    radius: 1.9,
    moodEvents: [
      { id: 'saved-seat-empty', titleZh: '留好的座位空著', emotionHintZh: '關係的缺席會比事件本身更影響心情。' },
      { id: 'task-during-lunch', titleZh: '午餐時還在推規則', emotionHintZh: '海會縮短簡報，天澤會問誰把午餐也變成規則測試。' },
    ],
  },
  {
    id: 'studentCouncilRoom',
    labelZh: '校長室',
    labelEn: 'Principal Office',
    scheduleZh: '海的簡報 / 邀請談話 / 道歉 / 安靜整理',
    position: { x: 14, y: 9 },
    spawnPoints: [
      { x: 13, y: 9 },
      { x: 14, y: 9 },
      { x: 13, y: 10 },
      { x: 14, y: 10 },
      { x: 12, y: 10 },
      { x: 14, y: 11 },
    ],
    radius: 1.9,
    moodEvents: [
      { id: 'quiet-apology', titleZh: '很小聲的道歉', emotionHintZh: '海會把場面放輕，記下誰願意先低頭。' },
      { id: 'request-for-help', titleZh: '終於開口求助', emotionHintZh: '天澤會測求助裡藏了哪個逃避，真晝會保護對方不要被逼問。' },
    ],
  },
  {
    id: 'dormitory',
    labelZh: '宿舍',
    labelEn: 'Dormitory',
    scheduleZh: '私人對話 / 情緒反思 / 祕密',
    position: { x: 10, y: 15 },
    spawnPoints: [
      { x: 10, y: 14 },
      { x: 11, y: 15 },
      { x: 12, y: 15 },
      { x: 10, y: 16 },
      { x: 12, y: 14 },
      { x: 9, y: 15 },
    ],
    radius: 1.9,
    moodEvents: [
      { id: 'lights-on-too-late', titleZh: '深夜燈還亮著', emotionHintZh: '海或真晝會注意到疲憊比任務更早發生。' },
      { id: 'crying-behind-door', titleZh: '門後有人哭過', emotionHintZh: '角色不一定追問，可能只是留水、留紙條或待在附近。' },
      { id: 'missed-goodnight', titleZh: '沒有回晚安', emotionHintZh: '小缺席會成為隔天關心的觸發點。' },
    ],
  },
];

export function schoolLocationForHour(hour: number, minute = 0, rhythm?: { isWeekend?: boolean }) {
  const time = hour + minute / 60;
  if (rhythm?.isWeekend) {
    if (time >= 6 && time < 10)
      return SchoolLocations.find((location) => location.id === 'dormitory')!;
    if (time >= 10 && time < 13.5)
      return SchoolLocations.find((location) => location.id === 'aiClubRoom')!;
    if (time >= 13.5 && time < 17)
      return SchoolLocations.find((location) => location.id === 'courtyard')!;
    if (time >= 17 && time < 21)
      return SchoolLocations.find((location) => location.id === 'aiClubRoom')!;
    return SchoolLocations.find((location) => location.id === 'dormitory')!;
  }
  if (time >= 6 && time < 9)
    return SchoolLocations.find((location) => location.id === 'dormitory')!;
  if (time >= 9 && time <= 12)
    return SchoolLocations.find((location) => location.id === 'classroom')!;
  if (time > 12 && time < 13.5)
    return SchoolLocations.find((location) => location.id === 'courtyard')!;
  if (time >= 13.5 && time < 17)
    return SchoolLocations.find((location) => location.id === 'aiClubRoom')!;
  if (time >= 17 && time < 21)
    return SchoolLocations.find((location) => location.id === 'courtyard')!;
  return SchoolLocations.find((location) => location.id === 'dormitory')!;
}

export function nearestSchoolLocation(position: { x: number; y: number }) {
  return SchoolLocations.map((location) => ({
    location,
    distance: Math.hypot(location.position.x - position.x, location.position.y - position.y),
  }))
    .sort((a, b) => a.distance - b.distance)
    .find(({ distance }) => distance <= 2.4)?.location;
}

export function sceneSpawnPoint(locationId: SchoolLocationId, index: number) {
  const location = SchoolLocations.find((item) => item.id === locationId) ?? SchoolLocations[0];
  return location.spawnPoints[index % location.spawnPoints.length] ?? location.position;
}
