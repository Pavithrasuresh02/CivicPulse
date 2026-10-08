import { ZodError } from 'zod';
export function notFoundHandler(req, res) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` } }); }
export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  if (err instanceof ZodError) return res.status(400).json({ success:false, error:{code:'VALIDATION_ERROR',message:'Invalid input.',details:err.issues.map(i=>({path:i.path,message:i.message}))} });
  const status = Number(err.status) || 500;
  if (status >= 500) console.error(err.message);
  return res.status(status).json({ success:false, error:{ code:err.code || 'INTERNAL_ERROR', message:status >= 500 ? 'Something went wrong.' : err.message } });
}
