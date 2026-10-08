export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
export const fail = (res, code, message, status = 400, details) => res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
