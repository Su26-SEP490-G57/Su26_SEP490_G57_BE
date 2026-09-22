import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignNurseRoomsDto {
  @ApiProperty({
    example: ['P502', 'P503'],
    description: 'Room codes to add to the nurse assignment; existing rooms are retained',
  })
  @IsArray()
  @IsString({ each: true })
  roomCodes!: string[];
}
