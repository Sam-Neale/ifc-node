# API Reference

This reference covers the public package exports from `src/index.ts`.

## `IFCClient`

High-level client for the Infinite Flight Connect API.

```ts
import { IFCClient } from "ifc-node";
```

### Constructor

```ts
const client = new IFCClient(options);
```

`options` is optional.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `host` | `string` | `undefined` | Skips discovery when provided. |
| `port` | `number` | `10112` | Connect API v2 TCP port. |
| `discoveryTimeout` | `number` | `15000` | UDP discovery timeout in milliseconds. |
| `connectionTimeout` | `number` | `5000` | Reserved connection timeout option. |
| `requestTimeout` | `number` | `2000` | Reserved request timeout option. |

### `connect()`

```ts
const manifest = await client.connect();
```

Connects to Infinite Flight, loads the live manifest, validates aircraft identity and position states, then returns a `ConnectionManifest`.

Calling `connect()` while already connected returns the cached connection manifest. Calling it while another connection attempt is in progress throws.

### `disconnect()`

```ts
await client.disconnect();
```

Closes the TCP socket and clears all connection metadata. Safe to call when the connection is already closed.

### `get(path)`

```ts
const value = await client.get("aircraft/0/latitude");
```

Reads a Connect API state by manifest path. The returned value is decoded according to the manifest data type.

Possible value types:

- `boolean`
- `number`
- `string`
- `bigint`

### `set(path, value)`

```ts
await client.set("aircraft/0/autopilot/heading", 180);
```

Writes a Connect API state by manifest path. The value is encoded according to the live manifest data type.

Some Infinite Flight states use simulator-native values rather than common UI units. Use `ValueConverters` where appropriate.

### `command(command, ...args)`

```ts
await client.command("aircraft/0/autopilot/toggle");
```

Invokes a command entry from the manifest. Command arguments are rejected by the current implementation.

### Properties

| Property | Type | Description |
| --- | --- | --- |
| `isConnected` | `boolean` | True after connection validation succeeds. |
| `isConnecting` | `boolean` | True while `connect()` is in progress. |
| `host` | `string | undefined` | Resolved TCP host for the active connection. |
| `device` | `InfiniteFlightDevice | undefined` | Discovery device metadata when automatic discovery was used. |
| `manifest` | `ReadonlyMap<string, ManifestEntry>` | Live Connect API manifest. Requires a connection. |

## `ValueConverters`

```ts
import { ValueConverters } from "ifc-node";
```

Named helpers for Infinite Flight values that are not already in common application-facing units.

| Function | Input | Output |
| --- | --- | --- |
| `throttleToPercent(raw)` | Raw IF throttle value | Percentage |
| `percentToThrottle(percent)` | Percentage | Raw IF throttle value |
| `fpmToMpm(fpm)` | Feet per minute | Metres per minute |
| `mpmToFpm(mpm)` | Metres per minute | Feet per minute |

## Types

### `IFCClientOptions`

Options passed to `new IFCClient(options)`.

### `ConnectionManifest`

Connection metadata returned by `connect()`.

Fields:

- `host`
- `port`
- `connectedAt`
- `aircraft`
- `device`
- `discovery`
- `validation`

### `StateAccess`

```ts
type StateAccess = "read-only" | "write-only" | "read-write" | "unknown";
```

### `StateValue`

```ts
type StateValue = boolean | number | string | bigint;
```

### `StateDefinition`

Local metadata for a known state path.

## Errors

All package-specific errors extend `IFCNodeError`.

| Error | When it is used |
| --- | --- |
| `IFCNodeError` | Base class. |
| `ConnectionError` | Base connection class. |
| `ConnectionTimeoutError` | Connection timeout. |
| `ConnectionValidationError` | Validation reads failed or returned invalid data. |
| `NotConnectedError` | Operation requires an active connection. |
| `UnknownStateError` | Local metadata does not know a state. |
| `StateReadOnlyError` | Attempted write to a known read-only state. |
| `StateWriteOnlyError` | Attempted read from a known write-only state. |
| `InvalidStateValueError` | Value does not match an expected state type. |

