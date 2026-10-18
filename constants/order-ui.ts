// Frontend input/display rules only; settlement remains on the existing backend.
export function orderMoney(value: unknown) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function orderPrice(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const number = Number(value);
  return number > 0 && Number.isSafeInteger(Math.round(number * 100)) ? number : null;
}
export function orderQuantity(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number > 0 && Number.isSafeInteger(number) ? number : null;
}
export function orderTotal(price: number | null, quantity: number | null): number | null {
  if (price === null || quantity === null) return null;
  const total = price * quantity;
  return Number.isFinite(total) && Number.isSafeInteger(Math.round(total * 100)) ? total : null;
}
export function orderError(error: unknown, fallback: string) {
  return typeof (error as { message?: unknown })?.message === 'string' ? (error as { message: string }).message : fallback;
}
