-- ULTRA PLAY · arquivos (Supabase Storage). Rodar depois do schema.sql.
-- avatars: público (foto do perfil). videos: privado (trechos gravados, Pro), cada um na pasta do próprio id.
insert into storage.buckets (id, name, public, file_size_limit) values
  ('avatars', 'avatars', true, 2097152),
  ('videos', 'videos', false, 209715200)
on conflict (id) do nothing;
-- a foto sai do app em JPEG 320×320 (~20 KB); o limite de 512 KB e os tipos barram arquivo que não é imagem
update storage.buckets set file_size_limit = 524288, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'avatars';

-- o bucket é público (a foto abre pelo link); esta regra é para o app listar e trocar a própria foto (upsert pede leitura)
create policy "avatar: vê os seus" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: cada um na sua pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: troca o seu" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);   -- não move para a pasta de outra pessoa
create policy "avatar: apaga o seu" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- vídeo: só o dono lê, troca e apaga; gravar novo trecho pede Pro (sem isso, qualquer conta encheria a nuvem).
-- Quem deixou de ser Pro continua vendo, baixando e apagando o que já gravou. Para mostrar a outra pessoa,
-- o app gera um link assinado (createSignedUrl).
update storage.buckets set allowed_mime_types = array['video/webm', 'video/mp4'] where id = 'videos';
create policy "vídeo: o dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vídeo: grava quem é Pro" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text and public.has_pro(auth.uid()));
create policy "vídeo: o dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text and public.has_pro(auth.uid()));
create policy "vídeo: o dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
