import { describe, it, expect, vi } from "vitest";
import { Emitter } from "../../src/core/events.js";

describe("Emitter", () => {
  it("calls a registered listener when the event fires", () => {
    const emitter = new Emitter();
    const cb = vi.fn();
    emitter.on("change", cb);
    emitter.emit("change", { a: 1 });
    expect(cb).toHaveBeenCalledWith({ a: 1 });
  });

  it("supports multiple listeners for the same event", () => {
    const emitter = new Emitter();
    const a = vi.fn();
    const b = vi.fn();
    emitter.on("change", a);
    emitter.on("change", b);
    emitter.emit("change");
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it("on() returns an unsubscribe function", () => {
    const emitter = new Emitter();
    const cb = vi.fn();
    const unsubscribe = emitter.on("change", cb);
    unsubscribe();
    emitter.emit("change");
    expect(cb).not.toHaveBeenCalled();
  });

  it("off() removes a specific listener", () => {
    const emitter = new Emitter();
    const cb = vi.fn();
    emitter.on("change", cb);
    emitter.off("change", cb);
    emitter.emit("change");
    expect(cb).not.toHaveBeenCalled();
  });

  it("emitting an event with no listeners does not throw", () => {
    const emitter = new Emitter();
    expect(() => emitter.emit("nothing-registered")).not.toThrow();
  });
});
