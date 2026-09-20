# Update the working school website

No terminal commands are needed.

## This update: Form 5, and importing a sheet from its PDF

**Computer Science Form 5 is now included**, so all nine sheets ship with the app: Computer Science Forms 1 to 5 and Lower and Upper Sixth, and ICT Lower and Upper Sixth — 901 lessons in total.

**A progression sheet can now be imported straight from its PDF.** *Import a sheet* accepts the PDF itself, in the national format — the same format as the Computer Science and ICT sheets. Excel and CSV still work as before.

The app reads the table out of the PDF: the lesson numbers, titles, objectives, weeks and terms. Both layouts are handled — the Form 1 to 5 sheets, which print the number inside the title as "Lesson 6:", and the Sixth Form sheets, which give the number a column of its own.

**Nothing is saved until you have looked at it.** The import shows how many lessons it found, how many are numbered, how many have objectives, which terms and weeks they span, and the first dozen lessons in a table. Check those against your sheet, then choose *Save this scheme*. A progression sheet is a record, and importing the wrong thing quietly would be worse than not importing at all.

A scanned sheet — a photograph of paper rather than a PDF with real text in it — cannot be read this way, and the app says so rather than importing nothing. Reading a nine-page sheet takes about ten seconds.

## Previous update: the department office

**This update needs SQL.** Run `website/supabase/update-004.sql` in the Supabase SQL Editor before uploading the files — it adds four new record types. Everything else is unchanged.

A head of department now has their own working area under **My department**, and every member of staff has **Messages**.

**Documents.** Write a document, or send an AI draft straight to the department library with *Save to my department* on the AI writing page. Papers are filed as Reports, Minutes, Letters or Notes. The head of department signs a document with their own signature image — upload it once under **My profile → Signature** — and it then appears on the document on screen and in print, on the school letterhead.

**Transmitting.** A document stays inside the department until the head of department transmits it. Only then can the principal and vice principal read it. A document must be signed before it can be transmitted, so nothing reaches the administration that nobody has stood behind. Transmitted papers also appear in the PC backup; untransmitted ones do not.

**Equipment.** The department's computers, printers, projectors and so on, with quantity, condition, location and serial number. **The administration can always see this list** — it is the record of what the department answers for. Only the head of department edits it.

**Messages.** Every member of staff gets a running thread with their whole department, plus direct notes to any colleague. The principal is not a member of other people's threads and does not see them in the portal.

Be clear with your staff about what that means: **these messages are not encrypted.** Whoever holds the Supabase password can read them in the database directly, and the messages page says so on screen. It keeps conversations out of the principal's screens; it is not a guarantee of secrecy.

**Progression and coverage.** Eight progression sheets are built in — Computer Science Forms 1 to 4, Computer Science Lower and Upper Sixth, and ICT Lower and Upper Sixth — with 785 lessons between them, taken from the 2026-2027 sheets. Choose *Track a scheme*, say which week the school is in, and tick lessons as they are taught. The dashboard then shows what has been covered, what the sheet expects by now, and how many lessons behind the subject is.

Other departments use **Import a sheet**: an Excel or CSV file with a heading row containing at least a *Lesson title* column. *Term*, *Week*, *Module*, *Category of action*, *Lesson no* and *Objectives* are used when present, and the term is worked out from the week if it is not given.

**Ask the AI** reads the coverage figures and writes a short note on what to prioritise. It is sent only lesson titles, weeks and counts — never a student's name or any personal data — and the note is saved with the scheme.

## Previous update: analytics

A new **Analytics** tab. Choose a period, then read what the records actually say. Figures cover only the classes you are allowed to see: the principal and VP see the whole school, a teacher or head of department sees their own classes, and discipline staff see attendance.

**Attendance** — the rate overall and by class, week by week, by day of the week and by period of the day, with a girls-and-boys split. A dashed line marks the 80% target and anything below it is flagged.

**Watchlist** — the students who have fallen below the target, worst first, with their absences and lateness. A student with only a lesson or two on record is left out, because one absence out of two lessons is 50% and means nothing.

**Results** — average and pass rate per subject and per class, the spread of marks across bands, and progress across the sequences. Only published marks are counted; a draft is a teacher's working note, not a result.

**Roll-call coverage** — how many of the timetabled lessons actually had a register taken, by class and by teacher. Read this first: without it, a class nobody records looks exactly like a class with perfect attendance.

Two rules run through all of it. A missing record is never counted as a zero — a class with no roll call shows "no records", not 0%, and a blank mark is not a fail. And school days are inferred from the register rather than assumed: a weekday on which nobody anywhere took a roll call is treated as a holiday, so the school is never marked down for not teaching at Christmas. The trade-off is that a day the whole school forgot the register is invisible, which the tab says on the page.

Use **Print** for a paper copy. No SQL and no new environment variables — the tab reads records that are already there.

## Previous update: timetable preferences

Principal → Timetable now opens with a **Timetable preferences** panel. Set the rules, then generate. Whatever you used is saved with the timetable and reopens here next time, so you are never starting from scratch.

**School-wide**

