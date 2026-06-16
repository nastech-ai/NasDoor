// dangerfile.js — based on danger/danger-js
// https://github.com/danger/danger-js

const { danger, warn, fail, message } = require("danger")

// Require CHANGELOG entry for non-trivial PRs
const hasChangelog = danger.git.modified_files.includes("CHANGELOG.md")
const isTrivial =
  danger.github &&
  (danger.github.pr.body + danger.github.pr.title).includes("#trivial")

if (!hasChangelog && !isTrivial) {
  warn(
    "Please add a `CHANGELOG.md` entry for your changes. " +
      "Mark as `#trivial` in the PR title/body to skip this check."
  )
}

// Warn if PR is too large
const bigPRThreshold = 600
const totalChanges =
  danger.github.pr.additions + danger.github.pr.deletions
if (totalChanges > bigPRThreshold) {
  warn(
    `This PR has ${totalChanges} total changes — consider splitting it into smaller PRs for easier review.`
  )
}

// Warn if no description
if (danger.github.pr.body.length < 10) {
  warn("Please provide a meaningful PR description.")
}

// Fail if package.json changed but lockfile was not
const packageChanged = danger.git.modified_files.some((f) =>
  f.includes("package.json")
)
const lockfileChanged = danger.git.modified_files.some((f) =>
  f.includes("pnpm-lock.yaml")
)
if (packageChanged && !lockfileChanged) {
  warn(
    "A `package.json` was changed but `pnpm-lock.yaml` was not updated — " +
      "run `pnpm install` and commit the lockfile."
  )
}

// Warn if Android-only files touch iOS-specific paths
const termuxChanged = danger.git.modified_files.some((f) =>
  f.includes("plugins/withTermuxDaemon")
)
const iosChanged = danger.git.modified_files.some((f) =>
  f.includes("sources/(app)/server.tsx")
)
if (termuxChanged && !iosChanged) {
  message(
    "Termux plugin changed — verify the iOS `server.tsx` connect screen still works correctly."
  )
}

// Warn if Python agent changed but no agent test mentioned
const agentChanged = danger.git.modified_files.some((f) =>
  f.startsWith("nastech-agent/")
)
if (agentChanged) {
  message(
    "NasTech Agent (Python) files changed — make sure the daemon starts cleanly on port 9119."
  )
}
