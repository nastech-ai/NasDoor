"""Shared constants for NasTech Agent.

Import-safe module with no dependencies — can be imported from anywhere
without risk of circular imports.
"""

import os
import sys
import sysconfig
from contextvars import ContextVar, Token
from pathlib import Path


_profile_fallback_warned: bool = False
_UNSET = object()
_NASTECH_HOME_OVERRIDE: ContextVar[str | object] = ContextVar(
    "_NASTECH_HOME_OVERRIDE", default=_UNSET
)


def set_nastech_home_override(path: str | Path | None) -> Token:
    """Set a context-local NasTech home override and return its reset token.

    This is for in-process, per-task scoping.  It deliberately does not mutate
    ``os.environ`` because that is shared by every thread in the process.
    """
    value: str | object = _UNSET if path is None else str(path)
    return _NASTECH_HOME_OVERRIDE.set(value)


def reset_nastech_home_override(token: Token) -> None:
    """Restore the previous context-local NasTech home override."""
    _NASTECH_HOME_OVERRIDE.reset(token)


def get_nastech_home_override() -> str | None:
    """Return the active context-local NasTech home override, if any."""
    override = _NASTECH_HOME_OVERRIDE.get()
    if override is _UNSET or not override:
        return None
    return str(override)


def _get_platform_default_nastech_home() -> Path:
    """Return the platform-native default NasTech home path."""
    if sys.platform == "win32":
        local_appdata = os.environ.get("LOCALAPPDATA", "").strip()
        base = Path(local_appdata) if local_appdata else Path.home() / "AppData" / "Local"
        return base / "nastech"
    return Path.home() / ".nastech"


def get_nastech_home() -> Path:
    """Return the NasTech home directory (default: platform-native path).

    Reads NASTECH_HOME env var, falls back to the platform-native default.
    This is the single source of truth — all other copies should import this.

    When ``NASTECH_HOME`` is unset but an ``active_profile`` file indicates
    a non-default profile is active, logs a loud one-shot warning to
    ``errors.log`` so cross-profile data corruption is diagnosable instead
    of silent.  Behavior is unchanged otherwise — we still return
    the platform-native default — because raising here would brick 30+ module-level
    callers that import this at load time.  Subprocess spawners are
    expected to propagate ``NASTECH_HOME`` explicitly (see the systemd
    template in ``nastech_cli/gateway.py`` and the kanban dispatcher in
    ``nastech_cli/kanban_db.py``).  See https://github.com/NasTech/nastech-agent/issues/18594.
    """
    override = get_nastech_home_override()
    if override:
        return Path(override)

    val = os.environ.get("NASTECH_HOME", "").strip()
    if val:
        return Path(val)

    # Guard: if a non-default profile is sticky-active, warn once that
    # the fallback to the default profile is almost certainly wrong.
    global _profile_fallback_warned
    if not _profile_fallback_warned:
        try:
            fallback_home = _get_platform_default_nastech_home()
            active_path = fallback_home / "active_profile"
            active = active_path.read_text().strip() if active_path.exists() else ""
        except (UnicodeDecodeError, OSError):
            active = ""
        if active and active != "default":
            _profile_fallback_warned = True
            # Write directly to stderr.  We intentionally do NOT route this
            # through ``logging`` because (a) this function is called at
            # module-import time from 30+ sites, often before logging is
            # configured, and (b) root-logger propagation would double-emit
            # on consoles where a StreamHandler is already attached.
            msg = (
                f"[NASTECH_HOME fallback] NASTECH_HOME is unset but active "
                f"profile is {active!r}. Falling back to {fallback_home}, which "
                f"is the DEFAULT profile — not {active!r}. Any data this "
                f"process writes will land in the wrong profile. The "
                f"subprocess spawner should pass NASTECH_HOME explicitly "
                f"(see issue #18594)."
            )
            try:
                sys.stderr.write(msg + "\n")
                sys.stderr.flush()
            except Exception:
                pass

    return _get_platform_default_nastech_home()


