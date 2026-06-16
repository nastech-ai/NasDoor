"""
NasDoor Telegram Bot
====================
Features:
  - Reply keyboard with 8 action buttons
  - Live CI status from GitHub Actions
  - Error log fetching + display
  - Trigger auto-fix / OpenHands
  - Change GitHub secrets (LLM_API_KEY, EXPO_TOKEN, etc.) from Telegram
  - OpenRouter / OpenAI intelligent answers for any question
  - Background CI monitor that texts you on failures
"""

import asyncio
import base64
import json
import logging
import os
import re
import subprocess
import time
from datetime import datetime, timezone

import httpx
from nacl import encoding, public as nacl_public
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    Update,
)
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

# ── Config ────────────────────────────────────────────────────────────────────
BOT_TOKEN       = os.environ["TELEGRAM_BOT_TOKEN"]
CHAT_ID         = int(os.environ.get("TELEGRAM_CHAT_ID", "0"))
GH_TOKEN        = os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN", "")
GH_REPO         = os.environ.get("GH_REPO", "nastech-ai/NasDoor")
OPENAI_API_KEY  = os.environ.get("OPENAI_API_KEY", "")
OPENROUTER_KEY  = os.environ.get("OPENROUTER_API_KEY", os.environ.get("LLM_API_KEY", OPENAI_API_KEY))

GH_API  = "https://api.github.com"
GH_HDRS = {"Authorization": f"Bearer {GH_TOKEN}", "Accept": "application/vnd.github+json"}

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO,
)
log = logging.getLogger(__name__)

# ── Conversation states ───────────────────────────────────────────────────────
AWAITING_SECRET_NAME  = 1
AWAITING_SECRET_VALUE = 2

