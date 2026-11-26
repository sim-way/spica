#!/bin/sh
# Spica CLI zero-runtime installer
# Usage: curl -fsSL https://spica.simway.io/install.sh | sh
set -eu

REPO="sim-way/spica"
BINARY_NAME="spica"
INSTALL_DIR="${SPICA_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${SPICA_VERSION:-latest}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: Required command '$1' was not found in PATH." >&2
    exit 1
  fi
}

detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "darwin" ;;
    *)
      echo "Error: Unsupported operating system '$(uname -s)'. See https://github.com/$REPO/releases" >&2
      exit 1
      ;;
  esac
}

detect_arch() {
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *)
      echo "Error: Unsupported CPU architecture '$arch'. See https://github.com/$REPO/releases" >&2
      exit 1
      ;;
  esac
}

verify_sha256() {
  archive_path="$1"
  checksums_path="$2"
  archive_name="$3"

  expected="$(grep "  $archive_name\$" "$checksums_path" | awk '{print $1}' || true)"
  if [ -z "$expected" ]; then
    echo "Warning: No checksum entry found for $archive_name; skipping verification." >&2
    return 0
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$archive_path" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$archive_path" | awk '{print $1}')"
  else
    echo "Warning: Neither sha256sum nor shasum found; skipping checksum verification." >&2
    return 0
  fi

  if [ "$actual" != "$expected" ]; then
    echo "Error: Checksum mismatch for $archive_name" >&2
    echo "  Expected: $expected" >&2
    echo "  Actual:   $actual" >&2
    exit 1
  fi
}

main() {
  need_cmd curl
  need_cmd tar

  os="$(detect_os)"
  arch="$(detect_arch)"
  archive_name="spica-${os}-${arch}.tar.gz"

  if [ "$VERSION" = "latest" ]; then
    base_url="https://github.com/$REPO/releases/latest/download"
  else
    tag="$VERSION"
    case "$tag" in
      v*) ;;
      *) tag="v$tag" ;;
    esac
    base_url="https://github.com/$REPO/releases/download/$tag"
  fi

  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT INT TERM

  archive_path="$tmp_dir/$archive_name"
  checksums_path="$tmp_dir/checksums.txt"

  echo "Downloading Spica ($os-$arch)..."
  curl -fsSL "$base_url/$archive_name" -o "$archive_path"

  if curl -fsSL "$base_url/checksums.txt" -o "$checksums_path" 2>/dev/null; then
    verify_sha256 "$archive_path" "$checksums_path" "$archive_name"
  fi

  tar -xzf "$archive_path" -C "$tmp_dir"

  mkdir -p "$INSTALL_DIR"
  install_path="$INSTALL_DIR/$BINARY_NAME"
  mv "$tmp_dir/$BINARY_NAME" "$install_path"
  chmod +x "$install_path"

  echo "Installed Spica to $install_path"
  "$install_path" --version

  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
      echo ""
      echo "Add $INSTALL_DIR to your PATH to run 'spica' from anywhere:"
      echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
      ;;
  esac
}

main "$@"
