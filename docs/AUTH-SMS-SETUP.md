# Google Sign-In + SMS (Twilio/DLT) — setup guide

Project-specific values used throughout:

| Thing | Value |
|---|---|
| Supabase project ref | `shxzwcdcwijtpilmgowo` |
| **Supabase OAuth callback** (goes in Google Cloud) | `https://shxzwcdcwijtpilmgowo.supabase.co/auth/v1/callback` |
| **App auth callback** (goes in Supabase) | `https://vivasvana.vercel.app/auth/callback` |
| Site URL | `https://vivasvana.vercel.app` |

> The two callbacks are **different** and are the #1 thing people mix up.
> Google redirects to **Supabase**; Supabase redirects to **your app**.

---

# Part 1 — Google Sign-In ("Gmail OAuth")

Time: ~20 minutes. No DLT, no cost.

## Step 1.1 — Google Cloud: create the project + consent screen

1. Go to <https://console.cloud.google.com> → create (or pick) a project, e.g. `Vivasvana`.
2. **APIs & Services → OAuth consent screen**
   - **User type:** External → Create
   - **App name:** `Vivasvana`
   - **User support email:** your email
   - **App logo:** optional (shows on the Google consent dialog)
   - **Authorized domains:** add `supabase.co` and `vercel.app`
     (add `vivasvana.com` too once you move to the custom domain)
   - **Developer contact email:** your email
3. **Scopes:** keep the defaults — `openid`, `email`, `profile`. Do **not** add
   sensitive scopes; you don't need Gmail read access, only identity.
   Because these are non-sensitive, **Google verification is NOT required**.
4. **Publish app.** If you leave it in *Testing*, only the ~100 test users you
   explicitly list can sign in.

## Step 1.2 — Google Cloud: create the OAuth client

**APIs & Services → Credentials → Create Credentials → OAuth client ID**

- **Application type:** Web application
- **Name:** `Vivasvana Web`
- **Authorized JavaScript origins:**
  - `https://vivasvana.vercel.app`
  - `http://localhost:3000`
- **Authorized redirect URIs:** ← the critical one
  - `https://shxzwcdcwijtpilmgowo.supabase.co/auth/v1/callback`

Click **Create** and copy the **Client ID** and **Client Secret**.

> Note: the redirect URI is **Supabase's**, not your app's. Google → Supabase →
> your `/auth/callback`. If you put your app's URL here you'll get
> `redirect_uri_mismatch`.

## Step 1.3 — Supabase: enable the Google provider

**Supabase Dashboard → Authentication → Providers → Google**

- Toggle **Enable**
- Paste **Client ID** and **Client Secret** → **Save**

## Step 1.4 — Supabase: allowlist the app callback

**Authentication → URL Configuration**

- **Site URL:** `https://vivasvana.vercel.app`
- **Redirect URLs** — add both:
  - `https://vivasvana.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

> This same allowlist is what makes **password reset** work, since the recovery
> email link also lands on `/auth/callback`.

## Step 1.5 — Turn the button on

The "Continue with Google" button is behind a feature flag so a broken button
never reaches live customers. Set in Vercel (Production + Preview):

```
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

…then redeploy. (Ask Claude to do this — it can set the env var and deploy.)

## Step 1.6 — Test

1. Open `https://vivasvana.vercel.app/account/login`
2. Click **Continue with Google** → pick an account
3. You should land on `/account`, signed in, with any guest cart merged.

**Troubleshooting**