def get_default_nastech_root() -> Path:
    """Return the root NasTech directory for profile-level operations.

    In standard deployments this is the platform-native NasTech home
    (``~/.nastech`` on POSIX, ``%LOCALAPPDATA%\\nastech`` on native Windows).

    In Docker or custom deployments where ``NASTECH_HOME`` points outside
    ``~/.nastech`` (e.g. ``/opt/data``), returns ``NASTECH_HOME`` directly
    — that IS the root.

    In profile mode where ``NASTECH_HOME`` is ``<root>/profiles/<name>``,
    returns ``<root>`` so that ``profile list`` can see all profiles.
    Works both for standard (``~/.nastech/profiles/coder``) and Docker
    (``/opt/data/profiles/coder``) layouts.

    Import-safe — no dependencies beyond stdlib.
    """
    native_home = _get_platform_default_nastech_home()
    env_home = os.environ.get("NASTECH_HOME", "")
    if not env_home:
        return native_home
    env_path = Path(env_home)
    try:
        env_path.resolve().relative_to(native_home.resolve())
        # NASTECH_HOME is under ~/.nastech (normal or profile mode)
        return native_home
    except ValueError:
        pass

    # Docker / custom deployment.
    # Check if this is a profile path: <root>/profiles/<name>
    # If the immediate parent dir is named "profiles", the root is
    # the grandparent — this covers Docker profiles correctly.
    if env_path.parent.name == "profiles":
        return env_path.parent.parent

    # Not a profile path — NASTECH_HOME itself is the root
    return env_path


def _get_packaged_data_dir(name: str) -> Path | None:
    """Return an installed data-files directory if one exists.

    Used to discover bundled skills/optional-skills when NasTech is installed
    from a wheel that emitted them via setuptools data_files.
    """
    candidates = []
    for scheme in ("data", "purelib", "platlib"):
        raw = sysconfig.get_path(scheme)
        if raw:
            candidates.append(Path(raw) / name)
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def get_optional_skills_dir(default: Path | None = None) -> Path:
    """Return the optional-skills directory, honoring package-manager wrappers.

    Packaged installs may ship ``optional-skills`` outside the Python package
    tree and expose it via ``NASTECH_OPTIONAL_SKILLS``.
    """
    override = os.getenv("NASTECH_OPTIONAL_SKILLS", "").strip()
    if override:
        return Path(override)
    packaged = _get_packaged_data_dir("optional-skills")
    if packaged is not None:
        return packaged
    if default is not None:
        return default
    return get_nastech_home() / "optional-skills"


def get_optional_mcps_dir(default: Path | None = None) -> Path:
    """Return the optional-mcps directory, honoring package-manager wrappers.

    Mirrors :func:`get_optional_skills_dir` for the MCP catalog (Nous-approved
    Model Context Protocol servers shipped with the repo but disabled by
    default). Packaged installs may ship ``optional-mcps`` outside the Python
    package tree and expose it via ``NASTECH_OPTIONAL_MCPS``.
    """
    override = os.getenv("NASTECH_OPTIONAL_MCPS", "").strip()
    if override:
        return Path(override)
    packaged = _get_packaged_data_dir("optional-mcps")
    if packaged is not None:
        return packaged
    if default is not None:
        return default
    return get_nastech_home() / "optional-mcps"


def get_bundled_skills_dir(default: Path | None = None) -> Path:
    """Return the bundled skills directory for source and packaged installs.

    Resolution order:
        1. ``NASTECH_BUNDLED_SKILLS`` env var (Nix wrapper / explicit override)
        2. Wheel-installed ``<sysconfig data>/skills`` (pip install path)
        3. Caller-supplied ``default`` (typically the source-checkout path)
        4. ``<NASTECH_HOME>/skills`` last-resort
    """
    override = os.getenv("NASTECH_BUNDLED_SKILLS", "").strip()
    if override:
        return Path(override)
    packaged = _get_packaged_data_dir("skills")
    if packaged is not None:
        return packaged
    if default is not None:
        return default
    return get_nastech_home() / "skills"


