import { BadRequestException } from '@nestjs/common';
import { ResetPasswordUseCase } from './reset-password.use-case';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.port';
import type { IPasswordResetRepository, PasswordResetTokenRecord } from '../../domain/ports/password-reset.repository.port';
import type { ISessionRepository } from '../../domain/ports/session.repository.port';

const VALID_TOKEN_RECORD: PasswordResetTokenRecord = {
  id: 'token-id',
  userId: 'user-123',
  tokenHash: 'sha256-of-token',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h in future
  usedAt: null,
};

const mockHasher: IPasswordHasher = {
  hash: jest.fn().mockResolvedValue('$argon2id$new-hash'),
  verify: jest.fn(),
};

const mockPasswordResetRepository: IPasswordResetRepository = {
  create: jest.fn(),
  findByTokenHash: jest.fn().mockResolvedValue(VALID_TOKEN_RECORD),
  markUsed: jest.fn().mockResolvedValue(undefined),
  updateCredentialHash: jest.fn().mockResolvedValue(undefined),
};

const mockSessionRepository: ISessionRepository = {
  create: jest.fn(),
  findActiveByTokenHash: jest.fn(),
  findActiveById: jest.fn(),
  revokeById: jest.fn(),
  revokeAllByUserId: jest.fn().mockResolvedValue(undefined),
  rotateByTokenHash: jest.fn(),
};

function makeUseCase(): ResetPasswordUseCase {
  return new ResetPasswordUseCase(mockHasher, mockPasswordResetRepository, mockSessionRepository);
}

describe('ResetPasswordUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPasswordResetRepository.findByTokenHash as jest.Mock).mockResolvedValue(VALID_TOKEN_RECORD);
    (mockHasher.hash as jest.Mock).mockResolvedValue('$argon2id$new-hash');
    (mockPasswordResetRepository.markUsed as jest.Mock).mockResolvedValue(undefined);
    (mockPasswordResetRepository.updateCredentialHash as jest.Mock).mockResolvedValue(undefined);
    (mockSessionRepository.revokeAllByUserId as jest.Mock).mockResolvedValue(undefined);
  });

  it('updates password hash, marks token used, revokes all sessions', async () => {
    const useCase = makeUseCase();
    await useCase.execute({ token: 'raw-token', newPassword: 'new-secure-password' });

    expect(mockHasher.hash).toHaveBeenCalledWith('new-secure-password');
    expect(mockPasswordResetRepository.updateCredentialHash).toHaveBeenCalledWith(
      'user-123',
      '$argon2id$new-hash',
    );
    expect(mockPasswordResetRepository.markUsed).toHaveBeenCalledWith('token-id');
    expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith('user-123');
  });

  it('throws BadRequestException when token not found', async () => {
    (mockPasswordResetRepository.findByTokenHash as jest.Mock).mockResolvedValue(null);
    const useCase = makeUseCase();

    await expect(useCase.execute({ token: 'invalid', newPassword: 'newpass123' })).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSessionRepository.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when token is already used', async () => {
    (mockPasswordResetRepository.findByTokenHash as jest.Mock).mockResolvedValue({
      ...VALID_TOKEN_RECORD,
      usedAt: new Date(),
    });
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ token: 'used-token', newPassword: 'newpass123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when token is expired', async () => {
    (mockPasswordResetRepository.findByTokenHash as jest.Mock).mockResolvedValue({
      ...VALID_TOKEN_RECORD,
      expiresAt: new Date(Date.now() - 1000),
    });
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ token: 'expired-token', newPassword: 'newpass123' }),
    ).rejects.toThrow(BadRequestException);
  });
});
