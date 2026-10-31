# Step 1: prep your computer

About 20 minutes. [Back to the list](README.md)

1. **Password manager.** Open yours (1Password, Bitwarden, Apple Passwords, any). You will save into it:
   - the Supabase database password and connection strings
   - the RapidAPI key
   - the backup key and its passphrase
2. **Get the latest code.**
   ```bash
   cd ~/code/PostSznFantasy
   git status
   git checkout main
   git pull
   ```
   `git status` should say there is nothing to commit. If it lists changed files, stop and ask.
3. **Install flyctl** (Fly's command line tool):
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```
   At the end it prints lines to add to your shell profile. Open the profile with `nano ~/.bashrc`, paste them at the bottom, then save (Ctrl-O, Enter, Ctrl-X). Close the terminal and open a new one.
4. **GitHub login.** `gh auth status` must say you are logged in as `kmacri12`. If not, run `gh auth login`.
5. **Other tools.** `uv --version` and `psql --version` must each print a version.

## Verify

In a **new** terminal, each of these prints a version or "Logged in":

```bash
fly version
gh auth status
uv --version
psql --version
```

## If it goes wrong

- `fly: command not found`: the profile lines were not added, or you did not open a new terminal.
- Anything else: paste the error text to the coordinator.
