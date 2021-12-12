import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { BehaviorSubject, finalize, mergeMap, Observable, of, Subject, switchMap, takeUntil, tap, throwError } from 'rxjs';
import { INextMessage, TEndMessage, TErrorMessage, TFirstMessage, TMessage, TNextMessage } from '@node-socket/interfaces';
import { ConnectorsRegistryService } from './connectors-registry';

type TSocketEvent = 'CONNECTED' | 'NOT CONNECTED' | 'RECONNECTING';
export interface ISocketClientParams {
  url: string;
  messagesPrefix?: string;
  socketOptions?: Partial<ManagerOptions & SocketOptions>;
}
export class SocketClient {
  private autoIncrement = 0;
  private readonly sendMessage: Subject<TMessage> = new Subject();
  private readonly listeners: Record<string, Subject<any>> = {};
  private readonly onDisconnect = new Subject<void>();
  protected readonly eventsSockets = new BehaviorSubject<TSocketEvent>('NOT CONNECTED');
  private readonly url: string;
  private readonly messagesPrefix: string;
  private readonly socketOptions: Partial<ManagerOptions & SocketOptions>;

  public constructor(
    opts: ISocketClientParams,
    private connectorsRegistry: ConnectorsRegistryService,
  ) {
    this.url = opts.url;
    this.messagesPrefix = opts.messagesPrefix || (Math.random() + 1).toString(36).substring(7) + '_';
    this.socketOptions = opts.socketOptions || { transports: ['websocket'] };
    this.init();
  }

  private init() {
    let socket: Socket;
    this.sendMessage.pipe(
      takeUntil(this.onDisconnect),
      mergeMap((message) => this.messageToSend(message)),
      tap((value) => {
        if (!socket) {
          socket = io(this.url, this.socketOptions);
          const callback = (message: TMessage) => {
            const listener = this.listeners[message.id];
            if (listener) {
              switch (message.content.type) {
                case 'first-message': {
                  const typed = message as TFirstMessage;
                  listener.next(typed.content.body);
                  break;
                }
                case 'next-message': {
                  const typed = message as TNextMessage;
                  listener.next(typed.content.body);
                  break;
                }
                case 'error-message': {
                  const typed = message as TErrorMessage;
                  listener.error(typed.content.error);
                  delete this.listeners[typed.id];
                  break;
                }
                case 'end-message': {
                  listener.complete();
                  delete this.listeners[message.id];
                  break;
                }
              }
              return;
            }
            if (message.content.type === 'first-message') {
              const typed = message as TFirstMessage;
              const service = this.connectorsRegistry.getConnector(typed.content.subject);
              if (!service) {
                const errorResponse: TErrorMessage = {
                  id: message.id,
                  content: {
                    type: 'error-message',
                    error: `Connector ${typed.content.subject} not found`,
                  }
                }
                socket?.emit(errorResponse.content.type, errorResponse);
                return;
              }

              const requests$ = new Subject<TMessage>();
              this.listeners[message.id] = requests$;

              service.onMessage(requests$).subscribe({
                next: (e) => {
                  const message: TNextMessage = {
                    id: typed.id,
                    content: {
                      type: 'next-message',
                      body: e,
                    },
                  };
                  socket?.emit(message.content.type, message);
                },
                error: (e) => {
                  const message: TErrorMessage = {
                    id: typed.id,
                    content: {
                      type: 'error-message',
                      error: e,
                    },
                  };
                  socket?.emit(message.content.type, message);
                  this.listeners[typed.id]?.complete();
                  delete this.listeners[typed.id];
                },
                complete: () => {
                  const message: TEndMessage = {
                    id: typed.id,
                    content: {
                      type: 'end-message',
                    },
                  };
                  socket?.emit(message.content.type, message);
                  this.listeners[typed.id]?.complete();
                  delete this.listeners[typed.id];
                }
              });
              requests$.next(typed.content.body);
              return;
            }
            // No receiver
            const errorResponse: TErrorMessage = {
              id: message.id,
              content: {
                type: 'error-message',
                error: `Message ${message.id} cannot be delivered`,
              }
            };
            socket?.emit(errorResponse.content.type, errorResponse);
          }
          socket.on('connect', () => {
            this.eventsSockets.next('CONNECTED');
          });
          socket.on('reconnect_attempt', () => {
            this.eventsSockets.next('RECONNECTING');
          });
          socket.on('reconnect', () => {
            this.eventsSockets.next('CONNECTED');
          });
          socket.on('reconnect_failed', () => {
            this.eventsSockets.next('NOT CONNECTED');
          });
          socket.on('close', () => {
            this.eventsSockets.next('NOT CONNECTED');
          });
          socket.on('first-message', callback);
          socket.on('next-message', callback);
          socket.on('error-message', callback);
          socket.on('end-message', callback);
        }
        socket.emit(value.content.type, value);
      }),
      finalize(() => {
        socket?.close();
        socket = undefined;
      }),
    ).subscribe();
  }

  protected disconnect() {
    this.onDisconnect.next();
  }

  protected messageToSend(message: TMessage): Observable<TMessage> {
    return of(message);
  }

  public send<Request, Response>(type: string, messages$: Observable<Request>): Observable<Response> {
    let firstMessageSent = false;
    const currentId = this.messagesPrefix + (this.autoIncrement++);
    const responses$ = new Subject<Response>();
    this.listeners[currentId] = responses$;
    messages$.subscribe((message) => {
      if (!firstMessageSent) {
        const firstMessage: TFirstMessage = {
          id: currentId,
          content: {
            type: 'first-message',
            subject: type,
            body: message,
          }
        }
        this.sendMessage.next(firstMessage);
        firstMessageSent = true;
      } else {
        const nextMessage: TNextMessage = {
          id: currentId,
          content: {
            type: 'next-message',
            body: message,
          }
        };
        this.sendMessage.next(nextMessage);
      }
    });
    return responses$;
  }
}