import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { testCoverageAnalyzerPrompt } from '../prompts/test-coverage-analyzer.prompt';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Analyzes source code and its tests to identify missing test coverage, untested paths, branches, functions, and edge cases.',

  model: 'inherit',

  tools: [
    'Read',
    'Grep',
    'Glob', 'Skill',
  ],

  prompt: testCoverageAnalyzerPrompt,

};