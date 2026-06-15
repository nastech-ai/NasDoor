#!/bin/bash
# ============================================================================
# NasTech-Agent Setup Script (Unified Installer)
# ============================================================================
# Auto-detects platform (desktop/server vs Android/Termux) and installs accordingly.
# Uses uv for modern package management on desktop/server.
# Uses pip on Termux where uv is unavailable.
#
# Usage:
#   ./install.sh
#   bash <(curl -fsSL https://raw.githubusercontent.com/nastech-ai/NasTech-Agent/main/install.sh)
#
# This script:
# 1. Auto-detects desktop/server vs Android/Termux setup path
# 2. Creates a Python 3.11 virtual environment
# 3. Installs dependencies using uv (desktop/server) or pip (Termux)
# 4. Creates .env from template (if not exists)
# 5. Symlinks the 'nastech' CLI command into PATH
# 6. Runs setup wizard (optional)
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
if [ -z "$SCRIPT_DIR" ]; then
  # Fallback if BASH_SOURCE not available (some shells)
  SCRIPT_DIR="$(pwd)"
fi
cd "$SCRIPT_DIR"

# Prevent uv from discovering config files from wrong user's home directory
export UV_NO_CONFIG=1

PYTHON_VERSION="3.11"
REPO_URL="https://github.com/nastech-ai/NasTech-Agent"

# ============================================================================
# Helper Functions
# ============================================================================

is_termux() {
    [ -n "${TERMUX_VERSION:-}" ] || [[ "${PREFIX:-}" == *"com.termux/files/usr"* ]]
}

get_command_link_dir() {
    if is_termux && [ -n "${PREFIX:-}" ]; then
        echo "$PREFIX/bin"
    else
        echo "$HOME/.local/bin"
    fi
}

get_command_link_display_dir() {
    if is_termux && [ -n "${PREFIX:-}" ]; then
        echo '$PREFIX/bin'
    else
        echo '~/.local/bin'
    fi
}

# ============================================================================
# Main Installation
# ============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  🤖 NasTech-Agent Setup${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Detect platform
if is_termux; then
    echo -e "${CYAN}→${NC} Platform: ${YELLOW}Android/Termux detected${NC}"
    INSTALL_MODE="termux"
else
    echo -e "${CYAN}→${NC} Platform: ${YELLOW}Desktop/Server${NC}"
    INSTALL_MODE="desktop"
fi
echo ""

# ============================================================================
# Install / locate uv (desktop/server only)
# ============================================================================

if [ "$INSTALL_MODE" = "desktop" ]; then
    echo -e "${CYAN}→${NC} Checking for uv (modern Python package manager)..."
    
    UV_CMD=""
    if command -v uv &> /dev/null; then
        UV_CMD="uv"
    elif [ -x "$HOME/.local/bin/uv" ]; then
        UV_CMD="$HOME/.local/bin/uv"
    elif [ -x "$HOME/.cargo/bin/uv" ]; then
        UV_CMD="$HOME/.cargo/bin/uv"
    fi

    if [ -n "$UV_CMD" ]; then
        UV_VERSION=$($UV_CMD --version 2>/dev/null)
        echo -e "${GREEN}✓${NC} uv found ($UV_VERSION)"
    else
        echo -e "${CYAN}→${NC} Installing uv..."
        _uv_log="$(mktemp 2>/dev/null || echo "/tmp/nastech-uv-install.$$.log")"
        _uv_installer="$(mktemp 2>/dev/null || echo "/tmp/nastech-uv-installer.$$.sh")"
        
        if ! curl -LsSf https://astral.sh/uv/install.sh -o "$_uv_installer" 2>"$_uv_log"; then
            echo -e "${RED}✗${NC} Failed to download uv installer"
            sed 's/^/    /' "$_uv_log" >&2
            echo -e "${CYAN}→${NC} Falling back to pip..."
            UV_CMD=""
            rm -f "$_uv_log" "$_uv_installer"
        elif sh "$_uv_installer" >>"$_uv_log" 2>&1; then
            rm -f "$_uv_installer"
            if [ -x "$HOME/.local/bin/uv" ]; then
                UV_CMD="$HOME/.local/bin/uv"
            elif [ -x "$HOME/.cargo/bin/uv" ]; then
                UV_CMD="$HOME/.cargo/bin/uv"
            fi
            
            if [ -n "$UV_CMD" ]; then
                rm -f "$_uv_log"
                UV_VERSION=$($UV_CMD --version 2>/dev/null)
                echo -e "${GREEN}✓${NC} uv installed ($UV_VERSION)"
            else
                echo -e "${YELLOW}⚠${NC}  uv installation may have succeeded but binary not found"
                echo -e "${CYAN}→${NC} Using pip as fallback"
                rm -f "$_uv_log"
            fi
        else
            echo -e "${YELLOW}⚠${NC}  uv installation failed, using pip instead"
            rm -f "$_uv_log" "$_uv_installer"
        fi
    fi
