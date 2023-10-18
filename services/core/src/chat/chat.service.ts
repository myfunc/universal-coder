import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { SseService } from "./controller/sse.service";
import { Terminal } from "../util/terminal";
import { Wait } from "src/util/utils";
import { systemGpt } from "./consts";

@Injectable()
export class ChatService {
    private chatContext: ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: systemGpt,
        },
    ];
    private openai: OpenAI;
    private terminal: Terminal;

    constructor(private readonly sseService: SseService) {
        this.openai = new OpenAI({
            apiKey: process.env.OPEN_AI_KEY,
        });
        this.terminal = new Terminal();
    }

    async queryOpenAI(message: string, isUserMessage = false): Promise<string> {
        this.chatContext.push({
            role: isUserMessage ? "user" : "assistant",
            content: message,
        });
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    ...this.chatContext,
                    {
                        role: isUserMessage ? "user" : "assistant",
                        content: message,
                    },
                ],
                temperature: 0.2,
                max_tokens: 2048,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            });
            this.chatContext.push({
                role: isUserMessage ? "user" : "assistant",
                content: message,
            });
            const content = response.choices[0].message.content.trim();
            this.chatContext.push({
                role: "assistant",
                content: content,
            });

            console.log(
                "Success request: " +
                    JSON.stringify({
                        message,
                        response: response.choices[0].message.content.trim(),
                    })
            );

            this.sseService.broadcast({
                event: "message",
                data: {
                    message,
                    response: response.choices[0].message.content.trim(),
                },
            });

            return response.choices[0].message.content.trim();
        } catch (error) {
            console.error("Error querying OpenAI:", error);
            return "Error communicating with OpenAI.";
        }
    }

    async executeCommand(command: string): Promise<string> {
        try {
            const result = await this.terminal.exec(command);
            return result;
        } catch (error) {
            console.error(error);
            return "Error: " + error.message;
        }
    }

    async handleChatMessage(message: string): Promise<string> {
        const executeMatch = message.match(/EXECUTE (.+)\$END/s);
        if (executeMatch && executeMatch[1]) {
            const command = executeMatch[1].trim();
            const result = await this.executeCommand(command);
            return `>${result}`;
        }

        const sigingMatch = message.match(/SIGINT \$END/s);
        if (sigingMatch && sigingMatch[1]) {
            const command = sigingMatch[1].trim();
            const result = await this.executeCommand(command);
            return `>Stopped: ${result}`;
        }

        const readOutMatch = message.match(/READOUT (.+)/s);
        if (readOutMatch && readOutMatch[1]) {
            const params = readOutMatch[1].trim();
            const limitMatch = params.match(/limit=(\d+)/);
            const skipMatch = params.match(/skip=(\d+)/);

            const limit = limitMatch ? Number(limitMatch[1]) : 0;
            const skip = skipMatch ? Number(skipMatch[1]) : 0;

            const result = this.terminal.getStdOutChars(limit, skip);
            return ">" + result;
        }

        const readErrMatch = message.match(/READERR (.+)/s);
        if (readErrMatch && readErrMatch[1]) {
            const params = readErrMatch[1].trim();
            const limitMatch = params.match(/limit=(\d+)/);
            const skipMatch = params.match(/skip=(\d+)/);

            const limit = limitMatch ? Number(limitMatch[1]) : 0;
            const skip = skipMatch ? Number(skipMatch[1]) : 0;

            const result = this.terminal.getStdErrChars(limit, skip);
            return ">" + result;
        }

        const cronMatch = message.match(/CRON (.+) \$END/s);
        if (cronMatch && cronMatch[1]) {
            const params = cronMatch[1].trim();

            await Wait(parseInt(params));

            return `$IsInProgress: ${this.terminal.isInProgress()}`;
        }

        const askMatch = message.match(/ASK (.+)/s);
        if (askMatch && askMatch[1]) {
            return askMatch[1];
        }

        return message;
    }
}
