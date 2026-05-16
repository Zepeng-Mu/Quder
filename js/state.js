// Simple pub/sub state management — replaces Shiny reactiveVal

export class State {
  constructor(initial = {}) {
    this._values = { ...initial };
    this._subscribers = new Map();
  }

  get(key) {
    return this._values[key];
  }

  set(key, value) {
    this._values[key] = value;
    const subs = this._subscribers.get(key);
    if (subs) {
      for (const fn of subs) fn(value);
    }
  }

  subscribe(key, callback) {
    if (!this._subscribers.has(key)) {
      this._subscribers.set(key, new Set());
    }
    this._subscribers.get(key).add(callback);
    return () => this._subscribers.get(key).delete(callback);
  }
}
