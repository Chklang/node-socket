import { Socket } from 'socket.io';
import { Subject } from 'rxjs';
import { IErrorMessage, TEndMessage, TErrorMessage, TFirstMessage, TMessage, TNextMessage } from '@nest-socket/interfaces';
import { ConnectorsRegistryService } from './connectors-registry';

export class ServerService {

  public constructor(
    private readonly connectorsRegistry: ConnectorsRegistryService,
  ) { }

  private clients: Record<string, IClient> = {};

  public handleFirstMessage(data: TFirstMessage, client: Socket) {
    const service = this.connectorsRegistry.getConnector(data.content.subject);
    if (!service) {
      return this.createErrorMessage(data, 'Service ' + data.content.type + ' not found');
    }

    const requests$ = new Subject<TMessage>();
    let clientObject = this.clients[client.id];
    if (!clientObject) {
      clientObject = {
        socket: client,
        messages: {},
      };
      this.clients[client.id] = clientObject;
    }
    clientObject.messages[data.id] = requests$;

    service.onMessage(requests$).subscribe({
      next: (e) => {
        const message: TNextMessage = {
          id: data.id,
          content: {
            type: 'next-message',
            body: e,
          },
        };
        client.emit(message.content.type, message);
      },
      error: (e) => {
        const message: TErrorMessage = {
          id: data.id,
          content: {
            type: 'error-message',
            error: e,
          },
        };
        client.emit(message.content.type, message);
        delete clientObject.messages[data.id];
      },
      complete: () => {
        const message: TEndMessage = {
          id: data.id,
          content: {
            type: 'end-message',
          },
        };
        client.emit(message.content.type, message);
        delete clientObject.messages[data.id];
      }
    });
    requests$.next(data.content.body);
  }

  public handleNextMessage(data: TNextMessage, client: Socket) {
    const clientObject = this.clients[client.id];
    if (!clientObject) {
      return this.createErrorMessage(data, 'First message with id ' + data.id + ' never received');
    }
    const communicator = clientObject.messages[data.id];
    if (!communicator) {
      return this.createErrorMessage(data, 'First message with id ' + data.id + ' never received');
    }
    communicator.next(data.content.body);
  }

  public handleErrorMessage(data: TErrorMessage, client: Socket) {
    const clientObject = this.clients[client.id];
    if (!clientObject) {
      return this.createErrorMessage(data, 'First message with id ' + data.id + ' never received');
    }
    const communicator = clientObject.messages[data.id];
    if (!communicator) {
      return this.createErrorMessage(data, 'First message with id ' + data.id + ' never received');
    }
    communicator.error(data.content.error);
  }

  public handleEndMessage(data: TEndMessage, client: Socket) {
    const clientObject = this.clients[client.id];
    if (!clientObject) {
      return this.createErrorMessage(data, 'First message with id ' + data.id + ' never received');
    }
    const communicator = clientObject.messages[data.id];
    if (!communicator) {
      return this.createErrorMessage(data, 'First message with id ' + data.id + ' never received');
    }
    communicator.complete();
  }

  private createErrorMessage(from: TMessage, content: string): IErrorMessage {
    return {
      id: from.id,
      content: {
        type: 'error-message',
        error: content,
      }
    }
  }

  public handleDisconnect(client: Socket) {
    const clientObject = this.clients[client.id];
    if (!clientObject) {
      return;
    }
    delete this.clients[client.id];
    Object.keys(clientObject.messages).forEach((key) => {
      clientObject.messages[key].complete();
    });
  }
}

interface IClient {
  socket: Socket;
  messages: Record<string, Subject<TMessage>>;
}
