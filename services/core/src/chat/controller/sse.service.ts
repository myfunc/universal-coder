import { Injectable } from "@nestjs/common";
import { Response } from "express";

@Injectable()
export class SseService {
    private clients: Response[] = [];

    addClient(client: Response): void {
        this.clients.push(client);
    }

    removeClient(client: Response): void {
        const index = this.clients.indexOf(client);
        if (index > -1) {
            this.clients.splice(index, 1);
        }
    }

    broadcast(data: any): void {
        this.clients.forEach((client) =>
            client.write(`data: ${JSON.stringify(data)}\n\n`)
        );
    }
}
