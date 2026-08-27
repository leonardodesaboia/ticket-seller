import { type ISessionRepository } from '../../domain/ports/session.repository.port';

export interface RevokeSessionInput {
  sessionId: string;
}

export class RevokeSessionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    await this.sessionRepository.revokeById(input.sessionId);
  }
}
