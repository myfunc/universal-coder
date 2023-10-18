import { spawn } from "child_process";

export class Terminal {
    private shell;
    private stdoutHistory: string[] = [];
    private stderrHistory: string[] = [];
    private exitCode = 0;
    private inProgress = false;

    constructor() {
        this.shell = spawn("bash");

        this.shell.stdin.write(`cd /workspaces/chat\n`);

        this.shell.stderr.on("data", (data) => {
            this.stderrHistory.push(data.toString());
            console.error(`STDERR: ${data}`);
        });

        this.shell.on("exit", (code) => {
            this.exitCode = code;
            console.log(`EXITCODE: ${code}`);
        });
    }

    private generateMarker(): string {
        return `MARKER_${Math.random().toString(36).substr(2, 9)}`;
    }

    private escapeNewLine(command: string) {
        return command.replace(/\n/g, "\\n");
    }

    async exec(command: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const marker = this.generateMarker();
            this.inProgress = true;
            console.log(`COMMAND: ${command}`);
            let lastLine = "";
            this.shell.stdin.write(
                `${this.escapeNewLine(command)}; echo ${marker}\n`
            );

            const onDataMemory = (data: Buffer) => {
                const strData = data.toString();
                if (!strData.includes(marker)) {
                    lastLine = strData.toString();
                }
            };

            const onData = (data: Buffer) => {
                const strData = data.toString();
                console.log(`STDOUT: ${data}`);

                if (strData.includes(marker)) {
                    this.inProgress = false;
                    this.shell.stdout.off("data", onData);
                    this.shell.stdout.off("data", onDataMemory);
                    this.shell.stderr.off("data", onDataMemory);
                    resolve(lastLine);
                } else {
                    this.stdoutHistory.push(strData);
                }
            };

            setTimeout(() => {
                resolve("$Running");
            }, 5000);

            this.shell.stdout.on("data", onDataMemory);
            this.shell.stderr.on("data", onDataMemory);
            this.shell.stdout.on("data", onData);
        });
    }

    isInProgress(): boolean {
        return this.inProgress;
    }

    cancelCurrentCommand(): void {
        this.shell.kill("SIGINT");
    }

    getLastExitCode(): number | null {
        return this.exitCode;
    }

    getStdOutLines(limit: number, skip: number): string[] {
        const lines = this.stdoutHistory;
        const linesToReturn =
            skip === 0
                ? lines.slice(-limit)
                : lines.slice(-limit - skip, -skip);
        return linesToReturn;
    }

    getStdErrLines(limit: number, skip: number): string[] {
        const lines = this.stderrHistory;
        const linesToReturn =
            skip === 0
                ? lines.slice(-limit)
                : lines.slice(-limit - skip, -skip);
        return linesToReturn;
    }
}
