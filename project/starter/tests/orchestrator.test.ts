import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { CodeReviewOrchestrator } from '../src/orchestrator';
import { ReviewReportSchema } from '../src/types/report-types';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

const queryMock = vi.mocked(query);

const validReport = {
  pullRequest: { owner: 'udacity', repo: 'cd14715-simple-todo-app', number: 1 },
  fileReviews: [
    {
      file: 'src/todo.ts',
      codeQuality: {
        file: 'src/todo.ts',
        issues: [],
        overallScore: 90,
        summary: 'No significant issues found.',
      },
      testCoverage: {
        file: 'src/todo.ts',
        hasTests: true,
        testFiles: ['src/todo.test.ts'],
        untestedPaths: [],
        coverageEstimate: 85,
        summary: 'Core paths are covered.',
      },
      refactorings: {
        file: 'src/todo.ts',
        suggestions: [],
        summary: 'No refactoring needed.',
      },
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 90,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: {
    analyzedAt: '2026-10-19T12:00:00.000Z',
    duration: 10,
    agentVersions: { orchestrator: '1.0.0' },
  },
};

function mockQueryResult(output: unknown): void {
  queryMock.mockImplementation(
    () =>
      ({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'result', structured_output: output };
        },
      }) as ReturnType<typeof query>
  );
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult(validReport);
  });

  it('uses default query configuration and validates the aggregated report', async () => {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(
      'udacity',
      'cd14715-simple-todo-app',
      1
    );

    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
    expect(report.pullRequest).toEqual(validReport.pullRequest);
    expect(report.fileReviews).toHaveLength(1);
    expect(report.metadata.duration).toBeGreaterThanOrEqual(0);
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Pull request number: 1'),
        options: expect.objectContaining({
          maxTurns: 30,
          agents: expect.objectContaining({
            codeQualityAnalyzer: expect.any(Object),
            testCoverageAnalyzer: expect.any(Object),
            refactoringSuggester: expect.any(Object),
          }),
          allowedTools: expect.arrayContaining(['Task']),
          mcpServers: expect.any(Object),
          outputFormat: expect.objectContaining({ type: 'json_schema' }),
        }),
      })
    );
  });

  it('applies caller-provided query, retry, and timeout options', async () => {
    const orchestrator = new CodeReviewOrchestrator({
      model: 'test-model',
      maxTurns: 12,
      maxBudgetUsd: 2,
      maxRetries: 0,
      retryDelayMs: 0,
      timeoutMs: 1000,
    });

    await orchestrator.reviewPullRequest('owner', 'repo', 2);

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          model: 'test-model',
          maxTurns: 12,
          maxBudgetUsd: 2,
        }),
      })
    );
  });

  it('retries transient query failures and returns the successful report', async () => {
    queryMock
      .mockImplementationOnce(() => {
        throw new Error('temporary failure');
      })
      .mockImplementation(
        () =>
          ({
            [Symbol.asyncIterator]: async function* () {
              yield { type: 'result', structured_output: validReport };
            },
          }) as ReturnType<typeof query>
      );

    const orchestrator = new CodeReviewOrchestrator({
      maxRetries: 1,
      retryDelayMs: 0,
      timeoutMs: 1000,
    });

    const report = await orchestrator.reviewPullRequest('owner', 'repo', 3);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(report.pullRequest.number).toBe(1);
  });

  it('rejects output that does not match the ReviewReport schema', async () => {
    mockQueryResult({ pullRequest: { owner: 'owner' } });

    const orchestrator = new CodeReviewOrchestrator({
      maxRetries: 0,
      timeoutMs: 1000,
    });

    await expect(
      orchestrator.reviewPullRequest('owner', 'repo', 1)
    ).rejects.toMatchObject({ name: 'ZodError' });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('retries query failures up to the configured retry limit', async () => {
    queryMock.mockImplementation(() => {
      throw new Error('persistent failure');
    });

    const orchestrator = new CodeReviewOrchestrator({
      maxRetries: 2,
      retryDelayMs: 0,
      timeoutMs: 1000,
    });

    await expect(
      orchestrator.reviewPullRequest('owner', 'repo', 1)
    ).rejects.toMatchObject({ code: 'RETRY_EXHAUSTED' });
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it.skip('reviews a real public pull request when API credentials are configured', async () => {
    const orchestrator = new CodeReviewOrchestrator({
      model: process.env.ANTHROPIC_MODEL,
    });

    const report = await orchestrator.reviewPullRequest(
      'udacity',
      'cd14715-simple-todo-app',
      1
    );

    expect(report.pullRequest).toEqual({
      owner: 'udacity',
      repo: 'cd14715-simple-todo-app',
      number: 1,
    });
    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
  });
});
