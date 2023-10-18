import { Controller, Get, Post, Body, Res } from "@nestjs/common";
import { Response } from "express";
import { ChatService } from "../chat.service";
import { SseService } from "./sse.service";

@Controller("chat")
export class ChatController {
    private isPaused = false;

    constructor(
        private readonly chatService: ChatService,
        private readonly sseService: SseService
    ) {}

    @Post("query")
    async query(
        @Body("message") message: string,
        @Res() res: Response
    ): Promise<void> {
        this.isPaused = false;

        let response = "";
        do {
            const responseFromOpenAi = await this.chatService.queryOpenAI(
                message,
                true
            );
            response = await this.chatService.handleChatMessage(
                responseFromOpenAi
            );
            message = response;
        } while (
            (/EXECUTE (.+)\$END/.test(message) ||
                response.includes("READOUT") ||
                response.includes("READERR") ||
                response.startsWith(">") ||
                response.startsWith("$")) &&
            !this.isPaused
        );

        res.send({ response });
    }

    @Post("debug")
    async debug(
        @Body("message") message: string,
        @Res() res: Response
    ): Promise<void> {
        const response = this.chatService.handleChatMessage(message);

        res.send({ response });
    }

    @Post("pause")
    pause(@Res() res: Response): void {
        this.isPaused = true;
        res.send({ status: "Paused" });
    }

    @Get("chatMessages")
    chatMessages(@Res() res: Response): void {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders();

        this.sseService.addClient(res);

        res.on("close", () => {
            this.sseService.removeClient(res);
            res.end();
        });
    }
}
