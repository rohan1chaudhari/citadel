#!/usr/bin/env node
/**
 * Validates registry.json structure and required fields.
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'registry.json');
const REQUIRED_APP_FIELDS = ['id', 'name', 'description', 'repo_url', 'author', 'tags', 'version', 'manifest_version'];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function validate() {
  console.log('🔍 Validating registry.json...\n');

  if (!fs.existsSync(REGISTRY_PATH)) {
    fail('registry.json not found');
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (err) {
    fail(`Invalid JSON: ${err.message}`);
  }

  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    fail('registry.json must be an object with an "apps" array');
  }

  if (!Array.isArray(registry.apps)) {
    fail('registry.json missing required "apps" array');
  }

  const errors = [];
  const ids = new Set();

  registry.apps.forEach((entry, index) => {
    const prefix = `App ${index + 1}`;

    for (const field of REQUIRED_APP_FIELDS) {
      if (!(field in entry)) {
        errors.push(`${prefix}: Missing required field "${field}"`);
      }
    }

    if (entry.id) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) {
        errors.push(`${prefix}: Invalid id "${entry.id}" (lowercase letters/numbers/hyphens only)`);
      }
      if (ids.has(entry.id)) {
        errors.push(`${prefix}: Duplicate id "${entry.id}"`);
      }
      ids.add(entry.id);
    }

    if (entry.repo_url && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(entry.repo_url)) {
      errors.push(`${prefix}: Invalid repo_url "${entry.repo_url}" (must be https://github.com/user/repo)`);
    }

    if ('tags' in entry && !Array.isArray(entry.tags)) {
      errors.push(`${prefix}: "tags" must be an array`);
    }

    if (entry.manifest_version && entry.manifest_version !== '1.0') {
      errors.push(`${prefix}: Unsupported manifest_version "${entry.manifest_version}" (must be "1.0")`);
    }

    if ('verified' in entry && typeof entry.verified !== 'boolean') {
      errors.push(`${prefix}: "verified" must be boolean when present`);
    }
  });

  if (errors.length > 0) {
    console.error('❌ Validation failed:\n');
    errors.forEach((err) => console.error(`  - ${err}`));
    console.error(`\n${errors.length} error(s) found`);
    process.exit(1);
  }

  console.log(`✅ Registry valid: ${registry.apps.length} app(s)`);
  registry.apps.forEach((app) => {
    const verifiedMark = app.verified ? ' ✅ verified' : '';
    console.log(`  - ${app.id}: ${app.name}${verifiedMark}`);
  });
}

validate();
