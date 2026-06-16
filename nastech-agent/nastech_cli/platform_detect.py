"""Universal platform detection and never-fail dependency installer.

Detects the running environment (Linux distro, Termux/Android, macOS, Windows,
NixOS, WSL, …) and exposes the right package-manager commands and npm/pip
install strategies so that NasTech can install what it needs without ever
hard-stopping the user.

Design rules
------------
* Detection is pure Python — no subprocess just to find out what OS we're on.
* Every install path has at least two fallbacks.
* Nothing in this module raises an unhandled exception; all public helpers
  return bool / None and log what happened.
* Callers can always move on even if an install fails — that is the contract.
"""
from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

# ---------------------------------------------------------------------------
# Environment fingerprint
# ---------------------------------------------------------------------------

class PlatformInfo:
    """Snapshot of the current execution environment."""

    def __init__(self) -> None:
        # "Linux", "Darwin", "Windows", ""
        self.system: str = platform.system()
        self.machine: str = platform.machine()        # "x86_64", "aarch64", "arm64", …
        self.is_windows: bool = self.system == "Windows"
        self.is_macos: bool = self.system == "Darwin"
        self.is_linux: bool = self.system == "Linux"
        self.is_android: bool = sys.platform == "android"

        env = os.environ
        prefix = env.get("PREFIX", "")

        self.is_termux: bool = bool(
            env.get("TERMUX_VERSION")
            or "com.termux/files/usr" in prefix
            or prefix.startswith("/data/data/com.termux/")
        )
        self.is_nixos: bool = (
            self.is_linux and (
                Path("/etc/NIXOS").exists()
                or Path("/run/current-system/nixos-version").exists()
                or "nixos" in platform.version().lower()
            )
        )
        self.is_wsl: bool = (
            self.is_linux and (
                "microsoft" in platform.uname().release.lower()
                or "WSL" in env.get("PATH", "")
            )
        )
        self.is_container: bool = Path("/.dockerenv").exists() or bool(
            env.get("container") or env.get("KUBERNETES_SERVICE_HOST")
        )

        self.linux_distro: str = ""
        self.linux_distro_like: str = ""
        if self.is_linux and not self.is_termux:
            try:
                import distro  # type: ignore[import]
                self.linux_distro = distro.id()
                self.linux_distro_like = distro.like()
            except Exception:
                self._detect_distro_fallback()

    def _detect_distro_fallback(self) -> None:
        try:
            text = Path(
                "/etc/os-release").read_text(encoding="utf-8", errors="replace")
            for line in text.splitlines():
                if line.startswith("ID="):
                    self.linux_distro = line[3:].strip().strip('"').lower()
                if line.startswith("ID_LIKE="):
                    self.linux_distro_like = line[8:].strip().strip(
                        '"').lower()
        except OSError:
            pass

    @property
    def pkg_managers(self) -> List[str]:
        """Ordered list of system package managers available on this platform."""
        candidates: List[Tuple[str, str]] = []

        if self.is_termux:
            candidates = [("pkg", "pkg"), ("apt", "apt")]
        elif self.is_macos:
            candidates = [("brew", "brew"), ("port", "port")]
        elif self.is_windows:
            candidates = [
                ("choco", "choco"), ("winget", "winget"), ("scoop", "scoop")]
        elif self.is_nixos:
            candidates = [("nix-env", "nix-env"), ("nix", "nix")]
        else:
            candidates = [
                ("apt-get", "apt-get"), ("apt", "apt"),
                ("dnf", "dnf"), ("yum", "yum"),
                ("pacman", "pacman"),
                ("zypper", "zypper"),
                ("apk", "apk"),
                ("emerge", "emerge"),
            ]

        return [bin_name for _,
                bin_name in candidates if shutil.which(bin_name)]

    def __repr__(self) -> str:
        tags = []
        if self.is_termux:
            tags.append("termux")
        if self.is_nixos:
            tags.append("nixos")
        if self.is_wsl:
            tags.append("wsl")
        if self.is_android:
            tags.append("android")
        if self.is_macos:
            tags.append("macos")
        if self.is_windows:
            tags.append("windows")
        if self.linux_distro:
            tags.append(self.linux_distro)
        return f"PlatformInfo({', '.join(tags) or self.system})"


_INFO: Optional[PlatformInfo] = None


def get_platform() -> PlatformInfo:
    global _INFO
    if _INFO is None:
        _INFO = PlatformInfo()
    return _INFO


