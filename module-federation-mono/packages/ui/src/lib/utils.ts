import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn - Utility for merging Tailwind CSS classes
 * Based on shadcn/ui's cn function
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
