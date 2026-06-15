/**
 * Metadata returned after a successful Infinite Flight connection.
 *
 * This is produced only after the socket is connected, the manifest has loaded,
 * and validation states have been read successfully.
 */
export interface ConnectionManifest {
	/**
	 * Host selected for the TCP connection.
	 */
	host: string;

	/**
	 * TCP port used for the Connect API connection.
	 */
	port: number;

	/**
	 * Time at which validation completed.
	 */
	connectedAt: Date;

	aircraft: {
		/**
		 * Aircraft type returned by the validation state.
		 */
		type: string;

		/**
		 * Livery advertised by UDP discovery, when discovery was used.
		 */
		livery?: string;
	};

	/**
	 * Device details advertised by Infinite Flight discovery.
	 *
	 * This is omitted when the caller provided a host explicitly.
	 */
	device?: {
		id: string;
		name: string;
		version: string;
	};

	/**
	 * Discovery information for the connection.
	 */
	discovery: {
		/**
		 * True when the host was resolved from UDP discovery.
		 */
		automatic: boolean;
	};

	/**
	 * Details about the validation reads performed during connection setup.
	 */
	validation: {
		sampledStates: string[];
		responseTimeMs: number;
	};
}
