#!/usr/bin/env node
/**
 * Validates registry.json structure and required fields
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'registry.json');

const REQUIRED_FIELDS = ['id', 'name', 'description', 'repo_url', 'author', 'tags', 'version', 'manifest_version'];

function validate() {
  console.log('🔍 Validating registry.json...\n');

  // Check file exists
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('❌ registry.json not found');
    process.exit(1);
  }

  // Parse JSON
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (err) {
    console.error('❌ Invalid JSON:', err.message);
    process.exit(1);
  }

  // Must be array
  if (!Array.isArray(registry)) {
    console.error('❌ registry.json must be an array');
    process.exit(1);
  }

  const errors = [];
  const ids = new Set();

  registry.forEach((entry, index) => {
    const prefix = `Entry ${index + 1}`;

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in entry)) {
        errors.push(`${prefix}: Missing required field "${field}"`);
      }
    }

    // Validate ID format
    if (entry.id) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) {
        errors.push(`${prefix}: Invalid ID format "${entry.id}" (must be lowercase alphanumeric with hyphens)`);
      }
      if (ids.has(entry.id)) {
        errors.push(`${prefix}: Duplicate ID "${entry.id}"`);
      }
      ids.add(entry.id);
    }

    // Validate repo_url is HTTPS GitHub URL
    if (entry.repo_url) {
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(entry.repo_url)) {
        errors.push(`${prefix}: Invalid repo_url "${entry.repo_url}" (must be https://github.com/user/repo)`);
      }
    }

    // Validate tags is array
    if (entry.tags && !Array.isArray(entry.tags)) {
      errors.push(`${prefix}: "tags" must be an array`);
    }

    // Validate manifest_version
    if (entry.manifest_version && entry.manifest_version !== '1.0') {
      errors.push(`${prefix}: Unsupported manifest_version "${entry.manifest_version}" (must be "1.0")`);
    }
  });

  // Report results
  if (errors.length > 0) {
    console.error('❌ Validation failed:\n');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error(`\n${errors.length} error(s) found`);
    process.exit(1);
  }

  console.log(`✅ Registry valid: ${registry.length} app(s)`);
  registry.forEach(app => console.log(`  - ${app.id}: ${app.name}`));
}

validate();
