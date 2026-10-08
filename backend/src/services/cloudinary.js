import { v2 as cloudinary } from 'cloudinary';
import { env, cloudinaryConfigured } from '../config/env.js';
if (cloudinaryConfigured) cloudinary.config({cloud_name:env.CLOUDINARY_CLOUD_NAME,api_key:env.CLOUDINARY_API_KEY,api_secret:env.CLOUDINARY_API_SECRET,secure:true});
export async function uploadBuffer(buffer,folder,resourceType='image'){
 if(!cloudinaryConfigured) return null;
 return new Promise((resolve,reject)=>{const stream=cloudinary.uploader.upload_stream({folder,resource_type:resourceType},(err,result)=>err?reject(err):resolve(result));stream.end(buffer);});
}
