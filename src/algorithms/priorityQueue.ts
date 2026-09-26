/**
 * Binary Min-Heap Priority Queue for Dijkstra shortest-path calculations.
 * Supports enqueue, dequeue, and isEmpty with O(log n) performance.
 */

export interface PriorityQueueItem<T> {
  item: T;
  priority: number;
}

export class MinPriorityQueue<T> {
  private heap: PriorityQueueItem<T>[] = [];

  constructor() {}

  /**
   * Insert item with numerical priority (lower priority values come out first).
   */
  enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the lowest priority item. Returns undefined if empty.
   */
  dequeue(): PriorityQueueItem<T> | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.sinkDown(0);
    return min;
  }

  /**
   * Check if queue is empty.
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Current number of elements in the queue.
   */
  size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    let curr = index;
    while (curr > 0) {
      const parent = Math.floor((curr - 1) / 2);
      if (this.heap[curr].priority < this.heap[parent].priority) {
        // Swap
        const temp = this.heap[curr];
        this.heap[curr] = this.heap[parent];
        this.heap[parent] = temp;
        curr = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    let curr = index;

    while (true) {
      const left = 2 * curr + 1;
      const right = 2 * curr + 2;
      let smallest = curr;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }

      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }

      if (smallest !== curr) {
        const temp = this.heap[curr];
        this.heap[curr] = this.heap[smallest];
        this.heap[smallest] = temp;
        curr = smallest;
      } else {
        break;
      }
    }
  }
}
