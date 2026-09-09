# Update your existing GHS Mbonjo website

You do not need a terminal. Keep your existing Supabase project, accounts and Vercel project.

## 1. Fix the login error now

Open Vercel → your project → Settings → Environment Variables.
Find APP_ORIGIN and set its Production value to:

https://ghs-mbonjo-app.vercel.app

Save. Open Deployments → the latest production deployment → three-dot menu → Redeploy.
Open the school website again. This fixes the displayed “Untrusted request origin” error when the setting was missing or different. It does not change your email or password.

## 2. Install this update

1. Unzip this package on your computer.
2. Open your existing private GitHub repository. Choose Add file → Upload files.
3. Drag the CONTENTS of the website folder into the repository root, replacing existing files. Keep api, src, public and supabase as folders. Do not upload the ZIP itself or the enclosing website folder. Commit changes.
4. In Supabase → SQL Editor, paste the contents of website/supabase/update-002.sql and click Run. This adds the one-active-bursar rule without resetting records. Do not rerun schema.sql on your existing database.
5. Vercel deploys the GitHub update automatically. Wait for Ready, then reopen the website. If an installed app still shows the old version, close every app window and reopen it.

Keep all existing environment variables. Never put keys or private-imports into public website files. If the GitHub repository is already linked, there is no need to create another project.

## 3. Install on a phone or computer

Open the deployed HTTPS website and select “Install app / Installer”.

- Android, Windows or Linux: use Chrome or Edge and confirm installation. If no prompt appears, use the browser menu → Install app or Add to Home screen.
- iPhone or iPad: open Safari → Share → Add to Home Screen.
- Other desktop browsers: use their installation option if available, or open the website normally.

The icon opens the same school website. Login and school records require internet access. Private responses, passwords and documents are not placed in the offline cache.

## What changed

- Multiple VP, SDM, DM and HOD appointments. Only one active bursar, enforced in the database. End the existing bursar appointment before appointing another.
- Expanded bilingual staff-post catalogue, with official core services separated from optional school duties and support jobs.
- Your writing rules automatically guide AI drafts. Principal, VPs and HODs have access.
- Department/contact selection opens WhatsApp with the reviewed message. You press Send in WhatsApp. No WhatsApp API is needed.
- Word (.docx), PDF and direct printing for attestations and AI letters. Bulk attestation exports include verification QR codes.
- Principal-only encrypted backup download to the PC. Keep the backup password. It exports records and audit entries, not Auth passwords, AI keys or hosting settings. Pause editing during export. Automated database restoration is not included.
- Browser installation and safer origin matching for configured Vercel domains.

For a brand-new deployment, follow website/README.md, starting at “Browser-only setup”. For the existing deployment, use only the steps above.
