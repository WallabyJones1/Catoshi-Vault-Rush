# Paid runs — proposal only, not enabled

The packaged game has free practice and free holder play (50K CATOSHI minimum holdings). Daily UTC holder rankings are implemented, with a configurable 100K/day budget and external, manually reviewed payments. Prizes are disabled by default.

The proposed stake mode is **not** a live feature. There is no deposit address, wager debit, escrow, cash-out button, automatic payout, or client-settable paid flag. A seed changing each run does not make a prize system bot-proof.

## Proposed rules to decide

| Item | Proposal / unresolved choice |
| --- | --- |
| Minimum entry | 1,000 CATOSHI staked; 10K could be a preset |
| Maximum entry | Must be capped against actual available reserves, not unlimited |
| First milestone | 1.5× **total return including the stake**, not 1.5× profit |
| Second milestone | 2× total return including the stake |
| Trigger | Fixed distance milestones, still to be selected by play-testing; not client scores |
| Cash-out rule | Decide whether the player banks 1.5× or risks it for 2×, versus an automatic best-tier award |
| Failure rule | Decide whether a crash after the first tier loses everything or preserves that tier |
| Re-entry / exploits | Address player identities, ownership, multiple accounts, refunds, disconnects and automated runs |

For example, a 10K stake returns **15K total** at 1.5× or **20K total** at 2×. Those amounts are illustrative, not offers in the website.

## Funding and safety

Incoming deposits are not profit. Track accepted stakes, reserved potential payouts, player balances, refunds, and settled payments independently in an auditable ledger. Reserve the full maximum payable amount for each accepted run before it starts; reject new entries if reserves are insufficient. Do not borrow pending payout liabilities to fund the free leaderboard.

Use only realized net surplus after payouts, fees and operating costs to fund a daily leaderboard allocation. A fixed 100K daily giveaway cannot be guaranteed solely by stakes unless the economics actually support it and the team maintains a reserve. For a simple all-or-nothing 2× award, expected gross payout per token staked is `2 × success probability`; a 60% success rate would cost 1.2 tokens per token accepted, losing money before expenses. Cash-out strategies, seed difficulty differences and bots change these probabilities substantially.

Before implementing: decide the cash-out/failure rules, milestones, stake cap, reserve floor and refund policy; benchmark survival against varied seeds and adversarial automated players; arrange independent security review and jurisdiction-specific legal advice. Skill and crypto payments should not be assumed to exempt a game from gambling rules. Australian reference: https://www.acma.gov.au/about-interactive-gambling-act

Do not upload a vault seed phrase or private key to the website or GitHub. Any later automated settlement service should be separately designed with restricted signing, withdrawal limits, idempotent settlement, reconciliation, and emergency controls.
