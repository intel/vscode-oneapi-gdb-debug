import { ConditionalBreakpointTypes } from "../utils/Enums";
import { IBreakpoint } from "./IBreakpoint";

/**
 * VsCode conditional breakpoint.
 */
export interface IConditionalBreakpoint extends IBreakpoint {
    type: ConditionalBreakpointTypes;
    condition: string;
}