# Crossword source connections

The six classic puzzle HTML pages are the source of truth for clue wording:

| Puzzle | Source |
| --- | --- |
| 1 | `cryptic/cryptic_crossword_interactive.html` |
| 2 | `cryptic/doms_cryptic_2.html` |
| 3 | `cryptic/doms_cryptic_3.html` |
| 4 | `cryptic/doms_cryptic_4.html` |
| 5 | `cryptic/doms_cryptic_5.html` |
| 6 | `cryptic/doms_cryptic_6.html` |

For a clue edit, change its text in the source page's `const clueText` literal. Keep the direction and clue number intact. The live cube at `/rubiks/` reads these pages automatically, so the same edit reaches both views after GitHub Pages deploys. Do not manually edit a second copy of the clue in the cube. Puzzle 7 is a separate standalone puzzle at `cryptic/doms_cryptic_7.html`. The 15x15 Bonus Edition is at `cryptic/doms_cryptic_bonus.html`. The cube uses Puzzles 1–6.

Keep both archive pages in the same order. Each Crubik’s Cube follows its set of six numbered 11×11 puzzles and appears directly above the newest puzzle in that set. Newer puzzles go above that cube. Bonus editions do not count toward the six.

`rubiks/clue-sync.js` documents the synchronization code embedded in the standalone `rubiks/index.html`. If changing synchronization behavior, update both the source script and the embedded copy. Keep the cube's occupancy, assignments, orientations, colours, progress storage and letter-sharing data unchanged for clue wording edits. If an instruction also changes the grid, numbering or answer letters, the cube geometry and sharing need a separate rebuild; its runtime rejects that mismatch rather than silently applying inconsistent data.

The cube checks for current clues on load and when its tab regains focus or becomes visible, with a 30-second throttle. Reloading the cube checks immediately. Its printed clues use the same updated data. Each puzzle update is validated independently. If the network or a source fails, the last successfully cached clues are used, followed by the embedded snapshot if no valid cache exists. Opening the HTML as a local file does not fetch the website. A disconnected downloaded copy cannot receive future website edits.

The source reader parses data literals only; it does not execute scripts from the classic puzzle pages. Preserve data literal syntax: JSON strings, arrays and objects (bare `across` / `down` object keys are also supported).
