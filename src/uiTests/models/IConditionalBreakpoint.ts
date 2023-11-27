import { ConditionalBreakpointTypes } from "../utils/Consts";
import { IBreakpoint } from "./IBreakpoint";

/**
 * VsCode conditional breakpoint.
 */
export interface IConditionalBreakpoint extends IBreakpoint {
    type: ConditionalBreakpointTypes;
    condition: string;
}