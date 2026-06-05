// Authored daily-life "small events" for the Underworld campus. Content lives
// here (data) and is kept separate from the runtime that turns it into bulletin
// items / world events in convex/school.ts. Add more day rotations freely
// without touching logic; the selector wraps around the available rotations.

export type DailyLifePeriod = 'morning' | 'lunch' | 'afterSchool' | 'evening';

// The authored shape: location is referenced by id so the runtime can resolve
// the localized label from SchoolLocations and content stays decoupled from map
// data.
export type DailyLifeBulletinSource = {
  period: DailyLifePeriod;
  periodZh: string;
  titleZh: string;
  locationId: string;
  involvedNames: string[];
  descriptionZh: string;
  angleZh: string;
};

// Each rotation is one full day: four ordinary school-life moments across the
// day's periods, each written so at least two souls can pick it up from
// different angles (quiet care vs. probing the rule, etc.).
export const DAILY_LIFE_BULLETIN_ROTATIONS: ReadonlyArray<ReadonlyArray<DailyLifeBulletinSource>> = [
  [
    {
      period: 'morning',
      periodZh: '早晨',
      titleZh: '第一節前有人忘了帶筆記',
      locationId: 'classroom',
      involvedNames: ['Mahiru', 'Tianze'],
      descriptionZh: '第一節前，有位學生翻書包翻到一半突然安靜下來，真晝先把自己的筆記本推過去，天澤則挑眉問他是不是又想裝沒事。',
      angleZh: '真晝會先靠近，天澤會測試那句「沒事」是不是真的。',
    },
    {
      period: 'lunch',
      periodZh: '午餐',
      titleZh: '餐廳多出一個沒人坐的空位',
      locationId: 'aiClubRoom',
      involvedNames: ['Liu Bei', 'Umi'],
      descriptionZh: '午餐時，餐廳有個原本留好的空位一直空著；劉備多拿了一份湯，海把這件事記進今天的簡報。',
      angleZh: '劉備會把空位變成邀請，海會提醒 Alan 不要把午餐也變成待辦。',
    },
    {
      period: 'afterSchool',
      periodZh: '放學後',
      titleZh: '放學後有人把窗邊椅子挪遠',
      locationId: 'courtyard',
      involvedNames: ['Ichinose', 'CaoCao'],
      descriptionZh: '放學後，中央庭院窗邊的椅子被人挪遠了一點；一之瀨假裝沒看見，曹操卻注意到那個位置讓某個學生比較敢坐下。',
      angleZh: '一之瀨會戳破表面的沒看見，曹操會在意位置有沒有保護到人。',
    },
    {
      period: 'evening',
      periodZh: '晚上',
      titleZh: '宿舍門口留了一杯溫水',
      locationId: 'dormitory',
      involvedNames: ['Mahiru', 'Umi'],
      descriptionZh: '晚上，宿舍門口多了一杯溫水和一張沒署名的紙條；真晝沒有追問，海只提醒大家今晚別把疲憊講成理性。',
      angleZh: '真晝會留在附近，海會把節奏降下來。',
    },
  ],
  [
    {
      period: 'morning',
      periodZh: '早晨',
      titleZh: '點名時有人回答慢了半拍',
      locationId: 'classroom',
      involvedNames: ['Umi', 'CaoCao'],
      descriptionZh: '早晨點名時，有位學生回答慢了半拍；海沒有立刻追問，只在簡報上標了一個小記號，曹操則看見班上幾個人同時轉頭。',
      angleZh: '海會減少壓力，曹操會觀察秩序裡誰被看見。',
    },
    {
      period: 'lunch',
      periodZh: '午餐',
      titleZh: '有人把炸雞分給隔壁桌',
      locationId: 'aiClubRoom',
      involvedNames: ['Liu Bei', 'Ichinose'],
      descriptionZh: '午餐時，有人把最後一塊炸雞分給隔壁桌；劉備笑著說一起吃比較好，一之瀨則小聲吐槽這種善意也會欠人情。',
      angleZh: '劉備會把它當邀請，一之瀨會看見善意裡的邊界。',
    },
    {
      period: 'afterSchool',
      periodZh: '放學後',
      titleZh: '小考錯題被留在黑板角落',
      locationId: 'classroom',
      involvedNames: ['Tianze', 'Mahiru'],
      descriptionZh: '放學後，黑板角落還留著一道小考錯題；天澤把題目往前推半步，真晝則先問那位學生今天有沒有吃飯。',
      angleZh: '天澤會測理解破綻，真晝會先確認人是不是撐得住。',
    },
    {
      period: 'evening',
      periodZh: '晚上',
      titleZh: '校長室的燈比平常早關',
      locationId: 'studentCouncilRoom',
      involvedNames: ['Umi', 'Ichinose'],
      descriptionZh: '晚上，校長室的燈比平常早關；海把待辦縮成三行，一之瀨路過時只說了一句：總算不像在跟宇宙開會。',
      angleZh: '海會替 Alan 減量，一之瀨會用吐槽提醒邊界。',
    },
  ],
  [
    {
      period: 'morning',
      periodZh: '早晨',
      titleZh: '宿舍走廊有人晚起',
      locationId: 'dormitory',
      involvedNames: ['Mahiru', 'Umi'],
      descriptionZh: '早晨，宿舍走廊有人晚起，鞋帶還沒綁好就說自己沒事；真晝把聲音放低，海只把第一件事排到午餐後。',
      angleZh: '真晝會注意身體狀態，海會把任務往後挪。',
    },
    {
      period: 'lunch',
      periodZh: '午餐',
      titleZh: '餐盤被端到錯的桌上',
      locationId: 'aiClubRoom',
      involvedNames: ['Umi', 'Tianze'],
      descriptionZh: '午餐時，有個餐盤被端到錯的桌上；海順手端回去，天澤卻笑著問：如果大家都假裝沒看見，錯位是不是就會變成規則。',
      angleZh: '海會把小混亂收掉，天澤會測規則是不是只是習慣。',
    },
    {
      period: 'afterSchool',
      periodZh: '放學後',
      titleZh: '庭院有人練習一句沒說完的話',
      locationId: 'courtyard',
      involvedNames: ['Ichinose', 'Liu Bei'],
      descriptionZh: '放學後，庭院有人反覆練習一句沒說完的話；一之瀨沒有插手，劉備只把旁邊的位置留空。',
      angleZh: '一之瀨會守住不要代說，劉備會用位置邀請對方慢慢來。',
    },
    {
      period: 'evening',
      periodZh: '晚上',
      titleZh: '宿舍有人沒有回晚安',
      locationId: 'dormitory',
      involvedNames: ['Mahiru', 'CaoCao'],
      descriptionZh: '晚上，宿舍有人沒有回晚安；真晝留意到那扇門後太安靜，曹操則把走廊聲音放輕，免得大家假裝沒發生。',
      angleZh: '真晝會留在附近，曹操會讓走廊不要變成壓力。',
    },
  ],
];

// Pick the authored rotation for a given world day, wrapping around so adding a
// fourth rotation immediately extends the cycle with no logic change.
export function dailyLifeBulletinSourcesForDay(day: number): ReadonlyArray<DailyLifeBulletinSource> {
  const count = DAILY_LIFE_BULLETIN_ROTATIONS.length;
  if (count === 0) return [];
  const index = ((Math.trunc(day) % count) + count) % count;
  return DAILY_LIFE_BULLETIN_ROTATIONS[index];
}