| Setting | Default | What it does |
|---|---|---|
| Form 5 closing time | 14:40 | 14:40 or 16:00 |
| Latest period used | 10 | Stop lessons after period 6, 8 or any period. Forms 1 to 4 already close at 14:40, so periods 9 and 10 only ever apply to Form 5 on the 16:00 setting and to Sixth Form |
| Most periods of one subject a class may have in a day | 2 | 2 allows one double. Set to 1 and that subject is taught in single periods only |
| Most periods of one subject a class may have in a week | 10 | A guard against a mistyped assignment |
| Most periods a teacher may teach in a day | 8 | A Form 1 to 4 day is 8 periods. Lowering it spreads a teacher over more days |
| Most days a teacher comes to school | 5 | The school-wide ceiling |

**Per subject** — one row for each subject in the assignments: blocks (Automatic, Doubles, Singles only), a Morning tick, and its own daily limit. Singles only suits Physical Education or Manual Labour. Morning is a preference, not a rule: a full week places the subject later rather than failing.

**Per teacher** — one row for each teacher with assignments: tick the days they cannot come at all, and optionally their own maximum days and maximum periods a day. Leave the numbers empty to follow the school-wide setting.

Everything is re-checked on the server, so the limits hold whatever the browser sends.

If a combination cannot be met, the timetable is refused with a message naming the cause — for example *"One teacher is assigned 36 periods a week, but the preferences leave room for only 30 (5 days at up to 6 periods). Share that workload, allow more days, or raise the daily limit."* The existing timetable is left untouched until a new one succeeds.

**Reset to defaults** puts the panel back without saving; nothing changes for the school until you press Generate.

## Previous update: timetables

The Timetable tab did not open at all — it called a function that was never finished. It works now, and the generator has been rewritten around the teachers.

**Two printed sheets**, both laid out like the ones the school already uses:

- **One page per class**, with the crest, the class name, the ten periods with their times, the BREAK column and the HOD's signature line. Double periods print as one wide box.
- **One sheet per teacher**, with the day names down the side and the subject totals and Lessons/week panel beside the grid.

Principal → Timetable: choose a class or a teacher to see the sheet, then **Print this class**, **Print all classes**, **Print this teacher** or **Print all teachers**. Use Print → Save as PDF for a file. Teachers and HODs see their own sheet first when they open the tab, and HODs can look up any teacher. Students see their class sheet.

**The generator now works for the teachers, not just against the clashes:**

- Lessons are placed in **doubles** wherever the weekly count allows, so four periods with one class become two double periods rather than four scattered singles. An odd count leaves one single.
- Each teacher's periods are pulled onto **as few days as possible**, and grouped to run on from one another so they are not sitting through free periods between lessons. On the school-sized test load, teachers averaged 3.7 days in school a week instead of 4.9, and only 2 of 30 had to come in all five days instead of 28 of 30.
- A class never meets the same subject twice in a day beyond one double, and no double is split across the break.
- If a class or a teacher is assigned more periods than the week holds, the message now names them and the number, instead of searching for an impossible timetable.

Nothing about this needs SQL or new environment variables. Regenerate from Principal → Timetable after uploading.

## Previous update: students can now sign in

Students were seeing **"Student matricule access has not yet been enabled by the school."** That block has been removed.

Students now sign in with **their matricule and their own date of birth**. Both must match the school register. There is nothing to switch on in Vercel: upload this update (step 2 below) and student sign-in works.

Why the date of birth is asked for: a matricule is printed on report cards and known to classmates, so a matricule on its own would let one student sign in as another and read their marks. The date of birth is the second factor that stops that. All 92 students in the supplied register already have one, so there is nothing to enter.

The old `ALLOW_MATRICULE_LOGIN` setting is no longer used. You may delete it from Vercel → Settings → Environment Variables; leaving it there changes nothing. **No SQL is needed for this fix**, and no other environment variable changes.

If a student is told their record has no date of birth, open **Principal → Students**, choose their class and name, add the date, and they can sign in at once.

## Steps

1. Open Supabase → SQL Editor → New query. Paste website/supabase/update-004.sql and click Run. If you have never applied update-003.sql, run that one first, then update-004.sql.
1b. (Older deployments only) Paste website/supabase/update-003.sql and click Run. Keep the existing database. Do not rerun schema.sql. If you never applied update-002.sql, apply that older update first.
2. Unzip this package. Open the existing GitHub repository → Add file → Upload files. Upload the CONTENTS of website/ at the repository root, replacing the existing files. Commit the change. Keep the repository private because api/data/students.json contains student records.
3. Wait for Vercel to show Ready. Close the school website and installed app, reopen, and refresh. Keep your existing environment variables.
4. Test the student sign-in: open the portal, choose **Student**, enter one student's matricule and that student's date of birth. A wrong date must be refused.
5. Open Analytics, choose a period of a few weeks and check the figures against what you know. Roll-call coverage tells you how far to trust the rest.
6. Open Principal → Timetable. Set the preferences — closing time, latest period, the per-subject and per-teacher rows — then generate. Check one class sheet and one teacher sheet before printing for the school.

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
