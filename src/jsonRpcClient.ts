import * as readline from 'node:readline';
import { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from './protocol';

/**
 * JSON-RPC 2.0 客户端（stdio 传输）。
 *
 * 使用方式:
 *   const client = new JsonRpcClient(process);
 *   const result = await client.call('initialize', { protocolVersion: 1 });
 *   client.onNotification((method, params) => { ... });
 */
export class JsonRpcClient {
    private nextId = 1;
    private pending = new Map<number | string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    private notificationHandlers: Array<(method: string, params: unknown) => void> = [];
    private rl: readline.ReadLine;
    private closed = false;

    constructor(private stdin: NodeJS.WritableStream, stdout: NodeJS.ReadableStream) {
        this.rl = readline.createInterface({ input: stdout, crlfDelay: Infinity });
        this.rl.on('line', (line: string) => this.handleLine(line));
    }

    /** 发送请求，返回 Promise<result> */
    call(method: string, params?: unknown): Promise<unknown> {
        if (this.closed) throw new Error('RPC client closed');
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
            this.stdin.write(JSON.stringify(req) + '\n');
            this.setupTimeout(id, 120_000, reject);
        });
    }

    /** 注册通知处理器 */
    onNotification(handler: (method: string, params: unknown) => void): void {
        this.notificationHandlers.push(handler);
    }

    /** 关闭客户端 */
    close(): void {
        this.closed = true;
        this.rl.close();
        for (const [, { reject }] of this.pending) {
            reject(new Error('RPC client closed'));
        }
        this.pending.clear();
    }

    private handleLine(line: string): void {
        if (!line.trim()) return;
        let msg: JsonRpcResponse | JsonRpcNotification;
        try {
            msg = JSON.parse(line);
        } catch {
            return; // 跳过非 JSON 行（如 stderr 混入）
        }

        if ('method' in msg && !('result' in msg) && !('error' in msg)) {
            // 通知
            for (const handler of this.notificationHandlers) {
                try {
                    handler(msg.method, msg.params);
                } catch {}
            }
        } else if ('id' in msg) {
            // 响应
            const pending = this.pending.get(msg.id);
            if (pending) {
                this.pending.delete(msg.id);
                if (msg.error) {
                    pending.reject(new Error(`RPC error ${msg.error.code}: ${msg.error.message}`));
                } else {
                    pending.resolve(msg.result);
                }
            }
        }
    }

    private setupTimeout(id: number | string, ms: number, reject: (e: Error) => void): void {
        setTimeout(() => {
            if (this.pending.has(id)) {
                this.pending.delete(id);
                reject(new Error(`RPC timeout after ${ms}ms`));
            }
        }, ms);
    }
}
