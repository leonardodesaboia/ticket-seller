import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository.port';

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

@Injectable()
export class GetCurrentIdentityUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository) {}

  async execute(input: GetCurrentIdentityInput): Promise<GetCurrentIdentityOutput> {
    const profile = await this.userRepository.findProfile(input.userId);

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    return profile;
  }
}
