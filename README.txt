THE GEORGE SIMULATOR — CURRENT GAME EXPORT

Published version 19. Source revision: 5ff380baf6d2f27aee034ef55467cbff824cba61
Live game: https://the-george-simulator.haribo54.chatgpt.site

This ZIP contains the complete editable game, artwork, recordings, source artwork and automated tests. No build or dependency installation is required for the game.

RUN LOCALLY
Extract this ZIP, open a terminal in the The-George-Simulator folder, and run:
  python3 -m http.server 8000 --directory dist
Then open http://localhost:8000 in a browser.
Use an HTTP server; directly opening index.html can block modules and audio fetching.

CONTINUE IN ANOTHER CHAT
Upload this ZIP and ask the assistant to inspect README.txt, dist/app.js, dist/engine.js and dist/style.css before making focused edits. Preserve existing approved assets and behavior. The hosting manifest identifies the existing Site; updating that live link requires authorized Sites access, which this ZIP does not grant.

CURRENT APPROVED STATE
Six playable characters and their unique karaoke performances and 18 song recordings.
PASS/FAIL reactions currently apply ONLY to Harris. Independent 50/50 outcome after the song. PASS layers pass1.m4a and pass2.m4a together; FAIL layers fail1.m4a and fail2.m4a together. Reaction ends when both layers finish. No reaction score effects. Approved visuals and karaoke loading fix included.
Hidden risk: pint +3, shot +4, scratchings +1, jukebox +2; barred at >=27. Onecan immediately barred on pint/shot. Existing leaderboard remains browser-local.

TESTS
From the project folder, with Node.js installed:
  node test.mjs
Tests simulate browser/audio events; they do not replace visual or real-device audio testing.

Browser-local leaderboard scores are not included in this source export.
