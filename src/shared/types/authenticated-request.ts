import { type Request } from 'express';
import { UserResponseDto } from 'src/modules/user/dtos/user-response.dto';

export class AuthenticatedRequest extends Request {
  user!: UserResponseDto;
}
