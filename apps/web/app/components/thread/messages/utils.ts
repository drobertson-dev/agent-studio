/**
 * @description Checks if a value is a complex object or array
 */
export function isComplexValue(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === 'object' && value !== null)
}
