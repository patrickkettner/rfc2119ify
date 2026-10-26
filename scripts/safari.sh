#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
rm -rf safari/rfc2119ify
xcrun safari-web-extension-converter src \
  --project-location safari \
  --app-name rfc2119ify \
  --bundle-identifier com.patrickkettner.rfc2119ify \
  --macos-only --copy-resources --no-open --no-prompt --force
