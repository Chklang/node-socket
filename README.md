# nest-socket

Project to simplify an implementation of bidirectionnal websocket with RXJS.

## @nest-socket/interfaces
Interfaces of messages sent between client and server

## @nest-socket/server
Generic implementation of the server. Two classes :
1. ServerService : The server implementation
2. ConnectorsRegistryService : The registry to register all listeners.
```typescript
// To use the ServerService, example of implementataion used in @nest-socket/server
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { ConnectorsRegistryService } from '../connectors-registry/connectors-registry.service';
import { Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import * as Server from '@nest-socket/server';
import { TEndMessage, TErrorMessage, TFirstMessage, TMessagesTypes, TNextMessage } from '@nest-socket/interfaces';

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
// Example of a service
export class EchoService implements IConnector<string, string> {
    public constructor(
        connectorRegistry: ConnectorsRegistryService,
    ) {
      connectorRegistry.register('echo', this);
    }
    public onMessage(requests: Observable<string>): Observable<string> {
        return requests.pipe(
            map((message) => 'Echo - ' + message),
        );
    }
}
```

## @nest-socket/client
Generic implementation of a client
1. SocketClient : The client
2. ConnectorsRegistryService : The registry if client must listen messages when server has the initiative (implementation like @nest-socket/server/ConnectorsRegistryService)

To use the client :
```typescript
// Create the client
const client = new SocketClient('http://127.0.0.1');
// Initialize a subject for requests
const echo$ = new Subject<string>();
// Use it to exchange messages
client.communicator.send<string, string>('echo', echo$).pipe(
  finalize(() => {
    console.log('Communication ended');
  }),
).subscribe((response) => {
  console.log('Received : ', response);
});
// Send messages
echo$.next('echo - 1');
echo$.next('echo - 2');
echo$.next('echo - 3');
// End of stream
echo$.complete();
```

## @nest-socket/nest-server
An simple implementation for nest. Port used is the default of application, and WebsocketGateway is configured to use 'webcosket' transports.
To use it :
```typescript
// module.ts
import { NestServerModule } from '@nest-socket/nest-server';
@Module({
  imports: [NestServerModule],
  providers: [
    EchoService,
    ...
  ],
})
export class AppModule {}

// The EchoService
import { Observable } from 'rxjs';
import { ConnectorsRegistryService } from '@nest-socket/nest-server';
import { IConnector } from '@nest-socket/server';

@Injectable()
export class EchoService implements IConnector<string, string> {
    public constructor(
        connectorRegistry: ConnectorsRegistryService,
    ) {
        connectorsRegistry.register('echo', this);
    }
    public onMessage(requests: Observable<string>): Observable<string> {
        return requests.pipe(
            map((message) => 'Echo - ' + message),
        );
    }
}

```