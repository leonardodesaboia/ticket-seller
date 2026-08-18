import { Inject, Injectable } from '@nestjs/common';
import { SESSION_REPOSITORY, type ISessionRepository } from '../../domain/ports/session.repository.port';

export interface RevokeSessionInput {
  sessionId: string;
}

@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    await this.sessionRepository.revokeById(input.sessionId);
  }
}
