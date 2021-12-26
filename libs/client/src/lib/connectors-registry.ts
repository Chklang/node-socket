import { TConnectorBase } from '@node-socket/interfaces';
import { Observable } from 'rxjs';

export class ConnectorsRegistryService {
    private services: Record<string, IConnector<TConnectorBase<any, any>>> = {};

    public register<Connector extends TConnectorBase<any, any>>(type: string, service: IConnector<Connector>) {
        this.services[type] = service;
        return service;
    }
    public unregister<Connector extends TConnectorBase<any, any>>(type: string) {
        const serviceFound = this.services[type];
        delete this.services[type];
        return serviceFound;
    }
    public getConnector<Connector extends TConnectorBase<any, any>>(type: string): IConnector<Connector> {
        return this.services[type] as IConnector<Connector>;
    }
}

export interface IConnector<Connector extends TConnectorBase<any, any>> {
    onMessage(requests: Observable<Connector['request']>): Observable<Connector['response']>;
}