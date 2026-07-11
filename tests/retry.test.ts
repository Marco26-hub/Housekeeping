import { retry } from "@/lib/retry";

describe("retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("succeeds on first try", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = retry(fn, { maxRetries: 3, delayMs: 100 });
    await expect(result).resolves.toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");

    const promise = retry(fn, { maxRetries: 3, delayMs: 100 });

    // Advance timers for retries
    await vi.advanceTimersByTimeAsync(300);

    await expect(promise).resolves.toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after max retries", async () => {
    const fn = vi.fn().mockImplementation(async () => { throw new Error("always fails"); });

    const promise = retry(fn, { maxRetries: 2, delayMs: 100 });
    const assertion = expect(promise).rejects.toThrow("always fails");

    await vi.advanceTimersByTimeAsync(300);

    await assertion;
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("uses exponential backoff by default", async () => {
    const fn = vi.fn().mockImplementation(async () => { throw new Error("fail"); });

    const promise = retry(fn, { maxRetries: 3, delayMs: 1000, backoff: "exponential" });
    const assertion = expect(promise).rejects.toThrow("fail");

    // First retry: 1000ms, second: 2000ms, third: 4000ms
    await vi.advanceTimersByTimeAsync(7000);

    await assertion;
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it("uses linear backoff when specified", async () => {
    const fn = vi.fn().mockImplementation(async () => { throw new Error("fail"); });

    const promise = retry(fn, { maxRetries: 3, delayMs: 1000, backoff: "linear" });
    const assertion = expect(promise).rejects.toThrow("fail");

    // Each retry: 1000ms, 2000ms, 3000ms
    await vi.advanceTimersByTimeAsync(6000);

    await assertion;
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
