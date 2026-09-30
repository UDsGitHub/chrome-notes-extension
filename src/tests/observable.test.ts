import { describe, expect, it, vi } from "vitest";
import { Observable } from "../observable.js";

describe("Observable", () => {
  it("returns observable value on get()", () => {
    const observable = new Observable(1);
    expect(observable.get()).toBe(1);
  });

  it("returns updated observable value after set()", () => {
    const observable = new Observable(1);
    observable.set(2);
    expect(observable.get()).toBe(2);
  });

  it("subscriber callback gets called with observable value", () => {
    const observable = new Observable(1);
    const callback = vi.fn();

    observable.subscribe((value) => callback(value));

    observable.set(2);

    expect(callback).toHaveBeenCalledWith(2);
  });

  it("all subscribers callback gets called with observable value", () => {
    const observable = new Observable(1);
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    observable.subscribe((value) => callback1(value));
    observable.subscribe((value) => callback2(value));

    observable.set(2);

    expect(callback1).toHaveBeenCalledWith(2);
    expect(callback2).toHaveBeenCalledWith(2);
  });

  it("unsubscribe stops further notifications", () => {
    const observable = new Observable(1);
    const callback = vi.fn();
    const unsubscribe = observable.subscribe(callback);

    unsubscribe();
    observable.set(2);

    expect(callback).not.toHaveBeenCalled();
  });
});
