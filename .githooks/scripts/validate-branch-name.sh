#!/usr/bin/env bash
# .githooks/scripts/validate_branch_name.sh
#
# Validates the current branch name against the project naming convention.
#
# Format : <type>/<bounded-context>/<short-description-in-kebab-case>
#
# Usage:
#   validate_branch_name.sh
#
# Called by lefthook on the pre-push hook.
# Can also be run manually for testing:
#   OVERRIDE_BRANCH="feature/auth/register-use-case" bash .githooks/scripts/validate_branch_name.sh
#
# Debug mode:
#   HOOK_DEBUG=1 bash .githooks/scripts/validate_branch_name.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# ANSI colour codes
# ---------------------------------------------------------------------------
if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ]; then
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  GREEN='\033[0;32m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  RED='' YELLOW='' GREEN='' CYAN='' BOLD='' DIM='' RESET=''
fi

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log_info()    { echo -e "${CYAN}[hook]${RESET} $*"; }
log_success() { echo -e "${GREEN}[hook]${RESET} $*"; }
log_warn()    { echo -e "${YELLOW}[hook]${RESET} $*" >&2; }
log_error()   { echo -e "${RED}${BOLD}[hook] ERROR${RESET} $*" >&2; }
log_debug()   { [ "${HOOK_DEBUG:-0}" = "1" ] && echo -e "${DIM}[hook:debug]${RESET} $*" || true; }

# ---------------------------------------------------------------------------
# Resolve branch name
# OVERRIDE_BRANCH allows manual testing without being on the target branch.
# ---------------------------------------------------------------------------
if [ -n "${OVERRIDE_BRANCH:-}" ]; then
  BRANCH="$OVERRIDE_BRANCH"
  log_debug "Using overridden branch name: $BRANCH"
else
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  log_debug "Resolved branch name: $BRANCH"
fi

if [ -z "$BRANCH" ]; then
  log_error "Could not determine the current branch name."
  exit 1
fi

# ---------------------------------------------------------------------------
# Exemptions
# ---------------------------------------------------------------------------

# Protected branch — pushes from CI or hotfix procedures.
if echo "$BRANCH" | grep -qE '^(main|HEAD)$'; then
  log_debug "Protected branch '$BRANCH' — skipping validation."
  exit 0
fi

# Branches created by release-please.
if echo "$BRANCH" | grep -qE '^release-please--'; then
  log_debug "release-please branch detected — skipping validation."
  exit 0
fi

# Dependabot branches.
if echo "$BRANCH" | grep -qE '^dependabot/'; then
  log_debug "Dependabot branch detected — skipping validation."
  exit 0
fi

# ---------------------------------------------------------------------------
# Branch naming pattern
#
# Segment 1 — type      : one of the allowed keywords
# Segment 2 — context   : lowercase alphanumeric with hyphens (bounded context
#                         or functional area)
# Segment 3 — description: lowercase kebab-case (optional but recommended)
#
# Maximum length: 80 characters (avoids filesystem issues on some platforms).
# ---------------------------------------------------------------------------
ALLOWED_TYPES="feature|fix|hotfix|refactor|test|docs|chore|ci|release"
PATTERN="^(${ALLOWED_TYPES})/[a-z][a-z0-9-]+(/[a-z][a-z0-9-]+)*$"
MAX_LENGTH=80

log_debug "Pattern    : $PATTERN"
log_debug "Max length : $MAX_LENGTH"

# Length check.
if [ "${#BRANCH}" -gt "$MAX_LENGTH" ]; then
  echo ""
  log_error "Branch name exceeds the maximum allowed length of ${MAX_LENGTH} characters."
  echo ""
  echo -e "  ${BOLD}Current branch:${RESET} ${RED}${BRANCH}${RESET}"
  echo -e "  ${BOLD}Length:${RESET} ${#BRANCH} characters"
  echo ""
  exit 1
fi

# Pattern check.
if echo "$BRANCH" | grep -qE "$PATTERN"; then
  log_success "Branch name is valid: ${CYAN}${BRANCH}${RESET}"
  exit 0
fi

# ---------------------------------------------------------------------------
# Failure — produce a detailed, actionable error message
# ---------------------------------------------------------------------------
echo ""
log_error "Branch name does not conform to the project naming convention."
echo ""
echo -e "  ${BOLD}Expected format:${RESET}"
echo -e "  ${GREEN}<type>${RESET}/${CYAN}<bounded-context>${RESET}/${DIM}<short-description>${RESET}"
echo ""
echo -e "  ${BOLD}Allowed types:${RESET}"
echo -e "  ${GREEN}feature${RESET}   — new functionality"
echo -e "  ${GREEN}fix${RESET}       — bug fix"
echo -e "  ${GREEN}hotfix${RESET}    — urgent production fix"
echo -e "  ${GREEN}refactor${RESET}  — code restructuring"
echo -e "  ${GREEN}test${RESET}      — test-only branch"
echo -e "  ${GREEN}docs${RESET}      — documentation"
echo -e "  ${GREEN}chore${RESET}     — tooling, dependencies"
echo -e "  ${GREEN}ci${RESET}        — CI/CD pipeline changes"
echo -e "  ${GREEN}release${RESET}   — release preparation"
echo ""
echo -e "  ${BOLD}Allowed bounded contexts:${RESET}"
echo -e "  ${CYAN}auth, room, video-sync, infra, planning${RESET}"
echo ""
echo -e "  ${BOLD}Rules:${RESET}"
echo -e "  ${DIM}— All segments must be lowercase${RESET}"
echo -e "  ${DIM}— Use hyphens as word separators, not underscores${RESET}"
echo -e "  ${DIM}— Maximum ${MAX_LENGTH} characters${RESET}"
echo ""
echo -e "  ${BOLD}Examples:${RESET}"
echo -e "  ${GREEN}feature/auth/register-use-case${RESET}"
echo -e "  ${GREEN}fix/room/ownership-check-on-deletion${RESET}"
echo -e "  ${GREEN}test/video-sync/playback-bloc-unit-tests${RESET}"
echo -e "  ${GREEN}chore/infra/update-flutter-sdk${RESET}"
echo -e "  ${GREEN}ci/infra/add-coverage-report${RESET}"
echo ""
echo -e "  ${BOLD}Received:${RESET}"
echo -e "  ${RED}${BRANCH}${RESET}"
echo ""

# Targeted hints based on common mistakes.
FIRST_SEGMENT=$(echo "$BRANCH" | cut -d'/' -f1)
SEGMENT_COUNT=$(echo "$BRANCH" | tr -cd '/' | wc -c)

if ! echo "$FIRST_SEGMENT" | grep -qE "^(${ALLOWED_TYPES})$"; then
  log_warn "Hint: '${FIRST_SEGMENT}' is not an allowed type."
elif [ "$SEGMENT_COUNT" -lt 1 ]; then
  log_warn "Hint: at least two segments are required (type/context)."
elif echo "$BRANCH" | grep -qE "_"; then
  log_warn "Hint: use hyphens (-) instead of underscores (_) as word separators."
elif echo "$BRANCH" | grep -qE "[A-Z]"; then
  log_warn "Hint: branch names must be entirely lowercase."
fi

echo ""
exit 1