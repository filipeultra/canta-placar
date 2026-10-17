-- ULTRA PLAY · arquivos (Supabase Storage). Rodar depois do schema.sql.
-- avatars: público (foto do perfil). videos: privado (trechos gravados, Pro), cada um na pasta do próprio id.
insert into storage.buckets (id, name, public, file_size_limit) values
  ('avatars', 'avatars', true, 2097152),
  ('videos', 'videos', false, 209715200)
on conflict (id) do nothing;
-- a foto sai do app em JPEG 320×320 (~20 KB); o limite de 512 KB e os tipos barram arquivo que não é imagem
update storage.buckets set file_size_limit = 524288, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'avatars';

-- o bucket é público (a foto abre pelo link); esta regra é para o app listar e trocar a própria foto (upsert pede leitura)
-- nas regras de gravar, o nome não tem trecho vazio, "." nem ".." ("minha-pasta/../pasta-de-outro/foto.jpg" passaria
-- pela 1ª pasta, mas o link normalizado abriria a pasta de outra pessoa)
create policy "avatar: vê os seus" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: cada um na sua pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and name !~ '(^|/)\.{0,2}(/|$)');
create policy "avatar: troca o seu" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and name !~ '(^|/)\.{0,2}(/|$)');   -- não move para a pasta de outra pessoa
create policy "avatar: apaga o seu" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- vídeo: só o dono lê, troca e apaga; gravar novo trecho pede Pro (sem isso, qualquer conta encheria a nuvem).
-- Quem deixou de ser Pro continua vendo, baixando e apagando o que já gravou. Para mostrar a outra pessoa,
-- o app gera um link assinado (createSignedUrl).
update storage.buckets set allowed_mime_types = array['video/webm', 'video/mp4'] where id = 'videos';
create policy "vídeo: o dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vídeo: grava quem é Pro" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text and name !~ '(^|/)\.{0,2}(/|$)' and public.has_pro(auth.uid()));
create policy "vídeo: o dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text and name !~ '(^|/)\.{0,2}(/|$)' and public.has_pro(auth.uid()));
create policy "vídeo: o dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- fotos da partida (como no Strava): saem do app já reduzidas (fotos.js: WebP, 1280 px ~150 KB e 800 px ~50 KB) e sem
-- os metadados da câmera. Caminho: <dono>/<partida>/<id>-lg.webp e <id>-sm.webp (ou .jpg onde o aparelho não gera WebP).
-- Privado: vê quem vê a partida (can_see_match), pelo link assinado ou pelo download com a sessão. Até 6 fotos (12 arquivos)
-- por partida e 120 arquivos por dia por pessoa. Nomes não se repetem: o app sobe com cacheControl de 1 ano.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', false, 524288, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 524288, allowed_mime_types = array['image/webp', 'image/jpeg'];
create or replace function public.photo_room(path text) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select (select count(*) from storage.objects o where o.bucket_id = 'photos' and (storage.foldername(o.name))[2] = (storage.foldername(path))[2]
            and (storage.foldername(o.name))[1] = auth.uid()::text) < 12
     and (select count(*) from storage.objects o where o.bucket_id = 'photos' and (storage.foldername(o.name))[1] = auth.uid()::text
            and o.created_at > now() - interval '24 hours') < 120
$$;
revoke execute on function public.photo_room(text) from public, anon;
create policy "foto da partida: vê quem vê a partida" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.can_see_match((storage.foldername(name))[2], auth.uid()));
create policy "foto da partida: o dono põe na sua partida" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}/f[a-z0-9]{6,24}-(sm|lg)\.(webp|jpg)$'
    and exists (select 1 from public.matches m where m.id = (storage.foldername(name))[2] and m.owner_id = auth.uid() and m.deleted_at is null and m.owner_left_at is null)
    and public.photo_room(name));
create policy "foto da partida: o dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