# ---------------------------------------------------------------------------
# System package installation — universal, never-fail
# ---------------------------------------------------------------------------

_PKG_INSTALL_CMDS: dict[str, List[str]] = {
    "apt-get": ["apt-get", "install", "-y", "--no-install-recommends"],
    "apt": ["apt", "install", "-y", "--no-install-recommends"],
    "dnf": ["dnf", "install", "-y"],
    "yum": ["yum", "install", "-y"],
    "pacman": ["pacman", "-S", "--noconfirm"],
    "zypper": ["zypper", "install", "-y"],
    "apk": ["apk", "add", "--no-cache"],
    "emerge": ["emerge", "-av"],
    "brew": ["brew", "install"],
    "port": ["port", "install"],
    "pkg": ["pkg", "install", "-y"],
    "choco": ["choco", "install", "-y"],
    "winget": ["winget", "install", "--silent", "--accept-package-agreements",
               "--accept-source-agreements", "-e", "--id"],
    "scoop": ["scoop", "install"],
    "nix-env": ["nix-env", "-iA", "nixpkgs."],
}

# Map generic dep names to per-package-manager package names
_PKG_NAMES: dict[str, dict[str, str]] = {
    "node": {
        "apt-get": "nodejs", "apt": "nodejs",
        "dnf": "nodejs", "yum": "nodejs",
        "pacman": "nodejs",
        "zypper": "nodejs",
        "apk": "nodejs",
        "brew": "node",
        "pkg": "nodejs",
        "choco": "nodejs",
        "winget": "OpenJS.NodeJS",
        "scoop": "nodejs",
        "nix-env": "nodejs",
    },
    "npm": {
        "apt-get": "npm", "apt": "npm",
        "dnf": "npm", "yum": "npm",
        "pacman": "npm",
        "zypper": "npm",
        "apk": "npm",
        "brew": "node",
        "pkg": "nodejs",
        "choco": "nodejs",
        "winget": "OpenJS.NodeJS",
        "scoop": "nodejs",
        "nix-env": "nodejs",
    },
    "git": {
        "apt-get": "git", "apt": "git",
        "dnf": "git", "yum": "git",
        "pacman": "git",
        "zypper": "git",
        "apk": "git",
        "brew": "git",
        "pkg": "git",
        "choco": "git",
        "winget": "Git.Git",
        "scoop": "git",
        "nix-env": "git",
    },
    "ripgrep": {
        "apt-get": "ripgrep", "apt": "ripgrep",
        "dnf": "ripgrep",
        "pacman": "ripgrep",
        "zypper": "ripgrep",
        "apk": "ripgrep",
        "brew": "ripgrep",
        "pkg": "ripgrep",
        "choco": "ripgrep",
        "winget": "BurntSushi.ripgrep.MSVC",
        "scoop": "ripgrep",
        "nix-env": "ripgrep",
    },
    "ffmpeg": {
        "apt-get": "ffmpeg", "apt": "ffmpeg",
        "dnf": "ffmpeg",
        "pacman": "ffmpeg",
        "zypper": "ffmpeg",
        "apk": "ffmpeg",
        "brew": "ffmpeg",
        "pkg": "ffmpeg",
        "choco": "ffmpeg",
        "winget": "Gyan.FFmpeg",
        "scoop": "ffmpeg",
        "nix-env": "ffmpeg",
    },
    "curl": {
        "apt-get": "curl", "apt": "curl",
        "dnf": "curl", "yum": "curl",
        "pacman": "curl",
        "zypper": "curl",
        "apk": "curl",
        "brew": "curl",
        "pkg": "curl",
        "choco": "curl",
        "winget": "cURL.cURL",
        "scoop": "curl",
        "nix-env": "curl",
    },
    "python": {
        "apt-get": "python3", "apt": "python3",
        "dnf": "python3", "yum": "python3",
        "pacman": "python",
        "zypper": "python3",
        "apk": "python3",
        "brew": "python",
        "pkg": "python",
        "choco": "python",
        "winget": "Python.Python.3",
        "scoop": "python",
        "nix-env": "python3",
    },
}


def _needs_sudo(pkg_manager: str) -> bool:
    p = get_platform()
    if p.is_windows or p.is_macos or p.is_termux:
        return False
    if pkg_manager in ("brew", "scoop", "nix-env"):
        return False
    return os.geteuid() != 0 if hasattr(os, "geteuid") else False


