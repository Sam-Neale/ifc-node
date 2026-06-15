# IFC-node

`IFC-node` is a TypeScript/Node.js wrapper for the Infinite Flight Connect API. It provides a small high-level client for discovering an Infinite Flight device, opening a TCP connection, reading and writing Connect API states, invoking manifest-backed commands, and validating that the connection is talking to a live simulator session.

The package is intentionally thin. Infinite Flight exposes most capability through a per-aircraft manifest, so this library keeps the manifest available and lets you work with state paths directly instead of hiding the API behind a large, incomplete facade.

## What This Library Does

- Discovers Infinite Flight devices on the local network using the UDP discovery broadcast.
- Connects to the Connect API v2 TCP endpoint.
- Requests and parses the live Connect API manifest.
- Reads states by path.
- Writes states by path.
- Executes command entries from the manifest.
- Validates a new connection by sampling known aircraft and position states.
- Exposes connection metadata, the selected host, and the discovered device.
- Includes value converters for Infinite Flight units that are not standard user-facing units.

## Requirements

- Node.js 20 or newer.
- Infinite Flight running on a device reachable from the same network.
- Infinite Flight Connect enabled in the simulator.
- TCP access to the Connect API port.
- UDP access to the discovery port if you want automatic discovery.

## Installation

```sh
npm install ifc-node
```

For local development in this repository:

```sh
npm install
npm run build
```

## Quick Start

```ts
import { IFCClient, ValueConverters } from "ifc-node";

const client = new IFCClient();

const connection = await client.connect();

console.log(`Connected to ${connection.aircraft.type}`);
console.log(`Host: ${connection.host}:${connection.port}`);

const latitude = await client.get("aircraft/0/latitude");
const longitude = await client.get("aircraft/0/longitude");

console.log({ latitude, longitude });

const throttlePercent = 65;
const rawThrottle = ValueConverters.percentToThrottle(throttlePercent);

await client.set("aircraft/0/engines/0/throttle", rawThrottle);

await client.disconnect();
```

## Connecting

Create an `IFCClient` and call `connect()`.

```ts
import { IFCClient } from "ifc-node";

const client = new IFCClient();
const manifest = await client.connect();
```

When no `host` is provided, the client waits for an Infinite Flight discovery packet, selects the best advertised address, then connects to the configured Connect API port.

```ts
const client = new IFCClient({
	discoveryTimeout: 20_000,
});
```

If you already know the device address, pass it explicitly. This skips UDP discovery.

```ts
const client = new IFCClient({
	host: "192.168.1.42",
	port: 10112,
});
```

## Client Options

| Option              | Type     | Default     | Description                                                             |
| ------------------- | -------- | ----------- | ----------------------------------------------------------------------- |
| `host`              | `string` | `undefined` | Infinite Flight device host. If omitted, the client uses UDP discovery. |
| `port`              | `number` | `10112`     | Connect API v2 TCP port.                                                |
| `discoveryTimeout`  | `number` | `15000`     | How long automatic discovery waits before failing, in milliseconds.     |
| `connectionTimeout` | `number` | `5000`      | Reserved client-level connection timeout option, in milliseconds.       |
| `requestTimeout`    | `number` | `2000`      | Reserved client-level request timeout option, in milliseconds.          |

## Reading States

Use `get(path)` to read a Connect API state.

```ts
const altitude = await client.get("aircraft/0/altitude");
```

The value type depends on the manifest entry returned by Infinite Flight. Values may be `boolean`, `number`, `string`, or `bigint`.

```ts
import type { StateValue } from "ifc-node";

const value: StateValue = await client.get("aircraft/0/latitude");
```

## Writing States

Use `set(path, value)` to write a Connect API state.

```ts
await client.set("aircraft/0/autopilot/heading", 270);
```

The library encodes the outgoing value using the data type advertised by the manifest. If the JavaScript value does not match that manifest type, the request is rejected before bytes are written to the socket.

