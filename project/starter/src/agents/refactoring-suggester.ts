import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { refactoringSuggesterPrompt } from '../prompts/refactoring-suggester.prompt';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Analyzes source code and suggests practical refactoring, modernization, simplification, naming, and design-pattern improvements.',

  model: 'inherit',

  tools: [
    'Read',
    'Grep',
    'Glob', 'Skill',
  ],

  prompt: refactoringSuggesterPrompt,

};