def get_nastech_dir(new_subpath: str, old_name: str) -> Path:
    """Resolve a NasTech subdirectory with backward compatibility.

    New installs get the consolidated layout (e.g. ``cache/images``).
    Existing installs that already have the old path (e.g. ``image_cache``)
    keep using it — no migration required.

    Args:
        new_subpath: Preferred path relative to NASTECH_HOME (e.g. ``"cache/images"``).
        old_name: Legacy path relative to NASTECH_HOME (e.g. ``"image_cache"``).

    Returns:
        Absolute ``Path`` — old location if it exists on disk, otherwise the new one.
    """
    home = get_nastech_home()
    old_path = home / old_name
    if old_path.exists():
        return old_path
    return home / new_subpath


def display_nastech_home() -> str:
    """Return a user-friendly display string for the current NASTECH_HOME.

    Uses ``~/`` shorthand for readability::

        default:  ``~/.nastech``
        profile:  ``~/.nastech/profiles/coder``
        custom:   ``/opt/nastech-custom``

    Use this in **user-facing** print/log messages instead of hardcoding
    ``~/.nastech``.  For code that needs a real ``Path``, use
    :func:`get_nastech_home` instead.
    """
    home = get_nastech_home()
    try:
        return "~/" + str(home.relative_to(Path.home()))
    except ValueError:
        return str(home)


def secure_parent_dir(path: Path) -> None:
    """Chmod ``0o700`` on the parent directory of *path*, but only if safe.

    Refuses to chmod ``/`` or any top-level directory (resolved parent with
    fewer than 3 parts, i.e. ``/`` or any direct child like ``/usr``) to
    prevent catastrophic host bricking when ``NASTECH_HOME`` or other path
    env vars resolve to an unexpected location.

    See https://github.com/NasTech/nastech-agent/issues/25821.
    """
    parent = path.parent.resolve()
    # Refuse root and its direct children (/usr, /home, /var, /tmp, …).
    if parent == Path("/") or len(parent.parts) < 3:
        return
    try:
        os.chmod(parent, 0o700)
    except OSError:
        pass


def get_subprocess_home() -> str | None:
    """Return a per-profile HOME directory for subprocesses, or None.

    When ``{NASTECH_HOME}/home/`` exists on disk, subprocesses should use it
    as ``HOME`` so system tools (git, ssh, gh, npm …) write their configs
    inside the NasTech data directory instead of the OS-level ``/root`` or
    ``~/``.  This provides:

    * **Docker persistence** — tool configs land inside the persistent volume.
    * **Profile isolation** — each profile gets its own git identity, SSH
      keys, gh tokens, etc.

    The Python process's own ``os.environ["HOME"]`` and ``Path.home()`` are
    **never** modified — only subprocess environments should inject this value.
    Activation is directory-based: if the ``home/`` subdirectory doesn't
    exist, returns ``None`` and behavior is unchanged.
    """
    nastech_home = get_nastech_home_override() or os.getenv("NASTECH_HOME")
    if not nastech_home:
        return None
    profile_home = os.path.join(nastech_home, "home")
    if os.path.isdir(profile_home):
        return profile_home
    return None


VALID_REASONING_EFFORTS = ("minimal", "low", "medium", "high", "xhigh")


def parse_reasoning_effort(effort: str) -> dict | None:
    """Parse a reasoning effort level into a config dict.

    Valid levels: "none", "minimal", "low", "medium", "high", "xhigh".
    Returns None when the input is empty or unrecognized (caller uses default).
    Returns {"enabled": False} for "none".
    Returns {"enabled": True, "effort": <level>} for valid effort levels.
    """
    if not effort or not effort.strip():
        return None
    effort = effort.strip().lower()
    if effort == "none":
        return {"enabled": False}
    if effort in VALID_REASONING_EFFORTS:
        return {"enabled": True, "effort": effort}
    return None


_termux_cache: bool | None = None
_termux_proot_cache: bool | None = None


