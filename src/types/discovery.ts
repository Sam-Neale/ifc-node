// src/types/discovery.ts

export interface InfiniteFlightDevice {
	state: string;
	deviceId: string;
	deviceName: string;
	aircraft: string;
	livery: string;
	version: string;
	addresses: string[];

	/**
	 * The port advertised by Infinite Flight.
	 * This will usually be the Connect API v1 port.
	 */
	advertisedPort: number;
}
