// Copyright 2021 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Base interface that all services have to support. Actual functionality and behaviour may differ,
// but should be abstracted from these foundations.
export interface Service {
    // Returns the identifier that is unique to this service.
    getIdentifier: () => string;

    // Asynchronously initializes the service so that it's ready for use. A boolean is to be
    // returned to indicate whether the service is ready for use or not.
    initialize: () => Promise<boolean>;

    // Asynchronously validates the given |options|, that are specified in the home configuration
    // part of the server. Both syntactical and in-depth validation are acceptable.
    validate: (options: object) => Promise<boolean>;
}
