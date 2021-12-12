import { TEndMessage, TErrorMessage, TFirstMessage, TMessage, TNextMessage } from '@node-socket/interfaces';
import * as jestMock from 'jest-mock';
import { catchError, of, Subject, take, tap } from 'rxjs';
import { Socket } from 'socket.io-client';
import { SocketClient } from './client';
import { ConnectorsRegistryService, IConnector } from './connectors-registry';

const socketIoMock = {
  io: jest.fn(),
};
jest.mock('socket.io-client', () => {
  const actualModule = jest.requireActual('socket.io-client');
  return new Proxy(actualModule, {
    get: (target, property) => {
      switch (property) {
        // add cases for exports you want to mock
        case 'io': {
          return socketIoMock.io;
        }
        // fallback to the original module
        default: {
          return target[property]
        }
      }
    }
  });
});
describe('SocketClient', () => {
  let service: SocketClient;
  let ioResult: Socket<any, any>;
  beforeEach(() => {
    ioResult = createMockInstance(Socket);
  });
  afterEach(() => {
    jest.clearAllMocks();
  })
  it('No socket created if no message', () => {
    expect.assertions(1);
    service = new SocketClient({ url: '<url>', messagesPrefix: '<prefix>' }, createMockInstance(ConnectorsRegistryService));
    const subject = new Subject<string>();
    service.send('type', subject).subscribe();
    subject.complete();
    expect(socketIoMock.io).not.toBeCalled();
  });
  it('Socket is created with first message', () => {
    expect.assertions(18);
    const ioSpy = jest.spyOn(socketIoMock, 'io').mockReturnValue(ioResult);
    const ioResultOnSpy = jest.spyOn(ioResult, 'on');
    const ioResultEmitSpy = jest.spyOn(ioResult, 'emit');
    service = new SocketClient({ url: '<url>', messagesPrefix: '<prefix>' }, createMockInstance(ConnectorsRegistryService));
    const subject = new Subject<string>();
    service.send('type', subject).subscribe();
    subject.next('titi');
    expect(ioSpy).toBeCalledTimes(1);
    expect(ioSpy).toBeCalledWith('<url>', { transports: ['websocket'] });
    expect(ioResultOnSpy).toBeCalledTimes(9);
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(1, 'connect', expect.anything());
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(2, 'reconnect_attempt', expect.anything());
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(3, 'reconnect', expect.anything());
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(4, 'reconnect_failed', expect.anything());
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(5, 'close', expect.anything());
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(6, 'first-message', expect.anything());
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(7, 'next-message', expect.anything());
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(8, 'error-message', expect.anything());
    expect(ioResultOnSpy).toHaveBeenNthCalledWith(9, 'end-message', expect.anything());
    expect(ioResultEmitSpy).toBeCalledTimes(1);
    expect(ioResultEmitSpy.mock.calls[0][0]).toBe('first-message');
    expect(ioResultEmitSpy.mock.calls[0][1]).toBeDefined();
    expect((ioResultEmitSpy.mock.calls[0][1] as TFirstMessage).content.type).toBe('first-message');
    expect((ioResultEmitSpy.mock.calls[0][1] as TFirstMessage).content.subject).toBe('type');
    expect((ioResultEmitSpy.mock.calls[0][1] as TFirstMessage).content.body).toBe('titi');
  });

  describe('Check client with connectors', () => {
    let echoService: IConnector<any, any>;
    let mockConnectorsRegistryService: ConnectorsRegistryService;
    let getConnectorSpy: jest.SpyInstance<IConnector<any, any>, [type: string]>;
    let ioResultEmit: jest.SpyInstance<Socket<any, any>, [ev: string | symbol, ...args: any[]]>;
    let callbackIoOn: (message: any) => void;
    beforeEach(() => {
      echoService = {
        onMessage: jest.fn(),
      };
      mockConnectorsRegistryService = createMockInstance(ConnectorsRegistryService);
      getConnectorSpy = jest.spyOn(mockConnectorsRegistryService, 'getConnector').mockReturnValue(echoService);
      jest.spyOn(socketIoMock, 'io').mockReturnValue(ioResult);
      jest.spyOn(ioResult, 'on').mockImplementation((ev, callback) => {
        if (ev === 'first-message') {
          callbackIoOn = callback;
        }
        return undefined as any;
      });
      ioResultEmit = jest.spyOn(ioResult, 'emit');
      service = new SocketClient({ url: '<url>', messagesPrefix: '<prefix>' }, mockConnectorsRegistryService);
      const subject = new Subject<string>();
      service.send('type', subject).subscribe();
      subject.next('titi');
    });
    afterEach(() => {
      jest.clearAllMocks();
    })
    it('First message from server is ok', () => {
      expect.assertions(14);
      // State of beforeEach
      expect(ioResultEmit).toBeCalledTimes(1);

      const spyOnMessage = jest.spyOn(echoService, 'onMessage').mockImplementation((obs) => obs.pipe(
        tap((content) => expect(content).toBe('echo-1')),
        take(1),
      ));
      callbackIoOn(createMessage<TFirstMessage>({
        id: 'server_1',
        content: {
          type: 'first-message',
          subject: 'echo',
          body: 'echo-1',
        }
      }));
      expect(getConnectorSpy).toBeCalledTimes(1);
      expect(spyOnMessage).toBeCalledTimes(1);
      expect(ioResultEmit).toBeCalledTimes(3);
      expect(ioResultEmit.mock.calls[1][0]).toBe('next-message');
      expect(ioResultEmit.mock.calls[1][1]).toBeDefined();
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).id).toBe('server_1');
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).content.type).toBe('next-message');
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).content.body).toBe('echo-1');

      expect(ioResultEmit.mock.calls[2][0]).toBe('end-message');
      expect(ioResultEmit.mock.calls[2][1]).toBeDefined();
      expect((ioResultEmit.mock.calls[2][1] as TEndMessage).id).toBe('server_1');
      expect((ioResultEmit.mock.calls[2][1] as TEndMessage).content.type).toBe('end-message');
    });
    it('Next message from server is ok', () => {
      expect.assertions(20);
      // State of beforeEach
      expect(ioResultEmit).toBeCalledTimes(1);

      let nbCall = 0;
      const spyOnMessage = jest.spyOn(echoService, 'onMessage').mockImplementation((obs) => obs.pipe(
        tap((content) => {
          switch (nbCall) {
            case 0:
              expect(content).toBe('echo-1');
              break;
            case 1:
              expect(content).toBe('echo-2');
              break;
          }
          nbCall++;
        }),
        take(2),
      ));
      callbackIoOn(createMessage<TFirstMessage>({
        id: 'server_1',
        content: {
          type: 'first-message',
          subject: 'echo',
          body: 'echo-1',
        }
      }));
      callbackIoOn(createMessage<TNextMessage>({
        id: 'server_1',
        content: {
          type: 'next-message',
          body: 'echo-2',
        }
      }));
      expect(getConnectorSpy).toBeCalledTimes(1);
      expect(spyOnMessage).toBeCalledTimes(1);
      expect(ioResultEmit).toBeCalledTimes(4);
      expect(ioResultEmit.mock.calls[1][0]).toBe('next-message');
      expect(ioResultEmit.mock.calls[1][1]).toBeDefined();
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).id).toBe('server_1');
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).content.type).toBe('next-message');
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).content.body).toBe('echo-1');

      expect(ioResultEmit.mock.calls[2][0]).toBe('next-message');
      expect(ioResultEmit.mock.calls[2][1]).toBeDefined();
      expect((ioResultEmit.mock.calls[2][1] as TNextMessage).id).toBe('server_1');
      expect((ioResultEmit.mock.calls[2][1] as TNextMessage).content.type).toBe('next-message');
      expect((ioResultEmit.mock.calls[2][1] as TNextMessage).content.body).toBe('echo-2');

      expect(ioResultEmit.mock.calls[3][0]).toBe('end-message');
      expect(ioResultEmit.mock.calls[3][1]).toBeDefined();
      expect((ioResultEmit.mock.calls[3][1] as TEndMessage).id).toBe('server_1');
      expect((ioResultEmit.mock.calls[3][1] as TEndMessage).content.type).toBe('end-message');
    });
    it('Error message from server is ok', () => {
      expect.assertions(20);
      // State of beforeEach
      expect(ioResultEmit).toBeCalledTimes(1);

      const spyOnMessage = jest.spyOn(echoService, 'onMessage').mockImplementation((obs) => obs.pipe(
        tap((content) => {
          expect(content).toBe('echo-1');
        }),
        catchError((err) => {
          expect(err).toBe('Error from tests');
          return of('ok');
        }),
        take(2),
      ));
      callbackIoOn(createMessage<TFirstMessage>({
        id: 'server_1',
        content: {
          type: 'first-message',
          subject: 'echo',
          body: 'echo-1',
        }
      }));
      callbackIoOn(createMessage<TErrorMessage>({
        id: 'server_1',
        content: {
          type: 'error-message',
          error: 'Error from tests',
        }
      }));
      expect(getConnectorSpy).toBeCalledTimes(1);
      expect(spyOnMessage).toBeCalledTimes(1);
      expect(ioResultEmit).toBeCalledTimes(4);
      expect(ioResultEmit.mock.calls[1][0]).toBe('next-message');
      expect(ioResultEmit.mock.calls[1][1]).toBeDefined();
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).id).toBe('server_1');
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).content.type).toBe('next-message');
      expect((ioResultEmit.mock.calls[1][1] as TNextMessage).content.body).toBe('echo-1');

      expect(ioResultEmit.mock.calls[2][0]).toBe('next-message');
      expect(ioResultEmit.mock.calls[2][1]).toBeDefined();
      expect((ioResultEmit.mock.calls[2][1] as TNextMessage).id).toBe('server_1');
      expect((ioResultEmit.mock.calls[2][1] as TNextMessage).content.type).toBe('next-message');
      expect((ioResultEmit.mock.calls[2][1] as TNextMessage).content.body).toBe('ok');

      expect(ioResultEmit.mock.calls[3][0]).toBe('end-message');
      expect(ioResultEmit.mock.calls[3][1]).toBeDefined();
      expect((ioResultEmit.mock.calls[3][1] as TEndMessage).id).toBe('server_1');
      expect((ioResultEmit.mock.calls[3][1] as TEndMessage).content.type).toBe('end-message');
    });
  });
});

function createMockInstance<T>(cl: { new(...args: any[]): T }): T {
  const mocker = new jestMock.ModuleMocker(global);
  const Mock = mocker.generateFromMetadata(mocker.getMetadata(cl));
  return new Mock() as any as T;
}
function createMessage<T extends TMessage>(message: T): T {
  return message;
}