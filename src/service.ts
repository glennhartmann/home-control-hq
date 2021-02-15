// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Interface that enables services to broadcast command updates to all listening clients.
export interface ServiceBroadcaster {
    // Distributes the given |object| to all clients listening for the |command|.
    distribute: (command: string, parameters: Array<any>, message: object) => Promise<void>;
}

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

    // Whether the command can be subscribed to by clients. This means that broadcasts for the exact
    // command + parameters pair will reach any client who issued the request.
    subscribe?: boolean;
}

// Type definition for the routines supported by a service, i.e. behaviour that should be called
// at a particular interval. The Service Manager provides this functionality.
export interface ServiceRoutine {
    // The function that should be called at the configured cadence. [1, 86400)
    callbackFn: () => Promise<any>;

    // Textual description indicating what the routine is for.
    description: string;

    // Interval at which the routine should be called, specified in seconds.
    intervalSeconds: number;
}

// Base interface that all services have to support. Actual functionality and behaviour may differ,
// but should be abstracted from these foundations.
export interface Service {
    // Returns the identifier that is unique to this service.
    getIdentifier: () => string;

    // Returns an array with the commands made available by this service. The data returned by this
    // method may be cached, and should not change during the service's lifetime.
    getCommands: () => Array<ServiceCommand>;

    // Returns an array with the routines that this service depends on.
    getRoutines: () => Array<ServiceRoutine>;

    // ---------------------------------------------------------------------------------------------

    // Asynchronously initializes the service so that it's ready for use. A boolean is to be
    // returned to indicate whether the service is ready for use or not.
    initialize: (broadcast: ServiceBroadcaster) => Promise<boolean>;

    // Asynchronously validates the given |options|, that are specified in the home configuration
    // part of the server. Both syntactical and in-depth validation are acceptable.
    validate: (options: object) => Promise<boolean>;
}
