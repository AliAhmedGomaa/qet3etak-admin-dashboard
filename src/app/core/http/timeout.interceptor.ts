import { HttpInterceptorFn } from '@angular/common/http';
import { timeout, catchError, throwError } from 'rxjs';

export const timeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    timeout(12000),
    catchError((err) =>
      throwError(() =>
        err?.name === 'TimeoutError'
          ? { status: 0, message: 'انتهت مهلة الاتصال بالخادم', error: err }
          : err,
      ),
    ),
  );
