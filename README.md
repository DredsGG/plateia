<div align="center">

<img src="extension/icons/128.png" width="96" alt="Plateia icon">

# Plateia

**Your seat in every stream at once.**
A browser extension for **Twitch and Kick**. It grabs the Twitch channel-points chest by itself, claims finished Drops on both sites, and puts several lives in one room. On Twitch you're present in every chat; on Kick it saves channel points and redeems them for you.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4)
![Twitch](https://img.shields.io/badge/Twitch-twitch.tv-9146FF?logo=twitch&logoColor=white)
![Kick](https://img.shields.io/badge/Kick-kick.com-53FC18?logo=kick&logoColor=black)
![Version](https://img.shields.io/badge/version-0.8.0-9146FF)
![Tests](https://img.shields.io/badge/tests-147%20passing-2e7d32)
![License](https://img.shields.io/badge/license-MIT-green)

**Works on:** Chrome · Edge · Brave · Opera GX · Firefox 140+

<img src="docs/plateia-twitch-room.png" width="900" alt="Plateia Twitch room: header with live counters (live, in chat, earning 2/2, next swap, points and chests gained, PokeIdle bonus) and a How to use button; on the left the Channels, PokeIdle and Settings tabs, a PokeIdle summary and the channel list split into Earning now, Live waiting and Offline, each channel with status, tags and Fixed / Rotation / Chat only modes; on the right the two lives that are earning points">

<sub>The Twitch room with demo channels (simulated Twitch, Kick and PokeIdle, made-up names).</sub>

</div>

---

## What it does

The extension knows which site it's on. **Twitch** and **Kick** each get their own room (purple button on Twitch, green on Kick), styled like the site it runs on. Both rooms have the same tabs: **Channels**, **PokeIdle** and **Settings**, and the channel list is split into *Earning now* (with the rotation timer), *Live, waiting* and *Offline*.

### Twitch

- **Chest on autopilot.** On any Twitch tab, and on every live inside the room, it clicks the *+50* bonus chest as soon as it shows up (0.4–2 s random delay). It looks for the chest icon, not the button text, so it works in any language.
- **Drops on autopilot.** The room checks your inventory every 2 minutes. A Drop at 100% is claimed directly; if that fails, it opens the inventory page hidden and clicks *Claim* there.
- **Multi-live room.** A purple **Plateia** button on Twitch opens the room in its own window:
  - **Presence in every chat.** One IRC connection, using the site's own login, joins the chat of every channel on your list (in batches, inside Twitch's join limit). You show up in the viewer list without loading any video.
  - **2 lives that count.** Twitch only pays points and chests on 2 streams at a time, so 2 slots play for real: the full channel page in an iframe, muted, at 160p. The eye button hides a live without reloading it (it keeps counting).
  - **Rotation.** Slots rotate between the channels that are live every N minutes (20 by default, 10 minimum), so every channel earns at some point. Each channel can be **Fixed** (always gets a slot), **Rotation** or **Chat only**, and **▶** puts one on screen right now.
  - **Live counters:** live/total, in chat X/Y, earning 2/2, time to the next swap, points and chests since the room opened, balance per channel, Drops in progress.
- **Add channels** by name or link, from the channels you follow that are live, or from the game below. **Clear list** (asks for a second click) and **PokeIdle channels only** start the list over.
- **Settings tab** (*Ajustes*), in three groups with on/off switches: number of slots, rotation on/off, minutes per round, 160p for the room's lives; chat presence and follow PokeIdle's channels; chest and Drops on autopilot.
- **PokeIdle bonus.** [PokeIdle](https://pokeidle.io) gives an XP bonus for being in the chat of its partner streams. With the game open in a tab, Plateia reads the list of bonus channels from the game itself (read only, it never sends anything to the game), keeps them on the list and shows whether the game already sees you on each one.

### Kick

Kick has no chest to click: points drop by themselves (10 every 5 minutes watched), they only work on the channel where you earned them, and only **2** lives earn at a time (measured, same as Twitch).

- **Room with 2 slots in focus mode.** The channels closest to completing a PokeIdle bundle play first, so bundles close sooner. Each channel can be **Fixed**, **Queue** or **Off**; **▶** pins one right now.
- **Bundle redemption.** When a channel's balance covers **one of each** PokeIdle reward (XP + Capture Boost + Secret Lure), it redeems the three in a row through the site's own endpoint. Guard rails: only with Kick linked inside the game, only if the game is linked to the same Kick account, only full bundles (all three rewards active), stops on the first error and waits 15 minutes.
- **PokeIdle summary** at the top of the channel list: official channels live, active bonuses with their end time, and how many points are left for the next bundle (with a time estimate). It warns when Kick isn't linked in the game or the game is linked to another Kick account, because redemption stays off in both cases.
- **Daily Reward and Drops.** Claims Kick's Daily Reward after the hour watched, and finished Drops when the game account is connected.
- **Settings tab:** number of slots, automatic bundle redemption, follow PokeIdle's Kick channels, Daily Reward and Drops on autopilot. Each one can be turned off.

### PokeIdle tab

<img src="docs/plateia-kick-room.png" width="900" alt="Plateia Kick room: header with live counters, points gained, PokeIdle bonus hours and Daily Reward progress; on the left the PokeIdle summary (official channels live, active bonuses, points left for the next bundle) and the channels split into Earning now, Live waiting and Offline, with balance, bundle cost and Fixed / Queue / Off modes; on the right the two lives earning points">

<img src="docs/plateia-pokeidle-tab.png" width="320" alt="PokeIdle tab: Twitch bonus with the three bonus lives that already see you; Kick active bonuses with end time, and the bundle progress per channel with a time estimate">

- **Twitch:** current bonus (15% + 2.5% per extra live) and which bonus lives already see you.
- **Kick:** active bonus hours (until when), bundle progress per channel with a time estimate, last redemptions.

<sub>Kick room and PokeIdle tab with demo data (simulated Kick and PokeIdle, made-up names).</sub>

### First-run tutorial and what's new

<img src="docs/plateia-tutorial.png" width="900" alt="First-run tutorial over the Twitch room: a dialog 'Como usar a sala da Twitch', step 2 of 5 'Seus canais', explaining how to add channels and the Fixed, Rotation and Chat only modes, with Skip, Back and Next buttons">

<img src="docs/plateia-novidades.png" width="360" alt="What's new dialog in the Kick room: 'Novidades da v0.7.0' with a short list of changes and the buttons See the tutorial and Got it">

- The first time a room opens, a short tutorial (5 steps per room) explains each part, with **Pular** (skip) and **Entendi** (got it). It doesn't come back by itself, but **? Como usar** at the top reopens it.
- After an update, the first time a room opens shows **Novidades da vX.Y.Z** (what's new) once per version. The texts live in `extension/src/changelog/` (Portuguese and English) and are updated on every version.
- Both close with the X or Esc and never pause anything that's running.
- **On any Twitch or Kick page, not only inside the rooms** (since v0.8.0): the tutorial on a fresh install, *What's new in vX.Y.Z* once per version, and *New version vX.Y.Z* with a short summary and an **Update** button show up by themselves as a small box in the middle of the screen, with no dark overlay and without blocking clicks on the site.

## How it was measured

Before writing the room I measured how Twitch actually behaves, on a live account:

- The bonus chest is `.claimable-bonus__icon` inside `[data-test-selector="community-points-summary"]`, and it can be clicked from inside an iframe of the same site.
- A full `twitch.tv/<channel>` page inside an iframe on twitch.tv loads logged in and earns points. The official embed player (`player.twitch.tv`, used by most multi-stream sites) **doesn't**.
- With 4 lives open, only **2** earned points. A live in a 2×2 px iframe still earns points and chests.
- Drops progress on one channel at a time, so the room doesn't try to speed them up.
- On Kick, 4 lives playing for 11 minutes: only **2** earned points. `kick.com/<channel>` can be framed by a kick.com page, so the room works the same way.
- PokeIdle's Kick bonus is bought: each redemption of a PokeIdle reward on an official channel is 1 hour of +15%, and hours add up (from the game's own client code).

## Architecture

```
extension/
├── manifest.json            MV3 for every browser: background as service_worker (Chromium) and scripts (Firefox),
│                            browser_specific_settings.gecko (id plateia@dredsgg, Firefox 140+, no data collection, update_url)
├── COMO-INSTALAR.html       install / use / update guide (PT and EN) with a browser picker, opens on first install
├── src/fundo.js             background: update check against this repo's releases, reload when the folder changes,
│                            site-permission check (Firefox lets users turn it off)
├── src/comum.js             shared: browser/chrome API, default settings, storage, cookie login, page-like fetch, GQL helper
├── src/bau.js               every Twitch frame: clicks the chest; on the inventory page, claims Drops
├── src/sala.js              the Twitch room (shadow DOM): channel data, IRC presence, slots, rotation, Drops
├── src/kick/kick.js         Kick: button, room, focus-mode slots, bundle redemption, Daily Reward, Drops
├── src/ui.js                shared UI and the room style per site: logo, icons, tutorial and what's new, update card,
│                            bug report, footer signature
├── src/changelog/           what's new per version (pt.js, en.js)
├── src/pokeidle-painel.js   the PokeIdle tab used by both rooms
├── src/pokeidle-ponte.js    pokeidle.io, page world: reads the game's twitch and kick blocks from its WebSocket (read only)
├── src/pokeidle-guarda.js   pokeidle.io: stores those blocks for the rooms
└── icons/
```

- No popup: everything lives inside the site. The only background piece is the small update script.
- One code base for Chromium and Firefox: `browser` when it exists, `chrome` otherwise; network calls go out like the page itself (`content.fetch` on Firefox), and SVG icons are built without `innerHTML`.
- Channel data comes from Twitch's own GraphQL endpoint with aliased queries, batched 10 per request (Twitch rejects more than 15 aliases).
- The room's players are forced to 160p only while they load, then your usual quality setting is restored.
- Chat presence heals itself: a JOIN that Twitch drops is retried after 30 s, every channel is re-checked each minute, and a silent chat connection is reopened after 6 minutes.
- Kick calls use the site's own login (the `session_token` cookie) from inside kick.com.

## Updates

<img src="docs/plateia-rodape.png" width="720" alt="Room footer in Twitch and Kick: the Relatar bug (report a bug) card open with 'What happened?', the diagnostic that goes along (version, room, browser, counts, no account data) and the buttons Open on GitHub, Copy report and Close; below it the Procurar atualização (check for updates) and Relatar bug buttons">

Plateia checks this repo's latest release when Chrome starts, every 6 hours and when you press **↻ Procurar atualização** (check for updates) in either room. A new version shows a gold card with the release notes and a gold dot on the Plateia button. **Atualizar** (update) downloads the zip, and once you extract it **over the same folder** Plateia notices the new `manifest.json` within a minute and reloads itself (only the room tabs reload; your other Twitch and Kick tabs keep running). **Depois** (later) hides the card until the next version. The **i** button opens the install and update guide.

On Firefox, a signed `.xpi` updates itself through `firefox/updates.json` (the manifest's `update_url`). The temporary install (see below) has to be loaded again with the new zip.

## Reporting a bug

**Relatar bug** (report a bug), in the footer of both rooms next to the update check, opens a prefilled issue in this repo with the version and a short diagnostic: browser, room, counts and on/off states only (no account name, token or channel names). You can read exactly what goes along before sending, or use **Copiar relatório** (copy report) instead.

## Install

One package for every browser. Get it from the [latest release](https://github.com/DredsGG/plateia/releases/latest).

### Chrome, Edge, Brave, Opera GX

1. Download **plateia-vX.Y.Z.zip** and extract it to a folder you'll keep.
2. Open the extensions page: `chrome://extensions`, `edge://extensions`, `brave://extensions` or `opera://extensions`.
3. Turn on **Developer mode** (top right; on Edge it's in the left column) and keep it on: the self-reload after an update needs it.
4. Click **Load unpacked** and pick that folder. From a clone of this repo, load the `extension/` folder.
5. To update, extract the new version over the same folder, or press **Atualizar** in the room's update card.

On **Opera GX**, if Plateia disappears after you close the browser (a known Opera issue with unpacked extensions), just load the folder again.

### Firefox (140 or newer)

Regular Firefox only keeps extensions that Mozilla has signed. That signing is paperwork Plateia hasn't been through yet, so **for now it installs as a temporary add-on**: it works the same, but Firefox removes it when it closes.

1. Download **plateia-vX.Y.Z.zip** and extract it to a folder.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick `manifest.json` inside the folder.
4. Next time you open Firefox, repeat steps 2 and 3.

When a release has a signed **plateia-vX.Y.Z.xpi**, click it and confirm **Add** (or use `about:addons` → gear → **Install Add-on From File**): it stays installed and updates itself. On Firefox Developer Edition, Nightly or ESR you can already keep it: set `xpinstall.signatures.required` to `false` in `about:config`, rename the zip to `.xpi` and install it from `about:addons`.

If the Plateia button doesn't show up, open `about:addons` → Plateia → **Permissions** and allow twitch.tv and kick.com (the install guide also shows an *Allow access* button when this is missing).

### After installing

Reload twitch.tv or kick.com and click the **Plateia** button (bottom left: purple on Twitch, green on Kick). For PokeIdle, reload the game tab once so Plateia can read the official channels. `COMO-INSTALAR.html` (opens on first install, Portuguese and English) has the same steps with a browser picker.

## Languages

- Since v0.8.0 everything (rooms, tutorial, what's new, update notices, footer) is in **Portuguese, English and Spanish**. The first run follows the browser language (pt-*, es-*, en-*; anything else falls back to English) and a **PT · EN · ES** selector in the room footer switches it on the spot.
- Plateia keeps its own dictionary (`extension/src/i18n/en.js`, `es.js`) keyed by the Portuguese text, because `chrome.i18n` can't switch language while the extension is running. The changelog has the three languages in `extension/src/changelog/`.
- The install and update guide (`COMO-INSTALAR.html`) has flag buttons to switch language.

## Known limitations

- Twitch and Kick only pay points on **2 lives at a time** (measured), so only 2 slots play for real; the other channels get chat presence on Twitch and nothing on Kick.
- Drops progress on one channel at a time, so the room doesn't speed them up.
- A real Drop claimed at 100% and a real Kick bundle redemption haven't been seen live yet; the logic is covered by the tests.
- On Chrome, Edge, Brave and Opera GX the self-reload after an update needs **Developer mode** to stay on.
- PokeIdle features need the game open in a tab (reload it once after installing Plateia). Bundle redemption only runs with Kick linked inside the game.
- Firefox: until the Mozilla signing is set up, Plateia is a temporary add-on there (removed when Firefox closes). Firefox support passed Mozilla's linter (`web-ext lint`, 0 errors) and shares the tested code, but hasn't been run on a live account yet.

## Tests

```bash
cd tests && npm i jsdom
node teste-sala.cjs         # Twitch room logic in jsdom: 30/30
node teste-kick.cjs         # Kick room: bundle, order, guard rails, PokeIdle summary, Daily Reward, Drops, tab, bug report: 18/18
node teste-chat.cjs         # dropped chat JOIN is retried: 3/3
node teste-assinatura.cjs   # footer signature and version: 6/6
node teste-rodape.cjs       # footer: update check, bug report without personal data, signature: 10/10
node teste-quadros.cjs      # first-run tutorial and what's new, both rooms: 13/13
node teste-avisos.cjs       # tutorial / what's new / new version on the site page, never blocking clicks: 22/22
node teste-idiomas.cjs      # every text in en and es, language detection, both rooms in pt/en/es: 35/35

# needs Playwright; pass a COPY of the extension folder (the test rewrites its manifest)
node e2e-atualizacao.mjs /path/to/copy-of-extension   # update flow: 10/10
node e2e-regra14.mjs /path/to/copy-of-extension /path/to/screenshots pt-BR   # notices on the page and the language selector, per browser language (pt-BR, en-US, es, fr)

# Firefox: Mozilla's linter, self-distribution rules (0 errors)
npx web-ext lint --source-dir ../extension --self-hosted
```

`e2e-atualizacao.mjs` loads the real extension in Chromium against a fake GitHub release: the guide opens on install, the gold card shows the versions and notes, *Update* opens the zip, the dot appears on the button, *Later* hides it, and writing a newer `manifest.json` into the folder makes Plateia reload itself (15 s) with the green "updated" notice.

`teste-sala.cjs` covers the PokeIdle bridge and storage, GQL batching, settings migration, per-channel modes, *watch now*, removed channels not coming back, list clearing, and the footer. The room was also run end to end in Chromium with the extension loaded against a simulated Twitch and PokeIdle, and on a real account in my Chrome (chat 12/12, a chest claimed by the rotation). Claiming a real Drop at 100% hasn't been seen live yet. The Kick room was run on a real account (live status, balances, Daily Reward and Drops read, 2 lives playing); a real bundle redemption hasn't happened yet.

## Disclaimer

Personal project, not affiliated with or endorsed by Twitch, Kick or PokeIdle. It doesn't fake viewing: lives that earn points are real players playing video. Automating clicks and redemptions may still go against Twitch's or Kick's Terms of Service. Use it on your own account and at your own risk.

## License

[MIT](LICENSE) · made by [André Miller Fleck (Dreds)](https://github.com/DredsGG)
