import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    // `AuthGuard('jwt')` is a Passport mixin; its `canActivate` return type
    // (and rxjs's `Observable`, which it's built on) doesn't resolve
    // consistently under this project's type-aware ESLint config even
    // though `tsc --noEmit` is fully clean — a known typescript-eslint/rxjs
    // resolution quirk, not a real type-safety gap. Naming `Observable`
    // explicitly here (e.g. in a return-type annotation) only reproduces
    // the same failure in a new spot, so a blanket disable is the stable fix.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return super.canActivate(context);
  }
}
