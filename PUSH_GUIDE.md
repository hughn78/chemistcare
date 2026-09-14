# Pushing to GitHub — exact steps

**Repo:** https://github.com/hughn78/chemistcare.git
**Visibility:** ⚠️ **PUBLIC** — anything you push is world-readable.
**Default branch on remote:** `main`
**Local branch:** `prescriberos-clinical-modernisation`
**State:** 20 commits ahead of remote `main`, zero commits behind. Clean fast-forward — no merge conflicts possible.

> ⚠️ **Do not rename this branch to `workbuddy/prescriberos-clinical-modernisation` on this machine.**
> Git here silently drops nested ref directories — `.git/refs/heads/workbuddy/` disappeared
> right after a successful rename, leaving HEAD pointing at a branch with no commits. The
> commits were recovered from the reflog, but it cost a scare. If you want the slash for
> tidiness, rename it **after** pushing, on a machine where nested refs persist:
> `git branch -m workbuddy/prescriberos-clinical-modernisation`

I cannot push: this environment has no GitHub credentials, no SSH keys, and no `gh` CLI. Read access works (the repo is public); **write needs you to authenticate once**. Pick one method below.

---

## Method 1 — Browser login (easily the simplest, ~30 seconds)

This machine already has **Git Credential Manager 2.9.0** bundled, so you do **not** need to create a token.

```bash
cd /e/AI/chemistcare
git push -u origin prescriberos-clinical-modernisation
```

What happens:

1. A **GitHub login window opens in your browser** (or a device-code prompt appears in the terminal).
2. Log in as **`hughn78`** and click **Authorize**.
3. Come back to the terminal — the push completes and the credential is cached, so future pushes are silent.

If no browser appears, the terminal prints a **one-time device code** and a URL. Open the URL, paste the code, approve.

---

## Method 2 — Personal Access Token

Use this if the browser flow is blocked. GitHub **does not** accept your account password for git over HTTPS — a token is mandatory.

**Create the token:**

- Classic (simplest): **https://github.com/settings/tokens** → *Generate new token (classic)* → tick **`repo`** → generate
- Or fine-grained: **https://github.com/settings/personal-access-tokens** → select repo `hughn78/chemistcare` → *Contents: Read and write*

Copy the token (`github_pat_...` or `ghp_...`). You only see it once.

**Then push** — use the token as the *password*:

```bash
git push -u origin prescriberos-clinical-modernisation
# Username: hughn78
# Password: <paste the token>
```

To avoid pasting it every time, cache it first:

```bash
git config --global credential.helper manager
git push -u origin prescriberos-clinical-modernisation
```

> Do **not** put the token in the remote URL — it gets written to `.git/config` in plain text.

---

## Method 3 — SSH key (best if you'll push often)

```bash
ssh-keygen -t ed25519 -C "hughn78@users.noreply.github.com"
# press Enter through the prompts

cat ~/.ssh/id_ed25519.pub      # copy the whole line
```

Add it at **https://github.com/settings/keys** → *New SSH key*.

```bash
cd /e/AI/chemistcare
git remote set-url origin git@github.com:hughn78/chemistcare.git
ssh -T git@github.com          # expect: "Hi hughn78! You've successfully authenticated"
git push -u origin prescriberos-clinical-modernisation
```

---

## Then choose where the code lands

Your original sprint brief said *"Create a PR, do NOT auto-merge"* — so:

**A. Branch + PR (recommended, matches the brief):**

```bash
git push -u origin prescriberos-clinical-modernisation
```

Then open **https://github.com/hughn78/chemistcare/pull/new/prescriberos-clinical-modernisation** and create the PR.

**B. Straight onto `main` (only if you're sure):** remote `main` is at exactly your base commit `0f08c37`, so this is a clean fast-forward with no force-push:

```bash
git push origin prescriberos-clinical-modernisation:main
```

---

## Two things to decide before you push

### 1. `.env` is committed, and the repo is public

`.env` is **tracked in git** and **not** in `.gitignore`. It currently holds:

```
VITE_SUPABASE_PROJECT_ID      (real value)
VITE_SUPABASE_PUBLISHABLE_KEY (real value, 210 chars)
VITE_SUPABASE_URL             (real value)
```

Context so you can judge it fairly: `VITE_`-prefixed variables are compiled into the browser bundle anyway, and a Supabase *publishable/anon* key is designed to be public — it is not a password. The real exposure is the **project URL and ID**, which let anyone hit your Supabase endpoint directly (rate-limit / quota abuse). Row Level Security is what actually protects the data, and that is unverified in this codebase.

If you want it gone from git history:

```bash
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "chore: stop tracking .env"
git push
```

⚠️ This removes it going forward but **not** from history — the values stay recoverable in older commits on a public repo. Truly clearing them means rotating the Supabase keys and/or rewriting history.

### 2. Your commits are authored as a placeholder

All 19 new commits are attributed to:

```
Your Name <your-email@example.com>
```

The existing commits on `main` are authored by `gpt-engineer-app[bot]`. If you want your real name on them, set it and rewrite before pushing:

```bash
git config user.name  "Your Real Name"
git config user.email "you@example.com"

git rebase 0f08c37 --exec 'git commit --amend --reset-author --no-edit'
git push -u origin prescriberos-clinical-modernisation
```

---

## After a successful push

```
20 commits · branch prescriberos-clinical-modernisation
3 canonical protocols (UTI, mild acne, atopic dermatitis flare)
146 tests · tsc clean · lint 81 (unchanged baseline) · build OK
```

Verify with:

```bash
git status -sb
```