def install_system_dep(dep: str, *, verbose: bool = True) -> bool:
    """Install *dep* using the best available system package manager.

    Tries every available package manager in priority order. Returns True if
    the dep ends up available (even if we didn't install it), False only if
    all attempts failed.  Never raises.
    """
    p = get_platform()
    binary = _DEP_BINARIES.get(dep, dep)

    if shutil.which(binary):
        return True

    if p.is_termux and dep == "node":
        return _termux_install_node(verbose=verbose)

    tried: List[str] = []
    for mgr in p.pkg_managers:
        pkg = _PKG_NAMES.get(dep, {}).get(mgr, dep)
        base_cmd = _PKG_INSTALL_CMDS.get(mgr, [mgr, "install", "-y"])
        cmd = [*base_cmd, pkg]
        if _needs_sudo(mgr):
            sudo = shutil.which("sudo")
            if sudo:
                cmd = [sudo, *cmd]
            else:
                continue
        if verbose:
            print(f"  → Installing {dep} via {mgr}…")
        try:
            result = subprocess.run(
                cmd, check=False, capture_output=not verbose,
                text=True, timeout=300,
            )
            if result.returncode == 0 and shutil.which(binary):
                if verbose:
                    print(f"  ✓ {dep} installed via {mgr}")
                return True
        except Exception as exc:
            if verbose:
                print(f"  ⚠ {mgr} failed: {exc}")
        tried.append(mgr)

    if not tried:
        if verbose:
            print(f"  ⚠ No package manager found to install {dep}.")
        return bool(shutil.which(binary))

    if verbose:
        print(
            f"  ⚠ Could not install {dep} automatically (tried: {
                ', '.join(tried)}).")
    return bool(shutil.which(binary))


_DEP_BINARIES: dict[str, str] = {
    "node": "node",
    "npm": "npm",
    "git": "git",
    "ripgrep": "rg",
    "ffmpeg": "ffmpeg",
    "curl": "curl",
    "python": "python3",
}


def _termux_install_node(*, verbose: bool = True) -> bool:
    """Install Node.js on Termux — handles pkg update dance."""
    if shutil.which("node"):
        return True
    if verbose:
        print("  → Termux: installing Node.js (pkg install nodejs-lts)…")
    for attempt, cmd in enumerate([
        ["pkg", "install", "-y", "nodejs-lts"],
        ["pkg", "install", "-y", "nodejs"],
        ["apt-get", "install", "-y", "nodejs"],
    ]):
        if not shutil.which(cmd[0]):
            continue
        try:
            r = subprocess.run(
                cmd,
                check=False,
                capture_output=not verbose,
                timeout=300)
            if r.returncode == 0 and shutil.which("node"):
                if verbose:
                    print("  ✓ Node.js installed on Termux")
                return True
        except Exception as exc:
            if verbose:
                print(f"  ⚠ Attempt {attempt + 1} failed: {exc}")
    return bool(shutil.which("node"))


# ---------------------------------------------------------------------------
# npm install strategy — never-fail progressive fallbacks
# ---------------------------------------------------------------------------

class NpmStrategy:
    """Encapsulates an npm install strategy for a given directory."""

    def __init__(
        self,
        npm: str,
        cwd: Path,
        *,
        extra_args: Sequence[str] = (),
        env: Optional[dict] = None,
        timeout: int = 300,
    ) -> None:
        self.npm = npm
        self.cwd = cwd
        self.extra_args = list(extra_args)
        self.env = env
        self.timeout = timeout

    def _run(self, cmd: List[str],
             capture: bool = True) -> subprocess.CompletedProcess:
        try:
            return subprocess.run(
                cmd, cwd=self.cwd, env=self.env,
                capture_output=capture, text=True,
                encoding="utf-8", errors="replace",
                check=False, timeout=self.timeout,
            )
        except subprocess.TimeoutExpired:
            proc = subprocess.CompletedProcess(cmd, 1, "", "Timed out")
            return proc
        except Exception as exc:
            return subprocess.CompletedProcess(cmd, 1, "", str(exc))

    def run_ci(self) -> subprocess.CompletedProcess:
        return self._run([self.npm, "ci", *self.extra_args])

    def run_install(self) -> subprocess.CompletedProcess:
        return self._run([self.npm, "install", *self.extra_args])

    def run_install_ignore_scripts(self) -> subprocess.CompletedProcess:
        return self._run(
            [self.npm, "install", "--ignore-scripts", *self.extra_args])

    def run_install_no_optional(self) -> subprocess.CompletedProcess:
        return self._run([self.npm, "install", "--no-optional",
                         "--ignore-scripts", *self.extra_args])

    def run_install_legacy(self) -> subprocess.CompletedProcess:
        return self._run([self.npm, "install", "--legacy-peer-deps",
                         "--ignore-scripts", *self.extra_args])