# ── Reply keyboard ────────────────────────────────────────────────────────────
MAIN_KB = ReplyKeyboardMarkup(
    [
        ["🔍 CI Status",      "❌ Errors"],
        ["🔧 Fix All",        "🚀 EAS Build"],
        ["🔑 Change API Key", "🤖 OpenHands"],
        ["📊 Issue Report",   "ℹ️ Help"],
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Pick an action or type a question…",
)

# ── GitHub helpers ─────────────────────────────────────────────────────────────
async def gh_get(path: str) -> dict | list:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{GH_API}{path}", headers=GH_HDRS)
        return r.json()

async def gh_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{GH_API}{path}", headers=GH_HDRS, json=body)
        return r.json()

async def gh_put(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.put(f"{GH_API}{path}", headers=GH_HDRS, json=body)
        return r.json()

async def gh_dispatch(workflow_file: str, inputs: dict | None = None) -> bool:
    body: dict = {"ref": "main"}
    if inputs:
        body["inputs"] = inputs
    r = await gh_post(f"/repos/{GH_REPO}/actions/workflows/{workflow_file}/dispatches", body)
    return not r.get("message")

# ── Encrypt a secret for GitHub ───────────────────────────────────────────────
async def push_github_secret(name: str, value: str) -> str:
    pk_data = await gh_get(f"/repos/{GH_REPO}/actions/secrets/public-key")
    pub_key_b64 = pk_data["key"]
    key_id      = pk_data["key_id"]

    pk_bytes = base64.b64decode(pub_key_b64)
    sealed   = nacl_public.SealedBox(nacl_public.PublicKey(pk_bytes))
    enc_val  = base64.b64encode(sealed.encrypt(value.encode())).decode()

    result = await gh_put(
        f"/repos/{GH_REPO}/actions/secrets/{name}",
        {"encrypted_value": enc_val, "key_id": key_id},
    )
    if result.get("message") and "GITHUB_" in name:
        return f"❌ GitHub blocks secrets starting with `GITHUB_`. Use `GH_PAT` instead."
    return f"✅ Secret `{name}` pushed to GitHub Actions."

# ── CI status fetch ───────────────────────────────────────────────────────────
async def fetch_ci_status() -> str:
    data = await gh_get(f"/repos/{GH_REPO}/actions/runs?per_page=30")
    runs = data.get("workflow_runs", [])

    seen: set[str] = set()
    lines: list[str] = []
    counts = {"success": 0, "failure": 0, "in_progress": 0, "queued": 0, "skipped": 0}

    for r in sorted(runs, key=lambda x: x["created_at"], reverse=True):
        name = r["name"]
        if name in seen:
            continue
        seen.add(name)
        status     = r["status"]
        conclusion = r.get("conclusion") or "—"

        if conclusion == "success":   counts["success"]     += 1
        elif conclusion == "failure": counts["failure"]     += 1
        elif conclusion == "skipped": counts["skipped"]     += 1
        elif status == "in_progress": counts["in_progress"] += 1
        elif status == "queued":      counts["queued"]      += 1

        icon = (
            "✅" if conclusion == "success"
            else "❌" if conclusion == "failure"
            else "🔄" if status == "in_progress"
            else "⏳" if status == "queued"
            else "⏭"
        )
        label = conclusion if conclusion != "—" else status
        lines.append(f"{icon} `{name[:38]}` — {label}")

    summary = (
        f"✅ {counts['success']}  ❌ {counts['failure']}  "
        f"🔄 {counts['in_progress']}  ⏳ {counts['queued']}  ⏭ {counts['skipped']}"
    )
    header = f"*🔍 CI Status — {GH_REPO}*\n{summary}\n\n"
    return header + "\n".join(lines[:25])

# ── Failures fetch ────────────────────────────────────────────────────────────
async def fetch_errors() -> str:
    data = await gh_get(f"/repos/{GH_REPO}/actions/runs?per_page=30")
    runs = data.get("workflow_runs", [])

    failures = [r for r in runs if r.get("conclusion") == "failure"]
    if not failures:
        return "✅ No failures in the last 30 workflow runs\\!"

    seen: set[str] = set()
    lines: list[str] = ["*❌ Failing Workflows*\n"]

    for r in failures:
        name = r["name"]
        if name in seen:
            continue
        seen.add(name)

        jobs_data = await gh_get(f"/repos/{GH_REPO}/actions/runs/{r['id']}/jobs")
        fail_jobs = [j for j in jobs_data.get("jobs", []) if j.get("conclusion") == "failure"]

        lines.append(f"*{name}*")
        for j in fail_jobs[:3]:
            fail_steps = [s["name"] for s in j.get("steps", []) if s.get("conclusion") == "failure"]
            lines.append(f"  • `{j['name']}` — failed: {', '.join(fail_steps[:2]) or 'unknown'}")
        lines.append(f"  [View logs]({r['html_url']})")
        lines.append("")

    return "\n".join(lines[:60])

# ── AI answer (OpenRouter / OpenAI compatible) ────────────────────────────────
async def ask_ai(question: str, context: str = "") -> str:
    if not OPENROUTER_KEY:
        return "⚠️ No LLM API key configured. Use 🔑 *Change API Key* → `LLM_API_KEY` to set one."

    system = (
        "You are NasDoor CI Bot — an expert on the NasDoor monorepo "
        "(Expo 55 React Native + Python daemon, Android/iOS, EAS builds, "
        "56-Copilot GitHub Actions fleet, OpenHands auto-fix). "
        "Answer concisely and include actionable fix steps when relevant. "
        "Format for Telegram Markdown. Keep under 600 words."
    )
    if context:
        system += f"\n\nCurrent CI context:\n{context[:1500]}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_KEY}",
                    "HTTP-Referer": f"https://github.com/{GH_REPO}",
                    "X-Title": "NasDoor Telegram Bot",
                },
                json={
                    "model": "anthropic/claude-3.5-sonnet",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": question},
                    ],
                    "max_tokens": 700,
                },
            )
        result = r.json()
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        # Fallback to OpenAI direct
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r2 = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user",   "content": question},
                        ],
                        "max_tokens": 700,
                    },
                )
            res = r2.json()
            return res["choices"][0]["message"]["content"]
        except Exception as e2:
            return f"⚠️ AI error: {e2}"

# ── Issues fetch ──────────────────────────────────────────────────────────────
async def fetch_issues() -> str:
    data = await gh_get(f"/repos/{GH_REPO}/issues?state=open&per_page=20&labels=type%3A+bug,priority%3A+critical,priority%3A+high")
    if not isinstance(data, list):
        return "⚠️ Could not fetch issues."

    if not data:
        return "✅ No critical/high priority open issues!"

    lines = ["*📊 Open Issues (critical + high)*\n"]
    for i in data[:15]:
        labels = " ".join(f"`{l['name']}`" for l in i.get("labels", [])[:3])
        lines.append(f"• [#{i['number']}]({i['html_url']}) {i['title'][:50]}")
        if labels:
            lines.append(f"  {labels}")
    return "\n".join(lines)

