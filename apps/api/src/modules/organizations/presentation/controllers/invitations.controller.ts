import {
  Controller,
  GoneException,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AcceptOrganizationInvitationUseCase,
  InvitationNotFoundError,
  InvitationAlreadyUsedError,
  InvitationRevokedError,
  InvitationExpiredError,
} from '../../application/use-cases/accept-organization-invitation.use-case';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly acceptInvitation: AcceptOrganizationInvitationUseCase,
  ) {}

  @Post(':token/accept')
  @UseGuards(ActorGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept an organization invitation (requires authentication)' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 410, description: 'Invitation expired, used, or revoked' })
  async accept(@Param('token') token: string, @CurrentActor() actor: ICurrentActor) {
    try {
      const result = await this.acceptInvitation.execute({
        rawToken: token,
        userId: actor.userId,
      });
      return {
        organizationId: result.organizationId,
        role: result.role,
      };
    } catch (err) {
      if (err instanceof InvitationNotFoundError) {
        throw new NotFoundException(err.message);
      }
      if (
        err instanceof InvitationAlreadyUsedError ||
        err instanceof InvitationRevokedError ||
        err instanceof InvitationExpiredError
      ) {
        throw new GoneException(err.message);
      }
      throw err;
    }
  }
}
