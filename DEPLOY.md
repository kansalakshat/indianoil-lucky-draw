# Deploying the IndianOil Lucky Draw (Render + WhatsApp)

The app already accepts entries three ways: the **web form**, **SMS**, and **WhatsApp**.
This guide gets it online on Render (free) and connects WhatsApp so real people can send entries.

---

## Step 1 — Put the code on GitHub

The repo is already committed locally. Create an empty repo on GitHub, then:

```bash
git remote add origin https://github.com/<your-username>/indianoil-lucky-draw.git
git branch -M main
git push -u origin main
```

## Step 2 — Deploy on Render (free)

1. Go to https://render.com and sign up (you can log in with GitHub).
2. Click **New → Web Service** and pick your `indianoil-lucky-draw` repo.
3. Render auto-detects the `render.yaml` — just accept:
   - Build command: `npm install`
   - Start command: `npm start`
   - Plan: **Free**
4. Click **Create Web Service**. In ~2 minutes you get a public URL like:
   `https://indianoil-lucky-draw.onrender.com`
5. Test it: open that URL — you should see the entry form. Open `/admin.html` for the admin panel.

> ⚠️ Free-tier note: the app sleeps after ~15 min idle (first request then takes ~30s to wake),
> and its disk resets on redeploy — so entries can be lost when Render restarts the instance.
> Fine for a short/low-stakes draw. For a real campaign, move to a database (ask me).

---

## Step 3 — Connect WhatsApp

Your public webhook base is your Render URL, e.g. `https://indianoil-lucky-draw.onrender.com`.

### Option A — Test today (Twilio WhatsApp sandbox, free)

1. Sign up at https://twilio.com → Messaging → **Try WhatsApp**.
2. In the sandbox settings, set **"When a message comes in"** to:
   `https://<your-app>.onrender.com/webhook/whatsapp`  (method: **POST**)
3. On your phone, send the sandbox **join code** to Twilio's WhatsApp number.
4. Now send: `Akshat Kansal, 9876543210, INV-2201` — you'll get a confirmation reply
   and the entry appears in the admin panel.
   (Testers must join with the code first — that's a sandbox limitation, not the real product.)

### Option B — Real launch (official WhatsApp, Meta Cloud API, free tier)

1. Create a Meta app at https://developers.facebook.com → add **WhatsApp**.
2. Under WhatsApp → **Configuration → Webhook**, set:
   - Callback URL: `https://<your-app>.onrender.com/webhook/meta`
   - Verify token: `indianoil-verify`  (matches `META_VERIFY_TOKEN` in render.yaml)
   - Subscribe to the **messages** field.
3. Get your own WhatsApp business number verified in Meta, and customers can just message it.

---

## Message format people send

Any of these work (phone is optional — the sender's number is used if omitted):

```
Akshat Kansal, 9876543210, INV-2201
Akshat Kansal / 9876543210 / INV2201
Name: Akshat Kansal Phone: 9876543210 Bill: INV2201
```

## Picking a winner

Open `https://<your-app>.onrender.com/admin.html`, review entries, and click **Pick Winner**.
