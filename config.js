/* ULTRA PLAY · configuração do servidor (Supabase). Vazio = tudo fica no aparelho e nada é enviado.
   A chave "anon" é pública (vai no app de qualquer jeito); quem protege os dados são as regras do banco (supabase/*.sql).
   Nunca ponha aqui a chave "service_role". */
window.ULTRA_CONFIG = {
  supabaseUrl: '',      // ex.: 'https://abcdefghijklmno.supabase.co'
  supabaseAnonKey: '',  // Project Settings → API → anon public
};