def is_termux() -> bool:
    """Return True when running inside a **native** Termux (Android) environment.

    Checks three signals in priority order for sub-millisecond detection:
      1. ``TERMUX_VERSION`` env var — set by every Termux bootstrap since 0.49
      2. ``PREFIX`` path contains ``com.termux/files/usr``
      3. ``TERMUX_APP_PACKAGE_NAME`` env var — set when Termux:API is installed

    Result is module-level cached after the first call so repeated checks
    (e.g. in the agent loop) cost a single dict lookup.  Import-safe — no
    heavy deps, no subprocess.
    """
    global _termux_cache
    if _termux_cache is not None:
        return _termux_cache
    prefix = os.getenv("PREFIX", "")
    _termux_cache = bool(
        os.getenv("TERMUX_VERSION")
        or "com.termux/files/usr" in prefix
        or os.getenv("TERMUX_APP_PACKAGE_NAME", "").startswith("com.termux")
    )
    return _termux_cache


def is_termux_proot_distro() -> bool:
    """Return True when running inside a proot-distro Linux container under Termux.

    ``proot-distro`` lets Termux users install full Linux distros (Ubuntu,
    Debian, Arch, Fedora, …) and enter them via ``proot-distro login``.
    From *inside* the container, ``sys.platform`` is ``"linux"``,
    ``/etc/os-release`` reports the Linux distro, and ``TERMUX_VERSION`` is
    unset — so naive detection treats it as a regular Linux desktop and then
    fails trying to install system packages with ``apt``/``systemd``.

    This function catches that case so callers can:
      * Report the correct Linux distro name while flagging it as mobile Termux
      * Skip system-level ``apt``/``dpkg``/``systemd`` operations
      * Explain *why* Linux-native deps won't install (no root, no systemd)

    Detection signals (checked in order, fastest first):
      1. ``PROOT_LOADER`` / ``PROOT_TMP_DIR`` env vars — set by proot itself
      2. ``/data/data/com.termux`` directory visible via PRoot bind-mounts
      3. Android kernel strings in ``/proc/version`` (slow path, last resort)

    NOTE: returns ``False`` when :func:`is_termux` is already ``True`` (no
    need to distinguish native Termux from proot there).
    """
    global _termux_proot_cache
    if _termux_proot_cache is not None:
        return _termux_proot_cache

    if is_termux():
        _termux_proot_cache = False
        return False

    if os.getenv("PROOT_LOADER") or os.getenv("PROOT_TMP_DIR"):
        _termux_proot_cache = True
        return True

    if os.path.isdir("/data/data/com.termux"):
        _termux_proot_cache = True
        return True

    try:
        from pathlib import Path as _Path
        proc_ver = _Path("/proc/version").read_text(encoding="utf-8", errors="replace").lower()
        if any(hint in proc_ver for hint in ("android", "qualcomm", "exynos", "mediatek", "kirin")):
            _termux_proot_cache = True
            return True
    except OSError:
        pass

    _termux_proot_cache = False
    return False


def get_environment_type() -> str:
    """Return a short canonical string describing the current runtime environment.

    Returns one of:
      ``"termux"``        — native Termux on Android
      ``"termux-proot"``  — Linux distro container inside Termux (proot-distro)
      ``"wsl"``           — Windows Subsystem for Linux
      ``"linux"``         — native Linux desktop/server
      ``"macos"``         — macOS
      ``"windows"``       — Windows (native Python, not WSL)
      ``"unknown"``       — anything else

    Use this instead of scattered ``sys.platform`` checks when you need to
    distinguish mobile-Termux from a real Linux server — especially for
    install dependency logic.
    """
    import sys as _sys
    if is_termux():
        return "termux"
    if is_termux_proot_distro():
        return "termux-proot"
    if is_wsl():
        return "wsl"
    plat = _sys.platform
    if plat.startswith("linux"):
        return "linux"
    if plat == "darwin":
        return "macos"
    if plat in ("win32", "cygwin"):
        return "windows"
    return "unknown"


_wsl_detected: bool | None = None


