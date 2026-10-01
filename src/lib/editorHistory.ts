/** Bounded immutable JSON snapshots; one completed gesture is one undo step. */
export class EditorHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private readonly limit = 50) {}
  get undoCount() { return this.past.length; }
  get redoCount() { return this.future.length; }
  private clone(value: T): T { return JSON.parse(JSON.stringify(value)); }
  record(current: T, next: T) {
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    this.past.push(this.clone(current));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: T): T | null {
    const previous = this.past.pop(); if (!previous) return null;
    this.future.push(this.clone(current)); return previous;
  }
  redo(current: T): T | null {
    const next = this.future.pop(); if (!next) return null;
    this.past.push(this.clone(current)); return next;
  }
}
