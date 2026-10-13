-- ULTRA PLAY · arquivos (Supabase Storage). Rodar depois do schema.sql.
-- avatars: público (foto do perfil). videos: privado (trechos gravados, Pro), cada um na pasta do próprio id.
insert into storage.buckets (id, name, public, file_size_limit) values
  ('avatars', 'avatars', true, 2097152),
  ('videos', 'videos', false, 209715200)
on conflict (id) do nothing;

create policy "avatar: cada um na sua pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: troca o seu" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: apaga o seu" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- vídeo: só o dono lê e grava; para mostrar a outra pessoa, o app gera um link assinado (createSignedUrl)
create policy "vídeo: só o dono" on storage.objects for all to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
