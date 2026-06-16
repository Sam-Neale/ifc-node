import { discoverDevice } from "../connection/discoverDevice";
import { ConnectionValidationError, NotConnectedError } from "../errors";
import { ProtocolClient } from "../proto/ProtocolClient";
import { StateRegistry } from "../states/StateRegistry";
import type { ManifestEntry } from "../proto/ProtocolClient";

import type { ConnectionManifest } from "../types/connection";
import type {
	IFCClientOptions,
	ResolvedIFCClientOptions,
} from "../types/client";
import type { CommandArgument } from "../types/commands";
import type { InfiniteFlightDevice } from "../types/discovery";
import type { StateValue } from "../types/states";

const DEFAULT_PORT = 10112;
const DEFAULT_DISCOVERY_TIMEOUT = 15_000;
const DEFAULT_CONNECTION_TIMEOUT = 5_000;
const DEFAULT_REQUEST_TIMEOUT = 2_000;

/**
 * States sampled during connection validation.
 *
 * These reads prove that the TCP socket is connected to an Infinite Flight
 * Connect API instance that can return aircraft identity and live position
 * data. They are deliberately basic states because validation should be cheap
 * and aircraft-agnostic.
 */
const VALIDATION_STATES = [
	"aircraft/0/aircraft_id",
	"aircraft/0/latitude",
	"aircraft/0/longitude",
] as const;

/**
 * High-level Infinite Flight Connect client.
 *
 * `IFCClient` owns the complete connection lifecycle:
 *
 * 1. Resolve a host directly from options or through UDP discovery.
 * 2. Open the Connect API v2 TCP socket.
 * 3. Request and cache the live aircraft manifest.
 * 4. Validate the connection by reading known aircraft states.
 * 5. Expose state reads, state writes, commands, and manifest inspection.
 *
 * The public API remains path-based because Connect API availability is
 * manifest-driven and can vary by aircraft and simulator version.
 */
export class IFCClient {
	private readonly protocol: ProtocolClient;
	private readonly states: StateRegistry;
	private readonly options: ResolvedIFCClientOptions;

	private connected = false;
	private connecting = false;

	private resolvedHost?: string;
	private discoveredDevice?: InfiniteFlightDevice;
	private connectionManifest?: ConnectionManifest;

	/**
	 * Create a client.
	 *
	 * Passing `host` skips UDP discovery. Omitting `host` lets the client wait
	 * for an Infinite Flight discovery broadcast and select the best advertised
	 * address automatically.
	 */
	public constructor(options: IFCClientOptions = {}) {
		this.options = {
			host: options.host,
			port: options.port ?? DEFAULT_PORT,
			discoveryTimeout: options.discoveryTimeout ?? DEFAULT_DISCOVERY_TIMEOUT,
			connectionTimeout:
				options.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT,
			requestTimeout: options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
		};

		this.protocol = new ProtocolClient();
		this.states = new StateRegistry();
	}

	/**
	 * Whether the client has completed connection and validation.
	 */
	public get isConnected(): boolean {
		return this.connected;
	}

	/**
	 * Whether a connection attempt is currently in progress.
	 */
	public get isConnecting(): boolean {
		return this.connecting;
	}

	/**
	 * The host selected for the active connection.
	 *
	 * This is either the configured `host` option or the address selected from
	 * UDP discovery results. It is cleared after disconnecting.
	 */
	public get host(): string | undefined {
		return this.resolvedHost;
	}

	/**
	 * The device returned by automatic discovery.
	 *
	 * This is only populated when the client discovered the host itself.
	 */
	public get device(): InfiniteFlightDevice | undefined {
		return this.discoveredDevice;
	}

	/**
	 * Live Connect API manifest for the current connection.
	 *
	 * The manifest maps state and command names to their numeric protocol IDs
	 * and data types. It is useful for aircraft-specific feature detection.
	 *
	 * @throws NotConnectedError when accessed before `connect()`.
	 */
	public get manifest(): ReadonlyMap<string, ManifestEntry> {
		this.assertConnected();
		return this.protocol.getManifest();
	}

	/**
	 * Connect to Infinite Flight and validate the resulting session.
	 *
	 * If a validated connection already exists, the cached connection manifest
	 * is returned. Concurrent connection attempts are rejected to avoid racing
	 * socket setup and manifest parsing.
	 *
	 * @returns Metadata about the connected aircraft, device, and validation.
	 */
	public async connect(): Promise<ConnectionManifest> {
		if (this.connectionManifest && this.connected) {
			return this.connectionManifest;
		}

		if (this.connecting) {
			throw new Error("A connection attempt is already in progress.");
		}

		this.connecting = true;
		this.connected = false;
		this.connectionManifest = undefined;

		try {
			const automaticDiscovery = !this.options.host;
			if (this.options.host) {
				this.resolvedHost = this.options.host;
			} else {
				this.discoveredDevice = await discoverDevice(
					this.options.discoveryTimeout,
				);
				this.resolvedHost = this.discoveredDevice.address;
			}
			await this.protocol.connect(this.resolvedHost, this.options.port);

			const manifest = await this.validateConnection(automaticDiscovery);

			this.connectionManifest = manifest;
			this.connected = true;

			return manifest;
		} catch (error) {
			await this.cleanUpFailedConnection();
			throw error;
		} finally {
			this.connecting = false;
		}
	}

