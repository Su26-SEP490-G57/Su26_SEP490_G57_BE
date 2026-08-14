import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignNurseRoomsDto {
  @ApiProperty({
    example: ['P502', 'P503'],
    description: 'List of room codes assigned to the nurse',
  })
  @IsArray()
  @IsString({ each: true })
  roomCodes!: string[];
}
