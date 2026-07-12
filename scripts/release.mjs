#!/usr/bin/env node
// One-command release script for flyer-editor.
// L0 personal-tool release: gates -> compute CalVer tag -> notes -> tag -> push -> gh release.
// See RELEASE.md for the agreed process. Plain Node ESM, zero external deps.

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');

function log(step) {
  console.log(`==> ${step}`);
}

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function run(cmd) {
  // Simple fixed git plumbing commands with no untrusted interpolation.
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function runSpawn(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
    ...opts,
  });
  if (result.error) {
    fail(`Failed to run "${cmd} ${args.join(' ')}": ${result.error.message}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Version computation (pure, testable independent of git calls)
// ---------------------------------------------------------------------------

/**
 * Compute the next CalVer tag name given the existing tags and a date.
 * Bare tag names, no "v" prefix: "YYYY.MM" or "YYYY.MM.PATCH".
 *
 * @param {string[]} existingTags - list of existing git tag names
 * @param {Date} date - date to base the version on (local time)
 * @returns {string} the computed version/tag name
 */
export function computeVersion(existingTags, date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const base = `${year}.${month}`;

  const tagSet = new Set(existingTags);

  if (!tagSet.has(base)) {
    return base;
  }

  let patch = 1;
  while (tagSet.has(`${base}.${patch}`)) {
    patch += 1;
  }
  return `${base}.${patch}`;
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { yes: false, notesFile: null, printVersion: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--yes') {
      args.yes = true;
    } else if (arg === '--notes-file') {
      args.notesFile = argv[i + 1];
      i += 1;
    } else if (arg === '--print-version') {
      args.printVersion = true;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

function checkWorkingTreeClean() {
  log('Checking working tree...');
  const status = run('git status --porcelain');
  if (status.trim().length > 0) {
    fail(
      `Working tree is not clean. Commit or stash changes before releasing:\n${status}`
    );
  }
}

function checkBranchUpToDate() {
  log('Checking branch...');
  const branch = run('git rev-parse --abbrev-ref HEAD').trim();
  if (branch !== 'main') {
    fail(`Not on main (currently on ${branch}).`);
  }

  log('Fetching origin/main...');
  try {
    run('git fetch origin main');
  } catch (err) {
    fail(`git fetch origin main failed: ${err.message}`);
  }

  const localSha = run('git rev-parse HEAD').trim();
  const remoteSha = run('git rev-parse origin/main').trim();
  if (localSha !== remoteSha) {
    fail(
      `Local main is not up to date with origin/main (ahead/behind) — pull or push first.\n` +
        `  local:  ${localSha}\n  origin: ${remoteSha}`
    );
  }
}

function checkBuild() {
  log('Building (npm run build)...');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (result.error) {
    fail(`Failed to run "npm run build": ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`"npm run build" exited with code ${result.status}.`);
  }
}

// ---------------------------------------------------------------------------
// Version + notes
// ---------------------------------------------------------------------------

function getExistingTags() {
  const out = run('git tag -l');
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getLastTag(existingTags) {
  if (existingTags.length === 0) return null;
  // Most recent tag by creation date.
  try {
    const out = run(
      'git for-each-ref --sort=-creatordate --format="%(refname:short)" refs/tags'
    );
    const tags = out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return tags[0] ?? null;
  } catch {
    // Fallback: describe.
    try {
      return run('git describe --tags --abbrev=0').trim();
    } catch {
      return null;
    }
  }
}

function computeNotes(lastTag) {
  if (lastTag) {
    return run(`git log ${lastTag}..HEAD --pretty=format:"- %s"`);
  }
  return run('git log --pretty=format:"- %s"');
}

// ---------------------------------------------------------------------------
// Cut
// ---------------------------------------------------------------------------

function cutRelease(version, notes, notesFilePath) {
  log(`Tagging ${version}...`);
  let result = runSpawn('git', ['tag', '-a', version, '-m', `Release ${version}`]);
  if (result.status !== 0) {
    fail(`git tag failed with code ${result.status}.`);
  }

  log(`Pushing tag ${version} to origin...`);
  result = runSpawn('git', ['push', 'origin', version]);
  if (result.status !== 0) {
    fail(`git push origin ${version} failed with code ${result.status}.`);
  }

  log(`Creating GitHub release ${version}...`);
  let tempNotesFile = null;
  let notesFileToUse = notesFilePath;
  if (!notesFileToUse) {
    // Notes were generated from git log — write to a temp file to avoid
    // shell-escaping issues with multi-line strings.
    tempNotesFile = path.join(os.tmpdir(), `flyer-editor-release-notes-${version}.txt`);
    writeFileSync(tempNotesFile, notes, 'utf8');
    notesFileToUse = tempNotesFile;
  }

  try {
    result = runSpawn('gh', [
      'release',
      'create',
      version,
      '--title',
      version,
      '--notes-file',
      notesFileToUse,
    ]);
    if (result.status !== 0) {
      fail(`gh release create failed with code ${result.status}.`);
    }
  } finally {
    if (tempNotesFile && existsSync(tempNotesFile)) {
      unlinkSync(tempNotesFile);
    }
  }

  console.log(`\nRelease ${version} cut successfully.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.printVersion) {
    const existingTags = getExistingTags();
    const version = computeVersion(existingTags, new Date());
    console.log(version);
    return;
  }

  checkWorkingTreeClean();
  checkBranchUpToDate();
  checkBuild();

  log('Computing version...');
  const existingTags = getExistingTags();
  const version = computeVersion(existingTags, new Date());

  let notes;
  if (args.notesFile) {
    if (!existsSync(args.notesFile)) {
      fail(`--notes-file path does not exist: ${args.notesFile}`);
    }
    notes = readFileSync(args.notesFile, 'utf8');
  } else {
    const lastTag = getLastTag(existingTags);
    notes = computeNotes(lastTag);
  }

  console.log(`\nRelease notes for ${version}:\n`);
  console.log(notes.trim().length > 0 ? notes : '(no commits since last tag)');
  console.log('');

  if (!args.yes) {
    console.log('Dry run only — pass --yes to actually cut this release.');
    process.exit(0);
  }

  cutRelease(version, notes, args.notesFile);
}

// Only run when executed directly (e.g. `node scripts/release.mjs`), not when
// imported (e.g. for testing `computeVersion` in isolation).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
