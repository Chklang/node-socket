import { Observable } from 'rxjs';

export class ConnectorsRegistryService {
    private services: Record<string, IConnector<any, any>> = {};

    public register<Request, Response>(type: string, service: IConnector<Request, Response>) {
        this.services[type] = service;
        return service;
    }
    public unregister<Request, Response>(type: string) {
        const serviceFound = this.services[type];
        delete this.services[type];
        return serviceFound;
    }
    public getConnector<Request, Response>(type: string): IConnector<Request, Response> {
        return this.services[type];
    }
}

export interface IConnector<Request, Response> {
    onMessage(requests: Observable<Request>): Observable<Response>;
}