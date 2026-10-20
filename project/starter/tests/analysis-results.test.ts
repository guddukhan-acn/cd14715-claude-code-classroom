import { describe, expect, it } from 'vitest';
import {
  CodeQualityResultSchema,
  RefactoringSuggestionSchema,
  TestCoverageResultSchema,
} from '../src/types/analysis-results';
import { ReviewReportSchema } from '../src/types/report-types';

describe('analysis result schemas', () => {
  it('accepts a valid code quality result and rejects an out-of-range score', () => {
    const result = {
      file: 'src/todo.ts',
      issues: [
        {
          line: 12,
          severity: 'medium',
          category: 'maintainability',
          description: 'Repeated conditional logic.',
          suggestion: 'Extract the condition into a helper.',
        },
      ],
      overallScore: 80,
      summary: 'Generally clear implementation.',
    };

    expect(CodeQualityResultSchema.safeParse(result).success).toBe(true);
    expect(
      CodeQualityResultSchema.safeParse({ ...result, overallScore: 101 }).success
    ).toBe(false);
  });

  it('accepts a valid test coverage result and rejects an invalid path priority', () => {
    const result = {
      file: 'src/todo.ts',
      hasTests: true,
      testFiles: ['src/todo.test.ts'],
      untestedPaths: [
        {
          type: 'edge-case',
          location: 'empty task title',
          priority: 'high',
          reasoning: 'Empty values can cause invalid task state.',
          suggestedTest: 'Verify empty titles are rejected.',
        },
      ],
      coverageEstimate: 75,
      summary: 'Some edge cases need tests.',
    };

    expect(TestCoverageResultSchema.safeParse(result).success).toBe(true);
    expect(
      TestCoverageResultSchema.safeParse({
        ...result,
        untestedPaths: [{ ...result.untestedPaths[0], priority: 'urgent' }],
      }).success
    ).toBe(false);
  });

  it('accepts a valid refactoring result and rejects an unsupported suggestion type', () => {
    const result = {
      file: 'src/todo.ts',
      suggestions: [
        {
          type: 'extract-function',
          location: 'lines 10-18',
          impact: 'low',
          description: 'Extract task validation.',
          before: 'inline validation',
          after: 'validateTask(task)',
          benefits: 'Improves readability.',
        },
      ],
      summary: 'One small refactoring may help.',
    };

    expect(RefactoringSuggestionSchema.safeParse(result).success).toBe(true);
    expect(
      RefactoringSuggestionSchema.safeParse({
        ...result,
        suggestions: [{ ...result.suggestions[0], type: 'rewrite' }],
      }).success
    ).toBe(false);
  });

  it('accepts a complete review report and rejects incomplete output', () => {
    const report = {
      pullRequest: { owner: 'owner', repo: 'repo', number: 1 },
      fileReviews: [],
      summary: {
        totalFiles: 0,
        overallScore: 0,
        criticalIssues: 0,
        highPriorityTests: 0,
        refactoringOpportunities: 0,
      },
      recommendations: [],
      metadata: {
        analyzedAt: '2026-10-19T12:00:00.000Z',
        duration: 0,
        agentVersions: {},
      },
    };

    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
    expect(ReviewReportSchema.safeParse({ ...report, metadata: {} }).success).toBe(
      false
    );
  });
});
