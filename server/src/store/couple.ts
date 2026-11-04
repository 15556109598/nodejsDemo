// 情侣空间：Supabase 数据访问 + Open-Meteo 天气
// 仅服务端使用 service_role；所有表开启 RLS 且无匿名策略
import { adminClient } from '../lib/supabase';
import { env } from '../env';
import {
  WEATHER_DEFAULT,
  buildWeatherAdvice,
  describeWeather,
  type CoupleAnniversary,
  type CoupleQuote,
  type CoupleSettings,
  type CycleRecord,
  type WeatherDay,
  type WeatherInfo,
} from './couple-logic';

const ANN_TABLE = 'couple_anniversaries';
const CYCLE_TABLE = 'couple_cycle_records';
const QUOTE_TABLE = 'couple_quotes';
const SETTINGS_TABLE = 'couple_settings';

interface AnniversaryRow {
  id: string;
  title: string;
  date: string;
  yearly: boolean;
  icon: string;
  photo_url: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface CycleRow {
  id: string;
  start_date: string;
  end_date: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

interface QuoteRow {
  id: string;
  content: string;
  is_custom: boolean;
  created_at: string;
}

// 保留数据库错误码，并对「表未创建」补上待执行 SQL 的提示
function raise(error: any): never {
  const err = new Error(error?.message || '数据库操作失败') as Error & { code?: string; sqlFile?: string };
  err.code = error?.code;
  err.sqlFile = 'server/sql/couple.sql';
  throw err;
}

function mapAnniversary(row: AnniversaryRow): CoupleAnniversary {
  return {
    id: row.id,
    title: row.title,
    date: String(row.date).slice(0, 10),
    yearly: row.yearly,
    icon: row.icon,
    photoUrl: row.photo_url,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCycle(row: CycleRow): CycleRecord {
  return {
    id: row.id,
    startDate: String(row.start_date).slice(0, 10),
    endDate: row.end_date ? String(row.end_date).slice(0, 10) : null,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuote(row: QuoteRow): CoupleQuote {
  return {
    id: row.id,
    content: row.content,
    isCustom: row.is_custom,
    createdAt: row.created_at,
  };
}

// ---------- 纪念日 ----------

export async function listAnniversaries(): Promise<CoupleAnniversary[]> {
  const { data, error } = await adminClient
    .from(ANN_TABLE)
    .select('*')
    .order('pinned', { ascending: false })
    .order('date', { ascending: true });
  if (error) raise(error);
  return (data as AnniversaryRow[]).map(mapAnniversary);
}

export interface AnniversaryInput {
  title: string;
  date: string;
  yearly: boolean;
  icon: string;
  photoUrl: string;
  pinned: boolean;
}

// 置顶最多一个：写入前把其他记录取消置顶
async function clearPinned(exceptId?: string): Promise<void> {
  let query = adminClient.from(ANN_TABLE).update({ pinned: false }).eq('pinned', true);
  if (exceptId) query = query.neq('id', exceptId);
  const { error } = await query;
  if (error) raise(error);
}

export async function createAnniversary(input: AnniversaryInput): Promise<CoupleAnniversary> {
  if (input.pinned) await clearPinned();
  const { data, error } = await adminClient
    .from(ANN_TABLE)
    .insert({
      title: input.title,
      date: input.date,
      yearly: input.yearly,
      icon: input.icon,
      photo_url: input.photoUrl,
      pinned: input.pinned,
    })
    .select('*')
    .single();
  if (error) raise(error);
  return mapAnniversary(data as AnniversaryRow);
}

export async function updateAnniversary(
  id: string,
  input: Partial<AnniversaryInput>
): Promise<CoupleAnniversary | null> {
  if (input.pinned === true) await clearPinned(id);
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.date !== undefined) patch.date = input.date;
  if (input.yearly !== undefined) patch.yearly = input.yearly;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl;
  if (input.pinned !== undefined) patch.pinned = input.pinned;

  const { data, error } = await adminClient
    .from(ANN_TABLE)
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) raise(error);
  return data ? mapAnniversary(data as AnniversaryRow) : null;
}

export async function removeAnniversary(id: string): Promise<boolean> {
  const { data, error } = await adminClient.from(ANN_TABLE).delete().eq('id', id).select('id').maybeSingle();
  if (error) raise(error);
  return Boolean(data);
}

// ---------- 经期记录 ----------

export async function listCycles(): Promise<CycleRecord[]> {
  const { data, error } = await adminClient.from(CYCLE_TABLE).select('*').order('start_date', { ascending: true });
  if (error) raise(error);
  return (data as CycleRow[]).map(mapCycle);
}

export interface CycleInput {
  startDate: string;
  endDate: string | null;
  note: string;
}

export async function createCycle(input: CycleInput): Promise<CycleRecord> {
  const { data, error } = await adminClient
    .from(CYCLE_TABLE)
    .insert({ start_date: input.startDate, end_date: input.endDate, note: input.note })
    .select('*')
    .single();
  if (error) raise(error);
  return mapCycle(data as CycleRow);
}

export async function updateCycle(id: string, input: Partial<CycleInput>): Promise<CycleRecord | null> {
  const patch: Record<string, unknown> = {};
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.note !== undefined) patch.note = input.note;

  const { data, error } = await adminClient
    .from(CYCLE_TABLE)
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) raise(error);
  return data ? mapCycle(data as CycleRow) : null;
}

export async function removeCycle(id: string): Promise<boolean> {
  const { data, error } = await adminClient.from(CYCLE_TABLE).delete().eq('id', id).select('id').maybeSingle();
  if (error) raise(error);
  return Boolean(data);
}

// ---------- 自定义句子 ----------

export async function listQuotes(): Promise<CoupleQuote[]> {
  const { data, error } = await adminClient
    .from(QUOTE_TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) raise(error);
  return (data as QuoteRow[]).map(mapQuote);
}

export async function createQuote(content: string): Promise<CoupleQuote> {
  const { data, error } = await adminClient
    .from(QUOTE_TABLE)
    .insert({ content, is_custom: true })
    .select('*')
    .single();
  if (error) raise(error);
  return mapQuote(data as QuoteRow);
}

export async function removeQuote(id: string): Promise<boolean> {
  const { data, error } = await adminClient.from(QUOTE_TABLE).delete().eq('id', id).select('id').maybeSingle();
  if (error) raise(error);
  return Boolean(data);
}

// ---------- 设置 ----------

export function defaultSettings(): CoupleSettings {
  return {
    city: env.COUPLE_CITY || WEATHER_DEFAULT.city,
    latitude: env.COUPLE_LATITUDE,
    longitude: env.COUPLE_LONGITUDE,
    nearAnniversaryDays: 7,
    cycleAheadDays: 3,
    cycleDelayDays: 3,
    weatherDeltaC: 5,
  };
}

function pickNumber(value: unknown, fallback: number, min: number, max: number, integer = false): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return integer ? Math.round(n) : n;
}

// 允许前端只提交部分字段；非法值回落到默认值
export function sanitizeSettings(raw: Record<string, unknown>): CoupleSettings {
  const defaults = defaultSettings();
  const city = typeof raw.city === 'string' && raw.city.trim() ? raw.city.trim().slice(0, 20) : defaults.city;
  return {
    city,
    latitude: pickNumber(raw.latitude, defaults.latitude, -90, 90),
    longitude: pickNumber(raw.longitude, defaults.longitude, -180, 180),
    nearAnniversaryDays: pickNumber(raw.nearAnniversaryDays, defaults.nearAnniversaryDays, 1, 30, true),
    cycleAheadDays: pickNumber(raw.cycleAheadDays, defaults.cycleAheadDays, 0, 14, true),
    cycleDelayDays: pickNumber(raw.cycleDelayDays, defaults.cycleDelayDays, 1, 15, true),
    weatherDeltaC: pickNumber(raw.weatherDeltaC, defaults.weatherDeltaC, 2, 15, true),
  };
}

export async function getSettings(): Promise<CoupleSettings> {
  const { data, error } = await adminClient
    .from(SETTINGS_TABLE)
    .select('value')
    .eq('key', 'couple')
    .maybeSingle();
  if (error) raise(error);
  return sanitizeSettings((data?.value || {}) as Record<string, unknown>);
}

export async function saveSettings(patch: Record<string, unknown>): Promise<CoupleSettings> {
  const merged = sanitizeSettings({ ...(await getSettings()), ...patch });
  const { error } = await adminClient
    .from(SETTINGS_TABLE)
    .upsert({ key: 'couple', value: merged, updated_at: new Date().toISOString() });
  if (error) raise(error);
  return merged;
}

// ---------- 天气（Open-Meteo，免密钥） ----------

function toDay(date: string, index: number, daily: any): WeatherDay {
  const code = daily?.weather_code?.[index] ?? null;
  const info = describeWeather(code === null ? null : Number(code));
  return {
    date: String(date),
    max: Number.isFinite(Number(daily?.temperature_2m_max?.[index]))
      ? Math.round(Number(daily.temperature_2m_max[index]))
      : null,
    min: Number.isFinite(Number(daily?.temperature_2m_min?.[index]))
      ? Math.round(Number(daily.temperature_2m_min[index]))
      : null,
    precipProb: Number.isFinite(Number(daily?.precipitation_probability_max?.[index]))
      ? Math.round(Number(daily.precipitation_probability_max[index]))
      : null,
    code: code === null ? null : Number(code),
    text: info.text,
    emoji: info.emoji,
  };
}

export async function getWeather(settings: CoupleSettings, timeoutMs = 6000): Promise<WeatherInfo> {
  const city = settings.city || WEATHER_DEFAULT.city;
  const updatedAt = new Date().toISOString();
  const unavailable = (message: string): WeatherInfo => ({
    available: false,
    city,
    temp: null,
    code: null,
    text: '天气暂不可用',
    emoji: '🌥️',
    max: null,
    min: null,
    precipProb: null,
    days: [],
    advice: [],
    updatedAt,
    message,
  });

  if (
    !Number.isFinite(settings.latitude) ||
    !Number.isFinite(settings.longitude) ||
    Math.abs(settings.latitude) > 90 ||
    Math.abs(settings.longitude) > 180
  ) {
    return unavailable('城市坐标不合法，请到设置里修正');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(settings.latitude));
    url.searchParams.set('longitude', String(settings.longitude));
    url.searchParams.set('current', 'temperature_2m,weather_code');
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'
    );
    url.searchParams.set('timezone', 'Asia/Shanghai');
    url.searchParams.set('forecast_days', '3');

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo 返回 ${res.status}`);
    const body: any = await res.json();

    const daily = body?.daily;
    const days: WeatherDay[] = Array.isArray(daily?.time)
      ? daily.time.slice(0, 3).map((date: string, index: number) => toDay(date, index, daily))
      : [];
    if (!days.length) throw new Error('天气数据为空');

    const current = body?.current || {};
    const currentCode = current.weather_code === undefined ? days[0].code : Number(current.weather_code);
    const text = describeWeather(currentCode);
    const temp = Number.isFinite(Number(current.temperature_2m))
      ? Math.round(Number(current.temperature_2m))
      : null;

    const advice = buildWeatherAdvice({
      temp,
      max: days[0].max,
      min: days[0].min,
      precipProb: days[0].precipProb,
      tomorrowMax: days[1]?.max ?? null,
      deltaC: settings.weatherDeltaC,
    });

    return {
      available: true,
      city,
      temp,
      code: currentCode,
      text: text.text,
      emoji: text.emoji,
      max: days[0].max,
      min: days[0].min,
      precipProb: days[0].precipProb,
      days,
      advice,
      updatedAt,
    };
  } catch (error) {
    const reason = (error as Error)?.name === 'AbortError' ? '天气接口超时' : (error as Error)?.message;
    console.warn('[couple] 天气获取失败:', reason);
    return unavailable('天气暂时获取不到，稍后可以重试');
  } finally {
    clearTimeout(timer);
  }
}
