export type SchoolDayRhythmContext = {
  dateLabelZh: string;
  weekdayZh: string;
  tomorrowWeekdayZh: string;
  isWeekend: boolean;
  isTomorrowWeekend: boolean;
  schoolDayTypeZh: '上課日' | '假日前夜' | '週末';
  tomorrowLabelZh: string;
  calendarHintZh: string;
  scheduleLabelZh: string;
};

function weekdayLabel(date: Date, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: locale === 'zh-TW' ? 'long' : 'short',
  }).format(date);
}

function dateLabelZh(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function weekendLabelFor(date: Date, timeZone: string) {
  return ['Sat', 'Sun'].includes(weekdayLabel(date, timeZone, 'en-US'));
}

export function schoolDayRhythmContext(
  now = Date.now(),
  timeZone = 'America/Chicago',
): SchoolDayRhythmContext {
  const today = new Date(now);
  const tomorrow = new Date(now + 86_400_000);
  const isWeekend = weekendLabelFor(today, timeZone);
  const isTomorrowWeekend = weekendLabelFor(tomorrow, timeZone);
  const schoolDayTypeZh = isWeekend ? '週末' : isTomorrowWeekend ? '假日前夜' : '上課日';
  const tomorrowWeekdayZh = weekdayLabel(tomorrow, timeZone, 'zh-TW');
  const tomorrowLabelZh = `明天是${tomorrowWeekdayZh}${isTomorrowWeekend ? '，週末' : '，上課日'}`;
  const scheduleLabelZh =
    schoolDayTypeZh === '週末'
      ? '週末自由活動 / 社團 / 私下聊天 / 補作業'
      : schoolDayTypeZh === '假日前夜'
        ? '假日前夜 / 收尾 / 週末約定 / 私下對話'
        : '上課日 / 課堂 / 午餐 / 放學後活動';

  return {
    dateLabelZh: dateLabelZh(today, timeZone),
    weekdayZh: weekdayLabel(today, timeZone, 'zh-TW'),
    tomorrowWeekdayZh,
    isWeekend,
    isTomorrowWeekend,
    schoolDayTypeZh,
    tomorrowLabelZh,
    scheduleLabelZh,
    calendarHintZh:
      schoolDayTypeZh === '週末'
        ? '今天是週末，沒有正式課堂；角色以自由活動、社團、補作業、散步、洗衣、閒聊和私下關心為主。'
        : schoolDayTypeZh === '假日前夜'
          ? `${tomorrowLabelZh}，角色可以自然想到未完成作業、社團約定、週末計畫、回家/不回家的選擇或私下回避。`
          : `${tomorrowLabelZh}，今天仍是一般上課節奏。`,
  };
}
