#!/bin/sh
# Installs pstack-claude into ~/.claude, or updates it to the latest main.
# Usage: curl -fsSL https://raw.githubusercontent.com/RayenTellissy/pstack-claude/main/install.sh | sh
set -eu

ref="${PSTACK_REF:-main}"
dest="$HOME/.claude"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl -fsSL -o "$tmp/pstack.tar.gz" "https://github.com/RayenTellissy/pstack-claude/archive/$ref.tar.gz"
tar -xzf "$tmp/pstack.tar.gz" -C "$tmp" --strip-components=1
mkdir -p "$dest"
cp -R "$tmp/skills" "$tmp/agents" "$tmp/output-styles" "$tmp/pstack" "$dest/"

echo "pstack-claude ($ref) is installed in $dest. Start a new Claude Code session to load it."
