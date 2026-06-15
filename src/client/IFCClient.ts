import {
	discoverDevice,
	selectDeviceAddress,
} from "../connection/discoverDevice";
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
 * Replace these with confirmed common Connect API v2 states.
 */
const VALIDATION_STATES = [
	"aircraft/0/aircraft_id",
	"aircraft/0/latitude",
	"aircraft/0/longitude",
] as const;

export class IFCClient {
	private readonly protocol: ProtocolClient;
	private readonly states: StateRegistry;
	private readonly options: ResolvedIFCClientOptions;

	private connected = false;
	private connecting = false;

	private resolvedHost?: string;
	private discoveredDevice?: InfiniteFlightDevice;
	private connectionManifest?: ConnectionManifest;

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

	public get isConnected(): boolean {
		return this.connected;
	}

	public get isConnecting(): boolean {
		return this.connecting;
	}

	public get host(): string | undefined {
		return this.resolvedHost;
	}

	public get device(): InfiniteFlightDevice | undefined {
		return this.discoveredDevice;
	}

	public get manifest(): ReadonlyMap<string, ManifestEntry> {
		this.assertConnected();
		return this.protocol.getManifest();
	}

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

				this.resolvedHost = selectDeviceAddress(this.discoveredDevice);
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

	public async get(path: string): Promise<StateValue> {
		this.assertConnected();
		this.states.assertReadable(path);

		return this.protocol.read(path);
	}

	public async set(path: string, value: StateValue): Promise<void> {
		this.assertConnected();
		this.states.assertWritable(path);

		await this.protocol.write(path, value);
	}

	public async command(
		command: string,
		...args: CommandArgument[]
	): Promise<void> {
		this.assertConnected();

		await this.protocol.command(command, args);
	}

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

	private async readDuringValidation(path: string): Promise<StateValue> {
		this.states.assertReadable(path);

		return this.protocol.read(path);
	}

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

	private assertConnected(): void {
		if (!this.connected) {
			throw new NotConnectedError();
		}
	}
}
