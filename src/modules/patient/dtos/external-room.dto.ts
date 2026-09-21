import { ApiProperty } from '@nestjs/swagger';

/** A hospital room as returned by the external HIS (dummy) service. */
export class ExternalRoomDto {
  @ApiProperty({ example: 'P101' })
  roomCode!: string;

  @ApiProperty({ example: 'GI-1', nullable: true })
  floor!: string | null;

  @ApiProperty({ example: 4 })
  bedCount!: number;
}

/** Envelope returned by GET /rooms on the HIS. */
export class ExternalRoomListDto {
  @ApiProperty({ type: [ExternalRoomDto] })
  data!: ExternalRoomDto[];

  @ApiProperty({ example: 12 })
  total!: number;
}
