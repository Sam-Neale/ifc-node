/**
 * Known local access mode for a Connect API state.
 *
 * The live manifest says whether an entry is a state or command, but local
 * metadata can also describe whether known states are readable, writable, or
 * both.
 */
export type StateAccess = "read-only" | "write-only" | "read-write" | "unknown";

/**
 * JavaScript value types supported by the protocol encoder and decoder.
 */
export type StateValue = boolean | number | string | bigint;

/**
 * Optional local metadata for a Connect API state path.
 */
export interface StateDefinition {
	/**
	 * Manifest path, such as `aircraft/0/latitude`.
	 */
	path: string;

	/**
	 * Locally-known read/write capability.
	 */
	access: StateAccess;

	/**
	 * Human-readable data type hint.
	 */
	dataType?: string;
}
