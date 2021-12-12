import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { ConnectorsRegistryService } from '../connectors-registry/connectors-registry.service';
import { Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import * as Server from '@node-socket/server';
import { TEndMessage, TErrorMessage, TFirstMessage, TMessagesTypes, TNextMessage } from '@node-socket/interfaces';

@Injectable()
@WebSocketGateway({ transports: ['websocket'] })
export class GatewayService implements OnGatewayDisconnect {
    private readonly server: Server.ServerService;

    public constructor(
        connect: ConnectorsRegistryService,
    ) {
        this.server = new Server.ServerService(connect);
    }

    public handleDisconnect(client: any) {
        return this.server.handleDisconnect(client);
    }

    @Subscribe('first-message')
    public handleFirstMessage(@MessageBody() data: TFirstMessage, @ConnectedSocket() client: Socket) {
        return this.server.handleFirstMessage(data, client);
    }

    @Subscribe('next-message')
    public handleNextMessage(@MessageBody() data: TNextMessage, @ConnectedSocket() client: Socket) {
        return this.server.handleNextMessage(data, client);
    }

    @Subscribe('error-message')
    public handleErrorMessage(@MessageBody() data: TErrorMessage, @ConnectedSocket() client: Socket) {
        return this.server.handleErrorMessage(data, client);
    }

    @Subscribe('end-message')
    public handleEndMessage(@MessageBody() data: TEndMessage, @ConnectedSocket() client: Socket) {
        return this.server.handleEndMessage(data, client);
    }
}

function Subscribe(type: TMessagesTypes) {
    return SubscribeMessage(type);
}