import { ConflictError } from '../../../../shared/kernel/application-errors';
import { RegisterWithPasswordUseCase } from './register-with-password.use-case';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

const mockHasher: IPasswordHasher = {
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn(),
};

const mockUserRepository: IUserRepository = {
  emailExists: jest.fn().mockResolvedValue(false),
  findUserIdByEmail: jest.fn(),
  findIdentityWithCredential: jest.fn(),
  findProfile: jest.fn(),
  register: jest.fn().mockResolvedValue({ userId: 'user-new-id' }),
};

function makeUseCase(): RegisterWithPasswordUseCase {
  return new RegisterWithPasswordUseCase(mockUserRepository, mockHasher);
}

describe('RegisterWithPasswordUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockUserRepository.emailExists as jest.Mock).mockResolvedValue(false);
    (mockUserRepository.register as jest.Mock).mockResolvedValue({ userId: 'user-new-id' });
    (mockHasher.hash as jest.Mock).mockResolvedValue('$argon2id$hashed');
  });

  it('calls register with email, credentialHash, and emailVerificationToken atomically', async () => {
    const useCase = makeUseCase();
    const result = await useCase.execute({ email: 'new@example.com', password: 'securepassword' });

    expect(result).toHaveProperty('userId');
    expect(mockHasher.hash).toHaveBeenCalledWith('securepassword');
    expect(mockUserRepository.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        credentialHash: '$argon2id$hashed',
        emailVerificationToken: expect.objectContaining({
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
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
    ).rejects.toThrow(ConflictError);

    expect(mockUserRepository.register).not.toHaveBeenCalled();
  });

  it('never exposes password hash in return value', async () => {
    const useCase = makeUseCase();
    const result = await useCase.execute({ email: 'safe@example.com', password: 'password123' });

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('hash');
    expect(resultStr).not.toContain('argon2');
  });

  it('propagates registration error (user + verification token are atomic)', async () => {
    (mockUserRepository.register as jest.Mock).mockRejectedValue(new Error('DB error'));
    const useCase = makeUseCase();

    await expect(
      useCase.execute({ email: 'new@example.com', password: 'password123' }),
    ).rejects.toThrow('DB error');
  });
});
