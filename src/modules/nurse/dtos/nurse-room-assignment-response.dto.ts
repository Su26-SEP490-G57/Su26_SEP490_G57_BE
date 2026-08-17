import { ApiProperty } from '@nestjs/swagger';

export class NurseRoomAssignmentResponseDto {
  @ApiProperty({ example: 3, description: 'User ID of the nurse' })
  nurseUserId!: number;

  @ApiProperty({ example: 'nurse01', description: 'Username of the nurse' })
  username!: string;

  @ApiProperty({ example: 'Điều dưỡng 01', description: 'Full name of the nurse' })
  fullName!: string;

  @ApiProperty({ example: ['P502', 'P503'], description: 'List of assigned room codes' })
  assignedRooms!: string[];
}

export class HospitalRoomSummaryDto {
  @ApiProperty({ example: 'P502', description: 'Room code' })
  roomCode!: string;

  @ApiProperty({ example: 2, description: 'Number of active patients in this room' })
  patientCount!: number;

  @ApiProperty({ example: [{ id: 3, fullName: 'Điều dưỡng 01' }] })
  assignedNurses!: { id: number; fullName: string; username: string }[];
}
