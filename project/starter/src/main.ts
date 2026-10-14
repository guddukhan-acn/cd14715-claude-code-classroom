import * as dotenv from 'dotenv';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CodeReviewOrchestrator } from './orchestrator';
import { ReportGenerator } from './utils/report-generator';

dotenv.config();

async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  if (!owner || !repo || !prStr) {
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    process.exit(1);
  }

  const prNumber = Number(prStr);

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.error('Error: pr-number must be a positive integer.');
    process.exit(1);
  }

  const hasAnthropicAuth = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasAwsAuth =
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  if (hasAwsAuth) {
    if (!process.env.AWS_REGION) {
      console.error(
        'Error: AWS_REGION is required when using AWS Bedrock authentication.'
      );
      process.exit(1);
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicAuth) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error(
      'Error: Authentication not configured.\n' +
      'Set ANTHROPIC_API_KEY, or configure AWS_ACCESS_KEY_ID, ' +
      'AWS_SECRET_ACCESS_KEY, and AWS_REGION for Bedrock.'
    );
    process.exit(1);
  }

  const model = process.env.ANTHROPIC_MODEL;

  if (!model) {
    console.error(
      'Error: ANTHROPIC_MODEL is required.\n' +
      'Anthropic API: claude-sonnet-4-5-20250929\n' +
      'AWS Bedrock: us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
    process.exit(1);
  }

  try {
    console.log(`🔍 Reviewing ${owner}/${repo} PR #${prNumber}...`);

    const orchestrator = new CodeReviewOrchestrator({
      model,
      maxTurns: 30,
      maxBudgetUsd: 5,
    });

    const report = await orchestrator.reviewPullRequest(
      owner,
      repo,
      prNumber
    );

    const generator = new ReportGenerator();
    const reportsDir = path.resolve('reports');

    await fs.mkdir(reportsDir, { recursive: true });

    const baseName = `${owner}-${repo}-pr-${prNumber}`;

    await Promise.all([
      fs.writeFile(
        path.join(reportsDir, `${baseName}.json`),
        generator.generateJSONReport(report),
        'utf8'
      ),
      fs.writeFile(
        path.join(reportsDir, `${baseName}.md`),
        generator.generateMarkdownReport(report),
        'utf8'
      ),
      fs.writeFile(
        path.join(reportsDir, `${baseName}.html`),
        generator.generateHTMLReport(report),
        'utf8'
      ),
    ]);

    console.log(`✅ Review complete.`);
    console.log(`📁 Reports written to ${reportsDir}`);
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  }
}

main();
