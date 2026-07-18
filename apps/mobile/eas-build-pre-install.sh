#!/usr/bin/env bash
# Optional: materialize the upload keystore on EAS when provided as a secret.
# Set project env vars (Expo dashboard or `eas env:create`):
#   HOPLIO_UPLOAD_KEYSTORE_BASE64  — base64 of android/hoplio-upload.jks
#   HOPLIO_UPLOAD_STORE_PASSWORD
#   HOPLIO_UPLOAD_KEY_ALIAS          — usually "hoplio-upload"
#   HOPLIO_UPLOAD_KEY_PASSWORD
#
# Prefer uploading the keystore once with `eas credentials -p android` instead;
# this hook is a fallback when you want secrets-driven signing.

set -euo pipefail

if [ -n "${HOPLIO_UPLOAD_KEYSTORE_BASE64:-}" ]; then
  echo "Writing release keystore from HOPLIO_UPLOAD_KEYSTORE_BASE64"
  printf '%s' "$HOPLIO_UPLOAD_KEYSTORE_BASE64" | base64 -d > android/hoplio-upload.jks
fi
