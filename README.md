# GlobalHire · Python + Flask

GlobalHire is a premium, responsive recruitment platform starter. The site runs from a Python Flask server and stores accounts, profiles, company records, jobs, saved roles, and applications in a local SQLite database.

## Run in PyCharm

1. Install Python 3.10 or newer if PyCharm does not already have an interpreter available.
2. Open the `globalhire` folder in PyCharm.
3. Select a Python interpreter. When PyCharm offers to install the project requirements, choose `requirements.txt`.
4. Open `app.py` and click **Run**. The project also includes the `GlobalHire - Flask + SQLite` run configuration.
5. Open `http://127.0.0.1:5000` in a browser.

The database file `globalhire.db` is created automatically the first time the app starts. The database includes clearly labelled sample jobs and companies for preview.

You can also double-click `start-globalhire.bat` on Windows after Python and Flask are installed.

## What works

- Animated, mobile-ready home page with job search and company directory.
- Separate pages for job search, job details, company details, login, registration, password reset notice, and career resources slides.
- Candidate and recruiter registration with hashed passwords and a signed local session.
- SQLite-backed profiles, saved roles, applications, and recruiter job drafts.
- Candidate dashboard, profile editor, saved jobs, and application tracker.
- Recruiter dashboard and draft job creation.
- Company verification stays pending until an administrator approves it. Pending companies cannot publish jobs.
- Row-level ownership checks in the Python API prevent users from changing another account's profile, jobs, or applications.

## Local administrator account

To create the first administrator, run `create_admin.py` from PyCharm. It asks for a name, email, and password in the Run console. The tool creates an admin account, or promotes and resets the password for an existing account with the same email. Sign in through the site and open `/admin` to review recruiter companies and listings.

## Important notes

- Sample companies, salaries, opportunities, and dashboard figures are illustrative. They are not verified employers or real vacancies.
- Password reset email is not enabled in this local project because no mail provider was configured. The form explains this.
- This project is set up for local development. Before deployment, configure a unique `GLOBALHIRE_SECRET`, HTTPS cookie settings, production hosting, backups, email verification, and administrator review tools.
- The browser UI is prebuilt in `dist/`. To edit the React interface, install Node.js, run `npm install`, edit `src/`, then run `npm run build`. Python-only users can run the existing UI without Node.js.
