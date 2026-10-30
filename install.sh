#!/usr/bin/env bash

set -Eeuo pipefail

repository_url="${OPENMONETIS_REPOSITORY_URL:-https://github.com/felipegcoutinho/openmonetis-v2.git}"
install_directory="${OPENMONETIS_INSTALL_DIR:-${PWD}/openmonetis}"
public_url="${OPENMONETIS_URL:-http://localhost:7002}"
requested_version="${OPENMONETIS_VERSION:-}"
semantic_version_pattern='^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$'

fail() {
  printf 'OpenMonetis installation failed: %s\n' "$1" >&2
  exit 1
}

for required_command in git docker openssl awk sort tail; do
  command -v "${required_command}" >/dev/null 2>&1 || fail "${required_command} is required."
done

docker compose version >/dev/null 2>&1 || fail "Docker Compose is required."
docker info >/dev/null 2>&1 || fail "The Docker daemon is not running."

if [[ -e "${install_directory}" ]]; then
  fail "${install_directory} already exists. Choose another location with OPENMONETIS_INSTALL_DIR."
fi

list_published_versions() {
  git ls-remote --tags --refs "${repository_url}" 'v*' |
    awk -v pattern="${semantic_version_pattern}" '{
      version = $2
      sub("^refs/tags/v", "", version)
      if (version ~ pattern) print version
    }'
}

published_versions="$(list_published_versions)" || fail "Could not list the published versions."

if [[ -n "${requested_version}" ]]; then
  version="${requested_version#v}"
  [[ "${version}" =~ ${semantic_version_pattern} ]] ||
    fail "OPENMONETIS_VERSION must be a published version such as 0.12.0."
  printf '%s\n' "${published_versions}" | awk -v version="${version}" '$0 == version { found = 1 } END { exit !found }' ||
    fail "Version ${version} was not found in the published releases."
else
  version="$(printf '%s\n' "${published_versions}" | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1)"
  [[ -n "${version}" ]] || fail "No published version was found."
fi

printf 'Cloning OpenMonetis %s into %s...\n' "${version}" "${install_directory}"
git -c advice.detachedHead=false clone --depth 1 --branch "v${version}" "${repository_url}" "${install_directory}"

environment_file="${install_directory}/.env"
cp "${install_directory}/.env.example" "${environment_file}"

random_secret() {
  openssl rand -hex 32
}

set_environment_value() {
  local key="$1"
  local value="$2"
  local temporary_file

  temporary_file="$(mktemp "${environment_file}.XXXXXX")"
  awk -v key="${key}" -v value="${value}" '
    BEGIN { updated = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "${environment_file}" >"${temporary_file}"
  mv "${temporary_file}" "${environment_file}"
}

database_password="$(random_secret)"
set_environment_value "OPENMONETIS_VERSION" "${version}"
set_environment_value "POSTGRES_PASSWORD" "${database_password}"
set_environment_value "BETTER_AUTH_SECRET" "$(random_secret)"
set_environment_value "DEVICE_TOKEN_SECRET" "$(random_secret)"
set_environment_value "PERSON_CONNECTION_SECRET" "$(random_secret)"
set_environment_value "OPENMONETIS_URL" "${public_url}"
set_environment_value "BETTER_AUTH_URL" "${public_url}"
set_environment_value "WEB_URL" "${public_url}"
set_environment_value "CORS_ORIGIN" "${public_url}"
chmod 600 "${environment_file}"

printf 'Pulling images and starting OpenMonetis...\n'
(
  cd "${install_directory}"
  docker compose pull
  docker compose up -d
  docker compose ps
)

printf '\nOpenMonetis %s is ready at %s\n' "${version}" "${public_url}"
printf 'Installation directory: %s\n' "${install_directory}"
printf 'To update, read the upgrade notes, back up your data, check out the new vX.Y.Z tag and set the same OPENMONETIS_VERSION.\n'
