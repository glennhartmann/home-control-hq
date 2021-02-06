# Home Control HQ
Node-based server powering my smart home controllers and services.

The [server](src/), written in TypeScript, serves the [frontend](public/) over HTTP to a number of
controller devices across our house, and maintains the ability to interact with a series of smart
home services such as Philips Hue and Tado.

A WebSocket connection is then used to establish a long-lived bidirectional communication channel
between the controllers and the server, either to communicate commands ("turn the lights on") or to
communicate state updates ("something else changed the lights").

The server runs on a Raspberry Pi 4, whereas the controllers are physical 1024x768 displays mounted
on the wall. They run [WebLayer](https://source.chromium.org/chromium/chromium/src/+/master:weblayer/?ss=chromium)
based on Chromium 90. Each display controls a single room.
