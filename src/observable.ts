type SubscribeCallback<T> = (value: T) => void;

export class Observable<T> {
  private subscribers: SubscribeCallback<T>[] = [];

  constructor(private value: T) {}

  subscribe(callback: SubscribeCallback<T>): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((fn) => fn !== callback);
    };
  }

  get() {
    return this.value;
  }

  set(value: T) {
    this.value = value;
    this.subscribers.forEach((fn) => fn(value));
  }
}
