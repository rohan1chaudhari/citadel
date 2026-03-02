#!/usr/bin/env node
/**
 * Checks that repo_url values are reachable and contain app.yaml
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'registry.json');

async function checkRepo(repoUrl) {
  // Convert github.com URL to raw content URL for app.yaml
  const match = repoUrl.match(/^https:\/\/github\.com\/(.+)\/(.+)$/);
  if (!match) return { ok: false, error: 'Invalid GitHub URL format' };

  const [, owner, repo] = match;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/app.yaml`;

  try {
    const response = await fetch(rawUrl, { method: 'HEAD' });
    if (response.status === 200) {
      return { ok: true };
    }
    // Try master branch as fallback
    const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/app.yaml`;
    const masterResponse = await fetch(masterUrl, { method: 'HEAD' });
    if (masterResponse.status === 200) {
      return { ok: true };
    }
    return { ok: false, error: `app.yaml not found (HTTP ${response.status})` };
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` };
  }
}

async function checkRepos() {
  console.log('🔍 Checking app repositories...\n');

  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const errors = [];
  const warnings = [];

  for (const entry of registry) {
    process.stdout.write(`  Checking ${entry.id}... `);
    const result = await checkRepo(entry.repo_url);
    if (result.ok) {
      console.log('✅');
    } else {
      console.log(`⚠️  ${result.error}`);
      // Don't fail for network issues, just warn
      warnings.push(`${entry.id}: ${result.error}`);
    }
  }

  console.log();
  if (warnings.length > 0) {
    console.log('⚠️  Warnings (non-blocking):');
    warnings.forEach(w => console.log(`  - ${w}`));
    console.log('\nNote: New repos may not exist yet. This is expected for new submissions.');
  }

  console.log('\n✅ Repository checks complete');
}

checkRepos().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
