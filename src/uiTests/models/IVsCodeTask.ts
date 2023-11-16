/**
 * VsCode task template.
 */
export interface IVsCodeTask {
    label: string;
    command: string;
    type: string;
    problemMatcher?: [];
}