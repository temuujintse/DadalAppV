import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PET_EVENTS, PetEvent } from '../pet/pet-rules';

export class PetInteractDto {
  @ApiPropertyOptional({ enum: PET_EVENTS, description: 'Omit to let the server pick the moment' })
  @IsOptional()
  @IsIn(PET_EVENTS)
  event?: PetEvent;
}

export class PetInteractionDto {
  @ApiProperty({ enum: PET_EVENTS })
  event: PetEvent;
  message: string;
  @ApiProperty({ enum: ['HAPPY', 'EXCITED', 'CALM', 'PROUD', 'CARING', 'SLEEPY'] })
  emotion: string;
  /** App pet state to play */
  @ApiProperty({ enum: ['IDLE', 'HAPPY', 'CARE', 'SLEEPING', 'CELEBRATE', 'LEVEL_UP'] })
  animation: string;
  @ApiProperty({ enum: ['VIEW_PROGRESS', 'COMPLETE_HABIT', 'CARE_PET', 'VIEW_QUESTS', 'NONE'] })
  suggestedAction: string;
  @ApiProperty({ enum: ['TEMPLATE', 'AI'] })
  source: 'TEMPLATE' | 'AI';
}