def npm_install_with_fallbacks(
    npm: str,
    cwd: Path,
    *,
    extra_args: Sequence[str] = (),
    env: Optional[dict] = None,
    label: str = "",
    verbose: bool = True,
) -> bool:
    """Try every npm install strategy until one succeeds.

    Strategy order:
      1. npm ci  (strict, lockfile-preserving)
      2. npm install
      3. npm install --ignore-scripts  (skips postinstall hooks)
      4. npm install --no-optional --ignore-scripts
      5. npm install --legacy-peer-deps --ignore-scripts

    Returns True if any strategy succeeds (returncode == 0).
    Never raises.
    """
    strategy = NpmStrategy(npm, cwd, extra_args=extra_args, env=env)
    tag = f" [{label}]" if label else ""

    lockfile = cwd / "package-lock.json"
    attempts = []

    if lockfile.exists():
        attempts.append(("npm ci", strategy.run_ci))

    attempts += [
        ("npm install", strategy.run_install),
        ("npm install --ignore-scripts", strategy.run_install_ignore_scripts),
        ("npm install --no-optional --ignore-scripts",
         strategy.run_install_no_optional),
        ("npm install --legacy-peer-deps --ignore-scripts",
         strategy.run_install_legacy),
    ]

    for desc, fn in attempts:
        if verbose:
            print(f"  → {desc}{tag}…")
        result = fn()
        if result.returncode == 0:
            if verbose:
                print(f"  ✓ {desc}{tag} succeeded")
            return True
        err = (result.stderr or result.stdout or "").strip().splitlines()
        hint = err[-1] if err else ""
        if verbose and hint:
            print(f"    ⚠ {hint}")

    if verbose:
        print(f"  ✗ All npm install strategies failed{tag}")
    return False


def npm_install_web_with_fallbacks(
    npm: str,
    workspace_root: Path,
    web_dir: Path,
    *,
    env: Optional[dict] = None,
    verbose: bool = True,
) -> bool:
    """Install web dashboard deps using progressive fallbacks.

    Tries workspace-scoped install first, then falls back to installing
    directly inside web_dir (no workspace flag).  On Termux / constrained
    environments the direct path is tried first if workspace install fails.
    """
    p = get_platform()

    # Strategy A: workspace-scoped from root (preferred — avoids pulling
    # in electron / desktop deps)
    if workspace_root != web_dir:
        workspace_rel = str(web_dir.relative_to(workspace_root))
        ws_args = ["--workspace", workspace_rel, "--silent"]
        ok = npm_install_with_fallbacks(
            npm, workspace_root,
            extra_args=ws_args, env=env,
            label="workspace:web", verbose=verbose,
        )
        if ok:
            return True
        if verbose:
            print("  ⚠ Workspace install failed — trying direct install in web/")

    # Strategy B: direct install inside web_dir (no workspace flag)
    ok = npm_install_with_fallbacks(
        npm, web_dir,
        extra_args=["--silent"], env=env,
        label="direct:web", verbose=verbose,
    )
    if ok:
        return True

    # Strategy C: direct install without --silent so we can see errors
    if verbose:
        print("  ⚠ Direct install failed — retrying without --silent for diagnostics")
    ok = npm_install_with_fallbacks(
        npm, web_dir, env=env,
        label="direct:web:verbose", verbose=verbose,
    )
    return ok


# ---------------------------------------------------------------------------
# Python / pip install — Termux and cross-platform
# ---------------------------------------------------------------------------

def get_pip_constraints_file() -> Optional[Path]:
    """Return the constraints file to use for pip installs on this platform."""
    p = get_platform()
    if not p.is_termux:
        return None
    here = Path(__file__).parent
    repo_root = here.parent
    for candidate in [
        repo_root / "constraints-termux.txt",
        here / "constraints-termux.txt",
    ]:
        if candidate.exists():
            return candidate
    return None