	/**
	 * Close the underlying protocol socket and clear connection metadata.
	 *
	 * This method is idempotent and attempts cleanup even if the socket is
	 * already closed by the remote device.
	 */
	public async disconnect(): Promise<void> {
		try {
			await this.protocol.disconnect();
		} finally {
			this.connected = false;
			this.connecting = false;
			this.resolvedHost = undefined;
			this.discoveredDevice = undefined;
			this.connectionManifest = undefined;
		}
	}

	/**
	 * Read a Connect API state by path.
	 *
	 * The returned value is decoded according to the data type advertised by
	 * the live manifest.
	 *
	 * @throws NotConnectedError when called before `connect()`.
	 * @throws StateWriteOnlyError when local metadata knows the path is write-only.
	 */
	public async get(path: string): Promise<StateValue> {
		this.assertConnected();
		this.states.assertReadable(path);

		return this.protocol.read(path);
	}

	/**
	 * Write a Connect API state by path.
	 *
	 * Values are encoded according to the live manifest. Some Infinite Flight
	 * states use simulator-native units or ranges; use `ValueConverters` at the
	 * application boundary when a state expects one of those non-standard values.
	 *
	 * @throws NotConnectedError when called before `connect()`.
	 * @throws StateReadOnlyError when local metadata knows the path is read-only.
	 */
	public async set(path: string, value: StateValue): Promise<void> {
		this.assertConnected();
		this.states.assertWritable(path);

		await this.protocol.write(path, value);
	}

	/**
	 * Invoke a manifest-backed Connect API command.
	 *
	 * Connect API v2 commands are currently sent without arguments by the
	 * protocol implementation.
	 */
	public async command(
		command: string,
		...args: CommandArgument[]
	): Promise<void> {
		this.assertConnected();

		await this.protocol.command(command, args);
	}

	/**
	 * Read a small set of states that should be available in a valid session and
	 * package the result into a public connection manifest.
	 */
	private async validateConnection(
		automaticDiscovery: boolean,
	): Promise<ConnectionManifest> {
		if (!this.resolvedHost) {
			throw new ConnectionValidationError(
				"No Infinite Flight host was resolved.",
			);
		}

		const startedAt = Date.now();

		try {
			const [aircraftType, latitude, longitude] = await Promise.all(
				VALIDATION_STATES.map((path) => this.readDuringValidation(path)),
			);

			if (typeof aircraftType !== "string" || aircraftType.length === 0) {
				throw new ConnectionValidationError(
					"Infinite Flight returned an invalid aircraft type.",
				);
			}

			if (typeof latitude !== "number" || typeof longitude !== "number") {
				throw new ConnectionValidationError(
					"Infinite Flight returned invalid position data.",
				);
			}

			return {
				host: this.resolvedHost,
				port: this.options.port,
				connectedAt: new Date(),

				aircraft: {
					type: aircraftType,
					livery: this.discoveredDevice?.livery,
				},

				device: this.discoveredDevice
					? {
							id: this.discoveredDevice.deviceId,
							name: this.discoveredDevice.deviceName,
							version: this.discoveredDevice.version,
						}
					: undefined,

				discovery: {
					automatic: automaticDiscovery,
				},

				validation: {
					sampledStates: [...VALIDATION_STATES],
					responseTimeMs: Date.now() - startedAt,
				},
			};
		} catch (error) {
			if (error instanceof ConnectionValidationError) {
				throw error;
			}

			throw new ConnectionValidationError(
				error instanceof Error
					? `Could not validate the Infinite Flight connection: ${error.message}`
					: "Could not validate the Infinite Flight connection.",
			);
		}
	}

	/**
	 * Read a validation state without requiring `connected` to be true yet.
	 *
	 * The high-level connected flag is only set after validation succeeds, so
	 * validation reads go directly through the protocol client.
	 */
	private async readDuringValidation(path: string): Promise<StateValue> {
		this.states.assertReadable(path);

		return this.protocol.read(path);
	}

	/**
	 * Close any partially-opened protocol connection after setup fails.
	 */
	private async cleanUpFailedConnection(): Promise<void> {
		try {
			await this.protocol.disconnect();
		} catch {
			// Preserve the original connection error.
		}

		this.connected = false;
		this.resolvedHost = undefined;
		this.discoveredDevice = undefined;
		this.connectionManifest = undefined;
	}

	/**
	 * Guard operations that require an already validated connection.
	 */
	private assertConnected(): void {
		if (!this.connected) {
			throw new NotConnectedError();
		}
	}
}
