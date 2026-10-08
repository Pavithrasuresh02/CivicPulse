import { z } from 'zod';
const phone=z.string().trim().regex(/^[0-9]{10}$/,'Phone must be exactly 10 digits.');
const password=z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/[0-9]/);
export const registerSchema=z.object({fullName:z.string().trim().min(2).max(100),email:z.string().trim().toLowerCase().email().max(254),phone,password,confirmPassword:z.string(),gender:z.enum(['MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY'])}).refine(d=>d.password===d.confirmPassword,{path:['confirmPassword'],message:'Passwords do not match.'});
export const citizenLoginSchema=z.object({identifier:z.string().trim().min(3).max(254),password:z.string().min(1).max(72)});
export const officerLoginSchema=z.object({departmentCode:z.string().trim().toUpperCase().min(2).max(30),loginId:z.string().trim().toUpperCase().min(3).max(30),password:z.string().min(1).max(72)});
export const adminLoginSchema=z.object({adminId:z.string().trim().toUpperCase().min(3).max(30),password:z.string().min(1).max(72)});
