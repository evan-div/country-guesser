import { shuffle, type Rng } from './rng'

/**
 * Uniform random selection without repeats ("shuffle bag"). Every item has the same
 * probability; nothing repeats until the whole pool has been shown, and when the bag is
 * refilled the most recently shown items are kept out of the next few draws.
 */
export class ShuffleBag<T> {
  private bag: T[] = []
  private readonly recent: T[] = []
  private readonly window: number

  constructor(
    private readonly items: readonly T[],
    private readonly rng: Rng,
    window?: number,
  ) {
    if (!items.length) throw new Error('ShuffleBag needs at least one item')
    this.window = Math.max(0, Math.min(window ?? 12, Math.floor(items.length / 2)))
  }

  get size() {
    return this.items.length
  }

  next(): T {
    if (!this.bag.length) this.refill()
    const item = this.bag.pop()!
    this.recent.push(item)
    if (this.recent.length > this.window) this.recent.shift()
    return item
  }

  /** Look at the upcoming item without consuming it (used to pre-build geometry). */
  peek(): T {
    if (!this.bag.length) this.refill()
    return this.bag[this.bag.length - 1]
  }

  private refill() {
    const fresh = shuffle(this.items, this.rng)
    // Items are popped from the end; push recently seen ones toward the front.
    if (this.recent.length) {
      const recent = new Set(this.recent)
      const head = fresh.filter((x) => recent.has(x))
      const tail = fresh.filter((x) => !recent.has(x))
      this.bag = [...head, ...tail]
    } else {
      this.bag = fresh
    }
  }
}
