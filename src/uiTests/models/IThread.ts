/**
 * Gpu thread.
 */
export interface IThread {
    threadId: number;
    targetId: string;
    location: string;
    workGroup: string;
    simdLanes: string[];
}