fi

# ============================================================================
# Python check
# ============================================================================

echo -e "${CYAN}→${NC} Checking Python $PYTHON_VERSION..."

if is_termux; then
    if command -v python >/dev/null 2>&1; then
        PYTHON_PATH="$(command -v python)"
        if "$PYTHON_PATH" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
            PYTHON_FOUND_VERSION=$($PYTHON_PATH --version 2>/dev/null)
            echo -e "${GREEN}✓${NC} $PYTHON_FOUND_VERSION found"
        else
            echo -e "${RED}✗${NC} Termux Python must be 3.11+"
            echo -e "    Run: ${CYAN}pkg install python${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗${NC} Python not found"
        echo -e "    Run: ${CYAN}pkg install python${NC}"
        exit 1
    fi
else
    # Desktop/server: check Python availability
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_PATH="$(command -v python3)"
    elif command -v python >/dev/null 2>&1; then
        PYTHON_PATH="$(command -v python)"
    else
        echo -e "${RED}✗${NC} Python 3 not found"
        echo -e "    Install Python 3.11+ from python.org or your package manager"
        exit 1
    fi
    
    echo -e "${GREEN}✓${NC} Python found: $($PYTHON_PATH --version)"
fi

# ============================================================================
# Create venv
# ============================================================================

VENV_DIR="$HOME/.nastech/NasTech-Agent/venv"
INSTALL_DIR="$(dirname "$VENV_DIR")"

echo ""
echo -e "${CYAN}→${NC} Setting up virtual environment in ${YELLOW}$INSTALL_DIR${NC}..."
mkdir -p "$INSTALL_DIR"

if [ ! -d "$VENV_DIR" ]; then
    $PYTHON_PATH -m venv "$VENV_DIR"
    echo -e "${GREEN}✓${NC} venv created"
else
    echo -e "${GREEN}✓${NC} venv already exists"
fi

# Activate venv
source "$VENV_DIR/bin/activate"
python -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || true

# ============================================================================
# Install NasTech-Agent
# ============================================================================

echo ""
echo -e "${CYAN}→${NC} Installing NasTech-Agent package..."

if [ "$INSTALL_MODE" = "desktop" ] && [ -n "$UV_CMD" ]; then
    # Desktop/server with uv: use modern sync
    echo -e "    (using uv for fast, deterministic installs)"
    $UV_CMD sync 2>&1 | tail -5
else
    # Termux or pip fallback
    echo -e "    (using pip)"
    if is_termux; then
        # Termux: set Android API level (needed by Rust/maturin packages like jiter)
        export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk 2>/dev/null || printf '%s' "${ANDROID_API_LEVEL:-}")"
        echo -e "${CYAN}→${NC} Termux detected — installing tested Android bundle"
        # Upgrade build tools first so maturin/Rust packages compile cleanly
        pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || true
        # Download constraints so Termux-incompatible wheels are pinned safely
        _CONSTRAINTS_TMP="$(mktemp /tmp/nastech-constraints-XXXXXX.txt 2>/dev/null || echo "/tmp/nastech-constraints-$$.txt")"
        if curl -fsSL "https://raw.githubusercontent.com/nastech-ai/NasTech-Agent/main/constraints-termux.txt" \
                -o "$_CONSTRAINTS_TMP" 2>/dev/null; then
            # Try the full termux bundle first, fall back to bare install
            pip install 'nastech-agent[termux]' -c "$_CONSTRAINTS_TMP" || {
                echo -e "${YELLOW}⚠${NC} Termux bundle install failed, falling back to base..."
                pip install nastech-agent -c "$_CONSTRAINTS_TMP"
            }
            rm -f "$_CONSTRAINTS_TMP"
        else
            rm -f "$_CONSTRAINTS_TMP"
            pip install 'nastech-agent[termux]' || pip install nastech-agent
        fi
    else
        pip install nastech-agent >/dev/null 2>&1 || pip install --no-cache-dir nastech-agent
    fi
