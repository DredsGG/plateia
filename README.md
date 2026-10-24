<div align="center">

<img src="extension/icons/128.png" width="96" alt="Plateia icon">

# Plateia

**Your seat in every stream at once.**
A Chrome extension for Twitch that grabs the channel-points chest by itself, claims finished Drops, and puts several lives in one room where you're present in every chat.

![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)
![Twitch](https://img.shields.io/badge/Twitch-twitch.tv-9146FF?logo=twitch&logoColor=white)
![Version](https://img.shields.io/badge/version-0.2.2-9146FF)
![Tests](https://img.shields.io/badge/tests-27%2F27%20passing-2e7d32)
![License](https://img.shields.io/badge/license-MIT-green)

<img src="docs/plateia-sala.png" width="900" alt="Plateia room: channel list with modes and tags on the left, the two lives that are earning points on the right">

<sub>The room with demo channels (simulated Twitch, made-up names).</sub>

</div>

---

## What it does

- **Chest on autopilot.** On any Twitch tab, and on every live inside the room, it clicks the *+50* bonus chest as soon as it shows up (0.4–2 s random delay). It looks for the chest icon, not the button text, so it works in any language.
- **Drops on autopilot.** The room checks your inventory every 2 minutes. A Drop at 100% is claimed directly; if that fails, it opens the inventory page hidden and clicks *Claim* there.
- **Multi-live room.** A purple **Plateia** button on Twitch opens the room in its own window:
  - **Presence in every chat.** One IRC connection, using the site's own login, joins the chat of every channel on your list (in batches, inside Twitch's join limit). You show up in the viewer list without loading any video.
  - **2 lives that count.** Twitch only pays points and chests on 2 streams at a time, so 2 slots play for real: the full channel page in an iframe, muted, at 160p. The 👁 button hides a live without reloading it (it keeps counting).
  - **Rotation.** Slots rotate between the channels that are live every N minutes (20 by default, 10 minimum), so every channel earns at some point. Each channel can be **Fixed** (always gets a slot), **Rotation** or **Chat only**, and **▶** puts one on screen right now.
  - **Live counters:** live/total, in chat X/Y, earning 2/2, time to the next swap, points and chests since the room opened, balance per channel, Drops in progress.
- **Add channels** by name or link, from the channels you follow that are live, or from the game below.
- **PokeIdle bonus.** [PokeIdle](https://pokeidle.io) gives an XP bonus for being in the chat of its partner streams. With the game open in a tab, Plateia reads the list of bonus channels from the game itself (read only, it never sends anything to the game), keeps them on the list and shows whether the game already sees you on each one.

> The interface is in Portuguese, the language I use.

## How it was measured

Before writing the room I measured how Twitch actually behaves, on a live account:

- The bonus chest is `.claimable-bonus__icon` inside `[data-test-selector="community-points-summary"]`, and it can be clicked from inside an iframe of the same site.
- A full `twitch.tv/<channel>` page inside an iframe on twitch.tv loads logged in and earns points. The official embed player (`player.twitch.tv`, used by most multi-stream sites) **doesn't**.
- With 4 lives open, only **2** earned points. A live in a 2×2 px iframe still earns points and chests.
- Drops progress on one channel at a time, so the room doesn't try to speed them up.

## Architecture

```
extension/
├── manifest.json            MV3, only the "storage" permission
├── src/comum.js             shared: default settings, storage, cookie login, GQL helper
├── src/bau.js               every Twitch frame: clicks the chest; on the inventory page, claims Drops
├── src/sala.js              the room (shadow DOM): channel data, IRC presence, slots, rotation, Drops
├── src/pokeidle-ponte.js    pokeidle.io, page world: reads the game's twitch block from its WebSocket (read only)
├── src/pokeidle-guarda.js   pokeidle.io: stores that block for the room
└── icons/
```

- No service worker and no popup: everything lives inside the site.
- Channel data comes from Twitch's own GraphQL endpoint with aliased queries, batched 10 per request (Twitch rejects more than 15 aliases).
- The room's players are forced to 160p only while they load, then your usual quality setting is restored.

## Install

1. Download **plateia-vX.Y.Z.zip** from the [latest release](https://github.com/DredsGG/plateia/releases/latest).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Drag the zip onto the page (or unzip it and use **Load unpacked**). From a clone of this repo, load the `extension/` folder.
4. Reload twitch.tv and click the purple **Plateia** button (bottom left).

## Tests

```bash
cd tests && npm i jsdom
node teste-sala.cjs         # room logic in jsdom: 27/27
node teste-assinatura.cjs   # footer signature and version
```

`teste-sala.cjs` covers the PokeIdle bridge and storage, GQL batching, settings migration, per-channel modes, *watch now*, removed channels not coming back, list clearing, and the footer. The room was also run end to end in Chromium with the extension loaded against a simulated Twitch and PokeIdle, and on a real account in my Chrome (chat 12/12, a chest claimed by the rotation). Claiming a real Drop at 100% hasn't been seen live yet.

## Disclaimer

Personal project, not affiliated with or endorsed by Twitch. It doesn't fake viewing: lives that earn points are real players playing video. Automating clicks may still go against Twitch's Terms of Service. Use it on your own account and at your own risk.

## License

[MIT](LICENSE) · made by [André Miller Fleck (Dreds)](https://github.com/DredsGG)
