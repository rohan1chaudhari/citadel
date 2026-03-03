#!/usr/bin/env node
/**
 * CI checks for submission quality:
 * - repository is reachable
 * - app.yaml exists and has required fields
 * - migration SQL files do not contain blocked statements (ATTACH)
 *
 * Blocking scope: only app IDs touched by this PR (detected via git diff on registry.json).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'registry.json');
const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version', 'permissions'];

function parseGitHubUrl(repoUrl) {
  const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function fetchText(url, opts = {}) {
  const response = await fetch(url, opts);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(url, opts = {}) {
  const response = await fetch(url, opts);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function parseSimpleYaml(yamlText) {
  const result = {};
  for (const line of yamlText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || key.includes(' ')) continue;
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

function getTouchedIdsFromDiff() {
  try {
    const diff = execSync('git diff --unified=0 HEAD~1..HEAD -- registry.json', {
      cwd: path.join(__dirname, '..', '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const ids = new Set();
    for (const line of diff.split('\n')) {
      if (!line.startsWith('+') && !line.startsWith('-')) continue;
      const m = line.match(/"id"\s*:\s*"([a-z0-9-]+)"/i);
      if (m) ids.add(m[1]);
    }
    return ids;
  } catch {
    return new Set();
  }
}

async function resolveDefaultBranch(owner, repo) {
  const repoMeta = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`);
  return repoMeta.default_branch || 'main';
}

async function checkApp(entry) {
  const gh = parseGitHubUrl(entry.repo_url);
  if (!gh) return { ok: false, errors: ['Invalid GitHub URL format'], warnings: [] };

  const errors = [];
  const warnings = [];

  let branch;
  try {
    branch = await resolveDefaultBranch(gh.owner, gh.repo);
  } catch (err) {
    errors.push(`Repository unreachable: ${err.message}`);
    return { ok: false, errors, warnings };
  }

  const rawBase = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${branch}`;

  let appYaml;
  try {
    appYaml = await fetchText(`${rawBase}/app.yaml`);
  } catch (err) {
    errors.push(`app.yaml not found/readable: ${err.message}`);
    return { ok: false, errors, warnings };
  }

  const manifest = parseSimpleYaml(appYaml);
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in manifest)) {
      errors.push(`app.yaml missing required field: ${field}`);
    }
  }

  try {
    const contents = await fetchJson(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/migrations?ref=${encodeURIComponent(branch)}`);
    if (Array.isArray(contents)) {
      const sqlFiles = contents.filter((item) => item.type === 'file' && item.name.endsWith('.sql'));
      for (const file of sqlFiles) {
        const sqlText = await fetchText(`${rawBase}/migrations/${file.name}`);
        if (/\bATTACH\b/i.test(sqlText)) {
          errors.push(`blocked SQL detected in migrations/${file.name}: ATTACH is not allowed`);
        }
      }
    }
  } catch (err) {
    warnings.push(`Could not inspect migrations directory: ${err.message}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function run() {
  console.log('🔍 Running repository checks...\n');

  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const apps = Array.isArray(registry.apps) ? registry.apps : [];

  const touchedIds = getTouchedIdsFromDiff();
  const enforceAll = touchedIds.size === 0;

  if (enforceAll) {
    console.log('ℹ️  Could not detect touched IDs from git diff; running in warning-only mode for reachability checks.\n');
  } else {
    console.log(`ℹ️  Blocking validation enabled for touched app IDs: ${Array.from(touchedIds).join(', ')}\n`);
  }

  const allBlockingErrors = [];
  const allWarnings = [];

  for (const app of apps) {
    process.stdout.write(`  Checking ${app.id}... `);
    const result = await checkApp(app);

    const isBlocking = !enforceAll && touchedIds.has(app.id);

    if (result.ok) {
      console.log('✅');
    } else if (isBlocking) {
      console.log('❌');
      for (const err of result.errors) allBlockingErrors.push(`${app.id}: ${err}`);
    } else {
      console.log('⚠️');
      for (const err of result.errors) allWarnings.push(`${app.id}: ${err}`);
    }

    for (const warning of result.warnings || []) {
      allWarnings.push(`${app.id}: ${warning}`);
    }
  }

  console.log();

  if (allWarnings.length > 0) {
    console.log('⚠️  Warnings:');
    allWarnings.forEach((w) => console.log(`  - ${w}`));
    console.log();
  }

  if (allBlockingErrors.length > 0) {
    console.error('❌ Repository checks failed for touched app IDs:');
    allBlockingErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('✅ Repository checks passed');
}

run().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
