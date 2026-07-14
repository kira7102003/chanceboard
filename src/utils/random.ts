export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new RangeError('maxExclusive must be positive')
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive
  const value = new Uint32Array(1)
  do crypto.getRandomValues(value)
  while (value[0] >= limit)
  return value[0] % maxExclusive
}

export function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
