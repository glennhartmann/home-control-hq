// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import express, { Application } from 'express';

import { Logger } from '../base/logger';

// Options that must be configured when initializing the HTTP Server.
export interface HttpServerOptions {
    // Hostname on which the HTTP server should listen.
    hostname: string;

    // Port number on which the HTTP server should listen.
    port: number;

    // Qualified path to the `public` directory for static files.
    public?: string;
};

// Provides the HTTP server, backed by ExpressJS, through which the frontend of the smart home
// system will be served to the devices. HTTPS is not used because, well, it's local, and if someone
// has access to our network then they're welcome to the light switches too :)
export class HttpServer {
    private logger: Logger;
    private options: HttpServerOptions;

    private server: Application;

    constructor(logger: Logger, options: HttpServerOptions) {
        this.logger = logger;
        this.options = options;

        this.server = express();
        this.server.use((request, response, next) => {
            this.logger.debug(`HTTP Request from ${request.ip}: ${request.path}`);
            next();
        });

        if (options.public)
            this.server.use(express.static(options.public));
    }

    listen() {
        const { hostname, port } = this.options;

        this.server.listen(port, hostname, () => {
            this.logger.info(`The HTTP server is now listening on ${hostname}:${port}...`);
        });
    }
}
