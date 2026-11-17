'use strict';

module.exports = function migrateSettings(_fromVersion, _toVersion, settings) {
    return { enabled: !settings || settings.enabled !== false };
};
