# Token Launch Radar - Make.fun Solution

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/anhboy01111/mf-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/anhboy01111/mf-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

## Overview
A production-grade token launch radar for the `token-radar-01` competition on make.fun.
This entry scores protocols from DefiLlama snapshots, filters pre-token opportunities, ranks by implied valuation, and renders a fully functional static dashboard without network dependencies.

## Architecture
- **Runner**: `main.ts` (Node.js 22 LTS)
- **Model**: `lib/model.ts` valuation and ranking heuristics
- **Output**:
  - `board.json`: 200 ranked protocol rows covering 100% of the watchlist
  - `dashboard/`: Static web UI (HTML, CSS, JS) with filter and detail views
  - `screenshots/`: 3 high-resolution proof captures (board, detail, filtered)
  - `dossier.json`: Sealed entry dossier for AI judge review

## How to Run
```bash
node main.ts --input /input/snapshot.json --output /output
```

## License
[MIT](LICENSE)