## Commands

Commands are manifest entries with the Connect API command marker instead of a state data type. Use `command(name)` to invoke one.

```ts
await client.command("aircraft/0/autopilot/toggle");
```

Connect API v2 command arguments are currently not supported by this implementation. Passing arguments will throw.

## Manifest Access

The live manifest is available after connection:

```ts
for (const [name, entry] of client.manifest) {
	console.log(entry.id, entry.dataType, name);
}
```

The manifest is useful for feature detection because the available states and commands can vary by aircraft and simulator version.

## Connection Metadata

`connect()` returns a `ConnectionManifest`:

```ts
const info = await client.connect();

console.log(info.aircraft.type);
console.log(info.validation.sampledStates);
console.log(info.validation.responseTimeMs);
```

The client also exposes:

- `client.isConnected`
- `client.isConnecting`
- `client.host`
- `client.device`
- `client.manifest`

## Infinite Flight Units And Converters

Some values exposed by Infinite Flight are not in the units or ranges a user interface normally displays. This is especially noticeable for controls such as throttle and for vertical speed conversions.

For that reason, `ifc-node` exports `ValueConverters`:

```ts
import { ValueConverters } from "ifc-node";

const rawThrottle = ValueConverters.percentToThrottle(75);
const displayedThrottle = ValueConverters.throttleToPercent(rawThrottle);

const metresPerMinute = ValueConverters.fpmToMpm(1_500);
const feetPerMinute = ValueConverters.mpmToFpm(metresPerMinute);
```

Current converters:

| Converter                    | Description                                                            |
| ---------------------------- | ---------------------------------------------------------------------- |
| `throttleToPercent(raw)`     | Converts Infinite Flight's raw throttle value into a 0-100 percentage. |
| `percentToThrottle(percent)` | Converts a 0-100 percentage into Infinite Flight's raw throttle value. |
| `fpmToMpm(fpm)`              | Converts feet per minute to metres per minute.                         |
| `mpmToFpm(mpm)`              | Converts metres per minute to feet per minute.                         |

See [docs/UNITS_AND_CONVERTERS.md](docs/UNITS_AND_CONVERTERS.md) for more detail.

## Errors

The package exports a small error hierarchy:

- `IFCNodeError`
- `ConnectionError`
- `ConnectionTimeoutError`
- `ConnectionValidationError`
- `NotConnectedError`
- `UnknownStateError`
- `StateReadOnlyError`
- `StateWriteOnlyError`
- `InvalidStateValueError`

Example:

```ts
import { IFCClient, NotConnectedError } from "ifc-node";

const client = new IFCClient();

try {
	await client.get("aircraft/0/latitude");
} catch (error) {
	if (error instanceof NotConnectedError) {
		console.error("Connect before reading states.");
	}
}
```

## Development

Build the package:

```sh
npm run build
```

Run tests:

```sh
npx vitest run
```

The package emits compiled JavaScript, declaration files, and source maps into `dist`.

## Repository Layout

```text
src/
  client/       High-level IFCClient facade.
  connection/   UDP discovery and connection metadata types.
  errors/       Error classes.
  proto/        Low-level Connect API socket protocol implementation.
  states/       State access metadata and validation.
  types/        Public TypeScript types.
```

## Additional Documentation

- [API reference](docs/API_REFERENCE.md)
- [Architecture notes](docs/ARCHITECTURE.md)
- [Units and converters](docs/UNITS_AND_CONVERTERS.md)

## Notes And Limitations

- The API surface is deliberately path-based because Infinite Flight's manifest is dynamic.
- Automatic discovery uses UDP port `15000`.
- The default Connect API v2 TCP port is `10112`.
- The advertised discovery port may refer to a different Connect API version, so the client uses its configured `port` option for the TCP connection.
- State access validation is conservative and only blocks paths that are known locally to be read-only or write-only.
- Always check the live manifest when building UI that depends on aircraft-specific features.
