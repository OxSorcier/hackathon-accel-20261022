import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { createPool } from '../../src/server/config.js';

describe('effective pg configuration without opening a network connection', () => {
  const certificate=fileURLToPath(new URL('../../config/aiven-project-ca.pem',import.meta.url));
  it.each(['','ssl=0','ssl=no-verify','ssl=true','sslnegotiation=direct','sslmode=no-verify','sslmode=require&uselibpqcompat=true','sslrootcert=%2Fnot-a-file&sslcert=%2Fnot-a-file&sslkey=%2Fnot-a-file'])('keeps verified project TLS after URI normalization: %s',async query=>{
    const pool=await createPool({DATABASE_URL:`postgresql://synthetic:synthetic@example.invalid/example?${query}`,DATABASE_CA_FILE:certificate});
    try{const client=new Client(pool.options);const effective=(client as unknown as {connectionParameters:{ssl:unknown}}).connectionParameters.ssl;expect(effective).toEqual({rejectUnauthorized:true,ca:await readFile(certificate,'utf8')});}finally{await pool.end();}
  });
  it('pins an explicitly selected schema over conflicting URI startup options',async()=>{
    const pool=await createPool({DATABASE_URL:'postgresql://synthetic:synthetic@example.invalid/example?options=-c%20search_path%3Dpublic',DATABASE_CA_FILE:certificate,DATABASE_SCHEMA:'adaptops_industrial_v2'});
    try{const effective=(new Client(pool.options) as unknown as {connectionParameters:{options:string}}).connectionParameters.options;expect(effective).toBe('-c search_path=adaptops_industrial_v2');}finally{await pool.end();}
  });
  it.each(['public,other','bad schema','public;select1','"quoted"',''])('rejects a malformed selected schema before pool creation: %s',async schema=>{await expect(createPool({DATABASE_URL:'postgresql://synthetic:synthetic@example.invalid/example',DATABASE_SCHEMA:schema})).rejects.toThrow();});
});
