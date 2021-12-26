import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class GatewayEventsListenerService {
    private instances: IGatewayEventsListener[] | undefined;
    public constructor(
        private readonly moduleRef: ModuleRef,
        @Inject('GATEWAY_EVENTS_LISTENERS')
        private readonly interceptors: { new(...args: any[]): IGatewayEventsListener }[],
    ) { }

    private getInstances() {
        if (!this.instances) {
            this.instances = this.interceptors.map((interceptor) => {
                return this.moduleRef.get(interceptor, { strict: false });
            });
        }
        return this.instances;
    }

    public onDisconnect(client: string): void {
        this.getInstances().forEach(e => {
            if (e.onDisconnect) {
                e.onDisconnect(client);
            }
        });
    }
}

export interface IGatewayEventsListener {
    onDisconnect?(client: string): void;
}