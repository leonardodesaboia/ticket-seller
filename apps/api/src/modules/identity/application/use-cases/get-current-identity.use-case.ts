import { NotFoundError } from '../../../../shared/kernel/application-errors';
import { type IUserRepository } from '../../domain/ports/user.repository.port';

export interface GetCurrentIdentityInput {
  userId: string;
}

export interface GetCurrentIdentityOutput {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  locale: string;
  timezone: string;
}

export class GetCurrentIdentityUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: GetCurrentIdentityInput): Promise<GetCurrentIdentityOutput> {
    const profile = await this.userRepository.findProfile(input.userId);

    if (!profile) {
      throw new NotFoundError('User not found');
    }

    return profile;
  }
}
