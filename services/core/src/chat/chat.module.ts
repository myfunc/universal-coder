import { Module } from "@nestjs/common";
import { ChatController } from "./controller/chat.controller";
import { ChatService } from "./chat.service";
import { SseService } from "./controller/sse.service";

@Module({
    controllers: [ChatController],
    providers: [ChatService, SseService],
})
export class ChatModule {}
