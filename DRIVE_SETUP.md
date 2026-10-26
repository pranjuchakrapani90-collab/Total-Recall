# Google Drive storage for Travel Trace — one-time setup

Travel Trace saves finished GPS days and memory photos in your Google Drive, in
**Pranju OS › Travel Trace › GPS archive** and **› Memory photos**. The Worker keeps the Google
connection, so phones never see a sign-in popup after the first Connect.

The app only gets the `drive.file` permission: it can see and change **only the files it created**,
nothing else in your Drive.

## 1. Google Cloud (about 10 minutes, once)

1. Open <https://console.cloud.google.com> and create a project, e.g. **Pranju OS**.
2. **APIs & Services → Library** → search **Google Drive API** → **Enable**.
3. **Google Auth Platform** (OAuth consent screen) → **Get started**:
   app name *Pranju OS*, your Gmail as support and contact email, audience **External**.
4. **Data access → Add or remove scopes** → tick `.../auth/drive.file` → Save.
5. **Audience → Publish app** (status *In production*). Leave it in *Testing* and Google
   cuts the connection every 7 days.
6. **Clients → Create client** → type **Web application** → under
   **Authorized redirect URIs** add exactly:
   `https://total-recall-ticktick.pranjuchakrapani90.workers.dev/drive-callback`
   → Create. Copy the **Client ID** and **Client secret**.

## 2. Cloudflare Worker

Cloudflare dashboard → Workers → **total-recall-ticktick** → Settings → **Variables and Secrets** → Add,
type **Secret**, for both:

- `GOOGLE_CLIENT_ID` = the Client ID
- `GOOGLE_CLIENT_SECRET` = the Client secret

## 3. Connect

Pranju OS → Travel Trace → **Google Drive** → **Connect Google Drive** → choose your account.
Google may say the app isn't verified: tap **Advanced → Go to Pranju OS** (it's your own app).

You land back in Travel Trace. Older GPS days are moved from the Worker into Drive (and removed from
the Worker), new finished days go straight to Drive, and photos you add to a memory upload on their own.
Every device uses the same connection.
