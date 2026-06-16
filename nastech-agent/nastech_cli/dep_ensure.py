"""Lazy dependency bootstrapper for non-Python runtime deps.

Detection and prompting live here in Python — not in install.sh — because:
  1. shutil.which() works on every platform; install.sh needs bash.
  2. Detection is instant; spawning bash for a "is node installed?" check is waste.
  3. Python controls the UX (rich prompts, non-interactive fallback, TTY detection).

install.sh is still the *installation* backend because it has 1900 lines of
battle-tested OS detection and package-manager logic (apt/brew/pacman/dnf/
zypper/Termux/…).  Reimplementing that in Python would be huge duplication.

Deps that degrade gracefully (ripgrep → grep fallback, ffmpeg → skip conversion)
don't need ensure_dependency wired in — only hard-fail sites do (TUI needs node,
browser tool needs agent-browser).

Auto-detection and never-fail install logic lives in platform_detect.py.  This
module is the public API that the rest of the codebase calls.
"""
from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

from nastech_cli.platform_detect import (
    bootstrap_all_deps,
    ensure_node,
    get_platform,
    install_system_dep,
)

_IS_WINDOWS = platform.system() == "Windows"

_DEP_CHECKS = {
    "node": lambda: shutil.which("node") is not None,
    "browser": lambda: (
        shutil.which("agent-browser") is not None
        or _has_system_browser()
        or _has_nastech_agent_browser()
    ),
    "ripgrep": lambda: shutil.which("rg") is not None,
    "ffmpeg": lambda: shutil.which("ffmpeg") is not None,
}

_DEP_DESCRIPTIONS = {
    "node": "Node.js (required for browser tools and TUI)",
    "browser": "Browser engine (Chromium, for web browsing tools)",
    "ripgrep": "ripgrep (fast file search)",
    "ffmpeg": "ffmpeg (TTS voice messages)",
}


def _has_system_browser() -> bool:
    if _IS_WINDOWS:
        names = ("chrome", "msedge", "chromium")
    else:
        names = (
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
            "chrome")
    for name in names:
        if shutil.which(name):
            return True
    return False


def _has_nastech_agent_browser() -> bool:
    from nastech_constants import get_nastech_home
    home = get_nastech_home()
    if _IS_WINDOWS:
        return (home / "node" / "agent-browser.cmd").is_file()
    return (
        (home / "node" / "bin" / "agent-browser").is_file()
        or (home / "node_modules" / ".bin" / "agent-browser").is_file()
    )


def _find_install_script(
    package_dir: Path | None = None,
    repo_root: Path | None = None,
) -> tuple[Path | None, str | None]:
    """Locate the install script — bundled in wheel or in git checkout."""
    if package_dir is None:
        package_dir = Path(__file__).parent
    if repo_root is None:
        repo_root = package_dir.parent

    if _IS_WINDOWS:
        preferred = ("install.ps1", "powershell")
        fallback = ("install.sh", "bash")
    else:
        preferred = ("install.sh", "bash")
        fallback = ("install.ps1", "powershell")

    for script_name, shell in (preferred, fallback):
        bundled = package_dir / "scripts" / script_name
        if bundled.is_file():
            return bundled, shell
        repo = repo_root / "scripts" / script_name
        if repo.is_file():
            return repo, shell

    return None, None


def ensure_dependency(
    dep: str,
    interactive: bool = True,
) -> bool:
    """Ensure a non-Python dependency is available.

    Auto-installs using the best available package manager for the current
    platform (via platform_detect).  Falls back to the bundled install script
    if the platform-native route fails.  Returns True if the dep is available.
    """
    check = _DEP_CHECKS.get(dep)
    if check is None:
        return False
    if check():
        return True

    p = get_platform()

    # --- Auto-install path (platform_detect knows the right package manager) ---
    if dep == "node":
        ok = ensure_node(verbose=interactive)
        if ok and check():
            return True
    elif dep in ("ripgrep", "ffmpeg"):
        ok = install_system_dep(dep, verbose=interactive)
        if ok and check():
            return True

    # --- Fallback: bundled install script ---
    script, shell = _find_install_script()
    if script is None:
        if interactive:
            desc = _DEP_DESCRIPTIONS.get(dep, dep)
            print(f"  {desc} is not installed and no install script was found.")
            print(f"  Install {dep} manually and try again.")
        return check()

    if interactive and sys.stdin.isatty() and not _auto_install_allowed():
        desc = _DEP_DESCRIPTIONS.get(dep, dep)
        try:
            reply = input(
                f"{desc} is not installed. Install now? [Y/n] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            return False
        if reply not in ("", "y", "yes"):
            return False

    if shell == "powershell":
        from nastech_constants import get_nastech_home
        ps_bin = shutil.which("powershell") or shutil.which("pwsh")
        if not ps_bin:
            if interactive:
                print(
                    "  PowerShell not found. Install PowerShell or run install.ps1 manually.")
            return check()
        cmd = [
            ps_bin,
            "-ExecutionPolicy", "Bypass",
            "-File", str(script),
            "-Ensure", dep,
            "-NasTechHome", str(get_nastech_home()),
        ]
    else:
        cmd = ["bash", str(script), "--ensure", dep]

    run_env = {**os.environ, "IS_INTERACTIVE": "false"}
    try:
        subprocess.run(cmd, env=run_env, check=False, timeout=300)
    except Exception:
        pass

    return check()


def _auto_install_allowed() -> bool:
    """True when we're running non-interactively or in a CI/headless context."""
    return (
        not sys.stdin.isatty()
        or os.environ.get("CI") == "true"
        or os.environ.get("NASTECH_AUTO_INSTALL") == "1"
        or get_platform().is_termux
    )


def ensure_all_deps(*, verbose: bool = True) -> dict[str, bool]:
    """Bootstrap every system dep NasTech might need.

    Detects the platform, installs anything missing, and returns a status dict.
    Safe to call at startup — never raises, never blocks indefinitely.
    """
    return bootstrap_all_deps(verbose=verbose, auto=True)