fi

echo -e "${GREEN}✓${NC} NasTech-Agent installed"

# ============================================================================
# Create .env from template
# ============================================================================

ENV_FILE="$INSTALL_DIR/.env"
ENV_EXAMPLE="$INSTALL_DIR/.env.example"

echo ""
echo -e "${CYAN}→${NC} Configuring environment..."

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo -e "${GREEN}✓${NC} .env created from template"
    else
        cat > "$ENV_FILE" << 'ENVEOF'
# NasTech-Agent Configuration
# Add your API keys here

# OpenAI (for Claude/GPT models)
# OPENAI_API_KEY=sk-...

# Anthropic (for Claude models)
# ANTHROPIC_API_KEY=sk-ant-...

# Google (for Gemini)
# GOOGLE_API_KEY=...

# For more providers, see: https://github.com/nastech-ai/NasTech-Agent/wiki/Providers
ENVEOF
        echo -e "${GREEN}✓${NC} .env created (empty)"
    fi
else
    echo -e "${GREEN}✓${NC} .env already exists"
fi

# ============================================================================
# CLI symlink
# ============================================================================

echo ""
echo -e "${CYAN}→${NC} Setting up CLI command..."

BIN_DIR="$(get_command_link_dir)"
BIN_DISPLAY="$(get_command_link_display_dir)"

mkdir -p "$BIN_DIR"

# Create wrapper script
NASTECH_BIN="$BIN_DIR/nastech"
cat > "$NASTECH_BIN" << 'BINEOF'
#!/bin/bash
# NasTech-Agent CLI wrapper
VENV_DIR="$HOME/.nastech/NasTech-Agent/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "Error: NasTech-Agent not properly installed"
    exit 1
fi
exec "$VENV_DIR/bin/nastech" "$@"
BINEOF

chmod +x "$NASTECH_BIN"

# Add to PATH if necessary
if ! echo "$PATH" | grep -q "$BIN_DIR"; then
    echo ""
    echo -e "${YELLOW}⚠${NC}  $BIN_DISPLAY is not in your PATH"
    echo -e "    ${CYAN}Add this to your shell profile (${NC}~/.bashrc${CYAN}):${NC}"
    echo -e "    ${CYAN}export PATH=\"\$PATH:$BIN_DISPLAY\"${NC}"
fi

echo -e "${GREEN}✓${NC} CLI command installed: ${YELLOW}nastech${NC}"

# ============================================================================
# Setup wizard (interactive)
# ============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓${NC} NasTech-Agent installation complete!"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. ${CYAN}Edit your .env file:${NC}"
echo -e "     ${YELLOW}nano $ENV_FILE${NC}"
echo -e "  2. ${CYAN}Run the setup wizard:${NC}"
echo -e "     ${YELLOW}nastech setup${NC}"
echo -e "  3. ${CYAN}Start chatting:${NC}"
echo -e "     ${YELLOW}nastech chat${NC}"
echo -e "  4. ${CYAN}Or open the web dashboard:${NC}"
echo -e "     ${YELLOW}nastech dashboard${NC}"
echo ""
echo -e "For help:"
echo -e "  ${YELLOW}nastech --help${NC}"
echo ""

# Optional: Run setup wizard
# Use /dev/tty so this works when piped (curl | bash) — reading from stdin
# in that case gets EOF immediately and silently skips setup.
_REPLY=""
if [ -t 0 ]; then
    read -r -p "Would you like to run the setup wizard now? (y/n) " -n 1 _REPLY
    echo ""
elif (: </dev/tty) 2>/dev/null; then
    printf "Would you like to run the setup wizard now? (y/n) " >/dev/tty
    IFS= read -r -n 1 _REPLY </dev/tty
    echo ""
fi
if [[ "$_REPLY" =~ ^[Yy]$ ]]; then
    nastech setup
fi
