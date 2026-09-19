# Update the working school website

No terminal commands are needed.

## This update: students can now sign in

Students were seeing **"Student matricule access has not yet been enabled by the school."** That block has been removed.

Students now sign in with **their matricule and their own date of birth**. Both must match the school register. There is nothing to switch on in Vercel: upload this update (step 2 below) and student sign-in works.

Why the date of birth is asked for: a matricule is printed on report cards and known to classmates, so a matricule on its own would let one student sign in as another and read their marks. The date of birth is the second factor that stops that. All 92 students in the supplied register already have one, so there is nothing to enter.

The old `ALLOW_MATRICULE_LOGIN` setting is no longer used. You may delete it from Vercel → Settings → Environment Variables; leaving it there changes nothing. **No SQL is needed for this fix**, and no other environment variable changes.

If a student is told their record has no date of birth, open **Principal → Students**, choose their class and name, add the date, and they can sign in at once.

## Steps

1. Open Supabase → SQL Editor → New query. Paste website/supabase/update-003.sql and click Run. Keep the existing database. Do not rerun schema.sql. If you never applied update-002.sql, apply that older update first.
2. Unzip this package. Open the existing GitHub repository → Add file → Upload files. Upload the CONTENTS of website/ at the repository root, replacing the existing files. Commit the change. Keep the repository private because api/data/students.json contains student records.
3. Wait for Vercel to show Ready. Close the school website and installed app, reopen, and refresh. Keep your existing environment variables.
4. Test the student sign-in: open the portal, choose **Student**, enter one student's matricule and that student's date of birth. A wrong date must be refused.

## Where to find the new features

Principal → Classes & subjects: add classes, set compulsory subjects, add subjects, and import the supplied Form Five students. Form 2A and Form 2B are already available. Select extra subjects in each student profile. Stream suggestions are editable, not compulsory national combinations. Confirm Sixth Form combinations from the school's register.

The uploaded CSV has 92 rows: 56 Form 5A and 36 Form 5B. It does not identify these students as Form Two. 87 have unique matricules and are ready for import. Five have no matricule. The import result shows them for completion. 63 birthplaces are missing and remain blank. Repeating the import skips matching existing matricules and flags conflicting names.

Principal → Students: choose a class, then choose the student's name. Use Change student status or class to transfer, promote, demote, dismiss, or reinstate. The record and movement history remain available.

Principal → Marks & report cards: select the academic year and class, then Load marks. Draft and published marks are shown. Publish checked marks before generating report cards or the master result sheet. Use the output selector for either format. Individual cards use A4. The wide master sheet uses A3 landscape. Use Print → Save as PDF to download reports.

Teachers → Document requests: request an attestation or employment confirmation. Principal → Document requests: prepare, issue or decline it. Principal → School documents also includes official letters, circulars, invitations, announcements, permissions and recommendations on the school letterhead.

Teachers → Learning centre: type notes or attach a PDF under 2 MB. Teachers belong to a department and must have a matching subject/class assignment. The HOD reviews their own department's resources. Add questions to a quiz/test and set its duration. MCQ and true/false are auto-scored. Written answers are marked by the teacher. These assessment scores are separate from official sequence marks and must be reviewed and entered in Marks before report publication.

Principal → AI settings: select Gemini, Grok, Groq, OpenRouter, Cerebras, SambaNova or Hugging Face, then paste the API key. There is no model field. Free allowances depend on the provider and account. OpenRouter uses its free-model router. Other providers may charge after credits or free allowances are exhausted.

## Documents and fonts

Outfit is bundled for the interface. Tinos regular and bold are bundled for school documents and embedded in PDF/Word exports. Tinos is a freely redistributable Times-compatible font, not Microsoft's Times New Roman. The package does not require access to fonts installed on a computer. Font licences are in public/fonts/.

Verification links are encoded inside the QR code. No visible verification URL is printed. The caption sits below the QR. Disable Headers and footers in browser print settings if the browser adds its own website address. Direct attestation PDF export does not add a browser address.

## Data still needed

student-scores-export-academia.xls is an HTML web-export wrapper pointing to a missing student-scores-export-academia_files/sheet001.htm. It contains no score table to import. Upload a genuine .xlsx export or the complete accompanying folder. No scores or Sixth Form combinations were invented from that file.

The supplied report's Grade and Rank headings were reversed relative to their values. This update puts letter grades under Grade and numeric positions under Rank. Teachers enter letter grades under the school's policy. Unconfirmed pass thresholds, annual weighting and promotion decisions are not calculated automatically.

## Checks before school-wide use

Read AUDIT.md for the completed checks and remaining live checks. This ZIP has not been deployed to your accounts. Test one teacher request, one HOD approval, one student test and one printed report after deployment. The browser preview infrastructure was unavailable during this update.

Install on Android/computer from Chrome or Edge → Install app. On iPhone use Safari → Share → Add to Home Screen. Login, assessments and private records require internet.
