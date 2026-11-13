# Confession Tracker (Obsidian plugin)

Examination of conscience with a +1 counter per question, with optional notes. When you go to confession, the counts are saved to a history note and reset.
Styled like a book of hours (parchment by day, candlelight in dark mode, EB Garamond). Works on desktop and on Obsidian for iOS/Android. The interface is in English or Spanish, following Obsidian's language.

## Use
- Open it from the ribbon (church icon) or the command **Open confession tracker**.
- The first time, click **Create it with example questions**. This creates `Confession/Questions.md`.
- Tap **+** to add one. **Long-press +** (or right-click it) to add one with a note about what happened.
- **−** removes the last +1. If it had a note, you're shown the note and asked to confirm first.
- Questions with notes show a collapsed **N notes** list. Tap a note to edit or delete it.
- **Edit questions** adds, renames, hides/shows and reorders questions and sections. Questions are never deleted, only hidden.
- **I went to confession** writes `Confession/History/<start> → <end>.md` (only questions with at least one +1, plus their notes), resets every count to 0 and starts a new period today.
- You can change both paths in the plugin settings.

The questions note stores everything in its YAML frontmatter, and you can also edit it by hand (in Source mode):

```yaml
period_start: 2026-10-01
sections:
  - name: Faith
    questions:
      - id: qk3f9      # generated automatically if missing
        text: Did I neglect daily prayer?
        unit: days
        visible: true
        ticks:             # one entry per +1; the counter is how many there are
          - at: 2026-11-13 09:12
          - at: 2026-11-13 21:40
            text: Skipped evening prayer, too tired
```

## Build
```bash
npm install
npm run build      # produces main.js and styles.css (from src/styles.css, with the fonts embedded)
npm run dev        # rebuilds on every change
```

## Install
**With BRAT (easiest, also on mobile):** install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin, choose *Add beta plugin* and enter `pablomiralles22/obsidian-confession-tracker`.

**By hand:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/pablomiralles22/obsidian-confession-tracker/releases/latest) and copy them into `<vault>/.obsidian/plugins/confession-tracker/`, then enable **Confession Tracker** under Settings → Community plugins.

To get it on your iPhone without BRAT, use whichever way you sync the vault:
- **Obsidian Sync:** turn on "Installed community plugins" sync (on both devices). Install it on the desktop and it shows up on the phone.
- **iCloud:** copy the three files into the vault's `.obsidian/plugins/confession-tracker/` folder through iCloud Drive (e.g. iCloud for Windows).

On iOS, the `.obsidian` folder is hidden in the Files app, so it's easier to copy from a computer.

## Release
1. Bump `version` in `manifest.json` and `package.json`, and add the new version to `versions.json` (mapped to `minAppVersion`).
2. Commit, then tag and push: `git tag 0.2.0 && git push origin main 0.2.0`.
3. The GitHub Action builds the plugin and publishes a release with the three files.

## Credits
EB Garamond by Georg Duffner and Octavio Pardo, under the SIL Open Font License 1.1 (via `@fontsource/eb-garamond`).

## License
[MIT](LICENSE)