| Symptom | Cause |
|---|---|
| `redirect_uri_mismatch` | Google's redirect URI must be the **Supabase** callback |
| Redirected to `/account/login?error=auth` | App callback URL not in Supabase's Redirect URLs allowlist |
| "Access blocked: app not verified" | Consent screen still in *Testing* — publish it |
| Button not visible | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` not `true`, or not redeployed |

---

# Part 2 — SMS (Twilio + India DLT)

Time: **1–2 weeks**, mostly DLT paperwork. Cost: ~₹5,000 one-time DLT + ~₹0.12–0.25/SMS.

## ⚠️ Do this FIRST: lock your production domain

Your SMS bodies embed the site URL:

```
Track: ${SITE}/orders        // SITE = NEXT_PUBLIC_SITE_URL, minus scheme
```

Today that renders `vivasvana.vercel.app/orders`. DLT requires the sent body to
**exactly match** the registered template. If you register templates with
`vercel.app` and later switch to `vivasvana.com`, **every SMS will fail**.

**Decide the domain, point `NEXT_PUBLIC_SITE_URL` at it, and only then register
DLT templates.**

## ⚠️ Fix the variable-shape templates before registering

DLT matches templates strictly. These two currently change shape at runtime:

- **Shipped:** `... shipped via {carrier} (AWB {n})` — the `via …` and `(AWB …)`
  segments disappear when carrier/AWB are null → template mismatch.
- **OTP:** the word `account` vs `order` varies — fine if registered as a
  `{#var#}`, but confirm your DLT portal allows a variable there.

Make the shipped body a fixed shape (always include both fields, or register two
separate templates). Ask Claude to patch `lib/server/sms/templates.ts`.

## Step 2.1 — Twilio account

1. Sign up at <https://twilio.com> and verify your email/phone.
2. **Console dashboard** → copy **Account SID** (`AC…`) and **Auth Token**.

## Step 2.2 — DLT registration (the long pole)

India's TRAI rules require every commercial sender to register on a DLT portal.
Registering with **one** operator propagates to all.

Pick one portal: **Vilpower (Jio)**, **Airtel DLT**, **Vodafone-Idea**, or **BSNL**.

1. **Register the Principal Entity (your business)**
   - Documents: GST certificate or company PAN, authorized-signatory ID,
     letter of authorization on letterhead.
   - Fee: ~₹5,000 one-time.
   - Output: **Principal Entity ID (PE ID)** — a 19-digit number.
   - Turnaround: ~2–5 business days.

2. **Register the Header (Sender ID)**
   - 6 alphanumeric characters, e.g. `VIVSVN`.
   - Category: **Transactional / Service-Implicit** (OTP + order updates).
     *Not* Promotional — promotional traffic is DND-scrubbed and needs consent.
   - Turnaround: ~1–3 days.

3. **Register content templates** — one per message, with `{#var#}` placeholders.
   Register all five (copy exactly, then substitute your final domain):

   ```
   Vivasvana: {#var#} is your {#var#} verification code. Valid {#var#} min. Do not share.

   Vivasvana: Order {#var#} confirmed. Total Rs. {#var#}. Delivery 3-5 days. Track: vivasvana.com/orders. Thanks!

   Vivasvana: Order {#var#} shipped via {#var#} (AWB {#var#}). Track: vivasvana.com/orders

   Vivasvana: Order {#var#} delivered. Loved it? Reorder at vivasvana.com. Thanks!

   Vivasvana: Order {#var#} cancelled. Refund processed if paid. Help: hello@vivasvana.com
   ```

   Each approved template yields a **Template ID**. Turnaround: ~1–2 days.

> URLs inside SMS often must also be whitelisted on the DLT portal. Add
> `vivasvana.com` (or your final domain) to the allowed URL/entity list.

## Step 2.3 — Twilio India compliance

1. **Twilio Console → Messaging → Regulatory Compliance → India**
   Submit your **PE ID**, **Sender ID (header)**, and **Template IDs**.
   Twilio links them to your account.
2. **Buy a sender**: either an Indian long code / short code, or register your
   DLT alphanumeric Sender ID with Twilio.
3. **Create a Messaging Service**
   **Messaging → Services → Create Messaging Service** → add your sender to the
   pool → copy the **Messaging Service SID** (`MG…`).

> **Why a Messaging Service?** Our `sms.ts` prefers `TWILIO_MESSAGING_SERVICE_SID`
> over a bare `from:` number *precisely because* Twilio then performs the India
> DLT template lookup and attaches the entity/template IDs for you. **No code
> change is needed** to pass DLT IDs.

## Step 2.4 — Environment variables

Set in Vercel (Production + Preview). SMS is in console-log stub mode until
`ACCOUNT_SID` + `AUTH_TOKEN` are both present — no code toggle required.

```
TWILIO_ACCOUNT_SID=AC........................
TWILIO_AUTH_TOKEN=..........................
TWILIO_MESSAGING_SERVICE_SID=MG............   # preferred (enables DLT lookup)
# TWILIO_FROM_NUMBER=+1...                    # only for dev / non-India routes
```

If you set neither `TWILIO_MESSAGING_SERVICE_SID` nor `TWILIO_FROM_NUMBER`,
`sendSms()` throws on purpose so the misconfiguration is loud at deploy time.

## Step 2.5 — Test

- **Non-India number** works immediately once SID+token are set (no DLT).
- **India number** works only after DLT approval + Messaging Service.
- Trigger: sign up with a phone number, or place an order (order-confirmation SMS).
- Watch **Twilio Console → Monitor → Logs → Messaging** for delivery/error codes.

**Common Twilio India error codes**

| Code | Meaning |
|---|---|
| `30032` | Toll-free/sender not verified |
| `30450`/`30451` | DLT template mismatch — body doesn't match a registered template |
| `21612` | Sender can't reach that destination (missing India sender) |
| `30007` | Carrier filtered (DLT/DND issue) |

---

# Sequencing recommendation

1. **Today:** Part 1 (Google) — ~20 min, unblocks the biggest UX win.
2. **Today:** Supabase URL config also switches on **password reset**.
3. **Today:** decide the production domain; fix the shipped-SMS template shape.
4. **This week:** start DLT registration (Part 2, Steps 2.2) — it's the long pole.
5. **When DLT clears:** Twilio compliance + Messaging Service + env vars → SMS
   and phone-OTP login go live with no further code changes.