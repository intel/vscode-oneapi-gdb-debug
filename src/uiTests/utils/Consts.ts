import { INotification } from "./Interfaces";

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

/**
 * Thread properties.
 */
export const enum ThreadProperties {
    Id = "Id",
    Location = "Location"
}

/**
 * Conditional breakpoint types.
 */
export const enum ConditionalBreakpointTypes {
    SimdCommand = "SimdCommand",
    SimdGui = "SimdGui",
    NativeCommand = "NativeCommand",
    NativeGui = "NativeGui",
}