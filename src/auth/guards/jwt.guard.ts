import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { catchError, Observable, of, tap } from 'rxjs';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  getRequest(context: ExecutionContext) {
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient();
      const token = client.handshake?.headers?.authorization;

      // Mock a request object Passport expects
      return {
        headers: {
          authorization: token,
        },
      };
    }

    // Default behavior for HTTP
    return super.getRequest(context);
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient();

      const canActivate = super.canActivate(context);

      if (canActivate instanceof Promise) {
        return canActivate.then(
          (result) => {
            if (!result) {
              client.emit('error', { message: 'Failed to connect' });
              client.disconnect();
            }
            return result;
          },
          (_) => {
            client.emit('error', { message: 'Failed to connect' });
            client.disconnect();
            return false; // Fail the request if the promise fails
          },
        );
      }

      // If the result is an Observable, handle it with 'subscribe'
      if (canActivate instanceof Observable) {
        return canActivate.pipe(
          catchError(() => {
            client.emit('error', { message: 'Failed to connect' });
            client.disconnect();
            return of(false);
          }),
          tap((result) => {
            if (!result) {
              client.emit('error', { message: 'Failed to connect' });
              client.disconnect();
            }
          }),
        );
      }

      if (!canActivate) {
        client.emit('error', { message: 'Failed to connect' });
        client.disconnect();
      }
      return canActivate;
    }
    return super.canActivate(context);
  }
}