def pip_install_with_fallbacks(
    packages: List[str],
    *,
    pip_cmd: Optional[List[str]] = None,
    env: Optional[dict] = None,
    verbose: bool = True,
    constraints_file: Optional[Path] = None,
) -> bool:
    """Install Python packages with platform-aware fallbacks.

    Automatically applies constraints-termux.txt on Termux.
    Falls back from uv → pip → pip --no-build-isolation → pip --only-binary.
    Never raises.
    """
    p = get_platform()

    if pip_cmd is None:
        if shutil.which("uv"):
            pip_cmd = ["uv", "pip", "install"]
        else:
            pip_cmd = [sys.executable, "-m", "pip", "install"]

    cf = constraints_file or get_pip_constraints_file()
    base_args = [*pip_cmd, *packages]
    if cf:
        base_args += ["-c", str(cf)]

    strategies = [
        ("pip install", base_args),
        ("pip install --no-build-isolation",
         [*base_args, "--no-build-isolation"]),
        ("pip install --only-binary :all:",
         [*base_args, "--only-binary", ":all:"]),
        ("pip install --prefer-binary", [*base_args, "--prefer-binary"]),
    ]

    # On Termux/Android also try with --no-deps as last resort
    if p.is_termux or p.is_android:
        strategies.append((
            "pip install --no-deps (last resort)",
            [*base_args, "--no-deps", "--prefer-binary"],
        ))

    for desc, cmd in strategies:
        if verbose:
            print(
                f"  → {desc}: {' '.join(packages[:3])}{'…' if len(packages) > 3 else ''}")
        try:
            result = subprocess.run(
                cmd, check=False,
                capture_output=not verbose,
                text=True, encoding="utf-8", errors="replace",
                env=env, timeout=600,
            )
            if result.returncode == 0:
                if verbose:
                    print(f"  ✓ installed via {desc}")
                return True
            err = (result.stderr or "").strip().splitlines()
            hint = err[-1] if err else ""
            if verbose and hint:
                print(f"    ⚠ {hint}")
        except Exception as exc:
            if verbose:
                print(f"  ⚠ {desc} raised: {exc}")

    if verbose:
        print(f"  ✗ All pip install strategies failed for: {packages}")
    return False


# ---------------------------------------------------------------------------
# Full bootstrap — detect everything and install what's missing
# ---------------------------------------------------------------------------

_REQUIRED_SYSTEM_DEPS = ["node", "npm", "git", "curl"]
_OPTIONAL_SYSTEM_DEPS = ["ripgrep", "ffmpeg"]


def bootstrap_all_deps(*, verbose: bool = True,
                       auto: bool = True) -> dict[str, bool]:
    """Detect and install all system dependencies NasTech needs.

    Returns a dict of dep → available (bool).
    Never raises; missing optional deps are noted but don't block.

    If *auto* is True, silently installs missing deps without prompting.
    """
    p = get_platform()
    if verbose:
        print(f"  Platform: {p}")

    results: dict[str, bool] = {}

    for dep in _REQUIRED_SYSTEM_DEPS:
        binary = _DEP_BINARIES.get(dep, dep)
        if shutil.which(binary):
            results[dep] = True
            continue
        if verbose:
            print(f"  Missing required dep: {dep}")
        if auto:
            ok = install_system_dep(dep, verbose=verbose)
        else:
            ok = False
        results[dep] = ok
        if not ok and verbose:
            print(f"  ⚠ {dep} unavailable — some features may not work")

    for dep in _OPTIONAL_SYSTEM_DEPS:
        binary = _DEP_BINARIES.get(dep, dep)
        results[dep] = bool(shutil.which(binary))
        if not results[dep] and auto:
            results[dep] = install_system_dep(dep, verbose=verbose)

    return results


def ensure_node(*, verbose: bool = True) -> bool:
    """Make sure Node.js and npm are available; auto-install if missing."""
    node_ok = bool(shutil.which("node"))
    npm_ok = bool(shutil.which("npm"))

    if node_ok and npm_ok:
        return True

    p = get_platform()
    if verbose:
        missing = [
            d for d, ok in [
                ("node", node_ok), ("npm", npm_ok)] if not ok]
        print(f"  ⚠ Missing: {', '.join(missing)} — auto-installing…")

    # Termux: single pkg command installs both
    if p.is_termux:
        return _termux_install_node(verbose=verbose)

    # Generic path
    ok_node = install_system_dep("node", verbose=verbose)
    ok_npm = install_system_dep("npm", verbose=verbose)
    return ok_node and ok_npm