def is_wsl() -> bool:
    """Return True when running inside WSL (Windows Subsystem for Linux).

    Checks ``/proc/version`` for the ``microsoft`` marker that both WSL1
    and WSL2 inject.  Result is cached for the process lifetime.
    Import-safe — no heavy deps.
    """
    global _wsl_detected
    if _wsl_detected is not None:
        return _wsl_detected
    try:
        with open("/proc/version", "r", encoding="utf-8") as f:
            _wsl_detected = "microsoft" in f.read().lower()
    except Exception:
        _wsl_detected = False
    return _wsl_detected


_container_detected: bool | None = None


def is_container() -> bool:
    """Return True when running inside a Docker/Podman container.

    Checks ``/.dockerenv`` (Docker), ``/run/.containerenv`` (Podman),
    and ``/proc/1/cgroup`` for container runtime markers.  Result is
    cached for the process lifetime.  Import-safe — no heavy deps.
    """
    global _container_detected
    if _container_detected is not None:
        return _container_detected
    if os.path.exists("/.dockerenv"):
        _container_detected = True
        return True
    if os.path.exists("/run/.containerenv"):
        _container_detected = True
        return True
    try:
        with open("/proc/1/cgroup", "r", encoding="utf-8") as f:
            cgroup = f.read()
            if "docker" in cgroup or "podman" in cgroup or "/lxc/" in cgroup:
                _container_detected = True
                return True
    except OSError:
        pass
    _container_detected = False
    return False


# ─── Well-Known Paths ─────────────────────────────────────────────────────────


def get_config_path() -> Path:
    """Return the path to ``config.yaml`` under NASTECH_HOME.

    Replaces the ``get_nastech_home() / "config.yaml"`` pattern repeated
    in 7+ files (skill_utils.py, nastech_logging.py, nastech_time.py, etc.).
    """
    return get_nastech_home() / "config.yaml"


def get_skills_dir() -> Path:
    """Return the path to the skills directory under NASTECH_HOME."""
    return get_nastech_home() / "skills"



def get_env_path() -> Path:
    """Return the path to the ``.env`` file under NASTECH_HOME."""
    return get_nastech_home() / ".env"


# ─── Network Preferences ─────────────────────────────────────────────────────


def apply_ipv4_preference(force: bool = False) -> None:
    """Monkey-patch ``socket.getaddrinfo`` to prefer IPv4 connections.

    On servers with broken or unreachable IPv6, Python tries AAAA records
    first and hangs for the full TCP timeout before falling back to IPv4.
    This affects httpx, requests, urllib, the OpenAI SDK — everything that
    uses ``socket.getaddrinfo``.

    When *force* is True, patches ``getaddrinfo`` so that calls with
    ``family=AF_UNSPEC`` (the default) resolve as ``AF_INET`` instead,
    skipping IPv6 entirely.  If no A record exists, falls back to the
    original unfiltered resolution so pure-IPv6 hosts still work.

    Safe to call multiple times — only patches once.
    Set ``network.force_ipv4: true`` in ``config.yaml`` to enable.
    """
    if not force:
        return

    import socket

    # Guard against double-patching
    if getattr(socket.getaddrinfo, "_nastech_ipv4_patched", False):
        return

    _original_getaddrinfo = socket.getaddrinfo

    def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if family == 0:  # AF_UNSPEC — caller didn't request a specific family
            try:
                return _original_getaddrinfo(
                    host, port, socket.AF_INET, type, proto, flags
                )
            except socket.gaierror:
                # No A record — fall back to full resolution (pure-IPv6 hosts)
                return _original_getaddrinfo(host, port, family, type, proto, flags)
        return _original_getaddrinfo(host, port, family, type, proto, flags)

    _ipv4_getaddrinfo._nastech_ipv4_patched = True  # type: ignore[attr-defined]
    socket.getaddrinfo = _ipv4_getaddrinfo  # type: ignore[assignment]


# ─── Streaming Response Constants ────────────────────────────────────────────

# Response ID for partial stream stubs used during error recovery
PARTIAL_STREAM_STUB_ID = "partial-stream-stub"

FINISH_REASON_LENGTH = "length"


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODELS_URL = f"{OPENROUTER_BASE_URL}/models"
