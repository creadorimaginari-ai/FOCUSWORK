# Configuració Cloudflare R2 per FocusWork

## Per què R2 i no Supabase Storage?
- Supabase Storage cobra per cada GB descarregat (egress)
- Cloudflare R2: egress **completament gratuït**
- Free tier: 10GB storage + 1 milió operacions/mes

---

## PAS 1 — Crear compte Cloudflare (gratuït)
1. Ves a https://cloudflare.com i crea un compte
2. Verifica l'email

---

## PAS 2 — Crear el bucket R2
1. Al panell de Cloudflare → **R2 Object Storage**
2. Clic a **Create bucket**
3. Nom: `focuswork-photos`
4. Ubicació: automàtica
5. Clic **Create bucket**

---

## PAS 3 — Fer el bucket públic
1. Entra al bucket `focuswork-photos`
2. Pestanya **Settings**
3. Secció **Public access** → **Allow Access**
4. Apunta la URL pública que apareix:
   `https://pub-XXXXXXXXXXXXXXXX.r2.dev`
   ← Guarda aquesta URL, la necessitaràs al Pas 5

---

## PAS 4 — Crear el Cloudflare Worker (per pujar fotos)
R2 no permet pujar directament des del navegador (seguretat).
Necessitem un Worker que faci de pont.

1. Al panell Cloudflare → **Workers & Pages**
2. Clic **Create application** → **Create Worker**
3. Nom: `focuswork-upload`
4. Substitueix tot el codi per aquest:

```javascript
export default {
  async fetch(request, env) {
    // CORS per l'app
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-File-Path, X-Upload-Token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Verificar token de seguretat
    const token = request.headers.get('X-Upload-Token');
    if (token !== env.UPLOAD_TOKEN) {
      return new Response('No autoritzat', { status: 401, headers: corsHeaders });
    }

    const path = request.headers.get('X-File-Path');
    if (!path) return new Response('Falta X-File-Path', { status: 400, headers: corsHeaders });

    // PUJAR
    if (request.method === 'POST') {
      const body = await request.arrayBuffer();
      await env.BUCKET.put(path, body, {
        httpMetadata: { contentType: 'image/jpeg' }
      });
      return new Response(JSON.stringify({ ok: true, path }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ESBORRAR
    if (request.method === 'DELETE') {
      await env.BUCKET.delete(path);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Mètode no permès', { status: 405, headers: corsHeaders });
  }
};
```

5. Clic **Save and Deploy**

---

## PAS 5 — Connectar Worker amb el bucket R2
1. Al Worker `focuswork-upload` → **Settings** → **Bindings**
2. Clic **Add binding** → **R2 Bucket**
3. Variable name: `BUCKET`
4. R2 bucket: `focuswork-photos`
5. Guarda

---

## PAS 6 — Afegir secret de seguretat
1. Al Worker → **Settings** → **Variables**
2. Secció **Environment Variables** → **Add variable**
3. Name: `UPLOAD_TOKEN`
4. Value: qualsevol paraula secreta llarga, ex: `fw-secret-2025-abc123`
   ← Guarda aquesta paraula secreta
5. Marca **Encrypt** ✓
6. Guarda

---

## PAS 7 — Configurar a FocusWork
Obre `index.html` i afegeix just ABANS de la línia `<script src="supabase-config.js">`:

```html
<script>
  window.R2_CONFIG = {
    publicUrl:   'https://pub-XXXXXXXXXXXXXXXX.r2.dev',  // ← del Pas 3
    workerUrl:   'https://focuswork-upload.USUARI.workers.dev', // ← URL del teu Worker
    uploadToken: 'fw-secret-2025-abc123'  // ← el secret del Pas 6
  };
</script>
```

**Com trobar la URL del Worker:**
Al Worker → **Settings** → la URL apareix a dalt (acaba en `.workers.dev`)

---

## PAS 8 — Verificar que funciona
1. Puja l'app amb els fitxers actualitzats
2. Entra a l'app i obre un client
3. Afegeix una foto
4. A la consola del navegador (F12) hauries de veure:
   `✅ Foto a R2: https://pub-xxx.r2.dev/CLIENT_ID/PHOTO_ID.jpg`
5. Al bucket R2 de Cloudflare hauries de veure el fitxer

---

## Fotos antigues (Supabase Storage)
Les fotos que ja tenies pujades a Supabase **seguiran funcionant** — les seves URLs segueixen sent vàlides. Només les fotos **noves** aniran a R2. No cal migrar res.

---

## Cost estimat amb R2
| Usuaris | Fotos/usuari | Storage | Cost/mes |
|---------|-------------|---------|----------|
| 10      | 100 fotos   | ~500MB  | **0€**   |
| 50      | 100 fotos   | ~2.5GB  | **0€**   |
| 200     | 100 fotos   | ~10GB   | **0€** (free tier) |
| 500     | 100 fotos   | ~25GB   | **~0,22€** |

Egress (descàrrega): sempre **0€** amb R2.
