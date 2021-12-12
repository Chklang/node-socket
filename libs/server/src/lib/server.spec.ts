import { TErrorMessage, TMessage, TNextMessage } from '@node-socket/interfaces';
import * as jestMock from 'jest-mock';
import { catchError, finalize, map, of, take, tap } from 'rxjs';
import { Socket } from 'socket.io';
import { ConnectorsRegistryService, IConnector } from './connectors-registry';
import { ServerService } from './server';

describe('ServerService', () => {
  let server: ServerService;
  let mockConnectorsRegistryService: ConnectorsRegistryService;
  let echoService: IConnector<any, any>;
  let getConnectorSpy: jest.SpyInstance<IConnector<any, any>, [type: string]>;
  beforeEach(() => {
    echoService = {
      onMessage: jest.fn(),
    };
    mockConnectorsRegistryService = createMockInstance(ConnectorsRegistryService);
    getConnectorSpy = jest.spyOn(mockConnectorsRegistryService, 'getConnector').mockReturnValue(echoService);
    server = new ServerService(mockConnectorsRegistryService);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('Works for first message', () => {
    expect.assertions(10);
    const client = createFakeSocketClient('1');
    const emitSpy = jest.spyOn(client, 'emit');
    const echoSpy = jest.spyOn(echoService, 'onMessage').mockImplementation((req) => {
      return req.pipe(
        tap((m) => expect(m).toBe('content')),
      );
    });
    server.handleFirstMessage({
      id: '1',
      content: {
        type: 'first-message',
        subject: 'echo',
        body: 'content',
      },
    }, client);
    expect(getConnectorSpy).toBeCalledTimes(1);
    expect(getConnectorSpy.mock.calls[0][0]).toBe('echo');
    expect(echoSpy).toBeCalledTimes(1);
    expect(emitSpy).toBeCalledTimes(1);
    expect(emitSpy.mock.calls[0][0]).toBe('next-message');
    expect(emitSpy.mock.calls[0][1] as TMessage).toBeDefined();
    expect((emitSpy.mock.calls[0][1] as TMessage).id).toBe('1');
    expect((emitSpy.mock.calls[0][1] as TMessage).content.type).toBe('next-message');
    expect((emitSpy.mock.calls[0][1] as TNextMessage).content.body).toBe('content');
  });
  it('Works for first message + end', () => {
    expect.assertions(14);
    const client = createFakeSocketClient('1');
    const emitSpy = jest.spyOn(client, 'emit');
    const echoSpy = jest.spyOn(echoService, 'onMessage').mockImplementation((req) => {
      return req.pipe(
        take(1),
        tap((m) => expect(m).toBe('content')),
      );
    });
    server.handleFirstMessage({
      id: '1',
      content: {
        type: 'first-message',
        subject: 'echo',
        body: 'content',
      },
    }, client);
    expect(getConnectorSpy).toBeCalledTimes(1);
    expect(getConnectorSpy.mock.calls[0][0]).toBe('echo');
    expect(echoSpy).toBeCalledTimes(1);
    expect(emitSpy).toBeCalledTimes(2);
    expect(emitSpy.mock.calls[0][0]).toBe('next-message');
    expect(emitSpy.mock.calls[0][1] as TMessage).toBeDefined();
    expect((emitSpy.mock.calls[0][1] as TMessage).id).toBe('1');
    expect((emitSpy.mock.calls[0][1] as TMessage).content.type).toBe('next-message');
    expect((emitSpy.mock.calls[0][1] as TNextMessage).content.body).toBe('content');

    expect(emitSpy.mock.calls[1][0]).toBe('end-message');
    expect(emitSpy.mock.calls[1][1] as TMessage).toBeDefined();
    expect((emitSpy.mock.calls[1][1] as TMessage).id).toBe('1');
    expect((emitSpy.mock.calls[1][1] as TMessage).content.type).toBe('end-message');
  });
  it('Works for first message + next + end', () => {
    expect.assertions(20);
    const client = createFakeSocketClient('1');
    const emitSpy = jest.spyOn(client, 'emit');
    const echoSpy = jest.spyOn(echoService, 'onMessage').mockImplementation((req) => {
      let nbCall = 0;
      return req.pipe(
        take(2),
        tap((m) => {
          switch (nbCall) {
            case 0:
              expect(m).toBe('content');
              break;
            case 1:
              expect(m).toBe('content2');
              break;
          }
          nbCall++;
        }),
      );
    });
    server.handleFirstMessage({
      id: '1',
      content: {
        type: 'first-message',
        subject: 'echo',
        body: 'content',
      },
    }, client);
    server.handleNextMessage({
      id: '1',
      content: {
        type: 'next-message',
        body: 'content2',
      },
    }, client);
    expect(getConnectorSpy).toBeCalledTimes(1);
    expect(getConnectorSpy.mock.calls[0][0]).toBe('echo');
    expect(echoSpy).toBeCalledTimes(1);
    expect(emitSpy).toBeCalledTimes(3);
    expect(emitSpy.mock.calls[0][0]).toBe('next-message');
    expect(emitSpy.mock.calls[0][1] as TMessage).toBeDefined();
    expect((emitSpy.mock.calls[0][1] as TMessage).id).toBe('1');
    expect((emitSpy.mock.calls[0][1] as TMessage).content.type).toBe('next-message');
    expect((emitSpy.mock.calls[0][1] as TNextMessage).content.body).toBe('content');

    expect(emitSpy.mock.calls[1][0]).toBe('next-message');
    expect(emitSpy.mock.calls[1][1] as TMessage).toBeDefined();
    expect((emitSpy.mock.calls[1][1] as TMessage).id).toBe('1');
    expect((emitSpy.mock.calls[1][1] as TMessage).content.type).toBe('next-message');
    expect((emitSpy.mock.calls[1][1] as TNextMessage).content.body).toBe('content2');

    expect(emitSpy.mock.calls[2][0]).toBe('end-message');
    expect(emitSpy.mock.calls[2][1] as TMessage).toBeDefined();
    expect((emitSpy.mock.calls[2][1] as TMessage).id).toBe('1');
    expect((emitSpy.mock.calls[2][1] as TMessage).content.type).toBe('end-message');
  });
  it('Works for first message + error response', () => {
    expect.assertions(10);
    const client = createFakeSocketClient('1');
    const emitSpy = jest.spyOn(client, 'emit');
    const echoSpy = jest.spyOn(echoService, 'onMessage').mockImplementation((req) => {
      return req.pipe(
        map((m) => {
          expect(m).toBe('content');
          throw 'STOP';
        }),
      );
    });
    server.handleFirstMessage({
      id: '1',
      content: {
        type: 'first-message',
        subject: 'echo',
        body: 'content',
      },
    }, client);
    expect(getConnectorSpy).toBeCalledTimes(1);
    expect(getConnectorSpy.mock.calls[0][0]).toBe('echo');
    expect(echoSpy).toBeCalledTimes(1);
    expect(emitSpy).toBeCalledTimes(1);

    expect(emitSpy.mock.calls[0][0]).toBe('error-message');
    expect(emitSpy.mock.calls[0][1] as TMessage).toBeDefined();
    expect((emitSpy.mock.calls[0][1] as TMessage).id).toBe('1');
    expect((emitSpy.mock.calls[0][1] as TMessage).content.type).toBe('error-message');
    expect((emitSpy.mock.calls[0][1] as TErrorMessage).content.error).toBe('STOP');
  });
  it('Works for first message + error', () => {
    expect.assertions(5);
    const client = createFakeSocketClient('1');
    const echoSpy = jest.spyOn(echoService, 'onMessage').mockImplementation((req) => {
      return req.pipe(
        tap((m) => expect(m).toBe('content')),
        catchError((m) => {
          expect(m).toBe('toto');
          return of();
        }),
      );
    });
    server.handleFirstMessage({
      id: '1',
      content: {
        type: 'first-message',
        subject: 'echo',
        body: 'content',
      },
    }, client);
    server.handleErrorMessage({
      id: '1',
      content: {
        type: 'error-message',
        error: 'toto',
      },
    }, client);
    expect(getConnectorSpy).toBeCalledTimes(1);
    expect(getConnectorSpy.mock.calls[0][0]).toBe('echo');
    expect(echoSpy).toBeCalledTimes(1);
  });
  it('Works for first message + end', () => {
    expect.assertions(5);
    const client = createFakeSocketClient('1');
    const echoSpy = jest.spyOn(echoService, 'onMessage').mockImplementation((req) => {
      return req.pipe(
        tap((m) => expect(m).toBe('content')),
        finalize(() => {
          expect(true).toBe(true); // Check that finalize was called
        }),
      );
    });
    server.handleFirstMessage({
      id: '1',
      content: {
        type: 'first-message',
        subject: 'echo',
        body: 'content',
      },
    }, client);
    server.handleEndMessage({
      id: '1',
      content: {
        type: 'end-message',
      },
    }, client);
    expect(getConnectorSpy).toBeCalledTimes(1);
    expect(getConnectorSpy.mock.calls[0][0]).toBe('echo');
    expect(echoSpy).toBeCalledTimes(1);
  });
});
function createMockInstance<T>(cl: { new(...args: any[]): T }): T {
  const mocker = new jestMock.ModuleMocker(global);
  const Mock = mocker.generateFromMetadata(mocker.getMetadata(cl));
  return new Mock() as any as T;
}
function createFakeSocketClient(id: string): Socket {
  return {
    id,
    emit: jest.fn(),
  } as any;
}