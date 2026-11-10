# AH alt text server

A small server (a Cloudflare Worker) that lets the AH Image Resizer ask Claude to write alt text **without putting AH's Anthropic key on a public web page**.

## How it works

1. Someone signs in with Google on the resizer page.
2. The page sends one shrunken image, its file name and the topic to this server, along with proof of the Google sign-in.
3. The server checks the sign-in is genuine and the email is on the approved list.
4. It asks Claude for one sentence of alt text using AH's key, and sends the text back.

The Anthropic key and the approved list are stored as secrets on Cloudflare. They are never in this repo or on the page. Images pass straight through and are not stored.

## One-time setup

You need three things: a Google sign-in client ID, a free Cloudflare account, and an Anthropic API key. Menu names on these sites change, so the wording below may differ slightly from what you see.

### 1. Google sign-in client ID

1. Go to the Google Cloud Console (console.cloud.google.com) and create a project, for example "AH Tools".
2. Open **APIs & Services**, then the **OAuth consent screen**, and fill in the basics (app name "AH Image Resizer", your email).
3. Open **Credentials**, choose **Create credentials**, then **OAuth client ID**, type **Web application**.
4. Under **Authorized JavaScript origins** add `https://alexmaxham.github.io`.
5. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`. It is not a secret.

### 2. Cloudflare

1. Create a free account at cloudflare.com.
2. Open **Workers & Pages**. Note your **Account ID**, and your `workers.dev` subdomain (the page asks you to pick one the first time).
3. Open **My Profile**, then **API Tokens**, choose **Create Token**, and use the **Edit Cloudflare Workers** template. Copy the token.

### 3. Add four secrets to this GitHub repo

In the repo: **Settings**, **Secrets and variables**, **Actions**, **New repository secret**.

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The token from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | The Account ID from step 2 |
| `ANTHROPIC_API_KEY` | AH's Anthropic API key |
| `ALT_ALLOWED_EMAILS` | Who may use it, separated by commas. Full addresses, or `@domain.com` to allow everyone at a domain. Example: `alex@example.com, @androidheadlines.com` |

### 4. Fill in two public settings

- In `wrangler.toml` (this folder): set `GOOGLE_CLIENT_ID` to the client ID from step 1.
- In `../config.js`: set `googleClientId` to the same value, and `altServer` to `https://ah-alt-text.YOUR-SUBDOMAIN.workers.dev`.

Commit those. The "Deploy alt text server" action then publishes the server and sets its secrets, and the Pages deploy updates the page.

### 5. Recommended: cap the spend

In the Anthropic Console, set a monthly spend limit on the key used here. Sign-in keeps strangers out; the cap protects against mistakes by approved people.

## Changing who can use it

Edit the `ALT_ALLOWED_EMAILS` secret in GitHub, then run the "Deploy alt text server" action from the repo's **Actions** tab.

## Working on it

```bash
npm install
npm test          # sign-in checks and Claude handling, against local stand-ins
npm run check     # confirms it bundles for Cloudflare without deploying
npm run deploy    # needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in your shell
```

The model is `claude-opus-5-5` at low effort, with Anthropic's automatic fallback switched on in case a request is declined. Change `MODEL` in `worker.js` to use a different one.
