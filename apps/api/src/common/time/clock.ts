import { Global, Injectable, Module } from '@nestjs/common';

/** Абстракція часу: доменна логіка (таймери рандому, токени) не звертається до `new Date()` напряму. */
export abstract class Clock {
  abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

@Global()
@Module({ providers: [{ provide: Clock, useClass: SystemClock }], exports: [Clock] })
export class ClockModule {}
