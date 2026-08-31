import { Test } from '@nestjs/testing';
import PgBoss from 'pg-boss';
import { PgBossModule } from './pgboss.module';

jest.mock('pg-boss');

describe('PgBossModule', () => {
  let mockBossInstance: jest.Mocked<Pick<PgBoss, 'start' | 'stop' | 'on'>>;

  beforeEach(() => {
    mockBossInstance = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
    };
    jest.mocked(PgBoss).mockReturnValue(
      (mockBossInstance as Pick<PgBoss, 'start' | 'stop' | 'on'>) as PgBoss,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls boss.start() during module initialization', async () => {
    const module = await Test.createTestingModule({
      imports: [PgBossModule],
    }).compile();

    expect(mockBossInstance.start).toHaveBeenCalledTimes(1);

    await module.close();
  });

  it('registers error handler on the boss instance', async () => {
    const module = await Test.createTestingModule({
      imports: [PgBossModule],
    }).compile();

    expect(mockBossInstance.on).toHaveBeenCalledWith('error', expect.any(Function));

    await module.close();
  });

  it('calls boss.stop() on module destroy', async () => {
    const module = await Test.createTestingModule({
      imports: [PgBossModule],
    }).compile();

    await module.close();

    expect(mockBossInstance.stop).toHaveBeenCalledTimes(1);
  });

  it('propagates boss.start() failure without swallowing', async () => {
    const boom = new Error('pg-boss: database unreachable');
    mockBossInstance.start.mockRejectedValue(boom);

    await expect(
      Test.createTestingModule({ imports: [PgBossModule] }).compile(),
    ).rejects.toThrow('pg-boss: database unreachable');
  });
});
