// What's new in each version, in English: what changes for users, in short sentences.
// Update on EVERY version (rule 12). Shown once per version in the "What's new in vX.Y.Z" box.
(() => {
  const P = window.PLATEIA;
  if (!P) return;
  P.CHANGELOG = P.CHANGELOG || {};
  P.CHANGELOG.en = {
    '0.7.0': [
      'New look in both rooms, in Twitch and Kick style.',
      'The channel list is now split into "Earning now", "Live, waiting" and "Offline", with the rotation timer in the title.',
      'The Twitch room has a Settings tab with on/off switches.',
      'On Kick, a PokeIdle summary shows the active bonuses and how much is left for the next bundle, and warns if Kick isn\'t linked in the game.',
      'Plateia now works on Chrome, Edge, Brave, Opera GX and Firefox.',
      'First-run tutorial: reopen it any time from "? Como usar" at the top of the room.'
    ]
  };
})();
