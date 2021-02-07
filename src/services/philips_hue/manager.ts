// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Connection } from './connection';
import { LightGroup } from './light_group';
import { Logger } from '../../base/logger';

// Interface defining the structure of group state retrieved from the Philips Hue bridge. These
// values aren't being validated, so we rely on the Hue API not changing too much.
interface GroupState {
    action: object;     // tthe current light-like state of the group
    id: number;         // unique ID assigned to the group
    name: string;       // name of the group, as it appears in the app
    state: object;      // whether any or all lights in the group are on
}

// Manages the Philips Hue state as provided by the bridge. We think of lights in groups (either
// named groups or named rooms) that can be enabled and disabled together.
export class Manager {
    private connection: Connection;
    private groups: Map<string, LightGroup>;
    private logger: Logger;

    constructor(connection: Connection, logger: Logger) {
        this.connection = connection;
        this.groups = new Map();
        this.logger = logger;
    }

    // Returns an iterator providing access to all known LightGroup instances.
    getGroups() { return this.groups.values(); }

    // Returns the LightGroup instance for a group with the given |name|, if any.
    getGroup(name: string) { return this.groups.get(name); }

    // ---------------------------------------------------------------------------------------------

    // Updates the full Philips Hue state by issuing two API calls to the bridge: one to get all
    // groups, and one to get all scenes & their associated state.
    async update() {
        if (!this.connection.connected) {
            this.logger.warn('Unable to update Philips Hue state without an active connection.');
            return;
        }

        const updatedGroups = await this.updateGroups();
        const updatedScenes = await this.updateScenes();

        // (1a) Make sure that LightGroup instances exist and are up-to-date for all state. We are
        // strict in regards to group names and IDs, to avoid the wrong room being updated.
        for (const [ name, groupState ] of updatedGroups.entries()) {
            let instance = this.groups.get(name);
            let scenes = updatedScenes.get(groupState.id) ?? new Map();

            if (instance && instance.id !== groupState.id) {
                instance.processDelete();
                instance = undefined;
            }

            if (!instance) {
                instance = new LightGroup(groupState.id, name);
                this.groups.set(name, instance);
            }

            instance.processUpdate(groupState.action, scenes, groupState.state);
        }

        // (1b) Make sure that excess LightGroup instances are deleted.
        for (const [ name, instance ] of this.groups.entries()) {
            if (updatedGroups.has(name))
                continue;

            instance.processDelete();

            this.groups.delete(name);
        }
    }

    // Reads the groups from the Philips Hue bridge. Only named groups and rooms will be considered,
    // other types of groups (e.g. experience, zones) will be discarded.
    async updateGroups() {
        const groups: Map<string, GroupState> = new Map();

        const response = await this.connection.api.groups.getAll();
        for (const group of response) {
            if (!['LightGroup', 'Room', 'Zone'].includes(group.type))
                continue;

            groups.set(group.name, {
                action: group.action as object,
                id: group.id as number,
                name: group.name as string,
                state: group.state as object,
            });
        }

        return groups;
    }

    // Reads the scenes from the Philips Hue bridge. While theoretically free-form scenes are
    // possible, we will only consider GroupScene types for this interaction.
    async updateScenes() {
        const scenes: Map<number, Map<string, string>> = new Map();

        const response = await this.connection.api.scenes.getAll();
        for (const scene of response) {
            if (scene.type !== 'GroupScene')
                continue;

            const group = parseInt((scene as any).group, 10);
            if (!scenes.has(group))
                scenes.set(group, new Map());

            scenes.get(group)!.set(scene.name, `${scene.id}`);
        }

        return scenes;
    }
}
