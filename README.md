Automatically uses class-appropriate wine during combat and refreshes it at
**5 seconds remaining**. Enabled by default.

- **Physical Wine:** Warrior, Berserker, Valkyrie, Lancer, Archer, Slayer, Brawler.
- **Magic Wine:** Sorcerer, Reaper, Gunner, Ninja, Mystic, Priest.

**Mystics:** Wine also works during an active tracked boss fight, even while
personally out of combat. Boss tracking depends on server packets and is not
yet verified live; manual wine use may still be needed.

Uses wine from your bag or pockets, respects cooldowns, and updates the refresh
timer after manual wine use. Other classes require personal combat.

To install, place
[module.json](https://raw.githubusercontent.com/pyureee/auto-wine/main/module.json)
in `mods/auto-wine`, then restart Toolbox and reconnect. Remaining files download
automatically. Automatic updates are enabled.

Commands in `/8` Toolbox chat:

- `wine` — show status and the next scheduled check.
- `wine on` / `wine off` — enable or disable.
