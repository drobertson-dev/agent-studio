/**
 * Utility functions for stream-related operations
 */

/**
 * Returns a new array with duplicate values removed
 * @template T - The type of elements in the array
 * @param array - The input array to deduplicate
 * @returns A new array containing unique elements from the input array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)]
}
/**
 * Finds the last index in an array that matches a predicate
 * @template T - The type of elements in the array
 * @param array - The array to search through
 * @param predicate - A function that returns true for the element to find
 * @returns The last index where the predicate returns true, or -1 if not found
 */
export function findLastIndex<T>(array: T[], predicate: (value: T) => boolean): number {
  for (let i = array.length - 1; i >= 0; i--) {
    const item = array[i]
    if (item !== undefined && predicate(item)) return i
  }
  return -1
}
/**
 * Creates a delay Promise that resolves after the specified time
 * @param ms - The number of milliseconds to sleep (default: 4000)
 * @returns A Promise that resolves when the delay is complete
 */
export async function sleep(ms = 4000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Path separator character used in stream path operations
 */
export const PATH_SEP = '>'
/**
 * Special identifier for the root element in stream operations
 */
export const ROOT_ID = '$'
