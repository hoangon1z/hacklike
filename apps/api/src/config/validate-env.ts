export function validateEnv(input:Record<string,unknown>){
 const env={...input} as Record<string,string>;
 const required=['DATABASE_URL','REDIS_URL','JWT_ACCESS_SECRET','JWT_REFRESH_SECRET'];
 const missing=required.filter(key=>!env[key]);if(missing.length)throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
 if(env.JWT_ACCESS_SECRET.length<32||env.JWT_REFRESH_SECRET.length<32)throw new Error('JWT secrets must contain at least 32 characters');
 if(env.JWT_ACCESS_SECRET===env.JWT_REFRESH_SECRET)throw new Error('JWT access and refresh secrets must be different');
 if(env.NODE_ENV==='production'&&(!env.WEB_URL||env.WEB_URL.includes('localhost')))throw new Error('WEB_URL must be the production origin');
 return env;
}
