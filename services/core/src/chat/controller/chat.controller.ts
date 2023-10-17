import { Controller, Get, Post, Body, Res, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import * as sseStream from "sse-stream";
import { ChatService } from "../chat.service";

@Controller("chat")
export class ChatController {
    private sse: any;
    private isPaused = false;

    constructor(private readonly chatService: ChatService) {}

    @Post("query")
    async query(
        @Body("message") message: string,
        @Res() res: Response
    ): Promise<void> {
        this.isPaused = false;

        let response = await this.chatService.handleChatMessage(message);

        while (!response.startsWith("ASK") || !this.isPaused) {
            if (this.sse) {
                this.sse.write({
                    event: "message",
                    data: { message, response },
                });
            }

            message = response;
            response = await this.chatService.handleChatMessage(message);
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
        // res.flushHeaders();

        this.sse = sseStream(res.req);
        this.sse.pipe(res);
        res.on("close", () => {
            this.sse = null;
        });
    }
}
