import { ConflictException } from '@nestjs/common';
import { RegisterWithPasswordUseCase } from './register-with-password.use-case';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.port';
import type { IEmailVerificationRepository } from '../../domain/ports/email-verification.repository.port';
import type { PrismaService } from '../../../../platform/database/prisma.service';

const mockHasher: IPasswordHasher = {
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn(),
};

const mockEmailVerificationRepository: IEmailVerificationRepository = {
  create: jest.fn().mockResolvedValue({ id: 'evtoken-id' }),
  findByTokenHash: jest.fn(),
  markUsed: jest.fn(),
  markIdentityEmailVerified: jest.fn(),
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  identity: {
    create: jest.fn(),
  },
  passwordCredential: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

function makeUseCase(): RegisterWithPasswordUseCase {
  return new RegisterWithPasswordUseCase(
    mockPrisma as unknown as PrismaService,
    mockHasher,
    mockEmailVerificationRepository,
  );
}

describe('RegisterWithPasswordUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-new-id' }),
        },
        identity: { create: jest.fn().mockResolvedValue({}) },
        passwordCredential: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });
  });

  it('creates user, identity, and credential for a new email', async () => {
    const useCase = makeUseCase();
    const result = await useCase.execute({
      email: 'new@example.com',
      password: 'securepassword',
    });

    expect(result).toHaveProperty('userId');
    expect(mockHasher.hash).toHaveBeenCalledWith('securepassword');
    expect(mockEmailVerificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-new-id' }),
    );
  });

  it('normalizes email to lowercase', async () => {
    const useCase = makeUseCase();
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await useCase.execute({ email: 'Test@EXAMPLE.COM', password: 'password123' });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'test@example.com' } }),
    );
  });

  it('throws ConflictException when email is already registered', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ email: 'existing@example.com', password: 'password123' }),
    ).rejects.toThrow(ConflictException);
  });

  it('never exposes password hash in return value', async () => {
    const useCase = makeUseCase();
    const result = await useCase.execute({ email: 'safe@example.com', password: 'password123' });

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('hash');
    expect(resultStr).not.toContain('argon2');
  });
});
