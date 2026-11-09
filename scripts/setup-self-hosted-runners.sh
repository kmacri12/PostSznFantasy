#!/usr/bin/env bash
# Registers two GitHub Actions runners on this machine (see docs/deploy/self-hosted-runner.md).
set -euo pipefail
repo="${REPO:-kmacri12/PostSznFantasy}"
version="$(gh api repos/actions/runner/releases/latest --jq .tag_name | sed 's/^v//')"
curl -fsSL -o /tmp/actions-runner.tgz \
  "https://github.com/actions/runner/releases/download/v${version}/actions-runner-linux-x64-${version}.tar.gz"
for i in 1 2; do
  dir="$HOME/actions-runner-$i"
  mkdir -p "$dir" && tar xzf /tmp/actions-runner.tgz -C "$dir"
  labels="self-hosted,linux,x64,postszn"
  [ "$i" = 1 ] && labels="$labels,e2e"
  token="$(gh api -X POST "repos/$repo/actions/runners/registration-token" --jq .token)"
  (cd "$dir" && ./config.sh --unattended --url "https://github.com/$repo" --token "$token" \
    --name "ubuntu-home-$i" --labels "$labels" --work _work --replace)
  mkdir -p "$HOME/.config/systemd/user"
  cat > "$HOME/.config/systemd/user/actions-runner-$i.service" <<UNIT
[Unit]
Description=GitHub Actions runner $i
After=network-online.target docker.service

[Service]
WorkingDirectory=$dir
ExecStart=$dir/run.sh
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
UNIT
  systemctl --user daemon-reload
  systemctl --user enable --now "actions-runner-$i.service"
done
echo "Runners registered. Then: gh variable set CI_RUNS_ON --body '[\"self-hosted\",\"postszn\"]'"
echo "and:                      gh variable set CI_E2E_RUNS_ON --body '[\"self-hosted\",\"postszn\",\"e2e\"]'"
echo "To survive reboots without logging in: sudo loginctl enable-linger \$USER"
