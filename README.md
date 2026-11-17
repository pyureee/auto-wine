Automatically uses the correct wine for your class. Enabled by default.

- **No waste on combat re-entry:** keeps the correct wine buff until five seconds remain.
- **Wrong-wine correction:** uses your class's wine if only the wrong buff is active.
- **Timed refresh:** refreshes at five seconds remaining; manual wine use updates the timer.
- **Death recovery:** reapplies a lost buff after resurrection when combat conditions are met.
- Uses wine from your bag or pockets and respects item cooldowns.

- **Physical Wine:** Warrior, Berserker, Valkyrie, Lancer, Archer, Slayer, Brawler.
- **Magic Wine:** Sorcerer, Reaper, Gunner, Ninja, Mystic, Priest.

**Mystics:** Personal combat **or** an active tracked boss fight enables wine,
including while healing out of combat. Boss tracking has been tested in game.
Other classes require personal combat.

To install, place
[module.json](https://raw.githubusercontent.com/pyureee/auto-wine/main/module.json)
in `mods/auto-wine`, then restart Toolbox and reconnect. Remaining files download
automatically. Automatic updates are enabled.

Commands in `/8` Toolbox chat:

- `wine` — show status and the next scheduled check.
- `wine on` / `wine off` — enable or disable.

Fuck Mystics
