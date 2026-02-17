#!/usr/bin/env node
/**
 * MIGRAÇÃO: Unificação de tabelas legadas
 * 
 * USO:
 *   node run-migration.js SUA_SENHA_DO_BANCO
 * 
 * A senha está em:
 *   Supabase Dashboard → Settings → Database → Database password
 */

const { Client } = require('pg');
const fs = require('fs');

const password = process.argv[2];
if (!password) {
  console.error('\n❌ Uso: node run-migration.js SUA_SENHA_DO_BANCO\n');
  console.error('   Encontre a senha em: Supabase Dashboard → Settings → Database\n');
  process.exit(1);
}

const client = new Client({
  host: 'db.ugjnylhmjkyagnyxvenk.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: password,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function run() {
  console.log('\n🔌 Conectando ao Supabase PostgreSQL...');
  await client.connect();
  console.log('✅ Conectado!\n');

  const sql = fs.readFileSync('supabase/migrations/unify_watchlist_tables.sql', 'utf-8');
  
  console.log('🚀 Executando migração...\n');
  await client.query(sql);
  
  console.log('✅ Migração concluída com sucesso!');
  console.log('   ✅ watchlist → user_library (migrado)');
  console.log('   ✅ watch_history → watch_progress (migrado)');
  console.log('   ✅ Tabelas legadas removidas');
  console.log('   ✅ Índices otimizados');
  console.log('   ✅ Trigger de updated_at ativo\n');
  
  await client.end();
}

run().catch(err => {
  console.error('\n❌ Erro:', err.message, '\n');
  client.end().catch(() => {});
  process.exit(1);
});
