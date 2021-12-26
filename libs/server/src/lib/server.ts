import { Socket } from 'socket.io';
import { catchError, finalize, map, Observable, of, Subject, takeUntil } from 'rxjs';
import { IErrorMessage, TConnectorBase, TEndMessage, TErrorMessage, TFirstErrorMessage, TFirstMessage, TMessage, TNextMessage } from '@node-socket/interfaces';
import { ConnectorsRegistryService } from './connectors-registry';
import { IConnector } from '..';

export class ServerService {
  private autoIncrement = 0;
  private readonly messagesPrefix: string;

  private clients: Record<string, IClient> = {};
  private stopService$ = new Subject<void>();
  private messagesFromServer: Record<string, Subject<[TMessage, string]>> = {};

  public constructor(
    options: IServerParams,
    private readonly connectorsRegistry: ConnectorsRegistryService,
  ) {
    this.messagesPrefix = options.prefixMessages || 'server_';
  }

  public handleFirstMessage(data: TFirstMessage, client: Socket) {
    this.initCommunication(data, client)?.next(data.content.body);
  }

  public handleFirstErrorMessage(data: TFirstErrorMessage, client: Socket) {
    this.initCommunication(data, client)?.error(data.content.error);
  }

  private initCommunication(data: TFirstMessage | TFirstErrorMessage, client: Socket): Subject<TMessage> | undefined {
    const service = this.connectorsRegistry.getConnector(data.content.subject);
    if (!service) {
      this.createErrorMessage(data, 'Service ' + data.content.type + ' not found', client);
      return;
    }

    const requests$ = new Subject<TMessage>();
    let clientObject = this.clients[client.id];
    if (!clientObject) {
      clientObject = {
        socket: client,
        messages: {},
        alreadyClosed: false,
      };
      this.clients[client.id] = clientObject;
    }
    clientObject.messages[data.id] = requests$;

    service.onMessage(requests$, client.id).subscribe({
      next: (e) => {
        if (clientObject.alreadyClosed) {
          return;
        }
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
        if (clientObject.alreadyClosed) {
          return;
        }
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
        if (clientObject.alreadyClosed) {
          return;
        }
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
    return requests$;
  }

  private handleOthersMessages(data: TNextMessage | TErrorMessage | TEndMessage, client: Socket) {
    const fromBroadcast = this.messagesFromServer[data.id];
    const clientObject = this.clients[client.id];
    let useBoradcast = false;
    if (!clientObject) {
      if (!fromBroadcast) {
        this.createErrorMessage(data, 'First message with id ' + data.id + ' never received', client);
      } else {
        useBoradcast = true;
      }
    } else {
      const communicator = clientObject.messages[data.id];
      if (!communicator) {
        if (!fromBroadcast) {
          this.createErrorMessage(data, 'First message with id ' + data.id + ' never received', client);
        } else {
          useBoradcast = true;
        }
      } else {
        switch (data.content.type) {
          case 'next-message': {
            const typed = data as TNextMessage;
            communicator.next(typed.content.body);
            break;
          }
          case 'error-message': {
            clientObject.alreadyClosed = true;
            const typed = data as TErrorMessage;
            communicator.error(typed.content.error);
            break;
          }
          case 'end-message': {
            clientObject.alreadyClosed = true;
            communicator.complete();
            break;
          }
        }
      }
    }
    if (useBoradcast) {
      fromBroadcast.next([data, client.id]);
    }
  }

  public handleNextMessage(data: TNextMessage, client: Socket) {
    this.handleOthersMessages(data, client);
  }

  public handleErrorMessage(data: TErrorMessage, client: Socket) {
    this.handleOthersMessages(data, client);
  }

  public handleEndMessage(data: TEndMessage, client: Socket) {
    this.handleOthersMessages(data, client);
  }

  private createErrorMessage<T>(from: TMessage, content: T, client: Socket): void {
    const message: TErrorMessage = {
      id: from.id,
      content: {
        type: 'error-message',
        error: content,
      }
    }
    client.emit(message.content.type, message);
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

  private getClients(id: string[]): IClient[] {
    return id.map((e) => this.clients[e]).filter(e => !!e);
  }
  private getAllClients(): IClient[] {
    return Object.keys(this.clients).map((key) => this.clients[key]);
  }
  public sendMessage<Connector extends TConnectorBase<any, any>>(type: string, messages$: Observable<Connector['request']>, clients: Observable<string[]> = of([])): Observable<IBroadcastResponse<Connector['response']>> {
    const currentId = this.messagesPrefix + (this.autoIncrement++);
    const responses$ = new Subject<[TMessage, string]>();
    this.messagesFromServer[currentId] = responses$;
    const clientsThatReceiveTheFirstMessage: Record<string, boolean> = {};
    let clientsToSend: string[] | undefined = undefined;
    const stopThisThread$ = new Subject<void>();
    clients.pipe(
      takeUntil(this.stopService$),
      takeUntil(stopThisThread$),
    ).subscribe((clientsList) => {
      const oldClientsList = Object.keys(clientsThatReceiveTheFirstMessage);
      const missingClients: string[] = oldClientsList.filter((oldClient) => {
        return clientsList.findIndex((newClient) => newClient === oldClient) < 0;
      });
      const message: TEndMessage = {
        id: currentId,
        content: {
          type: 'end-message',
        },
      };
      this.getClients(missingClients.filter((missingClient) => {
        return clientsThatReceiveTheFirstMessage[missingClient] === true;
      })).forEach((missingClient) => {
        missingClient.socket.emit(message.content.type, message);
        delete clientsThatReceiveTheFirstMessage[missingClient.socket.id];
      });
      clientsToSend = clientsList;
    });
    const sendEnd = () => {
      if (clientsToSend === undefined) {
        //No clients initialized
        return;
      }
      let clients: IClient[];
      if (clientsToSend.length === 0) {
        clients = this.getAllClients();
      } else {
        clients = this.getClients(clientsToSend);
      }
      const message: TEndMessage = {
        id: currentId,
        content: {
          type: 'end-message',
        },
      };
      clients.forEach((client) => {
        if (clientsThatReceiveTheFirstMessage[client.socket.id]) {
          client.socket.emit(message.content.type, message);
          delete clientsThatReceiveTheFirstMessage[client.socket.id];
        }
      });
      stopThisThread$.next();
      stopThisThread$.complete();
    }
    const send = (message: Request, isError: boolean) => {
      if (clientsToSend === undefined) {
        //No clients initialized
        return;
      }
      let clients: IClient[];
      if (clientsToSend.length === 0) {
        clients = this.getAllClients();
      } else {
        clients = this.getClients(clientsToSend);
      }
      clients.forEach((client) => {
        let messageRectified: TMessage;
        if (isError) {
          if (clientsThatReceiveTheFirstMessage[client.socket.id]) {
            const modifiedMessage: TErrorMessage = {
              id: currentId,
              content: {
                type: 'error-message',
                error: message,
              }
            }
            messageRectified = modifiedMessage;
          } else {
            const modifiedMessage: TFirstErrorMessage = {
              id: currentId,
              content: {
                type: 'first-error-message',
                subject: type,
                error: message,
              },
            };
            messageRectified = modifiedMessage;
            clientsThatReceiveTheFirstMessage[client.socket.id] = true;
          }
        } else {
          if (clientsThatReceiveTheFirstMessage[client.socket.id]) {
            const modifiedMessage: TNextMessage = {
              id: currentId,
              content: {
                type: 'next-message',
                body: message,
              }
            }
            messageRectified = modifiedMessage;
          } else {
            const modifiedMessage: TFirstMessage = {
              id: currentId,
              content: {
                type: 'first-message',
                subject: type,
                body: message,
              },
            };
            messageRectified = modifiedMessage;
            clientsThatReceiveTheFirstMessage[client.socket.id] = true;
          }
        }
        client.socket.emit(messageRectified.content.type, messageRectified);
      });
    };

    messages$.pipe(
      takeUntil(this.stopService$),
      takeUntil(stopThisThread$),
    ).subscribe({
      next: (message) => {
        send(message, false);
      },
      error: (e) => {
        send(e, true);
      },
      complete: () => {
        sendEnd();
      },
    });
    return responses$.pipe(
      map(([message, from]): IBroadcastResponse<Response> => {
        switch (message.content.type) {
          case 'first-message': {
            const typed = message as TFirstMessage;
            return {
              response: typed.content.body,
              from,
              isError: false,
              isEnd: false,
            };
          }
          case 'first-error-message': {
            const typed = message as TFirstErrorMessage;
            return {
              response: typed.content.error,
              from,
              isError: true,
              isEnd: false,
            };
          }
          case 'next-message': {
            const typed = message as TNextMessage;
            return {
              response: typed.content.body,
              from,
              isError: false,
              isEnd: false,
            };
          }
          case 'error-message': {
            const typed = message as TErrorMessage;
            return {
              response: typed.content.error,
              from,
              isError: true,
              isEnd: false,
            };
          }
          case 'end-message': {
            return {
              response: undefined,
              from,
              isEnd: true,
              isError: false,
            }
          }
        }
      })
    );
  }

  public stopService() {
    this.stopService$.next();
  }
}

interface IClient {
  socket: Socket;
  messages: Record<string, Subject<TMessage>>;
  alreadyClosed: boolean;
}

export interface IServerParams {
  prefixMessages?: string;
}
export interface IBroadcastResponse<T> {
  response: T;
  from: string;
  isError: boolean;
  isEnd: boolean;
}