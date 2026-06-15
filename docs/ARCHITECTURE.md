# Architecture

`ifc-node` is split into a small high-level client and a low-level protocol implementation.

```text
IFCClient
  |
  | resolves host, validates connection, exposes public API
  v
ProtocolClient
  |
  | owns TCP socket, manifest parsing, frame encoding/decoding
  v
Infinite Flight Connect API
```

## High-Level Flow

1. `IFCClient.connect()` starts the connection lifecycle.
2. If `host` is not configured, `discoverDevice()` listens for a UDP discovery packet.
3. `selectDeviceAddress()` picks a usable address from the discovered device.
4. `ProtocolClient.connect()` opens the TCP socket.
5. `ProtocolClient` requests the Connect API manifest using the reserved manifest ID.
6. The manifest is parsed into a `Map<string, ManifestEntry>`.
7. `IFCClient` validates the session by reading a few basic aircraft states.
8. The connection is marked ready and a `ConnectionManifest` is returned.

## Discovery

Discovery listens on UDP port `15000`.

The discovery packet is JSON and can include:

- Device ID
- Device name
- Aircraft
- Livery
- Infinite Flight version
- Candidate addresses
- Advertised port

The advertised port is preserved on `InfiniteFlightDevice`, but the TCP connection uses the client `port` option.

## Protocol Framing

Requests are sent as:

```text
4 bytes: little-endian signed state or command ID
1 byte:  hasData flag
N bytes: optional encoded payload for writes
```

Responses are read as:

```text
4 bytes: little-endian signed state or manifest ID
4 bytes: little-endian signed payload length
N bytes: payload
```

The TCP stream can split or combine frames, so `ProtocolClient` buffers incoming bytes and only processes complete frames.

## Manifest

The manifest is requested with ID `-1`.

Each valid manifest row includes:

```text
id,dataType,name
```

Data type `-1` means the entry is a command. Other data types are states.

## Reads

Reads send a request for the manifest ID associated with a path. Since responses include the state ID but no unique request token, pending reads are queued per state ID. The oldest pending read for that ID receives the next response.

## Writes

Writes send the same request header as reads, but with `hasData` set to true and an encoded payload appended.

Encoding is based on the manifest data type:

- Boolean: 1 byte.
- Integer: 32-bit little-endian signed integer.
- Float: 32-bit little-endian float.
- Double: 64-bit little-endian float.
- String: 32-bit little-endian byte length plus UTF-8 bytes.
- Long: 64-bit little-endian signed integer.

## Commands

Commands are manifest entries with data type `-1`. They are sent as request frames without payloads.

## State Metadata

The live manifest is the source of truth for available states and commands. `StateRegistry` is an extra local guardrail that can block reads or writes for states whose access mode is known ahead of time.

This local metadata can be incomplete without preventing access to manifest states. Unknown paths are passed through to the protocol layer, where the live manifest decides whether they are available.

## Units

Unit conversion is intentionally outside the protocol layer. The protocol layer encodes and decodes bytes. Application-facing helpers live in `ValueConverters`, where non-standard Infinite Flight units and ranges can be named clearly.