# ── Handlers ──────────────────────────────────────────────────────────────────
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    name = update.effective_user.first_name or "there"
    await update.message.reply_text(
        f"👋 *Hey {name}\\!* I'm your NasDoor CI Bot\\.\n\n"
        f"I monitor *{GH_REPO}* and can:\n"
        "• Show live CI status \\& errors\n"
        "• Trigger auto\\-fix \\& EAS builds\n"
        "• Change API keys \\& GitHub secrets\n"
        "• Answer any question about the codebase\n\n"
        "Pick an action below or just *type any question*\\.",
        parse_mode=ParseMode.MARKDOWN_V2,
        reply_markup=MAIN_KB,
    )

async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    msg = await update.message.reply_text("⏳ Fetching CI status…")
    try:
        text = await fetch_ci_status()
        await msg.edit_text(text, parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True)
    except Exception as e:
        await msg.edit_text(f"❌ Error: {e}")

async def cmd_errors(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    msg = await update.message.reply_text("⏳ Fetching errors…")
    try:
        text = await fetch_errors()
        inline_kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("🔧 Fix All Now", callback_data="fix_all"),
            InlineKeyboardButton("🤖 OpenHands Fix", callback_data="openhands_fix"),
        ]])
        await msg.edit_text(text, parse_mode=ParseMode.MARKDOWN,
                            disable_web_page_preview=True, reply_markup=inline_kb)
    except Exception as e:
        await msg.edit_text(f"❌ Error: {e}")

async def cmd_fix(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    msg = await update.message.reply_text("🔧 Triggering auto-fix workflow…")
    ok = await gh_dispatch("copilot-autofix.yml", {"task": "Fix all failing CI checks"})
    if ok:
        await msg.edit_text(
            "✅ *Auto-fix triggered!*\n\nCopilot Auto-Fix is running — it will:\n"
            "• Apply Prettier \\+ ESLint fixes\n"
            "• Fix Python formatting \\(autopep8 \\+ isort\\)\n"
            "• Clean YAML whitespace\n"
            "• Commit and push fixes\n\n"
            "I'll notify you when done\\.",
            parse_mode=ParseMode.MARKDOWN_V2,
        )
    else:
        await msg.edit_text("❌ Could not trigger workflow. Check GH_PAT permissions.")

async def cmd_build(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    inline_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("🤖 Android APK (preview)", callback_data="build_android")],
        [InlineKeyboardButton("🍎 iOS (preview)",         callback_data="build_ios")],
        [InlineKeyboardButton("📡 OTA Update",            callback_data="build_ota")],
    ])
    await update.message.reply_text(
        "🚀 *EAS Build* — choose a target:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=inline_kb,
    )

async def cmd_openhands(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    inline_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("🔧 Fix CI failures",    callback_data="oh_fix_ci")],
        [InlineKeyboardButton("📝 Fix all lint",       callback_data="oh_lint")],
        [InlineKeyboardButton("🔒 Security scan+fix",  callback_data="oh_security")],
        [InlineKeyboardButton("📊 Status check",       callback_data="oh_status")],
    ])
    await update.message.reply_text(
        "🤖 *OpenHands AI* — what should it do?",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=inline_kb,
    )

async def cmd_issues(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    msg = await update.message.reply_text("⏳ Fetching issue report…")
    try:
        text = await fetch_issues()
        await msg.edit_text(text, parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True)
    except Exception as e:
        await msg.edit_text(f"❌ Error: {e}")

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "*NasDoor CI Bot — Command Reference*\n\n"
        "🔍 *CI Status* — live workflow status\n"
        "❌ *Errors* — failing workflows with step details\n"
        "🔧 *Fix All* — trigger Copilot Auto-Fix\n"
        "🚀 *EAS Build* — start Android/iOS/OTA build\n"
        "🔑 *Change API Key* — update any GitHub secret\n"
        "🤖 *OpenHands* — AI-powered auto-fix\n"
        "📊 *Issue Report* — open GitHub issues\n\n"
        "*Slash commands:*\n"
        "/fix — trigger auto-fix\n"
        "/status — CI dashboard\n"
        "/errors — failure details\n"
        "/setkey — change a secret\n"
        "/build — EAS build menu\n\n"
        "*Just type any question* — I'll answer using AI with full CI context\\.",
        parse_mode=ParseMode.MARKDOWN_V2,
        reply_markup=MAIN_KB,
    )

