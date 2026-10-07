#!/usr/bin/env bash
#
# Build a .deb of Achilles Financials.
#
# Runs the whole build inside a Debian container, for two reasons: the native
# SQLite module has to be compiled for Linux and the target architecture, and
# dpkg-deb is not available on macOS.
#
# The package ships its own Node runtime — the very binary from the build
# image, not a downloaded one. better-sqlite3 is compiled against a specific
# Node ABI, and the distributions disagree on which Node they carry: Debian 12
# has 18, Ubuntu 24.04 has 20, Trixie has 22. Relying on the system Node would
# mean the module loads on some machines and throws NODE_MODULE_VERSION on
# others. Shipping the exact binary that compiled it makes the match structural
# rather than something to verify. ~110 MB of runtime buys "install and it runs".
#
# Usage: deploy/deb/build.sh [amd64|arm64] ...   (default: both)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

VERSION="$(node -p "require('./package.json').version")"
OUT_DIR="$REPO_ROOT/dist-deb"

ARCHES=("$@")
[ ${#ARCHES[@]} -eq 0 ] && ARCHES=(amd64 arm64)

mkdir -p "$OUT_DIR"

for ARCH in "${ARCHES[@]}"; do
  case "$ARCH" in
    amd64) PLATFORM=linux/amd64 ;;
    arm64) PLATFORM=linux/arm64 ;;
    *) echo "Unbekannte Architektur: $ARCH" >&2; exit 1 ;;
  esac

  echo "==> Baue achilles-financials ${VERSION} für ${ARCH}"

  docker run --rm --platform "$PLATFORM" \
    -v "$REPO_ROOT":/src:ro \
    -v "$OUT_DIR":/out \
    -e VERSION="$VERSION" -e ARCH="$ARCH" \
    node:22-bookworm-slim bash -euo pipefail -c '
      apt-get update -qq
      apt-get install -y --no-install-recommends python3 make g++ dpkg-dev >/dev/null

      # Build in a writable copy; /src is mounted read-only so a build can
      # never touch the working tree it was started from.
      mkdir -p /build && cd /build
      cp -r /src/src /src/static /src/package.json /src/package-lock.json \
            /src/svelte.config.js /src/vite.config.ts /src/tsconfig.json \
            /src/server.js .

      echo "--> npm ci"
      npm ci --no-audit --no-fund >/dev/null

      echo "--> vite build"
      npm run build >/dev/null

      # Only the runtime dependencies (SQLite, FinTS, QR) ship — the build
      # tooling stays behind.
      npm prune --omit=dev --no-audit --no-fund >/dev/null

      PKG=/pkg
      APP=$PKG/opt/achilles-financials
      mkdir -p "$APP" "$PKG/DEBIAN" "$PKG/lib/systemd/system" \
               "$PKG/etc/achilles-financials" "$PKG/var/lib/achilles-financials" \
               "$PKG/usr/share/doc/achilles-financials"

      # adapter-node output (server, client assets, static/) plus the entry
      # wrapper and the production node_modules it imports at runtime.
      cp -r build server.js package.json node_modules "$APP/"

      # Ship the Node from this build image: it is the one npm ci compiled the
      # native module against, so no version can drift between the two.
      echo "--> Node $(node --version) mitliefern"
      mkdir -p "$APP/runtime/bin"
      cp "$(command -v node)" "$APP/runtime/bin/node"
      chmod 755 "$APP/runtime/bin/node"

      echo "--> better-sqlite3 gegen das mitgelieferte Node prüfen"
      if ! "$APP/runtime/bin/node" -e "process.dlopen({exports:{}}, \
            \"$APP/node_modules/better-sqlite3/build/Release/better_sqlite3.node\")"; then
        echo "FEHLER: SQLite-Modul passt nicht zur mitgelieferten Node-Version." >&2
        exit 1
      fi

      cp /src/deploy/deb/achilles-financials.service "$PKG/lib/systemd/system/"
      cp /src/deploy/deb/env.default            "$PKG/etc/achilles-financials/env"
      cp /src/deploy/deb/postinst /src/deploy/deb/prerm /src/deploy/deb/postrm "$PKG/DEBIAN/"
      chmod 755 "$PKG/DEBIAN/postinst" "$PKG/DEBIAN/prerm" "$PKG/DEBIAN/postrm"
      cp /src/README.md "$PKG/usr/share/doc/achilles-financials/" 2>/dev/null || true

      # Marks the install as apt-managed: the in-app updater rebuilds Docker
      # images, which would be wrong here, so the app points at apt instead.
      echo "deb" > "$APP/install-method"
      printf "{\"version\":\"%s\",\"branch\":\"main\"}\n" "$VERSION" > "$APP/version.json"

      INSTALLED_KB=$(du -sk "$PKG" | cut -f1)
      sed -e "s/@VERSION@/${VERSION}/" -e "s/@ARCH@/${ARCH}/" \
          -e "s/@INSTALLED_SIZE@/${INSTALLED_KB}/" \
          /src/deploy/deb/control.in > "$PKG/DEBIAN/control"

      # Config file: dpkg must not overwrite a port or URL the admin changed.
      echo "/etc/achilles-financials/env" > "$PKG/DEBIAN/conffiles"

      DEB="/out/achilles-financials_${VERSION}_${ARCH}.deb"
      dpkg-deb --root-owner-group -Zxz -b "$PKG" "$DEB" >/dev/null
      echo "--> $(basename "$DEB") ($(du -h "$DEB" | cut -f1))"
    '
done

echo
echo "Fertig:"
ls -lh "$OUT_DIR"/*.deb | awk '{print "  " $NF "  " $5}'
