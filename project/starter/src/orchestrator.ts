import { query } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types';
import { mcpServersConfig } from './config/mcp.config';
import { codeQualityAnalyzer } from './agents/code-quality-analyzer';
import { testCoverageAnalyzer } from './agents/test-coverage-analyzer';
import { refactoringSuggester } from './agents/refactoring-suggester';
import { orchestratorPrompt } from './prompts/orchestrator.prompt';

export interface OrchestratorOptions {
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
}

export class CodeReviewOrchestrator {
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    this.options = options;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const start = Date.now();

    const prompt = `${orchestratorPrompt}

Review this pull request:
- Repository owner: ${owner}
- Repository name: ${repo}
- Pull request number: ${prNumber}

Return ONLY the final ReviewReport JSON.`;

    let result: unknown;

    for await (const message of query({
      prompt,
      options: {
        model: this.options.model,
        maxTurns: this.options.maxTurns ?? 30,
        maxBudgetUsd: this.options.maxBudgetUsd,
        mcpServers: mcpServersConfig,
        agents: {
          codeQualityAnalyzer,
          testCoverageAnalyzer,
          refactoringSuggester,
        },
        allowedTools: [
          'Task',
          'Read',
          'Grep',
          'Glob',
          'Skill',
          'mcp__github__*',
          'mcp__eslint__*',
        ],
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema,
        },
      },
    })) {
      if (message.type === 'result') {
        result = (message as any).structured_output ?? (message as any).result ?? (message as any).structuredOutput;
      }
    }

    if (!result) {
      throw new Error('Claude did not return a structured review report');
    }

    const report = typeof result === 'string' ? JSON.parse(result) : result;
    const validated = ReviewReportSchema.parse(report);

    return {
      ...validated,
      metadata: {
        ...validated.metadata,
        duration: Date.now() - start,
      },
    };
  }
}
