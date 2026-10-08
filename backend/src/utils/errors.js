export const httpError = (status, message, code = 'ERROR') => Object.assign(new Error(message), { status, code });
export const badRequest = (m, c='BAD_REQUEST') => httpError(400,m,c);
export const unauthorized = (m='Authentication required.', c='UNAUTHORIZED') => httpError(401,m,c);
export const forbidden = (m='You do not have permission for this action.', c='FORBIDDEN') => httpError(403,m,c);
export const notFound = (m='Resource not found.', c='NOT_FOUND') => httpError(404,m,c);
export const conflict = (m='Conflict.', c='CONFLICT') => httpError(409,m,c);
