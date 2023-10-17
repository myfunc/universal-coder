import { Module } from "@nestjs/common";
import { ChatController } from "./controller/chat.controller";
import { ChatService } from "./chat.service";

@Module({
    controllers: [ChatController],
    providers: [ChatService],
})
export class AppModule {}
