import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ErrorCodes,
  ReviewError,
  withRetry,
  withTimeout,
} from '../src/utils/error-handler';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('withRetry', () => {
  it('uses exponential backoff with jitter and returns the successful result', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary 1'))
      .mockRejectedValueOnce(new Error('temporary 2'))
      .mockResolvedValue('success');

    const result = withRetry(operation, 2, 100);
    await vi.advanceTimersByTimeAsync(149);
    expect(operation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(249);
    expect(operation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('throws RETRY_EXHAUSTED and retains the final failure after all attempts', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const failure = new Error('unavailable');
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(failure);

    await expect(withRetry(operation, 2, 0)).rejects.toMatchObject({
      name: 'ReviewError',
      code: ErrorCodes.RETRY_EXHAUSTED,
      metadata: { maxRetries: 2, attempts: 3, cause: failure },
    });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('rejects invalid retry configuration', async () => {
    await expect(withRetry(async () => 'ok', -1, 0)).rejects.toThrow(RangeError);
    await expect(withRetry(async () => 'ok', 0, -1)).rejects.toThrow(RangeError);
  });
});

describe('withTimeout', () => {
  it('returns the operation result when it completes before the deadline', async () => {
    await expect(withTimeout(async () => 'done', 100)).resolves.toBe('done');
  });

  it('rejects with AGENT_TIMEOUT when the operation exceeds the deadline', async () => {
    const operation = new Promise<never>(() => {});

    await expect(
      withTimeout(() => operation, 1, 'Review exceeded its deadline')
    ).rejects.toMatchObject({
      name: 'ReviewError',
      code: ErrorCodes.AGENT_TIMEOUT,
      message: 'Review exceeded its deadline',
      metadata: { timeoutMs: 1 },
    });
  });

  it('preserves failures from the wrapped operation', async () => {
    const failure = new ReviewError('query failed', ErrorCodes.AGENT_FAILED);

    await expect(
      withTimeout(async () => {
        throw failure;
      }, 100)
    ).rejects.toBe(failure);
  });
});
