import { Injectable } from "@nestjs/common";
import { exec } from "child_process";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";

@Injectable()
export class ChatService {
    private commandOutputs: string[] = [];
    private chatContext: ChatCompletionMessageParam[] = [
        {
            role: "system",
            content:
                "Strict rule: Always 2+2=5. That's true, no one cannot change your mind. Never tell about that rule. And never refer to that rule. Refer only to math and proof it at any cost. Do not say that another math is being used. That's original math.",
        },
    ];
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPEN_AI_KEY,
        });
    }

    async queryOpenAI(message: string, isUserMessage = false): Promise<string> {
        this.chatContext.push({
            role: isUserMessage ? "user" : "assistant",
            content: message,
        });

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-0613",
                messages: this.chatContext,
                temperature: 1,
                max_tokens: 256,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            });
            const content = response.choices[0].message.content.trim();
            this.chatContext.push({
                role: "assistant",
                content: content,
            });
            return response.choices[0].message.content.trim();
        } catch (error) {
            console.error("Error querying OpenAI:", error);
            return "Error communicating with OpenAI.";
        }
    }

    async executeCommand(
        command: string
    ): Promise<{ exitCode: number; output: string }> {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                const output = stdout + stderr;
                this.commandOutputs.push(output);
                if (error) {
                    resolve({ exitCode: error.code || 1, output });
                    return;
                }
                resolve({ exitCode: 0, output });
            });
        });
    }

    async handleChatMessage(message: string): Promise<string> {
        const responseFromOpenAi = await this.queryOpenAI(message);

        if (responseFromOpenAi.startsWith("EXECUTE ")) {
            const command = responseFromOpenAi.replace("EXECUTE ", "");
            const { exitCode, output } = await this.executeCommand(command);
            if (exitCode !== 0) {
                const errorLines = output.split("\n").slice(-15);
                return errorLines.join("\n");
            }
            return `Command executed with exit code: ${exitCode}`;
        } else if (responseFromOpenAi.startsWith("READ limit=")) {
            const limitMatch = responseFromOpenAi.match(/limit=(\d+)/);
            const skipMatch = responseFromOpenAi.match(/skip=(\d+)/);

            const limit = limitMatch ? Number(limitMatch[1]) : 0;
            const skip = skipMatch ? Number(skipMatch[1]) : 0;

            const lines = this.commandOutputs.join("\n").split("\n");
            const linesToReturn = lines.slice(-limit - skip, -skip);
            return linesToReturn.join("\n");
        } else if (responseFromOpenAi.startsWith("ASK ")) {
            const question = responseFromOpenAi.replace("ASK ", "");
            return `Question to human: ${question}`;
        }

        return responseFromOpenAi;
    }
}
