import { z } from 'zod';
export const answerSchema=z.object({scenarioId:z.coerce.number().int().positive(),optionId:z.coerce.number().int().positive(),responseMs:z.coerce.number().int().min(0).max(600000).optional(),reason:z.string().trim().max(600).optional()});
export const completeSchema=z.object({researchConsent:z.boolean().default(false)});
