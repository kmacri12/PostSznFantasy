# Step 14: verify stat keys against a real box score

2 minutes for you, the rest is the coordinator's. Issue #77. Needs Step 2. [Back to the list](README.md)

Our scoring assumes Tank01 names each stat a certain way. Someone has to compare against real 2025 playoff box scores, which spends a handful of API calls. The coordinator runs the check; you only put the key on your own computer.

1. In the repo root, if `api/.env` does not exist yet:
   ```bash
   cp api/.env.example api/.env
   ```
2. Open `api/.env` in your editor and set `RAPIDAPI_APIKEY=` to your Tank01 key from your password manager. The file is never committed and stays on your computer. **Do not send the key to anyone.**
3. Tell the coordinator: "the key is in".

## Verify

The coordinator posts the comparison on #77 and `docs/rapidapi-tank01.md` lists which keys are confirmed. #77 closes then.
