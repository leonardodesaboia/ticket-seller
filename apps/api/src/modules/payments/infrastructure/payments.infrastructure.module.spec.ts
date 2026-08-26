import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../platform/database/prisma.service';
import { PAYMENT_GATEWAY_PORT } from '../domain/ports/payment-gateway.port';
import { FakePaymentGateway } from './adapters/fake/fake-payment.gateway';
import { PaymentsInfrastructureModule } from './payments.infrastructure.module';

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class PrismaTestModule {}

describe('PaymentsInfrastructureModule', () => {
  let moduleRef: TestingModule;
  let originalEnvironment: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnvironment = { ...process.env };
    process.env['PAYMENT_PROVIDER'] = 'fake';
    moduleRef = await Test.createTestingModule({
      imports: [PrismaTestModule, PaymentsInfrastructureModule],
    }).compile();
  });

  afterEach(async () => {
    await moduleRef?.close();
    process.env = originalEnvironment;
  });

  it('resolves PAYMENT_GATEWAY_PORT to FakePaymentGateway when PAYMENT_PROVIDER is fake', () => {
    expect(moduleRef.get(PAYMENT_GATEWAY_PORT)).toBeInstanceOf(FakePaymentGateway);
  });
});
