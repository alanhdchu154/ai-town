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
};

export const SchoolLocations: SchoolLocation[] = [
  {
    id: 'classroom',
    labelZh: '教室',
    labelEn: 'Classroom',
    scheduleZh: '早晨課堂 / 公告 / 正式討論',
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
  },
  {
    id: 'courtyard',
    labelZh: '中央庭院',
    labelEn: 'Courtyard',
    scheduleZh: '午間社交 / 傳聞 / 公開觀察',
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
  },
  {
    id: 'aiClubRoom',
    labelZh: 'AI 社團室',
    labelEn: 'AI Club Room',
    scheduleZh: '社團實驗 / 技術想法 / 可行性討論',
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
  },
  {
    id: 'studentCouncilRoom',
    labelZh: '學生會室',
    labelEn: 'Student Council Room',
    scheduleZh: '影響力布局 / 聯盟討論 / 政治張力',
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
  },
];

export function schoolLocationForHour(hour: number, minute = 0) {
  const time = hour + minute / 60;
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
