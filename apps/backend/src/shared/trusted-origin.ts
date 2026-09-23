import type { RequestHandler } from 'express';

import { ApplicationError } from './application-error.js';

export function createTrustedOriginMiddleware(
  applicationOrigin: string,
  requireOrigin: boolean,
): RequestHandler {
  return (request, _response, next) => {
    const origin = request.get('origin');
    const fetchSite = request.get('sec-fetch-site');

    if (
      origin === applicationOrigin ||
      fetchSite === 'same-origin' ||
      (!requireOrigin && origin === undefined)
    ) {
      next();
      return;
    }

    next(
      new ApplicationError(
        403,
        'UNTRUSTED_ORIGIN',
        'Request origin is not allowed',
      ),
    );
  };
}
