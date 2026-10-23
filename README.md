# Reps

A workout log for two. It remembers what you lifted last time, tells you when to go heavier, and lets you and your training partner see each other's progress. It runs on the phone and works offline at the gym.

- **Last time, on every set.** Each set shows last session's weight and reps, and the weight is filled in for you. Change it on one set and the sets after it follow, or nudge it with − and +. Tick a set when it's done.
- **Cardio with level or incline.** Log minutes plus the treadmill incline or machine level, filled in from last time.
- **Form tips.** Tap **Form tips** on an exercise to see what it is and the PT's cues for it.
- **Starting weights.** Paste a starting-weights code in **More**, or set them one by one in **Plan > Edit**. They're used until you first log the exercise, and stay on your phone and in your shared sheet, not in this repo.
- **Rest timer.** Ticking a set starts the rest timer for that exercise, with a beep and buzz when it's time. Supersets rest only after both exercises.
- **When to go heavier.** Once you hit the top of the rep range on every set, the exercise shows a suggested next weight. For assisted pull-ups it suggests less assistance.
- **Progress.** Every exercise gets a chart (heaviest weight, estimated 1-rep max or volume), and finished workouts count new bests. Weeks on target track your weekly goal.
- **Train together on one phone.** Add your partner in **More > People on this phone**. You follow the same workout, each with your own set table, weights, history and progress. Rest starts once you've both done the set.
- **Or on separate phones.** A small Google script keeps a shared copy, so you can see each other's workouts, plans and charts side by side.
- **Your plan.** Starts with Workout A and Workout B, which take turns. Change exercises, sets, rep ranges, rest times and supersets in **Plan**.
- **Body weight, if you like.** Log it in **Progress**. It stays on your phone unless you choose to share it.

## Put it online (GitHub Pages, free)

1. In this repository, go to **Settings > Pages**.
2. Set Source to **Deploy from a branch**, Branch to **main** and folder **/ (root)**. Save.
3. After a minute the site is live at `https://2pfbm6hm2y-debug.github.io/Reps/`.

The repo holds only the app. Your workouts are never in it.

## Install on your iPhone

1. Open that address in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it once from the new icon while online. After that it works offline.

Always open it from the home-screen icon. Its data is kept separately from Safari.

## Train together

One of you sets it up once in **More > Train together**:

1. Tap **Copy setup script**. It includes a private key.
2. Paste it into a new project at [script.google.com](https://script.google.com), replacing what's there. On iPhone, open it in Safari and tap **aA > Request Desktop Website** first.
3. **Deploy > New deployment >** the gear **> Web app**. Execute as **Me**, Who has access **Anyone**. Deploy, and allow access when Google asks. Google warns the app isn't verified because you made it: tap **Advanced > Go to the project > Allow**.
4. Paste the **Web app URL** back into Reps and tap **Connect**.
5. Tap **Share invite code** and send it to your partner.

Your partner installs Reps the same way, taps **Join instead** on the first screen and pastes the code. They get their own copy of Workout A and B to change as they like.

The script creates a Google Sheet called **Reps data** in the account that set it up. Each phone sends its changes and picks up the other's whenever it opens, after each change, and every minute or two while open. Without internet it keeps working and catches up later.

Anyone with the invite code can read and add to your shared log, so only send it to your partner.

## Your data

Everything is stored on the phone, and in the shared sheet if you turned on Train together. Use **More > Back up now** from time to time and save the file to Files or iCloud Drive. **Restore backup** brings it back on a new phone. On a new phone you can also join with the invite code and pick yourself.

## Updating

Push changed files to this repository. The app picks up the new version the next time it opens while online. If you change `sync.gs`, paste it over the old script and deploy a new version (**Deploy > Manage deployments > Edit > New version**) so the Web app URL stays the same.
