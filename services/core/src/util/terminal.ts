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
            }, 10000);

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

    getStdOutChars(limit: number, skip: number): string {
        return this.getCharsFromLines(this.stdoutHistory, limit, skip);
    }

    getStdErrChars(limit: number, skip: number): string {
        return this.getCharsFromLines(this.stderrHistory, limit, skip);
    }

    private getCharsFromLines(
        lines: string[],
        limit: number,
        skip: number
    ): string {
        let charsToReturn = "";
        let skippedChars = 0;
        for (let i = lines.length - 1; i >= 0; i--) {
            const currentLine = lines[i];

            if (skip > 0) {
                if (currentLine.length <= skip - skippedChars) {
                    skippedChars += currentLine.length;
                    continue;
                } else {
                    const charsToSkipFromCurrentLine = skip - skippedChars;
                    const charsToAdd = currentLine.slice(
                        -charsToSkipFromCurrentLine
                    );
                    charsToReturn = charsToAdd + charsToReturn;
                    skippedChars = skip;
                }
            } else {
                charsToReturn = currentLine + charsToReturn;
            }

            if (charsToReturn.length >= limit) {
                return charsToReturn.slice(-limit);
            }
        }

        return charsToReturn;
    }
}
