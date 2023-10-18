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

        let response = await this.chatService.handleChatMessage(message, true);

        while (
            (response.includes("EXECUTE") ||
                response.includes("READ") ||
                response.startsWith(">")) &&
            !this.isPaused
        ) {
            response = await this.chatService.handleChatMessage(response);
        }

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
