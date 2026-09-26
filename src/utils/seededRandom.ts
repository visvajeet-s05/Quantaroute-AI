/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 * Ensures reproducible scenarios across all reloads and platforms.
 */

export class SeededRandom {
  private state: number;
  public readonly initialSeed: number;

  constructor(seed: number) {
    this.initialSeed = Math.floor(seed);
    this.state = this.initialSeed;
  }

  /**
   * Generates a floating point number in [0, 1)
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates an integer in [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }

  /**
   * Generates a float in [min, max)
   */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Shuffles an array in place deterministically using Fisher-Yates
   */
  shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
