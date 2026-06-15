/**
 * Legacy connection manifest type kept for direct imports from the connection
 * module.
 *
 * Prefer importing `ConnectionManifest` from the package root, which re-exports
 * the richer public type from `src/types/connection`.
 */
export interface ConnectionManifest {
	host: string;
	port: number;
	connectedAt: Date;

	aircraft: {
		type: string;
	};

	validation: {
		sampledStates: string[];
		responseTimeMs: number;
	};
}
