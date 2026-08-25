import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { OrganizationRoleGuard } from '../../../../platform/http/guards/organization-role.guard';
import { RequireCapability } from '../../../../platform/http/decorators/require-capability.decorator';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { OrganizationCapability } from '../../../../shared/kernel/organization-capability';
import {
  InviteOrganizationMemberUseCase,
  InvalidRoleError,
  InsufficientRoleToAssignError,
} from '../../application/use-cases/invite-organization-member.use-case';
import { ListOrganizationMembersUseCase } from '../../application/use-cases/list-organization-members.use-case';
import {
  UpdateMemberRoleUseCase,
  MemberNotFoundError as UpdateMemberNotFoundError,
  LastOwnerProtectionError as UpdateLastOwnerError,
} from '../../application/use-cases/update-member-role.use-case';
import {
  RemoveOrganizationMemberUseCase,
  MemberNotFoundError as RemoveMemberNotFoundError,
  LastOwnerProtectionError as RemoveLastOwnerError,
  CannotRemoveSelfError,
} from '../../application/use-cases/remove-organization-member.use-case';
import {
  RevokeOrganizationInvitationUseCase,
  InvitationNotFoundError,
} from '../../application/use-cases/revoke-organization-invitation.use-case';
import { InviteMemberDto } from '../dtos/invite-member.dto';
import { UpdateMemberRoleDto } from '../dtos/update-member-role.dto';

@ApiTags('organization-members')
@Controller('organizations/:orgId')
@UseGuards(ActorGuard, OrganizationRoleGuard)
export class OrganizationMembersController {
  constructor(
    private readonly inviteMember: InviteOrganizationMemberUseCase,
    private readonly listMembers: ListOrganizationMembersUseCase,
    private readonly updateRole: UpdateMemberRoleUseCase,
    private readonly removeMember: RemoveOrganizationMemberUseCase,
    private readonly revokeInvitation: RevokeOrganizationInvitationUseCase,
  ) {}

  @Post('invitations')
  @HttpCode(201)
  @RequireCapability(OrganizationCapability.MEMBERS_MANAGE)
  @ApiOperation({ summary: 'Invite a new member to the organization' })
  @ApiResponse({ status: 201, description: 'Invitation created' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async invite(
    @Param('orgId') orgId: string,
    @Body() dto: InviteMemberDto,
    @CurrentActor() actor: ICurrentActor,
  ) {
    try {
      const result = await this.inviteMember.execute({
        organizationId: orgId,
        inviterId: actor.userId,
        email: dto.email,
        role: dto.role,
      });
      return {
        id: result.id,
        email: result.email,
        role: result.role,
        expiresAt: result.expiresAt,
      };
    } catch (err) {
      if (err instanceof InvalidRoleError) {
        throw new UnprocessableEntityException(err.message);
      }
      if (err instanceof InsufficientRoleToAssignError) {
        throw new ForbiddenException(err.message);
      }
      throw err;
    }
  }

  @Get('members')
  @RequireCapability(OrganizationCapability.MEMBERS_MANAGE)
  @ApiOperation({ summary: 'List organization members' })
  @ApiResponse({ status: 200, description: 'Members list' })
  async list(@Param('orgId') orgId: string) {
    const members = await this.listMembers.execute({ organizationId: orgId });
    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));
  }

  @Patch('members/:memberId')
  @HttpCode(200)
  @RequireCapability(OrganizationCapability.ROLES_ASSIGN)
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 422, description: 'Last owner protection violation' })
  async updateMemberRole(
    @CurrentActor() actor: ICurrentActor,
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    try {
      await this.updateRole.execute({
        organizationId: orgId,
        memberId,
        newRole: dto.role,
        actorUserId: actor.userId,
      });
      return { success: true };
    } catch (err) {
      if (err instanceof UpdateMemberNotFoundError) {
        throw new NotFoundException(err.message);
      }
      if (err instanceof UpdateLastOwnerError) {
        throw new UnprocessableEntityException(err.message);
      }
      if (err instanceof InsufficientRoleToAssignError) {
        throw new ForbiddenException(err.message);
      }
      throw err;
    }
  }

  @Delete('members/:memberId')
  @HttpCode(200)
  @RequireCapability(OrganizationCapability.MEMBERS_MANAGE)
  @ApiOperation({ summary: 'Remove organization member' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 422, description: 'Last owner protection violation' })
  async removeOrganizationMember(
    @CurrentActor() actor: ICurrentActor,
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
  ) {
    try {
      await this.removeMember.execute({ organizationId: orgId, memberId, actorUserId: actor.userId });
      return { success: true };
    } catch (err) {
      if (err instanceof RemoveMemberNotFoundError) {
        throw new NotFoundException(err.message);
      }
      if (err instanceof RemoveLastOwnerError) {
        throw new UnprocessableEntityException(err.message);
      }
      if (err instanceof CannotRemoveSelfError) {
        throw new ForbiddenException(err.message);
      }
      throw err;
    }
  }

  @Delete('invitations/:invId')
  @HttpCode(200)
  @RequireCapability(OrganizationCapability.INVITATIONS_MANAGE)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  @ApiResponse({ status: 200, description: 'Invitation revoked (idempotent)' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async revokeOrganizationInvitation(
    @Param('orgId') orgId: string,
    @Param('invId') invId: string,
  ) {
    try {
      await this.revokeInvitation.execute({ organizationId: orgId, invitationId: invId });
      return { success: true };
    } catch (err) {
      if (err instanceof InvitationNotFoundError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }
}
