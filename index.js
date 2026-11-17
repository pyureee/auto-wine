'use strict';

const REFRESH_BEFORE_MS = 5000;
const CONFIRMATION_WAIT_MS = 5000;
const MAX_TIMEOUT_MS = 2147483647;

const PHYSICAL = Object.freeze({ name: 'Physical Wine', itemId: 986420, buffId: 70258 });
const MAGIC = Object.freeze({ name: 'Magic Wine', itemId: 986421, buffId: 70259 });
const WINES = [PHYSICAL, MAGIC];
const CLASS_WINE = Object.freeze({
    warrior: PHYSICAL,
    berserker: PHYSICAL,
    glaiver: PHYSICAL,
    lancer: PHYSICAL,
    archer: PHYSICAL,
    slayer: PHYSICAL,
    fighter: PHYSICAL,
    sorcerer: MAGIC,
    soulless: MAGIC,
    engineer: MAGIC,
    assassin: MAGIC,
    elementalist: MAGIC,
    priest: MAGIC
});

exports.NetworkMod = function AutoWine(mod) {
    const game = mod.game;
    game.initialize(['inventory', 'me.abnormalities']);
    const me = game.me;
    const inventory = game.inventory;
    const listeners = [];
    const cooldowns = new Map();
    const npcStates = new Map();
    const bossIds = new Set();
    let bossFightActive = false;
    let timer = null;
    let nextCheckAt = null;
    let retryAt = 0;
    let location = null;
    let heading = 0;
    let waitingForInventory = false;
    let waitingForLocation = false;
    let loading = game.isInLoadingScreen;
    let destroyed = false;

    function listen(emitter, event, callback) {
        emitter.on(event, callback);
        listeners.push([emitter, event, callback]);
    }

    function stopTimer() {
        if (timer !== null) mod.clearTimeout(timer);
        timer = null;
        nextCheckAt = null;
        waitingForInventory = false;
        waitingForLocation = false;
    }

    function reset() {
        stopTimer();
        cooldowns.clear();
        resetBossTracking();
        retryAt = 0;
        location = null;
        heading = 0;
        loading = game.isInLoadingScreen;
    }

    function canUse() {
        return !destroyed && mod.settings.enabled && game.isIngame &&
            !loading && !game.isInLoadingScreen &&
            (me.inCombat || (isMystic() && bossFightActive)) && me.alive && !me.mounted;
    }

    function isMystic() {
        return me.class === 'elementalist';
    }

    function resetBossTracking() {
        npcStates.clear();
        bossIds.clear();
        bossFightActive = false;
    }

    function updateBossFight() {
        const active = isMystic() && [...bossIds].some(id => npcStates.get(id) === 2);
        if (active !== bossFightActive) {
            bossFightActive = active;
            reconsider();
        }
    }

    function selectedWine() {
        return Object.prototype.hasOwnProperty.call(CLASS_WINE, me.class) ? CLASS_WINE[me.class] : null;
    }

    function wineExpiresAt(wine) {
        const buff = wine && me.abnormalities[wine.buffId];
        return buff ? Number(buff.until) : 0;
    }

    function findWine(wine) {
        return inventory.items.find(item => item.container === 0 &&
            item.id === wine.itemId && item.amount > 0);
    }

    function scheduleAt(when) {
        const delay = Math.max(1, Math.min(MAX_TIMEOUT_MS, when - Date.now()));
        nextCheckAt = Date.now() + delay;
        timer = mod.setTimeout(() => {
            timer = null;
            nextCheckAt = null;
            reconsider();
        }, delay);
    }

    function reconsider() {
        stopTimer();
        if (!canUse()) return;
        const wine = selectedWine();
        if (!wine) return;

        const now = Date.now();
        const refreshAt = wineExpiresAt(wine) - REFRESH_BEFORE_MS;
        if (refreshAt > now) {
            scheduleAt(refreshAt);
            return;
        }

        const availableAt = Math.max(retryAt, cooldowns.get(wine.itemId) || 0);
        if (availableAt > now) {
            scheduleAt(availableAt);
            return;
        }

        const item = findWine(wine);
        if (!item) {
            waitingForInventory = true;
            return;
        }
        if (!location) {
            waitingForLocation = true;
            return;
        }

        retryAt = now + CONFIRMATION_WAIT_MS;
        scheduleAt(retryAt);
        try {
            mod.send('C_USE_ITEM', 3, {
                gameId: me.gameId,
                id: wine.itemId,
                dbid: item.dbid,
                target: 0n,
                amount: 1,
                dest: { x: 0, y: 0, z: 0 },
                loc: location,
                w: heading,
                unk1: 0,
                unk2: 0,
                unk3: 0,
                unk4: true
            });
        } catch (error) {
            mod.error(`Could not use ${wine.name}: ${error.message}`);
        }
    }

    function updateLocation(event) {
        location = { x: event.loc.x, y: event.loc.y, z: event.loc.z };
        heading = event.w;
        if (waitingForLocation) reconsider();
    }

    function isWineItem(id) {
        return WINES.some(wine => wine.itemId === id);
    }

    function isWineBuff(id) {
        return WINES.some(wine => wine.buffId === id);
    }

    function beginLoading() {
        loading = true;
        stopTimer();
        resetBossTracking();
        location = null;
    }

    const observe = { filter: { fake: null, silenced: null } };
    const serverWine = { order: 10000, filter: { fake: false, silenced: null } };
    mod.hook('S_LOAD_TOPO', 'event', { order: -20000 }, beginLoading);
    mod.hook('C_PLAYER_LOCATION', 5, observe, updateLocation);
    mod.hook('S_SPAWN_ME', 3, observe, event => {
        updateLocation(event);
        reconsider();
    });
    mod.hook('S_INSTANT_MOVE', 3, observe, event => {
        if (me.is(event.gameId)) updateLocation(event);
    });

    mod.hook('C_USE_ITEM', 3, { order: 10000, filter: { fake: false } }, event => {
        if (!isWineItem(event.id)) return;
        retryAt = Date.now() + CONFIRMATION_WAIT_MS;
        reconsider();
    });
    const onWineBuff = event => {
        if (me.is(event.target) && isWineBuff(event.id)) reconsider();
    };
    mod.hook('S_ABNORMALITY_BEGIN', mod.majorPatchVersion <= 106 ? 4 : 5, serverWine, onWineBuff);
    mod.hook('S_ABNORMALITY_REFRESH', 2, serverWine, onWineBuff);
    mod.hook('S_ABNORMALITY_END', 1, serverWine, onWineBuff);
    mod.hook('S_START_COOLTIME_ITEM', 1, serverWine, event => {
        if (!isWineItem(event.item)) return;
        cooldowns.set(event.item, Date.now() + Math.max(0, event.cooldown) * 1000);
        reconsider();
    });

    mod.hook('S_SPAWN_NPC', 11, serverWine, event => {
        if (!isMystic() || !game.isIngame) return;
        if (event.replaceId) {
            npcStates.delete(event.replaceId);
            bossIds.delete(event.replaceId);
        }
        npcStates.set(event.gameId, event.status);
        updateBossFight();
    });
    mod.hook('S_BOSS_GAGE_INFO', 3, serverWine, event => {
        if (!isMystic() || !game.isIngame || !event.id) return;
        if (event.curHp <= 0n) {
            npcStates.set(event.id, 4);
            bossIds.delete(event.id);
        } else if (event.maxHp > 0n) {
            bossIds.add(event.id);
        }
        updateBossFight();
    });
    mod.hook('S_NPC_STATUS', 2, serverWine, event => {
        if (!isMystic() || !game.isIngame) return;
        npcStates.set(event.gameId, event.status);
        updateBossFight();
    });
    mod.hook('S_DESPAWN_NPC', 3, serverWine, event => {
        if (!isMystic()) return;
        npcStates.delete(event.gameId);
        bossIds.delete(event.gameId);
        updateBossFight();
    });
    mod.hook('S_CREATURE_LIFE', 3, serverWine, event => {
        if (!isMystic() || event.alive || !bossIds.has(event.gameId)) return;
        npcStates.set(event.gameId, 4);
        updateBossFight();
    });

    listen(me, 'enter_combat', reconsider);
    listen(me, 'leave_combat', reconsider);
    listen(me, 'die', stopTimer);
    listen(me, 'resurrect', reconsider);
    listen(me, 'mount', stopTimer);
    listen(me, 'dismount', reconsider);
    listen(me, 'change_template', () => {
        resetBossTracking();
        reconsider();
    });
    listen(game, 'enter_loading_screen', beginLoading);
    listen(game, 'leave_loading_screen', () => {
        loading = false;
        reconsider();
    });
    listen(game, 'enter_game', reset);
    listen(game, 'leave_game', reset);
    listen(inventory, 'update', () => {
        if (waitingForInventory) reconsider();
    });

    function setEnabled(enabled) {
        mod.settings.enabled = enabled;
        mod.saveSettings();
        reconsider();
        mod.command.message(`Auto Wine ${enabled ? 'enabled' : 'disabled'}.`);
    }

    function status() {
        const wine = selectedWine();
        const remaining = Math.max(0, Math.ceil((wineExpiresAt(wine) - Date.now()) / 1000));
        const amount = wine ? inventory.items.reduce((total, item) =>
            total + (item.container === 0 && item.id === wine.itemId ? item.amount : 0), 0) : 0;
        const scheduled = nextCheckAt === null ? 'none' : `${Math.max(0, Math.ceil((nextCheckAt - Date.now()) / 1000))}s`;
        mod.command.message(`Auto Wine: ${mod.settings.enabled ? 'on' : 'off'} | ` +
            `${wine ? wine.name : 'unknown class'} | inventory: ${amount} | ` +
            `wine buff: ${remaining}s | combat: ${me.inCombat ? 'yes' : 'no'} | ` +
            `boss fight: ${isMystic() ? (bossFightActive ? 'yes' : 'no') : 'n/a'} | next check: ${scheduled}.`);
    }

    mod.command.add(['wine', 'autowine'], {
        $none: status,
        $default: () => mod.command.message('Usage: wine [on|off|status]'),
        on: () => setEnabled(true),
        off: () => setEnabled(false),
        status
    });

    this.destructor = () => {
        destroyed = true;
        stopTimer();
        resetBossTracking();
        for (const [emitter, event, callback] of listeners) emitter.removeListener(event, callback);
        mod.command.remove(['wine', 'autowine']);
    };

    reconsider();
};