# ── Change API key conversation ────────────────────────────────────────────────
async def start_setkey(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    inline_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("LLM_API_KEY (OpenHands)",    callback_data="sk_LLM_API_KEY")],
        [InlineKeyboardButton("OPENROUTER_API_KEY",          callback_data="sk_OPENROUTER_API_KEY")],
        [InlineKeyboardButton("EXPO_TOKEN",                  callback_data="sk_EXPO_TOKEN")],
        [InlineKeyboardButton("ELEVENLABS_AGENT_ID",         callback_data="sk_ELEVENLABS_AGENT_ID")],
        [InlineKeyboardButton("LIVEKIT_URL",                 callback_data="sk_LIVEKIT_URL")],
        [InlineKeyboardButton("NTFY_TOPIC (notifications)",  callback_data="sk_NTFY_TOPIC")],
        [InlineKeyboardButton("✏️ Type custom name…",        callback_data="sk_custom")],
    ])
    await update.message.reply_text(
        "🔑 *Change GitHub Secret*\n\nWhich secret do you want to update?",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=inline_kb,
    )
    return AWAITING_SECRET_NAME

async def setkey_choose(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    data = query.data  # e.g. "sk_LLM_API_KEY"

    if data == "sk_custom":
        await query.edit_message_text("✏️ Type the secret name (e.g. `MY_API_KEY`):")
        return AWAITING_SECRET_NAME

    secret_name = data[3:]  # strip "sk_"
    ctx.user_data["secret_name"] = secret_name
    await query.edit_message_text(
        f"🔑 Setting `{secret_name}`\n\nSend me the *new value* now:\n_(Your message will be deleted immediately after processing)_",
        parse_mode=ParseMode.MARKDOWN,
    )
    return AWAITING_SECRET_VALUE

async def setkey_name(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    name = update.message.text.strip().upper().replace(" ", "_")
    ctx.user_data["secret_name"] = name
    # Delete user message for security
    try:
        await update.message.delete()
    except Exception:
        pass
    await update.message.reply_text(
        f"🔑 Setting `{name}`\n\nSend me the *new value* now:\n_(Your message will be deleted immediately)_",
        parse_mode=ParseMode.MARKDOWN,
    )
    return AWAITING_SECRET_VALUE

async def setkey_value(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    value = update.message.text.strip()
    name  = ctx.user_data.get("secret_name", "UNKNOWN")

    # Delete user message immediately for security
    try:
        await update.message.delete()
    except Exception:
        pass

    msg = await update.message.reply_text(f"⏳ Pushing `{name}` to GitHub…")
    try:
        result = await push_github_secret(name, value)
        await msg.edit_text(result + "\n\n✅ OpenHands and all workflows will now use the new key.",
                            parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await msg.edit_text(f"❌ Failed: {e}")

    return ConversationHandler.END

async def setkey_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Cancelled.", reply_markup=MAIN_KB)
    return ConversationHandler.END

# ── Inline button callbacks ────────────────────────────────────────────────────
async def button_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    data  = query.data

    if data == "fix_all":
        ok = await gh_dispatch("copilot-autofix.yml", {"task": "Fix all failing CI checks"})
        await query.edit_message_reply_markup(None)
        await query.message.reply_text(
            "✅ Auto-fix triggered!" if ok else "❌ Trigger failed — check GH_PAT."
        )

    elif data == "openhands_fix":
        ok = await gh_dispatch("openhands-bot.yml", {"task": "Fix all CI errors automatically"})
        await query.edit_message_reply_markup(None)
        await query.message.reply_text(
            "🤖 OpenHands fix triggered!" if ok else "❌ Trigger failed."
        )

    elif data == "build_android":
        ok = await gh_dispatch("eas-build.yml", {"platform": "android", "profile": "preview"})
        await query.edit_message_text("🤖 Android APK build triggered!" if ok else "❌ Failed.")

    elif data == "build_ios":
        ok = await gh_dispatch("eas-build.yml", {"platform": "ios", "profile": "preview"})
        await query.edit_message_text("🍎 iOS build triggered!" if ok else "❌ Failed.")

    elif data == "build_ota":
        ok = await gh_dispatch("eas-ota.yml")
        await query.edit_message_text("📡 OTA update triggered!" if ok else "❌ Failed.")

    elif data in ("oh_fix_ci", "oh_lint", "oh_security", "oh_status"):
        tasks = {
            "oh_fix_ci":    "Fix all failing CI checks and workflow errors",
            "oh_lint":      "Fix all ESLint, Prettier, and Python lint issues",
            "oh_security":  "Run security scan and fix any vulnerabilities found",
            "oh_status":    "Audit the entire codebase and report all issues",
        }
        ok = await gh_dispatch("openhands-bot.yml", {"task": tasks[data]})
        await query.edit_message_text(
            f"🤖 OpenHands: _{tasks[data]}_\n{'✅ Triggered!' if ok else '❌ Failed.'}"
        )

    elif data.startswith("sk_"):
        # Handled by conversation handler
        pass

# ── Free-text: intelligent AI answers ────────────────────────────────────────
async def text_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    text = update.message.text.strip()

    # Button shortcuts
    BTN = {
        "🔍 CI Status":      cmd_status,
        "❌ Errors":          cmd_errors,
        "🔧 Fix All":        cmd_fix,
        "🚀 EAS Build":      cmd_build,
        "🔑 Change API Key": start_setkey,
        "🤖 OpenHands":      cmd_openhands,
        "📊 Issue Report":   cmd_issues,
        "ℹ️ Help":           cmd_help,
    }
    if text in BTN:
        return await BTN[text](update, ctx)

    # AI answer with CI context
    thinking = await update.message.reply_text("🤔 Thinking…")
    try:
        # Grab quick CI context
        ci_data  = await gh_get(f"/repos/{GH_REPO}/actions/runs?per_page=10")
        runs     = ci_data.get("workflow_runs", [])
        failures = [r["name"] for r in runs if r.get("conclusion") == "failure"]
        ci_ctx   = f"Recent failures: {failures}" if failures else "All CI passing."

        answer = await ask_ai(text, context=ci_ctx)
        await thinking.edit_text(answer, parse_mode=ParseMode.MARKDOWN,
                                 disable_web_page_preview=True)
    except Exception as e:
        await thinking.edit_text(f"❌ AI error: {e}")

# ── Background CI monitor ─────────────────────────────────────────────────────
_last_failures: set[str] = set()

async def ci_monitor(app: Application) -> None:
    """Poll every 90s. Text on new failures or recoveries."""
    global _last_failures
    log.info("CI monitor started")

    while True:
        await asyncio.sleep(90)
        if not CHAT_ID:
            continue
        try:
            data     = await gh_get(f"/repos/{GH_REPO}/actions/runs?per_page=30")
            runs     = data.get("workflow_runs", [])
            seen: set[str] = set()
            curr_fail: set[str] = set()

            for r in sorted(runs, key=lambda x: x["created_at"], reverse=True):
                name = r["name"]
                if name in seen:
                    continue
                seen.add(name)
                if r.get("conclusion") == "failure":
                    curr_fail.add(name)

            new_failures  = curr_fail - _last_failures
            new_recoveries = _last_failures - curr_fail

            if new_failures:
                lines = [f"🚨 *New CI failures detected!*\n"]
                for n in new_failures:
                    lines.append(f"❌ `{n}`")
                lines.append("\nReply /errors for details or /fix to auto-repair.")
                await app.bot.send_message(
                    CHAT_ID,
                    "\n".join(lines),
                    parse_mode=ParseMode.MARKDOWN,
                    reply_markup=MAIN_KB,
                )

            if new_recoveries:
                names = ", ".join(f"`{n}`" for n in new_recoveries)
                await app.bot.send_message(
                    CHAT_ID,
                    f"✅ *Fixed!* {names} now passing.",
                    parse_mode=ParseMode.MARKDOWN,
                    reply_markup=MAIN_KB,
                )

            _last_failures = curr_fail

        except Exception as e:
            log.warning(f"CI monitor error: {e}")

# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    app = Application.builder().token(BOT_TOKEN).build()

    # Conversation: change secret
    conv = ConversationHandler(
        entry_points=[
            CommandHandler("setkey", start_setkey),
            MessageHandler(filters.Regex("^🔑 Change API Key$"), start_setkey),
        ],
        states={
            AWAITING_SECRET_NAME:  [
                CallbackQueryHandler(setkey_choose, pattern=r"^sk_"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, setkey_name),
            ],
            AWAITING_SECRET_VALUE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, setkey_value),
            ],
        },
        fallbacks=[CommandHandler("cancel", setkey_cancel)],
        per_chat=True,
        per_user=True,
        per_message=True,
    )

    app.add_handler(conv)
    app.add_handler(CommandHandler("start",  cmd_start))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("errors", cmd_errors))
    app.add_handler(CommandHandler("fix",    cmd_fix))
    app.add_handler(CommandHandler("build",  cmd_build))
    app.add_handler(CommandHandler("help",   cmd_help))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    # Start background monitor
    async def post_init(application: Application) -> None:
        asyncio.create_task(ci_monitor(application))

    app.post_init = post_init

    log.info("🤖 NasDoor Telegram Bot starting…")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)

if __name__ == "__main__":
    main()
