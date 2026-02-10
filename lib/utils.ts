import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isNetworkError = (err: unknown) => {
  if (err instanceof TypeError) return true;
  const msg = String((err as any)?.message ?? err ?? '');
  return /Failed to fetch|NetworkError|TypeError|Load failed|ERR_NETWORK/i.test(msg);
};