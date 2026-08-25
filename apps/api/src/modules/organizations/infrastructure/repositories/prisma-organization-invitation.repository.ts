import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { OrganizationInvitation } from '../../domain/entities/organization-invitation.entity';
import type {
  CreateInvitationInput,
  IOrganizationInvitationRepository,
  OrganizationMemberRecord,
} from '../../domain/ports/organization-invitation-repository.port';
import {
  MemberNotFoundError,
  LastOwnerProtectionError,
  InvitationAlreadyUsedError,
  CannotRemoveSelfError,
} from '../../domain/organization.errors';

@Injectable()
export class PrismaOrganizationInvitationRepository implements IOrganizationInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInvitation(input: CreateInvitationInput): Promise<OrganizationInvitation> {
    const record = await this.prisma.organizationInvitation.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        inviterId: input.inviterId,
        email: input.email,
        role: input.role,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return this.toDomain(record);
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<OrganizationInvitation | null> {
    const record = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash },
    });
    return record ? this.toDomain(record) : null;
  }

  async findInvitationById(id: string, organizationId: string): Promise<OrganizationInvitation | null> {
    const record = await this.prisma.organizationInvitation.findFirst({
      where: { id, organizationId },
    });
    return record ? this.toDomain(record) : null;
  }

  async markInvitationUsed(id: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Read invitation inside the transaction: any concurrent revocation between
      // the external read and the UPDATE would create a member from a stale state.
      const invitation = await tx.organizationInvitation.findUniqueOrThrow({ where: { id } });

      // TOCTOU guard: updateMany with usedAt: null AND revokedAt: null ensures
      // only the first concurrent request succeeds; revoked invitations are blocked here.
      const updated = await tx.organizationInvitation.updateMany({
        where: { id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new InvitationAlreadyUsedError();
      }

      // Upsert member: if already exists (e.g., previously removed), update; otherwise create
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId,
          },
        },
        update: {
          role: invitation.role,
          status: 'ACTIVE',
          joinedAt: new Date(),
          removedAt: null,
        },
        create: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
    });
  }

  async revokeInvitation(id: string): Promise<void> {
    await this.prisma.organizationInvitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async isActiveMember(organizationId: string, email: string): Promise<boolean> {
    const count = await this.prisma.organizationMember.count({
      where: {
        organizationId,
        status: 'ACTIVE',
        user: { email },
      },
    });
    return count > 0;
  }

  async findActiveMemberByUserId(
    organizationId: string,
    userId: string,
  ): Promise<{ role: string; id: string } | null> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { id: true, role: true },
    });
    return member;
  }

  async findMemberById(
    organizationId: string,
    memberId: string,
  ): Promise<OrganizationMemberRecord | null> {
    const record = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      include: {
        user: { select: { email: true, displayName: true } },
      },
    });
    if (!record) return null;
    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      role: record.role,
      status: record.status,
      joinedAt: record.joinedAt,
      user: {
        email: record.user.email,
        displayName: record.user.displayName,
      },
    };
  }

  async listActiveMembers(organizationId: string): Promise<OrganizationMemberRecord[]> {
    const records = await this.prisma.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        user: { select: { email: true, displayName: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return records.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      userId: r.userId,
      role: r.role,
      status: r.status,
      joinedAt: r.joinedAt,
      user: {
        email: r.user.email,
        displayName: r.user.displayName,
      },
    }));
  }

  async countActiveOwners(organizationId: string): Promise<number> {
    return this.prisma.organizationMember.count({
      where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
    });
  }

  async updateMemberRole(memberId: string, role: string): Promise<void> {
    await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
    });
  }

  async removeMember(memberId: string): Promise<void> {
    await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { status: 'REMOVED', removedAt: new Date() },
    });
  }

  async updateMemberRoleAtomically(memberId: string, organizationId: string, newRole: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const member = await tx.organizationMember.findFirst({
        where: { id: memberId, organizationId, status: 'ACTIVE' },
        select: { role: true },
      });

      if (!member) {
        throw new MemberNotFoundError();
      }

      if (member.role === 'OWNER' && newRole !== 'OWNER') {
        const ownerCount = await tx.organizationMember.count({
          where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (ownerCount <= 1) {
          throw new LastOwnerProtectionError();
        }
      }

      await tx.organizationMember.update({
        where: { id: memberId },
        data: { role: newRole },
      });
    });
  }

  async removeMemberAtomically(memberId: string, organizationId: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const member = await tx.organizationMember.findFirst({
        where: { id: memberId, organizationId, status: 'ACTIVE' },
        select: { role: true, userId: true },
      });

      if (!member) {
        throw new MemberNotFoundError();
      }

      if (member.userId === actorUserId) {
        throw new CannotRemoveSelfError();
      }

      if (member.role === 'OWNER') {
        const ownerCount = await tx.organizationMember.count({
          where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (ownerCount <= 1) {
          throw new LastOwnerProtectionError();
        }
      }

      await tx.organizationMember.update({
        where: { id: memberId },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
    });
  }

  async findUserEmailById(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }

  private toDomain(record: {
    id: string;
    organizationId: string;
    inviterId: string;
    email: string;
    role: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
  }): OrganizationInvitation {
    return new OrganizationInvitation(
      record.id,
      record.organizationId,
      record.inviterId,
      record.email,
      record.role,
      record.tokenHash,
      record.expiresAt,
      record.createdAt,
      record.usedAt,
      record.revokedAt,
    );
  }
}
