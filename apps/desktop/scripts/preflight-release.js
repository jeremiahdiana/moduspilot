// Fails the release BEFORE an 8-minute build if the credentials it needs are
// missing from the environment.
//
// This exists because of a real, silent failure (2026-07-22): `npm run release`
// ran to completion with none of these set. electron-builder does not treat a
// missing credential as an error — it just SKIPS. The result looked like a
// successful release but was a signed-but-UNNOTARIZED build that was never
// published: no latest-mac.yml, no GitHub release, and artifacts that macOS
// Gatekeeper blocks on any machine other than the one that built them
// ("Apple cannot check it for malicious software"). Shipping that is worse
// than shipping nothing, and nothing in the output says so.
//
// APPLE_TEAM_ID is the team on the Developer ID cert (`security find-identity
// -v -p codesigning`). GH_TOKEN can come straight from the gh CLI:
//   export GH_TOKEN=$(gh auth token)

const REQUIRED = [
  ['APPLE_ID', 'Apple Developer account email — notarization'],
  ['APPLE_APP_SPECIFIC_PASSWORD', 'app-specific password from appleid.apple.com — notarization'],
  ['APPLE_TEAM_ID', 'Developer ID team (8KF5J7X9BU) — notarization'],
  ['GH_TOKEN', 'GitHub token for publishing the release — `export GH_TOKEN=$(gh auth token)`'],
];

const missing = REQUIRED.filter(([name]) => !process.env[name]);

if (missing.length > 0) {
  console.error('\n  Release aborted — missing credentials:\n');
  for (const [name, why] of missing) console.error(`    ${name}\n      ${why}`);
  console.error(
    '\n  Without these the build silently skips notarization and/or publishing,\n' +
      '  producing artifacts that Gatekeeper blocks. Export them and re-run.\n'
  );
  process.exit(1);
}

console.log('[preflight] notarization + publish credentials present');
