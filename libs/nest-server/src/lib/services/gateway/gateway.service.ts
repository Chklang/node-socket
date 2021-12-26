import { Inject, Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Observable, of } from 'rxjs';
import { Socket } from 'socket.io';
import * as Server from '@node-socket/server';
import { TConnectorBase, TEndMessage, TErrorMessage, TFirstMessage, TMessagesTypes, TNextMessage } from '@node-socket/interfaces';
import { ConnectorsRegistryService } from '../connectors-registry/connectors-registry.service';
import { GatewayEventsListenerService } from '../gateway-events-listener/gateway-events-listener.service';

@Injectable()
@WebSocketGateway({ transports: ['websocket'] })
export class GatewayService implements OnGatewayDisconnect {
    private readonly server: Server.ServerService;

    public constructor(
        @Inject('SERVER_CONF')
        serverConf: Server.IServerParams,
        connect: ConnectorsRegistryService,
        private readonly gatewayEventsListenerService: GatewayEventsListenerService,
    ) {
        this.server = new Server.ServerService(serverConf, connect);
    }

    public handleDisconnect(client: Socket) {
        this.gatewayEventsListenerService.onDisconnect(client.id);
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

    public sendMessage<Connector extends TConnectorBase<any, any>>(type: string, messages$: Observable<Connector['request']>, clients: Observable<string[]> = of([])): Observable<Server.IBroadcastResponse<Connector['response']>> {
        return this.server.sendMessage(type, messages$, clients);
    }
}

function Subscribe(type: TMessagesTypes) {
    return SubscribeMessage(type);
}