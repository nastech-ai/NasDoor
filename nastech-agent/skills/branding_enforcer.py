"""
NasTech branding enforcement rules.

Consumed by scripts/branding_lint.py via AST — do NOT add any import statements
or runtime logic.  Only the five constants below are read.

  REPLACEMENTS      — ordered (old, new) text replacement pairs for --fix mode
  SKIP_FILE_NAMES   — basenames that the scanner must never flag or auto-fix
  SKIP_DIR_NAMES    — directory names (any depth) that are fully excluded
  SCAN_EXTENSIONS   — file extensions that the scanner covers
  NPM_PKG_PATTERNS  — upstream npm package prefixes that are stale (legacy check)
"""

REPLACEMENTS: list = [
    # Repo / org paths (most-specific first)
    ("NousResearch/hermes-agent", "nastech-ai/NasTech-Agent"),
    ("NousResearch/Hermes-Agent", "nastech-ai/NasTech-Agent"),
    ("nous-research/hermes-agent", "nastech-ai/nastech-agent"),
    # Hostnames
    ("hermes-agent.nousresearch.com", "nastech-agent.nastechai.com"),
    ("nousresearch.com", "nastechai.com"),
    # Org identifiers
    ("nous-research", "nastech-ai"),
    ("NousResearch", "NasTech"),
    ("Nous Research", "NasTech"),
    ("nous_research", "nastech_ai"),
    # npm scopes
    ("@nous-research/ui", "@nastechai/ui"),
    ("@nous-research/", "@nastechai/"),
    # Package / module identifiers
    ("hermes-agent", "nastech-agent"),
    ("hermes_agent", "nastech_agent"),
    ("HermesAgent", "NasTechAgent"),
    ("hermes_cli", "nastech_cli"),
    ("hermes_state", "nastech_state"),
    ("hermes_constants", "nastech_constants"),
    ("hermes_bootstrap", "nastech_bootstrap"),
    ("hermes_logging", "nastech_logging"),
    ("hermes_time", "nastech_time"),
    ("hermes-ink", "nastech-ink"),
    ("hermes_ink", "nastech_ink"),
    ("HermesInk", "NasTechInk"),
    # Env-var / case variants
    ("HERMES_HOME", "NASTECH_HOME"),
    ("HERMES_", "NASTECH_"),
    ("_HERMES", "_NASTECH"),
    ("Hermes", "NasTech"),
    ("HERMES", "NASTECH"),
    ("hermes", "nastech"),
]

SKIP_FILE_NAMES: frozenset = frozenset({
    # Lock files — environment-specific, never edited manually
    "pnpm-lock.yaml",
    "package-lock.json",
    "package-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    # Deprecated shims / stubs that are intentionally frozen
    "nastech-exec-shim.sh",
    "nastech-smoke-test",
    # Audit + publishing tools that MUST reference upstream names as
    # data/patterns
    "nastech_audit.py",        # compares against upstream — holds both brand names as data
    "npm-publish-ui.yml",      # transforms upstream repo URL string in package.json
    "npm-publish-ink.yml",     # transforms upstream repo URL string in package.json
    "npm-publish-agent.yml",   # same pattern
    # Documentation that intentionally lists forbidden strings as a reference
    # table
    "AGENTS.md",               # mandatory agent rules — contains "never write X" examples
    # release history — names deleted/replaced files by their old names
    "CHANGELOG.md",
})

SKIP_DIR_NAMES: frozenset = frozenset({
    ".git",
    "node_modules",
    "__pycache__",
    "web_dist",
    "tui_dist",
    ".local",
    ".agents",
    ".pythonlibs",
    ".venv",
    "dist",
    "build",
})

SCAN_EXTENSIONS: frozenset = frozenset({
    ".py", ".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs",
    ".sh", ".ps1",
    ".md", ".toml", ".yaml", ".yml", ".json",
    ".cfg", ".ini", ".env", ".txt",
})

NPM_PKG_PATTERNS: tuple = ()
