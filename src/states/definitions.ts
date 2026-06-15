import type { StateDefinition } from "../types/states";

/**
 * Local metadata for known Connect API states.
 *
 * This list is intentionally allowed to be incomplete. The live manifest is the
 * source of truth for availability, while local definitions add read/write
 * safety for states whose access mode is known ahead of time.
 */
export const stateDefinitions: StateDefinition[] = [
	{
		path: "aircraft/0/aircraft_type",
		access: "read-only",
		dataType: "string",
	},
	{
		path: "aircraft/0/latitude",
		access: "read-only",
		dataType: "double",
	},
	{
		path: "aircraft/0/longitude",
		access: "read-only",
		dataType: "double",
	},
	{
		path: "aircraft/0/autopilot/heading",
		access: "read-write",
		dataType: "float",
	},
];
