import { INotification } from "../models";
import { ConditionalBreakpointTypes, OneApiDebugPane } from "./Enums";
type TestSuite = { breakpointType: ConditionalBreakpointTypes; paneToCheck: OneApiDebugPane };

/**
 * Expected notifications for missing extenions.
 */
export const expectedNotifications: Record<string, INotification> = {
    c_cppExt: {
        name: "C/C++",
        message : "No extension for C/C++ was found. Please install it to run Intel oneAPI launch configurations.",
        installButton : "Install C/C++ Extension"
    },
    env_config: {
        name: "Environment Configurator for Intel® oneAPI Toolkits",
        message : "Please install the \"Environment Configurator for Intel oneAPI Toolkits\" to configure your development environment.",
        installButton : "Environment Configurator for Intel oneAPI Toolkits"
    },
};

export const simdTestSuites = (() => {
    let outObj: TestSuite[] = [];

    Object.values(ConditionalBreakpointTypes).forEach((bpType) => {
        const obj: TestSuite[] = [];

        Object.values(OneApiDebugPane).forEach((pane) => {
            obj.push({ breakpointType: bpType, paneToCheck: pane });
        });
        outObj = outObj.concat(obj);
    });
    return outObj;
})();

/**
 * UNCOMMENT TO DISABLE!
 */
export const simdTestsToSkip: TestSuite[] = [
    // { breakpointType: ConditionalBreakpointTypes.SimdCommand, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
    // { breakpointType: ConditionalBreakpointTypes.SimdCommand, paneToCheck: OneApiDebugPane.HardwareInfo },
    // { breakpointType: ConditionalBreakpointTypes.SimdCommand, paneToCheck: OneApiDebugPane.SelectedLane },
    // { breakpointType: ConditionalBreakpointTypes.NativeCommand, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
    // { breakpointType: ConditionalBreakpointTypes.NativeCommand, paneToCheck: OneApiDebugPane.HardwareInfo },
    // { breakpointType: ConditionalBreakpointTypes.NativeCommand, paneToCheck: OneApiDebugPane.SelectedLane },
    // { breakpointType: ConditionalBreakpointTypes.SimdGui, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
    // { breakpointType: ConditionalBreakpointTypes.SimdGui, paneToCheck: OneApiDebugPane.HardwareInfo },
    // { breakpointType: ConditionalBreakpointTypes.SimdGui, paneToCheck: OneApiDebugPane.SelectedLane },
    // { breakpointType: ConditionalBreakpointTypes.NativeGui, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
    // { breakpointType: ConditionalBreakpointTypes.NativeGui, paneToCheck: OneApiDebugPane.HardwareInfo },
    // { breakpointType: ConditionalBreakpointTypes.NativeGui, paneToCheck: OneApiDebugPane.SelectedLane },
];