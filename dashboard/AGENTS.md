<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Admin menü görünürlüğü — NEXT_PUBLIC_SHOW_WIP

`src/app/admin/layout.tsx` içindeki menü gruplarından `wip: true` işaretliler (🚧 Geliştiriliyor,
🔒 Yakında) mock/gerçek-olmayan veri içerir. Müşteri (Ahmet) görünümünde gizlenir; sadece
`NEXT_PUBLIC_SHOW_WIP="1"` iken (geliştirici) görünür. Yeni mock modül eklerken grubu `wip: true`
işaretle. Detay: `README.md`.
