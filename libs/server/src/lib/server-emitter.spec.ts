import { TEndMessage, TErrorMessage, TFirstMessage, TMessage, TNextMessage } from '@node-socket/interfaces';
import * as jestMock from 'jest-mock';
import { BehaviorSubject, catchError, finalize, map, of, Subject, take, tap } from 'rxjs';
import { Socket } from 'socket.io';
import { ConnectorsRegistryService, IConnector } from './connectors-registry';
import { ServerService } from './server';

describe('Server as emitter', () => {
    let server: ServerService;
    let mockConnectorsRegistryService: ConnectorsRegistryService;
    let echoService: IConnector<any>;
    let getConnectorSpy: jest.SpyInstance<IConnector<any>, [type: string]>;
    beforeEach(() => {
        echoService = {
            onMessage: jest.fn().mockReturnValue(new Subject()),
        };
        mockConnectorsRegistryService = createMockInstance(ConnectorsRegistryService);
        getConnectorSpy = jest.spyOn(mockConnectorsRegistryService, 'getConnector').mockReturnValue(echoService);
        server = new ServerService({}, mockConnectorsRegistryService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('Server can send message to connected clients', () => {
        expect.assertions(39);
        const clients = [
            createFakeSocketClient('A'),
            createFakeSocketClient('B'),
            createFakeSocketClient('C'),
        ];
        const firstMessage: TFirstMessage = {
            id: '1',
            content: {
                type: 'first-message',
                subject: 'echo',
                body: 'echo',
            },
        };
        clients.forEach((client) => {
            server.handleFirstMessage(firstMessage, client);
        });
        const subjectSender = new Subject<string>();
        server.sendMessage('echo', subjectSender).pipe(

        ).subscribe({
            next: (e) => {

            },
            error: (e) => {

            },
            complete: () => {

            },
        });
        subjectSender.next('toto');
        subjectSender.next('titi');
        subjectSender.complete();


        clients.forEach((client) => { // 13 expects
            expect(client.emit).toBeCalledTimes(3);
            expect((client.emit as jestMock.Mock<any, any>).mock.calls[0][0]).toBe('first-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).id).toBe('server_0');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.type).toBe('first-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.subject).toBe('echo');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.body).toBe('toto');

            expect((client.emit as jestMock.Mock<any, any>).mock.calls[1][0]).toBe('next-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).id).toBe('server_0');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).content.type).toBe('next-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).content.body).toBe('titi');

            expect((client.emit as jestMock.Mock<any, any>).mock.calls[2][0]).toBe('end-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[2][1] as TEndMessage).id).toBe('server_0');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[2][1] as TEndMessage).content.type).toBe('end-message');
        });
    });
    it('Server can send message to specified clients', () => {
        expect.assertions(27);
        const clients = [
            createFakeSocketClient('A'),
            createFakeSocketClient('B'),
            createFakeSocketClient('C'),
        ];
        const firstMessage: TFirstMessage = {
            id: '1',
            content: {
                type: 'first-message',
                subject: 'echo',
                body: 'echo',
            },
        };
        clients.forEach((client) => {
            server.handleFirstMessage(firstMessage, client);
        });
        const subjectSender = new Subject<string>();
        server.sendMessage('echo', subjectSender, of([clients[0].id, clients[2].id])).pipe(

        ).subscribe({
            next: (e) => {

            },
            error: (e) => {

            },
            complete: () => {

            },
        });
        subjectSender.next('toto');
        subjectSender.next('titi');
        subjectSender.complete();


        [clients[0], clients[2]].forEach((client) => { // 13 expects
            expect(client.emit).toBeCalledTimes(3);
            expect((client.emit as jestMock.Mock<any, any>).mock.calls[0][0]).toBe('first-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).id).toBe('server_0');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.type).toBe('first-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.subject).toBe('echo');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.body).toBe('toto');

            expect((client.emit as jestMock.Mock<any, any>).mock.calls[1][0]).toBe('next-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).id).toBe('server_0');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).content.type).toBe('next-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).content.body).toBe('titi');

            expect((client.emit as jestMock.Mock<any, any>).mock.calls[2][0]).toBe('end-message');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[2][1] as TEndMessage).id).toBe('server_0');
            expect(((client.emit as jestMock.Mock<any, any>).mock.calls[2][1] as TEndMessage).content.type).toBe('end-message');
        });
        [clients[1]].forEach((client) => { // 1 expects
            expect(client.emit).toBeCalledTimes(0);
        });
    });
    it('Server can send message to specified clients and modify them', () => {
        expect.assertions(27);
        const clients = [
            createFakeSocketClient('A'),
            createFakeSocketClient('B'),
            createFakeSocketClient('C'),
        ];
        const firstMessage: TFirstMessage = {
            id: '1',
            content: {
                type: 'first-message',
                subject: 'echo',
                body: 'echo',
            },
        };
        clients.forEach((client) => {
            server.handleFirstMessage(firstMessage, client);
        });
        const subjectSender = new Subject<string>();
        const subjectClients = new BehaviorSubject<string[]>(['A']);
        server.sendMessage('echo', subjectSender, subjectClients).pipe(

        ).subscribe({
            next: (e) => {

            },
            error: (e) => {

            },
            complete: () => {

            },
        });
        subjectSender.next('toto');
        subjectClients.next(['A', 'B'])
        subjectSender.next('titi');
        subjectClients.next(['B'])
        subjectSender.next('tata');
        subjectSender.complete();

        // First client
        {
            expect(clients[0].emit).toBeCalledTimes(3);
            expect((clients[0].emit as jestMock.Mock<any, any>).mock.calls[0][0]).toBe('first-message');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).id).toBe('server_0');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.type).toBe('first-message');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.subject).toBe('echo');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.body).toBe('toto');

            expect((clients[0].emit as jestMock.Mock<any, any>).mock.calls[1][0]).toBe('next-message');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).id).toBe('server_0');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).content.type).toBe('next-message');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).content.body).toBe('titi');

            expect((clients[0].emit as jestMock.Mock<any, any>).mock.calls[2][0]).toBe('end-message');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[2][1] as TEndMessage).id).toBe('server_0');
            expect(((clients[0].emit as jestMock.Mock<any, any>).mock.calls[2][1] as TEndMessage).content.type).toBe('end-message');
        }

        // Second client
        {
            expect(clients[1].emit).toBeCalledTimes(3);
            expect((clients[1].emit as jestMock.Mock<any, any>).mock.calls[0][0]).toBe('first-message');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).id).toBe('server_0');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.type).toBe('first-message');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.subject).toBe('echo');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[0][1] as TFirstMessage).content.body).toBe('titi');

            expect((clients[1].emit as jestMock.Mock<any, any>).mock.calls[1][0]).toBe('next-message');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).id).toBe('server_0');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).content.type).toBe('next-message');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[1][1] as TNextMessage).content.body).toBe('tata');

            expect((clients[1].emit as jestMock.Mock<any, any>).mock.calls[2][0]).toBe('end-message');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[2][1] as TEndMessage).id).toBe('server_0');
            expect(((clients[1].emit as jestMock.Mock<any, any>).mock.calls[2][1] as TEndMessage).content.type).toBe('end-message');
        }

        // Third client
        {
            expect(clients[2].emit).toBeCalledTimes(0);
        }
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