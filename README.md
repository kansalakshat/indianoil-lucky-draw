# IndianOil Lucky Draw
live link :- https://indianoil-lucky-draw.onrender.com/admin.html
whatsapp :- +14155238886   to register
Collect participant entries (Name, Phone, Bill No.) via **web form, SMS, or WhatsApp**,
view them on an **admin dashboard**, and click **Find Winner** to pick a random participant.

## Run it

```bash
cd indianoil-lucky-draw
npm install
npm start
```

Then open:
- **Entry form:**  http://localhost:3000/
- **Admin dashboard:**  http://localhost:3000/admin.html  ← the "Find Winner" button lives here

Data is stored in `data/entries.json` (created automatically).

## How people enter

Any of these register one entry:

1. **Web form** — fill Name / Phone / Bill on the home page.
2. **SMS / WhatsApp message** in the format:
   ```
   Akshat Kansal, 9876543210, INV-2201
   ```
   Labelled form also works: `Name: Akshat Kansal Phone: 9876543210 Bill: INV-2201`

Duplicate (same phone + same bill) entries are rejected automatically.

## Connecting real SMS / WhatsApp

The server already exposes webhooks — you just point a provider at them.
Use a tunnel (e.g. `ngrok http 3000`) to get a public HTTPS URL during testing.

| Provider | Set webhook URL to |
|----------|--------------------|
| **Twilio SMS** | `https://<your-url>/webhook/sms` |
| **Twilio WhatsApp** | `https://<your-url>/webhook/whatsapp` |
| **Meta WhatsApp Cloud API** | `https://<your-url>/webhook/meta` (verify token: `indianoil-verify`, override with `META_VERIFY_TOKEN`) |

Twilio replies to the sender with a confirmation automatically (TwiML).

## API reference

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/entries` | Add entry `{name, phone, bill}` |
| GET  | `/api/entries` | List all entries |
| DELETE | `/api/entries/:id` | Remove an entry |
| POST | `/api/winner` | Pick + record a random winner |
| GET  | `/api/winners` | Winner history |

Random selection uses `crypto.randomInt` for a fair, unbiased draw.
