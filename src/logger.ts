/** Celest 统一日志工具。所有输出自动带 [Celest] 前缀。 */

const TAG = '[Celest]';

export const logger = {
    info(...args: unknown[]): void {
        console.log(TAG, ...args);
    },
    warn(...args: unknown[]): void {
        console.warn(TAG, ...args);
    },
    error(...args: unknown[]): void {
        console.error(TAG, ...args);
    },
    /** 仅输出到 VS Code OutputChannel（未来 Phase 5 实现文件日志） */
    trace(...args: unknown[]): void {
        console.log(TAG, '[TRACE]', ...args);
    },
};
