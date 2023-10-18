import { Injectable } from "@nestjs/common";
import { exec } from "child_process";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { SseService } from "./controller/sse.service";

@Injectable()
export class ChatService {
    private commandOutputs: string[] = [];
    private chatContext: ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: `You are a programmer who can:
                - Can execute any command in command line with command "EXECUTE [input]" and get exit code in the next query.
                - Can read console output. That any user query starts with ">" sign - is console output.
                - Can read last lines of console output. READ limit=[count of lines to read] skip=[skip count of lines].
                - Can read and write or update code/text to any file using command line. For update and write existing command prefer to use "sed" tool in EXECUTE.
                - Can ask question to human if something not obvious or wrong. Command ASK [question].
                
                EXECUTE command run command in ubuntu bash.
                Use commands for creating and editing files, compiling, and running code.
                In a single message, you can only execute one command. The EXECUTE and READ commands should only be used in the last line.
                If you receive a task, you ask questions if something is unclear.
                
                When everything is clear, you start the development process that follows this scenario:
                - Building a description of the solution architecture (selecting databases if needed, constructing an API schema, determining the complexity of the project).
                - Creating a development plan. If you see problems, you can ask
                - Creating tasks. And execute one at a time.
                - Development.
                - Launch and bug fixing.
                - Writing unit tests (if applicable) (take this step seriously and cover the most likely scenarios. You don't have to cover everything.
                - Running unit tests and fixing errors found during testing.`,
        },
    ];
    private openai: OpenAI;

    constructor(private readonly sseService: SseService) {
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
                messages: [
                    ...this.chatContext,
                    {
                        role: isUserMessage ? "user" : "assistant",
                        content: message,
                    },
                ],
                temperature: 1,
                max_tokens: 256,
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
                "Success request: " + JSON.stringify({ message, response })
            );

            this.sseService.broadcast({
                event: "message",
                data: { message, response },
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

    async handleChatMessage(
        message: string,
        isUserMessage = false
    ): Promise<string> {
        const responseFromOpenAi = await this.queryOpenAI(
            message,
            isUserMessage
        );

        const executeMatch = responseFromOpenAi.match(/EXECUTE (.+)/);
        if (executeMatch && executeMatch[1]) {
            const command = executeMatch[1].trim();
            const result = await this.executeCommand(command);
            return `> Exit code: ${result.exitCode}\n${result.output}`;
        }

        const readMatch = responseFromOpenAi.match(/READ (.+)/);
        if (readMatch && readMatch[1]) {
            const params = readMatch[1].trim();
            const limitMatch = params.match(/limit=(\d+)/);
            const skipMatch = params.match(/skip=(\d+)/);

            const limit = limitMatch ? Number(limitMatch[1]) : 0;
            const skip = skipMatch ? Number(skipMatch[1]) : 0;

            const lines = this.commandOutputs.join("\n").split("\n");
            const linesToReturn = lines.slice(-limit - skip, -skip);
            return ">" + linesToReturn.join("\n");
        }
        const askMatch = responseFromOpenAi.match(/READ (.+)/);
        if (askMatch && askMatch[1]) {
            return askMatch[1];
        }

        return responseFromOpenAi;
    }
}
