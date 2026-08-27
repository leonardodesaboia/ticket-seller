import { ValidationError } from '../../../../shared/kernel/application-errors';
import { VerifyEmailUseCase } from './verify-email.use-case';
import type { IEmailVerificationRepository, EmailVerificationTokenRecord } from '../../domain/ports/email-verification.repository.port';

const VALID_TOKEN_RECORD: EmailVerificationTokenRecord = {
  id: 'ev-token-id',
  userId: 'user-123',
  tokenHash: 'sha256-of-token',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h in future
  usedAt: null,
};

const mockEmailVerificationRepository: IEmailVerificationRepository = {
  create: jest.fn(),
  findByTokenHash: jest.fn().mockResolvedValue(VALID_TOKEN_RECORD),
  markUsed: jest.fn().mockResolvedValue(undefined),
  markIdentityEmailVerified: jest.fn().mockResolvedValue(undefined),
};

function makeUseCase(): VerifyEmailUseCase {
  return new VerifyEmailUseCase(mockEmailVerificationRepository);
}

describe('VerifyEmailUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockEmailVerificationRepository.findByTokenHash as jest.Mock).mockResolvedValue(
      VALID_TOKEN_RECORD,
    );
    (mockEmailVerificationRepository.markUsed as jest.Mock).mockResolvedValue(undefined);
    (mockEmailVerificationRepository.markIdentityEmailVerified as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  it('marks token as used and identity as verified', async () => {
    const useCase = makeUseCase();
    await useCase.execute({ token: 'raw-token' });

    expect(mockEmailVerificationRepository.markUsed).toHaveBeenCalledWith('ev-token-id');
    expect(mockEmailVerificationRepository.markIdentityEmailVerified).toHaveBeenCalledWith(
      'user-123',
    );
  });

  it('throws ValidationError when token not found', async () => {
    (mockEmailVerificationRepository.findByTokenHash as jest.Mock).mockResolvedValue(null);
    const useCase = makeUseCase();

    await expect(useCase.execute({ token: 'invalid' })).rejects.toThrow(ValidationError);
    expect(mockEmailVerificationRepository.markIdentityEmailVerified).not.toHaveBeenCalled();
  });

  it('throws ValidationError when token is expired', async () => {
    (mockEmailVerificationRepository.findByTokenHash as jest.Mock).mockResolvedValue({
      ...VALID_TOKEN_RECORD,
      expiresAt: new Date(Date.now() - 1000),
    });
    const useCase = makeUseCase();

    await expect(useCase.execute({ token: 'expired-token' })).rejects.toThrow(ValidationError);
  });

  it('succeeds idempotently when token was already used', async () => {
    (mockEmailVerificationRepository.findByTokenHash as jest.Mock).mockResolvedValue({
      ...VALID_TOKEN_RECORD,
      usedAt: new Date(),
    });
    const useCase = makeUseCase();

    await expect(useCase.execute({ token: 'already-used-token' })).resolves.toBeUndefined();
    // No side effects when already used
    expect(mockEmailVerificationRepository.markUsed).not.toHaveBeenCalled();
  });
});
