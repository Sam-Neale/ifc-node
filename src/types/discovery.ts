/**
 * Device payload advertised by Infinite Flight on the local network.
 */
export interface InfiniteFlightDevice {
	/**
	 * Simulator state string advertised by the discovery packet.
	 */
	state: string;

	/**
	 * Stable device identifier from Infinite Flight.
	 */
	deviceId: string;

	/**
	 * Human-readable device name.
	 */
	deviceName: string;

	/**
	 * Aircraft name advertised by discovery.
	 */
	aircraft: string;

	/**
	 * Livery name advertised by discovery, or an empty string when unavailable.
	 */
	livery: string;

	/**
	 * Infinite Flight version string.
	 */
	version: string;

	/**
	 * Address that can be used to reach the device.
	 */
	address: string;

	/**
	 * The port advertised by Infinite Flight.
	 * This will usually be the Connect API v1 port.
	 */
	advertisedPort: number;
}
