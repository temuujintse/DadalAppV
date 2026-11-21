import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { FamilyRole } from '../../generated/prisma/enums';

export class CreateInviteDto {
  @ApiPropertyOptional({ enum: ['PARENT', 'MEMBER', 'CHILD'], default: 'MEMBER' })
  @IsOptional()
  @IsIn(['PARENT', 'MEMBER', 'CHILD'])
  role?: Exclude<FamilyRole, 'OWNER'>;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxUses?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 168, description: 'Defaults to INVITE_TTL_HOURS.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}

export class JoinFamilyDto {
  @ApiProperty({ example: '7KQ2M-X9DPA', description: 'Invite code (case and dashes ignored)' })
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9\s-]+$/, { message: 'code contains invalid characters' })
  code: string;
}

export class InviteDto {
  id: string;
  @ApiProperty({ enum: FamilyRole, enumName: 'FamilyRole' })
  role: FamilyRole;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  createdByName: string;
}

export class CreatedInviteDto extends InviteDto {
  /** Plain invite code. Returned only once — the server stores just a hash. */
  code: string;
}
