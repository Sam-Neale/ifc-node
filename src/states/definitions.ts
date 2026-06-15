import type { StateDefinition } from "../types/states";

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
