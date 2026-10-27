# Habit App

A personal habit tracker that turns your daily habits into points you can spend on rewards. It's a static web app (PWA) that installs to your iPhone home screen or runs in any laptop browser, and it syncs between devices through a private GitHub repo.

- **Live app:** https://karsmars.github.io/habit-app/
- **App code (public):** https://github.com/karsmars/habit-app

## Use the app with your own private data

The hosted app is shared, but each person connects it to their **own** private GitHub repository. Your habits, rewards, and access token are not included in the public app repository.

1. **Create a private data repository.** On GitHub, create a repository under your account, set it to **Private**, and initialize it with a README. In that repository, create `data.json` with this empty starting data, then commit it:

   ```json
   {"version":1,"goals":[],"completions":[],"rewards":[],"purchases":[]}
   ```

2. **Create a fine-grained personal access token (PAT).** In GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Give the token a name, choose an expiration, and under **Repository access** select **Only select repositories** and choose the private data repository you just created. Under **Repository permissions**, grant **Contents: Read and write**. GitHub adds Metadata read-only automatically. Generate the token and save it in your password manager; GitHub only shows it once.

3. **Connect this device.** Open the [hosted app](https://karsmars.github.io/habit-app/), open **Settings**, and enter your GitHub username as **Repository owner**, your private repository name as **Repository name**, and `data.json` as **Data file path**. Paste your PAT, choose **Save settings**, then **Test connection**. Your token is stored only in this browser's local storage; it is not part of the app code or data file.

4. **Repeat on each device.** Open the app and enter the same repository details and PAT on your laptop. On iPhone, open the app in Safari, choose **Share → Add to Home Screen**, then open the installed app and configure Settings there. The installed iPhone app has separate storage from Safari, so configure it separately. You can create a separate PAT for each device and revoke them independently.

> **Keep your PAT private.** Never paste it into source code, a public or private issue, or a chat. Use a token limited to just your data repository. If a device is lost, revoke that device's token in GitHub settings.

## Features

- **Today:** a checklist of your habits. Tap to complete one and earn its points. You can also go back to previous days to fill in or correct entries.
- **Progress:** your balance, lifetime points earned and spent, current and best streaks, a points-per-day chart, and per-habit completion rates.
- **Calendar:** a month view where each day is color-coded by points earned. Filter by habit to see which days you did it.
- **Shop:** rewards you can buy with your points, with a progress bar toward the ones you can't afford yet and a purchase history with undo.
- **Themes:** four built-in color schemes, selectable in Settings.
- **Sync:** use it on your phone and laptop with the same data. It works offline and syncs when you're back online.
- **Backup:** export and import your data as a JSON file.

## How it works

| Piece | What it is |
|---|---|
| Frontend | Plain HTML, CSS, and JavaScript with no build step, hosted free on GitHub Pages |
| Database | One file, `data.json`, in the private repository you configure in Settings, read and written through the GitHub API |
| Auth | A fine-grained personal access token limited to the data repo, stored only in your device's browser storage |
| Offline | A service worker caches the app, and a local cache holds your data until it can sync |

Every save is a commit in the data repo, so you get a full version history and can roll back any mistake.

## Development and self-hosting

### Run locally (optional)

You need any static file server. With Node.js installed:

```bash
git clone https://github.com/karsmars/habit-app.git
cd habit-app
npx serve .
```

Then open the address it prints (usually http://localhost:3000).

To run the unit tests:

```bash
node --test
```

### Deploy your own copy to GitHub Pages

1. Fork this public repository or create your own copy, then push it to the `main` branch of your app repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose `main` and `/ (root)`, then click **Save**.
4. After deployment, open the GitHub Pages URL shown in your repository settings and connect it to your private data repo using the steps above.

GitHub Pages on a free account requires the app repository to be public. That is safe: the app repository contains no PAT or personal habit data. Your data stays in your separate private repository.

### Install on your devices

**iPhone**
1. Open your app's GitHub Pages URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open the app **from the home screen icon** (not from Safari) and connect your private data repo in **Settings**.

> iOS gives the installed home-screen app its own storage, separate from Safari. A token you entered in Safari won't carry over, so enter it again in the installed app.

**Laptop**
1. Open your app's GitHub Pages URL in Chrome or Edge.
2. Go to **Settings** and connect your private data repo.
3. Optionally click the install icon in the address bar to open it as its own window.

### First launch

Each browser or installed app needs its own repository details and PAT in **Settings**. Create your own private data repository; do not use someone else's repository.

| Field | Value |
|---|---|
| Repo owner | Your GitHub username |
| Repo name | The private data repository you created |
| File path | `data.json` |

New accounts start with **no habits and no rewards**. Add the ones you want from the Today and Shop tabs.

## Themes

Choose a theme in **Settings → Theme**. The choice is saved per device, so your phone and laptop can use different ones.

| Theme | Style | Main | Accent | Background |
|---|---|---|---|---|
| Sage and cream (default) | Light, calm, earthy | `#3F7D5C` | `#E9A23B` | `#F6F3EC` |
| Ocean indigo | Light, clean, focused | `#3B5BDB` | `#FFC53D` | `#F3F6FB` |
| Sunset coral | Light, warm, energetic | `#E8590C` | `#7048E8` | `#FFF6F1` |
| Midnight dark | Dark, cozy | `#8B7CF6` | `#FFC857` | `#14161C` |

Each theme also defines a five-step scale used to color the calendar, from fewest to most points:

| Theme | Scale |
|---|---|
| Sage and cream | `#E3EFE7` `#B7D8C4` `#7DB894` `#3F7D5C` `#24533B` |
| Ocean indigo | `#E4EAFB` `#B9C8F5` `#869EEA` `#3B5BDB` `#26398F` |
| Sunset coral | `#FDE6D8` `#FAC3A5` `#F4915F` `#E8590C` `#A33C06` |
| Midnight dark | `#2B2850` `#443C8F` `#6A5ED0` `#8B7CF6` `#C3BBFF` |

Habits use a separate set of 8 colors that work on every theme: `#E5484D` `#F76B15` `#E5A100` `#30A46C` `#12A594` `#3E63DD` `#8E4EC6` `#D6409F`.

### Adding a new theme

Themes live in `css/themes.css` as `[data-theme="name"]` blocks. Copy an existing block, change the values, and add the new name to the theme list in `js/themes.js`. (If your files are named differently, search the project for `data-theme`.)

## Using the app

- **Earning points:** each habit has a point value. Completing it adds those points. The value is saved with each completion, so editing a habit later doesn't change your past totals.
- **Spending points:** buying a reward subtracts its cost. Your balance is always calculated as points earned minus points spent. If you buy something by mistake, use **Undo/Refund** in the purchase history.
- **Streaks:** a day counts toward your streak if you completed at least one habit.
- **Calendar filter:** pick a habit chip to highlight only the days you completed it, in that habit's color.
- **Archiving vs. deleting:** archiving a habit or reward hides it but keeps your history. Deleting removes it from the lists.

## Syncing between devices

- The app shows your cached data right away, then checks GitHub in the background.
- It re-checks whenever you switch back to the app, and you can pull to refresh or tap **Refresh**.
- Your changes save instantly on your device and are sent to GitHub about a second and a half later, batched into a single commit.
- If two devices save at nearly the same time, the app re-fetches, merges both sets of changes, and retries. Completions and purchases are individual entries, so nothing gets overwritten.
- If you're offline, changes are kept on the device and sent automatically when you're back online. The sync indicator shows how many are waiting.

This isn't live sync. If both devices are open at once, the second one picks up changes the next time you switch to it or refresh.

## Backup

In **Settings**, use **Export** to download your data as a JSON file, and **Import** to load one back (you'll be asked to confirm first). It's a good idea to export occasionally. You also have the full history of `data.json` in the `habit-data` repo.

## Data format

`data.json` looks like this:

```json
{
  "version": 1,
  "goals":       [{ "id": "", "name": "", "emoji": "", "points": 0, "color": "", "archived": false, "deleted": false, "createdAt": "", "updatedAt": "" }],
  "completions": [{ "id": "", "date": "YYYY-MM-DD", "goalId": "", "points": 0, "deleted": false, "updatedAt": "" }],
  "rewards":     [{ "id": "", "name": "", "emoji": "", "cost": 0, "repeatable": true, "archived": false, "deleted": false, "createdAt": "", "updatedAt": "" }],
  "purchases":   [{ "id": "", "rewardId": "", "rewardName": "", "cost": 0, "date": "", "refunded": false, "updatedAt": "" }]
}
```

Dates are your local calendar dates, so a day ends at your midnight, not UTC midnight.

## Security

- The token lives only in your browser's local storage on each device. It is never in the code, in the URL, or in logs.
- The token should be limited to the private data repository you selected and its contents. If a device is lost, revoke that token in GitHub settings and your data stays safe.
- Anyone with access to your unlocked phone or laptop browser could use the app, so treat each device the way you'd treat a saved password.
- The app talks only to `api.github.com`. It has no analytics, ads, or third-party scripts.
- Habit and reward names are always displayed as plain text, never as HTML.

## Troubleshooting

| Problem | What to try |
|---|---|
| **401 or "bad credentials"** | The token is wrong or expired. Create a new one and paste it in Settings. |
| **403 or "forbidden"** | The token is missing **Contents: Read and write**, or isn't granted access to your private data repo. Check the token's permissions. It can also mean GitHub's rate limit was hit, so wait a few minutes. |
| **404 or "not found"** | Check the owner, repository name, and file path in Settings, and make sure `data.json` exists on the `main` branch. |
| **App asks for the token again on iPhone** | The home-screen app has separate storage from Safari. Enter the token in the installed app. iOS can also clear storage for sites that go unused for a long time, so keep a copy of the token in your password manager. |
| **Changes from my other device don't show up** | Switch away and back, or use Refresh. Check the sync indicator for errors. |
| **Sync says "conflict" repeatedly** | Close the app on the other device, refresh, and try again. Your local changes are kept safe in the meantime. |
| **App shows old version after an update** | Close and reopen the app. If it persists, fully quit it, or clear the site data (you won't lose your data, which is in GitHub). |
| **Pages site shows 404** | Check Settings → Pages is set to `main` / root, wait a minute, and make sure `index.html` is at the root of the repo. |

## Manual test checklist: two devices

1. Set up both devices with a token and confirm **Test connection** passes.
2. On the phone, complete a habit. On the laptop, refresh and confirm it appears.
3. On the laptop, buy a reward. On the phone, refresh and confirm the balance dropped.
4. Turn off Wi-Fi on the phone, complete two habits, then turn it back on. Confirm they sync.
5. Complete different habits on both devices at nearly the same moment. Confirm both appear after syncing.
6. Switch through all four themes on every tab and in Settings. Confirm nothing is unreadable.
7. Export your data, then import it and confirm everything matches.

## Project structure

The exact layout may vary, but it's roughly:

```
habit-app/
├── index.html
├── manifest.json
├── sw.js                 service worker (offline cache)
├── css/
│   ├── styles.css
│   └── themes.css        the four themes
├── js/
│   ├── app.js
│   ├── state.js
│   ├── storage-github.js GitHub API sync
│   ├── merge.js          conflict merging
│   ├── points.js         points, balance, and streak logic
│   ├── dates.js
│   ├── themes.js
│   └── ui-*.js           the tabs and Settings
├── icons/
└── tests/
```

## License

Personal project. Use it however you like.