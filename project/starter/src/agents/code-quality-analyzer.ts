import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { codeQualityAnalyzerPrompt } from '../prompts/code-quality-analyzer.prompt';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes source code for security vulnerabilities, performance problems, maintainability issues, bugs, style problems, and best-practice violations.',

  model: 'inherit',

  tools: [
    'Read',
    'Grep',
    'Glob',
    'Skill'
  ],

  prompt: codeQualityAnalyzerPrompt,

};