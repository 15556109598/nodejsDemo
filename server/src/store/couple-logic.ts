// 情侣空间：纯计算逻辑（不依赖数据库与网络，可独立测试）
// 覆盖：日期差（含闰年/跨年）、纪念日视图、周期统计与预测、每日一句轮换、提醒、天气建议

export interface CoupleAnniversary {
  id: string;
  title: string;
  // YYYY-MM-DD
  date: string;
  yearly: boolean;
  icon: string;
  photoUrl: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CycleRecord {
  id: string;
  // YYYY-MM-DD
  startDate: string;
  endDate: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoupleQuote {
  id: string;
  content: string;
  isCustom: boolean;
  createdAt: string;
}

export interface CoupleSettings {
  city: string;
  latitude: number;
  longitude: number;
  // 纪念日提前多少天提醒
  nearAnniversaryDays: number;
  // 经期提前多少天提醒
  cycleAheadDays: number;
  // 预计经期推迟超过多少天提醒
  cycleDelayDays: number;
  // 次日最高温下降多少度提醒
  weatherDeltaC: number;
}

export interface CoupleDefaults {
  city: string;
  latitude: number;
  longitude: number;
}

// ---------- 日期工具 ----------

const DAY_MS = 86400000;

// 解析 YYYY-MM-DD 为 UTC 时间戳；非法日期返回 null（会自动排除 2026-02-30 这类）
export function parseDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ts = Date.UTC(y, m - 1, d);
  const dt = new Date(ts);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return ts;
}

export function isValidDay(value: string): boolean {
  return parseDay(value) !== null;
}

// to - from 的天数（可为负）
export function dayDiff(from: string, to: string): number {
  const a = parseDay(from);
  const b = parseDay(to);
  if (a === null || b === null) return 0;
  return Math.round((b - a) / DAY_MS);
}

export function addDays(value: string, days: number): string {
  const ts = parseDay(value);
  if (ts === null) return value;
  return new Date(ts + days * DAY_MS).toISOString().slice(0, 10);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// 每年重复的纪念日：2 月 29 日在平年按 2 月 28 日算
export function sameDayInYear(date: string, year: number): string {
  const [, m, d] = date.split('-').map(Number);
  const month = m;
  const day = m === 2 && d === 29 && !isLeapYear(year) ? 28 : d;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 中国时区（Asia/Shanghai）的今天，避免服务器 UTC 与用户差一天
export function todayInShanghai(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

// ---------- 纪念日 ----------

export interface AnniversaryView {
  // 从起始日到今天过去了多少天（未来日期为负）
  daysSince: number;
  // 距下一次纪念日还有多少天（已过的一次性纪念日为负）
  daysUntilNext: number;
  nextDate: string;
}

export function anniversaryView(item: CoupleAnniversary, today: string): AnniversaryView {
  const daysSince = dayDiff(item.date, today);
  let nextDate = item.date;

  if (item.yearly) {
    const todayYear = Number(today.slice(0, 4));
    nextDate = sameDayInYear(item.date, todayYear);
    if (nextDate < today) nextDate = sameDayInYear(item.date, todayYear + 1);
  }

  return { daysSince, daysUntilNext: dayDiff(today, nextDate), nextDate };
}

// ---------- 经期统计与预测 ----------

export interface CycleInterval {
  // 以该次开始日期作为区间的终点
  startDate: string;
  length: number;
}

export interface CycleStats {
  recordCount: number;
  intervalCount: number;
  averageCycle: number | null;
  averagePeriod: number | null;
  minCycle: number | null;
  maxCycle: number | null;
  // 至少 2 个周期间隔才算样本充足（即 3 次记录）
  sampleEnough: boolean;
  trend: CycleInterval[];
}

const MIN_INTERVAL = 5;
const MAX_INTERVAL = 120;
const MAX_PERIOD = 30;

function sortRecords(records: CycleRecord[]): CycleRecord[] {
  return records
    .filter((r) => isValidDay(r.startDate))
    .slice()
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

export function computeCycleStats(records: CycleRecord[], minIntervals = 2): CycleStats {
  const sorted = sortRecords(records);
  const trend: CycleInterval[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const length = dayDiff(sorted[i - 1].startDate, sorted[i].startDate);
    if (length >= MIN_INTERVAL && length <= MAX_INTERVAL) {
      trend.push({ startDate: sorted[i].startDate, length });
    }
  }

  const periods: number[] = [];
  for (const record of sorted) {
    if (!record.endDate || !isValidDay(record.endDate)) continue;
    const length = dayDiff(record.startDate, record.endDate) + 1;
    if (length >= 1 && length <= MAX_PERIOD) periods.push(length);
  }

  const avg = (list: number[]): number | null =>
    list.length ? Math.round(list.reduce((sum, n) => sum + n, 0) / list.length) : null;

  const averageCycle = avg(trend.map((t) => t.length));
  const averagePeriod = avg(periods);

  return {
    recordCount: sorted.length,
    intervalCount: trend.length,
    averageCycle,
    averagePeriod,
    minCycle: trend.length ? Math.min(...trend.map((t) => t.length)) : null,
    maxCycle: trend.length ? Math.max(...trend.map((t) => t.length)) : null,
    sampleEnough: trend.length >= minIntervals,
    trend: trend.slice(-6),
  };
}

export type CycleStatus = 'none' | 'insufficient' | 'period' | 'upcoming' | 'normal' | 'overdue';

export interface CyclePrediction {
  status: CycleStatus;
  statusText: string;
  // 当前经期第几天（仅 status=period）
  currentDay: number | null;
  // 预计下次开始日期
  nextStart: string | null;
  // 距预计下次还有多少天（已过为负）
  daysUntilNext: number | null;
  // 预计已推迟天数
  overdueDays: number | null;
}

export function predictCycle(
  records: CycleRecord[],
  stats: CycleStats,
  settings: Pick<CoupleSettings, 'cycleAheadDays' | 'cycleDelayDays'>,
  today: string
): CyclePrediction {
  const sorted = sortRecords(records);
  const last = sorted[sorted.length - 1];

  if (!last) {
    return {
      status: 'none',
      statusText: '还没有记录，第一次记录后就能看到状态',
      currentDay: null,
      nextStart: null,
      daysUntilNext: null,
      overdueDays: null,
    };
  }

  if (!stats.sampleEnough || !stats.averageCycle) {
    const need = Math.max(0, 3 - stats.recordCount);
    return {
      status: 'insufficient',
      statusText:
        need > 0
          ? `样本不足：已记录 ${stats.recordCount} 次，再记录 ${need} 次才能预测`
          : '样本不足，暂时无法预测',
      currentDay: null,
      nextStart: null,
      daysUntilNext: null,
      overdueDays: null,
    };
  }

  const periodLength = stats.averagePeriod && stats.averagePeriod > 0 ? stats.averagePeriod : 5;
  const fromLastStart = dayDiff(last.startDate, today);

  if (fromLastStart >= 0 && fromLastStart < periodLength) {
    const currentDay = fromLastStart + 1;
    return {
      status: 'period',
      statusText: `当前为经期第 ${currentDay} 天`,
      currentDay,
      nextStart: addDays(last.startDate, stats.averageCycle),
      daysUntilNext: dayDiff(today, addDays(last.startDate, stats.averageCycle)),
      overdueDays: null,
    };
  }

  const nextStart = addDays(last.startDate, stats.averageCycle);
  const daysUntilNext = dayDiff(today, nextStart);

  if (daysUntilNext < 0) {
    const overdueDays = -daysUntilNext;
    return {
      status: 'overdue',
      statusText: `预计经期已推迟 ${overdueDays} 天`,
      currentDay: null,
      nextStart,
      daysUntilNext,
      overdueDays,
    };
  }

  if (daysUntilNext === 0) {
    return {
      status: 'upcoming',
      statusText: '预计今天开始，注意提前准备',
      currentDay: null,
      nextStart,
      daysUntilNext,
      overdueDays: null,
    };
  }

  const upcoming = daysUntilNext <= Math.max(0, settings.cycleAheadDays);
  return {
    status: upcoming ? 'upcoming' : 'normal',
    statusText: `预计下次经期还有 ${daysUntilNext} 天`,
    currentDay: null,
    nextStart,
    daysUntilNext,
    overdueDays: null,
  };
}

// ---------- 每日一句 ----------

// 内置句子（自写，无外部依赖）；按日期确定性轮换
export const BUILTIN_QUOTES: string[] = [
  '今天也一起好好吃饭。',
  '慢一点也没关系，我在。',
  '把小事说给对方听，日子就有了回声。',
  '天冷了，先照顾好自己，再照顾我。',
  '不用每次都完美，在一起就很好。',
  '愿今天的坏情绪，都在晚饭前散掉。',
  '记得喝水，也记得想我。',
  '我们不必一样，但要一直站在同一边。',
  '忙的时候各忙各的，闲下来就靠一起。',
  '有些话当面说，有些话写在这里。',
  '把日子过成喜欢的样子，不着急。',
  '今天的风有点凉，外套记得带上。',
  '你笑起来的时候，今天就算过关了。',
  '小小的默契，比大大的承诺更耐用。',
  '困了就睡，明天再一起想办法。',
  '我们吵完架，也还是要一起吃早饭。',
  '想见的人，早点去见。',
  '把「谢谢」和「辛苦了」常说出口。',
  '晴天晒被子，雨天听雨声，都很好。',
  '不用把每一分钟都填满，留白也是生活。',
  '今天的你，已经比昨天更努力了一点。',
  '记得给家里打个电话。',
  '好好吃饭，是我们能做的最小的事。',
  '路很长，牵着手就不会走散。',
  '偶尔任性一次，也没关系。',
  '把喜欢说具体一点，对方才听得见。',
  '睡前一小时，把手机放远一点。',
  '明天也会是普通又值得期待的一天。',
  '最近辛苦了，抱一下。',
  '不急着变好，先好好活着。',
];

export function quotePool(custom: string[]): string[] {
  return [...BUILTIN_QUOTES, ...custom.filter((s) => s.trim()).map((s) => s.trim())];
}

// 固定基准日 + 天数索引：同一天同一份数据必然得到同一句
export function pickDailyQuote(
  today: string,
  custom: string[] = []
): { content: string; isCustom: boolean; index: number } {
  const pool = quotePool(custom);
  const offset = Math.abs(dayDiff('2024-01-01', today));
  const index = offset % pool.length;
  return {
    content: pool[index],
    isCustom: index >= BUILTIN_QUOTES.length,
    index,
  };
}

// ---------- 天气建议 ----------

export const WEATHER_DEFAULT: CoupleDefaults = {
  city: '南京 · 雨花台',
  latitude: 31.9957,
  longitude: 118.7635,
};

export interface WeatherNow {
  temp: number | null;
  code: number | null;
  text: string;
  emoji: string;
}

export interface WeatherDay {
  date: string;
  max: number | null;
  min: number | null;
  precipProb: number | null;
  code: number | null;
  text: string;
  emoji: string;
}

export interface WeatherInfo {
  available: boolean;
  city: string;
  temp: number | null;
  code: number | null;
  text: string;
  emoji: string;
  max: number | null;
  min: number | null;
  precipProb: number | null;
  days: WeatherDay[];
  advice: string[];
  updatedAt: string;
  message?: string;
}

interface WeatherText {
  text: string;
  emoji: string;
}

export function describeWeather(code: number | null): WeatherText {
  if (code === null || Number.isNaN(code)) return { text: '天气未知', emoji: '🌡️' };
  if (code === 0) return { text: '晴', emoji: '☀️' };
  if (code === 1) return { text: '晴间多云', emoji: '🌤️' };
  if (code === 2) return { text: '多云', emoji: '⛅' };
  if (code === 3) return { text: '阴', emoji: '☁️' };
  if (code === 45 || code === 48) return { text: '有雾', emoji: '🌫️' };
  if (code >= 51 && code <= 57) return { text: '毛毛雨', emoji: '🌦️' };
  if (code >= 61 && code <= 67) return { text: '下雨', emoji: '🌧️' };
  if (code >= 71 && code <= 77) return { text: '下雪', emoji: '🌨️' };
  if (code >= 80 && code <= 82) return { text: '阵雨', emoji: '🌦️' };
  if (code === 85 || code === 86) return { text: '阵雪', emoji: '🌨️' };
  if (code >= 95 && code <= 99) return { text: '雷阵雨', emoji: '⛈️' };
  return { text: '天气多变', emoji: '🌥️' };
}

export interface AdviceInput {
  temp: number | null;
  max: number | null;
  min: number | null;
  precipProb: number | null;
  tomorrowMax: number | null;
  deltaC: number;
}

// 简单的出行建议：最多 3 条，避免堆砌
export function buildWeatherAdvice(input: AdviceInput): string[] {
  const advice: string[] = [];
  const { temp, max, min, precipProb, tomorrowMax, deltaC } = input;

  if (tomorrowMax !== null && max !== null) {
    const diff = max - tomorrowMax;
    if (diff >= Math.max(1, deltaC)) {
      advice.push(`明天气温下降 ${diff}℃，记得加件外套`);
    } else if (diff <= -Math.max(1, deltaC)) {
      advice.push(`明天气温回升 ${Math.abs(diff)}℃，可以少穿一件`);
    }
  }
  if (precipProb !== null && precipProb >= 60) {
    advice.push(`降水概率 ${precipProb}%，出门记得带伞`);
  }
  if (max !== null && max >= 33) {
    advice.push(`白天最高 ${max}℃，注意防晒和补水`);
  } else if (min !== null && min <= 5) {
    advice.push(`最低 ${min}℃，早晚注意保暖`);
  }
  if (!advice.length && temp !== null) {
    advice.push(`当前 ${temp}℃，温度适宜，正常出行就好`);
  }
  return advice.slice(0, 3);
}

// ---------- 提醒 ----------

export type ReminderKind = 'anniversary' | 'cycle' | 'weather';
export type ReminderLevel = 'info' | 'warn';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  level: ReminderLevel;
  title: string;
  detail: string;
}

export interface ReminderInput {
  today: string;
  anniversaries: CoupleAnniversary[];
  prediction: CyclePrediction;
  weather: WeatherInfo | null;
  settings: CoupleSettings;
}

export function buildReminders(input: ReminderInput): Reminder[] {
  const { today, anniversaries, prediction, weather, settings } = input;
  const reminders: Reminder[] = [];

  for (const item of anniversaries) {
    const view = anniversaryView(item, today);
    if (view.daysUntilNext >= 0 && view.daysUntilNext <= settings.nearAnniversaryDays) {
      reminders.push({
        id: `ann-${item.id}`,
        kind: 'anniversary',
        level: 'info',
        title:
          view.daysUntilNext === 0
            ? `今天是「${item.title}」`
            : `「${item.title}」还有 ${view.daysUntilNext} 天`,
        detail: `纪念日日期 ${view.nextDate}${item.yearly ? '（每年重复）' : ''}`,
      });
    }
  }

  if (prediction.status === 'upcoming' && prediction.daysUntilNext !== null) {
    reminders.push({
      id: 'cycle-upcoming',
      kind: 'cycle',
      level: 'info',
      title:
        prediction.daysUntilNext === 0
          ? '预计今天开始经期'
          : `经期预计还有 ${prediction.daysUntilNext} 天`,
      detail: '可以提前准备好需要的物品，注意休息',
    });
  }

  if (
    prediction.status === 'overdue' &&
    prediction.overdueDays !== null &&
    prediction.overdueDays > settings.cycleDelayDays
  ) {
    reminders.push({
      id: 'cycle-delay',
      kind: 'cycle',
      level: 'warn',
      title: `经期预计已推迟 ${prediction.overdueDays} 天`,
      detail: '预测基于历史记录，若明显异常或不适请咨询专业医生',
    });
  }

  if (weather?.available) {
    const todayMax = weather.days[0]?.max ?? weather.max;
    const tomorrowMax = weather.days[1]?.max ?? null;
    if (todayMax !== null && tomorrowMax !== null) {
      const diff = todayMax - tomorrowMax;
      if (diff >= Math.max(1, settings.weatherDeltaC)) {
        reminders.push({
          id: 'weather-drop',
          kind: 'weather',
          level: 'warn',
          title: `明天降温 ${diff}℃`,
          detail: `今天最高 ${todayMax}℃，明天最高 ${tomorrowMax}℃，记得加外套`,
        });
      }
    }
  }

  // 紧急的先展示，其余保持插入顺序；最多 5 条
  return reminders.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1)).slice(0, 5);
}

// ---------- 今日摘要 ----------

export interface DailySummary {
  date: string;
  lines: string[];
  text: string;
}

export interface SummaryInput {
  today: string;
  settings: CoupleSettings;
  anniversaries: CoupleAnniversary[];
  quote: string;
  weather: WeatherInfo | null;
  prediction: CyclePrediction;
  reminders: Reminder[];
}

export function buildDailySummary(input: SummaryInput): DailySummary {
  const { today, settings, anniversaries, quote, weather, prediction, reminders } = input;
  const lines: string[] = [];

  const pinned = anniversaries.find((a) => a.pinned) || anniversaries[0];
  if (pinned) {
    const view = anniversaryView(pinned, today);
    if (view.daysSince >= 0) {
      lines.push(`「${pinned.title}」已经 ${view.daysSince} 天`);
    }
    if (view.daysUntilNext >= 0 && view.daysUntilNext <= settings.nearAnniversaryDays) {
      lines.push(`下一个纪念日还有 ${view.daysUntilNext} 天`);
    }
  }

  lines.push(`今日一句：${quote}`);

  if (weather?.available) {
    const parts = [`${weather.city} ${weather.temp ?? '—'}℃`, weather.text];
    if (weather.precipProb !== null) parts.push(`降水概率 ${weather.precipProb}%`);
    lines.push(parts.join('，'));
  } else {
    lines.push('天气暂未获取到，出门前可以看一下窗外');
  }

  lines.push(prediction.statusText);

  if (reminders.length) {
    lines.push(`提醒：${reminders.map((r) => r.title).join('；')}`);
  }

  const text = [`小厨 · 我们的空间 · ${today}`, ...lines.map((line) => `· ${line}`)].join('\n');
  return { date: today, lines, text };
}
