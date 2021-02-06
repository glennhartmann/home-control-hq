// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import fs from 'fs';
import writeFileAtomic from 'write-file-atomic';

import { Logger } from './logger';

// The key/value database used by the server. Backed by a JSON file, and usable through a Map-like
// interface in which all mutating methods are asynchronous.
export class Database {
    private database: Map<string, any>;

    private filename: string;
    private logger: Logger;

    constructor(logger: Logger, filename: string) {
        this.database = new Map();

        this.filename = filename;
        this.logger = logger;

        if (!fs.existsSync(filename))
            fs.writeFileSync(filename, '{}');

        this.loadDatabaseSync();
    }

    // Returns whether an element with the given |key| exists.
    has(key: string) {
        return this.database.has(key);
    }

    // Returns the value associated with the given |key|, if any, or |defaultValue| otherwise.
    get(key: string, defaultValue: any = undefined): Promise<any> {
        if (this.database.has(key))
            return this.database.get(key);

        return defaultValue;
    }

    // Writes the given |value| to the database for the given |key|.
    async set(key: string, value: any) {
        this.database.set(key, value);
        await this.saveDatabase();
    }

    // Deletes all data associated with the given |key| from the database.
    async delete(key: string) {
        if (!this.database.hasOwnProperty(key))
            return;

        this.database.delete(key);
        await this.saveDatabase();
    }

    // ---------------------------------------------------------------------------------------------

    // Synchronously loads the database from the filesystem. Synchronous.
    loadDatabaseSync() {
        try {
            const text = fs.readFileSync(this.filename, 'utf8');
            const data = JSON.parse(text);

            for (const key of Object.getOwnPropertyNames(data))
                this.database.set(key, data[key]);

            this.logger.debug(`Database has been initialized with ${this.database.size} entries.`);
        } catch (exception) {
            this.logger.error(`Unable to initialize the database due to an exception:`, exception);
        }
    }

    // Asynchronously saves the database to the filesystem.
    async saveDatabase() {
        const data: Record<string, any> = {};

        for (const [ key, value ] of this.database.entries())
            data[key] = value;

        try {
            await writeFileAtomic(this.filename, JSON.stringify(data));
        } catch (exception) {
            this.logger.error(`Unable to store the database due to an exception:`, exception);
        }
    }
}
