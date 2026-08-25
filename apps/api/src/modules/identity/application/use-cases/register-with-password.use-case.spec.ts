import { ConflictException } from '@nestjs/common';
import { RegisterWithPasswordUseCase } from './register-with-password.use-case';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.port';
import type { IEmailVerificationRepository } from '../../domain/ports/email-verification.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

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

const mockUserRepository: IUserRepository = {
  emailExists: jest.fn().mockResolvedValue(false),
  findUserIdByEmail: jest.fn(),
  findIdentityWithCredential: jest.fn(),
  findProfile: jest.fn(),
  register: jest.fn().mockResolvedValue({ userId: 'user-new-id' }),
};

function makeUseCase(): RegisterWithPasswordUseCase {
  return new RegisterWithPasswordUseCase(
    mockUserRepository,
    mockHasher,
    mockEmailVerificationRepository,
  );
}

describe('RegisterWithPasswordUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockUserRepository.emailExists as jest.Mock).mockResolvedValue(false);
    (mockUserRepository.register as jest.Mock).mockResolvedValue({ userId: 'user-new-id' });
    (mockHasher.hash as jest.Mock).mockResolvedValue('$argon2id$hashed');
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
    await useCase.execute({ email: 'Test@EXAMPLE.COM', password: 'password123' });

    expect(mockUserRepository.emailExists).toHaveBeenCalledWith('test@example.com');
    expect(mockUserRepository.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
    );
  });

  it('throws ConflictException when email is already registered', async () => {
    (mockUserRepository.emailExists as jest.Mock).mockResolvedValue(true);
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ email: 'existing@example.com', password: 'password123' }),
    ).rejects.toThrow(ConflictException);

    expect(mockUserRepository.register).not.toHaveBeenCalled();
  });

  it('never exposes password hash in return value', async () => {
    const useCase = makeUseCase();
    const result = await useCase.execute({ email: 'safe@example.com', password: 'password123' });

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('hash');
    expect(resultStr).not.toContain('argon2');
  });
});
