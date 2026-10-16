export const OWNED_COLORS = {
  ink: '#493D35',
  muted: '#93877D',
  line: '#E8E2D9',
  blue: '#537895',
  blueTint: '#EFF5F8',
  gold: '#A87A3E',
  paper: '#FCFAF6',
  error: '#A65349',
};

export type OwnedCollection = {
  id: string;
  name: string;
  image_url: string | null;
  max_consign_price?: number | string | null;
  total_minted?: number | string | null;
  circulating_supply?: number | string | null;
};

export type OwnedItem = {
  id: string;
  owner_id: string;
  collection_id: string;
  serial_number: number | string;
  status: string;
  consign_price?: number | string | null;
  created_at?: string;
  image_url?: string | null;
  collections: OwnedCollection | OwnedCollection[] | null;
};

export type OwnedHistory = {
  id: string;
  nft_id: string;
  buyer_id?: string | null;
  transfer_type?: string | null;
  transfer_time: string;
  price?: number | string | null;
};

export const serialLabel = (value: string | number) => '#' + String(value).padStart(6, '0');

export const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
};

export const itemStatus = (status: string) => (
  status === 'idle' ? '在库' : status === 'listed' ? '寄售中' : status === 'burned' ? '已销毁' : '暂不可操作'
);

export function validateConsignPrice(input: string, max: unknown): string | null {
  const normalized = input.trim();
  const parts = normalized.split('.');
  const digitsOnly = (value: string) => value.length > 0 && [...value].every((character) => character >= '0' && character <= '9');
  if (!digitsOnly(parts[0]) || parts.length > 2 || (parts.length === 2 && (!digitsOnly(parts[1]) || parts[1].length > 2)) || !Number.isFinite(Number(normalized)) || Number(normalized) <= 0) {
    return '请输入大于0且最多两位小数的价格';
  }
  const limit = Number(max);
  if (Number.isFinite(limit) && limit > 0 && Number(normalized) > limit) return '最高寄售价为 ' + money(limit) + ' 土豆币';
  return null;
}

export const formatIslandTime = (value?: string | null) => {
  if (!value) return '时间未记录';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '时间未记录'
    : date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
