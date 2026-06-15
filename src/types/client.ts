/**
 * Options accepted by `IFCClient`.
 */
export interface IFCClientOptions {
	/**
	 * Infinite Flight device host or IP address.
	 *
	 * When omitted, the client listens for a UDP discovery packet and selects
	 * an address from the discovered device.
	 */
	host?: string;

	/**
	 * Connect API v2 TCP port.
	 */
	port?: number;

	/**
	 * Maximum time to wait for automatic UDP discovery, in milliseconds.
	 */
	discoveryTimeout?: number;

	/**
	 * Maximum time reserved for connection setup, in milliseconds.
	 */
	connectionTimeout?: number;

	/**
	 * Maximum time reserved for individual protocol requests, in milliseconds.
	 */
	requestTimeout?: number;
}

/**
 * Client options after defaults have been applied.
 */
export interface ResolvedIFCClientOptions {
	host?: string;
	port: number;
	discoveryTimeout: number;
	connectionTimeout: number;
	requestTimeout: number;
}
