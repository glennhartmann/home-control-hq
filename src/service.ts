// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Type definition for a parameter passed to service command.
export interface ServiceCommandParameter {
    // Unique identifier for the parameter. Should be all lower case.
    name: string;

    // Whether the parameter is optional. Defaults to false (thus required).
    optional?: boolean;

    // Type of data that should be passed in this parameter. Will be validated at parsing time.
    type: "boolean" | "number" | "string";
}

// Type definition for a command supported by a service. Descriptive so that issued commands can be
// well understood and visualized throughout the system.
export interface ServiceCommand {
    // Unique identifier of the command. Should be in "service-name-command-name" format.
    command: string;

    // Textual, human readable description of what the command does.
    description: string;

    // Handler function that should be called when the command has been issued.
    handler: (...parameters: any) => Promise<object>;

    // Array of parameters that are accepted by this command, or an empty array otherwise.
    parameters: Array<ServiceCommandParameter>;
}

// Base interface that all services have to support. Actual functionality and behaviour may differ,
// but should be abstracted from these foundations.
export interface Service {
    // Returns an array with the commands made available by this service. The data returned by this
    // method may be cached, and should not change during the service's lifetime.
    getCommands: () => Array<ServiceCommand>;

    // Returns the identifier that is unique to this service.
    getIdentifier: () => string;

    // Asynchronously initializes the service so that it's ready for use. A boolean is to be
    // returned to indicate whether the service is ready for use or not.
    initialize: () => Promise<boolean>;

    // Asynchronously validates the given |options|, that are specified in the home configuration
    // part of the server. Both syntactical and in-depth validation are acceptable.
    validate: (options: object) => Promise<boolean>;
}
