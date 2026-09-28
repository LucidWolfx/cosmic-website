# Cosmic rulebook version 1.0

The owner requested finalized rules based on established GTA RP practice and
confirmed **18+** and **story-focused serious RP** on 28 September 2026.
The text is original Cosmic community policy, not another server's rulebook.

`content/rules.json` is the canonical source. `tools/rules_page.py` generates
the public rules page content, `site/rules-v1.0.txt` and `COMMUNITY-RULES.md`.
Run `python tools/build.py` after edits. The search and category controls are
progressive enhancements; every rule is available without JavaScript.

## Selected Cosmic defaults

- Players and playable characters must be adults aged 18 or older.
- Four players per coordinated criminal side, including drivers, scouts and
  remote assistance. Replacements and allied groups cannot bypass this cap.
- Respawning triggers memory loss for the incident and a minimum 60-minute
  restriction on returning or assisting that incident, also lasting until it ends.
  Treatment without respawning does not automatically erase memory; an
  incapacitated character cannot rejoin active combat in the same incident.
- No new planned crime in the 15 minutes before and after a scheduled restart.
- Attempt to return within 10 minutes of a crash; genuine outages are evaluated
  in context and must be reported as soon as practical.
- Private reports, proportionate enforcement and an appeal review by uninvolved
  staff where possible. A restriction notice must provide a working appeal
  contact even if access to the Discord server is removed.

There is no single GTA RP standard for ages, timers, group sizes or punishments.
These numbers and procedures are Cosmic's choices under the owner's request.
They do not change game scripts or open recruitment. Department SOPs still need
to supply operational detail without overriding community protections.

## Research references

Reviewed 28 September 2026:

- [New Day RP's official rules](https://newdayrp.com/threads/new-day-rp-rules-and-guidelines.24/)
  illustrate the common IC/OOC boundary, consequences for disconnecting,
  meaningful escalation and injury roleplay. They use different heist exceptions
  and additional restart restrictions; those were not imported into Cosmic.
- [ONX's official rules](https://onx.gg/rules) cover the same broad RP principles
  and use 18+ eligibility. Their disciplinary system and detailed exceptions
  are specific to ONX and were not adopted.

## Publication and acknowledgement

1. Update the canonical content, visible version and effective date together.
2. Build, inspect the desktop and mobile page, and verify search, categories,
   direct links and the downloadable text.
3. Publish the matching website before changing backend acknowledgement settings.
4. Run `backend/publish_rules.sql` for this release. It records
   `cosmic-rules-1.0-2026-09-28`, asserts intake is closed and leaves both intake
   switches unchanged. Browser code cannot write these settings.
5. The existing submission RPC requires a checked acknowledgement of the current
   version. Previously acknowledged versions do not satisfy a new submission.
   Historical submitted applications retain the version accepted at submission.

Future substantive changes require a new version, a dated change note and
preservation of the old published text. Do not silently overwrite `rules-v1.0.txt`
after adopting a later version. Opening intake is a separate owner action.

Staff must communicate changes through the community's normal announcement
process. Publication here does not itself send a Discord announcement.
